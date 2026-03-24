'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
<div className="absolute inset-0 digital-meadow-gradient opacity-40 -z-10"></div>
<div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center w-full">
<div className="space-y-8">
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container text-xs font-bold font-headline tracking-wider uppercase">
<span className="material-symbols-outlined text-sm" data-icon="local_hospital">local_hospital</span>
혈액투석 의료물품 주문관리
</div>
<h1 className="text-6xl md:text-8xl font-headline font-bold text-on-surface tracking-tighter leading-[0.9] text-glow">
주문부터<br/>납품까지,<br/><span className="text-primary">한눈에.</span>
</h1>
<p className="text-xl text-on-surface-variant leading-relaxed max-w-lg">
카카오톡·문자 수신 알림을 자동 수집하고, AI가 주문 내용을 파싱하여 체계적으로 관리합니다. 투석실 의료물품 발주의 모든 과정을 NotiFlow 하나로 통합하세요.
</p>
<div className="flex flex-wrap gap-4">
<Link href="/login" className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-primary/20 transition-all hover:-translate-y-1">무료로 시작하기</Link>
<a href="#features" className="flex items-center gap-2 text-on-surface font-bold px-8 py-4 rounded-full border border-outline-variant hover:bg-surface-container transition-all">
<span className="material-symbols-outlined" data-icon="arrow_downward">arrow_downward</span>
자세히 보기
</a>
</div>
</div>
<div className="relative group">
<div className="absolute -inset-4 bg-primary-container/20 blur-3xl rounded-full"></div>
<div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white">
<div className="w-full h-[600px] bg-gradient-to-br from-primary/5 via-surface-container to-primary-container/20 flex items-center justify-center">
<div className="text-center space-y-4 p-8">
<div className="text-8xl">📱💊</div>
<p className="text-lg text-on-surface-variant font-medium">알림 → 파싱 → 주문 → 납품</p>
</div>
</div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>

<div className="absolute bottom-8 left-8 right-8 glass-panel p-6 rounded-lg shadow-lg border border-white/50 animate-float">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
<span className="material-symbols-outlined text-on-primary-fixed" data-icon="monitoring">monitoring</span>
</div>
<div>
<div className="text-xs font-bold text-primary font-headline uppercase">실시간 현황</div>
<div className="text-sm font-medium text-on-surface">이번 달 주문 처리율</div>
</div>
</div>
<div className="text-primary font-bold">98.7%</div>
</div>
<div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div className="h-full bg-primary w-[98%] rounded-full"></div>
</div>
</div>
</div>
</div>
</div>
</section>

{/* Trust Section */}
<section className="py-24 bg-surface-container-low">
<div className="max-w-7xl mx-auto px-8">
<p className="text-center text-label-md font-headline font-semibold text-on-surface-variant/60 uppercase tracking-[0.2em] mb-12">NotiFlow 핵심 수치</p>
<div className="flex flex-wrap justify-center gap-12 md:gap-24">
<div className="text-center">
<div className="text-3xl font-headline font-bold text-primary">98.7%</div>
<div className="text-sm text-on-surface-variant mt-1">AI 파싱 정확도</div>
</div>
<div className="text-center">
<div className="text-3xl font-headline font-bold text-primary">5초</div>
<div className="text-sm text-on-surface-variant mt-1">알림 수집 속도</div>
</div>
<div className="text-center">
<div className="text-3xl font-headline font-bold text-primary">24/7</div>
<div className="text-sm text-on-surface-variant mt-1">실시간 모니터링</div>
</div>
<div className="text-center">
<div className="text-3xl font-headline font-bold text-primary">100%</div>
<div className="text-sm text-on-surface-variant mt-1">식약처 연동</div>
</div>
</div>
</div>
</section>

{/* Features Section */}
<section id="features" className="py-32 px-8 max-w-7xl mx-auto">
<div className="text-center mb-20 space-y-4">
<h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight"><span className="text-primary">의료물품 주문관리</span>의 모든 것</h2>
<p className="text-on-surface-variant max-w-2xl mx-auto">알림 수집부터 주문 생성, 납품 관리, 세금계산서 발행까지 — 하나의 플랫폼에서 모두 해결합니다.</p>
</div>
<div className="grid md:grid-cols-3 gap-8">

<div className="md:col-span-2 rounded-xl bg-surface-container-low p-12 flex flex-col justify-between group overflow-hidden relative">
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
</div>

<div className="rounded-xl bg-primary text-on-primary p-12 flex flex-col justify-between shadow-xl shadow-primary/10">
<div className="space-y-4">
<span className="material-symbols-outlined text-4xl" data-icon="auto_awesome">auto_awesome</span>
<h3 className="text-2xl font-headline font-bold">AI 자동 파싱</h3>
<p className="opacity-80">Claude AI가 수신된 메시지에서 품목명, 수량, 단가를 자동으로 추출합니다. 정확도 0.7 미만 시 정규식 파서가 보완합니다.</p>
</div>
</div>

<div className="rounded-xl bg-tertiary-container p-12 flex flex-col justify-between">
<div className="space-y-4">
<span className="material-symbols-outlined text-3xl text-on-tertiary-container" data-icon="local_pharmacy">local_pharmacy</span>
<h3 className="text-2xl font-headline font-bold text-on-tertiary-container">식약처 연동</h3>
<p className="text-on-tertiary-container/80">MFDS 의약품·의료기기 표준코드 데이터를 자동으로 동기화하여 정확한 품목 매칭을 지원합니다.</p>
</div>
</div>

