"""BenefitUp-Agent(/api/chat) HTTP 클라이언트.

라우터의 `ask_policy_agent` 툴이 부르는 유일한 파일. BenefitUp-Agent 는
코드로 import 하지 않고 **HTTP 로만** 붙는다 — 두 프로세스는 서로 완전 독립.
"""
from __future__ import annotations

import os
from typing import Any

import httpx


BENEFIT_API = os.getenv("BENEFIT_API", "http://localhost:8010")
BENEFIT_TIMEOUT = float(os.getenv("BENEFIT_TIMEOUT", "60"))


async def call_policy_agent(
    *,
    thread_id: str,
    message: str,
    profile: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """BenefitUp-Agent 의 /api/chat 을 그대로 호출하고 `blocks` 만 돌려준다.

    반환은 ChatBlock dict 리스트 그대로. 라우터는 이 블록들을 재해석하지 않고
    최종 응답의 `blocks` 배열에 append 한다.
    """
    payload: dict[str, Any] = {"threadId": thread_id, "message": message}
    if profile is not None:
        payload["profile"] = profile

    async with httpx.AsyncClient(timeout=BENEFIT_TIMEOUT) as c:
        r = await c.post(f"{BENEFIT_API}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()

    return data.get("blocks") or []
