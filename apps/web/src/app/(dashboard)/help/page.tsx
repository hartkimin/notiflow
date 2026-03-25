import {
  BookOpen, Smartphone, MessageSquare, ClipboardList, Zap,
  BarChart3, Building2, Package, Bot, Settings,
  ArrowRight, Sparkles,
  Truck, Receipt,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";

// ─── Guide Sections ──────────────────────────────

interface GuideSection {
  id: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  steps: Array<{ title: string; description: string }>;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "overview",
    icon: Zap,
    title: "NotiFlow란?",
    description: "혈액투석 의료물품 주문관리 시스템",
    steps: [
      { title: "무엇을 하는 시스템인가요?", description: "카카오톡·SMS로 수신되는 의료물품 주문 메시지를 자동으로 수집하고, AI가 품목·수량·단위를 추출하여 주문서를 자동 생성합니다. 거래처 관리, 매출 분석, 세금계산서 발행까지 하나의 플랫폼에서 처리할 수 있습니다." },
      { title: "어떤 구성으로 되어 있나요?", description: "① 안드로이드 모바일 앱 — 카카오톡/SMS 알림을 자동 캡처합니다\n② 웹 대시보드 — 주문관리, 메시지 확인, 매출 분석, 설정을 합니다\n③ AI 엔진 — 메시지 파싱, 자연어 DB 조회를 담당합니다\n④ 식약처 연동 — 의약품·의료기기 표준코드를 자동 동기화합니다" },
      { title: "처음 시작하려면?", description: "1. 웹 대시보드에 로그인합니다 (관리자가 계정을 생성해줍니다)\n2. 모바일 앱을 설치하고 같은 계정으로 로그인합니다\n3. 앱이 알림 접근 권한을 요청하면 허용합니다\n4. 카카오톡이나 SMS로 주문 메시지를 받으면 자동으로 웹 대시보드에 나타납니다" },
    ],
  },
  {
    id: "dashboard",
    icon: BarChart3,
    title: "대시보드",
    description: "한눈에 보는 실적 현황",
    steps: [
      { title: "상단 KPI 바", description: "연간 매출/이익/주문 건수와 월별 실적을 한눈에 확인합니다. ◀▶ 버튼으로 월/년을 이동할 수 있습니다." },
      { title: "영업담당자 실적 차트", description: "왼쪽 세로 바 차트에서 담당자별 매출액을 비교합니다. 월별/연별 전환이 가능합니다." },
      { title: "거래처별 매출 Top 10", description: "오른쪽 차트에서 매출 상위 10개 거래처를 확인합니다. 바 위에 매출액이 표시됩니다." },
      { title: "AI 채팅 (우하단 버튼)", description: "우측 하단 초록색 💬 버튼을 클릭하면 AI 어시스턴트가 열립니다. '이번 달 매출 현황', '투석액 검색' 등을 자연어로 질문할 수 있습니다." },
    ],
  },
  {
    id: "messages",
    icon: MessageSquare,
    title: "수신 메시지",
    description: "모바일에서 수집된 메시지 확인",
    steps: [
      { title: "목록 탭", description: "수신된 모든 메시지를 시간순으로 확인합니다. 행을 클릭하면 오른쪽에 상세 패널이 열립니다. 체크박스로 여러 메시지를 선택하여 일괄 주문 생성이 가능합니다." },
      { title: "캘린더 탭", description: "일/주/월 뷰로 수신 메시지를 날짜별로 확인합니다. 캘린더의 메시지를 클릭하면 팝업으로 전체 내용과 복사/삭제/주문생성 버튼이 나타납니다." },
      { title: "AI 파싱", description: "메시지 상세 패널에서 'AI 파싱' 영역의 버튼을 사용합니다.\n• 파싱만 — AI가 품목/수량/단위를 추출하여 결과만 보여줍니다\n• 파싱+주문생성 — 추출 결과로 주문서까지 자동 생성합니다" },
      { title: "필터링", description: "날짜 범위, 출처(카카오톡/SMS/수동) 필터로 원하는 메시지를 찾습니다." },
    ],
  },
  {
    id: "orders",
    icon: ClipboardList,
    title: "주문 관리",
    description: "주문 생성부터 납품까지",
    steps: [
      { title: "주문 상태 흐름", description: "미완료(confirmed) → 완료(delivered)\n주문 생성 시 자동으로 '미완료' 상태가 됩니다." },
      { title: "새 주문 생성", description: "'+ 새 주문' 버튼 또는 메시지에서 '주문 생성'을 클릭합니다. 거래처를 선택하고 품목을 검색하여 추가합니다. 매입단가/판매단가/담당자를 입력합니다." },
      { title: "주문 상세", description: "주문번호를 클릭하면 상세 페이지가 열립니다. 품목 수정, 삭제, 배송예정일 설정, 세금계산서 발행이 가능합니다.\n표시 컬럼: 품목, 매입처, 수량, 단위, 매입단가, 판매단가, 금액, 담당자" },
      { title: "세금계산서", description: "완료 상태의 주문에서 '세금계산서 발행' 버튼으로 생성합니다. 발행된 계산서는 PDF로 다운로드할 수 있습니다." },
    ],
  },
  {
    id: "sales",
    icon: BarChart3,
    title: "영업 실적",
    description: "매출/이익 분석",
    steps: [
      { title: "영업담당자별", description: "담당자별 주문 건수, 품목 수, 매출, 매입, 이익, 이익률을 확인합니다. 행을 펼치면 거래처별 상세 실적이 나옵니다." },
      { title: "거래처별", description: "거래처별 실적을 확인합니다. 어떤 거래처에서 주문이 많은지, 이익률이 높은지 파악합니다." },
      { title: "품목별", description: "품목별 주문 수량, 매출, 이익을 확인합니다. 어떤 품목이 가장 많이 판매되는지 분석합니다." },
      { title: "주문별", description: "개별 주문 단위로 상세 내역을 확인합니다. 주문번호를 클릭하면 주문 상세로 이동합니다." },
      { title: "엑셀 다운로드", description: "각 탭에서 '엑셀' 버튼으로 현재 보고 있는 데이터를 엑셀 파일로 다운로드할 수 있습니다." },
    ],
  },
  {
    id: "hospitals",
    icon: Building2,
    title: "거래처 관리",
    description: "병원/유통사 정보 관리",
    steps: [
      { title: "거래처 등록", description: "'+ 새 거래처' 버튼으로 병원명, 약칭, 연락처, 주소, 사업자번호 등을 등록합니다." },
      { title: "거래처별 품목 관리", description: "거래처 상세에서 '품목 관리' 탭을 선택합니다. 해당 거래처에서 주문하는 품목과 약어(alias)를 등록하면 AI 파싱 정확도가 높아집니다." },
      { title: "alias 등록 예시", description: "예: 'EK15' → '혈액투석여과기 EK-15H', '니들' → 'AVF NEEDLE 16G'\n거래처마다 다른 약어를 사용하므로, 자주 사용하는 약어를 등록하면 AI가 자동으로 매칭합니다." },
    ],
  },
  {
    id: "products",
    icon: Package,
    title: "품목 관리",
    description: "의약품/의료기기 품목 검색 및 관리",
    steps: [
      { title: "식약처 품목 검색", description: "품목 페이지에서 의약품(MFDS 의약품) 또는 의료기기(MFDS 의료기기)를 검색합니다. 258만건 이상의 데이터에서 품목명, 업체명, 바코드로 검색 가능합니다." },
      { title: "내 품목 등록", description: "검색 결과에서 '+' 버튼을 클릭하여 자주 사용하는 품목을 '내 품목'에 등록합니다. 등록된 품목은 주문 생성 시 빠르게 선택할 수 있습니다." },
      { title: "식약처 동기화", description: "설정 → 일반에서 식약처 API 키를 등록하면, 의약품·의료기기 전체 데이터를 자동으로 동기화합니다." },
    ],
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI 기능",
    description: "AI 메시지 파싱 + 자연어 조회",
    steps: [
      { title: "AI 메시지 파싱", description: "수신 메시지에서 품목명, 수량, 단위를 AI가 자동으로 추출합니다. 거래처별 alias를 참조하여 정확한 제품명으로 매칭합니다.\n• 로컬 AI (Ollama + Qwen 3.5) — 외부 전송 없이 로컬에서 처리\n• 클라우드 AI (Claude/Gemini/GPT) — Ollama 실패 시 자동 폴백" },
      { title: "AI 채팅 (자연어 DB 조회)", description: "대시보드 우하단 💬 버튼으로 AI에게 자연어로 질문합니다.\n예시: '이번 달 주문 현황', '투석액 검색', '전월 대비 매출 비교', '연결된 기기 상태'\n22가지 조회가 가능합니다: 주문, 제품, 거래처, 매출, 이익, 세금계산서, 식약처, 메시지, 기기 등" },
      { title: "AI 설정", description: "설정 → AI 설정에서 AI 제공자(Ollama/Claude/Gemini/GPT)와 모델을 선택합니다.\nOllama 선택 시 서버 URL과 연결 테스트를 할 수 있습니다." },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "설정",
    description: "시스템 설정 및 관리",
    steps: [
      { title: "일반", description: "동기화 간격, 주문 표시 컬럼을 설정합니다." },
      { title: "AI 설정", description: "AI 제공자(Ollama/Claude/Gemini/GPT) 선택, 모델 선택, API 키 관리, Ollama 서버 연결 설정을 합니다." },
      { title: "사용자 관리", description: "관리자가 새 사용자를 추가하거나 역할(관리자/뷰어)을 변경합니다. 비활성화된 사용자는 로그인이 차단됩니다." },
      { title: "기기 관리", description: "연결된 모바일 기기 목록을 확인합니다. 기기별 마지막 동기화 시간, 앱 버전을 확인하고 비활성화할 수 있습니다." },
      { title: "자사 정보", description: "세금계산서에 표시되는 자사 정보(상호, 대표자, 사업자번호, 주소 등)를 설정합니다." },
    ],
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "모바일 앱",
    description: "알림 수집 앱 사용법",
    steps: [
      { title: "앱 설치", description: "Google Play Store에서 'NotiFlow'를 검색하여 설치합니다. 또는 관리자가 제공하는 APK 파일을 직접 설치합니다." },
      { title: "초기 설정", description: "1. 앱을 열고 웹과 같은 계정으로 로그인합니다\n2. '알림 접근 권한'을 허용합니다 (카카오톡/SMS 캡처에 필수)\n3. 배터리 최적화에서 NotiFlow를 제외합니다 (백그라운드 수집 유지)" },
      { title: "알림 필터", description: "설정 → 알림 필터에서 수집할 앱(카카오톡, SMS 등)과 키워드를 설정합니다. 불필요한 알림을 필터링하여 주문 관련 메시지만 수집합니다." },
      { title: "동기화", description: "수집된 메시지는 자동으로 서버에 동기화됩니다. Wi-Fi/모바일 데이터 상관없이 동작합니다. 설정 → 기기 관리에서 동기화 상태를 확인할 수 있습니다." },
    ],
  },
];

// ─── Flow Diagram ────────────────────────────────

const WORKFLOW_STEPS = [
  { icon: Smartphone, label: "알림 수집", desc: "모바일 앱이 카카오톡/SMS 수신" },
  { icon: Zap, label: "동기화", desc: "Supabase로 실시간 전송" },
  { icon: Bot, label: "AI 파싱", desc: "품목·수량·단위 자동 추출" },
  { icon: ClipboardList, label: "주문 생성", desc: "거래처별 주문서 자동 생성" },
  { icon: Truck, label: "배송 관리", desc: "배송일 설정 및 추적" },
  { icon: Receipt, label: "정산", desc: "세금계산서 발행" },
];

export default function HelpPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">도움말</h1>
        <p className="text-sm text-muted-foreground mt-1">
          NotiFlow v{APP_VERSION} 사용 가이드
        </p>
      </div>

      {/* Workflow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            전체 업무 흐름
          </CardTitle>
          <CardDescription>알림 수집부터 정산까지 6단계</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold">{step.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{step.desc}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guide Sections */}
      <div className="space-y-4">
        {/* TOC */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {GUIDE_SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                  <s.icon className="h-3.5 w-3.5 text-primary" />
                  {s.title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {GUIDE_SECTIONS.map((section) => (
          <Card key={section.id} id={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <section.icon className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version */}
      <div className="text-center py-4">
        <Badge variant="outline" className="text-xs">NotiFlow v{APP_VERSION}</Badge>
      </div>
    </>
  );
}
