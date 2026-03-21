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
import { ScrollReveal } from "@/components/scroll-reveal";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#fafaf9]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="px-4 lg:px-6 h-16 flex items-center bg-[#fafaf9]/80 backdrop-blur-md sticky top-0 z-50 border-b border-stone-200/60">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-stone-900">
            Noti<span className="text-stone-400">Flow</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1.5">
          <Link
            href="#features"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm text-stone-500 hover:text-stone-900 hidden sm:inline-flex transition-colors duration-200",
            )}
          >
            기능
          </Link>
          <Link
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm text-stone-500 hover:text-stone-900 hidden sm:inline-flex transition-colors duration-200",
            )}
          >
            작동방식
          </Link>
          <div className="w-px h-5 bg-stone-200 mx-1 hidden sm:block" />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors duration-200",
            )}
          >
            로그인
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "text-sm font-medium bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white transition-all duration-200 rounded-full px-5",
            )}
          >
            시작하기
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero Section — Left-aligned asymmetric ──────── */}
        <section className="w-full pt-24 pb-20 md:pt-32 md:pb-28 lg:pt-40 lg:pb-36 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-emerald-100/40 blur-3xl" />
            <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] rounded-full bg-stone-100/60 blur-3xl" />
          </div>

          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-7xl mx-auto">
              {/* Left — Copy */}
              <ScrollReveal className="flex flex-col space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700 w-fit">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  의료기기 유통 전문 주문관리
                </div>

                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.5rem] xl:text-[4rem] leading-[1.1] text-stone-900 break-keep">
                  메시지가 도착하면,
                  <br />
                  <span className="text-emerald-600">
                    주문이 완성됩니다
                  </span>
                </h1>

                <p className="max-w-[540px] text-lg text-stone-500 leading-relaxed break-keep">
                  카카오톡, SMS로 들어오는 주문 메시지를 AI가 실시간 분석합니다.
                  품목 추출, 주문서 생성, 식약처 신고까지 하나의 흐름으로 처리하세요.
                </p>

                <div className="flex flex-col gap-3 min-[400px]:flex-row pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="text-lg px-8 py-4 h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-lg shadow-emerald-600/20 rounded-full transition-all duration-300"
                  >
                    <Link href="/login">
                      무료로 시작하기
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-4 h-14 border-stone-300 text-stone-700 hover:bg-stone-100 active:scale-[0.98] rounded-full transition-all duration-300"
                  >
                    <Link href="#features">기능 살펴보기</Link>
                  </Button>
                </div>
              </ScrollReveal>

              {/* Right — Visual card mockup */}
              <ScrollReveal delay={200} className="hidden lg:block">
                <div className="relative">
                  {/* Main card */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/50">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">새 주문 메시지</p>
                        <p className="text-xs text-stone-400">카카오톡 · 방금 전</p>
                      </div>
                      <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        AI 분석 완료
                      </span>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600 leading-relaxed mb-4">
                      &ldquo;메디플로우 투석셋트 200개, HD필터 100개 보내주세요&rdquo;
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm px-1">
                        <span className="text-stone-500">투석셋트</span>
                        <span className="font-medium text-stone-900">200개</span>
                      </div>
                      <div className="h-px bg-stone-100" />
                      <div className="flex items-center justify-between text-sm px-1">
                        <span className="text-stone-500">HD필터</span>
                        <span className="font-medium text-stone-900">100개</span>
                      </div>
                    </div>
                  </div>

                  {/* Floating badge */}
                  <div className="absolute -bottom-4 -left-4 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium text-stone-700">신뢰도 98.7%</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ── Stats Section — Horizontal strip ─────────────── */}
        <section className="w-full py-6 border-y border-stone-200 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal>
              <div className="flex flex-wrap justify-center divide-x divide-stone-200">
                {[
                  { value: "12,847+", label: "처리된 주문", icon: FileText },
                  { value: "98.7%", label: "AI 매칭 정확도", icon: CheckCircle2 },
                  { value: "67%", label: "업무 시간 절감", icon: Clock },
                  { value: "실시간", label: "모바일 연동", icon: Smartphone },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 px-6 md:px-10 py-4"
                  >
                    <stat.icon className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl md:text-2xl font-bold tracking-tight text-stone-900">
                        {stat.value}
                      </span>
                      <span className="text-sm text-stone-400">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Features Section — Bento Grid ────────────────── */}
        <section id="features" className="w-full py-24 md:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal className="flex flex-col items-center text-center space-y-4 mb-20">
              <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                Features
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl max-w-2xl text-stone-900 break-keep">
                주문 관리의 모든 것,
                <br className="hidden sm:block" />
                하나의 플랫폼에서
              </h2>
              <p className="max-w-[600px] text-stone-500 md:text-lg break-keep">
                수작업으로 처리하던 주문 업무를 자동화하세요.
                더 중요한 비즈니스에 집중할 수 있습니다.
              </p>
            </ScrollReveal>

            {/* Bento grid: 2 large top + 4 small bottom */}
            <div className="mx-auto max-w-6xl grid gap-4 md:gap-5 md:grid-cols-2">
              {/* Large card 1 */}
              <ScrollReveal delay={0}>
                <div className="group relative rounded-2xl border border-stone-200 bg-white p-8 md:p-10 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 min-h-[280px] flex flex-col justify-between">
                  <div>
                    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-stone-900 break-keep">AI 메시지 분석</h3>
                    <p className="text-stone-500 leading-relaxed break-keep">
                      카카오톡, SMS로 들어오는 비정형 주문 메시지를 Claude, Gemini 등 멀티 AI가 분석합니다.
                      품목명, 수량, 단위를 자동 추출하고 과거 주문 패턴과 대조합니다.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    자세히 보기 <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </ScrollReveal>

              {/* Large card 2 */}
              <ScrollReveal delay={100}>
                <div className="group relative rounded-2xl border border-stone-200 bg-white p-8 md:p-10 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 min-h-[280px] flex flex-col justify-between">
                  <div>
                    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-stone-900 break-keep">자동 주문서 생성</h3>
                    <p className="text-stone-500 leading-relaxed break-keep">
                      분석된 데이터로 거래처별 주문서를 자동 생성합니다.
                      신뢰도 기준으로 자동 확정 또는 검토 대기로 분류되어 실수를 줄이고 속도를 높입니다.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    자세히 보기 <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </ScrollReveal>

              {/* 4 small cards */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {[
                  {
                    icon: Building2,
                    title: "거래처 관리",
                    desc: "병원, 유통사 등 거래처별 품목, 단가, 주문 패턴을 체계적으로 추적합니다.",
                    delay: 200,
                  },
                  {
                    icon: Package,
                    title: "식약처 연동",
                    desc: "MFDS 의약품·의료기기 DB와 실시간 연동, 표준코드 기반 매칭을 지원합니다.",
                    delay: 300,
                  },
                  {
                    icon: BarChart2,
                    title: "매출 분석",
                    desc: "거래처별, 품목별 매출과 마진율을 대시보드에서 한눈에 파악하세요.",
                    delay: 400,
                  },
                  {
                    icon: Smartphone,
                    title: "모바일 연동",
                    desc: "Android 앱이 메시지를 실시간 캡처하여 웹 대시보드에 자동 전송합니다.",
                    delay: 500,
                  },
                ].map((feature) => (
                  <ScrollReveal key={feature.title} delay={feature.delay}>
                    <div className="group rounded-2xl border border-stone-200 bg-white p-6 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 h-full">
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold mb-2 text-stone-900 break-keep">{feature.title}</h3>
                      <p className="text-sm text-stone-500 leading-relaxed break-keep">{feature.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works — Zig-zag layout ───────────────── */}
        <section id="how-it-works" className="w-full py-24 md:py-32 bg-stone-900 text-white relative overflow-hidden">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 -z-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

          <div className="container px-4 md:px-6 mx-auto relative z-10">
            <ScrollReveal className="flex flex-col items-center text-center space-y-4 mb-20">
              <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                How it works
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl break-keep">
                3단계로 끝나는 주문 처리
              </h2>
              <p className="max-w-[500px] text-stone-400 break-keep">
                복잡한 설정 없이, 모바일 앱 설치 후 바로 시작할 수 있습니다.
              </p>
            </ScrollReveal>

            <div className="mx-auto max-w-5xl space-y-8 md:space-y-0">
              {[
                {
                  step: "01",
                  title: "메시지 수신",
                  desc: "모바일 앱이 카카오톡, SMS 주문 메시지를 실시간으로 캡처합니다. 별도 설정 없이 앱 설치만으로 동작합니다.",
                  align: "left" as const,
                },
                {
                  step: "02",
                  title: "AI 분석 · 매칭",
                  desc: "메시지에서 품목명, 수량, 단위를 자동 추출합니다. 식약처 DB와 대조하여 정확한 품목 코드를 매칭합니다.",
                  align: "right" as const,
                },
                {
                  step: "03",
                  title: "주문 확정 · 관리",
                  desc: "높은 신뢰도의 주문은 자동 확정되고, 낮은 신뢰도의 주문은 대시보드에서 검토합니다. 식약처 신고까지 원클릭으로.",
                  align: "left" as const,
                },
              ].map((item, i) => (
                <ScrollReveal key={item.step} delay={i * 150}>
                  <div
                    className={cn(
                      "flex flex-col md:flex-row items-center gap-6 md:gap-12",
                      item.align === "right" && "md:flex-row-reverse",
                    )}
                  >
                    <div className="shrink-0 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 text-white text-2xl font-bold shadow-lg shadow-emerald-600/30">
                      {item.step}
                    </div>
                    <div
                      className={cn(
                        "flex-1 rounded-2xl border border-stone-700/50 bg-stone-800/50 backdrop-blur-sm p-8",
                        item.align === "right" ? "md:text-right" : "md:text-left",
                        "text-center md:text-inherit",
                      )}
                    >
                      <h3 className="text-xl font-bold mb-2 break-keep">{item.title}</h3>
                      <p className="text-stone-400 leading-relaxed break-keep">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use Cases — Side-by-side split ───────────────── */}
        <section className="w-full py-24 md:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 max-w-6xl mx-auto items-start">
              {/* Left — Sticky heading */}
              <ScrollReveal className="lg:col-span-2 lg:sticky lg:top-24">
                <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                  Use Cases
                </span>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mt-4 mb-4 text-stone-900 break-keep">
                  이런 분들이
                  <br />
                  사용하고 있습니다
                </h2>
                <p className="text-stone-500 leading-relaxed break-keep">
                  의료기기 유통부터 의약품 도매까지, 주문 메시지를 다루는 모든 업무에 적합합니다.
                </p>
              </ScrollReveal>

              {/* Right — Stacked cards */}
              <div className="lg:col-span-3 space-y-4">
                {[
                  {
                    icon: TrendingUp,
                    title: "의료기기 유통사",
                    desc: "카카오톡으로 들어오는 병원 주문을 수기로 정리하던 업무를 자동화하세요. 품목 매칭부터 KPIS 신고까지 한 곳에서.",
                    delay: 0,
                  },
                  {
                    icon: Building2,
                    title: "의약품 도매상",
                    desc: "다수 거래처의 반복 주문을 패턴화하고, AI가 메시지에서 품목과 수량을 자동 추출합니다.",
                    delay: 100,
                  },
                  {
                    icon: Shield,
                    title: "규제 준수가 중요한 기업",
                    desc: "식약처 표준코드 기반 품목 관리와 KPIS 신고 이력 추적으로 컴플라이언스를 강화하세요.",
                    delay: 200,
                  },
                  {
                    icon: BarChart2,
                    title: "데이터 기반 의사결정이 필요한 팀",
                    desc: "거래처별 주문 통계, 품목별 마진 분석, 배송 현황까지 경영에 필요한 숫자를 한눈에 확인합니다.",
                    delay: 300,
                  },
                ].map((item) => (
                  <ScrollReveal key={item.title} delay={item.delay}>
                    <div className="group flex gap-5 rounded-2xl border border-stone-200 bg-white p-6 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50">
                      <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-900 mb-1.5 break-keep">{item.title}</h3>
                        <p className="text-sm text-stone-500 leading-relaxed break-keep">{item.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Section — Full-bleed dramatic ────────────── */}
        <section className="w-full py-28 md:py-36 bg-emerald-600 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-emerald-500/50 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-emerald-700/50 blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="container px-4 md:px-6 mx-auto relative z-10">
            <ScrollReveal className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl break-keep">
                주문 업무, 이제
                <br />
                NotiFlow에 맡기세요
              </h2>
              <p className="text-emerald-100 md:text-lg max-w-lg break-keep">
                복잡한 설정 없이 바로 사용할 수 있습니다.
                메시지 분석부터 주문 관리까지, 하나의 흐름으로.
              </p>
              <div className="flex flex-col gap-3 min-[400px]:flex-row pt-2">
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-10 py-4 h-14 bg-white text-emerald-700 hover:bg-emerald-50 active:scale-[0.98] rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-300 font-semibold"
                >
                  <Link href="/login">
                    NotiFlow 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-4 text-sm text-emerald-100">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  무료 체험
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  설치 불필요
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  즉시 시작
                </span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="container px-4 md:px-6 mx-auto py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 text-white">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <span className="text-base font-bold text-stone-900">
                  Noti<span className="text-stone-400">Flow</span>
                </span>
              </div>
              <p className="text-sm text-stone-500 max-w-xs leading-relaxed break-keep">
                의료기기·의약품 유통사를 위한
                AI 기반 주문 자동화 플랫폼.
                메시지 수신부터 주문 확정까지 한번에.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">제품</h4>
              <ul className="space-y-2 text-sm text-stone-500">
                <li>
                  <Link href="#features" className="hover:text-stone-900 transition-colors duration-200">
                    기능 소개
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-stone-900 transition-colors duration-200">
                    작동 방식
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-stone-900 transition-colors duration-200">
                    대시보드
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">지원</h4>
              <ul className="space-y-2 text-sm text-stone-500">
                <li>
                  <Link href="/login" className="hover:text-stone-900 transition-colors duration-200">
                    로그인
                  </Link>
                </li>
                <li><span className="cursor-default">이용약관</span></li>
                <li><span className="cursor-default">개인정보처리방침</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-200 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-stone-400">
              &copy; 2026 NotiFlow. All rights reserved.
            </p>
            <p className="text-xs text-stone-400">
              Powered by AI — Claude, Gemini, GPT
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
