import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* Top Navigation Shell */}


<nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,106,52,0.06)]">
<div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
<div className="flex items-center gap-2">
<span className="text-2xl font-bold tracking-tighter text-primary font-headline">Notiflow</span>
</div>
<div className="hidden md:flex items-center gap-8">
<a className="text-primary font-bold border-b-2 border-primary-fixed font-headline text-sm tracking-tight transition-colors duration-300" href="#">Features</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#">Dashboard</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#">Testimonials</a>
<a className="text-on-surface-variant font-medium font-headline text-sm tracking-tight hover:text-primary transition-colors duration-300" href="#">Pricing</a>
</div>
<div className="flex items-center gap-4">
<button className="text-sm font-semibold text-on-surface px-4 py-2 hover:translate-x-1 duration-200">Login</button>
<button className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-sm active:scale-95 transition-all">Get Started</button>
</div>
</div>
</nav>
<main className="pt-24">

<section className="relative min-h-[921px] flex items-center overflow-hidden px-8">
<div className="absolute inset-0 digital-meadow-gradient opacity-40 -z-10"></div>
<div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center w-full">
<div className="space-y-8">
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container text-xs font-bold font-headline tracking-wider uppercase">
<span className="material-symbols-outlined text-sm" data-icon="energy_savings_leaf">energy_savings_leaf</span>
                        Fresh for Spring 2024
                    </div>
<h1 className="text-6xl md:text-8xl font-headline font-bold text-on-surface tracking-tighter leading-[0.9] text-glow">
                        Flow with <br/><span className="text-primary">Clarity.</span>
</h1>
<p className="text-xl text-on-surface-variant leading-relaxed max-w-lg">
                        Streamline your team's communication with the organic simplicity of Notiflow. Built to help you breathe, focus, and thrive in your most productive season yet.
                    </p>
<div className="flex flex-wrap gap-4">
<button className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-primary/20 transition-all hover:-translate-y-1">Start Free Trial</button>
<button className="flex items-center gap-2 text-on-surface font-bold px-8 py-4 rounded-full border border-outline-variant hover:bg-surface-container transition-all">
<span className="material-symbols-outlined" data-icon="play_circle">play_circle</span>
                            Watch Demo
                        </button>
</div>
</div>
<div className="relative group">
<div className="absolute -inset-4 bg-primary-container/20 blur-3xl rounded-full"></div>
<div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white">
<img alt="Productive Workspace" className="w-full h-[600px] object-cover transition-transform duration-700 group-hover:scale-105" data-alt="Sun-drenched modern workspace with lush green spring foliage outside" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAR9C0CLk6erGN1UTacVZCc7x-2-S7gVW1LQpS06gZzbBVry4QU47npUtlpQrTqBmbKxsJrOIn2sRurC-3ka1-BW8iewptOcXBnvX5QRyrFRHe4I7BWngbtIbau3V8p3MSC8ETCuSce6HV54zyEBnKLnfQ3zniG3YoZMuD0hkZvWoeXleMPYvbsekAAEjJyu4cxC83tBV6mzz8I6ZZC53OeaLVO0TZTje3oSZdWGwBz02WtHWtz5NdtXLp83BfzS-nhHNuHWuDG4-8"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>

<div className="absolute bottom-8 left-8 right-8 glass-panel p-6 rounded-lg shadow-lg border border-white/50 animate-float">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
<span className="material-symbols-outlined text-on-primary-fixed" data-icon="monitoring">monitoring</span>
</div>
<div>
<div className="text-xs font-bold text-primary font-headline uppercase">Live Pulse</div>
<div className="text-sm font-medium text-on-surface">Team Momentum</div>
</div>
</div>
<div className="text-primary font-bold">+24%</div>
</div>
<div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div className="h-full bg-primary w-[75%] rounded-full"></div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="py-24 bg-surface-container-low">
<div className="max-w-7xl mx-auto px-8">
<p className="text-center text-label-md font-headline font-semibold text-on-surface-variant/60 uppercase tracking-[0.2em] mb-12">Trusted by teams flourishing worldwide</p>
<div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
<div className="flex items-center gap-2 text-2xl font-headline font-bold">
<span className="material-symbols-outlined text-primary" data-icon="eco">eco</span> Leafy
                    </div>
<div className="flex items-center gap-2 text-2xl font-headline font-bold">
<span className="material-symbols-outlined text-primary" data-icon="shutter_speed">shutter_speed</span> Swift
                    </div>
