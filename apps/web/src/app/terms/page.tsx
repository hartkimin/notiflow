import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <header className="px-4 lg:px-12 h-20 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm">
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </header>

      <main className="container max-w-3xl mx-auto py-24 px-4">
        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight">이용약관</h1>
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">최종 수정일: 2026년 3월 10일</p>
          </div>

          <div className="prose prose-zinc prose-sm md:prose-base font-medium text-zinc-600 leading-relaxed space-y-8">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">제 1 조 (목적)</h2>
              <p>본 약관은 (주)노티플로우(이하 "회사")가 제공하는 NotiFlow 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">제 2 조 (용어의 정의)</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>"서비스"란 회사가 제공하는 주문 자동화 대시보드 및 모바일 캡처 앱을 의미합니다.</li>
                <li>"회원"이란 회사의 서비스에 접속하여 본 약관에 따라 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">제 3 조 (서비스의 제공 및 변경)</h2>
              <p>회사는 연중무휴, 1일 24시간 서비스 제공을 원칙으로 합니다. 단, 시스템 정기점검, 설비 보수 등을 위해 서비스가 일시 중단될 수 있습니다.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">제 4 조 (회원의 의무)</h2>
              <p>회원은 타인의 개인정보를 도용하거나, 회사가 제공하는 서비스를 본래의 목적 외의 용도로 사용해서는 안 됩니다. 특히, 의료 데이터의 취급 시 관련 법령을 준수해야 합니다.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
