"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Key, Eye, EyeOff, Loader2, CheckCircle,
  RefreshCw, Columns3, Pill,
} from "lucide-react";
import { updateSettingAction, updateOrderDisplayColumnsAction } from "@/app/(dashboard)/settings/actions";
import type { AISettings, AIProvider, OrderDisplayColumns } from "@/lib/queries/settings";

// ─── Config ────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { value: "1", label: "1분" },
  { value: "2", label: "2분" },
  { value: "3", label: "3분" },
  { value: "5", label: "5분 (기본)" },
  { value: "10", label: "10분" },
  { value: "15", label: "15분" },
  { value: "30", label: "30분" },
  { value: "0", label: "비활성화" },
];

const PROVIDERS = [
  { value: "anthropic" as const, label: "Anthropic (Claude)", placeholder: "sk-ant-api03-..." },
  { value: "google" as const, label: "Google (Gemini)", placeholder: "AIza..." },
  { value: "openai" as const, label: "OpenAI (GPT)", placeholder: "sk-..." },
  { value: "ollama" as const, label: "Ollama (로컬 LLM)", placeholder: "" },
];

const MODELS: Record<AIProvider, Array<{ value: string; label: string; desc: string }>> = {
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", desc: "빠르고 경제적" },
    { value: "claude-sonnet-4-6-20260220", label: "Claude Sonnet 4.6", desc: "균형잡힌 성능" },
    { value: "claude-opus-4-6-20260219", label: "Claude Opus 4.6", desc: "최고 품질" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "빠르고 경제적 (추천)" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", desc: "초저지연" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "고품질 추론" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "빠르고 경제적 (최신)" },
    { value: "gpt-4.1", label: "GPT-4.1", desc: "고품질 (최신)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "빠르고 경제적" },
    { value: "gpt-4o", label: "GPT-4o", desc: "고품질" },
  ],
  ollama: [
    { value: "qwen3.5:latest", label: "Qwen 3.5 9.7B", desc: "고품질 추론 (추천)" },
    { value: "qwen3.5:4b", label: "Qwen 3.5 4.7B", desc: "빠른 응답, 간단한 작업" },
    { value: "llama3.3:latest", label: "Llama 3.3", desc: "Meta 오픈소스" },
  ],
};

const MAX_COL_SELECTIONS = 4;

const DRUG_COLUMNS = [
  { key: "ITEM_SEQ", label: "품목기준코드" }, { key: "ITEM_NAME", label: "품목명" },
  { key: "ITEM_ENG_NAME", label: "영문명" }, { key: "ENTP_NAME", label: "업체명" },
  { key: "ENTP_NO", label: "업체허가번호" }, { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "CNSGN_MANUF", label: "위탁제조업체" }, { key: "ETC_OTC_CODE", label: "전문/일반" },
  { key: "CHART", label: "성상" }, { key: "BAR_CODE", label: "표준코드" },
  { key: "MATERIAL_NAME", label: "성분" }, { key: "EDI_CODE", label: "보험코드" },
  { key: "STORAGE_METHOD", label: "저장방법" }, { key: "VALID_TERM", label: "유효기간" },
  { key: "PACK_UNIT", label: "포장단위" }, { key: "CANCEL_NAME", label: "상태" },
];

const DEVICE_COLUMNS = [
  { key: "UDIDI_CD", label: "UDI-DI코드" }, { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조업체명" }, { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PERMIT_NO", label: "허가번호" }, { key: "PRMSN_YMD", label: "허가일자" },
  { key: "FOML_INFO", label: "모델명" }, { key: "PRDT_NM_INFO", label: "제품명" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용여부" }, { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상" },
  { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상" }, { key: "USE_PURPS_CONT", label: "사용목적" },
];

// ─── Section wrapper ───────────────────────────────────────────────

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start gap-3 px-5 py-4 border-b bg-muted/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

interface Props {
  settings: AISettings;
  displayColumns: OrderDisplayColumns;
}

export function SettingsGeneral({ settings, displayColumns }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Sync
  const [interval, setIntervalVal] = useState(String(settings.sync_interval_minutes));

  // AI
  const [enabled, setEnabled] = useState(settings.ai_enabled);
  const [provider, setProvider] = useState<AIProvider>(settings.ai_provider);
  const [model, setModel] = useState(settings.ai_model);

  // API keys
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [drugApiKey, setDrugApiKey] = useState("");
  const [showDrugKey, setShowDrugKey] = useState(false);
  const [isSavingDrugKey, setIsSavingDrugKey] = useState(false);

  // Columns
  const [drugCols, setDrugCols] = useState<string[]>(displayColumns.drug);
  const [deviceCols, setDeviceCols] = useState<string[]>(displayColumns.device);

  function save(key: string, value: unknown) {
    startTransition(async () => {
      try {
        await updateSettingAction(key, value);
        toast.success("설정이 저장되었습니다.");
        router.refresh();
      } catch { toast.error("설정 저장에 실패했습니다."); }
    });
  }

  function handleProviderChange(v: AIProvider) {
    setProvider(v);
    const first = MODELS[v]?.[0]?.value ?? "";
    setModel(first);
    setApiKey(""); setShowKey(false);
    startTransition(async () => {
      try {
        await updateSettingAction("ai_provider", v);
        await updateSettingAction("ai_model", first);
        toast.success("AI 제공자가 변경되었습니다.");
        router.refresh();
      } catch { toast.error("설정 저장에 실패했습니다."); }
    });
  }

  async function saveApiKey(type: "ai" | "drug") {
    const key = type === "ai" ? apiKey : drugApiKey;
    if (!key.trim()) { toast.error("API 키를 입력하세요."); return; }
    const setter = type === "ai" ? setIsSavingKey : setIsSavingDrugKey;
    setter(true);
    try {
      const settingKey = type === "ai" ? `ai_api_key_${provider}` : "drug_api_service_key";
      await updateSettingAction(settingKey, key.trim());
      toast.success("API 키가 저장되었습니다.");
      if (type === "ai") { setApiKey(""); setShowKey(false); }
      else { setDrugApiKey(""); setShowDrugKey(false); }
      router.refresh();
    } catch { toast.error("API 키 저장에 실패했습니다."); }
    finally { setter(false); }
  }

  async function deleteApiKey(type: "ai" | "drug") {
    const setter = type === "ai" ? setIsSavingKey : setIsSavingDrugKey;
    setter(true);
    try {
      const settingKey = type === "ai" ? `ai_api_key_${provider}` : "drug_api_service_key";
      await updateSettingAction(settingKey, "");
      toast.success("API 키가 삭제되었습니다.");
      router.refresh();
    } catch { toast.error("API 키 삭제에 실패했습니다."); }
    finally { setter(false); }
  }

  function handleSaveColumns() {
    startTransition(async () => {
      try {
        await updateOrderDisplayColumnsAction({ drug: drugCols, device: deviceCols });
        toast.success("표시 컬럼 설정이 저장되었습니다.");
      } catch { toast.error("설정 저장에 실패했습니다."); }
    });
  }

  const currentKeyInfo = settings.ai_api_keys[provider];
  const providerModels = MODELS[provider] ?? [];
  const providerConfig = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="grid gap-4 max-w-3xl">
      {/* ── 동기화 ── */}
      <Section icon={RefreshCw} title="자동 동기화" description="대시보드 데이터를 주기적으로 자동 갱신합니다">
        <SettingRow label="동기화 주기" description="Realtime 연결이 끊어졌을 때의 보완 역할">
          <Select value={interval} disabled={isPending} onValueChange={(v: string) => { setIntervalVal(v); save("sync_interval_minutes", Number(v)); }}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </Section>

      {/* ── AI 설정 (별도 탭) ── */}
      <Section icon={Bot} title="AI 설정" description="AI 제공자, 모델, API 키를 관리합니다">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            현재: <strong>{settings.ai_provider}</strong> / {settings.ai_model}
            {settings.ai_enabled ? " (활성)" : " (비활성)"}
          </div>
          <a href="/settings/ai" className="text-sm text-primary hover:underline font-medium">AI 설정 →</a>
        </div>
      </Section>

      {/* ── 주문 표시 컬럼 ── */}
      <Section icon={Columns3} title="주문 표시 컬럼" description={`주문서에서 품목별로 표시할 컬럼을 선택합니다 (최대 ${MAX_COL_SELECTIONS}개)`}>
        <div className="space-y-4">
          <ColumnGrid title="의약품" columns={DRUG_COLUMNS} selected={drugCols} onToggle={(k, v) => setDrugCols(v ? [...drugCols, k] : drugCols.filter(c => c !== k))} />
          <div className="border-t" />
          <ColumnGrid title="의료기기" columns={DEVICE_COLUMNS} selected={deviceCols} onToggle={(k, v) => setDeviceCols(v ? [...deviceCols, k] : deviceCols.filter(c => c !== k))} />
          <Button size="sm" onClick={handleSaveColumns} disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </Section>
    </div>
  );
}

// ─── Column Grid ───────────────────────────────────────────────────

function ColumnGrid({ title, columns, selected, onToggle }: {
  title: string;
  columns: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  const atMax = selected.length >= MAX_COL_SELECTIONS;
  return (
    <div>
      <h4 className="text-xs font-medium mb-2">
        {title}{" "}
        <span className="text-muted-foreground">({selected.length}/{MAX_COL_SELECTIONS})</span>
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-1.5">
        {columns.map((col) => {
          const checked = selected.includes(col.key);
          const disabled = !checked && atMax;
          return (
            <label key={col.key} className={`flex items-center gap-1.5 text-xs cursor-pointer ${disabled ? "opacity-40" : ""}`}>
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v: boolean | "indeterminate") => onToggle(col.key, v === true)}
                className="h-3.5 w-3.5"
              />
              {col.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
