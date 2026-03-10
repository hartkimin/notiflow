import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, FileQuestion, Globe } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <header className="px-4 lg:px-12 h-20 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm">
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </header>

      <main className="container max-w-4xl mx-auto py-24 px-4">
        <div className="space-y-20">
          <div className="space-y-6 text-center">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter">도움이 필요하신가요?</h1>
            <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto leading-relaxed">
              NotiFlow 팀은 항상 여러분의 목소리에 귀를 기울이고 있습니다. 
              궁금한 점이나 기술 지원이 필요하시면 언제든 연락주세요.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div className="p-10 rounded-[2.5rem] bg-blue-600 text-white shadow-2xl space-y-6">
               <Mail className="h-10 w-10" />
               <h3 className="text-2xl font-black">Email Support</h3>
               <p className="text-blue-100 font-medium">가장 빠른 답변을 받을 수 있는 방법입니다.</p>
               <div className="text-xl font-black border-t border-white/20 pt-4">support@notiflow.co.kr</div>
            </div>
            <div className="p-10 rounded-[2.5rem] bg-zinc-900 text-white shadow-2xl space-y-6">
               <MessageCircle className="h-10 w-10 text-blue-400" />
               <h3 className="text-2xl font-black">Kakao Channel</h3>
               <p className="text-zinc-400 font-medium">실시간 채팅 상담이 가능합니다.</p>
               <div className="text-xl font-black border-t border-white/10 pt-4">@노티플로우</div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-3xl font-black tracking-tight border-b border-zinc-100 pb-6">자주 묻는 질문</h2>
            <div className="grid gap-6">
              {[
                { q: "아이폰에서도 사용 가능한가요?", a: "현재 메시지 캡처 기능은 안드로이드 OS의 알림 리스너 기능을 기반으로 작동하므로 안드로이드 기기만 지원합니다. 웹 대시보드는 모든 기기에서 사용 가능합니다." },
                { q: "여러 명의 관리자가 동시에 접속할 수 있나요?", a: "네, 관리자 계정을 추가하여 팀원들과 주문 내역을 공유하고 실시간으로 상태를 업데이트할 수 있습니다." },
                { q: "개인정보 보안은 안전한가요?", a: "NotiFlow는 모든 데이터를 암호화하여 저장하며, Supabase의 RLS 정책을 통해 본인 회사의 데이터 외에는 누구도 접근할 수 없도록 철저히 격리합니다." }
              ].map((faq, i) => (
                <div key={i} className="space-y-3">
                  <h4 className="text-xl font-black text-blue-600">Q. {faq.q}</h4>
                  <p className="text-zinc-500 font-medium leading-relaxed pl-6 border-l-2 border-zinc-100">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
