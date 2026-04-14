"use client";

import { ArrowRight, Building2, Package, Users, TrendingUp, CheckCircle2, Lock, Eye, LogIn, Copy, Check } from "lucide-react";
import { useState } from "react";

type DemoData = {
  org: { id: string; name: string };
  orders: Array<{ id: number; status: string; total_amount: number | null; order_date: string; hospitals: { name: string } | null }>;
  hospitals: Array<{ id: number; name: string; hospital_type: string }>;
  suppliers: Array<{ id: number; name: string }>;
} | null;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: "임시저장", color: "bg-gray-100 text-gray-600" },
  confirmed: { label: "주문확인", color: "bg-blue-100 text-blue-700" },
  delivered: { label: "납품완료", color: "bg-green-100 text-green-700" },
  invoiced:  { label: "계산서발행", color: "bg-purple-100 text-purple-700" },
};

function fmt(n: number | null) {
  if (!n) return "–";
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n);
}

export default function DemoClient({ data }: { data: DemoData }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-semibold text-gray-900">NotiFlow</span>
            <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">데모</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-600 hover:text-gray-900">로그인</a>
            <a
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
            >
              무료 시작 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Demo banner */}
      <div className="bg-orange-50 border-b border-orange-200">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-orange-800">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>아래는 미리보기입니다. 테스트 계정으로 직접 로그인하면 모든 기능을 체험할 수 있습니다.</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Demo login card */}
        <DemoLoginCard />

        {/* Hero stat cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Package className="w-5 h-5 text-blue-600" />} label="총 주문" value={String(data.orders.length)} sub="최근 주문 기준" />
            <StatCard icon={<Building2 className="w-5 h-5 text-green-600" />} label="거래처 병원" value={String(data.hospitals.length)} sub="활성 계약 기준" />
            <StatCard icon={<Users className="w-5 h-5 text-purple-600" />} label="공급업체" value={String(data.suppliers.length)} sub="등록 공급사" />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-orange-600" />} label="납품완료율" value="94%" sub="최근 30일" />
          </div>
        )}

        {/* Orders table */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">최근 주문</h2>
            <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> 읽기 전용</span>
          </div>
          {!data || data.orders.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              데모 데이터가 준비 중입니다.<br />
              <a href="/signup" className="text-[#1a73e8] hover:underline mt-1 inline-block">계정을 만들어 직접 사용해 보세요</a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">주문번호</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">거래처</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">주문일</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">금액</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.orders.map((order) => {
                    const s = STATUS_LABEL[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-gray-600 text-xs">ORD-DEMO-{String(order.id).padStart(3, "0")}</td>
                        <td className="px-6 py-3.5 text-gray-900">{(order.hospitals as { name: string } | null)?.name ?? "–"}</td>
                        <td className="px-6 py-3.5 text-gray-500">{order.order_date}</td>
                        <td className="px-6 py-3.5 text-gray-900 font-medium">{fmt(order.total_amount)}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Hospital + Supplier lists */}
        {data && (
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">거래처 병원</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {data.hospitals.map((h) => (
                  <li key={h.id} className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{h.name}</div>
                      <div className="text-xs text-gray-500">{h.hospital_type}</div>
                    </div>
                  </li>
                ))}
                {data.hospitals.length === 0 && (
                  <li className="px-6 py-8 text-center text-gray-400 text-sm">데모 데이터 준비 중</li>
                )}
              </ul>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">공급업체</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {data.suppliers.map((s) => (
                  <li key={s.id} className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  </li>
                ))}
                {data.suppliers.length === 0 && (
                  <li className="px-6 py-8 text-center text-gray-400 text-sm">데모 데이터 준비 중</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {/* CTA */}
        <div className="bg-[#1a73e8] rounded-2xl px-8 py-10 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">지금 바로 시작하세요</h2>
          <p className="text-blue-100 mb-6 text-sm">신용카드 불필요. 14일 무료체험. 언제든 해지 가능.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a73e8] font-semibold rounded-xl hover:bg-blue-50 transition-colors"
            >
              무료로 시작하기 <ArrowRight className="w-4 h-4" />
            </a>
            <a href="mailto:jinzhangxun@gmail.com" className="text-blue-100 hover:text-white text-sm underline">
              도입 문의하기
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-6">
            {["신용카드 불필요", "14일 무료", "국내 서버"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-blue-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      title="복사"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DemoLoginCard() {
  return (
    <div className="bg-white rounded-xl border-2 border-[#1a73e8] overflow-hidden">
      <div className="px-6 py-4 bg-[#1a73e8] flex items-center gap-2">
        <LogIn className="w-4 h-4 text-white" />
        <h2 className="font-semibold text-white text-sm">테스트 계정으로 직접 체험하기</h2>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm text-gray-500 mb-4">
          아래 계정으로 로그인하면 대시보드, 주문, 세금계산서, 설정 등 모든 기능을 직접 사용해볼 수 있습니다.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">이메일</div>
              <div className="font-mono text-sm text-gray-900">demo@notiflow.life</div>
            </div>
            <CopyButton text="demo@notiflow.life" />
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">비밀번호</div>
              <div className="font-mono text-sm text-gray-900">Demo1234!</div>
            </div>
            <CopyButton text="Demo1234!" />
          </div>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
        >
          <LogIn className="w-4 h-4" /> 테스트 계정으로 로그인
        </a>
        <p className="text-xs text-gray-400 mt-3">
          * 데모 데이터는 주기적으로 초기화됩니다. 실제 데이터를 보관하려면{" "}
          <a href="/signup" className="text-[#1a73e8] hover:underline">무료 계정을 만드세요</a>.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
