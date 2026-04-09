'use client';

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";

/* ── Ripple effect hook ── */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `position:absolute;border-radius:50%;transform:scale(0);animation:ripple 600ms linear;background:rgba(255,255,255,0.35);width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px;pointer-events:none`;
    el.style.position = "relative";
    el.style.overflow = "hidden";
    el.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  };
  return { ref, trigger };
}

/* ── Count-up animation ── */
function useCountUp(end: number, duration = 2000, decimals = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(decimals > 0 ? "0.0" : "0");
  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay((eased * end).toFixed(decimals));
      if (elapsed < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration, decimals]);
  return { ref, display };
}

function StatCard({ end, decimals = 0, suffix = "", label, delay }: {
  end: number; decimals?: number; suffix?: string; label: string; delay: number;
}) {
  const { ref, display } = useCountUp(end, 2000, decimals);
  return (
    <motion.div ref={ref} className="text-center px-8"
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4, delay }}>
      <div className="text-3xl font-bold text-[#1a73e8] tabular-nums">{display}{suffix}</div>
      <div className="text-sm text-[#5f6368] mt-1">{label}</div>
    </motion.div>
  );
}

/* ── Contact Modal ── */
function ContactModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#202124]">문의하기</h3>
          </div>
          <p className="text-[#5f6368] text-sm leading-relaxed mb-4">
            NotiFlow 사용 문의, 도입 상담, 기술 지원은 아래 이메일로 연락해 주세요. 영업일 기준 24시간 내 답변드립니다.
          </p>
          <a href="mailto:jinzhangxun@gmail.com"
            className="flex items-center gap-3 p-4 bg-[#f8f9fa] rounded-xl hover:bg-[#e8f0fe] transition-colors group">
            <span className="text-[#1a73e8] font-medium text-base group-hover:underline">
              jinzhangxun@gmail.com
            </span>
            <svg className="ml-auto text-[#1a73e8] opacity-0 group-hover:opacity-100 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <button onClick={onClose}
            className="mt-6 w-full py-2.5 rounded-full border border-[#dadce0] text-[#5f6368] text-sm hover:bg-[#f8f9fa] transition-colors">
            닫기
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const ripple = useRipple();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    }),
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ripple { to { transform: scale(2); opacity: 0; } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        .float-card { animation: float 4s ease-in-out infinite; }
        .float-card-2 { animation: float 5s ease-in-out infinite 1s; }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        .google-shadow { box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 2px 6px 2px rgba(60,64,67,.15); }
        .google-shadow-hover:hover { box-shadow: 0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15); }
        .chip { display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase; }
      `}</style>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}

      <div className="bg-white text-[#202124] min-h-screen">

        {/* ── Navigation ── */}
        <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-md shadow-md" : "bg-white/80 backdrop-blur-sm"
        }`}>
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/>
                </svg>
              </div>
              <span className="text-lg font-bold text-[#202124]">NotiFlow</span>
            </div>
            <div className="hidden md:flex items-center gap-1">
              {["기능", "업무흐름", "후기"].map((item, i) => (
                <a key={item} href={`#${["features","workflow","reviews"][i]}`}
                  className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa] transition-all duration-200">
                  {item}
                </a>
              ))}
              <button onClick={() => setContactOpen(true)}
                className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa] transition-all duration-200">
                문의
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login"
                className="px-4 py-2 rounded-full text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe] transition-all duration-200">
                로그인
              </Link>
              <Link href="/login"
                className="px-5 py-2 rounded-full text-sm font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-md transition-all duration-200 active:scale-95">
                시작하기
              </Link>
            </div>
          </div>
        </nav>

        <main className="pt-16">

          {/* ── Hero ── */}
          <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-white via-[#f8f9fa] to-[#e8f0fe]">
            {/* Background grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "linear-gradient(#202124 1px, transparent 1px), linear-gradient(90deg, #202124 1px, transparent 1px)",
              backgroundSize: "48px 48px"
            }} />
            {/* Google-style color blobs — subtle */}
            <div className="absolute top-20 right-[10%] w-80 h-80 bg-[#4285f4]/8 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-[5%] w-64 h-64 bg-[#34a853]/6 rounded-full blur-3xl" />
            <div className="absolute top-[40%] right-[30%] w-48 h-48 bg-[#fbbc04]/6 rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full py-24">
              <motion.div className="space-y-8" initial="hidden" animate="visible">
                <motion.div custom={0} variants={fadeUp}>
                  <span className="chip bg-[#e8f0fe] text-[#1a73e8]">
                    <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
                    의료물품 주문관리
                  </span>
                </motion.div>
                <motion.h1 custom={1} variants={fadeUp}
                  className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-[#202124]">
                  주문부터 납품까지,<br />
                  <span className="text-[#1a73e8]">한눈에.</span>
                </motion.h1>
                <motion.p custom={2} variants={fadeUp}
                  className="text-lg text-[#5f6368] leading-relaxed max-w-lg">
                  카카오톡·문자 수신 알림을 자동 수집하고, AI가 주문 내용을 파싱하여 체계적으로 관리합니다. 의료물품 발주의 모든 과정을 NotiFlow 하나로 통합하세요.
                </motion.p>
                <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-3">
                  <Link href="/login"
                    className="px-7 py-3.5 rounded-full font-semibold text-base bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-lg transition-all duration-200 active:scale-95">
                    무료로 시작하기
                  </Link>
                  <a href="#features"
                    className="px-7 py-3.5 rounded-full font-semibold text-base border border-[#dadce0] text-[#202124] hover:bg-[#f8f9fa] hover:border-[#bdc1c6] transition-all duration-200">
                    자세히 보기
                  </a>
                </motion.div>
                {/* Trust badges */}
                <motion.div custom={4} variants={fadeUp}
                  className="flex items-center gap-4 pt-2">
                  {["AI 파싱 정확도 98.7%", "24/7 실시간", "식약처 연동"].map((badge) => (
                    <span key={badge}
                      className="flex items-center gap-1.5 text-xs text-[#5f6368] font-medium">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="22 4 12 14.01 9 11.01" stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {badge}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Hero visual — Google-style product card */}
              <motion.div className="relative"
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ y: heroY }}>
                {/* Main card */}
                <div className="bg-white rounded-2xl google-shadow p-6 space-y-4 float-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#ea4335]" />
                      <div className="w-2 h-2 rounded-full bg-[#fbbc04]" />
                      <div className="w-2 h-2 rounded-full bg-[#34a853]" />
                    </div>
                    <span className="text-xs text-[#80868b] font-medium">notiflow.life</span>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "127", label: "이번달 주문", color: "#1a73e8" },
                      { value: "98.7%", label: "파싱 정확도", color: "#34a853" },
                      { value: "23", label: "거래처", color: "#fbbc04" },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#f8f9fa] rounded-xl p-3 text-center">
                        <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[11px] text-[#80868b] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Order list */}
                  <div className="rounded-xl border border-[#e8eaed] overflow-hidden">
                    <div className="bg-[#f8f9fa] px-4 py-2 text-xs font-semibold text-[#5f6368]">최근 주문</div>
                    {[
                      { id: "ORD-20260409-001", status: "확인됨", color: "#1a73e8", bg: "#e8f0fe" },
                      { id: "ORD-20260409-002", status: "대기중", color: "#f29900", bg: "#fef7e0" },
                      { id: "ORD-20260408-015", status: "납품완료", color: "#34a853", bg: "#e6f4ea" },
                    ].map((order) => (
                      <div key={order.id} className="flex items-center justify-between px-4 py-2.5 border-t border-[#e8eaed] hover:bg-[#f8f9fa] transition-colors">
                        <span className="text-sm font-medium text-[#202124]">{order.id}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: order.color, background: order.bg }}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating notification */}
                <motion.div
                  className="absolute -top-4 -right-4 bg-white rounded-xl google-shadow px-4 py-3 flex items-center gap-3 float-card-2"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}>
                  <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#202124]">새 주문 수신</div>
                    <div className="text-[11px] text-[#5f6368]">방금 전</div>
                  </div>
                </motion.div>
                {/* AI parsing badge */}
                <motion.div
                  className="absolute -bottom-4 -left-4 bg-white rounded-xl google-shadow px-4 py-3 flex items-center gap-2"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}>
                  <div className="w-2 h-2 rounded-full bg-[#34a853] pulse-dot" />
                  <span className="text-xs font-semibold text-[#202124]">AI 파싱 완료</span>
                  <span className="text-xs text-[#34a853] font-bold">98.7%</span>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* ── Stats ── */}
          <section className="py-20 bg-white border-y border-[#e8eaed]">
            <div className="max-w-4xl mx-auto px-6">
              <div className="flex flex-wrap justify-center divide-x divide-[#e8eaed]">
                <StatCard end={98.7} decimals={1} suffix="%" label="AI 파싱 정확도" delay={0} />
                <StatCard end={5} suffix="초" label="알림 수집 속도" delay={0.15} />
                <motion.div className="text-center px-8"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 }}>
                  <div className="text-3xl font-bold text-[#1a73e8]">24/7</div>
                  <div className="text-sm text-[#5f6368] mt-1">실시간 모니터링</div>
                </motion.div>
                <StatCard end={100} suffix="%" label="식약처 연동" delay={0.45} />
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section id="features" className="py-28 bg-[#f8f9fa]">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div className="text-center mb-16 space-y-3"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">
                  <span className="text-[#1a73e8]">의료물품 주문관리</span>의 모든 것
                </h2>
                <p className="text-[#5f6368] max-w-xl mx-auto">알림 수집부터 주문 생성, 납품 관리까지 하나의 플랫폼에서.</p>
              </motion.div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: "🔔", title: "스마트 알림 수집", desc: "카카오톡, 문자, 앱 알림을 안드로이드 기기에서 자동으로 수집합니다.", color: "#e8f0fe", accent: "#1a73e8" },
                  { icon: "🤖", title: "AI 자동 파싱", desc: "Claude AI가 품목명, 수량, 단가를 자동 추출. 정확도 0.7 미만 시 정규식 파서 보완.", color: "#e6f4ea", accent: "#34a853" },
                  { icon: "💊", title: "식약처 연동", desc: "MFDS 의약품·의료기기 표준코드 데이터를 자동으로 동기화하여 정확한 품목 매칭.", color: "#fef7e0", accent: "#f29900" },
                  { icon: "📱", title: "모바일 동기화", desc: "안드로이드 앱에서 수집된 알림이 실시간으로 웹 대시보드에 반영됩니다.", color: "#fce8e6", accent: "#ea4335" },
                  { icon: "📊", title: "주문 현황 대시보드", desc: "거래처별, 기간별 주문 통계와 트렌드를 한눈에 확인합니다.", color: "#e8eaf6", accent: "#3c4fe0" },
                  { icon: "🔒", title: "보안 및 접근 제어", desc: "Row Level Security 기반 권한 관리로 데이터를 안전하게 보호합니다.", color: "#e8f0fe", accent: "#1a73e8" },
                ].map((feature, i) => (
                  <motion.div key={feature.title}
                    className="bg-white rounded-2xl p-6 google-shadow google-shadow-hover transition-all duration-200 cursor-default"
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                    whileHover={{ y: -2 }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                      style={{ background: feature.color }}>
                      {feature.icon}
                    </div>
                    <h3 className="font-semibold text-[#202124] mb-2">{feature.title}</h3>
                    <p className="text-sm text-[#5f6368] leading-relaxed">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Workflow ── */}
          <section id="workflow" className="py-28 bg-white">
            <div className="max-w-5xl mx-auto px-6">
              <motion.div className="text-center mb-16 space-y-3"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">업무 흐름</h2>
                <p className="text-[#5f6368]">4단계로 완성되는 의료물품 주문관리</p>
              </motion.div>
              <div className="grid md:grid-cols-4 gap-6 relative">
                <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-[#e8eaed]" />
                {[
                  { num: "1", title: "알림 수집", desc: "카카오톡·문자 알림을 안드로이드 앱이 자동으로 캡처", color: "#1a73e8", bg: "#e8f0fe" },
                  { num: "2", title: "AI 파싱", desc: "Claude AI가 품목·수량·단가를 자동으로 추출", color: "#34a853", bg: "#e6f4ea" },
                  { num: "3", title: "주문 생성", desc: "파싱된 데이터로 발주서 생성 및 거래처별 관리", color: "#f29900", bg: "#fef7e0" },
                  { num: "4", title: "납품·정산", desc: "배송 추적, 납품 확인, 세금계산서 발행까지", color: "#ea4335", bg: "#fce8e6" },
                ].map((step, i) => (
                  <motion.div key={step.num}
                    className="text-center space-y-3 relative z-10"
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.12 }}>
                    <motion.div
                      className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold shadow-sm"
                      style={{ background: step.bg, color: step.color }}
                      whileHover={{ scale: 1.08 }} transition={{ type: "spring", stiffness: 300 }}>
                      {step.num}
                    </motion.div>
                    <h3 className="font-semibold text-[#202124]">{step.title}</h3>
                    <p className="text-sm text-[#5f6368]">{step.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Reviews ── */}
          <section id="reviews" className="py-28 bg-[#f8f9fa]">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div className="text-center mb-16"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">현장의 목소리</h2>
              </motion.div>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Feature review */}
                <motion.div className="bg-white rounded-2xl google-shadow p-8"
                  initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.5 }}>
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#fbbc04">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    ))}
                  </div>
                  <blockquote className="text-lg text-[#202124] leading-relaxed mb-6">
                    "카카오톡으로 오는 발주 메시지를 일일이 엑셀에 옮겨 적던 시절이 생각나지 않을 정도예요. NotiFlow 도입 후 주문 처리 시간이 80% 이상 줄었습니다."
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center font-bold text-[#1a73e8]">김</div>
                    <div>
                      <div className="font-semibold text-sm text-[#202124]">김OO 실장</div>
                      <div className="text-xs text-[#5f6368]">서울 소재 의원</div>
                    </div>
                  </div>
                </motion.div>
                {/* Mini reviews grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { stars: 5, text: "알림 놓칠 걱정이 없어졌어요.", name: "박OO 간호사" },
                    { stars: 5, text: "세금계산서까지 자동 정리돼서 편해요.", name: "이OO 사무장" },
                    { stars: 5, text: "식약처 코드 자동 매칭이 정말 좋아요.", name: "최OO 원장" },
                    { stars: 5, text: "모바일 연동이 너무 깔끔합니다.", name: "정OO 팀장" },
                  ].map((review, i) => (
                    <motion.div key={review.name}
                      className="bg-white rounded-xl google-shadow p-4 space-y-2"
                      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.08 }}
                      whileHover={{ y: -2 }}>
                      <div className="flex">
                        {[...Array(review.stars)].map((_, j) => (
                          <svg key={j} width="12" height="12" viewBox="0 0 24 24" fill="#fbbc04">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-[#202124]">"{review.text}"</p>
                      <p className="text-xs text-[#5f6368]">{review.name}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section id="contact" className="py-28 bg-white">
            <motion.div className="max-w-3xl mx-auto px-6 text-center space-y-8"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <div className="space-y-4">
                <h2 className="text-5xl font-bold text-[#202124] tracking-tight">
                  지금 바로<br /><span className="text-[#1a73e8]">시작하세요</span>
                </h2>
                <p className="text-lg text-[#5f6368]">카카오톡 주문 메시지, 아직 수작업으로 정리하고 계신가요?</p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/login"
                  className="px-8 py-4 rounded-full font-semibold text-lg bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-xl transition-all duration-200 active:scale-95">
                  무료로 시작하기
                </Link>
                <button
                  ref={ripple.ref}
                  onClick={(e) => { ripple.trigger(e); setContactOpen(true); }}
                  className="px-8 py-4 rounded-full font-semibold text-lg border-2 border-[#1a73e8] text-[#1a73e8] hover:bg-[#e8f0fe] transition-all duration-200">
                  문의하기
                </button>
              </div>
            </motion.div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-[#e8eaed] bg-[#f8f9fa]">
          <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="font-bold text-[#202124]">NotiFlow</div>
              <p className="text-sm text-[#5f6368]">© 2024 NotiFlow. 의료물품 주문관리 시스템</p>
            </div>
            <div className="flex gap-6">
              {["개인정보처리방침", "이용약관"].map((item) => (
                <a key={item} href="#"
                  className="text-sm text-[#5f6368] hover:text-[#1a73e8] transition-colors">
                  {item}
                </a>
              ))}
              <button onClick={() => setContactOpen(true)}
                className="text-sm text-[#5f6368] hover:text-[#1a73e8] transition-colors">
                문의하기
              </button>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
