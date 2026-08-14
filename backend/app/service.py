from __future__ import annotations

from datetime import date, datetime, timezone
from hashlib import sha1

from roadmap_agent.domain import RiskProfile, RoadmapRequest, Scenario
from roadmap_agent.orchestrator import run_roadmap

from .schemas import (
    AllocationItem,
    EvidenceItem,
    RoadmapCreateRequest,
    RoadmapResponse,
    ScenarioResponse,
)
from .runtime import get_runtime


RISK_PROFILE = {
    "stable": RiskProfile.CONSERVATIVE,
    "balanced": RiskProfile.BALANCED,
    "growth": RiskProfile.AGGRESSIVE,
}
ALLOCATION = {
    "savings": ("예·적금", "#2775d7"),
    "cash_equivalent": ("현금성 자산", "#82b3ef"),
    "diversified_investment": ("분산투자", "#20a464"),
    "unallocated_cash": ("미배분 금액", "#f3b73f"),
}
PRODUCT_TYPE = {
    "policy": "정부기여금 활용형",
    "savings": "원금 안정형",
    "investment": "분산투자형",
    "balanced": "균형 배분형",
}


def _age(birth_date: date, as_of: date) -> int:
    return as_of.year - birth_date.year - (
        (as_of.month, as_of.day) < (birth_date.month, birth_date.day)
    )


def _months(target: date, as_of: date) -> int:
    return (target.year - as_of.year) * 12 + target.month - as_of.month


def _scenario(value: Scenario, badge: str) -> ScenarioResponse:
    expected = value.expected_max if value.kind in {"policy", "savings"} else value.expected_base
    allocations = []
    for key, amount in value.monthly_allocation.items():
        if amount <= 0:
            continue
        label, color = ALLOCATION.get(key, (key, "#738078"))
        allocations.append(AllocationItem(label=label, amount=amount, color=color))
    evidence = [
        EvidenceItem(
            title=item.title,
            organization="공식 제공기관",
            url=item.source_url,
        )
        for item in value.evidence
        if item.source_url
    ]
    if not evidence:
        evidence = [EvidenceItem(title="연결된 공식 근거 없음", organization="SeedUp", url="")]
    stable_id = sha1(f"{value.kind}:{value.title}".encode()).hexdigest()[:12]
    return ScenarioResponse(
        id=stable_id,
        badge=badge,
        title=value.title,
        productType=PRODUCT_TYPE.get(value.kind, "맞춤 시나리오"),
        monthlyAmount=sum(value.monthly_allocation.values()),
        expectedAmount=expected,
        principal=value.principal,
        goalRate=value.goal_achievement_rate,
        shortfall=value.shortfall,
        allocations=allocations,
        highlights=value.rationale,
        warnings=value.warnings,
        evidence=evidence,
    )


def create_roadmap(payload: RoadmapCreateRequest) -> RoadmapResponse:
    today = date.today()
    request = RoadmapRequest(
        monthly_budget=payload.monthly_budget,
        horizon_months=_months(payload.target_date, today),
        target_amount=payload.target_amount,
        risk_profile=RISK_PROFILE[payload.risk_level],
        age=_age(payload.birth_date, today),
        annual_income=payload.previous_annual_income,
        previous_annual_income=payload.previous_annual_income,
        current_annual_income=payload.current_annual_income,
        monthly_take_home=payload.monthly_take_home,
        has_emergency_fund=payload.has_emergency_fund,
        max_investment_ratio=payload.investment_cap / 100,
        region_code=f"{payload.region_province_code}:{payload.region_district_code}",
        is_employed=payload.employed,
        employment_type=payload.employment_type,
        is_sme_employee=payload.is_sme_employee,
        household_size=payload.household_size,
        is_married=payload.marital_status == "married",
        question=payload.question,
    )
    runtime = get_runtime()
    result = run_roadmap(
        request,
        policy_repository=runtime.policy_repository,
        savings_repository=runtime.savings_repository,
        retriever=runtime.retriever,
        explainer=runtime.explainer,
    )
    income_change = abs(payload.current_annual_income - payload.previous_annual_income)
    income_change_rate = income_change / max(payload.previous_annual_income, 1)
    income_note = (
        "직전년도와 현재 예상 연소득 차이가 커서 상품별 기준연도 확인이 필요합니다."
        if income_change_rate >= 0.2
        else "직전년도 과세소득과 현재 예상소득을 각각 자격과 납입여력에 반영했습니다."
    )
    alternative = result.alternatives[0] if result.alternatives else result.recommended
    return RoadmapResponse(
        recommended=_scenario(result.recommended, "최우선 추천"),
        alternative=_scenario(alternative, "대안"),
        summary=result.chat_reply or result.recommended_reason or income_note,
        explanation=result.chat_reply,
        recommendedReason=result.recommended_reason,
        alternativeReason=result.alternative_reason,
        chatReply=result.chat_reply,
        notice=income_note,
        generatedAt=datetime.now(timezone.utc),
    )
