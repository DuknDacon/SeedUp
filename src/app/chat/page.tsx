import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold mb-1">AI 상담</h1>
      <p className="text-sm text-slate-600 mb-4">
        정책 금융 매칭과 자산관리 로드맵을 한 대화에서 이어서 물어보세요. 첫
        메시지에는 저장된 프로필이 함께 전달됩니다.
      </p>
      <ChatWindow />
    </div>
  );
}
