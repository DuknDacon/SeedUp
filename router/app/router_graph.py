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

    # 이번 turn이 profile_ask(로드맵 미확인 필드/동적 게이트) 답변 제출인지 —
    # /api/chat 이 그대로 실어보낸 신호. Roadmap-Agent의 사전 체크 게이트 판단에
    # 쓰인다(roadmap_client.call_roadmap_agent 참고).
    answering_missing_fields: bool

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

- ask_policy_agent : 지금 매칭 가능한 전세대출·청년정책·
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
3-1. 직전 ToolMessage에 **"이번 turn에 아직 답변 대기 중인 질문"**이 적혀
   있으면, 이번 사용자 turn이 그 질문에 대한 답처럼 보이는 경우(예/아니오,
   숫자, 날짜, 짧은 사실 진술 등) **그 질문을 냈던 것과 같은 툴로 무조건
   이어가세요.** 답변 문구 안에 "정책"/"지원금"/"자격"/"중소기업" 같은 다른
   카테고리를 연상시키는 단어가 섞여 있어도 무시하세요 — 예를 들어 로드맵이
   "현재 중소기업에 재직 중인가요?"를 물어봤는데 사용자가 "중소기업 재직 안
   해요"라고 답하면, 이건 정책 질문이 아니라 **로드맵이 방금 물어본 질문에
   대한 답**이므로 반드시 ask_roadmap_agent로 보내세요.
3-2. "참여기업이 뭐야?", "우대형이 뭐야?" 처럼 방금 화면에 나온 정책/게이트
   질문에 등장한 **용어를 설명해 달라는 질문**도 financial QA로 보고 직전에
   그 용어가 나온 것과 같은 툴로 보내세요(대개 ask_roadmap_agent) — 스스로
   정의를 알고 있어도 **절대 직접 답하지 말고 반드시 툴을 호출**하세요. 이런
   용어 질문에 스스로 먼저 답하고 나서 툴까지 호출하면, 툴이 자기 문서에서
   못 찾았다며 상반된 답을 다시 내놓아 사용자에게 앞뒤가 안 맞는 두 개의
   답이 겹쳐 보이는 문제가 생깁니다.
3-3. 직전이 로드맵이었으면 **적금·예금·저축·펀드·ETF·상품** 카테고리를
   묻는 후속(예: "내게 맞는 적금은?", "더 맞는 건 뭐야?")은 대명사가 없어도
   ask_roadmap_agent로 이어가세요. "맞는/추천/골라/선택"이 정책 매칭처럼
   보여도 로드맵 후속의 정상적인 화법입니다. "정책자금·지원금·청년정책"을
   **명시적으로** 새로 꺼낼 때만 ask_policy_agent로 스위치하세요.
4. 인사·잡담 등 어느 툴도 안 맞는 turn 이면 툴을 부르지 말고 짧게 한국어로
   답변하세요. **스스로 답하는 것(규칙 4)과 툴을 호출하는 것(규칙 1~3)은
   상호배타적입니다 — 같은 turn에 절대 둘 다 하지 마세요.** 툴을 하나라도
   호출하기로 했다면 이번 응답에는 그 사실 외의 실질적인 내용(정의·설명·
   숫자 등)을 스스로 적지 마세요.
5. 툴이 이미 실행되어 결과가 컨텍스트에 있으면 재요약하지 말고 **딱 한 줄**
   짧은 안내 문장만 텍스트로 붙이세요 — 카드/표는 하위 에이전트가 만든 걸
   프론트가 그대로 렌더링합니다.
5-1. 이 한 줄은 **실제로 일어난 일과 정확히 일치**해야 합니다. ToolMessage의
   `conversationStatus`를 반드시 확인하세요 — `needs_input`이면 로드맵이
   확정·변경되지 않고 확인 질문만 나간 것이므로 "반영했습니다"/"다시
   구성했습니다"/"완료했습니다" 같은 완료형 문구를 쓰지 마세요("~을 확인
   중입니다" 처럼 진행형으로 쓰거나, 안내 문장 자체를 생략하세요).
   `completed`일 때만 "반영/계산/구성했습니다" 같은 완료형을 쓰세요.
5-2. `completed`라고 해서 **사용자가 말한 조건이 반영된 것은 아닙니다.** 조건
   변경이 실제로 이뤄진 것은 `conversationIntent`가 `condition_change`일 때
   뿐입니다. 그 외 intent(`policy_eligibility`, `financial_qa` 등)에서는
   사용자가 금액·기간을 말했더라도 **"반영했습니다"/"변경했습니다"라고 쓰지
   마세요** — 예: "월 70만원 기준으로 정부 기여금 얼마나 붙어?"에 대해
   policy_eligibility로 답했다면 월 저축액은 반영되지 않았으므로 "조회해
   드렸습니다" 수준으로만 안내하세요. 반영 여부는 하위 에이전트가 자기 문구로
   직접 안내하니 그 내용을 뒤집거나 앞질러 말하지 마세요.

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

    # ── 변경 전 ──
    # invoke_msgs: list[BaseMessage] = [SystemMessage(content=ROUTER_SYSTEM_PROMPT), *kept]
    # ── 변경 후 ──
    # 로드맵을 이미 한 번이라도 낸 스레드라면, 마지막 plan 요약을 system-side
    # 컨텍스트로 하나 더 얹는다. ToolMessage 요약(_roadmap_plan_hint) 만으로도
    # 다음 한두 turn 은 버티지만, 잡담이 여러 turn 끼면 컨텍스트 앞쪽으로 밀려
    # 사라진다 — 라우터가 "적금 중에 뭐가 나아?" 같은 후속을 규칙 3-3 이 아닌
    # 규칙 4(직접 답변) 로 오분류하는 원인.
    plan_ctx = _roadmap_plan_hint(state.get("last_roadmap_plan"))
    ctx_msgs: list[BaseMessage] = []
    if plan_ctx:
        ctx_msgs.append(
            SystemMessage(
                content=(
                    "직전까지 이 스레드에서 로드맵으로 제시된 시나리오 요약입니다"
                    " (사용자에게 다시 나열하지 말고, 후속 질문의 지시대상 판단에만 사용):"
                    f"{plan_ctx}"
                )
            )
        )

    invoke_msgs: list[BaseMessage] = [
        SystemMessage(content=ROUTER_SYSTEM_PROMPT),
        *ctx_msgs,
        *kept,
    ]
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