<div className="flex items-center gap-2 text-2xl font-headline font-bold">
<span className="material-symbols-outlined text-primary" data-icon="cloud_done">cloud_done</span> Stratos
                    </div>
<div className="flex items-center gap-2 text-2xl font-headline font-bold">
<span className="material-symbols-outlined text-primary" data-icon="filter_vintage">filter_vintage</span> Bloom
                    </div>
</div>
</div>
</section>

<section className="py-32 px-8 max-w-7xl mx-auto">
<div className="text-center mb-20 space-y-4">
<h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight">Tools for a <span className="text-primary">Healthy Workspace.</span></h2>
<p className="text-on-surface-variant max-w-2xl mx-auto">Everything you need to keep your projects growing without the clutter of traditional tools.</p>
</div>
<div className="grid md:grid-cols-3 gap-8">

<div className="md:col-span-2 rounded-xl bg-surface-container-low p-12 flex flex-col justify-between group overflow-hidden relative">
<div className="relative z-10 space-y-4">
<div className="w-14 h-14 rounded-lg bg-primary-container flex items-center justify-center">
<span className="material-symbols-outlined text-primary text-3xl" data-icon="grid_view">grid_view</span>
</div>
<h3 className="text-3xl font-headline font-bold">Centralized Ecosystem</h3>
<p className="text-on-surface-variant max-w-sm">Bring your entire workflow into one sun-drenched dashboard. No more tab hopping, just pure focus.</p>
</div>
<div className="mt-8 relative z-10">
<button className="text-primary font-bold flex items-center gap-2 hover:gap-4 transition-all">
                            Explore Dashboard <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
</button>
</div>
<div className="absolute -right-16 -bottom-16 w-80 h-80 bg-white rounded-full blur-3xl opacity-50 group-hover:scale-125 transition-transform duration-1000"></div>
</div>

<div className="rounded-xl bg-primary text-on-primary p-12 flex flex-col justify-between shadow-xl shadow-primary/10">
<div className="space-y-4">
<span className="material-symbols-outlined text-4xl" data-icon="auto_awesome">auto_awesome</span>
<h3 className="text-2xl font-headline font-bold">Smart Filters</h3>
<p className="opacity-80">Our AI automatically silences the noise, highlighting only the petals of information that truly matter.</p>
</div>
</div>

<div className="rounded-xl bg-tertiary-container p-12 flex flex-col justify-between">
<div className="space-y-4">
<span className="material-symbols-outlined text-3xl text-on-tertiary-container" data-icon="diversity_3">diversity_3</span>
<h3 className="text-2xl font-headline font-bold text-on-tertiary-container">Team Vitality</h3>
<p className="text-on-tertiary-container/80">Monitor team wellbeing and workload balance in real-time with beautiful organic visualizations.</p>
</div>
</div>

<div className="md:col-span-2 rounded-xl bg-surface-container p-12 flex flex-col md:flex-row items-center gap-12 overflow-hidden">
<div className="flex-1 space-y-4">
<h3 className="text-3xl font-headline font-bold">Seamless Syncing</h3>
<p className="text-on-surface-variant">Wherever you go, Notiflow follows. Your digital meadow is perfectly synced across all devices.</p>
<div className="flex gap-4 pt-4">
<span className="material-symbols-outlined" data-icon="smartphone">smartphone</span>
<span className="material-symbols-outlined" data-icon="laptop_mac">laptop_mac</span>
<span className="material-symbols-outlined" data-icon="tablet_android">tablet_android</span>
</div>
</div>
<div className="flex-1">
<img alt="Devices" className="rounded-lg shadow-lg rotate-6 translate-x-12 translate-y-6" data-alt="Abstract composition of sleek mobile devices and digital surfaces" src="https://lh3.googleusercontent.com/aida-public/AB6AXuATTx-P3k34JwCCvco-ZtekdkjQuYVjw2av304xqgBautqjNryEIeCda49EHuiuio0LpULBBs1xLpKBsQXdzMW1e7bT1VmvouugVqzYNw1E6cphmP70w9uGlC4czN9GSSUgpmJj6XVUJQnCiW7pOAss-g7QzsA8dPZr-UMR4lXxdvbOKah6J11FRe7dz-hVyIYL76BPoRRak-lq2KdygcFotKY5FVrNBpGsSasELVaynxwi2FLDjkeK7KoCxq5dXrzxa6jNNHRoZ-8"/>
</div>
</div>
</div>
</section>

