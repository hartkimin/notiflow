# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static NotiFlow landing page into a premium animated experience with Framer Motion — Elegant Medical aesthetic, Dashboard Preview hero, scroll reveals, micro-interactions, parallax, and count-up stats.

**Architecture:** Single `'use client'` component (`landing-client.tsx`) contains all animated sections. The existing `page.tsx` becomes a thin Server Component wrapper. A `useCountUp` hook handles number animations. All Framer Motion animations use `whileInView` with `once: true`.

**Tech Stack:** Framer Motion 12, React 19, Tailwind CSS 4, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-24-landing-page-redesign-design.md`

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install framer-motion**

```bash
cd apps/web && npm install framer-motion
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/web && node -e "require('framer-motion'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Verify build still works**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run build:web
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Create landing-client.tsx scaffold + wire up page.tsx

Move all landing page JSX from `page.tsx` into a new `'use client'` component. `page.tsx` becomes a thin wrapper. No animation logic yet — just the structural move. The page should look identical after this task.

**Files:**
- Create: `apps/web/src/app/landing-client.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create `landing-client.tsx`**

Create the file with `'use client'` directive. Move ALL JSX from the current `page.tsx` `LandingPage` component into a new `LandingClient` component. Keep all imports (`Link` from `next/link`). The outer wrapper div, nav, main, all sections, and footer — everything moves.

```tsx
'use client';

import Link from "next/link";

export default function LandingClient() {
  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* === PASTE ALL EXISTING JSX FROM page.tsx HERE === */}
      {/* Nav, Hero, Trust, Features, Workflow, Reviews, CTA, Footer */}
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` to import `LandingClient`**

Replace all JSX in `page.tsx` with a single import:

```tsx
import LandingClient from "./landing-client";

export default function LandingPage() {
  return <LandingClient />;
}
```

- [ ] **Step 3: Verify visually**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run dev:web
```

Open `http://localhost:3000` — page should look identical to before.

- [ ] **Step 4: Verify build**

```bash
npm run build:web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/landing-client.tsx
git commit -m "refactor: extract landing page into client component"
```

---

### Task 3: Animated Nav (scroll-responsive)

Add scroll-responsive behavior to the nav: on scroll > 50px, reduce padding and increase blur. Pure CSS transitions, no Framer Motion needed.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Add scroll state**

At the top of `LandingClient`, add:

```tsx
import { useEffect, useState } from "react";

// Inside component:
const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 50);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);
```

- [ ] **Step 2: Apply dynamic classes to nav**

Replace the `<nav>` className with:

```tsx
<nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
  scrolled
    ? "bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,106,52,0.10)] py-0"
    : "bg-white/70 backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,106,52,0.06)]"
}`}>
<div className={`flex justify-between items-center px-8 max-w-7xl mx-auto transition-all duration-300 ${
  scrolled ? "py-2" : "py-4"
}`}>
```

- [ ] **Step 3: Verify** — scroll down, nav should shrink smoothly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: add scroll-responsive nav animation"
```

---

### Task 4: Hero Section — Dashboard Mockup + Stagger Animations

Replace the emoji placeholder hero with a dashboard mockup. Add stagger fade-in animations for headline/text/buttons. Add perspective tilt for the mockup.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Add Framer Motion imports**

At the top of `landing-client.tsx`:

```tsx
import { motion, useScroll, useTransform } from "framer-motion";
```

- [ ] **Step 2: Define shared animation variants**

Before the component return, add:

```tsx
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};
```

- [ ] **Step 3: Animate hero left column**

Replace the hero left column `<div className="space-y-8">` content with motion elements. Wrap each piece (badge, h1, p, buttons) in `motion.div` with the `fadeInUp` variant:

```tsx
<motion.div
  className="space-y-8"
  initial="hidden"
  animate="visible"
>
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
```

- [ ] **Step 4: Replace hero right column with Dashboard Mockup**

Replace the entire `<div className="relative group">` block (lines 50-79 in original) with:

```tsx
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
      {/* Stat cards row */}
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
      {/* Mini order table */}
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
```

- [ ] **Step 5: Add hero background parallax**

Wrap the hero section. Before the hero `<section>`, add:

```tsx
const { scrollYProgress } = useScroll();
const heroParallaxY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);
```

Then wrap the hero background gradient div:

```tsx
<motion.div className="absolute inset-0 digital-meadow-gradient opacity-40 -z-10" style={{ y: heroParallaxY }}></motion.div>
```

- [ ] **Step 6: Verify** — page loads with stagger animations, dashboard mockup visible, parallax on scroll.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: animated hero section with dashboard mockup and parallax"
```

---

### Task 5: Trust Stats — Count-Up Animation

Add viewport-triggered count-up animation for stat numbers.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Add useCountUp hook**

Add this hook inside `landing-client.tsx` (above the component):

```tsx
import { useRef, useCallback } from "react";
import { useInView } from "framer-motion";

function useCountUp(end: number, duration = 2000, decimals = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(decimals > 0 ? "0.0" : "0");

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3); // easeOutCubic
      const current = eased * end;
      setDisplay(current.toFixed(decimals));
      if (elapsed < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration, decimals]);

  return { ref, display };
}
```

- [ ] **Step 2: Replace Trust Stats section**

Replace the Trust Stats section with animated versions:

```tsx
{/* Trust Section */}
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
```

- [ ] **Step 3: Add TrustStat components**

Add above the main component (but below the hook):

```tsx
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
```

- [ ] **Step 4: Verify** — scroll to Trust section, numbers count up smoothly from 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: trust stats count-up animation on scroll"
```

