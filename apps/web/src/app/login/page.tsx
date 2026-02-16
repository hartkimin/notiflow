import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Package2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="hidden bg-muted lg:block">
        <div className="flex flex-col justify-between h-full p-8 text-white bg-zinc-900">
           <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <Package2 className="h-6 w-6" />
            <span className="">NotiFlow</span>
          </Link>
          <div className="text-4xl font-bold leading-snug">
            주문 관리의 새로운 기준,
            <br />
            지금 경험해보세요.
          </div>
          <div className="text-sm">
            &copy; 2025 NotiFlow. All rights reserved.
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">로그인</h1>
            <p className="text-balance text-muted-foreground">
              계정 정보를 입력하여 대시보드에 접속하세요.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
          <div className="mt-4 text-center text-sm">
            계정이 없으신가요?{" "}
            <Link href="#" className="underline">
              가입하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
