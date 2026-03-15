import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Zap,
  ArrowRight,
  MessageSquare,
  FileText,
  BarChart2,
  Smartphone,
  Shield,
  Clock,
  CheckCircle2,
  Building2,
  Package,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="px-4 lg:px-6 h-16 flex items-center bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Noti<span className="text-zinc-500">Flow</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1.5">
          <Link
            href="#features"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm text-muted-foreground hidden sm:inline-flex",
            )}
          >
            기능
          </Link>
          <Link
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm text-muted-foreground hidden sm:inline-flex",
            )}
          >
            작동방식
          </Link>
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-medium",
            )}
          >
            로그인
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white",
            )}
          >
            시작하기
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ──────────────────────────────────── */}
        <section className="w-full pt-24 pb-20 md:pt-36 md:pb-28 lg:pt-44 lg:pb-32 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-zinc-100 to-transparent rounded-full blur-3xl opacity-60" />
          </div>

          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                의료기기 유통 전문 주문관리 플랫폼
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem] leading-[1.1]">
                메시지가 도착하면,
                <br />
                <span className="bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 bg-clip-text text-transparent">
                  주문이 완성됩니다
                </span>
              </h1>

              <p className="max-w-[640px] text-lg text-zinc-500 md:text-xl leading-relaxed">
                카카오톡, SMS로 들어오는 주문 메시지를 AI가 실시간 분석하여
                품목 추출부터 주문서 생성, KPIS 신고까지 한번에 처리합니다.
              </p>

              <div className="flex flex-col gap-3 min-[400px]:flex-row pt-2">
                <Button asChild size="lg" className="text-base px-8 h-12 bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg shadow-zinc-900/20">
                  <Link href="/login">
                    무료로 시작하기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8 h-12">
                  <Link href="#features">기능 살펴보기</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats Section ─────────────────────────────────── */}
        <section className="w-full py-12 border-y bg-zinc-50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {[
                { value: "10,000+", label: "처리된 주문", icon: FileText },
                { value: "99.2%", label: "AI 매칭 정확도", icon: CheckCircle2 },
                { value: "70%", label: "업무 시간 절감", icon: Clock },
                { value: "실시간", label: "모바일 연동", icon: Smartphone },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center text-center gap-1">
                  <stat.icon className="h-5 w-5 text-zinc-400 mb-1" />
                  <span className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
                    {stat.value}
                  </span>
                  <span className="text-sm text-zinc-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Section ──────────────────────────────── */}
        <section id="features" className="w-full py-24 md:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center space-y-4 mb-20">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                Features
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl max-w-2xl">
                주문 관리에 필요한 모든 것,
                <br className="hidden sm:block" />
                하나의 플랫폼에서
              </h2>
              <p className="max-w-[700px] text-zinc-500 md:text-lg">
                수작업으로 하던 모든 주문 처리 과정을 자동화하여
                더 중요한 비즈니스에 집중하세요.
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: MessageSquare,
                  title: "AI 메시지 분석",
                  desc: "카카오톡, SMS로 들어오는 비정형 주문 메시지를 Claude, Gemini, GPT 등 멀티 AI가 분석하여 품목, 수량, 단위를 자동 추출합니다.",
                },
                {
                  icon: FileText,
                  title: "자동 주문서 생성",
                  desc: "분석된 데이터를 기반으로 거래처별 주문서를 자동 생성하고, 신뢰도 기준으로 자동 확정 또는 검토 대기로 분류합니다.",
                },
                {
                  icon: Building2,
                  title: "거래처 · 공급사 관리",
                  desc: "병원, 약국, 유통사 등 거래처와 공급사를 체계적으로 관리하고 거래처별 품목, 단가, 주문 패턴을 추적합니다.",
                },
                {
                  icon: Package,
                  title: "식약처 품목 연동",
                  desc: "식약처(MFDS) 의약품·의료기기 DB와 실시간 연동하여 정확한 품목 정보를 유지하고 표준코드 기반으로 매칭합니다.",
                },
                {
                  icon: BarChart2,
                  title: "매출 · 마진 분석",
                  desc: "대시보드에서 주문, 배송, 매출 현황을 실시간으로 확인하고 거래처별, 품목별 마진율까지 한눈에 파악하세요.",
                },
                {
                  icon: Smartphone,
                  title: "모바일 실시간 연동",
                  desc: "Android 모바일 앱이 카카오톡, SMS 메시지를 실시간으로 캡처하여 웹 대시보드에 자동 전송합니다.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-zinc-200 bg-white p-8 transition-all duration-200 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-100"
                >
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-200">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-zinc-900">{feature.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section id="how-it-works" className="w-full py-24 md:py-32 bg-zinc-50 border-y">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center space-y-4 mb-20">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                How it works
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                3단계로 끝나는 주문 처리
              </h2>
              <p className="max-w-[500px] text-zinc-500">
                복잡한 설정 없이, 모바일 앱 설치 후 바로 시작할 수 있습니다.
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <div className="grid gap-12 md:grid-cols-3 relative">
                {/* Connector line */}
                <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-zinc-300" />

                {[
                  {
                    step: "01",
                    title: "메시지 수신",
                    desc: "모바일 앱이 카카오톡, SMS 주문 메시지를 실시간으로 캡처하여 클라우드에 전송합니다.",
                  },
                  {
                    step: "02",
                    title: "AI 분석 · 매칭",
                    desc: "AI가 메시지를 분석하여 품목명, 수량, 단위를 추출하고 식약처 DB와 자동 매칭합니다.",
                  },
                  {
                    step: "03",
                    title: "주문 확정 · 관리",
                    desc: "높은 신뢰도는 자동 확정, 낮은 신뢰도는 대시보드에서 검토합니다. KPIS 신고까지 원클릭.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex flex-col items-center text-center space-y-4 relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-white text-lg font-bold shadow-lg shadow-zinc-900/20 relative z-10">
                      {item.step}
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900">{item.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed max-w-[260px]">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Use Cases ─────────────────────────────────────── */}
        <section className="w-full py-24 md:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                Use Cases
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                이런 분들에게 추천합니다
              </h2>
            </div>

            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              {[
                {
                  icon: TrendingUp,
                  title: "의료기기 유통사",
                  desc: "카카오톡으로 들어오는 병원 주문을 수기로 정리하던 업무를 자동화하세요. 품목 매칭부터 KPIS 신고까지.",
                },
                {
                  icon: Building2,
                  title: "의약품 도매상",
                  desc: "다수 거래처의 반복 주문을 패턴화하고, AI가 메시지에서 품목과 수량을 자동 추출합니다.",
                },
                {
                  icon: Shield,
                  title: "규제 준수가 중요한 기업",
                  desc: "식약처 표준코드 기반 품목 관리와 KPIS 신고 이력 추적으로 컴플라이언스를 강화하세요.",
                },
                {
                  icon: BarChart2,
                  title: "데이터 기반 의사결정",
                  desc: "거래처별 주문 통계, 품목별 마진 분석, 배송 현황 등 경영에 필요한 인사이트를 한눈에.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex gap-5 rounded-2xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ───────────────────────────────────── */}
        <section className="w-full py-24 md:py-32 bg-zinc-900 text-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                지금 바로 시작하세요
              </h2>
              <p className="text-zinc-400 md:text-lg max-w-lg">
                복잡한 설정 없이 바로 사용할 수 있습니다.
                AI가 주문 업무를 대신하는 경험을 해보세요.
              </p>
              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Button asChild size="lg" className="text-base px-8 h-12 bg-white text-zinc-900 hover:bg-zinc-100">
                  <Link href="/login">
                    NotiFlow 시작하기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4 text-sm text-zinc-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  무료 체험
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  설치 불필요
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  즉시 시작
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t bg-white">
        <div className="container px-4 md:px-6 mx-auto py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <span className="text-base font-bold">
                  Noti<span className="text-zinc-500">Flow</span>
                </span>
              </div>
              <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                의료기기 · 의약품 유통사를 위한 AI 기반 주문 자동화 플랫폼.
                메시지 수신부터 주문 확정까지 한번에.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">제품</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link href="#features" className="hover:text-zinc-900 transition-colors">기능 소개</Link></li>
                <li><Link href="#how-it-works" className="hover:text-zinc-900 transition-colors">작동 방식</Link></li>
                <li><Link href="/login" className="hover:text-zinc-900 transition-colors">대시보드</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">지원</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link href="/login" className="hover:text-zinc-900 transition-colors">로그인</Link></li>
                <li><span className="cursor-default">이용약관</span></li>
                <li><span className="cursor-default">개인정보처리방침</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">
              &copy; 2026 NotiFlow. All rights reserved.
            </p>
            <p className="text-xs text-zinc-400">
              Powered by AI — Claude, Gemini, GPT
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
