"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bot, FlaskConical, Loader2, CheckCircle, AlertTriangle,
  Key, Eye, EyeOff,
} from "lucide-react";
import { updateSettingAction } from "@/app/(dashboard)/settings/actions";
import { testParseMessage } from "@/lib/actions";
import type { AISettings, AIProvider } from "@/lib/queries/settings";

// ---------------------------------------------------------------------------
// Provider & Model config
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { value: "anthropic" as const, label: "Anthropic (Claude)", placeholder: "sk-ant-api03-..." },
  { value: "google" as const, label: "Google (Gemini)", placeholder: "AIza..." },
  { value: "openai" as const, label: "OpenAI (GPT)", placeholder: "sk-..." },
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
  const [prompt, setPrompt] = useState(settings.ai_parse_prompt ?? "");
  const [autoProcess, setAutoProcess] = useState(settings.ai_auto_process);
  const [threshold, setThreshold] = useState(String(settings.ai_confidence_threshold));

  // API key state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Drug API key state
  const [drugApiKey, setDrugApiKey] = useState("");
  const [showDrugKey, setShowDrugKey] = useState(false);
  const [isSavingDrugKey, setIsSavingDrugKey] = useState(false);

  // Test parse state
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

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

  async function handleTestParse() {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const data = await testParseMessage(testMessage);
      setTestResult(data as unknown as Record<string, unknown>);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "테스트 실패");
    } finally {
      setIsTesting(false);
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

      {/* Parse Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">파싱 프롬프트</CardTitle>
          <CardDescription>
            AI에 전달할 추가 지시사항입니다. 비워두면 기본 프롬프트가 사용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: 병원명 뒤에 오는 숫자는 수량입니다. 단위가 없으면 '박스'로 간주합니다."
            rows={4}
            className="resize-y"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => saveSetting("ai_parse_prompt", prompt || null)}
            >
              프롬프트 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto Process */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">자동 주문 생성</CardTitle>
          <CardDescription>
            AI 파싱 결과의 신뢰도가 기준치 이상이면 자동으로 주문을 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>자동 생성</Label>
              <p className="text-xs text-muted-foreground">
                {autoProcess ? "신뢰도 기준 충족 시 자동 주문 생성" : "모든 주문은 수동 확인 필요"}
              </p>
            </div>
            <Switch
              checked={autoProcess}
              disabled={isPending}
              onCheckedChange={(v: boolean) => {
                setAutoProcess(v);
                saveSetting("ai_auto_process", v);
              }}
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>매칭 신뢰도 기준</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-24"
              />
              <Badge variant="outline">{Math.round(Number(threshold) * 100)}%</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  const num = Math.max(0, Math.min(1, Number(threshold)));
                  setThreshold(String(num));
                  saveSetting("ai_confidence_threshold", num);
                }}
              >
                저장
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              0.0 ~ 1.0 사이의 값. 높을수록 정확한 매칭만 자동 처리됩니다.
            </p>
          </div>
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

      {/* Test Parse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            파싱 테스트
          </CardTitle>
          <CardDescription>
            메시지를 입력하면 실제 파싱 로직으로 테스트합니다. DB에는 저장되지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder={"예:\n서울대병원\n타이레놀정 500mg 2박스\n아스피린 100mg 1박스"}
            rows={5}
            className="resize-y font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button
              disabled={isTesting || !testMessage.trim()}
              onClick={handleTestParse}
            >
              {isTesting ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 분석중...</>
              ) : (
                <><FlaskConical className="h-4 w-4 mr-1.5" /> 파싱 테스트</>
              )}
            </Button>
          </div>

          {testError && (
            <div className="rounded-md bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{testError}</p>
            </div>
          )}

          {testResult && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">파싱 결과</span>
                {testResult.ai_provider != null && (
                  <Badge variant="secondary" className="text-xs">
                    {String(testResult.ai_provider)}/{String(testResult.ai_model)}
                  </Badge>
                )}
                {testResult.method === "regex" && (
                  <Badge variant="outline" className="text-xs">
                    정규식 (AI 미사용)
                  </Badge>
                )}
                {testResult.match_summary != null && (
                  <div className="flex gap-1.5 ml-auto">
                    <Badge variant="default">{(testResult.match_summary as Record<string, number>).matched ?? 0} 매칭</Badge>
                    <Badge variant="secondary">{(testResult.match_summary as Record<string, number>).review ?? 0} 검토</Badge>
                    <Badge variant="outline">{(testResult.match_summary as Record<string, number>).unmatched ?? 0} 미매칭</Badge>
                  </div>
                )}
              </div>

              {Array.isArray(testResult.items) && testResult.items.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">원문</th>
                        <th className="text-left p-2 font-medium">매칭 품목</th>
                        <th className="text-center p-2 font-medium">수량</th>
                        <th className="text-center p-2 font-medium">신뢰도</th>
                        <th className="text-center p-2 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(testResult.items as Array<Record<string, unknown>>).map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 text-xs text-muted-foreground max-w-[150px] truncate">
                            {String(item.original_text ?? item.product_name ?? "")}
                          </td>
                          <td className="p-2">
                            {item.product_official_name ? String(item.product_official_name) : (
                              <span className="text-muted-foreground italic">미매칭</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {String(item.quantity ?? "")}{item.unit ? ` ${item.unit}` : ""}
                          </td>
                          <td className="p-2 text-center">
                            {item.match_confidence != null && (
                              <Badge
                                variant={
                                  Number(item.match_confidence) >= 0.8 ? "default" :
                                  Number(item.match_confidence) >= 0.5 ? "secondary" : "outline"
                                }
                              >
                                {Math.round(Number(item.match_confidence) * 100)}%
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <Badge
                              variant={
                                item.match_status === "matched" ? "default" :
                                item.match_status === "review" ? "secondary" : "outline"
                              }
                            >
                              {item.match_status === "matched" ? "매칭" :
                               item.match_status === "review" ? "검토" : "미매칭"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {testResult.method != null && testResult.latency_ms != null && (
                <p className="text-xs text-muted-foreground">
                  파싱 방법: {String(testResult.method)} | 소요시간: {String(testResult.latency_ms)}ms
                  {testResult.token_usage != null && (
                    <> | 토큰: {String((testResult.token_usage as Record<string, number>).input_tokens)}→{String((testResult.token_usage as Record<string, number>).output_tokens)}</>
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