<section className="py-32 bg-surface">
<div className="max-w-7xl mx-auto px-8">
<div className="grid lg:grid-cols-2 gap-24 items-center">
<div className="space-y-8">
<h2 className="text-5xl font-headline font-bold tracking-tight">What our <span className="text-primary">Community</span> says.</h2>
<div className="relative p-12 rounded-xl glass-panel border border-primary/10 shadow-sm">
<span className="material-symbols-outlined text-6xl text-primary/20 absolute top-4 left-4" data-icon="format_quote">format_quote</span>
<p className="text-2xl text-on-surface leading-relaxed italic relative z-10">
                                "Notiflow didn't just organize our tasks; it changed how we feel about work. The interface is so peaceful, we actually look forward to checking our notifications."
                            </p>
<div className="mt-8 flex items-center gap-4">
<img alt="Profile" className="w-14 h-14 rounded-full object-cover" data-alt="Portrait of a smiling professional woman" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxCGzqlLECcHUervOeZi6E0wW3ypRVXUFvL96iBxes4ueu4oOpT73XHNutuVoBDtyBQiOErnGxrMDzi63QxsgJ6QVRfkLro1aFrjlrAV2nXif7Lc5DCtlTJVifoLvAKe5JQ5zhxIj52olTZ2T9LectFF0GQ3cym07byedMH1UbQrU8UZHMLgxQGJyLIdsartjW4ib3o6mQbgRR4yuc2yUhVjSZ-QBFKBvOTLnsXDsYh__D6FJJ_s267bagt1xS9pml_G2-2bcNtnY"/>
<div>
<div className="font-bold text-on-surface">Elena Vance</div>
<div className="text-sm text-on-surface-variant">Product Lead at Veridian</div>
</div>
</div>
</div>
</div>
<div className="grid grid-cols-2 gap-6">
<div className="space-y-6 pt-12">
<div className="bg-surface-container-low p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"Refreshing simplicity."</p>
<div className="text-xs text-on-surface-variant">Marcus T.</div>
</div>
<div className="bg-surface-container-low p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"Game changer for remote teams."</p>
<div className="text-xs text-on-surface-variant">Sarah K.</div>
</div>
</div>
<div className="space-y-6">
<div className="bg-surface-container-low p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"The best UI/UX I've used."</p>
<div className="text-xs text-on-surface-variant">Liam O.</div>
</div>
<div className="bg-surface-container-low p-6 rounded-lg space-y-3">
<div className="flex text-primary">
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
<span className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<p className="text-sm font-medium">"Organized and serene."</p>
<div className="text-xs text-on-surface-variant">Jessica W.</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="px-8 pb-32">
<div className="max-w-7xl mx-auto relative rounded-xl bg-primary-container overflow-hidden p-16 md:p-32 text-center">
<div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
<div className="relative z-10 space-y-8">
<h2 className="text-5xl md:text-7xl font-headline font-bold text-on-primary-container tracking-tighter">Ready to <span className="text-primary">Bloom?</span></h2>
<p className="text-xl text-on-primary-container/80 max-w-2xl mx-auto">Join over 15,000 teams who have found their focus with Notiflow. Start your 14-day free trial today.</p>
<div className="flex flex-col md:flex-row justify-center gap-4">
<button className="bg-primary text-on-primary px-12 py-5 rounded-full font-bold text-xl shadow-lg hover:shadow-primary/30 transition-all">Get Started Now</button>
<button className="bg-white/50 backdrop-blur-sm text-primary px-12 py-5 rounded-full font-bold text-xl border border-primary/20 hover:bg-white transition-all">View Pricing</button>
</div>
</div>
</div>
</section>
</main>

<footer className="w-full rounded-t-[3rem] mt-20 bg-emerald-50">
<div className="flex flex-col md:flex-row justify-between items-center px-12 py-16 w-full max-w-7xl mx-auto">
<div className="space-y-4 text-center md:text-left">
<div className="text-lg font-bold text-emerald-900 font-headline">Notiflow</div>
<p className="font-body text-sm text-emerald-900/60 max-w-xs">© 2024 Notiflow. Grown with Organic Vitality.</p>
</div>
<div className="flex flex-wrap justify-center gap-8 mt-12 md:mt-0">
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">Privacy Policy</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">Terms of Service</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">Contact Us</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">Twitter</a>
<a className="font-body text-sm text-emerald-900/60 hover:text-emerald-500 transition-all underline decoration-emerald-200 decoration-2 underline-offset-4 hover:translate-x-1 duration-200" href="#">LinkedIn</a>
</div>
</div>
</footer>

    </div>
  );
}
