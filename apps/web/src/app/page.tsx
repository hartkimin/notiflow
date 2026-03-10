import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FileText,
  BarChart2,
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Clock,
  Search,
  Stethoscope,
  Pill,
  Workflow,
  ScanSearch,
  Users2,
  UserCheck,
  Microscope,
  Smartphone,
  Globe,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-blue-100 font-sans">
      {/* Header */}
      <header className="px-4 lg:px-12 h-20 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-200">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 text-white overflow-hidden text-xl">
            <Activity className="h-6 w-6" />
            <div className="absolute inset-0 bg-linear-to-tr from-white/20 to-transparent pointer-events-none" />
          </div>
          <span className="text-xl font-black tracking-tighter text-zinc-900 uppercase">
            Noti<span className="text-blue-600">Flow</span>
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 ml-12">
          <Link href="#features" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">기능</Link>
          <Link href="#how-it-works" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">작동 방식</Link>
          <Link href="#ecosystem" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">모바일 연동</Link>
          <Link href="#benefits" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">장점</Link>
        </nav>

        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-black text-zinc-600 hidden sm:flex uppercase tracking-widest"
            )}
          >
            LOGIN
          </Link>
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-black px-6 border-none rounded-full transition-all hover:scale-105 active:scale-95">
            <Link href="/orders">
              START FREE
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full py-24 lg:py-40 overflow-hidden bg-linear-to-b from-blue-50/50 to-white">
          <div className="absolute inset-0 z-0 opacity-40" 
               style={{ backgroundImage: 'radial-gradient(#3b82f6 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }} />
          
          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="flex flex-col items-start text-left max-w-2xl animate-in fade-in slide-in-from-left-8 duration-1000">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 mb-8 uppercase tracking-widest">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Small Business & Solo Entrepreneur Solution</span>
                </div>

                <h1 className="text-6xl font-black tracking-tighter sm:text-7xl md:text-8xl mb-8 leading-[0.95] text-zinc-950">
                  혼자서도<br />
                  <span className="text-blue-600">완벽한 유통</span>
                </h1>

                <p className="text-xl text-zinc-600 md:text-2xl leading-relaxed mb-12 font-medium tracking-tight">
                  수백 개의 병원 주문을 혼자 처리하시나요? <br className="hidden md:block" />
                  AI 비서가 주문을 받고, 정리하고, 발주까지 처리합니다. 
                  1인 기업도 대기업 수준의 관리력을 갖출 수 있습니다.
                </p>

                <div className="flex flex-col gap-4 w-full sm:w-auto sm:flex-row">
                  <Button asChild size="xl" className="bg-blue-600 hover:bg-blue-700 text-white h-16 px-12 text-xl font-black shadow-2xl shadow-blue-600/30 border-none rounded-2xl transition-all hover:-translate-y-1">
                    <Link href="/orders">
                      지금 무료 시작
                      <ArrowRight className="ml-2 h-6 w-6" />
                    </Link>
                  </Button>
                  <Button asChild size="xl" variant="outline" className="h-16 px-12 text-xl font-black border-zinc-200 hover:bg-zinc-50 text-zinc-950 bg-white rounded-2xl shadow-xl shadow-zinc-100">
                    <Link href="#features">기능 보기</Link>
                  </Button>
                </div>
              </div>

              {/* Hero Image Group - High Quality Supply focus */}
              <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                <div className="absolute -inset-10 bg-blue-400/10 rounded-full blur-[120px] -z-10" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-6 pt-16">
                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white aspect-[3/4] relative group">
                      <img 
                        src="https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?auto=format&fit=crop&q=80&w=1000" 
                        alt="Pharmaceutical Supplies" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
                        <div className="flex items-center gap-3 text-white">
                          <Pill className="h-6 w-6 text-blue-400" />
                          <span className="font-black text-lg tracking-tight uppercase">DRUGS</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white aspect-[3/4] relative group">
                      <img 
                        src="https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=1000" 
                        alt="Medical Equipment Logistics" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
                        <div className="flex items-center gap-3 text-white">
                          <Stethoscope className="h-6 w-6 text-blue-400" />
                          <span className="font-black text-lg tracking-tight uppercase">DEVICES</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white aspect-square bg-blue-600 flex items-center justify-center p-10 text-white transition-transform hover:rotate-3">
                       <div className="text-center">
                          <div className="text-4xl font-black mb-2 leading-none">AUTO</div>
                          <div className="text-sm font-black opacity-80 uppercase tracking-[0.2em]">PARSING AI</div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ECOSYSTEM SECTION - Mobile & Web Connection */}
        <section id="ecosystem" className="w-full py-24 lg:py-32 bg-zinc-950 text-white overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <div className="space-y-12">
                <div className="space-y-6">
                  <span className="text-blue-500 font-black tracking-[0.3em] uppercase text-sm">Seamless Ecosystem</span>
                  <h2 className="text-5xl font-black tracking-tighter sm:text-6xl leading-[1.1]">
                    손안의 알림이<br />
                    <span className="text-blue-400">데이터가 되는 순간</span>
                  </h2>
                  <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-xl">
                    현장에서는 스마트폰 하나로, 사무실에서는 웹 대시보드로. 
                    NotiFlow의 모바일-웹 연동 시스템은 중단 없는 비즈니스를 보장합니다.
                  </p>
                </div>

                <div className="grid gap-8">
                  {[
                    { 
                      icon: <Smartphone className="h-7 w-7" />, 
                      title: "실시간 메시지 캡처 (Android)", 
                      desc: "카카오톡, 문자로 수신된 주문 알림을 감지하여 1초 이내에 서버로 동기화합니다." 
                    },
                    { 
                      icon: <Globe className="h-7 w-7" />, 
                      title: "클라우드 즉시 반영", 
                      desc: "동기화된 메시지는 즉시 AI 파싱을 거쳐 웹 대시보드 주문 목록에 실시간으로 표시됩니다." 
                    },
                    { 
                      icon: <RefreshCw className="h-7 w-7" />, 
                      title: "양방향 상태 업데이트", 
                      desc: "웹에서 주문을 처리하면 모바일 앱에도 즉시 반영되어 어디서든 현황을 파악할 수 있습니다." 
                    }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-2xl">
                        {item.icon}
                      </div>
                      <div className="pt-1">
                        <h4 className="text-xl font-black mb-2 tracking-tight">{item.title}</h4>
                        <p className="text-zinc-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-20 bg-blue-600/20 rounded-full blur-[150px] opacity-50 -z-10" />
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Smartphone Mockup placeholder */}
                  <div className="w-full max-w-[280px] aspect-[9/19] rounded-[3rem] bg-zinc-900 border-[12px] border-zinc-800 shadow-[0_0_80px_rgba(59,130,246,0.2)] overflow-hidden relative shrink-0">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-3xl z-20" />
                     <img 
                        src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800" 
                        alt="Mobile App" 
                        className="w-full h-full object-cover opacity-80"
                     />
                     <div className="absolute inset-0 bg-linear-to-t from-blue-600/40 via-transparent to-transparent" />
                     <div className="absolute bottom-8 left-0 right-0 px-6">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl animate-pulse">
                           <div className="text-[10px] font-black text-blue-400 uppercase mb-1">New Message</div>
                           <div className="text-xs font-bold text-white leading-tight">서울대병원: EK15 20box 주문합니다.</div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Laptop Mockup placeholder */}
                  <div className="flex-1 w-full aspect-video rounded-3xl bg-zinc-900 border-8 border-zinc-800 shadow-2xl overflow-hidden relative">
                     <img 
                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1000" 
                        alt="Web Dashboard" 
                        className="w-full h-full object-cover opacity-60"
                     />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-4">
                           <div className="w-20 h-20 rounded-full bg-blue-600 mx-auto flex items-center justify-center animate-bounce">
                              <RefreshCw className="h-10 w-10 text-white" />
                           </div>
                           <div className="text-2xl font-black uppercase tracking-widest text-white">Cloud Syncing...</div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center mb-24">
              <span className="text-blue-600 font-black tracking-[0.4em] uppercase text-xs mb-6 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100">Core Technologies</span>
              <h2 className="text-5xl font-black tracking-tighter sm:text-6xl text-zinc-950 mb-8 leading-[1.1]">
                1인 관리자의<br className="sm:hidden" /> 초월적인 효율
              </h2>
              <p className="max-w-[800px] text-zinc-500 text-xl font-medium leading-relaxed">
                NotiFlow는 소규모 팀이 겪는 물리적 한계를 인공지능과 자동화로 허물어줍니다. <br className="hidden md:block" />
                대규모 물류 센터 수준의 정밀한 관리를 지금 바로 시작하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {[
                {
                  icon: <ScanSearch className="h-8 w-8" />,
                  title: "지능형 메시지 파싱",
                  description: "비정형 텍스트 주문을 Claude 3.5가 분석하여 품목명, 수량, 규격을 99% 정확도로 데이터화합니다.",
                  color: "bg-blue-600"
                },
                {
                  icon: <Workflow className="h-8 w-8" />,
                  title: "1인 최적화 파이프라인",
                  description: "주문 수집부터 발주서 생성까지 모든 과정을 시스템이 알아서 처리합니다. 당신은 확인만 하세요.",
                  color: "bg-emerald-600"
                },
                {
                  icon: <Microscope className="h-8 w-8" />,
                  title: "식약처 전문 데이터 연동",
                  description: "의료기기 UDI 및 의약품 EDI 코드를 실시간 매칭하여 소규모 업체도 전문적인 사양 관리가 가능합니다.",
                  color: "bg-purple-600"
                },
                {
                  icon: <Search className="h-8 w-8" />,
                  title: "정부 보고 데이터 자동화",
                  description: "의료기기 공급내역 및 KPIS 보고에 필요한 데이터를 시스템이 실시간으로 분류하고 정리합니다.",
                  color: "bg-amber-600"
                },
                {
                  icon: <TrendingUp className="h-8 w-8" />,
                  title: "AI 수요 예측",
                  description: "과거 발주 패턴을 분석하여 품절 방지를 위한 적정 재고와 향후 주문량을 인공지능이 제안합니다.",
                  color: "bg-rose-600"
                },
                {
                  icon: <ShieldCheck className="h-8 w-8" />,
                  title: "엔터프라이즈 보안",
                  description: "Supabase 기반의 철저한 데이터 암호화와 보안 아키텍처로 고객 정보를 완벽하게 보호합니다.",
                  color: "bg-indigo-600"
                }
              ].map((feature, i) => (
                <div key={i} className="group p-12 rounded-[3rem] border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-blue-200 hover:shadow-[0_20px_80px_rgba(59,130,246,0.08)] transition-all duration-500">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-10 shadow-xl text-white transition-transform group-hover:scale-110 duration-500", feature.color)}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-black mb-4 tracking-tight text-zinc-950 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                  <p className="text-zinc-500 leading-relaxed font-medium text-lg">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="w-full py-24 lg:py-32 bg-zinc-50 border-y border-zinc-100">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col lg:flex-row gap-24 items-center">
              <div className="flex-1 space-y-12">
                 <h2 className="text-5xl font-black tracking-tighter sm:text-6xl text-zinc-950 leading-[1.1]">
                  작은 팀을 위한<br />
                  <span className="text-blue-600">거대한 성장 기회</span>
                </h2>
                <div className="grid gap-6">
                   {[
                     { title: "인건비 부담 제로", desc: "주문 정리만을 위한 직원을 따로 고용할 필요가 없습니다. 시스템 하나로 5명분의 업무가 가능합니다." },
                     { title: "영업 중심의 시간 배분", desc: "단순 반복 행정 업무에서 해방되어 병원 원장님들과의 관계 형성과 영업에 더 집중하세요." },
                     { title: "성장을 돕는 통계 분석", desc: "우리 회사에 가장 수익이 되는 거래처와 제품이 무엇인지 데이터로 명확히 파악하고 성장하세요." }
                   ].map((benefit, i) => (
                     <div key={i} className="flex gap-6 p-8 rounded-[2.5rem] bg-white border border-zinc-100 group hover:shadow-2xl hover:shadow-blue-600/5 transition-all duration-300">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white shadow-lg shadow-blue-600/20">
                          <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black mb-2 tracking-tight text-zinc-950">{benefit.title}</h4>
                          <p className="text-zinc-500 font-medium text-lg leading-relaxed">{benefit.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
              
              <div className="flex-1 relative w-full max-w-xl mx-auto">
                <div className="aspect-square rounded-[4rem] overflow-hidden shadow-2xl border-[12px] border-white relative group">
                  <img 
                    src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&q=80&w=1000" 
                    alt="Efficient Medical Logistics" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-blue-900/60 to-transparent mix-blend-multiply opacity-60" />
                </div>
                {/* Floating Badge */}
                <div className="absolute -top-12 -left-12 bg-white p-8 rounded-[2rem] shadow-2xl border border-zinc-100 hidden md:block animate-bounce duration-[4000ms]">
                   <div className="text-4xl font-black text-blue-600 mb-1 leading-none">1,200+</div>
                   <div className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] leading-none">Daily Shipments</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="w-full py-32 lg:py-48 bg-blue-600 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
             <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white opacity-10 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
             <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-black opacity-10 rounded-full blur-[150px] translate-x-1/2 translate-y-1/2" />
          </div>
          
          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto text-white">
              <h2 className="text-6xl font-black tracking-tighter sm:text-8xl mb-12 leading-[0.9] text-white">
                작은 팀의 시대,<br />
                <span className="opacity-80">NotiFlow가 선도합니다.</span>
              </h2>
              <p className="text-2xl text-blue-50 font-bold mb-16 opacity-90 max-w-3xl leading-relaxed">
                혼자서 수천 개의 주문을 처리하는 기적, <br className="hidden md:block" />
                AI 자동화가 당신의 비즈니스 체력을 10배로 키워드립니다.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-8">
                <Link href="/orders" className="h-20 px-16 text-2xl font-black bg-white hover:bg-blue-50 text-blue-600 rounded-3xl shadow-2xl transition-all hover:-translate-y-2 flex items-center justify-center group">
                  무료 체험 시작
                  <ArrowRight className="ml-4 h-8 w-8 transition-transform group-hover:translate-x-2" />
                </Link>
                <Link href="/login" className="h-20 px-16 text-2xl font-black border-2 border-white/30 hover:bg-white/10 text-white bg-transparent rounded-3xl transition-all flex items-center justify-center">
                   관리자 로그인
                </Link>
              </div>
              
              <p className="mt-16 text-blue-200 text-sm font-black uppercase tracking-[0.3em]">
                NO CREDIT CARD · CANCEL ANYTIME · SCALE AS YOU GROW
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 text-zinc-400 py-24 border-t border-zinc-900">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-20 mb-24">
            <div className="col-span-1 md:col-span-2 lg:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 text-2xl">
                  <Activity className="h-7 w-7" />
                </div>
                <span className="text-3xl font-black tracking-tighter text-white uppercase">
                  Noti<span className="text-blue-600">Flow</span>
                </span>
              </Link>
              <p className="max-w-xs text-lg leading-relaxed mb-10 text-zinc-500 font-medium tracking-tight">
                1인 기업과 소규모 유통사의 성장을 위해 <br />
                인공지능 기술을 유통 현장에 이식합니다.
              </p>
              <div className="flex gap-10">
                <Link href="#" className="text-zinc-600 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">TWITTER</Link>
                <Link href="#" className="text-zinc-600 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">LINKEDIN</Link>
                <Link href="#" className="text-zinc-600 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">GITHUB</Link>
              </div>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-10 uppercase tracking-widest">PRODUCT</h4>
              <ul className="space-y-6 text-base font-bold">
                <li><Link href="#features" className="hover:text-blue-400 transition-colors">주문 대시보드</Link></li>
                <li><Link href="#ecosystem" className="hover:text-blue-400 transition-colors">AI 메시지 캡처</Link></li>
                <li><Link href="#ecosystem" className="hover:text-blue-400 transition-colors">모바일 앱 연동</Link></li>
                <li><Link href="/orders" className="hover:text-blue-400 transition-colors">무료 시작하기</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-10 uppercase tracking-widest">COMPANY</h4>
              <ul className="space-y-6 text-base font-bold">
                <li><Link href="/about" className="hover:text-blue-400 transition-colors">소개</Link></li>
                <li><Link href="/blog" className="hover:text-blue-400 transition-colors">블로그</Link></li>
                <li><Link href="/jobs" className="hover:text-blue-400 transition-colors">채용</Link></li>
                <li><Link href="/support" className="hover:text-blue-400 transition-colors">문의하기</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-lg font-black mb-10 uppercase tracking-widest">LEGAL</h4>
              <ul className="space-y-6 text-base font-bold">
                <li><Link href="/support" className="hover:text-blue-400 transition-colors">고객지원</Link></li>
                <li><Link href="/terms" className="hover:text-blue-400 transition-colors">이용약관</Link></li>
                <li><Link href="/privacy" className="hover:text-blue-400 transition-colors">개인정보처리방침</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-12 border-t border-zinc-900/50 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-sm font-black text-zinc-700 uppercase tracking-[0.2em]">
              &copy; 2026 NotiFlow Co., Ltd. (주)노티플로우
            </p>
            <div className="flex gap-4 items-center">
               <div className="w-2 h-2 rounded-full bg-emerald-500" />
               <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
