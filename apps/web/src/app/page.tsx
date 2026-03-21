import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ArrowRight,
  MessageSquare,
  FileText,
  BarChart2,
  Smartphone,
  Clock,
  CheckCircle2,
  Building2,
  Package,
  Quote,
} from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#050505] text-white">
      {/* ── Floating Glass Navigation ─────────────────────── */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        <nav className="flex items-center justify-between rounded-full bg-white/5 backdrop-blur-2xl ring-1 ring-white/10 px-6 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              Noti<span className="text-zinc-500">Flow</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="#features"
              className="hidden sm:inline-flex rounded-full px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition-all duration-500 ease-out"
            >
              기능
            </Link>
            <Link
              href="#how-it-works"
              className="hidden sm:inline-flex rounded-full px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition-all duration-500 ease-out"
            >
              작동방식
            </Link>
            <div className="w-px h-5 bg-white/10 mx-2 hidden sm:block" />
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 transition-all duration-500 ease-out"
            >
              로그인
            </Link>
            <Button asChild className="rounded-full px-6 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] text-white transition-all duration-500 ease-out border-0">
              <Link href="/login">
                시작하기
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero — Editorial Split ──────────────────────── */}
        <section className="relative w-full pt-40 pb-24 md:pt-48 md:pb-32 lg:pt-56 lg:pb-40 overflow-hidden">
          {/* Background mesh gradient orbs */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-emerald-500/8 blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[100px]" />
            <div className="absolute top-[30%] left-[40%] w-[300px] h-[300px] rounded-full bg-zinc-700/10 blur-[80px]" />
          </div>

          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center max-w-7xl mx-auto">
              {/* Left — Massive typography */}
              <ScrollReveal className="flex flex-col space-y-8">
                <div className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400 w-fit">
                  AI 기반 의료기기 주문관리
                </div>

                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-snug text-white break-keep">
                  메시지 하나로,
                  <br />
                  <span className="text-emerald-400">
                    주문이 완성됩니다
                  </span>
                </h1>

                <p className="max-w-[520px] text-lg text-zinc-400 leading-relaxed break-keep">
                  카카오톡과 SMS로 수신되는 주문 메시지를 AI가 실시간 분석합니다.
                  품목 추출부터 주문서 생성, 식약처 연동까지 하나의 흐름으로 처리하세요.
                </p>

                <div className="flex flex-col gap-4 min-[400px]:flex-row pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full px-8 py-4 text-lg h-14 bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] text-white shadow-[0_0_40px_rgba(16,185,129,0.25)] transition-all duration-500 ease-out border-0"
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
                    className="rounded-full px-8 py-4 text-lg h-14 border-white/10 text-zinc-300 bg-white/5 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-out backdrop-blur-sm"
                  >
                    <Link href="#features">기능 살펴보기</Link>
                  </Button>
                </div>
              </ScrollReveal>

              {/* Right — Glass card mockup */}
              <ScrollReveal delay={200} className="hidden lg:block">
                <div className="relative">
                  {/* Double-bezel card: outer shell */}
                  <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem]">
                    {/* Inner core */}
                    <div className="bg-zinc-900/80 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">새 주문 메시지</p>
                          <p className="text-xs text-zinc-500">카카오톡 · 방금 전</p>
                        </div>
                        <span className="ml-auto rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400">
                          AI 분석 완료
                        </span>
                      </div>

                      <div className="rounded-xl bg-white/5 ring-1 ring-white/5 p-4 text-sm text-zinc-300 leading-relaxed mb-6">
                        &ldquo;메디플로우 투석셋트 200개, HD필터 100개 보내주세요&rdquo;
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-zinc-500">투석셋트</span>
                          <span className="font-medium text-white tabular-nums">200개</span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-zinc-500">HD필터</span>
                          <span className="font-medium text-white tabular-nums">100개</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating confidence badge */}
                  <div className="absolute -bottom-5 -left-5 bg-white/5 ring-1 ring-white/10 p-1 rounded-2xl backdrop-blur-2xl">
                    <div className="bg-zinc-900/90 rounded-[calc(1rem-0.25rem)] px-5 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-medium text-white">신뢰도 98.7%</span>
                    </div>
                  </div>

                  {/* Floating processing speed badge */}
                  <div className="absolute -top-3 -right-3 bg-white/5 ring-1 ring-white/10 p-1 rounded-2xl backdrop-blur-2xl">
                    <div className="bg-zinc-900/90 rounded-[calc(1rem-0.25rem)] px-5 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">2.3초 분석</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ── Metrics Bar ─────────────────────────────────── */}
        <section className="w-full py-8 border-y border-white/5 bg-white/[0.02]">
          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal>
              <div className="flex flex-wrap justify-center gap-0">
                {[
                  { value: "12,847+", label: "처리된 주문" },
                  { value: "98.7%", label: "AI 매칭 정확도" },
                  { value: "2.3초", label: "평균 분석 시간" },
                  { value: "67%", label: "업무 시간 절감" },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className="flex items-baseline gap-3 px-8 md:px-12 py-4 relative"
                  >
                    {i > 0 && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-white/10 hidden sm:block" />
                    )}
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums">
                      {stat.value}
                    </span>
                    <span className="text-sm text-zinc-500">{stat.label}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Features — Asymmetric Bento Grid ────────────── */}
        <section id="features" className="w-full py-24 md:py-32 lg:py-40">
          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal className="flex flex-col items-center text-center space-y-5 mb-20">
              <div className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400">
                Features
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl max-w-2xl text-white break-keep leading-snug">
                주문 관리의 모든 것,
                <br className="hidden sm:block" />
                하나의 플랫폼에서
              </h2>
              <p className="max-w-[560px] text-zinc-400 md:text-lg break-keep">
                수작업으로 처리하던 주문 업무를 자동화하세요.
                더 중요한 비즈니스에 집중할 수 있습니다.
              </p>
            </ScrollReveal>

            {/* Asymmetric bento: row 1 = 2 large cards, row 2 = 4 small cards */}
            <div className="mx-auto max-w-6xl grid gap-4 md:gap-5">
              {/* Row 1: Two large cards spanning full width */}
              <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                {/* Large card 1 — AI Message Analysis */}
                <ScrollReveal delay={0}>
                  <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem] h-full group">
                    <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] h-full flex flex-col justify-between transition-all duration-500 ease-out group-hover:bg-zinc-900/80">
                      <div>
                        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 ease-out">
                          <MessageSquare className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white break-keep">AI 메시지 분석</h3>
                        <p className="text-zinc-400 leading-relaxed break-keep">
                          카카오톡, SMS로 들어오는 비정형 주문 메시지를 Claude, Gemini 등 멀티 AI가 분석합니다.
                          품목명, 수량, 단위를 자동 추출하고 과거 주문 패턴과 대조합니다.
                        </p>
                      </div>
                      <div className="mt-6 flex items-center gap-2 text-sm text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                        자세히 보기 <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </ScrollReveal>

                {/* Large card 2 — Auto Order Generation */}
                <ScrollReveal delay={100}>
                  <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem] h-full group">
                    <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] h-full flex flex-col justify-between transition-all duration-500 ease-out group-hover:bg-zinc-900/80">
                      <div>
                        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 ease-out">
                          <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white break-keep">자동 주문서 생성</h3>
                        <p className="text-zinc-400 leading-relaxed break-keep">
                          분석된 데이터로 거래처별 주문서를 자동 생성합니다.
                          신뢰도 기준으로 자동 확정 또는 검토 대기로 분류되어 실수를 줄이고 속도를 높입니다.
                        </p>
                      </div>
                      <div className="mt-6 flex items-center gap-2 text-sm text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                        자세히 보기 <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>

              {/* Row 2: Four small cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
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
                    <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem] h-full group">
                      <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] h-full transition-all duration-500 ease-out group-hover:bg-zinc-900/80">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 ease-out">
                          <feature.icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-base font-semibold mb-2 text-white break-keep">{feature.title}</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed break-keep">{feature.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works — Zig-zag Alternating ──────────── */}
        <section id="how-it-works" className="w-full py-24 md:py-32 lg:py-40 relative overflow-hidden">
          {/* Subtle background orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/3 blur-[150px] -z-10" />

          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal className="flex flex-col items-center text-center space-y-5 mb-20">
              <div className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400">
                How it works
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl break-keep leading-snug">
                3단계로 끝나는 주문 처리
              </h2>
              <p className="max-w-[480px] text-zinc-400 break-keep">
                복잡한 설정 없이, 모바일 앱 설치 후 바로 시작할 수 있습니다.
              </p>
            </ScrollReveal>

            <div className="mx-auto max-w-5xl space-y-12 md:space-y-20">
              {[
                {
                  step: "01",
                  title: "메시지 수신",
                  desc: "모바일 앱이 카카오톡, SMS 주문 메시지를 실시간으로 캡처합니다. 별도 설정 없이 앱 설치만으로 동작합니다.",
                  reverse: false,
                },
                {
                  step: "02",
                  title: "AI 분석 · 매칭",
                  desc: "메시지에서 품목명, 수량, 단위를 자동 추출합니다. 식약처 DB와 대조하여 정확한 품목 코드를 매칭합니다.",
                  reverse: true,
                },
                {
                  step: "03",
                  title: "주문 확정 · 관리",
                  desc: "높은 신뢰도의 주문은 자동 확정되고, 낮은 신뢰도의 주문은 대시보드에서 검토합니다. 식약처 신고까지 원클릭으로.",
                  reverse: false,
                },
              ].map((item, i) => (
                <ScrollReveal key={item.step} delay={i * 150}>
                  <div
                    className={`flex flex-col gap-8 md:gap-16 items-center ${
                      item.reverse ? "md:flex-row-reverse" : "md:flex-row"
                    }`}
                  >
                    {/* Step number orb */}
                    <div className="shrink-0">
                      <div className="relative flex h-24 w-24 items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/15 blur-xl" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 text-2xl font-bold">
                          {item.step}
                        </div>
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="flex-1 bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem]">
                      <div
                        className={`bg-zinc-900/60 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] ${
                          item.reverse ? "md:text-right" : "md:text-left"
                        } text-center md:text-inherit`}
                      >
                        <h3 className="text-xl font-bold mb-3 text-white break-keep">{item.title}</h3>
                        <p className="text-zinc-400 leading-relaxed break-keep">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────── */}
        <section className="w-full py-24 md:py-32 lg:py-40 relative overflow-hidden">
          <div className="absolute top-0 right-[-20%] w-[500px] h-[500px] rounded-full bg-emerald-500/4 blur-[120px] -z-10" />

          <div className="container px-4 md:px-6 mx-auto">
            <ScrollReveal className="flex flex-col items-center text-center space-y-5 mb-20">
              <div className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-emerald-500/10 text-emerald-400">
                Testimonials
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl break-keep leading-snug">
                현장에서 검증된 솔루션
              </h2>
            </ScrollReveal>

            <div className="mx-auto max-w-6xl grid md:grid-cols-3 gap-4 md:gap-5">
              {[
                {
                  quote: "카카오톡으로 들어오는 병원 주문을 매번 엑셀에 옮기던 시간이 사라졌습니다. AI 분석 정확도가 높아서 검토할 건수가 매우 적어요.",
                  name: "하윤서",
                  role: "메디플로우 영업관리팀장",
                  delay: 0,
                },
                {
                  quote: "식약처 표준코드 연동이 가장 마음에 듭니다. KPIS 신고 때마다 품목 찾는 시간이 확 줄었고, 실수도 거의 없어졌습니다.",
                  name: "박도현",
                  role: "헬스브릿지 규제팀",
                  delay: 100,
                },
                {
                  quote: "모바일 앱 하나로 메시지 캡처부터 주문 확인까지 가능하니 외근 중에도 업무를 놓치지 않습니다. 도입 후 업무 효율이 체감될 정도로 달라졌어요.",
                  name: "이서진",
                  role: "바이오넥스 대표",
                  delay: 200,
                },
              ].map((testimonial) => (
                <ScrollReveal key={testimonial.name} delay={testimonial.delay}>
                  <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-[2rem] h-full">
                    <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] h-full flex flex-col">
                      <Quote className="h-8 w-8 text-emerald-500/30 mb-6 shrink-0" />
                      <p className="text-zinc-300 leading-relaxed break-keep flex-1 text-[15px]">
                        {testimonial.quote}
                      </p>
                      <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA — Full-bleed Dramatic ───────────────────── */}
        <section className="w-full py-28 md:py-36 lg:py-44 relative overflow-hidden">
          {/* Dramatic glowing background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[150px]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          </div>

          <div className="container px-4 md:px-6 mx-auto relative z-10">
            <ScrollReveal className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl break-keep leading-snug">
                주문 업무, 이제
                <br />
                <span className="text-emerald-400">NotiFlow</span>에 맡기세요
              </h2>
              <p className="text-zinc-400 md:text-lg max-w-lg break-keep">
                복잡한 설정 없이 바로 사용할 수 있습니다.
                메시지 분석부터 주문 관리까지, 하나의 흐름으로.
              </p>
              <div className="pt-4">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full px-10 py-4 text-lg h-14 bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] text-white shadow-[0_0_60px_rgba(16,185,129,0.3)] transition-all duration-500 ease-out font-semibold border-0"
                >
                  <Link href="/login">
                    NotiFlow 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-4 text-sm text-zinc-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                  무료 체험
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                  설치 불필요
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                  즉시 시작
                </span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#050505]">
        <div className="container px-4 md:px-6 mx-auto py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-base font-bold text-white">
                  Noti<span className="text-zinc-600">Flow</span>
                </span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed break-keep">
                의료기기·의약품 유통사를 위한
                AI 기반 주문 자동화 플랫폼.
              </p>
            </div>

            <div className="flex gap-16">
              <div>
                <h4 className="text-sm font-semibold text-zinc-400 mb-4">제품</h4>
                <ul className="space-y-2.5 text-sm text-zinc-600">
                  <li>
                    <Link href="#features" className="hover:text-white transition-all duration-500 ease-out">
                      기능 소개
                    </Link>
                  </li>
                  <li>
                    <Link href="#how-it-works" className="hover:text-white transition-all duration-500 ease-out">
                      작동 방식
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-all duration-500 ease-out">
                      대시보드
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-400 mb-4">지원</h4>
                <ul className="space-y-2.5 text-sm text-zinc-600">
                  <li>
                    <Link href="/login" className="hover:text-white transition-all duration-500 ease-out">
                      로그인
                    </Link>
                  </li>
                  <li><span className="cursor-default">이용약관</span></li>
                  <li><span className="cursor-default">개인정보처리방침</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-zinc-700">
              &copy; 2026 NotiFlow. All rights reserved.
            </p>
            <p className="text-xs text-zinc-700">
              Powered by AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
