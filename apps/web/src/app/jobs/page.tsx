import Link from "next/link";
import { ArrowLeft, Sparkles, Code, Layout, Brain } from "lucide-react";

export default function JobsPage() {
  const openings = [
    { title: "Senior AI Engineer", team: "Engineering", type: "Full-time / Remote" },
    { title: "Frontend Developer (React)", team: "Product", type: "Full-time / Remote" },
    { title: "Service Operations", team: "Customer Success", type: "Full-time" }
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <header className="px-4 lg:px-12 h-20 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm text-zinc-400">
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </header>

      <main className="container max-w-4xl mx-auto py-24 px-4">
        <div className="space-y-20">
          <div className="space-y-8 text-center">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter">함께 <span className="text-blue-600">미래</span>를 그릴 분을 찾습니다</h1>
            <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto leading-relaxed">
              NotiFlow는 기술을 통해 사람들의 업무 시간을 되찾아주는 일을 합니다. 
              우리의 성장에 함께 올라타세요.
            </p>
          </div>

          <div className="bg-blue-600 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl">
             <div className="relative z-10 space-y-6">
                <h2 className="text-3xl font-black tracking-tight">Our Culture</h2>
                <div className="grid sm:grid-cols-2 gap-8">
                   {[
                     { icon: <Sparkles className="h-5 w-5" />, t: "Extreme Autonomy", d: "우리는 결과로 증명하며, 일하는 방식은 스스로 결정합니다." },
                     { icon: <Brain className="h-5 w-5" />, t: "AI First", d: "모든 문제 해결의 시작에 AI의 가능성을 열어둡니다." }
                   ].map((c, i) => (
                     <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2 font-black">{c.icon} {c.t}</div>
                        <p className="text-blue-100 text-sm font-medium leading-relaxed opacity-80">{c.d}</p>
                     </div>
                   ))}
                </div>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="space-y-8">
            <h2 className="text-3xl font-black tracking-tight border-b border-zinc-100 pb-6 text-zinc-900">Current Openings</h2>
            <div className="grid gap-4">
              {openings.map((job, i) => (
                <div key={i} className="group p-8 rounded-3xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-blue-600 hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900">{job.title}</h3>
                    <div className="flex gap-3 text-xs font-bold text-zinc-400 mt-1 uppercase tracking-widest">
                       <span>{job.team}</span>
                       <span>•</span>
                       <span className="text-blue-600">{job.type}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
