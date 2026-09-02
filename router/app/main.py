"""SeedUp Router — FastAPI 진입점.

실행: uvicorn app.main:app --reload --port 8030

프론트에는 `/api/chat` 을 그대로 노출. (예전엔 BenefitUp-Agent 가 같은 이름의
`/api/chat` 을 직접 서빙해서 프론트가 base URL 만 바꾸면 라우터로 스위치됐지만,
BenefitUp-Agent 쪽은 `/api/v2/policy` 로 개명됨 — policy_client.py 참고. 라우터의
`/api/chat` 자체 계약은 그대로 유지.)
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage


# 통합 .env 로드: SeedUp/.env.local 을 라우터가 함께 읽는다.
# 프론트(Next.js) 가 자동으로 읽는 그 파일 하나를 세 프로세스가 공유하기 위함.
# 이미 셸에 export 된 값이 있으면 그것을 우선 (override=False).
_SEEDUP_ROOT = Path(__file__).resolve().parents[2]
for _name in (".env.local", ".env"):
    _p = _SEEDUP_ROOT / _name
    if _p.is_file():
        load_dotenv(_p, override=False)

from .router_graph import get_app as get_router_app  # noqa: E402 — env 로드 이후 import
from .schemas import ChatRequestIn, ChatResponseOut  # noqa: E402


app = FastAPI(title="SeedUp Router", version="0.1.0")

origins = [v.strip() for v in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponseOut)
def chat(req: ChatRequestIn) -> ChatResponseOut:
    # 요청 단위 구분선: 한 turn 안에서 agent_node 가 여러 번 찍혀도
    # 어디서부터가 "새 /api/chat" 인지 눈에 띄게 하려는 용도.
    print("─" * 72)
    print(f"[/api/chat] thread={req.threadId[:8]}.. msg_len={len(req.message)}")

    router = get_router_app()
    thread_config = {"configurable": {"thread_id": req.threadId}}

    # 라우터 안에서 하위 에이전트 각자의 세션 id 를 유지.
    # 라우터의 thread_id 에 접미어를 붙여 결정적으로 파생 → 재접속 시 같은 값.
    policy_thread_id = f"{req.threadId}::policy"
    roadmap_thread_id = f"{req.threadId}::roadmap"

    # MemorySaver 체크포인트는 리듀서가 없는 필드를 이번 turn 의 invoke 입력값으로
    # 그대로 덮어쓴다. profile_delivered_* 를 매번 False 로 넣으면 하위 노드가 직전
    # turn 에 True 로 저장해둔 값이 다음 turn 에서 무조건 지워져 "첫 호출" 상태가
    # 영원히 반복된다 — 직전 체크포인트 값을 먼저 읽어 이어받는다.
    prior_state = router.get_state(thread_config).values or {}

    # profile 도 같은 문제를 겪는다: 이번 요청의 profile 로 무조건 덮어쓰면, 프론트가
    # 어떤 이유로든(레이스·새로고침 타이밍 등) profile 없이 요청을 보낸 turn 에
    # 라우터가 이미 갖고 있던 완전한 프로필이 통째로 사라진다 — 그 뒤로는 매번
    # profile_ask 폼이 다시 뜨는 버그. profile_delivered_* 와 동일하게 prior_state
    # 위에 이번 turn 값을 얹는(병합) 방식으로 방어한다.
    # exclude_none=True: 이번 요청에 없는/null 인 필드가 이전 turn 의 값을 지우지
    # 않게 — 프론트는 매 turn 전체 프로필을 다시 보내는 게 정상이라 평소엔 결과가
    # 기존과 동일하고, 위 방어가 필요한 예외적인 turn 에서만 차이가 난다.
    prior_profile = prior_state.get("profile")
    incoming_profile = req.profile.model_dump(exclude_none=True) if req.profile else None
    profile = {**(prior_profile or {}), **(incoming_profile or {})} or None

    initial = {
        "messages": [HumanMessage(content=req.message)],
        "policy_thread_id": policy_thread_id,
        "roadmap_thread_id": roadmap_thread_id,
        "profile": profile,
        # profile_delivered_* 는 첫 호출 후 하위 노드에서 True 로 flip 되어
        # 체크포인트에 저장된다. 신규 thread 면 prior_state 가 비어 있어 False.
        "profile_delivered_policy": prior_state.get("profile_delivered_policy", False),
        "profile_delivered_roadmap": prior_state.get("profile_delivered_roadmap", False),
        "last_roadmap_plan": prior_state.get("last_roadmap_plan"),
        "answering_missing_fields": req.isMissingFieldAnswer,
        "collected_blocks": [],
    }

    try:
        final = router.invoke(initial, config=thread_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"router failed: {type(e).__name__}") from e

    # 하위 에이전트가 준 블록 + 라우터가 마지막에 붙인 짧은 텍스트를 합침.
    blocks = list(final.get("collected_blocks") or [])
    last_msg = final["messages"][-1]
    content = getattr(last_msg, "content", None) or ""
    if isinstance(content, list):
        content = "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
    if content.strip():
        # 하위 블록보다 앞에 짧은 안내가 오도록 head 에 삽입.
        blocks.insert(0, {"type": "text", "content": content.strip()})

    # 이번 turn 에 프로필이 patch 로 바뀌었으면 (예: Roadmap-Agent 의 requestPatch
    # 또는 slot-fill 결과) 최종 프로필을 실어보내서 프론트가 localStorage 를
    # 동기화할 수 있게 한다. patch 가 없으면 None → 프론트는 무시.
    final_profile = final.get("profile")
    original_profile = profile or {}
    profile_patch: dict[str, Any] | None = None
    if final_profile and final_profile != original_profile:
        profile_patch = {
            k: v for k, v in final_profile.items() if original_profile.get(k) != v
        }

    return ChatResponseOut(
        threadId=req.threadId,
        blocks=blocks,
        profilePatch=profile_patch,
    )


# ── 개발용: thread_id 자동 발급 편의 엔드포인트 ─────────────────
@app.get("/api/new-thread")
def new_thread() -> dict[str, str]:
    return {"threadId": uuid.uuid4().hex}
