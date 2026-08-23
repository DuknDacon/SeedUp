import Link from "next/link";

export default function HomePage() {
  return (
    <div className="py-10">
      <h1 className="text-3xl font-bold mb-3">
        사회초년생을 위한 시드머니 빌드업 AI 비서
      </h1>
      <p className="text-slate-600 mb-8 leading-relaxed">
        나이·소득·지역·관심 목표만 알려주면 <b>정책 금융</b>과{" "}
        <b>자산관리 로드맵</b>을 함께 만들어 드립니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FeatureCard
          emoji="🎯"
          title="① 정책 금융 매칭"
          desc="온통청년·서민금융·전세대출·복지서비스 4대 소스에서 나에게 맞는 정책을 AI가 골라줍니다."
          cta="시작하기"
          href="/onboarding"
        />
        <FeatureCard
          emoji="🗺️"
          title="② AI 자산관리 로드맵"
          desc="매달 얼마씩, 어떤 상품에 넣을지 — 시드머니까지의 여정을 도와드립니다."
          cta="로드맵 만들기"
          href="/roadmap"
        />
        {/* 라우터 백엔드(SeedUp/router)가 두 하위 에이전트를 툴로 감싸서 한 대화에서 오갈 수 있게 함. */}
        <FeatureCard
          emoji="💬"
          title="③ 통합 AI 상담"
          desc="정책 매칭과 자산관리 로드맵을 한 대화에서 오가며 물어보세요. AI가 자동으로 담당 에이전트를 골라 답합니다."
          cta="대화 시작하기"
          href="/chat"
        />
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        <b>🚧 개발 중 안내:</b> 현재는 mock 응답으로 동작합니다. BenefitUp-Agent
        의 실제 API가 붙으면 자동으로 실시간 매칭으로 전환됩니다.
      </div>
    </div>
  );
}

function FeatureCard({
  emoji,
  title,
  desc,
  cta,
  href,
  disabled,
}: {
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm transition ${
        disabled ? "opacity-60" : "hover:shadow-md hover:border-brand-500"
      }`}
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-slate-600 mb-4">{desc}</p>
      <span
        className={`inline-block text-sm font-medium ${
          disabled ? "text-slate-400" : "text-brand-700"
        }`}
      >
        {cta} →
      </span>
    </div>
  );
  return disabled ? content : <Link href={href}>{content}</Link>;
}
