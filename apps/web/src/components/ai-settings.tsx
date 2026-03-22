"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Loader2, CheckCircle,
  Key, Eye, EyeOff,
} from "lucide-react";
import { updateSettingAction } from "@/app/(dashboard)/settings/actions";
import type { AISettings, AIProvider } from "@/lib/queries/settings";

// ---------------------------------------------------------------------------
// Provider & Model config
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { value: "anthropic" as const, label: "Anthropic (Claude)", placeholder: "sk-ant-api03-..." },
  { value: "google" as const, label: "Google (Gemini)", placeholder: "AIza..." },
  { value: "openai" as const, label: "OpenAI (GPT)", placeholder: "sk-..." },
  { value: "ollama" as const, label: "Ollama (로컬 LLM)", placeholder: "" },
];

const MODELS: Record<AIProvider, Array<{ value: string; label: string; description: string }>> = {
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "빠르고 경제적" },
    { value: "claude-sonnet-4-6-20260220", label: "Claude Sonnet 4.6", description: "균형잡힌 성능" },
    { value: "claude-opus-4-6-20260219", label: "Claude Opus 4.6", description: "최고 품질" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "빠르고 경제적 (추천)" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", description: "초저지연, 대량 처리" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "고품질 추론" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "빠르고 경제적 (최신)" },
    { value: "gpt-4.1", label: "GPT-4.1", description: "고품질 (최신)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "빠르고 경제적" },
    { value: "gpt-4o", label: "GPT-4o", description: "고품질" },
  ],
  ollama: [
    { value: "qwen3.5:9b", label: "Qwen 3.5 9B", description: "로컬 추론 (추천)" },
    { value: "qwen3.5:4b", label: "Qwen 3.5 4B", description: "경량 모델" },
    { value: "llama3.3:latest", label: "Llama 3.3", description: "Meta 오픈소스" },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AISettingsForm({ settings }: { settings: AISettings }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Local state
  const [enabled, setEnabled] = useState(settings.ai_enabled);
  const [provider, setProvider] = useState<AIProvider>(settings.ai_provider);
  const [model, setModel] = useState(settings.ai_model);
  // API key state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Drug API key state
  const [drugApiKey, setDrugApiKey] = useState("");
  const [showDrugKey, setShowDrugKey] = useState(false);
  const [isSavingDrugKey, setIsSavingDrugKey] = useState(false);

  function saveSetting(key: string, value: unknown) {
    startTransition(async () => {
      try {
        await updateSettingAction(key, value);
        toast.success("설정이 저장되었습니다.");
        router.refresh();
      } catch {
        toast.error("설정 저장에 실패했습니다.");
      }
    });
  }

  function handleProviderChange(newProvider: AIProvider) {
    setProvider(newProvider);
    // Auto-select first model of the new provider
    const firstModel = MODELS[newProvider]?.[0]?.value ?? "";
    setModel(firstModel);
    setApiKey("");
    setShowKey(false);
    // Save provider and model together
    startTransition(async () => {
      try {
        await updateSettingAction("ai_provider", newProvider);
        await updateSettingAction("ai_model", firstModel);
        toast.success("AI 제공자가 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("설정 저장에 실패했습니다.");
      }
    });
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      toast.error("API 키를 입력하세요.");
      return;
    }
    setIsSavingKey(true);
    try {
      await updateSettingAction(`ai_api_key_${provider}`, apiKey.trim());
      toast.success("API 키가 저장되었습니다.");
      setApiKey("");
      setShowKey(false);
      router.refresh();
    } catch {
      toast.error("API 키 저장에 실패했습니다.");
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleDeleteApiKey() {
    setIsSavingKey(true);
    try {
      await updateSettingAction(`ai_api_key_${provider}`, "");
      toast.success("API 키가 삭제되었습니다.");
      router.refresh();
    } catch {
      toast.error("API 키 삭제에 실패했습니다.");
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleSaveDrugApiKey() {
    if (!drugApiKey.trim()) {
      toast.error("API 키를 입력하세요.");
      return;
    }
    setIsSavingDrugKey(true);
    try {
      await updateSettingAction("drug_api_service_key", drugApiKey.trim());
      toast.success("의약품 API 키가 저장되었습니다.");
      setDrugApiKey("");
      setShowDrugKey(false);
      router.refresh();
    } catch {
      toast.error("API 키 저장에 실패했습니다.");
    } finally {
      setIsSavingDrugKey(false);
    }
  }

  async function handleDeleteDrugApiKey() {
    setIsSavingDrugKey(true);
    try {
      await updateSettingAction("drug_api_service_key", "");
      toast.success("의약품 API 키가 삭제되었습니다.");
      router.refresh();
    } catch {
      toast.error("API 키 삭제에 실패했습니다.");
    } finally {
      setIsSavingDrugKey(false);
    }
  }

  const currentKeyInfo = settings.ai_api_keys[provider];
  const providerModels = MODELS[provider] ?? [];
  const providerConfig = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* AI Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI 파싱 활성화
          </CardTitle>
          <CardDescription>
            활성화하면 수신 메시지를 AI가 자동으로 분석합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI 파싱</Label>
              <p className="text-xs text-muted-foreground">
                {enabled ? "AI가 메시지를 자동 분석합니다" : "수동 확인이 필요합니다"}
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={isPending}
              onCheckedChange={(v: boolean) => {
                setEnabled(v);
                saveSetting("ai_enabled", v);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 제공자</CardTitle>
          <CardDescription>
            메시지 파싱에 사용할 AI 서비스를 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={provider}
            disabled={isPending}
            onValueChange={(v: string) => handleProviderChange(v as AIProvider)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    {p.label}
                    {settings.ai_api_keys[p.value]?.set && (
                      <Badge variant="outline" className="text-green-600 text-[10px] px-1 py-0">
                        키 등록됨
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API 키
          </CardTitle>
          <CardDescription>
            선택한 AI 제공자의 API 키를 입력합니다. 키는 서버에 안전하게 저장됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentKeyInfo?.set && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                등록됨
              </Badge>
              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {currentKeyInfo.masked}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-6 px-2 text-xs"
                disabled={isSavingKey}
                onClick={handleDeleteApiKey}
              >
                삭제
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentKeyInfo?.set
                  ? "새 키로 변경하려면 입력..."
                  : providerConfig?.placeholder ?? "API 키 입력..."}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              size="sm"
              disabled={isSavingKey || !apiKey.trim()}
              onClick={handleSaveApiKey}
            >
              {isSavingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {provider === "anthropic" && "Anthropic Console → API Keys에서 발급받을 수 있습니다."}
            {provider === "google" && "Google AI Studio → API Keys에서 발급받을 수 있습니다."}
            {provider === "openai" && "OpenAI Platform → API Keys에서 발급받을 수 있습니다."}
          </p>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">모델 선택</CardTitle>
          <CardDescription>
            메시지 파싱에 사용할 AI 모델을 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={model}
            disabled={isPending}
            onValueChange={(v: string) => {
              setModel(v);
              saveSetting("ai_model", v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerModels.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <span className="flex items-center gap-2">
                    {m.label}
                    <span className="text-xs text-muted-foreground">— {m.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Drug API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            의약품 API 키
          </CardTitle>
          <CardDescription>
            공공데이터포털에서 발급받은 식약처 의약품 허가정보 API 인증키를 입력합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.drug_api_key?.set && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                등록됨
              </Badge>
              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {settings.drug_api_key.masked}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-6 px-2 text-xs"
                disabled={isSavingDrugKey}
                onClick={handleDeleteDrugApiKey}
              >
                삭제
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showDrugKey ? "text" : "password"}
                value={drugApiKey}
                onChange={(e) => setDrugApiKey(e.target.value)}
                placeholder={settings.drug_api_key?.set
                  ? "새 키로 변경하려면 입력..."
                  : "공공데이터포털 인증키 입력..."}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10"
                onClick={() => setShowDrugKey(!showDrugKey)}
                tabIndex={-1}
              >
                {showDrugKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              size="sm"
              disabled={isSavingDrugKey || !drugApiKey.trim()}
              onClick={handleSaveDrugApiKey}
            >
              {isSavingDrugKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            공공데이터포털(data.go.kr) → 마이페이지 → 활용신청 현황에서 인증키를 확인할 수 있습니다.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
