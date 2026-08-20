"""Roadmap-Agent HTTP 클라이언트.

라우터의 `ask_roadmap_agent` 툴이 부르는 유일한 파일. Roadmap-Agent 코드는
import 하지 않고 HTTP 로만 붙는다.

⚠️ 현재 Roadmap-Agent 는 대화형 `/api/chat` 엔드포인트가 없고,
   `POST /api/v1/roadmaps` 만 노출한다 (자유 대화가 아니라 프로필 →
   로드맵 계산 한 방).

   합의된 계약이 나오기 전 까지는:
     - profile 이 있으면 로드맵 계산을 호출해서 `roadmap_plan` 블록으로
       한 번 응답 (이후 turn 부터는 계산 결과를 요약·재사용)
     - profile 이 없으면 "프로필이 필요해요" 안내 텍스트 블록

   담당자와 대화형 엔드포인트를 합의하면 아래 TODO(roadmap-api) 위치를 그
   계약으로 교체하면 된다. **Roadmap-Agent 자체 코드는 여전히 안 건드림.**
"""
from __future__ import annotations

import os
from typing import Any

import httpx


ROADMAP_API = os.getenv("ROADMAP_API", "http://localhost:8020")
ROADMAP_TIMEOUT = float(os.getenv("ROADMAP_TIMEOUT", "60"))


async def call_roadmap_agent(
    *,
    thread_id: str,
    message: str,
    profile: dict[str, Any] | None,
    last_plan: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Roadmap-Agent 를 호출하고 ChatBlock dict 리스트로 정규화해 돌려준다.

    Args:
        thread_id:  라우터가 관리하는 roadmap 하위 thread. Roadmap-Agent 가
            대화형 API 를 열면 이 값을 그대로 넘긴다.
        message:    사용자 turn 원문.
        profile:    첫 turn 에만 실려오는 프로필. 계산 API 호출용.
        last_plan:  이전 turn 에서 이미 계산해둔 로드맵 (있으면 재사용).
    """
    # ── TODO(roadmap-api): 담당자와 합의된 대화형 엔드포인트가 나오면 이 자리부터 ──
    # async with httpx.AsyncClient(timeout=ROADMAP_TIMEOUT) as c:
    #     r = await c.post(f"{ROADMAP_API}/api/chat", json={
    #         "threadId": thread_id, "message": message, "profile": profile,
    #     })
    #     r.raise_for_status()
    #     return r.json().get("blocks") or []

    # ── 임시 브릿지: 로드맵 계산 API 를 감싸서 ChatBlock 으로 변환 ──
    if last_plan is not None:
        # 이미 계산된 로드맵이 있으면 그걸 다시 카드로 보여주고, 사용자 질문은
        # "이 로드맵을 참고해서 답해줘" 라는 컨텍스트만 실어 텍스트로 대응.
        return [
            {
                "type": "text",
                "content": (
                    "현재 로드맵을 참고해서 답변드립니다. "
                    "예산·목표를 바꾸시려면 알려주세요."
                ),
            },
            {"type": "roadmap_plan", "plan": last_plan},
        ]

    if not profile:
        return [
            {
                "type": "text",
                "content": (
                    "로드맵을 만들려면 먼저 기본 프로필(생년월일·소득·목표 등)이 "
                    "필요해요. 온보딩에서 프로필을 저장한 뒤 다시 시도해 주세요."
                ),
            }
        ]

    # Roadmap-Agent 의 RoadmapCreateRequest 스키마에 최대한 맞춰 매핑.
    # 부족한 필드는 담당자와 어댑팅 룰을 확정하면 이 매핑을 확장한다.
    roadmap_req = _profile_to_roadmap_request(profile)
    async with httpx.AsyncClient(timeout=ROADMAP_TIMEOUT) as c:
        r = await c.post(f"{ROADMAP_API}/api/v1/roadmaps", json=roadmap_req)
        r.raise_for_status()
        plan = r.json()

    return [
        {
            "type": "text",
            "content": plan.get("chatReply") or "요청하신 로드맵을 만들었어요.",
        },
        {"type": "roadmap_plan", "plan": plan},
    ]


def _profile_to_roadmap_request(profile: dict[str, Any]) -> dict[str, Any]:
    """UserProfile → RoadmapCreateRequest 로의 최소 어댑팅.

    부족한 필드는 안전한 기본값. 담당자와 정식 매핑 룰이 나오면 여기 채운다.
    """
    return {
        "birthDate": profile.get("birthDate") or "1998-01-01",
        "previousAnnualIncome": profile.get("annualIncomeKrw") or 0,
        "currentAnnualIncome": profile.get("annualIncomeKrw") or 0,
        "region": profile.get("region") or "서울",
        "regionProvinceCode": profile.get("regionProvinceCode") or "11",
        "regionDistrictCode": profile.get("regionDistrictCode")
        or profile.get("regionCode")
        or "11110",
        "householdSize": profile.get("householdSize") or 1,
        "maritalStatus": profile.get("marriageStatus") or "single",
        "employed": (profile.get("employmentType") or "무직") != "무직",
        "employmentType": profile.get("employmentType"),
        "isSmeEmployee": None,
        "monthlyTakeHome": None,
        "monthlyBudget": profile.get("monthlyBudget") or 500_000,
        "targetDate": profile.get("targetDate") or "2030-12-31",
        "targetAmount": profile.get("targetAmount"),
        "hasEmergencyFund": bool(profile.get("hasEmergencyFund")),
        "riskLevel": profile.get("riskLevel"),
        "investmentCap": profile.get("investmentCap"),
    }
