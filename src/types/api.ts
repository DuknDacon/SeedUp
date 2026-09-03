/**
 * SeedUp ↔ BenefitUp-Agent 계약 타입.
 *
 * 이 파일은 프론트-백엔드 사이의 "약속"이다.
 * BenefitUp-Agent 의 `docs/policy_match_schema.md` §5(유저 프로필) / §7.2(반환 필드) 를
 * 그대로 반영한다.
 *
 * ⚠️ 아래 §유저 프로필 / §챗 은 더 이상 손으로 맞춰 쓰지 않는다 — BenefitUp-Agent 의
 * `api/schemas.py`(FastAPI Pydantic 모델)에서 뽑은 OpenAPI 스펙을 `openapi-typescript` 로
 * 생성한 `types/generated/backend.gen.ts` 의 타입을 그대로 재수출(re-export)한다.
 * 백엔드가 필드를 바꾸면:
 *   1) 백엔드 껴서 실행 중이면  npm run gen:api-types  (기본: localhost:8010/openapi.json)
 *      켜져 있지 않으면 BenefitUp-Agent 에서 `python -m api.export_openapi` 로 정적
 *      openapi.json 을 뽑아 BACKEND_OPENAPI_URL=<그 경로> npm run gen:api-types
 *   2) generated/backend.gen.ts 가 갱신되고, 여기서 재수출하는 타입도 자동으로 바뀜
 *   3) 실제 사용하는 컴포넌트가 그 변경과 안 맞으면 `tsc`/`next build` 가 그 자리에서
 *      바로 에러를 내준다 — 예전처럼 런타임에 조용히 깨지는 대신 컴파일 타임에 걸림.
 * (Policy/PolicyDetailResponse/RoadmapPlanPayload 는 아직 실제 엔드포인트가 없어서
 * 예외적으로 손으로 유지한다 — 아래 각 섹션 주석 참고.)
 *
 * 네이밍 규칙:
 *   - 네트워크 상에서는 스네이크케이스가 자연스럽지만, 프론트 코드 안에서는 camelCase 를 쓴다.
 *   - services 레이어에서 변환한다(정책_items의 필드명 그대로가 아님).
 *   - 금액은 원 단위(number). 만원 단위 원본은 서비스 레이어에서 x10000.
 */
import type { components } from "./generated/backend.gen";
import type { components as RoadmapComponents } from "./generated/roadmap.gen";

// ============================================================
// 유저 프로필 (§5) — backend.gen.ts 의 UserProfileIn 재수출
// ============================================================

/**
 * BenefitUp-Agent 의 `UserProfileIn` 을 그대로 재수출하되, 통합 상담(§챗)에서만
 * 필요한 Roadmap-Agent 프로필 필드를 optional 로 확장한다.
 *
 * 이 확장 필드는:
 *   - 정책 화면(§유저 프로필 폼)에서는 안 보임 (BenefitUp-Agent 는 무시)
 *   - 통합 상담에서 로드맵 호출 전에 slot-fill 로 채워지거나,
 *     Roadmap-Agent 의 `requestPatch` 로 갱신됨
 *
 * 원본 UserProfileIn 은 `openapi-typescript` 로 재생성되므로 여기서
 * intersect 만 해두면 백엔드 스키마가 바뀔 때 자동으로 따라간다.
 */
