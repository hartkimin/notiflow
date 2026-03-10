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
  Stethoscope,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-blue-100">
      {/* Header */}
      <header className="px-4 lg:px-12 h-20 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-200">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 text-white overflow-hidden">
            <Zap className="h-5 w-5 fill-current" />
            <div className="absolute inset-0 bg-linear-to-tr from-white/20 to-transparent pointer-events-none" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900">
            Noti<span className="text-blue-600 font-extrabold">Flow</span>
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 ml-12">
          <Link href="#features" className="text-sm font-semibold text-zinc-500 hover:text-blue-600 transition-colors">기능</Link>
          <Link href="#how-it-works" className="text-sm font-semibold text-zinc-500 hover:text-blue-600 transition-colors">작동 방식</Link>
          <Link href="#benefits" className="text-sm font-semibold text-zinc-500 hover:text-blue-600 transition-colors">장점</Link>
        </nav>

        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-bold text-zinc-600 hidden sm:flex"
            )}
          >
            로그인
          </Link>
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-bold px-5 border-none">
            <Link href="/orders">
              무료 시작하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section - Light/Clean/Professional */}
        <section className="relative w-full py-20 lg:py-32 overflow-hidden bg-linear-to-b from-blue-50/50 to-white">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 z-0 opacity-40" 
               style={{ backgroundImage: 'radial-gradient(#3b82f6 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
          
          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-start text-left max-w-2xl animate-in fade-in slide-in-from-left-8 duration-1000">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 mb-8">
                  <Bot className="h-4 w-4" />
                  <span>AI 기반 의약품·의료기기 자동 주문 플랫폼</span>
                </div>

                <h1 className="text-5xl font-black tracking-tight sm:text-6xl md:text-7xl mb-8 leading-[1.1] text-zinc-900">
                  메시지 하나로<br />
                  <span className="text-blue-600">주문을 완성하다</span>
                </h1>

                <p className="text-lg text-zinc-600 md:text-xl leading-relaxed mb-10 font-medium">
                  카카오톡, 문자로 들어오는 의약품 및 의료기기 주문을 AI가 실시간 파싱합니다. 
                  복잡한 수동 입력을 자동화로 해결하고 비즈니스에 집중하세요.
                </p>

                <div className="flex flex-col gap-4 w-full sm:w-auto sm:flex-row">
                  <Button asChild size="xl" className="bg-blue-600 hover:bg-blue-700 text-white h-14 px-10 text-lg font-black shadow-xl shadow-blue-600/25 border-none">
                    <Link href="/orders">
                      지금 무료 체험하기
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="xl" variant="outline" className="h-14 px-10 text-lg font-bold border-zinc-200 hover:bg-zinc-50 text-zinc-900 bg-white">
                    <Link href="#features">기능 살펴보기</Link>
                  </Button>
                </div>

                <div className="flex items-center gap-8 pt-16">
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-blue-600">99.9%</span>
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">파싱 정확도</span>
                  </div>
                  <div className="h-10 w-px bg-zinc-200" />
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-blue-600">85%</span>
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">업무 시간 단축</span>
                  </div>
                </div>
              </div>

              {/* Hero Image Group - Prominent Medical focus */}
              <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                <div className="absolute -inset-4 bg-blue-200/30 rounded-[3rem] blur-3xl -z-10" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4 pt-12">
                    <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] relative">
                      <img 
                        src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800" 
                        alt="Drugs/Pharmaceuticals" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                        <div className="flex items-center gap-2 text-white">
                          <Pill className="h-5 w-5" />
                          <span className="font-bold">의약품 관리</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] relative">
                      <img 
                        src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800" 
                        alt="Medical Device" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                        <div className="flex items-center gap-2 text-white">
                          <Stethoscope className="h-5 w-5" />
                          <span className="font-bold">의료기기 발주</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-video bg-blue-600 flex items-center justify-center p-8 text-white">
                       <div className="text-center">
                          <div className="text-2xl font-black mb-1">Real-time</div>
                          <div className="text-xs font-bold opacity-80 uppercase tracking-tighter">AI Processing</div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - High Contrast */}
        <section id="features" className="w-full py-24 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center mb-20">
              <span className="text-blue-600 font-black tracking-widest uppercase text-xs mb-4 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">Core Tech</span>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl mb-6 text-zinc-900">
                의료 비즈니스를 위한 최적의 도구
              </h2>
              <p className="max-w-[800px] text-zinc-500 text-lg md:text-xl font-medium">
                NotiFlow는 의약품 유통업체와 병원 원무과의 실무 환경을 철저히 분석하여 설계되었습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <MessageSquare className="h-8 w-8" />,
                  title: "AI 메시지 파싱",
                  description: "비정형 텍스트 주문을 분석하여 품목명, 수량, 규격을 실시간으로 추출하고 데이터화합니다.",
                  color: "bg-blue-600 text-white shadow-blue-200"
                },
                {
                  icon: <Stethoscope className="h-8 w-8" />,
                  title: "의료기기 UDI 매칭",
                  description: "의료기기 표준코드(UDI)와 연동하여 정확한 제품 사양과 허가 정보를 자동으로 매칭합니다.",
                  color: "bg-emerald-600 text-white shadow-emerald-200"
                },
                {
                  icon: <Pill className="h-8 w-8" />,
                  title: "의약품 EDI 연동",
                  description: "보험코드(EDI) 및 주성분 정보를 기반으로 복잡한 의약품 목록을 스마트하게 관리합니다.",
                  color: "bg-purple-600 text-white shadow-purple-200"
                },
                {
                  icon: <Search className="h-8 w-8" />,
                  title: "식약처 통합 검색",
                  description: "별도의 사이트 접속 없이 대시보드 내에서 MFDS 공공데이터를 즉시 조회할 수 있습니다.",
                  color: "bg-amber-600 text-white shadow-amber-200"
                },
                {
                  icon: <TrendingUp className="h-8 w-8" />,
                  title: "재고 및 수요 예측",
                  description: "과거 주문 패턴을 분석하여 적정 재고 유지와 향후 발주 수요를 인공지능이 예측합니다.",
                  color: "bg-rose-600 text-white shadow-rose-200"
                },
                {
                  icon: <ShieldCheck className="h-8 w-8" />,
                  title: "정부 보고 간소화",
                  description: "KPIS 및 의료기기 공급내역 보고에 필요한 데이터를 자동으로 정리하여 시간을 절약합니다.",
                  color: "bg-indigo-600 text-white shadow-indigo-200"
                }
              ].map((feature, i) => (
                <div key={i} className="group p-10 rounded-[2rem] border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-600/5 transition-all duration-300">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-xl", feature.color)}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-black mb-4 group-hover:text-blue-600 transition-colors text-zinc-900">{feature.title}</h3>
                  <p className="text-zinc-500 leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - High Contrast / Clean */}
        <section id="how-it-works" className="w-full py-24 bg-zinc-50 border-y border-zinc-100">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute -inset-10 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10" />
                <div className="rounded-[2.5rem] border-8 border-white shadow-2xl overflow-hidden bg-white">
                  <div className="bg-zinc-100 px-6 py-4 flex items-center gap-3 border-b border-zinc-200">
                    <div className="flex gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="mx-auto text-xs font-black text-zinc-400 uppercase tracking-widest">Dashboard Interface</div>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1551288049-bbbda536339a?auto=format&fit=crop&q=80&w=2070" 
                    alt="Data Dashboard" 
                    className="w-full aspect-square object-cover"
                  />
                </div>
                
                {/* Floating Stats UI */}
                <div className="absolute -bottom-8 -right-8 bg-white p-6 rounded-3xl shadow-2xl border border-zinc-100 animate-in zoom-in-90 duration-700 delay-500">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-zinc-400 uppercase">Daily Volume</div>
                        <div className="text-xl font-black text-zinc-900">+124 Orders</div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 space-y-10">
                <div className="inline-block rounded-full bg-blue-600 px-5 py-2 text-xs font-black text-white uppercase tracking-wider">Workflow Optimization</div>
                <h2 className="text-4xl font-black tracking-tight sm:text-5xl text-zinc-900 leading-tight">
                  더 이상 일일이<br />입력할 필요가 없습니다
                </h2>
                
                <div className="space-y-8">
                  {[
                    { step: "01", title: "주문 메시지 감지", desc: "병원의 카카오톡 또는 문자 알림을 모바일 앱이 실시간으로 캡처합니다." },
                    { step: "02", title: "AI 지능형 분석", desc: "비정형 주문 내역에서 제품명과 수량을 추출하고 등록된 품목과 매칭합니다." },
                    { step: "03", title: "클릭 한 번으로 발주", desc: "검증된 데이터를 바탕으로 자동 생성된 주문서를 확인 후 즉시 처리합니다." }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-8 group items-start">
                      <div className="text-5xl font-black text-blue-100 group-hover:text-blue-200 transition-colors leading-none shrink-0">{step.step}</div>
                      <div className="pt-2">
                        <h4 className="text-2xl font-black mb-2 text-zinc-900">{step.title}</h4>
                        <p className="text-zinc-500 font-medium leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button asChild size="xl" className="mt-8 bg-zinc-900 hover:bg-black text-white rounded-2xl h-14 px-10 border-none shadow-xl shadow-zinc-200 font-black">
                  <Link href="/orders">워크플로우 자동화 시작</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section - Visual clarity focus */}
        <section id="benefits" className="w-full py-24 bg-white overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col lg:flex-row gap-20 items-center">
              <div className="flex-1 space-y-10">
                 <h2 className="text-4xl font-black tracking-tight sm:text-5xl text-zinc-900">
                  NotiFlow가 선사하는<br />업무의 자유
                </h2>
                <div className="grid gap-4">
                   {[
                     { title: "누락 없는 정밀한 관리", desc: "수많은 알림 속에서 주문을 놓칠 걱정이 사라집니다." },
                     { title: "혁신적인 업무 속도", desc: "1시간 걸리던 주문 정리가 단 5분으로 단축됩니다." },
                     { title: "데이터 기반의 의사결정", desc: "정확한 매출 및 제품 통계로 비즈니스 전략을 수립하세요." }
                   ].map((benefit, i) => (
                     <div key={i} className="flex gap-5 p-8 rounded-[2rem] bg-zinc-50 border border-zinc-100 group hover:bg-blue-600 hover:border-blue-600 transition-all duration-300">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white group-hover:bg-white group-hover:text-blue-600 transition-colors">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black mb-1 text-zinc-900 group-hover:text-white transition-colors">{benefit.title}</h4>
                          <p className="text-zinc-500 font-medium group-hover:text-blue-50 transition-colors">{benefit.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
              
              <div className="flex-1 relative w-full max-w-xl mx-auto">
                <div className="aspect-square rounded-[3rem] overflow-hidden shadow-2xl border-8 border-zinc-50">
                  <img 
                    src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=1000" 
                    alt="Professional Medical Environment" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-blue-900/40 to-transparent mix-blend-multiply" />
                </div>
                {/* Floating Card */}
                <div className="absolute -top-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl border border-zinc-100 hidden md:block">
                   <div className="text-3xl font-black text-blue-600 mb-1">800+</div>
                   <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Registered Clinics</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action - Energetic / High Contrast */}
        <section className="w-full py-32 bg-blue-600 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
             <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-white opacity-10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
             <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-black opacity-10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
          </div>
          
          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              <h2 className="text-5xl font-black tracking-tight sm:text-7xl mb-10 leading-[1.1] text-white">
                지금 바로 시작하세요.<br />
                스마트한 주문 관리의 시작.
              </h2>
              <p className="text-xl text-blue-50 font-bold mb-14 opacity-90 max-w-2xl">
                설치 후 즉시 AI 자동 파싱의 힘을 경험하실 수 있습니다.<br className="hidden md:block" />
                의료 현장의 디지털 전환, NotiFlow가 함께합니다.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6">
                <Button asChild size="xl" className="bg-white hover:bg-blue-50 text-blue-600 rounded-2xl h-18 px-12 text-2xl font-black shadow-2xl border-none">
                  <Link href="/orders">
                    무료 체험 시작하기
                    <ArrowRight className="ml-3 h-7 w-7" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline" className="h-18 px-12 text-2xl font-black border-white/30 hover:bg-white/10 text-white bg-transparent">
                   <Link href="/login">관리자 로그인</Link>
                </Button>
              </div>
              
              <p className="mt-12 text-blue-200 text-sm font-bold uppercase tracking-widest">
                No Credit Card Required · Unlimited Test Access
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Professional / High Contrast */}
      <footer className="bg-zinc-950 text-zinc-400 py-20">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-16 mb-20">
            <div className="col-span-1 md:col-span-2 lg:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
                <span className="text-2xl font-black tracking-tight text-white">
                  Noti<span className="text-blue-600">Flow</span>
                </span>
              </Link>
              <p className="max-w-xs text-base leading-relaxed mb-8 text-zinc-400 font-medium">
                의약품 및 의료기기 주문 자동화 시스템.<br />
                AI와 데이터를 통해 의료 유통의 미래를 혁신합니다.
              </p>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-8">제품</h4>
              <ul className="space-y-5 text-sm font-bold">
                <li><Link href="#" className="hover:text-blue-400 transition-colors">주문 관리 대시보드</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">AI 메시지 분석</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">식약처 API 연동</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">모바일 앱</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-8">회사</h4>
              <ul className="space-y-5 text-sm font-bold">
                <li><Link href="#" className="hover:text-blue-400 transition-colors">소개</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">블로그</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">채용</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">문의하기</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-8">지원</h4>
              <ul className="space-y-5 text-sm font-bold">
                <li><Link href="#" className="hover:text-blue-400 transition-colors">고객지원 센터</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">이용약관</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors">개인정보처리방침</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
              &copy; 2026 NotiFlow Co., Ltd. All rights reserved. (주)노티플로우
            </p>
            <div className="flex gap-8">
              <Link href="#" className="text-zinc-600 hover:text-white transition-colors"><span className="sr-only">Twitter</span><span className="text-xs font-black">TW</span></Link>
              <Link href="#" className="text-zinc-600 hover:text-white transition-colors"><span className="sr-only">LinkedIn</span><span className="text-xs font-black">LI</span></Link>
              <Link href="#" className="text-zinc-600 hover:text-white transition-colors"><span className="sr-only">GitHub</span><span className="text-xs font-black">GH</span></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
