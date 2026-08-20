"""라우터 wire 스키마.

프론트(SeedUp/src/types/api.ts §ChatBlock)와 BenefitUp-Agent/api/schemas.py 의
`ChatBlock` 계약을 **그대로** 뒤따른다. 하위 에이전트가 준 블록을 라우터에서
재해석·재요약하지 않고 통과만 시키기 때문에, 자체 discriminated union 을
빡세게 정의하는 대신 dict 로 흘려보낸다 — 새 블록 타입이 추가돼도
스키마 수정 없이 통과.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# 프로필: BenefitUp-Agent 의 UserProfileIn 과 필드명 동일 (camelCase).
# 라우터는 프로필을 해석하지 않고 하위 에이전트에 그대로 relay 만 한다.
class UserProfileIn(BaseModel):
    model_config = {"extra": "allow"}  # 스키마 진화 대비 — 모르는 필드는 그대로 통과

    age: int | None = None
    annualIncomeKrw: int | None = None
    regionCode: str | None = None
    employmentType: str | None = None
    marriageStatus: str | None = None
    housingStatus: str | None = None
    educationLevel: str | None = None
    jobCategory: str | None = None
    interests: list[str] = Field(default_factory=list)
    freeTextQuery: str | None = None


class ChatRequestIn(BaseModel):
    threadId: str
    message: str
    profile: UserProfileIn | None = None


class ChatResponseOut(BaseModel):
    threadId: str
    # dict 그대로 (하위 에이전트가 만든 블록을 통과시키기 위해).
    blocks: list[dict[str, Any]]
