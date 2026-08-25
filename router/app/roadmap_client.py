"""Roadmap-Agent HTTP 클라이언트.

Roadmap-Agent 의 `POST /api/v1/roadmaps` 는 **이미 대화형**이다:
  request  → threadId(UUID) + question + 전체 프로필 필드
  response → chatReply + roadmap plan + requestPatch(조건 patch) +
             conversationStatus / conversationIntent

내부에서 `RoadmapConversationGraph` + `SqliteConversationStore` 로 thread
단위 대화 상태를 유지한다. 따라서 별도의 `/api/chat` 엔드포인트를 새로
만들 필요 없이 이 엔드포인트를 그대로 부르되:

- 매 요청마다 프로필 필드 전량을 실어보내고
- `question` 에 사용자 turn 원문을 담고
- `threadId` 를 UUID 로 유지하고
- 응답의 `requestPatch` 는 라우터 state 의 프로필 캐시에 병합한다 (호출부 책임).

프로필 필드 중 몇 개(`birthDate`, `monthlyBudget`, `targetDate`,
`householdSize`)는 BenefitUp 온보딩만 통과한 사용자에게는 없을 수 있다.
그 경우 API 를 부르지 않고 `profile_ask` 블록으로 프론트에 되돌려 —
사용자가 채팅 안에서 그 슬롯만 채우고 다시 turn 을 보내면 그때 실제 호출.
Roadmap-Agent 자체 코드는 여전히 안 건드림.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any

import httpx


ROADMAP_API = os.getenv("ROADMAP_API", "http://localhost:8020")
ROADMAP_TIMEOUT = float(os.getenv("ROADMAP_TIMEOUT", "60"))


# ============================================================
# Slot-filling: Roadmap-Agent 필수 필드 중 우리가 유추 불가능한 것들.
# regionProvinceCode / regionDistrictCode 는 BenefitUp 의 regionCode 에서
# 파생 가능하므로 여기 넣지 않는다 (_build_payload 에서 처리).
# ============================================================
_REQUIRED_SLOTS: list[dict[str, str]] = [
    {
        "key": "birthDate",
        "label": "생년월일",
        "question": "생년월일이 어떻게 되세요? (예: 1998-05-20)",
        "inputType": "date",
    },
    {
        "key": "monthlyBudget",
        "label": "월 저축여력",
        "question": "월에 얼마 정도 저축할 수 있으세요? (원 단위)",
        "inputType": "number",
    },
    {
        "key": "targetDate",
        "label": "목표 시점",
        "question": "목표 시점은 언제인가요? (예: 2028-12-31)",
        "inputType": "date",
    },
    {
        "key": "householdSize",
        "label": "가구원 수",
        "question": "가구원 수를 알려주세요 (본인 포함)",
        "inputType": "number",
    },
]


def _missing_slots(profile: dict[str, Any] | None) -> list[dict[str, str]]:
    """Roadmap-Agent 호출 전 필수 슬롯 검사 — 유추 불가능한 필드만."""
    if not profile:
        return list(_REQUIRED_SLOTS)
    missing: list[dict[str, str]] = []
    for slot in _REQUIRED_SLOTS:
        val = profile.get(slot["key"])
        if val in (None, "", 0):
            missing.append(slot)
    return missing


# ============================================================
# 호출부
# ============================================================
async def call_roadmap_agent(
    *,
    thread_id: str,
    message: str,
    profile: dict[str, Any] | None,
    last_plan: dict[str, Any] | None = None,  # noqa: ARG001 — 계약 유지용
    is_first_call: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Roadmap-Agent 를 부르고 (ChatBlock 리스트, requestPatch) 를 돌려준다.

    is_first_call:
        이 라우터 thread 안에서 Roadmap-Agent 를 처음 부르는 turn 인지.
        True 면 사용자 원문 앞에 "첫 진입" 힌트를 붙여 넘긴다. 통합 상담에서
        기능① → 기능② 로 화제가 넘어가는 첫 turn 에, 원문이 조건 재진술처럼
        보여 `conversationIntent=unclear` 로 되묻히는 경우를 줄이기 위함.
        (라우터는 자기 관점에선 이어지는 대화지만, Roadmap-Agent 는 자기
        thread 에 이력이 없어 그 문맥이 없다.)

    Returns:
        blocks: 프론트에 relay 할 ChatBlock dict 리스트.
        request_patch: 로드맵이 이번 turn 에 조정한 조건 patch (있으면).
                       라우터 호출부가 state.profile 에 병합해서 다음 turn
                       에 반영해야 함. 없으면 None.
    """
    missing = _missing_slots(profile)
    if missing:
        return (
            [
                {
                    "type": "text",
                    "content": "로드맵을 만들기 전에 몇 가지만 확인할게요.",
                },
                {
                    "type": "profile_ask",
                    "context": "roadmap",
                    "fields": missing,
                },
            ],
            None,
        )

    assert profile is not None  # _missing_slots 통과 = 프로필 존재
    question = message
    if is_first_call:
        # 저장된 조건으로 초기 로드맵을 우선 만들어 달라는 명시적 힌트. 원문은
        # 그대로 실어 사용자 후속 의도(“3년 뒤 얼마”)도 함께 답변하도록 유지.
        question = (
            "[통합 상담: 로드맵 기능 첫 요청입니다. 함께 전달된 프로필의 조건을 "
            "그대로 사용해 초기 로드맵을 먼저 만들고, 그 결과를 바탕으로 아래 "
            "사용자 원문에 답해주세요. 되묻기 없이 진행해도 됩니다.]\n\n"
            f"사용자 원문: {message}"
        )
    payload = _build_payload(profile, question=question, thread_id=thread_id)

    url = f"{ROADMAP_API}/api/v1/roadmaps"
    print(
        f"[R-HTTP →] POST {url} (thread={thread_id[:8]}.. first={'y' if is_first_call else 'n'} msg_len={len(message)})"
    )
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=ROADMAP_TIMEOUT) as c:
        r = await c.post(url, json=payload)
        elapsed = time.monotonic() - t0
        if r.status_code >= 400:
            print(f"[R-HTTP ←] {r.status_code} in {elapsed:.2f}s | body={r.text[:200]!r}")
        r.raise_for_status()
        data = r.json()

    blocks: list[dict[str, Any]] = []
    chat_reply = data.get("chatReply")
    if chat_reply:
        blocks.append({"type": "text", "content": chat_reply})
    # 전체 응답을 roadmap_plan 블록으로 통째 상재 → 프론트가 기존 렌더러 재사용.
    blocks.append({"type": "roadmap_plan", "plan": data})

    request_patch = data.get("requestPatch")
    print(f"[R-HTTP ←] {r.status_code} in {elapsed:.2f}s | blocks={len(blocks)} patch={'y' if request_patch else 'n'}")
    return blocks, request_patch


