/**
 * Mock 정책 데이터.
 *
 * BenefitUp-Agent 의 실제 SQLite DB (`data/sqlite_db/benefit_data.db`) 에서 뽑은
 * 실 데이터로 채웠다. 나중에 진짜 API 가 붙으면 이 파일은 삭제하고
 * `policyApi.ts` 의 fetch 만 실제 엔드포인트로 교체하면 됨.
 *
 * matchScore / matchReason 은 실제 서비스에서는 에이전트의 LLM 재랭킹이 채운다.
 * 여기서는 데모용으로 프론트가 임의값 부여.
 */
import type { Policy } from "@/types/api";

export const MOCK_POLICIES: Policy[] = [
  // ────────────────────────────────────────────────
  // 온통청년 정책 (source='youth_policy')
  // 실제 DB: youth_policies
  // ────────────────────────────────────────────────
  {
    id: "yp-001",
    source: "youth_policy",
    itemType: "policy",
    title: "산림산업 창업지원_청년 산림창업가 시너지캠프",
    summary:
      "산림분야 청년 예비·초기 창업자 30명을 대상으로 하는 1박 2일 시너지캠프. 참가비 전액 무료, 2027년도 청년 산림창업 마중물 지원사업 서류 가점 부여.",
    description:
      "산림분야 청년들의 창업 역량강화 및 신규시장 진입을 지원하기 위해 개최. 신생 창업기업 전문가 특강, 6대 핵심분야(사업모델·고객·마케팅·지원사업·공공시장·투자유치) 그룹별 멘토링 포함.",
    categoryMajor: "일자리",
    operatingInstitution: "한국임업진흥원",
    supervisingInstitution: "산림청",
    applicationUrl: "https://forms.gle/mQZEGDmkF9JUAyYS8",
    ageRange: { min: 19, max: 39 },
    annualIncomeMaxKrw: null,
    regionNames: ["전국"],
    employmentTypes: ["학생", "무직", "근로자"],
    applicationEndDate: "2026-08-25",
    isAlwaysOpen: false,
    matchScore: 78,
    matchReason: "19~39세·창업 관심 조건에 부합",
  },
  {
    id: "yp-002",
    source: "youth_policy",
    itemType: "policy",
    title: "2026년 청년 IT 자격증 취득지원 프로그램",
    summary:
      "청년들의 역량 제고 및 취업경쟁력 향상을 위해 청년IT자격증 취득지원 프로그램을 운영. 수강료 무료.",
    description:
      "AI시대 새로운 기회 창업 아카데미(10회차), AI콘텐츠 크리에이터 양성교육(10회차) 등 포함.",
    categoryMajor: "일자리",
    operatingInstitution: "전남광주통합특별시",
    supervisingInstitution: null,
    applicationUrl: null,
    ageRange: { min: 19, max: 39 },
    annualIncomeMaxKrw: null,
    regionNames: ["광주광역시", "전남"],
    employmentTypes: ["학생", "무직", "근로자"],
    applicationEndDate: "2026-10-16",
    isAlwaysOpen: false,
    matchScore: 85,
    matchReason: "19~39세·취업 관심 조건에 부합, 무료 수강",
  },
  {
    id: "yp-003",
    source: "youth_policy",
    itemType: "policy",
    title: "사회연대경제 청년 일경험사업 시범사업(3차)",
    summary:
      "미취업 청년에게 사회연대경제 분야 일경험 기회 제공. 월 234만원 지급(유급주휴 포함, 세전).",
    description:
      "근로기간 2026. 8. 24. ~ 2027. 1. 23., 주 5일(주 40시간). 직무교육 20시간 + 일경험 프로그램 + 진로탐색 1:1 멘토링.",
    categoryMajor: "일자리",
    operatingInstitution: "전남광주통합특별시",
    supervisingInstitution: null,
    applicationUrl: "https://m.site.naver.com/29ZAK",
    ageRange: { min: 19, max: 39 },
    annualIncomeMaxKrw: null,
    regionNames: ["광주광역시"],
    employmentTypes: ["무직"],
    applicationEndDate: "2026-08-24",
    isAlwaysOpen: false,
    matchScore: 91,
    matchReason: "미취업 청년 대상, 월 234만원 지급이 시드머니 형성에 적합",
  },
  {
    id: "yp-004",
    source: "youth_policy",
    itemType: "policy",
    title: "2026년 고립 청년 일상회복 지원 사업",
    summary:
      "고립·은둔 청년을 위한 총 6회 프로그램 운영. 정리수납·AI 툴·기질검사·반찬 만들기·숙면베개·반려식물 만들기 등.",
    description: null,
    categoryMajor: "복지",
    operatingInstitution: "전남광주통합특별시",
    supervisingInstitution: null,
    applicationUrl: null,
    ageRange: { min: 19, max: 39 },
    annualIncomeMaxKrw: null,
    regionNames: ["광주광역시"],
    employmentTypes: ["무직", "학생", "근로자"],
    applicationEndDate: "2026-09-14",
    isAlwaysOpen: false,
    matchScore: 55,
    matchReason: "19~39세 청년 대상 복지 프로그램",
  },

  // ────────────────────────────────────────────────
  // 서민금융진흥원 대출 (source='seomin_loan')
  // 실제 DB: sme_loan_products
  // ────────────────────────────────────────────────
  {
    id: "loan-001",
    source: "seomin_loan",
    itemType: "loan",
    title: "사잇돌Ⅱ대출_대환형",
    summary: "기존 고금리 대출을 저금리로 대환하는 상품 (사잇돌Ⅱ).",
    description: null,
    categoryMajor: "금융",
    operatingInstitution: "SGI서울보증",
    supervisingInstitution: "서민금융진흥원",
    applicationUrl: "https://www.fsb.or.kr",
    ageRange: { min: null, max: null },
    annualIncomeMaxKrw: null,
    regionNames: ["전국"],
    employmentTypes: ["근로자", "사업자", "연금소득자"],
    applicationEndDate: null,
    isAlwaysOpen: true,
    loanLimitKrw: 20_000_000,
    interestRateMin: null,
    interestRateMax: 19.99,
    repaymentMethod: null,
    matchScore: 72,
    matchReason: "근로자 조건 부합, 대환 목적 자금",
  },
  {
    id: "loan-002",
    source: "seomin_loan",
    itemType: "loan",
    title: "사잇돌Ⅱ대출_채무조정졸업자",
    summary:
      "채무조정을 성실히 이행 완료한 채무조정졸업자를 위한 사잇돌Ⅱ 상품.",
    description: null,
    categoryMajor: "금융",
    operatingInstitution: "SGI서울보증",
    supervisingInstitution: "서민금융진흥원",
    applicationUrl: "https://www.fsb.or.kr",
    ageRange: { min: null, max: null },
    annualIncomeMaxKrw: null,
    regionNames: ["전국"],
    employmentTypes: ["채무조정자"],
    applicationEndDate: null,
    isAlwaysOpen: true,
    loanLimitKrw: 10_000_000,
    interestRateMin: null,
    interestRateMax: 19.99,
    repaymentMethod: null,
    matchScore: 40,
    matchReason: "채무조정졸업자 대상 상품 — 해당 시 유용",
  },
  {
    id: "loan-003",
    source: "seomin_loan",
    itemType: "loan",
    title: "생업자금융자",
    summary:
      "금융취약계층의 창업·운영을 위한 저금리 융자 (강원도 삼척시).",
    description: null,
    categoryMajor: "금융",
    operatingInstitution: "강원도 삼척시",
    supervisingInstitution: null,
    applicationUrl: "http://www.samcheok.go.kr",
    ageRange: { min: null, max: null },
    annualIncomeMaxKrw: null,
    regionNames: ["강원 삼척시"],
    employmentTypes: ["사업자"],
    applicationEndDate: null,
    isAlwaysOpen: true,
    loanLimitKrw: 50_000_000,
    interestRateMin: 3.0,
    interestRateMax: 3.0,
    repaymentMethod: null,
    matchScore: 30,
    matchReason: "강원 삼척시 거주자·창업 관심 시 우선순위 상승",
  },
  {
    id: "loan-004",
    source: "seomin_loan",
    itemType: "loan",
    title: "저소득주민 융자사업(주택매입 및 전세임대자금 지원)",
    summary:
      "저소득가구·무주택세대주 대상 주거자금 무이자 융자 (강원도 영월군).",
    description: null,
    categoryMajor: "주거",
    operatingInstitution: "강원도 영월군",
    supervisingInstitution: null,
    applicationUrl: "https://www.yw.go.kr",
    ageRange: { min: null, max: null },
    annualIncomeMaxKrw: null,
    regionNames: ["강원 영월군"],
    employmentTypes: ["무직", "근로자"],
    applicationEndDate: null,
    isAlwaysOpen: true,
    loanLimitKrw: 30_000_000,
    interestRateMin: 0,
    interestRateMax: 0,
    repaymentMethod: null,
    matchScore: 25,
    matchReason: "무주택·저소득 조건 시 무이자 혜택",
  },

  // ────────────────────────────────────────────────
  // 복지서비스 (source='welfare_service')
  // 실제 DB: welfare_services
  // ────────────────────────────────────────────────
  {
    id: "wf-001",
    source: "welfare_service",
    itemType: "welfare",
    title: "농어가목돈마련저축 저축장려금 지급",
    summary:
      "농어가목돈마련저축 만기 시 저축장려금을 지급, 농어민의 재산 형성을 지원.",
    description: null,
    categoryMajor: "복지",
    operatingInstitution: null,
    supervisingInstitution: "금융위원회",
    applicationUrl: null,
    ageRange: { min: null, max: null },
    annualIncomeMaxKrw: null,
    regionNames: ["전국"],
    employmentTypes: [],
    applicationEndDate: null,
    isAlwaysOpen: true,
    matchScore: 20,
    matchReason: "농어가 종사자에 한해 시드머니 형성 지원",
  },
];