---

### Task 6: Features Bento Grid — Stagger Reveal + Hover

Add stagger scroll-reveal to each feature card and enhanced hover effects.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Wrap features heading in motion**

```tsx
<motion.div
  className="text-center mb-20 space-y-4"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.5 }}
  transition={{ duration: 0.6 }}
>
  {/* existing h2 and p */}
</motion.div>
```

- [ ] **Step 2: Wrap each feature card in motion.div**

Wrap each of the 5 feature cards in the grid. Use stagger via custom index:

```tsx
<div className="grid md:grid-cols-3 gap-8">
  {[0, 1, 2, 3, 4].map is not needed — wrap each card individually:
```

For each card, wrap like this (adjusting `custom` index 0-4):

```tsx
<motion.div
  className="md:col-span-2 rounded-xl bg-surface-container-low p-12 flex flex-col justify-between group overflow-hidden relative"
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, delay: 0 * 0.1 }}
  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
>
  {/* existing card content */}
</motion.div>
```

Repeat for cards at index 1, 2, 3, 4 with `delay: N * 0.1`.

- [ ] **Step 3: Verify** — scroll to features, cards stagger in. Hover causes subtle scale.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: features bento grid stagger reveal and hover animation"
```

---

### Task 7: Workflow Steps — Sequential Reveal + Connecting Line

Add sequential fade-in for workflow steps and a connecting line that draws between them.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Animate workflow heading**

Same pattern as features heading — wrap in `motion.div` with `whileInView`.

- [ ] **Step 2: Replace workflow grid with animated version**

```tsx
<div className="grid md:grid-cols-4 gap-8 relative">
  {/* Connecting line — horizontal on desktop, vertical on mobile */}
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
```

- [ ] **Step 3: Verify** — workflow steps appear sequentially with number pop, connecting line draws.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: workflow steps sequential reveal with connecting line"
```

---

### Task 8: Reviews Section — Stagger Reveal

Add slide-from-left for main quote, stagger reveal for review cards.

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Animate main quote (left column)**

Wrap the left column `<div className="space-y-8">`:

```tsx
<motion.div
  className="space-y-8"
  initial={{ opacity: 0, x: -30 }}
  whileInView={{ opacity: 1, x: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6 }}
>
  {/* existing h2 and quote */}
</motion.div>
```

- [ ] **Step 2: Animate review cards (right column)**

Wrap each of the 4 review card `<div className="bg-surface-container p-6 rounded-lg space-y-3">` blocks with `motion.div`:

```tsx
<motion.div
  className="bg-surface-container p-6 rounded-lg space-y-3"
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.4, delay: N * 0.1 }}
>
```

Where N = 0, 1, 2, 3 for the four cards (top-left, bottom-left, top-right, bottom-right).

- [ ] **Step 3: Verify** — reviews animate on scroll.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/landing-client.tsx
git commit -m "feat: reviews section stagger reveal animation"
```

---

### Task 9: CTA Section — Scale Reveal + Button Pulse

**Files:**
- Modify: `apps/web/src/app/landing-client.tsx`

- [ ] **Step 1: Animate CTA container**

Wrap the CTA inner container:

```tsx
<motion.div
  className="max-w-7xl mx-auto relative rounded-xl bg-primary-container overflow-hidden p-16 md:p-32 text-center"
  initial={{ opacity: 0, scale: 0.9 }}
  whileInView={{ opacity: 1, scale: 1 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
>
```

- [ ] **Step 2: Add CSS pulse to CTA button**

Add to `globals.css`:

```css
@keyframes pulse-shadow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 106, 52, 0.3); }
  50% { box-shadow: 0 0 0 12px rgba(0, 106, 52, 0); }
}
.animate-pulse-shadow {
  animation: pulse-shadow 2s ease-in-out infinite;
}
```

Then add `animate-pulse-shadow` class to the main CTA Link button.

- [ ] **Step 3: Animate footer**

```tsx
<motion.footer
  className="w-full rounded-t-[3rem] mt-20 bg-emerald-50"
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
```

- [ ] **Step 4: Verify** — CTA scales in, button pulses, footer fades.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/landing-client.tsx apps/web/src/app/globals.css
git commit -m "feat: CTA scale reveal with pulse button and footer fade-in"
```

---

### Task 10: Final Build Verification + Lint

**Files:**
- All modified files

- [ ] **Step 1: Run lint**

```bash
npm run lint:web
```

Expected: No errors. Fix any issues.

- [ ] **Step 2: Run production build**

```bash
npm run build:web
```

Expected: Build succeeds. Check output for any warnings.

- [ ] **Step 3: Visual walkthrough**

Start dev server, scroll through entire page top to bottom. Verify:
- Nav shrinks on scroll
- Hero animates on load (stagger text + dashboard mockup with tilt)
- Background has subtle parallax
- Trust stats count up when scrolled into view
- Feature cards stagger reveal + hover scale
- Workflow steps appear sequentially with connecting line
- Reviews slide in from left + cards stagger
- CTA scales in + button pulses
- Footer fades in
- No animation jank or layout shift on mobile viewport

- [ ] **Step 4: Final commit (if any lint fixes)**

```bash
git add -A
git commit -m "fix: lint and build issues from landing page redesign"
```
