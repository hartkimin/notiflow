import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Package2, Cpu, FileText, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <Link href="#" className="flex items-center justify-center">
          <Package2 className="h-6 w-6" />
          <span className="sr-only">NotiFlow</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-sm font-medium"
            )}
          >
            로그인
          </Link>
          <Link
            href="/orders"
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-sm font-medium"
            )}
          >
            시작하기
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-muted/20">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    AI가 주문관리를 자동화하는, NotiFlow
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    문자, 카카오톡으로 들어오는 복잡한 주문들을 AI가 자동으로 분석하고, 재고 관리부터 배송까지 한번에 처리하세요.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg">
                    <Link href="/orders">지금 바로 시작하기</Link>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block">
                 <Cpu size={300} className="mx-auto text-primary/10" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  주요 기능
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  단순 업무는 줄이고, 비즈니스는 성장시키세요
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  수작업으로 하던 모든 주문 처리 과정을 자동화하여, 직원은 더 중요한 일에 집중할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <div className="grid gap-1 text-center">
                <Cpu className="h-12 w-12 mx-auto text-primary" />
                <h3 className="text-xl font-bold">AI 메시지 분석</h3>
                <p className="text-muted-foreground">
                  비정형적인 주문 메시지를 AI가 99% 정확도로 분석하여 품목, 수량, 주소를 자동으로 추출합니다.
                </p>
              </div>
              <div className="grid gap-1 text-center">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <h3 className="text-xl font-bold">자동 주문 생성</h3>
                <p className="text-muted-foreground">
                  분석된 데이터를 기반으로 ERP 시스템에 필요한 정형화된 주문서를 자동으로 생성하고 전송합니다.
                </p>
              </div>
              <div className="grid gap-1 text-center">
                <BarChart2 className="h-12 w-12 mx-auto text-primary" />
                <h3 className="text-xl font-bold">실시간 현황 관리</h3>
                <p className="text-muted-foreground">
                  대시보드에서 모든 주문과 배송 현황을 실시간으로 확인하고, 매출 통계까지 한눈에 파악하세요.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          &copy; 2024 NotiFlow. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
