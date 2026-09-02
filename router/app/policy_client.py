"""BenefitUp-Agent(/api/v2/policy) HTTP 클라이언트.

라우터의 `ask_policy_agent` 툴이 부르는 유일한 파일. BenefitUp-Agent 는
코드로 import 하지 않고 **HTTP 로만** 붙는다 — 두 프로세스는 서로 완전 독립.
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from datetime import date
from typing import Any

import httpx


BENEFIT_API = os.getenv("BENEFIT_API", "http://localhost:8010")
BENEFIT_TIMEOUT = float(os.getenv("BENEFIT_TIMEOUT", "60"))
# BenefitUp-Agent 가 동일 요청에도 매번 다른 실패 양상을 보이는 게 관찰됐다
# (담당 레포가 달라 원인 자체는 우리가 고칠 수 없음) — 타임아웃/연결 끊김/5xx
# 같은 일시적 실패는 우리 쪽에서 짧게 한 번 더 시도해 완화한다. 요청 자체가
# 잘못된 4xx(예: 422)는 재시도해도 같은 결과라 대상에서 제외한다.
BENEFIT_MAX_ATTEMPTS = int(os.getenv("BENEFIT_MAX_ATTEMPTS", "2"))
BENEFIT_RETRY_BACKOFF_SECONDS = float(os.getenv("BENEFIT_RETRY_BACKOFF_SECONDS", "0.6"))


# ============================================================
# Slot-filling: "나한테 맞는 거" 같은 개인화 질문에만 트리거.
# 일반 조회성 질문("~ 조건이 뭐야?")은 프로필 없이도 BenefitUp 이 답할 수
# 있으므로 매번 폼을 띄우지 않는다 — roadmap 과 달리 policy 는 매 질문마다
# 프로필이 필수가 아니기 때문에 무조건 슬롯필링하면 지금 잘 되는 일반
# 질문 흐름을 깨뜨린다.
#
# 참고: 이전에는 "조건 변경/수정/바꿔줘" 류의 자연어 요청을 정규식으로 잡아
# `profile_ask` 폼을 자동으로 띄우는 로직이 있었지만, 통합 상담이 진입 시점에
# 프로필을 한번에 받는 방식(§/chat 상단의 "조건 재입력" 버튼)으로 바뀌면서
# 제거했다. 프로필 재입력은 이제 라우터/에이전트가 아니라 프론트 UI 가 담당.
# ============================================================
_PERSONALIZATION_RE = re.compile(
    r"(나한테|나에게|내게|저한테|저에게|제\s*(?:상황|조건|경우|정보))\s*.{0,12}"
    r"(맞|적합|추천|나은|좋)"
)


def _needs_personalization(query: str) -> bool:
    """"나한테 뭐가 더 맞아?" 류의 개인화 질문인지 판별."""
    return bool(_PERSONALIZATION_RE.search(query or ""))


_REQUIRED_SLOTS: list[dict[str, str]] = [
    {
        "key": "birthDate",
        "label": "생년월일",
        "question": "생년월일이 어떻게 되세요? (예: 1998-05-20)",
        "inputType": "date",
    },
    {
        "key": "annualIncomeKrw",
        "label": "연소득",
        "question": "연소득이 어느 정도 되세요? (원 단위, 없으면 0)",
        "inputType": "number",
    },
    {
        "key": "employmentType",
        "label": "직업 상태",
        "question": "현재 직업 상태를 알려주세요 (근로자 / 사업자 / 연금소득자 / 채무조정자 / 무직 / 학생 중 하나)",
        "inputType": "text",
    },
    {
        "key": "maritalStatus",
        "label": "혼인 상태",
        "question": "혼인 상태가 어떻게 되세요? (미혼 / 기혼)",
        "inputType": "text",
    },
    {
        "key": "housingStatus",
        "label": "주거 형태",
        "question": "현재 주거 형태를 알려주세요 (자가 / 전세 / 월세 / 부모님과 거주)",
        "inputType": "text",
    },
]


def _is_profile_incomplete(profile: dict[str, Any] | None) -> bool:
    """개인화 매칭에 필요한 5개 필드 중 하나라도 비어 있는지 검사.

    폼 자체는 (roadmap 과 달리) 일부러 **동적으로 부족한 필드만** 보여주지
    않고 매번 5개 전체를 다시 물어본다 — `_REQUIRED_SLOTS` 참고. 정책 매칭은
    항목 하나하나가 자격 요건에 영향을 줄 수 있어, 이미 채워진 값이라도
    사용자가 한 화면에서 다시 확인/수정할 수 있게 하는 편이 안전하다.
    """
    p = profile or {}
    for slot in _REQUIRED_SLOTS:
        key = slot["key"]
        if key == "birthDate":
            if not (p.get("birthDate") or p.get("age")):
                return True
        elif key == "annualIncomeKrw":
            # 0 은 "무직이라 소득 없음" 같은 유효한 답변이다. None/빈 문자열만
            # 미기입으로 본다 — 안 그러면 무소득 사용자가 폼을 채워도 매번 다시
            # "누락"으로 판정돼 profile_ask 가 무한 반복되는 버그가 생긴다.
            if p.get(key) in (None, ""):
                return True
        elif p.get(key) in (None, "", 0):
            return True
    return False


# ============================================================
# UserProfile → BenefitUp UserProfileIn 어댑터
# ============================================================
# BenefitUp 의 `UserProfileIn` 은 age / regionCode / employmentType /
# maritalStatus / housingStatus 다섯 개가 **필수** (기본값 없음). 통합 상담을
# 온보딩 없이 시작해 로드맵 슬롯필링(birthDate·monthlyBudget·targetDate·
# householdSize)만 채운 사용자는 이 다섯 개가 비어 있어서, profile 을
# 그대로 forward 하면 BenefitUp 이 422 로 튕긴다.
#
# 라우터가 두 에이전트 앞단에서 붙는 층이므로 어댑팅도 여기서 흡수한다 —
# BenefitUp 스키마를 완화하거나 슬롯필링을 무겁게 만드는 대신 라우터에서
# 파생 가능한 필드는 채우고, 파생 불가능한 필드는 안전한 기본값을 주입한다.


# BenefitUp 이 실제로 받는 enum 값 (api/schemas.py 참고). profile_ask 폼은
# 셀렉트가 아니라 자유 텍스트 입력이라, 사용자가 한글로 적은 값을 이 맵으로
# 정규화한 뒤 넘긴다. 매핑에 없는 값은 각자 안전한 기본값으로 폴백.
_MARITAL_MAP = {
    "기혼": "married", "결혼": "married", "married": "married",
    "미혼": "single", "싱글": "single", "비혼": "single", "single": "single",
}
_HOUSING_MAP = {
    "자가": "own", "own": "own",
    "전세": "jeonse", "jeonse": "jeonse",
    "월세": "monthly", "monthly": "monthly",
    "임대": "rental", "rental": "rental",
    "부모님과 거주": "with_parents", "부모님": "with_parents", "with_parents": "with_parents",
}
_EMPLOYMENT_ALLOWED = {"근로자", "사업자", "연금소득자", "채무조정자", "무직", "학생"}


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
    - `maritalStatus` 는 BenefitUp/Roadmap 공통 필드명이라 그대로 정규화만 한다.
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

    # "single"/"married" 외에 profile_ask 폼에서 사용자가 직접 적은 "미혼"/"기혼"
    # 한글 값도 들어올 수 있어 항상 정규화한다.
    raw_marital = str(p.get("maritalStatus") or "").strip()
    normalized_marital = _MARITAL_MAP.get(raw_marital, raw_marital) or "single"
    if normalized_marital not in ("single", "married", "any"):
        normalized_marital = "single"
    p["maritalStatus"] = normalized_marital

    # 통합 상담 슬롯필링으로 파생 불가능한 두 필드는 광범위 기본값을 준다.
    # BenefitUp 의 매칭 품질을 낮추긴 하지만, 422 로 turn 전체가 죽는 것보단 낫다.
    # 사용자가 온보딩(또는 profile_ask 폼)을 거치면 실제 값이 들어와 이
    # fallback 은 밀려난다.
    # 주의: pydantic `model_dump()` 는 부재 필드를 `None` 으로 채워두므로
    # `setdefault` 대신 `not p.get(...)` 로 falsy(None 포함) 를 잡아야 한다.
    if p.get("employmentType") not in _EMPLOYMENT_ALLOWED:
        p["employmentType"] = p.get("employmentType") or "근로자"
        if p["employmentType"] not in _EMPLOYMENT_ALLOWED:
            p["employmentType"] = "근로자"

    if p.get("housingStatus") not in ("own", "rental", "jeonse", "monthly", "with_parents"):
        raw_housing = str(p.get("housingStatus") or "").strip()
        p["housingStatus"] = _HOUSING_MAP.get(raw_housing) or "rental"

    return p


async def call_policy_agent(
    *,
    thread_id: str,
    message: str,
    profile: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], bool]:
    """BenefitUp-Agent 의 /api/v2/policy 를 호출하고 (blocks, profile_delivered) 를 돌려준다.

    "나한테 맞는 거 뭐야?" 같은 개인화 질문인데 프로필 핵심 필드가 비어 있으면
    BenefitUp 을 부르지 않고 `profile_ask` 블록으로 먼저 되돌린다. roadmap_client
    의 슬롯필링과 달리 **부족한 필드만 동적으로 고르지 않고 `_REQUIRED_SLOTS`
    5개 전체를 매번 폼에 담는다** — 정책 매칭은 필드 하나하나가 자격 요건에
    영향을 줄 수 있어, 이미 채워진 값도 한 화면에서 같이 확인/수정하게 하는
    편이 안전하다는 판단. 일반 조회성 질문은 프로필 없이도 BenefitUp 이 답할
    수 있으므로 이 체크를 건너뛴다.

    통합 상담(/chat)은 진입 시점에 프론트가 이미 프로필을 한번에 받도록
    바뀌었으므로 이 슬롯필링은 실제로 거의 안 걸리는 폴백 경로 — 하지만
    프로필 없이 이 클라이언트를 직접 부르는 경우(정책 단독 페이지 등)를
    위해 그대로 둔다. "조건 재입력"은 이제 라우터가 아니라 프론트 UI 담당.

    Returns:
        blocks: 프론트에 relay 할 ChatBlock dict 리스트.
        profile_delivered: 이번 호출에서 BenefitUp 에 실제 프로필을 실어보냈는지.
                            호출부가 `profile_delivered_policy` 플래그를 정확히
                            갱신하기 위해 필요 (프로필이 없어 익명 요청으로 보낸
                            경우까지 "전달됨"으로 잘못 표시하면, 이후 턴에서
                            영원히 profile 을 못 보내게 된다).
    """
    if _needs_personalization(message) and _is_profile_incomplete(profile):
        return (
            [
                {
                    "type": "text",
                    "content": "본인에게 더 맞는 정책을 찾으려면 아래 정보를 확인할게요.",
                },
                {
                    "type": "profile_ask",
                    "context": "policy",
                    "fields": list(_REQUIRED_SLOTS),
                },
            ],
            False,
        )

    payload: dict[str, Any] = {"threadId": thread_id, "message": message}
    adapted: dict[str, Any] | None = None
    if profile is not None:
        adapted = _adapt_for_benefit(profile)
        # 어댑터가 None 을 돌려주면 (필수 필드 파생 불가) profile 을 아예 뺀다.
        # BenefitUp 의 profile 은 optional 이므로 익명 요청으로 정상 응답 가능.
        if adapted is not None:
            payload["profile"] = adapted

    url = f"{BENEFIT_API}/api/v2/policy"
    print(
        f"[R-HTTP →] POST {url} (thread={thread_id[:8]}.. profile={'y' if adapted else 'n'} msg_len={len(message)})"
    )
    t0 = time.monotonic()
    r = await _post_policy_with_retry(url, payload)
    elapsed = time.monotonic() - t0
    data = r.json()

    blocks = data.get("blocks") or []
    print(f"[R-HTTP ←] {r.status_code} in {elapsed:.2f}s | blocks={len(blocks)}")
    return blocks, adapted is not None


async def _post_policy_with_retry(url: str, payload: dict[str, Any]) -> httpx.Response:
    """연결 오류/5xx 만 짧게 재시도한다. 이 두 케이스에선 첫 요청이 이미 완결된
    상태(서버 미도달 or 명시적 실패 반환)라 재시도가 BenefitUp 에 새 부담을
    주지 않는다 — 원 커밋의 취지("BenefitUp 쪽 코드는 못 고치니 라우터 쪽
    취약점만 완화")가 정확히 성립하는 범위.

    타임아웃과 4xx 는 재시도 대상에서 뺀다:
    - 4xx: 같은 페이로드로 다시 보내도 결과 안 바뀜.
    - 타임아웃: BenefitUp 이 여전히 처리 중이라는 뜻이라 재시도하면 같은
      (threadId, message) 가 concurrent 로 두 번 처리된다 — sync `def chat()`
      은 client 끊긴 뒤에도 완주하므로 Gemini 콜이 두 배로 나가고 MemorySaver
      에 concurrent write 가 생긴다. 원 커밋의 취지("BenefitUp 에 새 부담 주지
      말고 라우터 쪽 취약점만 완화")에 정면으로 위배되어 제외.
    """
    last_exc: Exception | None = None
    for attempt in range(1, BENEFIT_MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=BENEFIT_TIMEOUT) as c:
                r = await c.post(url, json=payload)
        except httpx.TransportError as exc:
            # 주의: httpx.TimeoutException 은 여기서 안 잡는다 (위 docstring 참고) —
            # try 블록을 그대로 빠져나가 호출부로 raise 된다. TimeoutException 은
            # HTTPError 자식이지 TransportError 자식이 아니라 이 분리가 성립한다.
            last_exc = exc
            if attempt < BENEFIT_MAX_ATTEMPTS:
                print(f"[R-HTTP ⟳] {type(exc).__name__} 재시도 {attempt}/{BENEFIT_MAX_ATTEMPTS}")
                await asyncio.sleep(BENEFIT_RETRY_BACKOFF_SECONDS)
                continue
            raise
        if r.status_code >= 500 and attempt < BENEFIT_MAX_ATTEMPTS:
            print(
                f"[R-HTTP ⟳] {r.status_code} 재시도 {attempt}/{BENEFIT_MAX_ATTEMPTS} | "
                f"body={r.text[:200]!r}"
            )
            await asyncio.sleep(BENEFIT_RETRY_BACKOFF_SECONDS)
            continue
        if r.status_code >= 400:
            print(f"[R-HTTP ←] {r.status_code} | body={r.text[:200]!r}")
        r.raise_for_status()
        return r
    assert last_exc is not None  # 루프는 항상 return 또는 raise로 끝남
    raise last_exc