export type RoadmapProfileFields = {
  birthDate?: string | null; // "YYYY-MM-DD"
  monthlyBudget?: number | null; // 원 단위
  targetDate?: string | null; // "YYYY-MM-DD"
  householdSize?: number | null;
  previousAnnualIncome?: number | null;
  currentAnnualIncome?: number | null;
  region?: string | null;
  regionProvinceCode?: string | null;
  regionDistrictCode?: string | null;
  // maritalStatus 는 generated `UserProfileIn.maritalStatus` 를 그대로 쓴다 — 여기서
  // 다시 선언하면 교집합 타입이 좁아져 그쪽의 "any" 값이 깨진다.
  employed?: boolean | null;
  isSmeEmployee?: boolean | null;
  financialIncomeTaxed?: boolean | null;
  householdMonthlyIncome?: number | null; // 원 단위, 2인 이상 가구만 해당
  monthlyTakeHome?: number | null;
  targetAmount?: number | null;
  hasEmergencyFund?: boolean | null;
  riskLevel?: "stable" | "balanced" | "growth" | null;
  investmentCap?: number | null;
  // "policyId:gateId" 합성 키 → 예/아니오. Roadmap-Agent가 상품 원문에서 LLM으로
  // 미리 발견·캐싱해둔, 4개 하드코딩 필드를 넘어서는 자격조건에 대한 답변.
  dynamicGateAnswers?: Record<string, boolean> | null;
  // dynamicGateAnswers와 같은 키를 쓰는 사람이 읽을 질문 문구. 게이트 자체는
  // 실제 UserProfile 필드가 아니라 합성 키라 "현재 저장된 조건" 요약 카드가
  // 나중에 이 답변이 뭘 뜻하는지 보여주려면 별도로 들고 있어야 한다 — 그
  // 라운드의 ProfileAskField.question 을 답변 시점에 같이 저장해둔다.
  dynamicGateLabels?: Record<string, string> | null;
};

export type UserProfile = components["schemas"]["UserProfileIn"] &
  RoadmapProfileFields;

// enum 성격 필드는 UserProfile 에서 인덱싱해서 뽑는다 — api/schemas.py 의 Literal 이
// 바뀌면 여기도 재생성 한 번으로 같이 바뀐다 (손으로 다시 나열할 필요 없음).
export type EmploymentType = UserProfile["employmentType"];
export type MaritalStatus = UserProfile["maritalStatus"];
export type HousingStatus = UserProfile["housingStatus"];
/** 사회초년생이 목표로 하는 시드머니 용도 */
export type InterestCategory = NonNullable<UserProfile["interests"]>[number];

// ============================================================
// 정책 아이템 (§7.2 반환 필드)
// ============================================================
// ⚠️ 위 §유저 프로필/§챗 과 달리, 이 섹션은 backend.gen.ts 에서 자동 생성하지 않고
// 손으로 유지한다 — BenefitUp-Agent 에 아직 이 모양으로 응답하는 실제 엔드포인트가
// 없기 때문(§챗 의 policy_results/loan_detail 블록 주석 참고). 나중에 백엔드가
// 이 스키마로 응답하는 엔드포인트를 만들면 그때 자동 생성 대상으로 옮긴다.

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
//
// ⚠️ 예전엔 프로필 → 원샷 매칭(PolicyMatchRequest/Response) 후 카드 리스트만
// 보여주는 별도 화면(/policy)이 있었지만, 대화형 챗 하나로 통합하면서 제거했다.
// 매칭 결과는 이제 챗 메시지의 `policy_results` 블록(아래 §챗)으로만 나온다.

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
//
// 메시지 하나는 "텍스트 아니면 카드"가 아니라 여러 개의 블록 배열이다.
// 기능①(정책 금융)/기능②(자산관리 로드맵) 모두 같은 블록 스키마로 응답하게 하면,
// 화면(하나의 ChatWindow)과 대화 흐름을 두 기능이 그대로 공유할 수 있다.
// → 기능① 안에서도 SQL 조회 결과가 "카드"는 아니지만 정해진 스키마(policy_results)로
//   대화 중간에 자연스럽게 끼어들고, 기능②로 화제가 넘어가면 roadmap_plan 블록이
//   같은 자리에 나타나면 된다.

