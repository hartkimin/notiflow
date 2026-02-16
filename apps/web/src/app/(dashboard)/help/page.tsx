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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const releases = [
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
        text: "captured_messages → raw_messages 브릿지 트리거로 모바일 캡쳐 자동 연동",
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
