/**
 * SeedUp ↔ BenefitUp-Agent 계약 타입.
 *
 * 이 파일은 프론트-백엔드 사이의 "약속"이다.
 * BenefitUp-Agent 의 `docs/policy_match_schema.md` §5(유저 프로필) / §7.2(반환 필드) 를
 * 그대로 반영한다. 필드 이름/의미가 바뀌면 두 저장소에서 동시에 수정할 것.
 *
 * 네이밍 규칙:
 *   - 네트워크 상에서는 스네이크케이스가 자연스럽지만, 프론트 코드 안에서는 camelCase 를 쓴다.
 *   - services 레이어에서 변환한다(정책_items의 필드명 그대로가 아님).
 *   - 금액은 원 단위(number). 만원 단위 원본은 서비스 레이어에서 x10000.
 */

// ============================================================
// 유저 프로필 (§5)
// ============================================================

export type EmploymentType =
  | "근로자"
  | "사업자"
  | "연금소득자"
  | "채무조정자"
  | "무직"
  | "학생";

export type MarriageStatus = "single" | "married" | "any";

export type HousingStatus =
  | "own"
  | "rental"
  | "jeonse"
  | "monthly"
  | "with_parents";

/** 사회초년생이 목표로 하는 시드머니 용도 (자유 확장 가능) */
export type InterestCategory =
  | "주거"
  | "창업"
  | "취업"
  | "교육"
  | "결혼"
  | "비상금"
  | "노후준비";

export type UserProfile = {
  age: number;
  /** 연 소득(원). 모름/미기재는 null. */
  annualIncomeKrw: number | null;
  /** KCB 신용점수(1000점 만점). 없으면 null. */
  creditScore: number | null;
  /** 법정동/시도 코드. 예: "11110" (서울 종로구) */
  regionCode: string;
  employmentType: EmploymentType;
  marriageStatus: MarriageStatus;
  housingStatus: HousingStatus;
  educationLevel?: string | null;
  jobCategory?: string | null;
  /** 관심 목표(카드 정렬·가중치에 반영) */
  interests: InterestCategory[];
  /** 벡터 검색용 자유 질의 */
  freeTextQuery?: string | null;
};

// ============================================================
// 정책 아이템 (§7.2 반환 필드)
// ============================================================

export type PolicySource =
  | "youth_policy"
  | "seomin_loan"
  | "jeonse_loan"
  | "welfare_service";

export type PolicyItemType = "policy" | "loan" | "welfare";

export type Policy = {
  // 식별
  id: string;
  source: PolicySource;
  itemType: PolicyItemType;

  // 표시
  title: string;
  summary: string | null;
  description?: string | null;
  categoryMajor: string | null;
  operatingInstitution: string | null;
  supervisingInstitution?: string | null;
  applicationUrl: string | null;

  // 매칭 근거 태깅용
  ageRange: { min: number | null; max: number | null };
  annualIncomeMaxKrw: number | null;
  regionNames: string[];
  employmentTypes: string[];
  applicationEndDate: string | null; // ISO date (YYYY-MM-DD)
  isAlwaysOpen?: boolean;

  // 대출인 경우
  loanLimitKrw?: number | null;
  interestRateMin?: number | null;
  interestRateMax?: number | null;
  repaymentMethod?: string | null;

  // 에이전트가 붙여주는 값 (LLM 재랭킹 결과)
  matchScore: number; // 0~100
  matchReason: string; // "27세·서울·근로자 조건 부합"
};

// ============================================================
// API 요청/응답
// ============================================================

export type PolicyMatchRequest = {
  profile: UserProfile;
  /** 상위 N개만 (기본 20) */
  limit?: number;
};

export type PolicyMatchResponse = {
  /** 매칭 실행 시각 (ISO datetime) */
  matchedAt: string;
  policies: Policy[];
};

export type PolicyDetailResponse = {
  policy: Policy;
  /** 대출 상품이면 금리 옵션 배열이 함께 옴 (§3.2) */
  rateOptions?: LoanRateOption[];
};

export type LoanRateOption = {
  repaymentMethod: string | null;
  rateType: "변동" | "고정" | "혼합" | null;
  rateMin: number | null;
  rateMax: number | null;
  rateAvg: number | null;
  disclosedMonth: string | null; // "YYYY-MM"
};

// ============================================================
// 챗 (LangGraph thread 기반)
// ============================================================

export type ChatRequest = {
  /** 새 대화면 클라이언트가 uuid 발급, 이후 계속 재사용 */
  threadId: string;
  message: string;
  /** 첫 turn에만 프로필을 주입(에이전트가 시스템 컨텍스트로 활용) */
  profile?: UserProfile;
};

export type ChatSource = {
  title: string;
  url?: string;
};

export type ChatResponse = {
  threadId: string;
  reply: string;
  sources: ChatSource[];
};

// ============================================================
// 공통 에러 포맷
// ============================================================

export type ApiError = {
  code: string; // "PROFILE_INVALID" | "AGENT_TIMEOUT" | ...
  message: string;
  detail?: unknown;
};

// ============================================================
// 기능 2: 자산관리 로드맵
// ============================================================

export type RiskLevel = "stable" | "balanced" | "growth";

export interface RoadmapRequest {
  birthDate: string;
  previousAnnualIncome: number;
  currentAnnualIncome: number;
  region: string;
  regionProvinceCode: string;
  regionDistrictCode: string;
  householdSize: number;
  maritalStatus: "single" | "married";
  employed: boolean;
  employmentType: string | null;
  isSmeEmployee: boolean | null;
  monthlyTakeHome: number | null;
  monthlyBudget: number;
  targetDate: string;
  targetAmount: number | null;
  hasEmergencyFund: boolean;
  riskLevel: RiskLevel | null;
  investmentCap: number | null;
}

export interface AllocationItem {
  label: string;
  amount: number;
  color: string;
}

export interface Scenario {
  id: string;
  badge: string;
  title: string;
  productType: string;
  monthlyAmount: number;
  expectedAmount: number;
  principal: number;
  goalRate?: number;
  shortfall?: number;
  allocations: AllocationItem[];
  highlights: string[];
  warnings: string[];
  evidence: { title: string; organization: string; url: string }[];
}

export interface RoadmapResponse {
  recommended: Scenario;
  alternative: Scenario;
  summary: string;
  explanation: string | null;
  recommendedReason: string | null;
  alternativeReason: string | null;
  chatReply: string | null;
  notice: string;
  generatedAt: string;
}
