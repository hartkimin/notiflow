import {
  BookOpen,
  Smartphone,
  Globe,
  MessageSquare,
  ClipboardList,
  Zap,
  Shield,
  Trash2,
  TabletSmartphone,
  Pencil,
  Plus,
  CheckSquare,
  CalendarDays,
  Package,
  Layers,
  Container,
  ExternalLink,
  Bot,
  Search,
  Building2,
  Cpu,
  SlidersHorizontal,
  LayoutGrid,
  Keyboard,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";

const releases = [
  {
    version: APP_VERSION,
    date: "2026-02-26",
    title: "품목관리 전면 개편 — 식약처 API 연동 + 동기화",
    highlights: [
      {
        icon: Package,
        text: "DB 구조 개편 — 의약품(my_drugs) / 의료기기(my_devices) 테이블을 식약처 API 컬럼과 1:1 매칭",
      },
      {
        icon: Search,
        text: "내 품목 관리 — 검색 페이지와 동일한 UI로 등록된 품목 조회, 필터, 컬럼 설정",
      },
      {
        icon: Zap,
        text: "개별 동기화 — 품목별 식약처 API 조회 후 변경사항 diff 표시, 선택적 적용",
      },
      {
        icon: Layers,
        text: "호환성 보장 — products_catalog VIEW로 기존 주문/파싱 시스템과 완벽 호환",
      },
    ],
  },
  {
    version: "0.0.0.5",
    date: "2026-02-26",
    title: "품목 검색 UI/UX 전면 재설계",
    highlights: [
      {
        icon: Search,
        text: "통합 검색창 — 품목명, 업체명, 코드를 하나의 검색창에서 자동 판별하여 검색",
      },
      {
        icon: Filter,
        text: "필터 칩 — 업체명, 코드, 등급 등 추가 조건을 칩으로 조합하여 정밀 검색",
      },
      {
        icon: SlidersHorizontal,
        text: "아코디언 상세 — 핵심 9개 컬럼만 표시, 행 클릭 시 전체 정보 확장",
      },
      {
        icon: LayoutGrid,
        text: "모바일 카드 뷰 — 768px 이하에서 자동으로 카드 리스트 전환",
      },
      {
        icon: Keyboard,
        text: "키보드 접근성 — Escape 닫기, Enter/Space 토글, Tab 행 이동",
      },
    ],
  },
  {
    version: "0.0.0.4",
    date: "2026-02-25",
    title: "데이터 캘린더 리디자인",
    highlights: [
      {
        icon: CalendarDays,
        text: "캘린더 탭 추가 — 수신메시지와 주문관리에 목록/캘린더 탭 전환 기능 추가",
      },
      {
        icon: CalendarDays,
        text: "일/주/월 뷰 전환 — 수신시간·주문일 기준으로 일별, 주별, 월별 캘린더 뷰 제공",
      },
      {
        icon: MessageSquare,
        text: "상세 사이드 패널 — 캘린더에서 항목 클릭 시 우측 슬라이드 패널로 상세 내역 표시",
      },
      {
        icon: Zap,
        text: "기존 캘린더 제거 — /calendar 페이지 및 관련 코드 완전 삭제 (3,600줄 → 2,600줄로 축소)",
      },
    ],
  },
  {
    version: "0.0.0.3",
    date: "2026-02-24",
    title: "캘린더 버그 수정 & 기기 컬럼 추가",
    highlights: [
      {
        icon: CalendarDays,
        text: "캘린더 카테고리 추가 오류 수정 — ARGB 색상값 정수 오버플로우 해결",
      },
      {
        icon: CalendarDays,
        text: "주간 뷰 '오늘' 네비게이션 수정 — 타임존(KST) 오프셋으로 인한 잘못된 주간 표시 해결",
      },
      {
        icon: Smartphone,
        text: "수신메시지 기기명 컬럼 추가 — 어느 모바일 기기에서 수집된 메시지인지 표시",
      },
      {
        icon: Bot,
        text: "Gemini API 429 자동 재시도 — 요청 한도 초과 시 retryDelay 파싱 후 자동 재시도",
      },
    ],
  },
  {
    version: "0.0.0.2",
    date: "2026-02-23",
    title: "AI 파싱 활성화 & 검색 콤보박스 도입",
    highlights: [
      {
        icon: Bot,
        text: "AI 파싱 활성화 — 수신메시지에서 AI 테스트, 파싱 실행, 일괄 파싱 기능 사용 가능",
      },
      {
        icon: Cpu,
        text: "AI 모델 최신화 — Claude 4.6, Gemini 2.5, GPT-4.1 모델 추가 및 기본 모델 업데이트",
      },
      {
        icon: Search,
        text: "품목 검색 콤보박스 — 주문 수정 시 품목을 검색하여 선택 (기존 드롭다운 대체)",
      },
      {
        icon: Building2,
        text: "거래처 변경 기능 — 주문 아코디언에서 거래처를 검색하여 즉시 변경",
      },
    ],
  },
  {
    version: "0.0.0.1",
    date: "2026-02-23",
    title: "주문 관리 강화 & 버전 관리 도입",
    highlights: [
      {
        icon: CheckSquare,
        text: "주문 선택 & 일괄 삭제 — 체크박스 선택 후 확인 다이얼로그를 통한 일괄 삭제",
      },
      {
        icon: Pencil,
        text: "주문 품목 인라인 수정 — 수량 변경 및 품목(제품) 변경을 아코디언 내에서 직접 편집",
      },
      {
        icon: CalendarDays,
        text: "배송예정일 편집 — 아코디언 및 상세페이지에서 날짜 입력으로 즉시 변경",
      },
      {
        icon: Package,
        text: "주문 상세페이지 리팩토링 — 상태 진행(접수 확인/처리 시작/배송 완료), 삭제, 배송예정/실제배송일 분리",
      },
      {
        icon: ExternalLink,
        text: "상세 페이지 바로가기 — 주문 목록 행 끝에 아이콘 버튼으로 이동",
      },
      {
        icon: Layers,
        text: "앱 버전 표시 — 사이드바에 4자리 버전 번호 표시 (베타 0.0.0.x)",
      },
    ],
  },
  {
    version: "0.0.0.0",
    date: "2026-02-22",
    title: "주문 그룹 아코디언 & Docker 배포",
    highlights: [
      {
        icon: Layers,
        text: "주문 목록을 주문번호 기준으로 그룹핑 — 아코디언 형태로 품목 상세 표시",
      },
      {
        icon: Container,
        text: "Docker Compose 설정 추가 — standalone 빌드 및 컨테이너 배포 지원",
      },
      {
        icon: Shield,
        text: "인증 storageKey 설정 및 서버사이드 SUPABASE_URL 폴백 수정",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-16",
    title: "메시지 CRUD & 기기명 추적",
    highlights: [
      {
        icon: Plus,
        text: "수동 메시지 등록 — 대시보드에서 직접 메시지를 생성하여 AI 파싱 파이프라인에 투입",
      },
      {
        icon: Pencil,
        text: "메시지 수정 기능 — 발신자, 내용, 출처, 파싱 상태를 인라인 편집",
      },
      {
        icon: Smartphone,
        text: "기기명 표시 — 모바일 캡쳐 메시지에 수신 기기명을 자동 매핑하여 테이블에 표시",
      },
      {
        icon: Zap,
        text: "captured_messages 실시간 구독 추가 — 모바일 캡쳐 시 대시보드 자동 갱신",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-16",
    title: "모바일 기기 관리 & 메시지 삭제",
    highlights: [
      {
        icon: TabletSmartphone,
        text: "모바일 기기 관리 페이지 추가 — 연결된 기기 목록 조회 및 활성/비활성 토글",
      },
      {
        icon: Trash2,
        text: "수신 메시지 삭제 기능 — 확인 다이얼로그 후 DB에서 영구 삭제",
      },
      {
        icon: Zap,
        text: "captured_messages 브릿지 트리거로 모바일 캡쳐 자동 연동",
      },
      {
        icon: Smartphone,
        text: "모바일 앱 동기화 시 기기 정보(모델, OS, 앱 버전) 자동 등록",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-16",
    title: "웹 대시보드 안정화",
    highlights: [
      {
        icon: ClipboardList,
        text: "품목 등록 오류 수정 및 실제 에러 메시지 표시",
      },
      {
        icon: Smartphone,
        text: "모바일 앱 deprecation 경고 해결 (Sync, Icons, Theme)",
      },
      {
        icon: Shield,
        text: "Supabase 동기화 버그 수정 — FK 유효성 검사 추가",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-15",
    title: "초기 릴리즈",
    highlights: [
      {
        icon: Globe,
        text: "웹 대시보드 — 주문관리, 수신메시지, 캘린더, 배송, 매출리포트",
      },
      {
        icon: MessageSquare,
        text: "AI 메시지 파싱 — 텔레그램/카카오톡/SMS 자동 주문 생성",
      },
      {
        icon: Smartphone,
        text: "모바일 앱 — 알림 캡쳐, Supabase 실시간 동기화",
      },
      {
        icon: Shield,
        text: "마스터 데이터 관리 — 거래처, 품목, 공급사 CRUD",
      },
    ],
  },
];

const guides = [
  {
    title: "시작하기",
    description: "모바일 앱 설치 후 로그인하면 기기가 자동으로 등록되고, 알림을 캡쳐하여 주문이 자동 생성됩니다.",
  },
  {
    title: "메시지 처리 흐름",
    description:
      "모바일 알림 캡쳐 → Supabase 동기화 → AI 파싱 (Edge Function) → 주문 자동 생성 → 웹 대시보드 표시",
  },
  {
    title: "기기 관리",
    description:
      "시스템 > 모바일 기기에서 연결된 기기를 확인할 수 있습니다. 비활성화된 기기는 동기화에서 제외됩니다.",
  },
  {
    title: "수동 주문 생성",
    description:
      "AI가 파싱하지 못한 메시지는 수신메시지 상세에서 '수동 파싱으로 주문 생성' 버튼을 사용할 수 있습니다.",
  },
];

export default function HelpPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">도움말</h1>
        <p className="text-sm text-muted-foreground mt-1">
          NotiFlow 사용 가이드 및 릴리즈 노트
        </p>
      </div>

      {/* Quick Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            사용 가이드
          </CardTitle>
          <CardDescription>
            NotiFlow 주요 기능 안내
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((guide) => (
              <div
                key={guide.title}
                className="rounded-lg border p-4 space-y-1.5"
              >
                <h3 className="font-medium text-sm">{guide.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {guide.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Release Notes */}
      <Card>
        <CardHeader>
          <CardTitle>릴리즈 노트</CardTitle>
          <CardDescription>버전별 변경 사항</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {releases.map((release, idx) => (
              <div key={release.version}>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant={idx === 0 ? "default" : "secondary"}>
                    v{release.version}
                  </Badge>
                  <span className="text-sm font-medium">
                    {release.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {release.date}
                  </span>
                </div>
                <ul className="space-y-2 ml-1">
                  {release.highlights.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4 mt-0.5 shrink-0 text-primary/70" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
                {idx < releases.length - 1 && (
                  <div className="border-b mt-6" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
