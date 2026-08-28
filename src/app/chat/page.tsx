import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 break-keep">
        🌱 AI 상담
      </h1>
      <p className="text-sm text-slate-500 mb-6 break-keep">
        정책 금융 매칭과 자산관리 로드맵을 한 대화에서 이어서 물어보세요. 첫
        메시지에는 저장된 프로필이 함께 전달됩니다.
      </p>
      <ChatWindow />
    </div>
  );
}
