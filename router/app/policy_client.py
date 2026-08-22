"""BenefitUp-Agent(/api/chat) HTTP 클라이언트.

라우터의 `ask_policy_agent` 툴이 부르는 유일한 파일. BenefitUp-Agent 는
코드로 import 하지 않고 **HTTP 로만** 붙는다 — 두 프로세스는 서로 완전 독립.
"""
from __future__ import annotations

import os
from datetime import date
from typing import Any

import httpx


BENEFIT_API = os.getenv("BENEFIT_API", "http://localhost:8010")
BENEFIT_TIMEOUT = float(os.getenv("BENEFIT_TIMEOUT", "60"))


# ============================================================
# UserProfile → BenefitUp UserProfileIn 어댑터
# ============================================================
# BenefitUp 의 `UserProfileIn` 은 age / regionCode / employmentType /
# marriageStatus / housingStatus 다섯 개가 **필수** (기본값 없음). 통합 상담을
# 온보딩 없이 시작해 로드맵 슬롯필링(birthDate·monthlyBudget·targetDate·
# householdSize)만 채운 사용자는 이 다섯 개가 비어 있어서, profile 을
# 그대로 forward 하면 BenefitUp 이 422 로 튕긴다.
#
# 라우터가 두 에이전트 앞단에서 붙는 층이므로 어댑팅도 여기서 흡수한다 —
# BenefitUp 스키마를 완화하거나 슬롯필링을 무겁게 만드는 대신 라우터에서
# 파생 가능한 필드는 채우고, 파생 불가능한 필드는 안전한 기본값을 주입한다.


def _derive_age(birth_date: str | None) -> int | None:
    """'YYYY-MM-DD' → 만나이. 파싱 실패 시 None."""
    if not birth_date or len(birth_date) < 4:
        return None
    try:
        by, bm, bd = int(birth_date[:4]), int(birth_date[5:7]), int(birth_date[8:10])
    except (ValueError, IndexError):
        return None
    today = date.today()
    age = today.year - by - ((today.month, today.day) < (bm, bd))
    return max(age, 0)


def _adapt_for_benefit(profile: dict[str, Any]) -> dict[str, Any] | None:
    """BenefitUp `UserProfileIn` 이 요구하는 필수 필드를 채워서 돌려준다.

    - `age` 는 `birthDate` 에서 계산 (온보딩 사용자는 이미 age 를 갖고 있으니 그대로).
    - `regionCode` 는 로드맵용 `regionDistrictCode`(5자리 법정동) 를 재사용.
    - `marriageStatus` 는 로드맵의 `maritalStatus` 를 재사용 (같은 값 도메인).
    - 파생 불가능한 `employmentType` / `housingStatus` 는 안전한 기본값.

    `age` 가 없고 `birthDate` 로도 파생할 수 없으면 (아직 온보딩·슬롯필링을
    거치지 않은 첫 turn) 부분 프로필을 억지로 만들어 보내는 대신 `None` 을
    돌려준다. 호출부는 이 경우 payload 에서 `profile` 을 아예 빼서 BenefitUp
    이 "익명 요청" 으로 처리하게 한다. 이게 422 로 turn 전체가 죽는 것보다
    항상 낫다.
    """
    p = dict(profile)  # 원본 mutate 방지

    if p.get("age") is None:
        derived = _derive_age(p.get("birthDate"))
        if derived is None:
            # 나이 파생 불가 → BenefitUp 이 요구하는 5 필수 중 age 를 채울 수 없음.
            # 이 경우 profile 을 통째로 drop (호출부에서 처리).
            return None
        p["age"] = derived

    if not p.get("regionCode"):
        # 로드맵은 regionDistrictCode(5자리) 를 채워둠 → BenefitUp regionCode 로 재사용.
        p["regionCode"] = p.get("regionDistrictCode") or "11110"

    if not p.get("marriageStatus"):
        # 로드맵의 maritalStatus(single|married) 는 BenefitUp marriageStatus 도메인의 부분집합.
        p["marriageStatus"] = p.get("maritalStatus") or "single"

    # 통합 상담 슬롯필링으로 파생 불가능한 두 필드는 광범위 기본값을 준다.
    # BenefitUp 의 매칭 품질을 낮추긴 하지만, 422 로 turn 전체가 죽는 것보단 낫다.
    # 사용자가 온보딩을 거치면 실제 값이 들어와 이 fallback 은 밀려남.
    # 주의: pydantic `model_dump()` 는 부재 필드를 `None` 으로 채워두므로
    # `setdefault` 대신 `not p.get(...)` 로 falsy(None 포함) 를 잡아야 한다.
    if not p.get("employmentType"):
        p["employmentType"] = "근로자"
    if not p.get("housingStatus"):
        p["housingStatus"] = "rental"

    return p


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
        adapted = _adapt_for_benefit(profile)
        # 어댑터가 None 을 돌려주면 (필수 필드 파생 불가) profile 을 아예 뺀다.
        # BenefitUp 의 profile 은 optional 이므로 익명 요청으로 정상 응답 가능.
        if adapted is not None:
            payload["profile"] = adapted

    async with httpx.AsyncClient(timeout=BENEFIT_TIMEOUT) as c:
        r = await c.post(f"{BENEFIT_API}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()

    return data.get("blocks") or []
