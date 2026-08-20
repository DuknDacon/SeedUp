"""SeedUp Router — FastAPI 진입점.

실행: uvicorn app.main:app --reload --port 8030

프론트에는 `/api/chat` 을 그대로 노출. 스키마는 BenefitUp-Agent 의
`/api/chat` 과 호환 (프론트가 지금 그 쪽으로 붙어 있으므로 base URL 만
바꿔주면 바로 라우터로 스위치됨).
"""
from __future__ import annotations

import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage

from .router_graph import get_app as get_router_app
from .schemas import ChatRequestIn, ChatResponseOut


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

    return ChatResponseOut(threadId=req.threadId, blocks=blocks)


# ── 개발용: thread_id 자동 발급 편의 엔드포인트 ─────────────────
@app.get("/api/new-thread")
def new_thread() -> dict[str, str]:
    return {"threadId": uuid.uuid4().hex}
