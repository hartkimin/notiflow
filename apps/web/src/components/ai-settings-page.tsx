"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Key, Eye, EyeOff, Loader2, CheckCircle, Server, Cpu, Sparkles, Activity,
} from "lucide-react";
import { updateSettingAction } from "@/app/(dashboard)/settings/actions";
import type { AISettings, AIProvider } from "@/lib/queries/settings";

const PROVIDERS = [
  { value: "anthropic" as const, label: "Anthropic (Claude)", placeholder: "sk-ant-api03-...", type: "cloud" },
  { value: "google" as const, label: "Google (Gemini)", placeholder: "AIza...", type: "cloud" },
  { value: "openai" as const, label: "OpenAI (GPT)", placeholder: "sk-...", type: "cloud" },
  { value: "ollama" as const, label: "Ollama (로컬 LLM)", placeholder: "", type: "local" },
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

export function AISettingsPage({ settings }: { settings: AISettings }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [enabled, setEnabled] = useState(settings.ai_enabled);
  const [provider, setProvider] = useState<AIProvider>(settings.ai_provider);
  const [model, setModel] = useState(settings.ai_model);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama_base_url || "http://localhost:11434");
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  function saveSetting(key: string, value: unknown) {
    startTransition(async () => {
      try {
        await updateSettingAction(key, value);
        toast.success("설정이 저장되었습니다.");
        router.refresh();
      } catch { toast.error("설정 저장에 실패했습니다."); }
    });
  }

  function handleProviderChange(newProvider: AIProvider) {
    setProvider(newProvider);
    const firstModel = MODELS[newProvider]?.[0]?.value ?? "";
    setModel(firstModel);
    setApiKey("");
    setShowKey(false);
    startTransition(async () => {
      try {
        await updateSettingAction("ai_provider", newProvider);
        await updateSettingAction("ai_model", firstModel);
        toast.success("AI 제공자가 변경되었습니다.");
        router.refresh();
      } catch { toast.error("설정 저장에 실패했습니다."); }
    });
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    setIsSavingKey(true);
    try {
      await updateSettingAction(`ai_api_key_${provider}`, apiKey.trim());
      toast.success("API 키가 저장되었습니다.");
      setApiKey(""); setShowKey(false);
      router.refresh();
    } catch { toast.error("API 키 저장에 실패했습니다."); }
    finally { setIsSavingKey(false); }
  }

  async function handleDeleteApiKey() {
    setIsSavingKey(true);
    try {
      await updateSettingAction(`ai_api_key_${provider}`, "");
      toast.success("API 키가 삭제되었습니다.");
      router.refresh();
    } catch { toast.error("삭제에 실패했습니다."); }
    finally { setIsSavingKey(false); }
  }

  async function handleOllamaTest() {
    setOllamaStatus("checking");
    try {
      const res = await fetch("/api/ai-health");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.ok) {
        setOllamaStatus("ok");
        setOllamaModels(data.models ?? []);
        toast.success(`Ollama 연결 성공 — ${data.models?.length ?? 0}개 모델 감지`);
      } else {
        setOllamaStatus("error");
        toast.error(`Ollama 연결 실패: ${data.error}`);
      }
    } catch {
      setOllamaStatus("error");
      toast.error("Ollama 서버에 연결할 수 없습니다.");
    }
  }

  async function handleSaveOllamaUrl() {
    saveSetting("ollama_base_url", ollamaUrl);
  }

  const currentKeyInfo = settings.ai_api_keys[provider];
  const providerModels = MODELS[provider] ?? [];
  const providerConfig = PROVIDERS.find((p) => p.value === provider);
  const isLocal = providerConfig?.type === "local";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Section 1: AI 활성화 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" /> AI 기능
          </CardTitle>
          <CardDescription>AI 메시지 파싱 및 자연어 조회 기능을 제어합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI 파싱 활성화</Label>
              <p className="text-xs text-muted-foreground">
                {enabled ? "AI가 메시지를 자동 분석합니다" : "수동 확인이 필요합니다"}
              </p>
            </div>
            <Switch checked={enabled} disabled={isPending} onCheckedChange={(v: boolean) => { setEnabled(v); saveSetting("ai_enabled", v); }} />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: AI 제공자 + 모델 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> AI 제공자 및 모델
          </CardTitle>
          <CardDescription>메시지 파싱과 자연어 조회에 사용할 AI 서비스를 선택합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>AI 제공자</Label>
            <Select value={provider} disabled={isPending} onValueChange={(v: string) => handleProviderChange(v as AIProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      {p.type === "local" ? <Server className="h-3.5 w-3.5 text-orange-500" /> : <Sparkles className="h-3.5 w-3.5 text-blue-500" />}
                      {p.label}
                      {settings.ai_api_keys[p.value]?.set && (
                        <Badge variant="outline" className="text-green-600 text-[10px] px-1 py-0">등록됨</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>모델</Label>
            <Select value={model} disabled={isPending} onValueChange={(v: string) => { setModel(v); saveSetting("ai_model", v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      {m.label} <span className="text-xs text-muted-foreground">— {m.desc}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: API 키 (클라우드만) */}
      {!isLocal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> API 키 — {providerConfig?.label}
            </CardTitle>
            <CardDescription>선택한 AI 제공자의 API 키를 입력합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentKeyInfo?.set && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />등록됨</Badge>
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{currentKeyInfo.masked}</code>
                <Button size="sm" variant="ghost" className="text-destructive h-6 px-2 text-xs" disabled={isSavingKey} onClick={handleDeleteApiKey}>삭제</Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={currentKeyInfo?.set ? "새 키로 변경..." : providerConfig?.placeholder ?? "API 키 입력..."} className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowKey(!showKey)} tabIndex={-1}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button size="sm" disabled={isSavingKey || !apiKey.trim()} onClick={handleSaveApiKey}>
                {isSavingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Ollama 설정 (로컬만) */}
      {isLocal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Ollama 서버 설정
            </CardTitle>
            <CardDescription>로컬 LLM 서버의 연결 정보를 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>서버 URL</Label>
              <div className="flex gap-2">
                <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
                <Button size="sm" variant="outline" onClick={handleSaveOllamaUrl} disabled={isPending}>저장</Button>
              </div>
              <p className="text-xs text-muted-foreground">Docker에서는 http://host.docker.internal:11434 를 사용합니다.</p>
            </div>

            <div className="space-y-2">
              <Label>연결 테스트</Label>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={handleOllamaTest} disabled={ollamaStatus === "checking"} className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  {ollamaStatus === "checking" ? "확인 중..." : "연결 테스트"}
                </Button>
                {ollamaStatus === "ok" && (
                  <Badge variant="outline" className="text-green-600 gap-1">
                    <CheckCircle className="h-3 w-3" /> 연결됨 — {ollamaModels.length}개 모델
                  </Badge>
                )}
                {ollamaStatus === "error" && (
                  <Badge variant="outline" className="text-red-500">연결 실패</Badge>
                )}
              </div>
              {ollamaModels.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  {ollamaModels.map((m) => (
                    <div key={m} className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 5: 폴백 체인 설명 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI 처리 파이프라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
              <span className="font-medium">{provider === "ollama" ? "Ollama (로컬 LLM)" : providerConfig?.label}</span>
              <Badge variant="secondary" className="text-[10px]">기본</Badge>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">2</div>
              <span>{provider === "ollama" ? "Claude API (클라우드 폴백)" : "Regex 파서"}</span>
              <Badge variant="outline" className="text-[10px]">폴백</Badge>
            </div>
            {provider === "ollama" && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">3</div>
                <span>Regex 파서</span>
                <Badge variant="outline" className="text-[10px]">최종 폴백</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
