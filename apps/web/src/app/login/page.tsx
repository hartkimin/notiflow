import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Zap, ShieldCheck, Cpu, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 bg-background">
      {/* Left Side: Visual & Marketing */}
      <div className="hidden relative bg-zinc-950 lg:block overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1631217818242-203938be4524?auto=format&fit=crop&q=80&w=2070" 
            alt="Medical Professional" 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-linear-to-tr from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 text-primary-foreground group-hover:scale-105 transition-transform">
              <Zap className="h-6 w-6 fill-current" />
            </div>
            <span>Noti<span className="text-primary">Flow</span></span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-extrabold leading-tight mb-6">
              주문 관리의 새로운 기준,<br />
              <span className="text-primary">NotiFlow</span>와 함께하세요.
            </h2>
            <p className="text-lg text-zinc-400 mb-10 leading-relaxed">
              AI 기반 자동 파싱 시스템으로 비즈니스 효율을 극대화하고 
              주문 누락 없는 완벽한 프로세스를 경험하세요.
            </p>

            <div className="grid gap-6">
              {[
                { icon: <MessageSquare className="h-5 w-5" />, text: "실시간 메시지 주문 자동 파싱" },
                { icon: <Cpu className="h-5 w-5" />, text: "온디바이스 AI 기반 안전한 데이터 처리" },
                { icon: <ShieldCheck className="h-5 w-5" />, text: "식약처 API 연동 및 정부 보고 관리" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-sm font-medium text-zinc-300">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-primary">
                    {item.icon}
                  </div>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm text-zinc-500">
            &copy; 2026 NotiFlow. All rights reserved.
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      </div>

      {/* Right Side: Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 relative overflow-hidden">
        {/* Mobile Background Decoration */}
        <div className="lg:hidden absolute inset-0 -z-10 bg-muted/30" />
        
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex flex-col items-center text-center space-y-3">
             <Link href="/" className="lg:hidden flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
                <span className="text-2xl font-bold tracking-tight">NotiFlow</span>
             </Link>
             <h1 className="text-3xl font-black tracking-tight">반갑습니다!</h1>
             <p className="text-muted-foreground">
               계정 정보를 입력하여 대시보드에 접속하세요.
             </p>
          </div>

          <div className="p-1 rounded-2xl bg-muted/50 border border-border/50 shadow-sm">
            <div className="p-6 sm:p-8 bg-background rounded-[calc(1rem-4px)] shadow-xs">
              <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">폼 불러오는 중...</div>}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              계정이 필요하시면 관리자에게 문의하세요.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/50">
               <Link href="/" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">홈으로</Link>
               <span className="text-zinc-300 text-xs">|</span>
               <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">고객 지원</Link>
               <span className="text-zinc-300 text-xs">|</span>
               <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">개인정보처리방침</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
