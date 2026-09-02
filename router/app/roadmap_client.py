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
# Gemini RAG 임베딩 호출이 가끔 지연되면서(쿼터 재시도 등) 로드맵 계산 한 번이
# 60초를 넘기는 경우가 실측됐다 — 기본값을 60s보다 넉넉하게 잡아 그런 순간적인
# 지연에도 라우터가 먼저 타임아웃으로 포기하지 않게 한다.
ROADMAP_TIMEOUT = float(os.getenv("ROADMAP_TIMEOUT", "120"))


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


# Roadmap-Agent 가 로드맵 생성 전 사전 체크로 물어보는 필드(missingFields) →
# profile_ask 슬롯 매핑. 상품마다 필요한 조건이 달라 후보가 늘어날수록 이
# 사전 체크가 걸 수 있는 필드도 늘어난다 — 새 필드가 생기면 여기 한 곳만
# 추가하면 된다. question 문구는 Roadmap-Agent의
# `src/roadmap_agent/conversation.py` 상수와 같은 뜻으로 맞춰 둔다(레포가
# 분리돼 있어 완전한 중복 제거는 못 하지만, 실제 질문 판단은 항상
# Roadmap-Agent 쪽 값이 기준).
_ROADMAP_PRELAUNCH_FIELDS: dict[str, dict[str, str]] = {
    "financial_income_taxed": {
        "key": "financialIncomeTaxed",
        "label": "금융소득종합과세",
        "question": "최근 3년 안에 금융소득종합과세 대상이 된 적이 있나요?",
        "hint": "이자·배당 등으로 받은 금융소득이 1년에 2천만원을 넘으면 다른 소득과 "
        "합쳐서 세금을 매기는 제도예요. 대부분은 해당 안 되니, 잘 모르겠으면 "
        "'아니오'를 선택해도 괜찮아요.",
        "inputType": "boolean",
    },
    "is_sme_employee": {
        "key": "isSmeEmployee",
        "label": "중소기업 재직 여부",
        "question": "현재 중소기업에 재직 중인가요?",
        "hint": "다니는 회사가 중소기업(대기업·공공기관이 아닌 곳)인지 물어보는 거예요.",
        "inputType": "boolean",
    },
    "household_monthly_income": {
        "key": "householdMonthlyIncome",
        "label": "가구 전체 월소득",
        "question": "가구 전체의 월소득은 얼마인가요? (만원 단위)",
        "hint": "본인뿐 아니라 함께 사는 가족 모두의 한 달 소득을 합친 금액이에요. "
        "예: 350만원이면 350만 입력.",
        "inputType": "number",
        "inputUnit": "만원",
    },
    "previous_annual_income": {
        "key": "previousAnnualIncome",
        "label": "직전년도 연 소득",
        "question": "직전년도(전년도) 실제 연 소득은 세전 기준으로 얼마였나요? (만원 단위)",
        "hint": "작년 한 해 동안 세금 떼기 전 총 급여(연봉)를 말해요. "
        "예: 4천만원이면 4000 입력.",
        "inputType": "number",
        "inputUnit": "만원",
    },
}


