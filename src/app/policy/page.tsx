import { PolicyList } from "@/features/policy/PolicyList";

export default function PolicyListPage() {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-bold mb-1">내게 맞는 정책</h1>
      <p className="text-sm text-slate-600 mb-6">
        BenefitUp-Agent 가 프로필을 바탕으로 매칭했어요. 카드를 눌러 상세를
        확인하세요.
      </p>
      <PolicyList />
    </div>
  );
}