# ============================================================
# UserProfile → RoadmapCreateRequest 매핑
# ============================================================
def _build_payload(
    profile: dict[str, Any],
    *,
    question: str,
    thread_id: str,
) -> dict[str, Any]:
    district = profile.get("regionDistrictCode") or profile.get("regionCode") or ""
    province = profile.get("regionProvinceCode") or (
        district[:2] if len(district) >= 2 else ""
    )

    return {
        "birthDate": profile["birthDate"],
        "previousAnnualIncome": profile.get("previousAnnualIncome")
        or profile.get("annualIncomeKrw")
        or 0,
        "currentAnnualIncome": profile.get("currentAnnualIncome")
        or profile.get("annualIncomeKrw")
        or 0,
        "region": profile.get("region") or "서울",
        "regionProvinceCode": province or "11",
        "regionDistrictCode": district or "11110",
        "householdSize": profile["householdSize"],
        "maritalStatus": _coerce_marital_status(profile),
        "employed": _coerce_employed(profile),
        "employmentType": profile.get("employmentType"),
        "isSmeEmployee": profile.get("isSmeEmployee"),
        "monthlyTakeHome": profile.get("monthlyTakeHome"),
        "monthlyBudget": profile["monthlyBudget"],
        "targetDate": profile["targetDate"],
        "targetAmount": profile.get("targetAmount"),
        "hasEmergencyFund": bool(profile.get("hasEmergencyFund")),
        "riskLevel": profile.get("riskLevel"),
        "investmentCap": profile.get("investmentCap"),
        "question": question,
        "threadId": _ensure_uuid(thread_id),
    }


def _coerce_marital_status(profile: dict[str, Any]) -> str:
    """BenefitUp 은 'any' 도 허용 → Roadmap 은 single/married 만 → 'any' 는 single 로."""
    ms = profile.get("maritalStatus") or "single"
    return "married" if ms == "married" else "single"


def _coerce_employed(profile: dict[str, Any]) -> bool:
    if profile.get("employed") is not None:
        return bool(profile["employed"])
    et = profile.get("employmentType") or ""
    return et not in ("", "무직", "학생")


def _ensure_uuid(thread_id: str) -> str:
    """Roadmap-Agent 는 threadId 를 UUID 로 요구.

    라우터는 자체 thread_id 에 `::roadmap` 접미어를 붙이므로 그대로는 UUID
    가 아니다. 그 문자열을 결정적으로 UUID5 로 감싸서 넘긴다 — 같은 라우터
    thread 는 항상 같은 로드맵 UUID 로 맵핑되어 하위 세션 이력이 이어짐.
    """
    try:
        return str(uuid.UUID(thread_id))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, thread_id or "seedup-router"))
