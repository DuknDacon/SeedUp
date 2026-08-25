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

    profile = req.profile.model_dump() if req.profile else None

    initial = {
        "messages": [HumanMessage(content=req.message)],
        "policy_thread_id": policy_thread_id,
        "roadmap_thread_id": roadmap_thread_id,
        "profile": profile,
        # profile_delivered_* 는 첫 호출 후 하위 노드에서 True 로 flip.
        # LangGraph state 는 매 노드에서 부분 갱신되므로 초기값을 명시적으로 넣어둔다.
        "profile_delivered_policy": False,
        "profile_delivered_roadmap": False,
        "last_roadmap_plan": None,
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
