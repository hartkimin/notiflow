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
            transform: translateY(28px);
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
        @keyframes orbDrift1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
          33% { transform: translate(40px, -30px) scale(1.1); opacity: 0.55; }
          66% { transform: translate(-20px, 20px) scale(0.95); opacity: 0.4; }
        }
        @keyframes orbDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.25; }
          40% { transform: translate(-50px, 40px) scale(1.15); opacity: 0.45; }
          70% { transform: translate(30px, -20px) scale(0.9); opacity: 0.3; }
        }
        @keyframes orbDrift3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
          50% { transform: translate(25px, 35px) scale(1.08); opacity: 0.4; }
        }
        .anim-fade-in-up {
          animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-fade-in {
          animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-delay-1 { animation-delay: 0.1s; }
        .anim-delay-2 { animation-delay: 0.2s; }
        .anim-delay-3 { animation-delay: 0.35s; }
        .anim-delay-4 { animation-delay: 0.5s; }
        .anim-delay-5 { animation-delay: 0.65s; }
        .anim-delay-6 { animation-delay: 0.8s; }
        .orb-1 { animation: orbDrift1 12s ease-in-out infinite; }
        .orb-2 { animation: orbDrift2 16s ease-in-out infinite; }
        .orb-3 { animation: orbDrift3 14s ease-in-out infinite; }
      `}</style>

      <div className="w-full lg:grid lg:grid-cols-5 min-h-[100dvh]">
        {/* ──────────────────────────────────────────────
            Left Panel — Branding, Features, Trust
        ────────────────────────────────────────────── */}
        <div className="hidden lg:flex lg:col-span-3 bg-[#050505] text-white relative overflow-hidden">
          {/* Mesh gradient layers */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background: [
                  "radial-gradient(ellipse 80% 50% at 15% 20%, rgba(99, 102, 241, 0.14), transparent 70%)",
                  "radial-gradient(ellipse 60% 70% at 85% 75%, rgba(168, 85, 247, 0.10), transparent 70%)",
                  "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255, 255, 255, 0.015), transparent)",
                  "radial-gradient(ellipse 70% 40% at 65% 10%, rgba(59, 130, 246, 0.08), transparent 70%)",
                  "radial-gradient(ellipse 40% 60% at 30% 80%, rgba(16, 185, 129, 0.06), transparent 70%)",
                ].join(", "),
              }}
            />
            {/* Animated orbs */}
            <div className="orb-1 absolute top-[15%] -left-[5%] w-[420px] h-[420px] bg-indigo-500/[0.07] rounded-full blur-[120px]" />
            <div className="orb-2 absolute bottom-[20%] right-[-8%] w-[520px] h-[520px] bg-purple-500/[0.05] rounded-full blur-[140px]" />
            <div className="orb-3 absolute top-[60%] left-[30%] w-[320px] h-[320px] bg-blue-500/[0.06] rounded-full blur-[100px]" />
          </div>

          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px 128px" }} />

          <div className="flex flex-col justify-between h-full w-full p-10 lg:p-14 xl:p-16 relative z-10">
            {/* Logo */}
            <div className="anim-fade-in">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#050505] transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">
                  Noti<span className="text-zinc-500">Flow</span>
                </span>
              </Link>
            </div>

            {/* Main copy */}
            <div className="space-y-12 max-w-xl">
              {/* Eyebrow */}
              <div className="anim-fade-in-up anim-delay-1">
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                  의료기기 유통 관리 플랫폼
                </span>
              </div>

              <div className="space-y-5">
                <h1 className="text-5xl xl:text-6xl font-bold leading-snug tracking-tight break-keep anim-fade-in-up anim-delay-2">
                  주문부터 납품까지,
                  <br />
                  <span className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
                    한눈에
                  </span>
                </h1>
                <p className="text-zinc-400 text-lg leading-relaxed break-keep max-w-md anim-fade-in-up anim-delay-3">
                  카카오톡 메시지 수신, 주문 자동 분석, 거래처 관리, 식약처 연동까지.
                  혈액투석 의료기기 유통에 필요한 모든 업무를 하나로 잇습니다.
                </p>
              </div>

              {/* Feature cards — Double-Bezel architecture */}
              <div className="grid grid-cols-2 gap-3 anim-fade-in-up anim-delay-4">
                {[
                  {
                    icon: MessageSquare,
                    title: "메시지 자동 분석",
                    desc: "카카오톡 · SMS 주문 메시지를 받으면 품목·수량·거래처를 즉시 추출합니다",
                  },
                  {
                    icon: BarChart2,
                    title: "매출 현황 한눈에",
                    desc: "거래처별 주문 내역과 월별 추이를 대시보드에서 실시간으로 확인합니다",
                  },
                  {
                    icon: Smartphone,
                    title: "모바일 실시간 동기화",
                    desc: "Android 앱에서 수신된 알림이 웹 대시보드에 자동으로 반영됩니다",
                  },
                  {
                    icon: Shield,
                    title: "식약처 DB 연동",
                    desc: "의료기기 품목허가 정보와 KPIS 유통신고를 시스템에서 바로 처리합니다",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="bg-white/5 ring-1 ring-white/10 p-1 rounded-2xl transition-all duration-500 ease-out hover:bg-white/[0.08] hover:scale-[1.02] hover:ring-white/15"
                  >
                    <div className="bg-white/[0.03] rounded-xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] h-full">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.08] ring-1 ring-white/[0.06]">
                          <f.icon className="h-4 w-4 text-zinc-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{f.title}</p>
                          <p className="text-[13px] leading-relaxed text-zinc-500 mt-1 break-keep">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust metrics strip */}
              <div className="flex items-center gap-8 anim-fade-in-up anim-delay-5">
                {[
                  { value: "12,847+", label: "처리된 주문" },
                  { value: "98.7%", label: "분석 정확도" },
                  { value: "38개", label: "등록 거래처" },
                ].map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold tracking-tight text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-zinc-600">{stat.label}</p>
                    </div>
                    {i < 2 && (
                      <div className="h-8 w-px bg-white/[0.06]" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-zinc-700 anim-fade-in-up anim-delay-6">
              <span>&copy; 2026 NotiFlow</span>
              <span className="text-zinc-800">혈액투석 의료기기 유통 관리</span>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────
            Right Panel — Login Form
        ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center lg:col-span-2 px-6 py-14 min-h-[100dvh] lg:min-h-0 bg-white dark:bg-zinc-950">
          {/* Mobile logo + eyebrow */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-12">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Noti<span className="text-zinc-400">Flow</span>
              </span>
            </Link>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              의료기기 유통 관리 플랫폼
            </span>
          </div>

          <div className="w-full max-w-[400px] space-y-8 anim-fade-in-up anim-delay-2">
            {/* Form header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                로그인
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 break-keep">
                계정 정보를 입력하여 대시보드에 접속하세요
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>

            {/* Footer links */}
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 break-keep">
                계정이 필요하시면 관리자에게 문의하세요.
              </p>
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <Link
                  href="/"
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-all duration-500 ease-out"
                >
                  &larr; 홈으로 돌아가기
                </Link>
              </div>
            </div>
          </div>

          {/* Mobile trust strip */}
          <div className="lg:hidden flex items-center justify-center gap-6 mt-12 text-center">
            {[
              { value: "12,847+", label: "처리된 주문" },
              { value: "98.7%", label: "분석 정확도" },
              { value: "38개", label: "등록 거래처" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-6">
                <div className="space-y-0.5">
                  <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                  <p className="text-[11px] text-zinc-500">{stat.label}</p>
                </div>
                {i < 2 && (
                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
