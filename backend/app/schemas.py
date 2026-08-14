from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class RoadmapCreateRequest(ApiModel):
    birth_date: date = Field(alias="birthDate")
    previous_annual_income: int = Field(alias="previousAnnualIncome", ge=0)
    current_annual_income: int = Field(alias="currentAnnualIncome", ge=0)
    region: str = Field(min_length=1)
    region_province_code: str = Field(alias="regionProvinceCode", min_length=2)
    region_district_code: str = Field(alias="regionDistrictCode", min_length=5)
    household_size: int = Field(alias="householdSize", ge=1)
    marital_status: Literal["single", "married"] = Field(alias="maritalStatus")
    employed: bool
    employment_type: str | None = Field(default=None, alias="employmentType")
    is_sme_employee: bool | None = Field(default=None, alias="isSmeEmployee")
    monthly_take_home: int | None = Field(default=None, alias="monthlyTakeHome", gt=0)
    monthly_budget: int = Field(alias="monthlyBudget", gt=0)
    target_date: date = Field(alias="targetDate")
    target_amount: int | None = Field(default=None, alias="targetAmount", gt=0)
    has_emergency_fund: bool = Field(alias="hasEmergencyFund")
    risk_level: Literal["stable", "balanced", "growth"] = Field(alias="riskLevel")
    investment_cap: int = Field(alias="investmentCap", ge=0, le=100)
    question: str = Field(default="", max_length=1000)

    @field_validator("target_date")
    @classmethod
    def target_must_be_future(cls, value: date) -> date:
        if value <= date.today():
            raise ValueError("목표 시점은 오늘 이후여야 합니다.")
        return value


class AllocationItem(ApiModel):
    label: str
    amount: int
    color: str


class EvidenceItem(ApiModel):
    title: str
    organization: str
    url: str


class ScenarioResponse(ApiModel):
    id: str
    badge: str
    title: str
    product_type: str = Field(alias="productType")
    monthly_amount: int = Field(alias="monthlyAmount")
    expected_amount: int = Field(alias="expectedAmount")
    principal: int
    goal_rate: float | None = Field(alias="goalRate")
    shortfall: int | None
    allocations: list[AllocationItem]
    highlights: list[str]
    warnings: list[str]
    evidence: list[EvidenceItem]


class RoadmapResponse(ApiModel):
    recommended: ScenarioResponse
    alternative: ScenarioResponse
    summary: str
    explanation: str | None = None
    recommended_reason: str | None = Field(default=None, alias="recommendedReason")
    alternative_reason: str | None = Field(default=None, alias="alternativeReason")
    chat_reply: str | None = Field(default=None, alias="chatReply")
    notice: str
    generated_at: datetime = Field(alias="generatedAt")


class ApiError(ApiModel):
    code: str
    message: str
    detail: object | None = None
