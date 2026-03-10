"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "deactivated") return "비활성화된 계정입니다.";
    if (errorParam === "no_profile") return "등록되지 않은 사용자입니다. 관리자에게 문의하세요.";
    return "";
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });

    if (authError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold tracking-tight">이메일 주소</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="name@hospital.com"
            required 
            autoFocus 
            className="h-12 px-4 rounded-xl border-border/50 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold tracking-tight">비밀번호</Label>
            <a href="#" className="text-xs font-medium text-primary hover:underline">비밀번호 찾기</a>
          </div>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            placeholder="••••••••"
            required 
            className="h-12 px-4 rounded-xl border-border/50 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium animate-in fade-in zoom-in-95 duration-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30" 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            로그인 중...
          </>
        ) : (
          "로그인"
        )}
      </Button>
    </form>
  );
}
