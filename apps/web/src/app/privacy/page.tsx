import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
            <h1 className="text-4xl font-black tracking-tight">개인정보처리방침</h1>
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">최종 수정일: 2026년 3월 10일</p>
          </div>

          <div className="prose prose-zinc prose-sm md:prose-base font-medium text-zinc-600 leading-relaxed space-y-8">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">1. 수집하는 개인정보 항목</h2>
              <p>회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>필수항목: 이메일, 비밀번호, 성명, 회사명</li>
                <li>서비스 이용 과정에서 생성되는 정보: 접속 로그, 쿠키, 결제 기록, 주문 메시지 내용</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">2. 개인정보의 수집 및 이용 목적</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>서비스 제공 및 계약 이행 (주문 자동 분석, 대시보드 제공 등)</li>
                <li>회원 관리 (본인 확인, 고객 문의 응대 등)</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">3. 개인정보의 보유 및 이용기간</h2>
              <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 일정 기간 동안 보관합니다.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-zinc-900">4. 데이터 보안 및 RLS 정책</h2>
              <p>NotiFlow는 사용자의 데이터를 보호하기 위해 행 수준 보안(Row Level Security) 정책을 적용하여, 인증된 사용자만이 자신의 조직 데이터에 접근할 수 있도록 보장합니다.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
