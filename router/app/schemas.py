"""라우터 wire 스키마.

프론트(SeedUp/src/types/api.ts §ChatBlock)와 BenefitUp-Agent/api/schemas.py 의
`ChatBlock` 계약을 **그대로** 뒤따른다. 하위 에이전트가 준 블록을 라우터에서
재해석·재요약하지 않고 통과만 시키기 때문에, 자체 discriminated union 을
빡세게 정의하는 대신 dict 로 흘려보낸다 — 새 블록 타입이 추가돼도
스키마 수정 없이 통과.

프로필은 BenefitUp-Agent 의 UserProfileIn 필드에 더해, Roadmap-Agent 가
필요로 하는 필드(birthDate, monthlyBudget, targetDate, householdSize, …)
까지 optional 로 열어둔다. `extra=allow` 이지만 명시적으로도 선언해서
Pydantic 이 타입 힌트를 제공하도록.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class UserProfileIn(BaseModel):
    """통합 상담 프로필.

    라우터는 이 프로필을 해석하지 않고 하위 에이전트에 그대로 relay 한다.
    필드는 두 하위 에이전트의 요구사항 합집합. 하위 에이전트가 자기가 필요
    없는 필드는 무시함.
    """

    model_config = {"extra": "allow"}  # 스키마 진화 대비 — 모르는 필드도 통과

    # ── BenefitUp-Agent UserProfileIn ─────────────────────────────
    age: int | None = None
    annualIncomeKrw: int | None = None
    creditScore: int | None = None
    regionCode: str | None = None
    employmentType: str | None = None
    housingStatus: str | None = None
    educationLevel: str | None = None
    jobCategory: str | None = None
    interests: list[str] = Field(default_factory=list)
    freeTextQuery: str | None = None

    # ── Roadmap-Agent RoadmapCreateRequest 추가 필드 ─────────────────
    # 필수 슬롯 (없으면 slot-fill 로 채워야 함).
    birthDate: str | None = None
    monthlyBudget: int | None = None
    targetDate: str | None = None
    householdSize: int | None = None

    # 파생 가능하거나 optional.
    previousAnnualIncome: int | None = None
    currentAnnualIncome: int | None = None
    region: str | None = None
    regionProvinceCode: str | None = None
    regionDistrictCode: str | None = None
    # single | married — BenefitUp-Agent / Roadmap-Agent 공통 필드명 (예전엔
    # marriageStatus/maritalStatus 로 이름이 갈려 있어 정책 매칭 쪽이 항상
    # "미기입"으로 오판하는 버그가 있었다. 두 하위 에이전트 모두 이 이름으로 통일.
    maritalStatus: str | None = None
    employed: bool | None = None
    isSmeEmployee: bool | None = None
    monthlyTakeHome: int | None = None
    targetAmount: int | None = None
    hasEmergencyFund: bool | None = None
    riskLevel: str | None = None  # stable | balanced | growth
    investmentCap: int | None = None


class ChatRequestIn(BaseModel):
    threadId: str
    message: str
    profile: UserProfileIn | None = None


class ChatResponseOut(BaseModel):
    threadId: str
    # dict 그대로 (하위 에이전트가 만든 블록을 통과시키기 위해).
    blocks: list[dict[str, Any]]
    # 하위 에이전트가 대화 중 프로필을 조정했을 경우 그 delta 만 실어보냄.
    # 프론트는 이 값을 받아 localStorage 프로필을 병합 갱신한다.
    # 없으면 (프로필 미변경) None.
    profilePatch: dict[str, Any] | None = None
