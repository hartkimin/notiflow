# Landing Page Redesign — Elegant Medical + Framer Motion

**Date:** 2026-03-24
**Status:** Approved
**Branch:** feat/vector-embedding-pipeline

## Goal

Transform the NotiFlow landing page from a static page into a premium, animated experience. Maintain the existing Elegant Medical tone (bright, clean, trustworthy) while adding rich scroll-driven and interaction-based animations using Framer Motion.

## Current State

- Single file: `apps/web/src/app/page.tsx` (~313 lines, Server Component)
- 8 sections: Nav, Hero, Trust Stats, Features (bento grid), Workflow (4 steps), Reviews, CTA, Footer
- Only animation: `animate-float` CSS keyframe on one card
- Hero has emoji placeholders (`📱💊`) instead of product visuals
- Tailwind CSS 4 with Material Design 3 color tokens in `globals.css`

## Design Decisions

### Direction: Elegant Medical + Dashboard Preview Hero
- Keep bright, clean medical aesthetic — no dark mode hero
- Hero shows a miniature dashboard mockup (replacing emoji placeholders) to demonstrate the actual product
- All animations are smooth, professional — no flashy or playful effects

### Tech: Framer Motion
- React ecosystem standard for declarative animations
- scroll-in-view triggers, variants, layout animations, stagger
- ~40KB gzipped addition to bundle

## Architecture

### Component Structure

```
apps/web/src/app/page.tsx          (Server Component — thin wrapper, imports LandingClient)
apps/web/src/app/landing-client.tsx ('use client' — all animation logic + sections)
```

`page.tsx` stays as a Server Component that imports the client component. All Framer Motion usage lives in `landing-client.tsx` since it requires `'use client'`.

Helper hooks/utilities (if needed):
- `useCountUp(target, duration)` — for Trust Stats number animation
- Shared Framer Motion variants object for consistent stagger timing

### No new files beyond:
- `landing-client.tsx` — main client component with all sections
- Minor edits to `page.tsx` — replace inline JSX with `<LandingClient />`

## Section-by-Section Spec

### 1. Nav (AnimatedNav)
- **Current:** Fixed top nav with blur backdrop
- **Change:** On scroll > 50px, reduce padding (py-4 → py-2), increase blur, add subtle bottom border. Smooth CSS transition (no Framer Motion needed here — CSS `transition` is sufficient for this).
- **No structural change** to nav content or links

### 2. Hero Section
- **Left column:**
  - Badge: fade-in-down on mount (delay 0ms)
  - Headline: lines reveal with stagger (delay 200ms between lines). Each line slides up + fades in.
  - Subtext: fade-in (delay 600ms)
  - CTA buttons: fade-in + slide-up (delay 800ms)
- **Right column — Dashboard Mockup:**
  - Replace current emoji placeholder with a styled dashboard miniature
  - Content: browser chrome (3 dots), stat cards (127 orders, 98.7% accuracy, 23 suppliers), mini order table with 3 rows showing order IDs and statuses
  - Animation: fade-in + slight scale (0.95 → 1.0) + perspective tilt (`rotateY(-5deg)` → `0deg`)
  - Floating effect: continuous subtle `y` oscillation (CSS `animate-float` already exists)
  - Glow: soft green box-shadow pulse behind the mockup
- **Background:** Keep `digital-meadow-gradient`, add subtle parallax (background moves at 0.5x scroll speed via Framer Motion `useScroll` + `useTransform`)

### 3. Trust Stats
- **Trigger:** when section enters viewport (whileInView)
- **Animation:** each number counts up from 0 to target value over 2 seconds with easeOut
  - 98.7% → count from 0.0 to 98.7
  - 5초 → count from 0 to 5
  - 24/7 → fade-in only (not a countable number)
  - 100% → count from 0 to 100
- **Stagger:** 150ms delay between each stat
- Numbers use `tabular-nums` font feature for stable width during counting

### 4. Features (Bento Grid)
- **Trigger:** stagger reveal as cards enter viewport
- **Animation:** each card slides up 30px + fades in. Stagger 100ms between cards.
- **Hover:** scale(1.02) + enhanced shadow. Existing blur orb animation on the first card stays.
- **No layout changes** — keep current bento grid structure (2-col + 1-col + 1-col + 2-col)

### 5. Workflow (4 Steps)
- **Trigger:** sequential reveal as section enters viewport
- **Animation:**
  - Each step card: fade-in + slide-up, stagger 200ms
  - Between cards: a connecting line (horizontal on desktop, vertical on mobile) draws from left to right using `scaleX` animation
  - Step numbers: scale pop (0 → 1) when revealed
- **No content changes**

### 6. Reviews
- **Left (main quote):** fade-in + slide from left (x: -30 → 0)
- **Right (review cards grid):** stagger fade-in, 100ms between cards
- **Star ratings:** quick sequential reveal (like a "filling" effect)
- **No content changes**

### 7. CTA Section
- **Trigger:** viewport entry
- **Animation:** entire section scales from 0.9 → 1.0 + fades in
- **CTA button:** subtle pulse animation (box-shadow breathing) after reveal completes
- **No content changes**

### 8. Footer
- Simple fade-in on viewport entry. No other changes.

## What Does NOT Change
- Color system / design tokens in `globals.css`
- Section order and content text (Korean copy stays identical)
- Nav links and routing (`/login`, anchor links)
- Font choices (Pretendard, Material Symbols)
- Responsive breakpoints and grid structure
- Any dashboard or app routes — this is landing page only

## Performance Considerations
- Framer Motion `whileInView` with `once: true` — animations play once, not on every scroll
- `viewport.amount: 0.3` — trigger when 30% of element is visible
- No heavy assets (no video, no Lottie) — all animations are CSS transforms + opacity
- Dashboard mockup is pure HTML/CSS, not an image
- Parallax uses `will-change: transform` for GPU acceleration

## Testing
- Visual verification: scroll through all sections, confirm animations trigger correctly
- Mobile: verify animations are smooth on smaller viewports
- Performance: no layout shift (CLS), animations use transform/opacity only (no width/height animation)
