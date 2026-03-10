import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Zap, ShieldCheck, Cpu, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 bg-white">
      {/* Left Side: Visual & Marketing (Keep dark for contrast if desired, or make it light) */}
      {/* Making it a vibrant blue for consistent branding but clear visibility */}
      <div className="hidden relative bg-blue-600 lg:block overflow-hidden">
        {/* Background Image with optimized overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1576091160550-217359f47f60?auto=format&fit=crop&q=80&w=2070" 
            alt="Medical Professional" 
            className="w-full h-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-linear-to-br from-blue-700 via-blue-600/80 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <Link href="/" className="flex items-center gap-2.5 font-black text-2xl tracking-tight group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xl text-blue-600 group-hover:scale-105 transition-transform">
              <Zap className="h-6 w-6 fill-current" />
            </div>
            <span>NotiFlow</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-black leading-tight mb-8">
              의료 유통의 혁신,<br />
              <span className="text-blue-100 underline decoration-blue-400 decoration-4 underline-offset-8">NotiFlow</span> 대시보드
            </h2>
            <p className="text-lg text-blue-50/80 mb-12 leading-relaxed font-bold">
              AI 자동 파싱 시스템으로 주문 처리 시간을 85% 단축하고 
              데이터 기반의 스마트한 유통 환경을 구축하세요.
            </p>

            <div className="grid gap-6">
              {[
                { icon: <MessageSquare className="h-5 w-5" />, text: "실시간 메시지 자동 주문 파싱" },
                { icon: <Cpu className="h-5 w-5" />, text: "온디바이스 AI 기반 보안 데이터 처리" },
                { icon: <ShieldCheck className="h-5 w-5" />, text: "식약처 API 연동 및 공급내역 보고" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-base font-black text-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm text-white">
                    {item.icon}
                  </div>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs font-bold text-blue-200 uppercase tracking-widest">
            &copy; 2026 NotiFlow. Leading Medical Intelligence.
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Right Side: Login Form - High Visibility Light Theme */}
      <div className="flex items-center justify-center p-8 lg:p-12 relative bg-white">
        {/* Subtle background pattern for mobile */}
        <div className="lg:hidden absolute inset-0 -z-10 bg-blue-50/30" />
        
        <div className="w-full max-w-[420px] space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex flex-col items-center text-center space-y-4">
             <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
                <span className="text-3xl font-black tracking-tight text-zinc-900">NotiFlow</span>
             </Link>
             <h1 className="text-4xl font-black tracking-tight text-zinc-900">환영합니다!</h1>
             <p className="text-zinc-500 font-bold">
               관리자 계정으로 대시보드에 접속하세요.
             </p>
          </div>

          <div className="p-1 rounded-3xl bg-zinc-50 border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="p-8 sm:p-10 bg-white rounded-[1.4rem] shadow-xs">
              <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-zinc-400 font-bold">인증 모듈 불러오는 중...</div>}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <div className="space-y-6 text-center">
            <p className="text-sm text-zinc-500 font-bold">
              계정이 필요하시면 <span className="text-blue-600">시스템 관리자</span>에게 문의하세요.
            </p>
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-zinc-100">
               <Link href="/" className="text-xs font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Home</Link>
               <span className="text-zinc-200 text-xs">|</span>
               <Link href="#" className="text-xs font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Support</Link>
               <span className="text-zinc-200 text-xs">|</span>
               <Link href="#" className="text-xs font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
