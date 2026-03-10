import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";

export default function BlogPage() {
  const posts = [
    {
      title: "의료 유통업계의 AI 도입이 시급한 이유",
      date: "2026.03.05",
      author: "Tech Team",
      excerpt: "단순 반복 업무에서 해방되어 핵심 비즈니스에 집중하는 방법을 알아봅니다.",
      image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000"
    },
    {
      title: "Claude 3.5를 활용한 고정밀 파싱 알고리즘",
      date: "2026.02.20",
      author: "AI Engineer",
      excerpt: "비정형 텍스트 주문 메시지를 99% 정확도로 추출하는 기술적 배경을 공유합니다.",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000"
    },
    {
      title: "1인 기업의 유통 관리 노하우: 자동화가 답이다",
      date: "2026.01.15",
      author: "Service Design",
      excerpt: "효율적인 리소스 관리로 혼자서도 수천 건의 주문을 소화하는 관리자의 인터뷰.",
      image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=1000"
    }
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <header className="px-4 lg:px-12 h-20 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm">
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </header>

      <main className="container max-w-6xl mx-auto py-24 px-4">
        <div className="mb-20 text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter">NotiFlow <span className="text-blue-600">Blog</span></h1>
          <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto tracking-tight">
            기술로 혁신하는 의료 유통 현장의 이야기를 전해드립니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {posts.map((post, i) => (
            <article key={i} className="group cursor-pointer">
              <div className="aspect-[16/10] rounded-[2rem] overflow-hidden bg-zinc-100 mb-8 shadow-xl transition-transform duration-500 group-hover:-translate-y-2">
                <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs font-bold text-blue-600 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {post.date}</span>
                  <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> {post.author}</span>
                </div>
                <h3 className="text-2xl font-black leading-tight group-hover:text-blue-600 transition-colors">{post.title}</h3>
                <p className="text-zinc-500 font-medium leading-relaxed">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