def _pending_question_hint(blocks: list[dict[str, Any]]) -> str:
    """ToolMessage 요약에 이번 turn이 물어본 profile_ask 질문 문구를 그대로
    실어보낸다.

    이게 없으면(예전엔 "[로드맵] 1 block(s) 수신" 처럼 완전히 일반화된 요약만
    남았다) 라우터 LLM은 다음 turn에 "직전에 이 툴이 정확히 뭘 물어봤는지"를
    전혀 기억하지 못한 채 사용자 답변 텍스트의 표면 키워드만으로 툴을 다시
    고른다 — "중소기업 재직 안 해요"처럼 정책 자격조건과 겹치는 단어가 섞인
    답변이 실제로는 로드맵 쪽이 방금 물어본 질문에 대한 답인데도 ask_policy_agent
    로 잘못 넘어가던 버그의 원인. 질문 문구를 요약에 남겨두면 LLM이 "이건 내가
    막 물어본 질문에 대한 답이구나"를 인식하고 같은 툴로 이어갈 근거가 생긴다.
    """
    field_sources = [
        b.get("fields") for b in blocks if b.get("type") == "profile_ask"
    ]
    questions = [
        f.get("question", "")
        for fields in field_sources
        for f in (fields or [])
        if f.get("question")
    ]
    if not questions:
        return ""
    return " | 이번 turn에 아직 답변 대기 중인 질문: " + " / ".join(questions)


def _roadmap_plan_hint(plan: dict[str, Any] | None) -> str:
    """이번(또는 마지막) turn 에 나간 로드맵의 추천/대안 시나리오 이름·상품유형·
    주요 배분을 한 줄 요약으로 만든다.

    ToolMessage.content 에 실어두면 후속 turn 에서 라우터 LLM 이 "무엇을
    추천했는지" 를 툴 재호출 없이 프롬프트 안에서 확인할 수 있어, "너가 알려준
    적금 중에 뭐가 잘 맞아?" 같은 후속을 규칙 3-3(→ ask_roadmap_agent) 로
    올바르게 라우팅한다. agent_node 에서도 last_roadmap_plan 스냅샷을 같은
    포맷으로 다시 태우므로 컨텍스트 잘림 대비 안전망 역할까지 겸한다.
    """
    if not plan:
        return ""

    def _one(tag: str, sc: dict[str, Any] | None) -> str | None:
        if not sc:
            return None
        title = sc.get("title") or "-"
        ptype = sc.get("productType") or "-"
        allocs = sc.get("allocations") or []
        labels = [a.get("label") for a in allocs if a.get("label")]
        alloc_txt = f" / 배분: {', '.join(labels)}" if labels else ""
        return f"{tag}={title}({ptype}){alloc_txt}"

    parts = [
        _one("추천", plan.get("recommended")),
        _one("대안", plan.get("alternative")),
    ]
    parts = [p for p in parts if p]
    if not parts:
        return ""
    return " | 이번 turn 제시 시나리오: " + " ; ".join(parts)


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
    answering_missing_fields = state.get("answering_missing_fields", False)

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
                summary = f"[정책 매칭] {len(blocks)} block(s) 수신" + _pending_question_hint(blocks)
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
                    answering_missing_fields=answering_missing_fields,
                )
                # roadmap_plan 블록이 새로 왔으면 캐시 갱신
                new_plan = next(
                    (b.get("plan") for b in blocks if b.get("type") == "roadmap_plan"),
                    None,
                )
                # 라우터 LLM이 자기 안내 문장을 쓸 때 이번 turn이 실제로 뭔가
                # 확정한 건지(completed) 아니면 확인 질문만 나간 건지(needs_input)
                # 알 방법이 없으면, needs_input인데도 "~반영했습니다/~완료했습니다"
                # 처럼 완료형으로 써버려 실제 결과와 안 맞는 문구가 나간다 —
                # conversationStatus/Intent를 요약에 실어보내 이를 방지한다.
                conv_status = (new_plan or {}).get("conversationStatus")
                conv_intent = (new_plan or {}).get("conversationIntent")
                # ── 변경 전 (후속 질문에서 라우터 LLM 이 무엇을 추천했었는지
                #    프롬프트 안에서 알아낼 방법이 없어 "저는 이전 대화 내용을
                #    기억하지 못합니다" 로 빠지던 원인) ──
                # summary = (
                #     f"[로드맵] {len(blocks)} block(s) 수신 | "
                #     f"conversationStatus={conv_status} conversationIntent={conv_intent}"
                #     + _pending_question_hint(blocks)
                # )
                # ── 변경 후: 추천/대안 시나리오의 제목·productType·주요 배분
                #    라벨을 요약에 실어보내, 다음 turn 라우터가 규칙 3-3 을
                #    발동할 근거를 갖게 한다. ──
                summary = (
                    f"[로드맵] {len(blocks)} block(s) 수신 | "
                    f"conversationStatus={conv_status} conversationIntent={conv_intent}"
                    + _roadmap_plan_hint(new_plan)
                    + _pending_question_hint(blocks)
                )
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
