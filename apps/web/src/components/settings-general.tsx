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
    { value: "qwen3.5:9b", label: "Qwen 3.5 9B", desc: "로컬 추론 (추천)" },
    { value: "qwen3.5:4b", label: "Qwen 3.5 4B", desc: "경량 모델" },
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

      {/* ── AI 설정 ── */}
      <Section icon={Bot} title="AI 파싱" description="수신 메시지를 AI가 자동으로 분석합니다">
        <div className="space-y-0">
          <SettingRow label="AI 파싱 활성화" description={enabled ? "AI가 메시지를 자동 분석합니다" : "수동 확인이 필요합니다"}>
            <Switch checked={enabled} disabled={isPending} onCheckedChange={(v: boolean) => { setEnabled(v); save("ai_enabled", v); }} />
          </SettingRow>

          <SettingRow label="AI 제공자">
            <Select value={provider} disabled={isPending} onValueChange={(v: string) => handleProviderChange(v as AIProvider)}>
              <SelectTrigger className="w-52 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      {p.label}
                      {settings.ai_api_keys[p.value]?.set && (
                        <Badge variant="outline" className="text-green-600 text-[10px] px-1 py-0">키 등록</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="모델">
            <Select value={model} disabled={isPending} onValueChange={(v: string) => { setModel(v); save("ai_model", v); }}>
              <SelectTrigger className="w-52 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">{m.label}<span className="text-xs text-muted-foreground">— {m.desc}</span></span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </Section>

      {/* ── API 키 관리 ── */}
      <Section icon={Key} title="API 키 관리" description="AI 및 식약처 API 인증 키를 관리합니다">
        <div className="space-y-4">
          {/* AI API Key */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm font-medium">{providerConfig?.label ?? "AI"} API 키</Label>
              {currentKeyInfo?.set && (
                <Badge variant="outline" className="text-green-600 text-[10px]">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  <code className="font-mono">{currentKeyInfo.masked}</code>
                </Badge>
              )}
              {currentKeyInfo?.set && (
                <Button size="sm" variant="ghost" className="text-destructive h-6 px-2 text-xs" disabled={isSavingKey} onClick={() => deleteApiKey("ai")}>삭제</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={currentKeyInfo?.set ? "새 키로 변경..." : providerConfig?.placeholder ?? "API 키 입력..."}
                  className="h-8 text-sm pr-9"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" className="h-8" disabled={isSavingKey || !apiKey.trim()} onClick={() => saveApiKey("ai")}>
                {isSavingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>

          <div className="border-t" />

          {/* Drug API Key */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pill className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-medium">식약처 의약품 API 키</Label>
              {settings.drug_api_key?.set && (
                <Badge variant="outline" className="text-green-600 text-[10px]">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  <code className="font-mono">{settings.drug_api_key.masked}</code>
                </Badge>
              )}
              {settings.drug_api_key?.set && (
                <Button size="sm" variant="ghost" className="text-destructive h-6 px-2 text-xs" disabled={isSavingDrugKey} onClick={() => deleteApiKey("drug")}>삭제</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showDrugKey ? "text" : "password"}
                  value={drugApiKey}
                  onChange={(e) => setDrugApiKey(e.target.value)}
                  placeholder={settings.drug_api_key?.set ? "새 키로 변경..." : "공공데이터포털 인증키 입력..."}
                  className="h-8 text-sm pr-9"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowDrugKey(!showDrugKey)}>
                  {showDrugKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" className="h-8" disabled={isSavingDrugKey || !drugApiKey.trim()} onClick={() => saveApiKey("drug")}>
                {isSavingDrugKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "저장"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">공공데이터포털(data.go.kr) → 마이페이지 → 활용신청 현황에서 확인</p>
          </div>
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
