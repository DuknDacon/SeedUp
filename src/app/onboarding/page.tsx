import { ProfileForm } from "@/features/policy/ProfileForm";

export default function OnboardingPage() {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-bold mb-1">프로필 입력</h1>
      <p className="text-sm text-slate-600 mb-6">
        저장한 정보는 지금은 브라우저(localStorage)에만 보관됩니다. 나중에
        로그인 붙으면 서버로 이관.
      </p>
      <ProfileForm />
    </div>
  );
}
