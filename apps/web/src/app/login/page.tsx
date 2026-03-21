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
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out both;
        }
        .animate-fade-in-up-1 { animation-delay: 0.1s; }
        .animate-fade-in-up-2 { animation-delay: 0.2s; }
        .animate-fade-in-up-3 { animation-delay: 0.3s; }
        .animate-fade-in-up-4 { animation-delay: 0.4s; }
        .animate-fade-in-up-5 { animation-delay: 0.5s; }
        .animate-fade-in-up-6 { animation-delay: 0.6s; }
        .animate-subtle-pulse {
          animation: subtlePulse 8s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-5">
        {/* Left panel — branding & features */}
        <div className="hidden lg:flex lg:col-span-3 bg-zinc-950 text-white relative overflow-hidden">
          {/* Mesh gradient background */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background: [
                  "radial-gradient(ellipse 80% 60% at 10% 20%, rgba(99, 102, 241, 0.12), transparent)",
                  "radial-gradient(ellipse 60% 80% at 80% 80%, rgba(168, 85, 247, 0.08), transparent)",
                  "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255, 255, 255, 0.02), transparent)",
                  "radial-gradient(ellipse 90% 40% at 70% 10%, rgba(59, 130, 246, 0.06), transparent)",
                ].join(", "),
              }}
            />
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/8 rounded-full blur-[100px] animate-subtle-pulse" />
            <div className="absolute bottom-1/3 right-[-5%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] animate-subtle-pulse" style={{ animationDelay: "4s" }} />
            <div className="absolute top-2/3 left-1/3 w-72 h-72 bg-blue-500/5 rounded-full blur-[80px] animate-subtle-pulse" style={{ animationDelay: "2s" }} />
          </div>

          <div className="flex flex-col justify-between h-full p-10 lg:p-14 relative z-10 w-full">
            {/* Logo */}
            <div className="animate-fade-in">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-900 transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-white/10">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">
                  Noti<span className="text-zinc-400">Flow</span>
                </span>
              </Link>
            </div>

            {/* Main copy */}
            <div className="space-y-10 max-w-xl">
              <div className="space-y-5">
                <h1 className="text-5xl xl:text-6xl font-bold leading-tight tracking-tight break-keep animate-fade-in-up animate-fade-in-up-1">
                  주문 관리,
                  <br />
                  <span className="bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent">
                    더 정확하게
                  </span>
                </h1>
                <p className="text-zinc-400 text-lg leading-relaxed break-keep max-w-md animate-fade-in-up animate-fade-in-up-2">
                  메시지 수신부터 AI 분석, 주문서 생성, KPIS 신고까지.
                  의료기기 유통에 맞춘 올인원 워크플로우.
                </p>
              </div>

              {/* Feature highlights */}
              <div className="grid grid-cols-2 gap-3 animate-fade-in-up animate-fade-in-up-3">
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
                    className="group/card flex gap-3 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] p-4 transition-all duration-500 ease-out hover:bg-white/8 hover:border-white/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_24px_rgba(0,0,0,0.2)] hover:scale-[1.02]"
                  >
                    <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-all duration-500 ease-out group-hover/card:bg-white/15">
                      <f.icon className="h-4 w-4 text-zinc-300 transition-colors duration-500 group-hover/card:text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{f.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 transition-colors duration-500 group-hover/card:text-zinc-400">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust metrics */}
              <div className="flex items-center gap-8 animate-fade-in-up animate-fade-in-up-4">
                {[
                  { value: "12,847+", label: "처리된 주문" },
                  { value: "99.2%", label: "분석 정확도" },
                  { value: "38개", label: "등록 거래처" },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <p className="text-2xl font-bold tracking-tight text-white">
                      {stat.value}
                    </p>
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-zinc-600 animate-fade-in-up animate-fade-in-up-5">
              <span>&copy; 2026 NotiFlow</span>
              <span className="text-zinc-700">의료기기 유통 관리 플랫폼</span>
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

          <div className="w-full max-w-[380px] space-y-8 animate-fade-in-up animate-fade-in-up-2">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold tracking-tight">로그인</h2>
              <p className="text-sm text-muted-foreground break-keep">
                계정 정보를 입력하여 대시보드에 접속하세요
              </p>
            </div>

            <Suspense>
              <LoginForm />
            </Suspense>

            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground break-keep">
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
    </>
  );
}