def _map_missing_fields(
    missing_fields: list[str], missing_field_details: list[dict[str, Any]] | None = None
) -> list[dict[str, str]]:
    """missingFields(맨 필드명)를 profile_ask 슬롯으로 바꾼다.

    Roadmap-Agent가 missingFieldDetails(질문·힌트·inputType이 이미 채워진
    구조화된 메타데이터)를 함께 보내주면 그걸 우선 쓴다 — LLM이 상품마다
    다르게 발견하는 동적 게이트("policy_id:gate_id" 합성 키)는 이 라우터에
    미리 등록해둘 수 없어, 이 경로가 사실상 유일한 렌더 방법이다. 레거시
    4개 필드는 여기 등록된 `key`(camelCase 프로필 필드명)로 매핑하지만, 동적
    게이트는 실제 UserProfile 필드가 아니므로 원본 합성 키를 `key` 그대로
    유지한다 — 프론트가 답변을 dynamicGateAnswers[key]로 라우팅할 때 쓴다.
    """
    details_by_field = {
        str(detail.get("field")): detail for detail in (missing_field_details or [])
    }
    fields = []
    for name in missing_fields:
        detail = details_by_field.get(name)
        if detail is not None:
            fields.append(
                {
                    "key": name,
                    "label": detail.get("hint") or detail.get("question", "")[:24],
                    "question": detail.get("question", ""),
                    "hint": detail.get("hint"),
                    "inputType": detail.get("inputType", "boolean"),
                    "isDynamicGate": ":" in name,
                }
            )
            continue
        slot = _ROADMAP_PRELAUNCH_FIELDS.get(name)
        if slot is None:
            continue
        fields.append(dict(slot))
    return fields


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
    answering_missing_fields: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Roadmap-Agent 를 부르고 (ChatBlock 리스트, requestPatch) 를 돌려준다.

    is_first_call:
        이 라우터 thread 안에서 Roadmap-Agent 를 처음 부르는 turn 인지.
        True 면 사용자 원문 앞에 "첫 진입" 힌트를 붙여 넘긴다. 통합 상담에서
        기능① → 기능② 로 화제가 넘어가는 첫 turn 에, 원문이 조건 재진술처럼
        보여 `conversationIntent=unclear` 로 되묻히는 경우를 줄이기 위함.
        (라우터는 자기 관점에선 이어지는 대화지만, Roadmap-Agent 는 자기
        thread 에 이력이 없어 그 문맥이 없다.)
    answering_missing_fields:
        이번 turn이 profile_ask(미확인 자격조건 필드/동적 게이트) 답변 제출인지.
        Roadmap-Agent가 사용자 원문 의도 분류와 무관하게 남은 게이트부터
        재확인해야 하는지 판단하는 신호로 쓴다 — 이게 없으면 "왜 추천?"/금융
        Q&A 처럼 게이트와 무관한 질문까지 매번 같은 미확인 필드 질문만 도는
        버그와, 반대로 게이트 답변 제출을 일반 질문으로 오인해 남은 게이트를
        건너뛰는 버그 둘 다 생길 수 있다.

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
    payload = _build_payload(
        profile,
        question=question,
        thread_id=thread_id,
        answering_missing_fields=answering_missing_fields,
        is_initial_request=is_first_call,
    )

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
    if data.get("conversationStatus") == "needs_input" and not data.get("recommended"):
        # 로드맵 생성 전 DB 매칭 후보에 사용자 입력만으로는 판정 못 하는 필드가
        # 걸려 로드맵 없이 질문만 온 경우 — 이미 있는 profile_ask 메커니즘을
        # 그대로 재사용한다(_missing_slots 와 동일한 블록 형태). roadmap_plan
        # 블록은 여기서 만들지 않는다 — recommended 가 없는 채로 만들면 프론트
        # 렌더러(`ChatWindow.tsx`의 `roadmapBlock.plan.recommended.title`)가
        # 그대로 크래시난다.
        blocks.append(
            {
                "type": "profile_ask",
                "context": "roadmap",
                "fields": _map_missing_fields(
                    data.get("missingFields") or [], data.get("missingFieldDetails")
                ),
            }
        )
    else:
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
    answering_missing_fields: bool = False,
    is_initial_request: bool = False,
) -> dict[str, Any]:
    district = profile.get("regionDistrictCode") or profile.get("regionCode") or ""
    province = profile.get("regionProvinceCode") or (
        district[:2] if len(district) >= 2 else ""
    )

    return {
        "birthDate": profile["birthDate"],
        # currentAnnualIncome 과 달리 여기서 annualIncomeKrw 로 조용히 대체하지
        # 않는다 — 실제로는 다른 값일 수 있는데 같다고 가정해버리면, 직전년도
        # 소득이 자격 기준인 상품의 판정이 틀릴 수 있다. 값이 없으면(온보딩
        # 폼에는 이 필드가 없음) None 그대로 보내 백엔드가 실제로 필요한
        # 후보가 있을 때만 profile_ask 로 되묻게 한다.
        "previousAnnualIncome": profile.get("previousAnnualIncome"),
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
        "financialIncomeTaxed": profile.get("financialIncomeTaxed"),
        "householdMonthlyIncome": profile.get("householdMonthlyIncome"),
        "monthlyTakeHome": profile.get("monthlyTakeHome"),
        "monthlyBudget": profile["monthlyBudget"],
        "targetDate": profile["targetDate"],
        "targetAmount": profile.get("targetAmount"),
        "hasEmergencyFund": bool(profile.get("hasEmergencyFund")),
        "riskLevel": profile.get("riskLevel"),
        "investmentCap": profile.get("investmentCap"),
        "question": question,
        "threadId": _ensure_uuid(thread_id),
        # "policy_id:gate_id" 합성 키 → 예/아니오. ProfileAskForm이 동적 게이트
        # 답변을 UserProfile.dynamicGateAnswers 에 모아두면 그대로 실어보낸다.
        "dynamicGateAnswers": profile.get("dynamicGateAnswers") or {},
        "answeringMissingFields": answering_missing_fields,
        # 라우터 thread에서 이 turn이 진짜 "로드맵 첫 생성 요청"인지(delivered_roadmap
        # 이 아직 False) — 이 값을 true로 보내는 turn은 사용자 원문이 어떻게
        # 분류되든 무조건 미확인 필드부터 물어야 한다. 그렇지 않으면 프론트가
        # 실제로 보내는 초기 생성 메시지("입력한 조건으로 자산관리 로드맵을
        # 만들어줘." 류, 정책 키워드가 전혀 없어 UNCLEAR로 분류됨)가 게이트를
        # 건너뛰어 미확인 자격조건 그대로 로드맵을 계산해버리는 회귀가 생긴다.
        "isInitialRoadmapRequest": is_initial_request,
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