<div className="md:col-span-2 rounded-xl bg-surface-container p-12 flex flex-col md:flex-row items-center gap-12 overflow-hidden">
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
</div>
</div>
</section>

{/* Workflow Section */}
<section id="workflow" className="py-32 bg-surface">
<div className="max-w-7xl mx-auto px-8">
<div className="text-center mb-20 space-y-4">
<h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight"><span className="text-primary">업무 흐름</span></h2>
<p className="text-on-surface-variant max-w-2xl mx-auto">4단계로 완성되는 의료물품 주문관리</p>
</div>
<div className="grid md:grid-cols-4 gap-8">
<div className="bg-surface-container-low p-8 rounded-xl text-center space-y-4">
<div className="w-16 h-16 rounded-full bg-primary-container mx-auto flex items-center justify-center">
<span className="text-2xl font-bold text-primary">1</span>
</div>
<h3 className="font-headline font-bold text-lg">알림 수집</h3>
<p className="text-sm text-on-surface-variant">카카오톡·문자 알림을 안드로이드 앱이 자동으로 캡처합니다</p>
</div>
<div className="bg-surface-container-low p-8 rounded-xl text-center space-y-4">
<div className="w-16 h-16 rounded-full bg-primary-container mx-auto flex items-center justify-center">
<span className="text-2xl font-bold text-primary">2</span>
</div>
<h3 className="font-headline font-bold text-lg">AI 파싱</h3>
<p className="text-sm text-on-surface-variant">Claude AI가 메시지에서 품목·수량·단가를 자동으로 추출합니다</p>
</div>
<div className="bg-surface-container-low p-8 rounded-xl text-center space-y-4">
<div className="w-16 h-16 rounded-full bg-primary-container mx-auto flex items-center justify-center">
<span className="text-2xl font-bold text-primary">3</span>
</div>
<h3 className="font-headline font-bold text-lg">주문 생성</h3>
<p className="text-sm text-on-surface-variant">파싱된 데이터로 발주서를 생성하고 거래처별로 관리합니다</p>
</div>
<div className="bg-surface-container-low p-8 rounded-xl text-center space-y-4">
<div className="w-16 h-16 rounded-full bg-primary-container mx-auto flex items-center justify-center">
<span className="text-2xl font-bold text-primary">4</span>
</div>
<h3 className="font-headline font-bold text-lg">납품·정산</h3>
<p className="text-sm text-on-surface-variant">배송 추적, 납품 확인, 세금계산서 발행까지 한 곳에서 처리합니다</p>
</div>
</div>
</div>
</section>

{/* Reviews Section */}
<section id="reviews" className="py-32 bg-surface-container-low">
<div className="max-w-7xl mx-auto px-8">
<div className="grid lg:grid-cols-2 gap-24 items-center">
<div className="space-y-8">
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
</div>
<div className="grid grid-cols-2 gap-6">
<div className="space-y-6 pt-12">
<div className="bg-surface-container p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"알림 놓칠 걱정이 없어졌어요."</p>
<div className="text-xs text-on-surface-variant">박OO 간호사</div>
</div>
<div className="bg-surface-container p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"세금계산서까지 자동 정리돼서 편해요."</p>
<div className="text-xs text-on-surface-variant">이OO 사무장</div>
</div>
</div>
<div className="space-y-6">
<div className="bg-surface-container p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"식약처 코드 자동 매칭이 정말 좋아요."</p>
<div className="text-xs text-on-surface-variant">최OO 원장</div>
</div>
<div className="bg-surface-container p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"모바일 연동이 너무 깔끔합니다."</p>
<div className="text-xs text-on-surface-variant">정OO 팀장</div>
</div>
</div>
</div>
</div>
</div>
</section>

{/* CTA Section */}
<section id="contact" className="px-8 pb-32">
<div className="max-w-7xl mx-auto relative rounded-xl bg-primary-container overflow-hidden p-16 md:p-32 text-center">
<div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
<div className="relative z-10 space-y-8">
<h2 className="text-5xl md:text-7xl font-headline font-bold text-on-primary-container tracking-tighter">지금 바로<br/><span className="text-primary">시작하세요</span></h2>
<p className="text-xl text-on-primary-container/80 max-w-2xl mx-auto">카카오톡 주문 메시지, 아직 수작업으로 정리하고 계신가요? NotiFlow로 주문관리를 자동화하세요.</p>
<div className="flex flex-col md:flex-row justify-center gap-4">
<Link href="/login" className="bg-primary text-on-primary px-12 py-5 rounded-full font-bold text-xl shadow-lg hover:shadow-primary/30 transition-all">무료로 시작하기</Link>
<a href="mailto:support@notiflow.life" className="bg-white/50 backdrop-blur-sm text-primary px-12 py-5 rounded-full font-bold text-xl border border-primary/20 hover:bg-white transition-all">문의하기</a>
</div>
</div>
</div>
</section>
</main>

<footer className="w-full rounded-t-[3rem] mt-20 bg-emerald-50">
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
</footer>

    </div>
  );
}