export type ChatRequest = components["schemas"]["ChatRequestIn"] & {
  /** 이번 turn이 profile_ask(로드맵 미확인 필드/동적 게이트) 답변 제출인지 표시.
   * true면 라우터가 Roadmap-Agent에 이 신호를 그대로 전달해, 사용자 원문
   * 의도와 무관하게 남은 게이트부터 재확인하게 한다(router/app/schemas.py 참고).
   * ChatRequestIn은 BenefitUp-Agent OpenAPI에서 생성된 타입이라 이 필드가
   * 없어 여기서 별도로 확장한다. */
  isMissingFieldAnswer?: boolean;
};
export type ChatSource = components["schemas"]["ChatSourceOut"];

/** 백엔드(api/app.py)가 실제로 지금 채워서 내려주는 블록 — text / sources / sql_table.
 * 여기서 손으로 다시 나열하지 않고 ChatResponseOut.blocks 원소 타입을 그대로 뽑아 쓴다:
 * 백엔드가 새 블록 종류를 추가하면 재생성 한 번으로 여기도 그대로 늘어난다. */
type GeneratedChatBlock =
  components["schemas"]["ChatResponseOut"]["blocks"][number];

/** 통합 채팅의 roadmap_plan은 단독 로드맵 API 응답을 그대로 전달한다. */
export type RoadmapPlanPayload = RoadmapResponse;

// ── 아래는 프론트/기획 상으로는 이미 정해뒀지만, 백엔드에 아직 그 엔드포인트/매핑이
// 없어서 자동 생성 대상이 아닌 블록들. 언젠가 백엔드가 채워주기 시작하면(예: SQL
// 서브에이전트가 표준 컬럼만 SELECT 하도록 고정해서 policy_results 를 직접 만들어주면),
// 이 수동 정의를 지우고 GeneratedChatBlock 쪽에서 자동으로 딸려오게 하면 된다.
type PolicyResultsBlock = {
  type: "policy_results";
  items: Policy[];
  query?: string;
};
type LoanDetailBlock = {
  type: "loan_detail";
  item: Policy;
  rateOptions?: LoanRateOption[];
};
type RoadmapPlanBlock = { type: "roadmap_plan"; plan: RoadmapPlanPayload };
/** 이어서 물어볼 만한 질문 chip. 클릭하면 그 문장 그대로 다음 turn으로 전송 */
type SuggestedRepliesBlock = { type: "suggested_replies"; suggestions: string[] };

/**
 * 라우터가 하위 에이전트를 호출하기 전에 프로필 필드가 부족하다고 판단한 경우
 * 반환하는 블록. 프론트는 이 블록을 미니 폼으로 렌더해 사용자에게 그 필드만
 * 물어보고, 답을 프로필에 병합한 뒤 다음 turn 을 보낸다.
 *
 * context: "roadmap" — 어느 에이전트 호출을 위해 물어보는 슬롯인지 (안내 문구용)
 * fields[].key         — profile 필드명 (그대로 프로필에 저장)
 * fields[].label       — 폼 라벨
 * fields[].question    — 대화창에 표시할 안내 문구
 * fields[].hint        — (선택) "금융소득종합과세"처럼 용어 자체가 어려운
 *   필드에 붙는 쉬운 말 설명. question 문구는 백엔드 매칭 로직이 그대로
 *   재사용하는 문자열이라 바꾸지 않고, hint만 추가로 보여준다.
 * fields[].inputType   — "date" | "number" | "text" | "boolean"
 *   ("boolean"은 예/아니오 select — Roadmap-Agent가 로드맵 생성 전 사전
 *   체크로 물어보는 financialIncomeTaxed 같은 필드용)
 * fields[].inputUnit   — (선택) "만원" — 금액 필드를 다른 폼 필드들과 같은
 *   방식(만원 입력 → 저장 시 ×10000)으로 받고 싶을 때만 지정한다. 생략하면
 *   입력값을 그대로(원 단위) 저장한다.
 */
