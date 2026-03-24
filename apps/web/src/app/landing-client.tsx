'use client';

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

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
      const current = eased * end;
      setDisplay(current.toFixed(decimals));
      if (elapsed < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration, decimals]);

  return { ref, display };
}

function TrustStat({ end, decimals = 0, suffix = "", label, delay }: {
  end: number; decimals?: number; suffix?: string; label: string; delay: number;
}) {
  const { ref, display } = useCountUp(end, 2000, decimals);
  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="text-3xl font-headline font-bold text-primary tabular-nums">
        {display}{suffix}
      </div>
      <div className="text-sm text-on-surface-variant mt-1">{label}</div>
    </motion.div>
  );
}

function TrustStatStatic({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="text-3xl font-headline font-bold text-primary">{value}</div>
      <div className="text-sm text-on-surface-variant mt-1">{label}</div>
    </motion.div>
  );
}

export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    }),
  };

  const { scrollYProgress } = useScroll();
  const heroParallaxY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);

  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* Top Navigation Shell */}

<nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
  scrolled
    ? "bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,106,52,0.10)] py-0"
    : "bg-white/70 backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,106,52,0.06)]"
}`}>
<div className={`flex justify-between items-center px-8 max-w-7xl mx-auto transition-all duration-300 ${
  scrolled ? "py-2" : "py-4"
}`}>
<div className="flex items-center gap-2">
<span className="text-2xl font-bold tracking-tighter text-primary font-headline">NotiFlow</span>
</div>
<div className="hidden md:flex items-center gap-8">
<a className="text-primary font-bold border-b-2 border-primary-fixed font-headline text-sm tracking-tight transition-colors duration-300" href="#features">기능</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#workflow">업무흐름</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#reviews">후기</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#contact">문의</a>
</div>
<div className="flex items-center gap-4">
<Link href="/login" className="text-sm font-semibold text-on-surface px-4 py-2 hover:translate-x-1 duration-200">로그인</Link>
<Link href="/login" className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-sm active:scale-95 transition-all">시작하기</Link>
</div>
</div>
</nav>
<main className="pt-24">

{/* Hero Section */}
<section className="relative min-h-[921px] flex items-center overflow-hidden px-8">
<motion.div className="absolute inset-0 digital-meadow-gradient opacity-40 -z-10" style={{ y: heroParallaxY }}></motion.div>
<div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center w-full">
<motion.div className="space-y-8" initial="hidden" animate="visible">
  <motion.div custom={0} variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container text-xs font-bold font-headline tracking-wider uppercase">
    <span className="material-symbols-outlined text-sm" data-icon="local_hospital">local_hospital</span>
    혈액투석 의료물품 주문관리
  </motion.div>
  <motion.h1 custom={1} variants={fadeInUp} className="text-6xl md:text-8xl font-headline font-bold text-on-surface tracking-tighter leading-[0.9] text-glow">
    주문부터<br/>납품까지,<br/><span className="text-primary">한눈에.</span>
  </motion.h1>
  <motion.p custom={2} variants={fadeInUp} className="text-xl text-on-surface-variant leading-relaxed max-w-lg">
    카카오톡·문자 수신 알림을 자동 수집하고, AI가 주문 내용을 파싱하여 체계적으로 관리합니다. 투석실 의료물품 발주의 모든 과정을 NotiFlow 하나로 통합하세요.
  </motion.p>
  <motion.div custom={3} variants={fadeInUp} className="flex flex-wrap gap-4">
    <Link href="/login" className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-primary/20 transition-all hover:-translate-y-1">무료로 시작하기</Link>
    <a href="#features" className="flex items-center gap-2 text-on-surface font-bold px-8 py-4 rounded-full border border-outline-variant hover:bg-surface-container transition-all">
      <span className="material-symbols-outlined" data-icon="arrow_downward">arrow_downward</span>
      자세히 보기
    </a>
  </motion.div>
</motion.div>
<motion.div
  className="relative"
  initial={{ opacity: 0, scale: 0.95, rotateY: -5 }}
  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
  transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
  style={{ perspective: 1000 }}
>
  <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full animate-pulse"></div>
  <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/50 bg-white">
    {/* Browser chrome */}
    <div className="flex items-center gap-2 px-4 py-3 bg-surface-container-low border-b border-outline-variant/30">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
      </div>
      <div className="flex-1 mx-4">
        <div className="bg-surface-container rounded-md px-3 py-1 text-xs text-on-surface-variant text-center">notiflow.life/dashboard</div>
      </div>
    </div>
    {/* Dashboard content */}
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container-low p-4 rounded-xl text-center">
          <div className="text-2xl font-headline font-bold text-primary">127</div>
          <div className="text-xs text-on-surface-variant mt-1">이번 달 주문</div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-xl text-center">
          <div className="text-2xl font-headline font-bold text-primary">98.7%</div>
          <div className="text-xs text-on-surface-variant mt-1">파싱 정확도</div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-xl text-center">
          <div className="text-2xl font-headline font-bold text-primary">23</div>
          <div className="text-xs text-on-surface-variant mt-1">거래처</div>
        </div>
      </div>
      <div className="rounded-xl border border-outline-variant/30 overflow-hidden">
        <div className="bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant font-headline">최근 주문</div>
        <div className="divide-y divide-outline-variant/20">
          <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="font-medium text-on-surface">ORD-20260324-001</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">확인됨</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="font-medium text-on-surface">ORD-20260324-002</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">대기중</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="font-medium text-on-surface">ORD-20260323-015</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-semibold">납품완료</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/* Floating status card */}
  <motion.div
    className="absolute -bottom-4 -left-4 glass-panel p-4 rounded-xl shadow-lg border border-white/50"
    animate={{ y: [0, -8, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
        <span className="material-symbols-outlined text-on-primary-fixed text-sm" data-icon="monitoring">monitoring</span>
      </div>
      <div>
        <div className="text-xs font-bold text-primary font-headline">실시간 현황</div>
        <div className="text-sm font-medium text-on-surface">처리율 <span className="text-primary font-bold">98.7%</span></div>
      </div>
    </div>
  </motion.div>
</motion.div>
</div>
</section>

<section className="py-24 bg-surface-container-low">
  <div className="max-w-7xl mx-auto px-8">
    <motion.p
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="text-center text-label-md font-headline font-semibold text-on-surface-variant/60 uppercase tracking-[0.2em] mb-12"
    >
      NotiFlow 핵심 수치
    </motion.p>
    <div className="flex flex-wrap justify-center gap-12 md:gap-24">
      <TrustStat end={98.7} decimals={1} suffix="%" label="AI 파싱 정확도" delay={0} />
      <TrustStat end={5} suffix="초" label="알림 수집 속도" delay={0.15} />
      <TrustStatStatic value="24/7" label="실시간 모니터링" delay={0.3} />
      <TrustStat end={100} suffix="%" label="식약처 연동" delay={0.45} />
    </div>
  </div>
</section>

{/* Features Section */}
<section id="features" className="py-32 px-8 max-w-7xl mx-auto">
<motion.div
  className="text-center mb-20 space-y-4"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.5 }}
  transition={{ duration: 0.6 }}
>
<h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight"><span className="text-primary">의료물품 주문관리</span>의 모든 것</h2>
<p className="text-on-surface-variant max-w-2xl mx-auto">알림 수집부터 주문 생성, 납품 관리, 세금계산서 발행까지 — 하나의 플랫폼에서 모두 해결합니다.</p>
</motion.div>
<div className="grid md:grid-cols-3 gap-8">

<motion.div
  className="md:col-span-2 rounded-xl bg-surface-container-low p-12 flex flex-col justify-between group overflow-hidden relative"
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, delay: 0 * 0.1 }}
  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
>
<div className="relative z-10 space-y-4">
<div className="w-14 h-14 rounded-lg bg-primary-container flex items-center justify-center">
<span className="material-symbols-outlined text-primary text-3xl" data-icon="notifications_active">notifications_active</span>
</div>
<h3 className="text-3xl font-headline font-bold">스마트 알림 수집</h3>
<p className="text-on-surface-variant max-w-sm">카카오톡, 문자, 앱 알림을 안드로이드 기기에서 자동으로 수집합니다. 수신된 모든 주문 관련 메시지를 놓치지 않습니다.</p>
</div>
<div className="mt-8 relative z-10">
<Link href="/login" className="text-primary font-bold flex items-center gap-2 hover:gap-4 transition-all">
대시보드 둘러보기 <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
</Link>
</div>
<div className="absolute -right-16 -bottom-16 w-80 h-80 bg-white rounded-full blur-3xl opacity-50 group-hover:scale-125 transition-transform duration-1000"></div>
</motion.div>

<motion.div
  className="rounded-xl bg-primary text-on-primary p-12 flex flex-col justify-between shadow-xl shadow-primary/10"
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, delay: 1 * 0.1 }}
  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
>
<div className="space-y-4">
<span className="material-symbols-outlined text-4xl" data-icon="auto_awesome">auto_awesome</span>
<h3 className="text-2xl font-headline font-bold">AI 자동 파싱</h3>
<p className="opacity-80">Claude AI가 수신된 메시지에서 품목명, 수량, 단가를 자동으로 추출합니다. 정확도 0.7 미만 시 정규식 파서가 보완합니다.</p>
</div>
</motion.div>

<motion.div
  className="rounded-xl bg-tertiary-container p-12 flex flex-col justify-between"
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, delay: 2 * 0.1 }}
  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
>
<div className="space-y-4">
<span className="material-symbols-outlined text-3xl text-on-tertiary-container" data-icon="local_pharmacy">local_pharmacy</span>
<h3 className="text-2xl font-headline font-bold text-on-tertiary-container">식약처 연동</h3>
<p className="text-on-tertiary-container/80">MFDS 의약품·의료기기 표준코드 데이터를 자동으로 동기화하여 정확한 품목 매칭을 지원합니다.</p>
</div>
</motion.div>

<motion.div
  className="md:col-span-2 rounded-xl bg-surface-container p-12 flex flex-col md:flex-row items-center gap-12 overflow-hidden"
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, delay: 3 * 0.1 }}
  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
>
<div className="flex-1 space-y-4">
<h3 className="text-3xl font-headline font-bold">모바일 · 웹 동기화</h3>
<p className="text-on-surface-variant">안드로이드 앱에서 수집된 알림이 실시간으로 웹 대시보드에 동기화됩니다. 어디서든 주문 현황을 확인하세요.</p>
<div className="flex gap-4 pt-4">
<span className="material-symbols-outlined" data-icon="smartphone">smartphone</span>
<span className="material-symbols-outlined" data-icon="laptop_mac">laptop_mac</span>
<span className="material-symbols-outlined" data-icon="sync">sync</span>
</div>
</div>
<div className="flex-1 flex items-center justify-center">
<div className="text-6xl">📱 ↔️ 💻</div>
</div>
</motion.div>
</div>
</section>

{/* Workflow Section */}
<section id="workflow" className="py-32 bg-surface">
<div className="max-w-7xl mx-auto px-8">
<motion.div
  className="text-center mb-20 space-y-4"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.5 }}
  transition={{ duration: 0.6 }}
>
<h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight"><span className="text-primary">업무 흐름</span></h2>
<p className="text-on-surface-variant max-w-2xl mx-auto">4단계로 완성되는 의료물품 주문관리</p>
</motion.div>
<div className="grid md:grid-cols-4 gap-8 relative">
  {/* Connecting line (desktop) */}
  <motion.div
    className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-primary-container origin-left"
    initial={{ scaleX: 0 }}
    whileInView={{ scaleX: 1 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
  />

  {[
    { num: "1", title: "알림 수집", desc: "카카오톡·문자 알림을 안드로이드 앱이 자동으로 캡처합니다" },
    { num: "2", title: "AI 파싱", desc: "Claude AI가 메시지에서 품목·수량·단가를 자동으로 추출합니다" },
    { num: "3", title: "주문 생성", desc: "파싱된 데이터로 발주서를 생성하고 거래처별로 관리합니다" },
    { num: "4", title: "납품·정산", desc: "배송 추적, 납품 확인, 세금계산서 발행까지 한 곳에서 처리합니다" },
  ].map((step, i) => (
    <motion.div
      key={step.num}
      className="bg-surface-container-low p-8 rounded-xl text-center space-y-4 relative z-10"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: i * 0.2 }}
    >
      <motion.div
        className="w-16 h-16 rounded-full bg-primary-container mx-auto flex items-center justify-center"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: i * 0.2 + 0.2, type: "spring", stiffness: 200 }}
      >
        <span className="text-2xl font-bold text-primary">{step.num}</span>
      </motion.div>
      <h3 className="font-headline font-bold text-lg">{step.title}</h3>
      <p className="text-sm text-on-surface-variant">{step.desc}</p>
    </motion.div>
  ))}
</div>
</div>
</section>

{/* Reviews Section */}
<section id="reviews" className="py-32 bg-surface-container-low">
<div className="max-w-7xl mx-auto px-8">
<div className="grid lg:grid-cols-2 gap-24 items-center">
<motion.div
  className="space-y-8"
  initial={{ opacity: 0, x: -30 }}
  whileInView={{ opacity: 1, x: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6 }}
>
<h2 className="text-5xl font-headline font-bold tracking-tight"><span className="text-primary">현장의</span> 목소리</h2>
<div className="relative p-12 rounded-xl glass-panel border border-primary/10 shadow-sm">
<span className="material-symbols-outlined text-6xl text-primary/20 absolute top-4 left-4" data-icon="format_quote">format_quote</span>
<p className="text-2xl text-on-surface leading-relaxed italic relative z-10">
"카카오톡으로 오는 발주 메시지를 일일이 엑셀에 옮겨 적던 시절이 생각나지 않을 정도예요. NotiFlow 도입 후 주문 처리 시간이 80% 이상 줄었습니다."
</p>
<div className="mt-8 flex items-center gap-4">
<div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center">
<span className="text-xl font-bold text-primary">김</span>
</div>
<div>
<div className="font-bold text-on-surface">김OO 실장</div>
<div className="text-sm text-on-surface-variant">서울 소재 혈액투석 전문 의원</div>
</div>
</div>
</div>
</motion.div>
<div className="grid grid-cols-2 gap-6">
<div className="space-y-6 pt-12">
<motion.div
  className="bg-surface-container p-6 rounded-lg space-y-3"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.4, delay: 0 * 0.1 }}
>
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"알림 놓칠 걱정이 없어졌어요."</p>
<div className="text-xs text-on-surface-variant">박OO 간호사</div>
</motion.div>
<motion.div
  className="bg-surface-container p-6 rounded-lg space-y-3"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.4, delay: 1 * 0.1 }}
>
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"세금계산서까지 자동 정리돼서 편해요."</p>
<div className="text-xs text-on-surface-variant">이OO 사무장</div>
</motion.div>
</div>
<div className="space-y-6">
<motion.div
  className="bg-surface-container p-6 rounded-lg space-y-3"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.4, delay: 2 * 0.1 }}
>
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"식약처 코드 자동 매칭이 정말 좋아요."</p>
<div className="text-xs text-on-surface-variant">최OO 원장</div>
</motion.div>
<motion.div
  className="bg-surface-container p-6 rounded-lg space-y-3"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.4, delay: 3 * 0.1 }}
>
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"모바일 연동이 너무 깔끔합니다."</p>
<div className="text-xs text-on-surface-variant">정OO 팀장</div>
</motion.div>
</div>
</div>
</div>
</div>
</section>

{/* CTA Section */}
<section id="contact" className="px-8 pb-32">
<motion.div
  className="max-w-7xl mx-auto relative rounded-xl bg-primary-container overflow-hidden p-16 md:p-32 text-center"
  initial={{ opacity: 0, scale: 0.9 }}
  whileInView={{ opacity: 1, scale: 1 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
>
<div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
<div className="relative z-10 space-y-8">
<h2 className="text-5xl md:text-7xl font-headline font-bold text-on-primary-container tracking-tighter">지금 바로<br/><span className="text-primary">시작하세요</span></h2>
<p className="text-xl text-on-primary-container/80 max-w-2xl mx-auto">카카오톡 주문 메시지, 아직 수작업으로 정리하고 계신가요? NotiFlow로 주문관리를 자동화하세요.</p>
<div className="flex flex-col md:flex-row justify-center gap-4">
<Link href="/login" className="bg-primary text-on-primary px-12 py-5 rounded-full font-bold text-xl shadow-lg hover:shadow-primary/30 transition-all animate-pulse-shadow">무료로 시작하기</Link>
<a href="mailto:support@notiflow.life" className="bg-white/50 backdrop-blur-sm text-primary px-12 py-5 rounded-full font-bold text-xl border border-primary/20 hover:bg-white transition-all">문의하기</a>
</div>
</div>
</motion.div>
</section>
</main>

<motion.footer
  className="w-full rounded-t-[3rem] mt-20 bg-emerald-50"
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
<div className="flex flex-col md:flex-row justify-between items-center px-12 py-16 w-full max-w-7xl mx-auto">
<div className="space-y-4 text-center md:text-left">
<div className="text-lg font-bold text-emerald-900 font-headline">NotiFlow</div>
<p className="font-body text-sm text-emerald-900/60 max-w-xs">© 2024 NotiFlow. 혈액투석 의료물품 주문관리 시스템</p>
</div>
<div className="flex flex-wrap justify-center gap-8 mt-12 md:mt-0">
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">개인정보처리방침</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">이용약관</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="mailto:support@notiflow.life">문의하기</a>
</div>
</div>
</motion.footer>

    </div>
  );
}
