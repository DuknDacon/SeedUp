"""라우터 LangGraph.

역할: 사용자 turn 을 받아 "정책 매칭"과 "자산관리 로드맵" 중 어느 하위
에이전트를 부를지 (또는 둘 다 부를지) 판단한다. 하위 에이전트가 돌려준
`ChatBlock` 들을 그대로 relay.

BenefitUp-Agent 안에 이미 native tool calling 이 있고, Roadmap-Agent 도
자기 로직이 있다. 라우터의 툴은 "그 서비스에 HTTP 로 위임" 하나뿐이라
레벨이 다르다 → 툴 콜링이 중첩되지 않고 각자 자기 계층에서만 돈다.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Annotated, Any, Sequence, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from .policy_client import call_policy_agent
from .roadmap_client import call_roadmap_agent


ROUTER_MODEL = os.getenv("ROUTER_MODEL", "gemini-2.5-flash")


# ============================================================
# State
# ============================================================
class RouterState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # 하위 에이전트 각자의 세션 id — 라우터의 thread 안에서 유지.
    # 하위 에이전트가 자기 대화 이력(RAG 결과·직전 조회 등)을 이어갈 수 있게 한다.
    policy_thread_id: str
    roadmap_thread_id: str

    # 첫 turn 에만 실려온 프로필. 이후 turn 에서도 하위 에이전트 첫 호출 때
    # 재사용될 수 있게 라우터 상태에 캐시.
    profile: dict[str, Any] | None
    profile_delivered_policy: bool
    profile_delivered_roadmap: bool

    # 로드맵 계산 결과 캐시 (임시 브릿지용 — roadmap 대화형 API 가 붙으면 제거).
    last_roadmap_plan: dict[str, Any] | None

    # 이번 turn 에 하위 에이전트가 돌려준 ChatBlock 들 (dict 원본).
    # agent_node 가 최종 응답에 실어 프론트로 relay.
    collected_blocks: list[dict[str, Any]]


# ============================================================
# 툴: 두 하위 에이전트에 대한 HTTP 위임
# ============================================================
# LangChain @tool 이 반환 값을 LLM 컨텍스트로 다시 태우기 때문에, 실제 블록은
# ToolMessage.artifact 로 실어보내고 content 에는 짧은 요약만 둔다.
# collected_blocks 수거는 tool_node 이후 별도 노드에서 처리.
@tool(response_format="content_and_artifact")
def ask_policy_agent(query: str) -> tuple[str, dict[str, Any]]:
    """지금 사용자에게 매칭 가능한 **정책자금·서민금융·전세대출·청년정책·복지서비스**
    를 골라줘야 할 때 사용합니다. "조건이 뭐야?", "금리·한도 알려줘", "나한테 맞는
    지원 뭐 있어?", "이 대출 자격 되나?" 같은 매칭·조회성 질문이 여기 해당합니다.

    아래는 이 툴을 쓰지 말아야 할 것 (대신 ask_roadmap_agent 로):
    - "3년 안에 3천만원 모으려면 매달 얼마씩?" 같은 자산 형성 계획
    - "적금·펀드·ETF 를 어떻게 배분할까" 같은 상품 배분 전략

    Args:
        query: 사용자 원문 질문을 **그대로** 넘기세요. 키워드 축약 금지.
    """
    # 실제 HTTP 호출은 policy_tool_runner 에서 (LangGraph tool 은 sync 인 척
    # 계약만 잡아두고, 실행은 tool_node 를 대체한 커스텀 노드가 담당).
    return ("__deferred__", {"tool": "ask_policy_agent", "query": query})


@tool(response_format="content_and_artifact")
def ask_roadmap_agent(query: str) -> tuple[str, dict[str, Any]]:
    """사용자의 **자산 형성 로드맵**을 만들거나 조정해야 할 때 사용합니다.
    "월 얼마씩 모아야?", "3년 뒤 3천만원 목표", "적금·투자 배분 짜줘",
    "리스크 성향 바꾸면?" 같은 계획·시뮬레이션 질문이 여기 해당합니다.

    아래는 이 툴을 쓰지 말아야 할 것 (대신 ask_policy_agent 로):
    - "청년내일저축계좌 조건이 뭐야?" 같은 특정 정책 스펙 조회
    - "전세 대출 금리 비교" 같은 상품 매칭

    Args:
        query: 사용자 원문 질문을 **그대로** 넘기세요.
    """
    return ("__deferred__", {"tool": "ask_roadmap_agent", "query": query})


TOOLS = [ask_policy_agent, ask_roadmap_agent]


# ============================================================
# LLM 싱글톤
# ============================================================
_router_llm = None


def _get_router_llm():
    global _router_llm
    if _router_llm is None:
        t0 = time.monotonic()
        _router_llm = ChatGoogleGenerativeAI(
            # gemini-3.5-flash-lite는 고정 샘플링만 지원해 temperature를
            # 넘겨도 무시되고 매 호출마다 경고 로그만 남는다 — 실효가 없어 제거.
            model=ROUTER_MODEL,
            max_output_tokens=1200,
            thinking_level="low",
        )
        print(f"[ⓘ INIT] Router LLM (gemini/{ROUTER_MODEL}): {time.monotonic()-t0:.2f}s")
    return _router_llm


ROUTER_SYSTEM_PROMPT = """당신은 SeedUp 통합 상담의 라우터입니다.
사용자에게 직접 답변하지 않고, 두 개의 하위 에이전트 중 어울리는 쪽으로
질문을 위임합니다.

