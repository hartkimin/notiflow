'use client';

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import {
  Bell, Bot, Pill, Smartphone, BarChart2, Shield,
  CheckCircle2, Mail, X, ArrowRight, Clock, Users, Zap,
  Building2, Stethoscope, Package,
} from "lucide-react";
import { joinWaitlist } from "@/lib/waitlist-actions";

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

function StatCard({ end, decimals = 0, suffix = "", label, delay, sublabel }: {
  end: number; decimals?: number; suffix?: string; label: string; delay: number; sublabel?: string;
}) {
  const { ref, display } = useCountUp(end, 2000, decimals);
  return (
    <motion.div ref={ref} className="text-center px-8"
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4, delay }}>
      <div className="text-3xl font-bold text-[#1a73e8] tabular-nums">{display}{suffix}</div>
      <div className="text-sm text-[#5f6368] mt-1 font-medium">{label}</div>
      {sublabel && <div className="text-xs text-[#80868b] mt-0.5">{sublabel}</div>}
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
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#1a73e8]" />
            </div>
            <h3 className="text-lg font-semibold text-[#202124]">도입 문의</h3>
          </div>
          <p className="text-[#5f6368] text-sm leading-relaxed mb-4">
            도입 상담, 데모 요청, 기술 지원은 아래 이메일로 연락해 주세요. 영업일 기준 24시간 내 답변드립니다.
          </p>
          <a href="mailto:jinzhangxun@gmail.com"
            className="flex items-center gap-3 p-4 bg-[#f8f9fa] rounded-xl hover:bg-[#e8f0fe] transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#1a73e8] font-medium text-base group-hover:underline">
              jinzhangxun@gmail.com
            </span>
            <ArrowRight className="ml-auto w-4 h-4 text-[#1a73e8] opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#5f6368]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#34a853] flex-shrink-0" />
            영업일 기준 1~2일 내 답변 드립니다.
          </div>
          <button onClick={onClose}
            className="mt-5 w-full py-2.5 rounded-full border border-[#dadce0] text-[#5f6368] text-sm hover:bg-[#f8f9fa] transition-colors">
            닫기
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Waitlist Modal ── */
function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await joinWaitlist(email);
      if (result.error) { setError(result.error); return; }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

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
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] transition-colors">
            <X className="w-4 h-4" />
          </button>

          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#e6f4ea] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-[#34a853]" />
              </div>
              <h3 className="text-lg font-semibold text-[#202124] mb-2">등록 완료!</h3>
              <p className="text-sm text-[#5f6368] mb-5">
                베타 서비스 오픈 시 가장 먼저 안내해 드리겠습니다.
              </p>
              <button onClick={onClose}
                className="w-full py-2.5 rounded-full bg-[#1a73e8] text-white text-sm font-semibold hover:bg-[#1557b0] transition-colors">
                확인
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#1a73e8]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#202124]">베타 대기명단 등록</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fce8e6] text-[#d93025] text-xs font-semibold">Beta</span>
                </div>
              </div>
              <p className="text-[#5f6368] text-sm leading-relaxed mb-5 mt-3">
                현재 초대 코드가 있는 분만 가입이 가능합니다.<br />
                이메일을 남겨주시면 베타 오픈 시 먼저 연락드리겠습니다.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80868b]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소를 입력해 주세요"
                    className="w-full pl-10 pr-4 py-2.5 border border-[#dadce0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                  />
                </div>
                {error && (
                  <p className="text-xs text-[#d93025] px-1">{error}</p>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-full bg-[#1a73e8] text-white text-sm font-semibold hover:bg-[#1557b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <>대기명단 등록 <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-center text-xs text-[#80868b] mt-3">
                이미 초대 코드가 있으신가요?{" "}
                <Link href="/signup" className="text-[#1a73e8] hover:underline" onClick={onClose}>
                  가입하기
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
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
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}

      <div className="bg-white text-[#202124] min-h-screen">

        {/* ── Navigation ── */}
        <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-md shadow-md" : "bg-white/80 backdrop-blur-sm"
        }`}>
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-[#202124]">NotiFlow</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fce8e6] text-[#d93025] leading-none">Beta</span>
            </div>
            <div className="hidden md:flex items-center gap-1">
              {["기능", "업무흐름", "도입사례"].map((item, i) => (
                <a key={item} href={`#${["features","workflow","reviews"][i]}`}
                  className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa] transition-all duration-200">
                  {item}
                </a>
              ))}
              <button onClick={() => setContactOpen(true)}
                className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa] transition-all duration-200">
                도입 문의
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/demo"
                className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa] transition-all duration-200">
                라이브 데모
              </Link>
              <Link href="/login"
                className="px-4 py-2 rounded-full text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe] transition-all duration-200">
                로그인
              </Link>
              <button onClick={() => setWaitlistOpen(true)}
                className="px-5 py-2 rounded-full text-sm font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-md transition-all duration-200 active:scale-95">
                무료 시작
              </button>
            </div>
          </div>
        </nav>

        <main className="pt-16">

          {/* ── Hero ── */}
          <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-white via-[#f8f9fa] to-[#e8f0fe]">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "linear-gradient(#202124 1px, transparent 1px), linear-gradient(90deg, #202124 1px, transparent 1px)",
              backgroundSize: "48px 48px"
            }} />
            <div className="absolute top-20 right-[10%] w-80 h-80 bg-[#4285f4]/8 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-[5%] w-64 h-64 bg-[#34a853]/6 rounded-full blur-3xl" />
            <div className="absolute top-[40%] right-[30%] w-48 h-48 bg-[#fbbc04]/6 rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full py-24">
              <motion.div className="space-y-8" initial="hidden" animate="visible">
                <motion.div custom={0} variants={fadeUp}>
                  <span className="chip bg-[#e8f0fe] text-[#1a73e8]">
                    <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
                    의료기기 유통 전용 플랫폼
                  </span>
                </motion.div>
                <motion.h1 custom={1} variants={fadeUp}
                  className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-[#202124]">
                  카카오톡 주문,<br />
                  <span className="text-[#1a73e8]">자동으로 처리.</span>
                </motion.h1>
                <motion.p custom={2} variants={fadeUp}
                  className="text-lg text-[#5f6368] leading-relaxed max-w-lg">
                  의료기기 유통사와 의원 구매 담당자를 위한 주문관리 시스템. 카카오톡·문자 알림에서 AI가 품목·수량·거래처를 자동으로 추출해 발주서를 만들어 드립니다.
                </motion.p>

                {/* Before / After — clearest investor signal */}
                <motion.div custom={2.5} variants={fadeUp}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#e8eaed] google-shadow">
                  <div className="flex-1 text-center">
                    <div className="text-xs font-semibold text-[#ea4335] uppercase tracking-wide mb-1">이전</div>
                    <div className="text-sm text-[#5f6368]">카톡 → 엑셀 수작업 → 전화 확인</div>
                    <div className="text-xs text-[#80868b] mt-1 font-medium">평균 30분/건</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#dadce0] flex-shrink-0" />
                  <div className="flex-1 text-center">
                    <div className="text-xs font-semibold text-[#34a853] uppercase tracking-wide mb-1">NotiFlow</div>
                    <div className="text-sm text-[#202124] font-medium">수신 즉시 자동 파싱 → 발주서 생성</div>
                    <div className="text-xs text-[#34a853] mt-1 font-medium">평균 2분/건</div>
                  </div>
                </motion.div>

                <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-3">
                  <Link href="/demo"
                    className="px-7 py-3.5 rounded-full font-semibold text-base bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-lg transition-all duration-200 active:scale-95">
                    라이브 데모 보기
                  </Link>
                  <button onClick={() => setWaitlistOpen(true)}
                    className="px-7 py-3.5 rounded-full font-semibold text-base border border-[#dadce0] text-[#202124] hover:bg-[#f8f9fa] hover:border-[#bdc1c6] transition-all duration-200 flex items-center gap-2">
                    무료로 시작하기
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
                <motion.div custom={4} variants={fadeUp}
                  className="flex items-center gap-4 pt-2 flex-wrap">
                  {["신용카드 불필요", "식약처 DB 연동", "국내 서버 운영"].map((badge) => (
                    <span key={badge}
                      className="flex items-center gap-1.5 text-xs text-[#5f6368] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34a853]" />
                      {badge}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Hero visual */}
              <motion.div className="relative"
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ y: heroY }}>
                <div className="bg-white rounded-2xl google-shadow p-6 space-y-4 float-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#ea4335]" />
                      <div className="w-2 h-2 rounded-full bg-[#fbbc04]" />
                      <div className="w-2 h-2 rounded-full bg-[#34a853]" />
                    </div>
                    <span className="text-xs text-[#80868b] font-medium">notiflow.life</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "127건", label: "이번달 주문", color: "#1a73e8" },
                      { value: "↓93%", label: "처리 시간", color: "#34a853" },
                      { value: "38곳", label: "등록 거래처", color: "#f29900" },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#f8f9fa] rounded-xl p-3 text-center">
                        <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[11px] text-[#80868b] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
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
                <motion.div
                  className="absolute -top-4 -right-4 bg-white rounded-xl google-shadow px-4 py-3 flex items-center gap-3 float-card-2"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}>
                  <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center">
                    <Bell className="w-4 h-4 text-[#1a73e8]" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#202124]">새 주문 수신</div>
                    <div className="text-[11px] text-[#5f6368]">방금 전 · AI 파싱 중</div>
                  </div>
                </motion.div>
                <motion.div
                  className="absolute -bottom-4 -left-4 bg-white rounded-xl google-shadow px-4 py-3 flex items-center gap-2"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}>
                  <div className="w-2 h-2 rounded-full bg-[#34a853] pulse-dot" />
                  <span className="text-xs font-semibold text-[#202124]">발주서 자동 생성 완료</span>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* ── Who is this for ── */}
          <section className="py-20 bg-white border-y border-[#e8eaed]">
            <div className="max-w-5xl mx-auto px-6">
              <motion.div className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-2xl font-bold text-[#202124]">이런 분들께 추천합니다</h2>
              </motion.div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    Icon: Building2,
                    title: "의료기기 유통사",
                    desc: "병원·의원으로부터 카카오톡·문자로 주문을 받아 수작업으로 정리하는 담당자",
                    tags: ["발주 자동화", "거래처 관리", "식약처 유통신고"],
                    color: "#1a73e8", bg: "#e8f0fe",
                  },
                  {
                    Icon: Stethoscope,
                    title: "의원 구매 담당자",
                    desc: "여러 유통사에 분산된 주문 현황을 한 화면에서 파악하고 싶은 담당자",
                    tags: ["주문 현황 통합", "납품 추적", "정산 관리"],
                    color: "#34a853", bg: "#e6f4ea",
                  },
                  {
                    Icon: Package,
                    title: "소형 물류 운영자",
                    desc: "안드로이드 기기로 받은 알림을 실시간으로 처리·기록해야 하는 현장 담당자",
                    tags: ["모바일 동기화", "실시간 알림", "기록 자동화"],
                    color: "#f29900", bg: "#fef7e0",
                  },
                ].map((persona, i) => (
                  <motion.div key={persona.title}
                    className="rounded-2xl border border-[#e8eaed] p-6 bg-white cursor-default"
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}
                    whileHover={{ y: -2, boxShadow: "0 4px 20px rgba(26,115,232,0.08)", borderColor: "rgba(26,115,232,0.3)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: persona.bg }}>
                      <persona.Icon className="w-5 h-5" style={{ color: persona.color }} />
                    </div>
                    <h3 className="font-semibold text-[#202124] mb-2">{persona.title}</h3>
                    <p className="text-sm text-[#5f6368] leading-relaxed mb-4">{persona.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {persona.tags.map((tag) => (
                        <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: persona.bg, color: persona.color }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Stats ── */}
          <section className="py-20 bg-[#f8f9fa] border-b border-[#e8eaed]">
            <div className="max-w-4xl mx-auto px-6">
              <div className="flex flex-wrap justify-center divide-x divide-[#e8eaed]">
                <StatCard end={93} suffix="%" label="주문 처리 시간 단축" sublabel="수작업 대비" delay={0} />
                <StatCard end={12847} suffix="+" label="누적 처리 주문" sublabel="2024년 이후" delay={0.15} />
                <StatCard end={38} suffix="개" label="등록 거래처" sublabel="현재 운영 중" delay={0.3} />
                <motion.div className="text-center px-8"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.45 }}>
                  <div className="text-3xl font-bold text-[#1a73e8]">24/7</div>
                  <div className="text-sm text-[#5f6368] mt-1 font-medium">실시간 모니터링</div>
                  <div className="text-xs text-[#80868b] mt-0.5">알림 수집 지연 없음</div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section id="features" className="py-28 bg-white">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div className="text-center mb-16 space-y-3"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">
                  주문관리의 <span className="text-[#1a73e8]">모든 것</span>
                </h2>
                <p className="text-[#5f6368] max-w-xl mx-auto">알림 수집부터 발주서 생성, 납품·정산 관리까지 하나의 플랫폼에서.</p>
              </motion.div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    Icon: Bell,
                    title: "스마트 알림 수집",
                    desc: "카카오톡, 문자, 앱 알림을 안드로이드 기기에서 자동으로 수집합니다. 알림을 놓칠 염려가 없습니다.",
                    color: "#e8f0fe", accent: "#1a73e8"
                  },
                  {
                    Icon: Bot,
                    title: "AI 자동 파싱",
                    desc: "주문 메시지에서 품목명, 수량, 단가를 자동으로 추출합니다. 수작업 입력이 필요 없습니다.",
                    color: "#e6f4ea", accent: "#34a853"
                  },
                  {
                    Icon: Pill,
                    title: "식약처 DB 연동",
                    desc: "의약품·의료기기 표준코드 데이터를 자동으로 동기화하여 정확한 품목 매칭과 유통신고를 지원합니다.",
                    color: "#fef7e0", accent: "#f29900"
                  },
                  {
                    Icon: Smartphone,
                    title: "모바일 실시간 동기화",
                    desc: "안드로이드 앱에서 수집된 알림이 웹 대시보드에 즉시 반영됩니다. 어디서든 주문 현황을 확인하세요.",
                    color: "#fce8e6", accent: "#ea4335"
                  },
                  {
                    Icon: BarChart2,
                    title: "주문 현황 대시보드",
                    desc: "거래처별, 기간별 주문 통계와 트렌드를 한눈에 확인합니다. 보고서 작성 시간을 줄여드립니다.",
                    color: "#e8eaf6", accent: "#3c4fe0"
                  },
                  {
                    Icon: Shield,
                    title: "데이터 보안",
                    desc: "행 수준 보안(RLS) 기반 권한 관리로 담당자별 데이터 접근을 분리합니다. 고객사 정보가 안전합니다.",
                    color: "#e8f0fe", accent: "#1a73e8"
                  },
                ].map((feature, i) => (
                  <motion.div key={feature.title}
                    className="bg-white rounded-2xl p-6 border border-[#e8eaed] google-shadow-hover transition-all duration-200 cursor-default"
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                    whileHover={{ y: -2 }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: feature.color }}>
                      <feature.Icon className="w-5 h-5" style={{ color: feature.accent }} />
                    </div>
                    <h3 className="font-semibold text-[#202124] mb-2">{feature.title}</h3>
                    <p className="text-sm text-[#5f6368] leading-relaxed">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Workflow ── */}
          <section id="workflow" className="py-28 bg-[#f8f9fa]">
            <div className="max-w-5xl mx-auto px-6">
              <motion.div className="text-center mb-16 space-y-3"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">업무 흐름</h2>
                <p className="text-[#5f6368]">카카오톡 수신부터 납품 정산까지 — 4단계로 완성</p>
              </motion.div>
              <div className="grid md:grid-cols-4 gap-6 relative">
                <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-[#e8eaed]" />
                {[
                  { num: "1", title: "알림 수집", desc: "카카오톡·문자 알림을 안드로이드 앱이 자동으로 캡처하여 서버에 전송", color: "#1a73e8", bg: "#e8f0fe" },
                  { num: "2", title: "AI 파싱", desc: "AI가 품목·수량·거래처를 자동으로 추출. 불확실한 경우 담당자에게 검토 요청", color: "#34a853", bg: "#e6f4ea" },
                  { num: "3", title: "발주서 생성", desc: "파싱된 데이터로 발주서를 생성하고 거래처별로 분류하여 관리", color: "#f29900", bg: "#fef7e0" },
                  { num: "4", title: "납품·정산", desc: "배송 추적, 납품 확인 후 세금계산서 발행 및 정산 처리까지 일괄 관리", color: "#ea4335", bg: "#fce8e6" },
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
          <section id="reviews" className="py-28 bg-white">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div className="text-center mb-16 space-y-3"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl font-bold text-[#202124]">도입 사례</h2>
                <p className="text-[#5f6368]">실제 현장에서 사용하는 분들의 이야기</p>
              </motion.div>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <motion.div className="bg-[#f8f9fa] rounded-2xl p-8 border border-[#e8eaed]"
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
                    "카카오톡으로 오는 발주 메시지를 일일이 엑셀에 옮겨 적던 시절이 생각나지 않을 정도예요. NotiFlow 도입 후 주문 처리 시간이 90% 이상 줄었고, 실수도 거의 없어졌습니다."
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center font-bold text-[#1a73e8]">김</div>
                    <div>
                      <div className="font-semibold text-sm text-[#202124]">김OO 실장</div>
                      <div className="text-xs text-[#5f6368]">의료기기 유통사 · 서울</div>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-[#e8eaed] flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#34a853]" />
                      <span className="text-xs font-semibold text-[#34a853]">처리 시간 90% 단축</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#1a73e8]" />
                      <span className="text-xs font-semibold text-[#1a73e8]">담당자 1명이 38개 거래처 관리</span>
                    </div>
                  </div>
                </motion.div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { stars: 5, text: "알림 놓칠 걱정이 없어졌어요. 24시간 자동 수집이 정말 편합니다.", name: "박OO 간호사", role: "의원 구매 담당" },
                    { stars: 5, text: "세금계산서까지 정리되니 월말 정산이 반나절로 줄었어요.", name: "이OO 사무장", role: "소규모 병원" },
                    { stars: 5, text: "식약처 코드 자동 매칭 덕분에 유통신고 오류가 없어졌습니다.", name: "최OO 원장", role: "의료기기 유통사" },
                    { stars: 5, text: "모바일로 현장에서 바로 주문 확인이 가능해 너무 편합니다.", name: "정OO 팀장", role: "물류 현장 담당" },
                  ].map((review, i) => (
                    <motion.div key={review.name}
                      className="bg-[#f8f9fa] rounded-xl border border-[#e8eaed] p-4 space-y-2"
                      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.08 }}
                      whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                      <div className="flex">
                        {[...Array(review.stars)].map((_, j) => (
                          <svg key={j} width="12" height="12" viewBox="0 0 24 24" fill="#fbbc04">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-[#202124]">"{review.text}"</p>
                      <div>
                        <p className="text-xs font-semibold text-[#5f6368]">{review.name}</p>
                        <p className="text-xs text-[#80868b]">{review.role}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section id="contact" className="py-28 bg-[#f8f9fa] border-t border-[#e8eaed]">
            <motion.div className="max-w-3xl mx-auto px-6 text-center space-y-8"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <div className="space-y-4">
                <span className="chip bg-[#e8f0fe] text-[#1a73e8] mx-auto">
                  <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
                  도입 문의
                </span>
                <h2 className="text-5xl font-bold text-[#202124] tracking-tight">
                  지금 바로<br /><span className="text-[#1a73e8]">시작하세요</span>
                </h2>
                <p className="text-lg text-[#5f6368]">
                  카카오톡 주문 메시지, 아직 수작업으로 정리하고 계신가요?<br />
                  <span className="text-[#202124] font-medium">무료 데모를 신청하시면 현장에 맞게 설명해 드립니다.</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/demo"
                  className="px-8 py-4 rounded-full font-semibold text-lg bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center gap-2 justify-center">
                  <ArrowRight className="w-5 h-5" />
                  라이브 데모 보기
                </Link>
                <button onClick={() => setWaitlistOpen(true)}
                  className="px-8 py-4 rounded-full font-semibold text-lg border-2 border-[#dadce0] text-[#5f6368] hover:bg-white hover:border-[#1a73e8] hover:text-[#1a73e8] transition-all duration-200 flex items-center gap-2 justify-center">
                  무료로 시작하기
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#80868b]">신용카드 불필요 · 계약 없이 체험 가능</p>
            </motion.div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-[#e8eaed] bg-white">
          <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <div className="w-6 h-6 rounded bg-[#1a73e8] flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-[#202124]">NotiFlow</span>
              </div>
              <p className="text-sm text-[#5f6368]">© 2026 NotiFlow. 의료물품 주문관리 시스템</p>
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
                도입 문의
              </button>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
