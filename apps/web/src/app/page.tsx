import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Cpu,
  FileText,
  BarChart2,
  MessageSquare,
  Zap,
  ArrowRight,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center bg-background/95 backdrop-blur-sm sticky top-0 z-50 border-b">
        <Link href="#" className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Noti<span className="text-primary">Flow</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm font-medium"
            )}
          >
            로그인
          </Link>
          <Link
            href="/orders"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "text-sm font-medium"
            )}
          >
            시작하기
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 lg:py-40 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary/3 rounded-full blur-3xl" />
          </div>

          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                AI 기반 주문 자동화 플랫폼
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                메시지가 도착하면,{" "}
                <span className="text-primary">주문이 완성됩니다</span>
              </h1>

              <p className="max-w-[640px] text-lg text-muted-foreground md:text-xl leading-relaxed">
                카카오톡, SMS로 들어오는 비정형 주문 메시지를 AI가 실시간 분석하여
                품목 추출부터 주문서 생성까지 자동으로 처리합니다.
              </p>

              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Button asChild size="lg" className="text-base px-8">
                  <Link href="/orders">
                    무료로 시작하기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8">
                  <Link href="#features">기능 살펴보기</Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  실시간 처리
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  멀티 AI 지원
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  모바일 연동
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-28 border-t bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                주요 기능
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                단순 업무는 줄이고,<br className="hidden sm:block" /> 비즈니스는 성장시키세요
              </h2>
              <p className="max-w-[700px] text-muted-foreground md:text-lg">
                수작업으로 하던 모든 주문 처리 과정을 자동화하여,
                직원은 더 중요한 일에 집중할 수 있습니다.
              </p>
            </div>

            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
              <div className="group relative rounded-2xl border bg-background p-8 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI 메시지 분석</h3>
                <p className="text-muted-foreground leading-relaxed">
                  비정형 주문 메시지를 Claude, Gemini, GPT 등 멀티 AI가 분석하여
                  품목, 수량, 단위를 자동 추출합니다.
                </p>
              </div>

              <div className="group relative rounded-2xl border bg-background p-8 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">자동 주문 생성</h3>
                <p className="text-muted-foreground leading-relaxed">
                  분석된 데이터를 기반으로 거래처별 주문서를 자동 생성하고,
                  신뢰도 기준으로 자동 확정 또는 검토 대기 분류합니다.
                </p>
              </div>

              <div className="group relative rounded-2xl border bg-background p-8 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <BarChart2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">실시간 현황 관리</h3>
                <p className="text-muted-foreground leading-relaxed">
                  대시보드에서 주문, 배송, 매출 현황을 실시간으로 확인하고
                  거래처별 통계까지 한눈에 파악하세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="w-full py-20 md:py-28 border-t">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                작동 방식
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                3단계로 끝나는 주문 처리
              </h2>
            </div>

            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  1
                </div>
                <h3 className="text-lg font-semibold">메시지 수신</h3>
                <p className="text-sm text-muted-foreground">
                  카카오톡, SMS 주문 메시지가 모바일 앱을 통해 실시간 수집됩니다.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  2
                </div>
                <h3 className="text-lg font-semibold">AI 파싱</h3>
                <p className="text-sm text-muted-foreground">
                  AI가 메시지를 분석하여 품목명, 수량, 단위를 추출하고 제품 DB와 매칭합니다.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  3
                </div>
                <h3 className="text-lg font-semibold">주문 확정</h3>
                <p className="text-sm text-muted-foreground">
                  높은 신뢰도는 자동 확정, 낮은 신뢰도는 대시보드에서 검토 후 확정합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-28 border-t bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                지금 바로 시작하세요
              </h2>
              <p className="text-muted-foreground md:text-lg">
                복잡한 설정 없이 바로 사용할 수 있습니다.
                AI가 주문 업무를 대신하는 경험을 해보세요.
              </p>
              <Button asChild size="lg" className="text-base px-8">
                <Link href="/orders">
                  NotiFlow 시작하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20">
        <div className="container flex flex-col gap-4 sm:flex-row py-8 items-center px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">
              Noti<span className="text-primary">Flow</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            &copy; 2026 NotiFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
