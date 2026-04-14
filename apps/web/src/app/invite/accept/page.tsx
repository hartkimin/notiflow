"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeInviteSetup } from "@/lib/actions";
import { Lock, User, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

type Stage = "verifying" | "form" | "error" | "done";

export default function InviteAcceptPage() {
  const [stage, setStage] = useState<Stage>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function verifyInviteToken() {
      // token_hash + type are passed as query params by Supabase
      const params = new URLSearchParams(window.location.search);
      const token_hash = params.get("token_hash");
      const type = params.get("type");

      if (!token_hash || type !== "invite") {
        setErrorMsg("유효하지 않은 초대 링크입니다.");
        setStage("error");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "invite" });

      if (error) {
        if (error.message.includes("expired") || error.message.includes("invalid")) {
          setErrorMsg("초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 초대를 요청하세요.");
        } else {
          setErrorMsg(`초대 확인 실패: ${error.message}`);
        }
        setStage("error");
        return;
      }

      setStage("form");
    }

    verifyInviteToken();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password !== confirm) {
      setFormError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setFormError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (!name.trim()) {
      setFormError("이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await completeInviteSetup({ name: name.trim(), password });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setStage("done");
      setTimeout(() => router.push("/dashboard"), 1800);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">NotiFlow</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {stage === "verifying" && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-2 border-[#1a73e8]/30 border-t-[#1a73e8] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">초대 링크를 확인하는 중입니다...</p>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">초대 링크 오류</h1>
              <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
              <a
                href="/login"
                className="text-sm text-[#1a73e8] hover:underline"
              >
                로그인 페이지로 이동
              </a>
            </div>
          )}

          {stage === "form" && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">계정 설정</h1>
                <p className="text-sm text-gray-500">이름과 비밀번호를 설정하면 팀에 합류됩니다.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="비밀번호 재입력"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      팀 합류하기 <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                {["조직 자동 합류", "역할 자동 설정", "즉시 접근 가능"].map((label) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === "done" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">팀 합류 완료!</h1>
              <p className="text-sm text-gray-500">대시보드로 이동합니다...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
