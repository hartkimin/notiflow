import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Cpu,
  FileText,
  BarChart2,
  MessageSquare,
  Zap,
  ArrowRight,
  Bot,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="px-4 lg:px-12 h-20 flex items-center bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25 text-primary-foreground overflow-hidden">
            <Zap className="h-5 w-5 fill-current" />
            <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent pointer-events-none" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Noti<span className="text-primary font-extrabold">Flow</span>
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 ml-12">
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">기능</Link>
          <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">작동 방식</Link>
          <Link href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">장점</Link>
        </nav>

        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-medium hidden sm:flex"
            )}
          >
            로그인
          </Link>
          <Button asChild size="sm" className="shadow-lg shadow-primary/20 font-bold px-5">
            <Link href="/orders">
              무료 시작하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full py-20 lg:py-32 overflow-hidden bg-zinc-950 text-white">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-217359f47f60?auto=format&fit=crop&q=80&w=2070" 
              alt="Medical Center"
              className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-linear-to-b from-zinc-950/80 via-zinc-950/40 to-zinc-950" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
          </div>

          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-sm font-medium text-blue-300 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <Bot className="h-4 w-4" />
                <span>Next-Gen Medical Supply AI Automation</span>
              </div>

              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
                메시지가 오면,<br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">주문이 자동 완성</span>
              </h1>

              <p className="max-w-[720px] text-lg text-zinc-400 md:text-xl leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                카카오톡, 문자로 들어오는 비정형 주문을 AI가 실시간 파싱합니다.
                의료 소모품 관리의 번거로움을 자동화로 해결하세요.
              </p>

              <div className="flex flex-col gap-4 min-[400px]:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
                <Button asChild size="xl" className="h-14 px-8 text-lg font-bold shadow-2xl shadow-primary/30">
                  <Link href="/orders">
                    지금 무료 체험하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline" className="h-14 px-8 text-lg font-bold border-white/20 hover:bg-white/10 text-white backdrop-blur-sm">
                  <Link href="#features">기능 상세 보기</Link>
                </Button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 pt-24 w-full animate-in fade-in slide-in-from-bottom-20 duration-1000 delay-700">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-bold">99%</span>
                  <span className="text-sm text-zinc-500 uppercase tracking-widest font-semibold">AI 파싱 정확도</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-bold">85%</span>
                  <span className="text-sm text-zinc-500 uppercase tracking-widest font-semibold">업무 시간 단축</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-bold">Realtime</span>
                  <span className="text-sm text-zinc-500 uppercase tracking-widest font-semibold">실시간 동기화</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-bold">MFDS</span>
                  <span className="text-sm text-zinc-500 uppercase tracking-widest font-semibold">식약처 API 연동</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Trust logos could go here */}

        {/* Features Section */}
        <section id="features" className="w-full py-24 bg-background">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center mb-20">
              <span className="text-primary font-bold tracking-widest uppercase text-sm mb-4">Core Capabilities</span>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl mb-6">
                의료 현장을 위한 맞춤형 기능
              </h2>
              <p className="max-w-[800px] text-muted-foreground text-lg md:text-xl">
                단순한 주문 관리를 넘어, AI 기술로 비즈니스의 효율성을 극대화합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <MessageSquare className="h-8 w-8" />,
                  title: "AI 메시지 파싱",
                  description: "비정형 텍스트 메시지를 Claude AI가 분석하여 품목, 수량, 규격을 실시간으로 추출합니다.",
                  color: "bg-blue-500/10 text-blue-600"
                },
                {
                  icon: <FileText className="h-8 w-8" />,
                  title: "주문 프로세스 자동화",
                  description: "추출된 데이터를 기반으로 즉시 주문서를 생성하고, 배송 및 수량 관리를 자동화합니다.",
                  color: "bg-emerald-500/10 text-emerald-600"
                },
                {
                  icon: <Search className="h-8 w-8" />,
                  title: "식약처 통합 검색",
                  description: "MFDS API를 통해 의약품 및 의료기기 허가 정보를 실시간으로 조회하고 관리합니다.",
                  color: "bg-amber-500/10 text-amber-600"
                },
                {
                  icon: <BarChart2 className="h-8 w-8" />,
                  title: "실시간 비즈니스 대시보드",
                  description: "매출 리포트, 재고 현황, 거래처별 통계를 직관적인 차트로 한눈에 파악하세요.",
                  color: "bg-indigo-500/10 text-indigo-600"
                },
                {
                  icon: <Cpu className="h-8 w-8" />,
                  title: "모바일 온디바이스 AI",
                  description: "모바일 앱에서도 Gemma 3N 모델을 통해 네트워크 연결 없이도 안전하게 분석을 수행합니다.",
                  color: "bg-purple-500/10 text-purple-600"
                },
                {
                  icon: <ShieldCheck className="h-8 w-8" />,
                  title: "엔터프라이즈 보안 (RLS)",
                  description: "Supabase Row-Level Security를 통해 병원 및 환자 데이터를 철저하게 보호합니다.",
                  color: "bg-rose-500/10 text-rose-600"
                }
              ].map((feature, i) => (
                <div key={i} className="group relative p-8 rounded-3xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm", feature.color)}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Visual focus */}
        <section id="how-it-works" className="w-full py-24 bg-muted/30 border-y">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/10 rounded-[2rem] blur-2xl -z-10" />
                <div className="rounded-[2rem] border overflow-hidden shadow-2xl bg-background">
                  <div className="bg-muted px-4 py-3 flex items-center gap-2 border-b">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="mx-auto text-xs font-medium text-muted-foreground">NotiFlow Dashboard Preview</div>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=2070" 
                    alt="Dashboard UI" 
                    className="w-full aspect-video object-cover"
                  />
                </div>
                {/* Float elements */}
                <div className="absolute -top-10 -right-10 hidden md:block animate-bounce duration-[3000ms]">
                   <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xl border flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Order Processed</div>
                        <div className="text-sm font-bold">ORD-202603-012</div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">Simple Workflow</div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                  복잡한 과정을 3단계로 간소화
                </h2>
                
                <div className="space-y-6">
                  {[
                    { step: "01", title: "메시지 캡처", desc: "모바일 앱이 알림을 감지하여 실시간으로 서버에 전송합니다." },
                    { step: "02", title: "AI 데이터 추출", desc: "Claude 3.5 Sonnet 모델이 품목, 수량, 거래처를 자동 분석합니다." },
                    { step: "03", title: "주문 자동 생성", desc: "확정된 데이터로 즉시 주문서가 생성되고 관계자에게 알림이 갑니다." }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="text-4xl font-black text-primary/20 group-hover:text-primary/40 transition-colors">{step.step}</div>
                      <div>
                        <h4 className="text-xl font-bold mb-1">{step.title}</h4>
                        <p className="text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button asChild size="lg" className="mt-4">
                  <Link href="/orders">워크플로우 시작하기</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="w-full py-24 bg-background overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="flex-1 order-2 md:order-1">
                 <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl mb-8">
                  왜 NotiFlow인가요?
                </h2>
                <div className="grid gap-6">
                   {[
                     { icon: <TrendingUp className="h-6 w-6" />, title: "매출 손실 방지", desc: "누락되는 메시지 주문을 방지하여 매출 기회를 극대화합니다." },
                     { icon: <Clock className="h-6 w-6" />, title: "비용 절감", desc: "수동 데이터 입력 인건비를 80% 이상 절감할 수 있습니다." },
                     { icon: <Zap className="h-6 w-6" />, title: "빠른 대응", desc: "실시간 주문 처리를 통해 고객 만족도를 높이고 빠른 배송을 보장합니다." }
                   ].map((benefit, i) => (
                     <div key={i} className="flex gap-4 p-5 rounded-2xl hover:bg-muted/50 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                          {benefit.icon}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold">{benefit.title}</h4>
                          <p className="text-muted-foreground">{benefit.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
              <div className="flex-1 order-1 md:order-2 relative">
                <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src="https://images.unsplash.com/photo-1631217818242-203938be4524?auto=format&fit=crop&q=80&w=2070" 
                    alt="Professional Medical Environment" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-primary/40 to-transparent mix-blend-multiply" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full py-24 bg-zinc-950 text-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">실제 사용자 목소리</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { quote: "카톡 주문 확인하고 엑셀에 옮기는 작업만 하루 2시간이었는데, 이제는 검토 버튼만 누르면 됩니다.", author: "메디컬 클리닉 관리실장", initials: "K" },
                { quote: "AI가 품목명을 기가 막히게 알아듣습니다. 별칭 학습 기능 덕분에 우리만의 언어도 찰떡같이 매칭되네요.", author: "의료기기 총판 대표", initials: "L" },
                { quote: "식약처 API 연동으로 제품 정보를 따로 찾을 필요가 없어서 너무 편합니다. 정부 신고도 한 번에 해결됩니다.", author: "병원 원무과 과장", initials: "P" }
              ].map((t, i) => (
                <div key={i} className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-between">
                   <p className="text-lg italic text-zinc-300 mb-8 leading-relaxed">"{t.quote}"</p>
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                        {t.initials}
                      </div>
                      <div>
                        <div className="font-bold">{t.author}</div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-32 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
             <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
             <div className="absolute bottom-0 right-0 w-96 h-96 bg-black rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto text-primary-foreground">
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl mb-8 leading-tight">
                지금 NotiFlow로<br />업무의 흐름을 바꾸세요
              </h2>
              <p className="text-xl opacity-90 mb-12">
                설치 후 5분이면 AI 자동화의 힘을 경험할 수 있습니다.<br className="hidden md:block" />
                성공적인 의료 비즈니스를 위한 최선의 선택.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="xl" variant="secondary" className="h-16 px-10 text-xl font-bold shadow-2xl">
                  <Link href="/orders">
                    무료로 시작하기
                    <ArrowRight className="ml-2 h-6 w-6" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline" className="h-16 px-10 text-xl font-bold bg-white/10 border-white/20 hover:bg-white/20 text-white">
                   <Link href="/login">관리자 로그인</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 text-zinc-500 py-16 border-t border-white/5">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-6">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4 fill-current" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">
                  Noti<span className="text-primary">Flow</span>
                </span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed mb-6 text-zinc-400">
                의료 소모품 주문 알림 자동화 및 관리 시스템.<br />
                AI 기술을 통한 의료 현장의 혁신을 꿈꿉니다.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">제품</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="#" className="hover:text-primary transition-colors">주문 관리</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">메시지 분석</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">리포트</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">API 연동</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">회사</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="#" className="hover:text-primary transition-colors">소개</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">블로그</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">채용</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">법적 고지</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="#" className="hover:text-primary transition-colors">이용약관</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">개인정보처리방침</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>&copy; 2026 NotiFlow. All rights reserved. (주)노티플로우</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white">Twitter</Link>
              <Link href="#" className="hover:text-white">LinkedIn</Link>
              <Link href="#" className="hover:text-white">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
