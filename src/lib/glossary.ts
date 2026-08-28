/**
 * 로드맵/정책 결과에 자주 나오는 금융 용어의 짧은 설명. RAG 근거 문서가 아니라
 * 처음 보는 사용자를 위한 최소 설명이라 프론트에 정적으로 둔다 — 서비스 취지
 * (금융 문해력 향상)와 맞닿아 있음.
 */
export const GLOSSARY: Record<string, string> = {
  정부기여금: "정부가 정한 조건을 만족하는 가입자의 납입액에 맞춰 추가로 얹어주는 지원금이에요.",
  비과세: "이자·배당 소득에 원래 붙는 세금(15.4%)을 면제해주는 혜택이에요.",
  ISA: "예금·펀드 등 여러 상품을 한 계좌에 담아 세제 혜택을 받을 수 있는 통합관리계좌예요.",
  목표달성률: "설정한 목표 금액 대비, 예상 만기 금액이 몇 %인지 보여줘요.",
  정책상품: "정부·지자체가 청년 등 특정 계층을 지원하려고 만든 금융상품이에요.",
  법정동코드: "행정안전부가 정한 전국 행정구역 고유 번호예요.",
  원리금: "원금과 이자를 합친 금액이에요.",
  중위소득: "국민 전체를 소득순으로 줄 세웠을 때 정확히 가운데에 있는 사람의 소득이에요. 정책 지원 대상 판단 기준으로 자주 쓰여요.",
  총급여: "각종 공제 전, 회사에서 받은 급여 총액이에요.",
  신용점수: "금융거래 이력을 바탕으로 개인의 신용도를 수치화한 점수예요.",
  분산투자: "여러 자산에 나눠 투자해서 위험을 줄이는 전략이에요.",
  청년도약계좌: "청년의 중장기 자산 형성을 돕는 정부 지원 정책 적금상품이에요.",
};

const TERM_RE = new RegExp(
  `(${Object.keys(GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .join("|")})`,
  "g",
);

/** 텍스트에서 용어집에 있는 단어를 찾아 [일반 문자열 | 용어] 조각으로 나눈다. */
export function splitByGlossaryTerms(text: string): { text: string; term?: string }[] {
  if (Object.keys(GLOSSARY).length === 0) return [{ text }];
  const parts = text.split(TERM_RE);
  return parts.filter(Boolean).map((part) => (GLOSSARY[part] ? { text: part, term: part } : { text: part }));
}
