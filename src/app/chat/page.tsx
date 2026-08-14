import { ChatWindow } from "@/features/policy/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-bold mb-1">AI 상담</h1>
      <p className="text-sm text-slate-600 mb-4">
        BenefitUp-Agent 와 자유롭게 대화하세요. 첫 메시지에는 저장된 프로필이
        함께 전달됩니다.
      </p>
      <ChatWindow />
    </div>
  );
}