- ask_policy_agent : 지금 매칭 가능한 정책자금·서민금융·전세대출·청년정책·
  복지서비스 조회. 상품/정책의 **조건·금리·한도·자격**을 묻는 질문.
- ask_roadmap_agent: 자산 형성 로드맵. **월 얼마씩·몇 년에 걸쳐·어떤 상품에
  배분**할지 계획·시뮬레이션 성 질문. **ISA·연금저축·세액공제·비과세 등
  일반 금융 지식/제도를 묻는 질문(financial QA)도 여기로** 보내세요 —
  공식 문서 근거 기반 답변을 제공합니다.

라우팅 규칙:
1. 사용자의 질문이 위 두 카테고리 중 하나에 명확히 해당하면 **반드시 툴을
   호출**하세요. 절대 스스로 답하지 마세요.
2. 한 문장에 두 요구가 섞여 있으면 **툴 두 개를 병렬 호출**하세요.
3. "왜 그렇게 추천했어?", "이 상품 자세히 알려줘" 같은 후속 질문이면 **직전에
   실제로 결과를 준 툴과 같은 툴**로 이어가세요 — 직전이 로드맵이었으면
   ask_roadmap_agent, 정책이었으면 ask_policy_agent (둘 다 대칭으로 적용).
   "이거"/"이 상품" 같은 대명사는 항상 대화에서 **가장 최근에 다룬 화제**를
   가리킵니다. 사용자가 명확히 새로운 화제(다른 카테고리)를 물어볼 때만
   과감히 다른 툴로 스위치하세요.
4. 인사·잡담 등 어느 툴도 안 맞는 turn 이면 툴을 부르지 말고 짧게 한국어로
   답변하세요.
5. 툴이 이미 실행되어 결과가 컨텍스트에 있으면 재요약하지 말고 **딱 한 줄**
   짧은 안내 문장만 텍스트로 붙이세요 — 카드/표는 하위 에이전트가 만든 걸
   프론트가 그대로 렌더링합니다.

