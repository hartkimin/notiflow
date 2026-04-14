"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { LoginForm } from "@/components/login-form";
import {
  MessageSquare,
  BarChart2,
  Smartphone,
  Shield,
  Mail,
  X,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

/* ─── Contact Modal ──────────────────────────────────────── */
function ContactModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <motion.div
          className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full"
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#e8f0fe] mb-5">
            <Mail className="w-6 h-6 text-[#1a73e8]" />
          </div>
          <h3 className="text-xl font-semibold text-[#202124] mb-2">문의하기</h3>
          <p className="text-[#5f6368] text-sm leading-relaxed mb-5">
            서비스 이용 또는 계정 관련 문의는 아래 이메일로 연락주세요.
          </p>

          <a
            href="mailto:jinzhangxun@gmail.com"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f8f9fa] hover:bg-[#e8f0fe] border border-[#dadce0] hover:border-[#1a73e8]/40 transition-all duration-200 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#5f6368] mb-0.5">이메일 문의</p>
              <p className="text-sm font-medium text-[#1a73e8] group-hover:underline truncate">
                jinzhangxun@gmail.com
              </p>
            </div>
          </a>

          <div className="mt-5 flex items-center gap-2 text-xs text-[#5f6368]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#34a853] flex-shrink-0" />
            <span>영업일 기준 1~2일 내에 답변 드립니다.</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Ripple hook ────────────────────────────────────────── */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = (e: React.MouseEvent) => {
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;
    r.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.35);
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      transform:scale(0);animation:ripple-kf 0.55s ease-out forwards;pointer-events:none`;
    btn.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
  };
  return { ref, trigger };
}

/* ─── Floating notification badge ───────────────────────── */
function FloatingBadge({
  text,
  delay,
  className,
}: {
  text: string;
  delay: number;
  className: string;
}) {
  return (
    <motion.div
      className={`absolute ${className} bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: [10, 0, -4, 0] }}
      transition={{
        opacity: { duration: 0.4, delay },
        y: { duration: 3, delay, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
      }}
      style={{ boxShadow: "0 4px 20px rgba(26,115,232,0.15), 0 1px 4px rgba(0,0,0,0.08)" }}
    >
      <div className="w-2 h-2 rounded-full bg-[#34a853] flex-shrink-0" />
      <span className="text-xs font-medium text-[#202124] whitespace-nowrap">{text}</span>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function LoginPage() {
  const [showContact, setShowContact] = useState(false);
  const ripple = useRipple();

  const features = [
    {
      icon: MessageSquare,
      title: "메시지 자동 분석",
      desc: "카카오톡 · SMS 주문 메시지에서 품목·수량·거래처를 즉시 추출합니다",
      color: "#1a73e8",
      bg: "#e8f0fe",
    },
    {
      icon: BarChart2,
      title: "매출 현황 한눈에",
      desc: "거래처별 주문 내역과 월별 추이를 대시보드에서 실시간으로 확인합니다",
      color: "#34a853",
      bg: "#e6f4ea",
    },
    {
      icon: Smartphone,
      title: "모바일 실시간 동기화",
      desc: "Android 앱에서 수신된 알림이 웹 대시보드에 자동으로 반영됩니다",
      color: "#fbbc04",
      bg: "#fef7e0",
    },
    {
      icon: Shield,
      title: "식약처 DB 연동",
      desc: "의료기기 품목허가 정보와 KPIS 유통신고를 시스템에서 바로 처리합니다",
      color: "#ea4335",
      bg: "#fce8e6",
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes ripple-kf {
          to { transform: scale(1); opacity: 0; }
        }
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .login-page * { font-family: 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif; }
        .anim-up-1 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
        .anim-up-2 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        .anim-up-3 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
        .anim-up-4 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
        .anim-up-5 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.45s both; }
        .anim-up-6 { animation: slideUpIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
        .dot-pulse { animation: dotPulse 2s ease-in-out infinite; }
      `}</style>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      <div className="login-page w-full lg:grid lg:grid-cols-5 min-h-[100dvh]">

        {/* ── Left panel ── */}
        <div
          className="hidden lg:flex lg:col-span-3 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 50%, #f0f4ff 100%)" }}
        >
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(26,115,232,0.08) 0%, transparent 70%)" }}
            />
            <div
              className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(52,168,83,0.07) 0%, transparent 70%)" }}
            />
            {/* Grid pattern */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="lg" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1a73e8" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#lg)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full w-full p-10 lg:p-14 xl:p-16">
            {/* Logo */}
            <div className="anim-up-1">
              <Link href="/" className="flex items-center gap-2.5 group w-fit">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
                  style={{ background: "#1a73e8" }}
                >
                  <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white">
                    <path d="M10 2L3 7v11h14V7L10 2zm0 2.5l6 4.5v9H4V9l6-4.5z" />
                    <path d="M8 12h4v5H8z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-[#202124]">
                  Noti<span style={{ color: "#1a73e8" }}>Flow</span>
                </span>
              </Link>
            </div>

            {/* Main content */}
            <div className="space-y-10 max-w-xl">
              <div className="anim-up-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                  style={{ background: "#e8f0fe", color: "#1a73e8" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] dot-pulse" />
                  의료기기 유통 관리 플랫폼
                </span>
              </div>

              <div className="space-y-4 anim-up-3">
                <h1 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight text-[#202124] break-keep">
                  주문부터 납품까지,
                  <br />
                  <span style={{ color: "#1a73e8" }}>한눈에</span>
                </h1>
                <p className="text-[#5f6368] text-lg leading-relaxed break-keep max-w-md">
                  카카오톡 메시지 수신, 주문 자동 분석, 거래처 관리, 식약처 연동까지.
                  의료기기 유통에 필요한 모든 업무를 하나로 잇습니다.
                </p>
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-2 gap-3 anim-up-4">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="bg-white rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 cursor-default"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl mb-3"
                      style={{ background: f.bg }}
                    >
                      <f.icon className="h-4 w-4" style={{ color: f.color }} />
                    </div>
                    <p className="text-sm font-semibold text-[#202124] mb-1">{f.title}</p>
                    <p className="text-[12px] leading-relaxed text-[#5f6368] break-keep">{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 anim-up-5">
                {[
                  { value: "12,847+", label: "처리된 주문" },
                  { value: "98.7%", label: "분석 정확도" },
                  { value: "38개", label: "등록 거래처" },
                ].map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-[#202124]">{stat.value}</p>
                      <p className="text-xs text-[#5f6368]">{stat.label}</p>
                    </div>
                    {i < 2 && <div className="h-8 w-px bg-[#dadce0]" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-[#80868b] anim-up-6">
              <span>&copy; 2026 NotiFlow</span>
              <button
                onClick={() => setShowContact(true)}
                className="flex items-center gap-1.5 hover:text-[#1a73e8] transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                문의하기
              </button>
            </div>
          </div>

          {/* Floating badges */}
          <FloatingBadge
            text="주문 자동 분석 완료"
            delay={0.8}
            className="bottom-[30%] right-[-4px]"
          />
          <FloatingBadge
            text="식약처 DB 동기화됨"
            delay={1.2}
            className="top-[28%] right-[40px]"
          />
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col items-center justify-center lg:col-span-2 px-6 py-14 min-h-[100dvh] lg:min-h-0 bg-white">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-12">
            <Link href="/" className="flex items-center gap-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "#1a73e8" }}
              >
                <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white">
                  <path d="M10 2L3 7v11h14V7L10 2zm0 2.5l6 4.5v9H4V9l6-4.5z" />
                  <path d="M8 12h4v5H8z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-[#202124]">
                Noti<span style={{ color: "#1a73e8" }}>Flow</span>
              </span>
            </Link>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
              style={{ background: "#e8f0fe", color: "#1a73e8" }}
            >
              의료기기 유통 관리 플랫폼
            </span>
          </div>

          <div className="w-full max-w-[400px] space-y-8 anim-up-2">
            {/* Form header */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-[#202124]">로그인</h2>
              <p className="text-sm text-[#5f6368] break-keep">
                계정 정보를 입력하여 대시보드에 접속하세요
              </p>
            </div>

            {/* Form card */}
            <div
              className="rounded-3xl bg-white p-6"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 32px rgba(26,115,232,0.08), 0 0 0 1px rgba(218,220,224,0.5)" }}
            >
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>

            {/* Footer links */}
            <div className="space-y-4 text-center">
              <p className="text-sm text-[#5f6368] break-keep">
                계정이 필요하시면{" "}
                <button
                  onClick={() => setShowContact(true)}
                  className="font-medium transition-colors"
                  style={{ color: "#1a73e8" }}
                >
                  관리자에게 문의
                </button>
                하세요.
              </p>
              <div className="border-t border-[#e8eaed] pt-4">
                <Link
                  href="/"
                  className="text-sm text-[#5f6368] hover:text-[#1a73e8] transition-colors duration-200"
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
                  <p className="text-lg font-bold text-[#202124]">{stat.value}</p>
                  <p className="text-[11px] text-[#5f6368]">{stat.label}</p>
                </div>
                {i < 2 && <div className="h-6 w-px bg-[#e8eaed]" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
