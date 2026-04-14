"use client";

import { useState } from "react";
import Link from "next/link";
import { signupWithOrg } from "@/lib/signup-actions";
import { Building2, Mail, Lock, User, ArrowRight, CheckCircle2, MailCheck, KeyRound, FlaskConical } from "lucide-react";

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", name: "", companyName: "", inviteCode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signupWithOrg(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <MailCheck className="w-8 h-8 text-[#1a73e8]" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">이메일을 확인해주세요</h1>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{form.email}</span>으로
            </p>
            <p className="text-sm text-gray-500 mb-6">
              인증 링크를 보냈습니다. 링크를 클릭하면 계정이 활성화됩니다.
            </p>
            <p className="text-xs text-gray-400">
              이메일이 오지 않으면 스팸함을 확인하거나{" "}
              <Link href="/signup" className="text-[#1a73e8] hover:underline">
                다시 시도
              </Link>
              해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">NotiFlow</span>
          </div>
        </div>

        {/* 시범운영 안내 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
          <FlaskConical className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-0.5">현재 시범운영 중입니다</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              현재는 초대 코드가 있는 분만 가입이 가능합니다.
              가입을 원하시면{" "}
              <a href="mailto:jinzhangxun@gmail.com" className="font-medium underline hover:text-amber-900">
                문의
              </a>
              해 주시면 코드를 발급해 드리겠습니다.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">조직 계정 만들기</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                초대 코드
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.inviteCode}
                  onChange={(e) => setForm((f) => ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
                  placeholder="초대 코드를 입력하세요"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">관리자로부터 받은 초대 코드를 입력해주세요.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                회사/조직 이름
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  placeholder="예: 한국의료기기 주식회사"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                담당자 이름
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="8자 이상"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
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
                  시작하기 <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
            {["초대 코드 필요", "시범운영 중", "문의 후 발급"].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-[#1a73e8] hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