당신은 툴이 돌려준 구조화된 블록(policy_results/roadmap_plan 등)의 내용을
따로 요약·복제하지 않습니다.
"""


# ============================================================
# Nodes
# ============================================================
def agent_node(state: RouterState) -> dict[str, Any]:
    """LLM 이 tool 을 고르는 노드. tool 이 없으면 그대로 사용자 응답."""
    print("[R-01] router agent_node 진입")
    llm = _get_router_llm().bind_tools(TOOLS)

    # 컨텍스트: system + 유효 히스토리 (Human/AI 텍스트만 유지, 이번 turn 은 통째로).
    messages = list(state["messages"])
    kept: list[BaseMessage] = []
    for m in messages:
        if isinstance(m, (HumanMessage, ToolMessage)):
            kept.append(m)
        elif isinstance(m, AIMessage):
            # 툴콜 있는 AIMessage 는 유지 (툴 리절트와 짝), 순수 답변도 유지
            kept.append(m)

    invoke_msgs: list[BaseMessage] = [SystemMessage(content=ROUTER_SYSTEM_PROMPT), *kept]
    t0 = time.monotonic()
    try:
        resp: AIMessage = llm.invoke(invoke_msgs)
    except Exception as e:
        print(f"[R-01] ⚠︎ router LLM 오류: {type(e).__name__} | {str(e)[:200]}")
        return {
            "messages": [
                AIMessage(content="일시적 오류로 답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.")
            ],
            "collected_blocks": [],
        }
    print(
        f"[R-01] router LLM {time.monotonic()-t0:.2f}s | "
        f"tool_calls={[tc.get('name') for tc in getattr(resp, 'tool_calls', None) or []]}"
    )
    return {"messages": [resp]}


def should_continue(state: RouterState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "end"


async def _run_tool_calls(state: RouterState) -> dict[str, Any]:
    """LLM 이 부른 툴들을 실제 HTTP 로 실행. 병렬 호출 지원."""
    last: AIMessage = state["messages"][-1]  # type: ignore[assignment]
    tool_calls = getattr(last, "tool_calls", None) or []
    if not tool_calls:
        return {}

    profile = state.get("profile")
    delivered_policy = state.get("profile_delivered_policy", False)
    delivered_roadmap = state.get("profile_delivered_roadmap", False)
    last_plan = state.get("last_roadmap_plan")

    async def _run_one(tc: dict[str, Any]):
        name = tc.get("name")
        args = tc.get("args") or {}
        query = args.get("query") or ""
        tcid = tc.get("id") or f"tc_{uuid.uuid4().hex[:8]}"

        try:
            if name == "ask_policy_agent":
                # Policy-Agent 는 roadmap 과 달리 매 질문마다 프로필이 필수는
                # 아니지만, 프로필 자체는 있으면 매번 그대로 실어보낸다 — 한 번
                # 전달했다고 이후 None 으로 바꿔치면 개인화 질문마다 폴백 폼
                # (profile_ask) 이 다시 뜨는 버그가 생긴다.
                blocks, profile_sent = await call_policy_agent(
                    thread_id=state["policy_thread_id"],
                    message=query,
                    profile=profile,
                )
                summary = f"[정책 매칭] {len(blocks)} block(s) 수신"
                return {
                    "tool_call_id": tcid,
                    "name": name,
                    "blocks": blocks,
                    "summary": summary,
                    "flags": {"policy": True, "profile_delivered": profile_sent},
                }

            if name == "ask_roadmap_agent":
                # Roadmap-Agent 는 매 요청마다 프로필 전량을 요구하므로 delivered
                # 플래그와 무관하게 항상 실려보낸다 (아니면 422).
                # 첫 호출 여부는 "화제 전환 첫 turn" 힌트 주입에 쓰인다
                # (roadmap_client 의 is_first_call 주석 참고).
                blocks, request_patch = await call_roadmap_agent(
                    thread_id=state["roadmap_thread_id"],
                    message=query,
                    profile=profile,
                    last_plan=last_plan,
                    is_first_call=not delivered_roadmap,
                )
                # roadmap_plan 블록이 새로 왔으면 캐시 갱신
                new_plan = next(
                    (b.get("plan") for b in blocks if b.get("type") == "roadmap_plan"),
                    None,
                )
                summary = f"[로드맵] {len(blocks)} block(s) 수신"
                return {
                    "tool_call_id": tcid,
                    "name": name,
                    "blocks": blocks,
                    "summary": summary,
                    "flags": {
                        "roadmap": True,
                        "new_plan": new_plan,
                        # Roadmap-Agent 가 이번 turn 에 조정한 조건 patch. 라우터
                        # state.profile 에 병합해서 다음 turn 부터 반영.
                        "profile_patch": request_patch,
                    },
                }

            return {
                "tool_call_id": tcid,
                "name": name or "unknown",
                "blocks": [],
                "summary": f"unknown tool: {name}",
                "flags": {},
            }
        except Exception as e:
            print(f"[R-TOOL] ⚠︎ {name} 실패: {type(e).__name__} | {str(e)[:200]}")
            return {
                "tool_call_id": tcid,
                "name": name or "unknown",
                "blocks": [
                    {
                        "type": "text",
                        "content": f"'{name}' 하위 에이전트가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.",
                    }
                ],
                "summary": f"error: {type(e).__name__}",
                "flags": {"error": True},
            }

    results = await asyncio.gather(*(_run_one(tc) for tc in tool_calls))

    tool_messages: list[ToolMessage] = []
    collected: list[dict[str, Any]] = []
    updates: dict[str, Any] = {}
    # 이번 turn 에 여러 툴이 프로필 patch 를 낸 경우 순서대로 병합.
    merged_profile: dict[str, Any] | None = None
    for r in results:
        tool_messages.append(
            ToolMessage(
                content=r["summary"],
                tool_call_id=r["tool_call_id"],
                name=r["name"],
            )
        )
        collected.extend(r["blocks"])
        # profile_delivered 는 "실제로 BenefitUp 에 프로필을 실어보냈는지" 를
        # 뜻한다 (플래그 자체가 아니라). policy 쪽은 이제 이 플래그로 profile
        # 전달 여부를 가리지 않으므로(위 ask_policy_agent 분기 참고) 진단/기록
        # 목적으로만 갱신한다.
        if r["flags"].get("policy") and r["flags"].get("profile_delivered") and not delivered_policy:
            updates["profile_delivered_policy"] = True
        if r["flags"].get("roadmap") and not delivered_roadmap:
            updates["profile_delivered_roadmap"] = True
        if r["flags"].get("new_plan"):
            updates["last_roadmap_plan"] = r["flags"]["new_plan"]
        patch = r["flags"].get("profile_patch")
        if patch:
            if merged_profile is None:
                merged_profile = dict(profile or {})
            merged_profile.update(patch)

    if merged_profile is not None:
        updates["profile"] = merged_profile

    updates["messages"] = tool_messages
    updates["collected_blocks"] = collected
    return updates


def tools_node(state: RouterState) -> dict[str, Any]:
    """async 로직을 sync 진입점으로 감싸는 얇은 어댑터."""
    print("[R-02] tools_node 진입")
    return asyncio.run(_run_tool_calls(state))


# ============================================================
# Graph
# ============================================================
_app = None


def _build_graph():
    g = StateGraph(RouterState)
    g.add_node("agent", agent_node)
    g.add_node("tools", tools_node)
    g.set_entry_point("agent")
    g.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    # 툴이 끝나면 다시 agent 로 → 짧은 relay 텍스트를 붙여 종료.
    g.add_edge("tools", "agent")
    return g


def get_app():
    global _app
    if _app is None:
        t0 = time.monotonic()
        _app = _build_graph().compile(checkpointer=MemorySaver())
        print(f"[ⓘ INIT] Router LangGraph app: {time.monotonic()-t0:.2f}s")
    return _app


__all__ = ["get_app", "RouterState"]
