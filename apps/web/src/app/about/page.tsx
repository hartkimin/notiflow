import Link from "next/link";
import { Activity, ArrowLeft, Target, Eye, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <header className="px-4 lg:px-12 h-20 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm">
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </header>

      <main className="container max-w-4xl mx-auto py-24 px-4">
        <div className="space-y-16">
          <div className="space-y-6 text-center">
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/20">
                <Activity className="h-10 w-10" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter">의료 유통의 <span className="text-blue-600">디지털 비서</span></h1>
            <p className="text-xl text-zinc-500 font-medium leading-relaxed max-w-2xl mx-auto">
              NotiFlow는 인공지능 기술을 통해 소규모 의료 유통사의 업무 방식을 혁신합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Target className="h-6 w-6" />, title: "Mission", desc: "기술의 혜택이 대기업뿐만 아니라 1인 기업에게도 평등하게 전달되도록 합니다." },
              { icon: <Eye className="h-6 w-6" />, title: "Vision", desc: "대한민국 모든 의료 소모품 유통의 표준 자동화 플랫폼이 되는 것." },
              { icon: <Heart className="h-6 w-6" />, title: "Values", desc: "사용자의 시간 가치를 최우선으로 생각하며, 신뢰할 수 있는 데이터를 제공합니다." }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-[2rem] bg-zinc-50 border border-zinc-100 space-y-4">
                <div className="text-blue-600">{item.icon}</div>
                <h3 className="text-xl font-black">{item.title}</h3>
                <p className="text-zinc-500 font-medium leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="prose prose-zinc lg:prose-xl max-w-none">
            <h2 className="text-3xl font-black mb-6 tracking-tight">우리가 해결하고자 하는 문제</h2>
            <p className="text-zinc-600 mb-6 font-medium leading-relaxed">
              매일 아침 수십, 수백 통씩 쏟아지는 카카오톡과 문자 주문 메시지. 1인 관리자 혹은 작은 규모의 팀에게 이 메시지들을 하나하나 읽고 엑셀에 옮겨 담는 작업은 가장 고통스러운 업무 중 하나입니다. 오타 하나가 오배송으로 이어지고, 이는 곧 비용과 신뢰의 손실로 직결됩니다.
            </p>
            <p className="text-zinc-600 mb-12 font-medium leading-relaxed">
              NotiFlow는 이 '단순 반복 업무'를 AI에게 맡기고, 사람은 더 가치 있는 '영업과 관계'에 집중해야 한다는 믿음에서 시작되었습니다. 우리는 가장 진보된 AI 파싱 기술을 누구나 쉽고 저렴하게 사용할 수 있도록 제공합니다.
            </p>
            
            <div className="aspect-video rounded-[3rem] overflow-hidden shadow-2xl relative group">
               <img 
                src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=1000" 
                alt="Our Team Working" 
                className="w-full h-full object-cover"
               />
               <div className="absolute inset-0 bg-blue-600/10 mix-blend-multiply" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