export type ProfileAskField = {
  key: string;
  label: string;
  question: string;
  hint?: string;
  inputType: "date" | "number" | "text" | "boolean";
  inputUnit?: "만원";
  /** true면 이 필드는 상품별 동적 자격조건 게이트(합성 키 "policyId:gateId")로,
   * 실제 UserProfile 필드가 아니다 — 답변을 patch[key]가 아니라
   * patch.dynamicGateAnswers[key]로 라우팅해야 한다(ProfileAskForm 참고). */
  isDynamicGate?: boolean;
  /** (선택) boolean 필드의 "예"/"아니요" select 선택지에 "예/아니요"만
   * 보여주는 대신 그 질문의 주어까지 포함한 완전한 문장을 보여주고 싶을 때
   * Roadmap-Agent가 내려준다. 없으면 ProfileAskForm이 기본 문구
   * "네, 맞아요"/"아니요, 아니에요"를 쓴다. */
  yesLabel?: string;
  noLabel?: string;
};

type ProfileAskBlock = {
  type: "profile_ask";
  context: "roadmap" | "policy";
  fields: ProfileAskField[];
};

/** 정책 자격 요약 카드 하나. Roadmap-Agent의 PolicyEligibilityCard와 1:1 대응. */
export type PolicyEligibilityCard = {
  policyId: string;
  name: string;
  tier: string;
  availability: string;
  qualificationStatus: string;
  conditions: string[];
};

type PolicyEligibilityCardsBlock = {
  type: "policy_eligibility_cards";
  cards: PolicyEligibilityCard[];
};

export type ChatBlock =
  | GeneratedChatBlock
  | PolicyResultsBlock
  | LoanDetailBlock
  | RoadmapPlanBlock
  | SuggestedRepliesBlock
  | ProfileAskBlock
  | PolicyEligibilityCardsBlock;

export type ChatResponse = {
  threadId: string;
  blocks: ChatBlock[];
  /**
   * 이번 turn 에 라우터/하위 에이전트가 프로필을 조정했으면 그 delta.
   * 프론트는 이 값을 받아 localStorage 의 프로필을 병합 갱신한다.
   * 없으면 (미변경) null.
   */
  profilePatch?: Partial<UserProfile> | null;
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
//
// Roadmap-Agent 백엔드(`backend/app/schemas.py`)의 OpenAPI 스펙을
// `openapi-typescript`로 생성한 `types/generated/roadmap.gen.ts`를 그대로
// 재수출한다. 백엔드가 필드를 바꾸면:
//   1) Roadmap-Agent 백엔드를 로컬에서 띄운 상태로
//      ROADMAP_OPENAPI_URL=<주소> npm run gen:roadmap-api-types
//      (기본: localhost:8001/openapi.json)
//   2) generated/roadmap.gen.ts 가 갱신되고, 여기서 재수출하는 타입도 자동으로 바뀜
//   3) 실제 사용하는 컴포넌트가 그 변경과 안 맞으면 `tsc`가 그 자리에서 에러를 낸다.

/** `RoadmapCreateRequest`의 `riskLevel` 값 목록. */
export type RiskLevel = NonNullable<
  RoadmapComponents["schemas"]["RoadmapCreateRequest"]["riskLevel"]
>;

/**
 * `question`/`threadId`는 통합 채팅(`chatApi.ts`)이 대화 맥락에서 별도로 채워
 * 요청 바디에 합치므로, 이 타입에서는 그 두 필드를 뺀다(생성 타입의
 * `RoadmapCreateRequest`가 원본).
 */
export type RoadmapRequest = Omit<
  RoadmapComponents["schemas"]["RoadmapCreateRequest"],
  "question" | "threadId"
>;

export type AllocationItem = RoadmapComponents["schemas"]["AllocationItem"];
export type EvidenceItem = RoadmapComponents["schemas"]["EvidenceItem"];
export type Scenario = RoadmapComponents["schemas"]["ScenarioResponse"];
export type RoadmapResponse = RoadmapComponents["schemas"]["RoadmapResponse"];
