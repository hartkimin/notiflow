import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import {
  Zap,
  MessageSquare,
  BarChart2,
  Smartphone,
  Shield,
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-5">
      {/* Left panel — branding & features */}
      <div className="hidden lg:flex lg:col-span-3 bg-zinc-900 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-white/3 rounded-full blur-3xl" />
        </div>

        <div className="flex flex-col justify-between h-full p-10 lg:p-14 relative z-10 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-900 transition-transform group-hover:scale-105">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Noti<span className="text-zinc-400">Flow</span>
            </span>
          </Link>

          {/* Main copy */}
          <div className="space-y-8 max-w-lg">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
                주문 관리의
                <br />
                새로운 기준
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">
                메시지 수신부터 AI 분석, 주문서 생성, KPIS 신고까지.
                의료기기 유통에 최적화된 올인원 솔루션.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: MessageSquare,
                  title: "AI 자동 분석",
                  desc: "카카오톡 · SMS 메시지 파싱",
                },
                {
                  icon: BarChart2,
                  title: "매출 · 마진 관리",
                  desc: "거래처별 실시간 현황",
                },
                {
                  icon: Smartphone,
                  title: "모바일 연동",
                  desc: "Android 앱 실시간 동기화",
                },
                {
                  icon: Shield,
                  title: "규제 준수",
                  desc: "식약처 DB · KPIS 연동",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="flex gap-3 rounded-xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <f.icon className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{f.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span>&copy; 2026 NotiFlow</span>
            <span>Powered by AI</span>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-col items-center justify-center lg:col-span-2 px-4 py-12 min-h-screen lg:min-h-0">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Noti<span className="text-zinc-500">Flow</span>
          </span>
        </div>

        <div className="w-full max-w-[380px] space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">로그인</h2>
            <p className="text-sm text-muted-foreground">
              계정 정보를 입력하여 대시보드에 접속하세요
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              계정이 필요하시면 관리자에게 문의하세요.
            </p>
            <div className="border-t pt-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; 홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
