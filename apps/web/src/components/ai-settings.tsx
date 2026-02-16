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
import { Bot, FlaskConical, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { updateSettingAction } from "@/app/(dashboard)/settings/actions";
import { createClient } from "@/lib/supabase/client";
import type { AISettings } from "@/lib/queries/settings";

const AI_MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "빠르고 경제적" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", description: "균형잡힌 성능" },
];

export function AISettingsForm({ settings }: { settings: AISettings }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Local state for each setting
  const [enabled, setEnabled] = useState(settings.ai_enabled);
  const [model, setModel] = useState(settings.ai_model);
  const [prompt, setPrompt] = useState(settings.ai_parse_prompt ?? "");
  const [autoProcess, setAutoProcess] = useState(settings.ai_auto_process);
  const [threshold, setThreshold] = useState(String(settings.ai_confidence_threshold));

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

  async function handleTestParse() {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("test-parse", {
        body: { message: testMessage },
      });
      if (error) throw error;
      setTestResult(data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "테스트 실패");
    } finally {
      setIsTesting(false);
    }
  }

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
              onCheckedChange={(v) => {
                setEnabled(v);
                saveSetting("ai_enabled", v);
              }}
            />
          </div>
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
            onValueChange={(v) => {
              setModel(v);
              saveSetting("ai_model", v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
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
              onCheckedChange={(v) => {
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
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">파싱 결과</span>
                {testResult.summary != null && (
                  <div className="flex gap-1.5 ml-auto">
                    <Badge variant="default">{(testResult.summary as Record<string, number>).matched ?? 0} 매칭</Badge>
                    <Badge variant="secondary">{(testResult.summary as Record<string, number>).review ?? 0} 검토</Badge>
                    <Badge variant="outline">{(testResult.summary as Record<string, number>).unmatched ?? 0} 미매칭</Badge>
                  </div>
                )}
              </div>

              {testResult.hospital_name != null && (
                <div className="text-sm">
                  <span className="text-muted-foreground">감지된 병원: </span>
                  <span className="font-medium">{String(testResult.hospital_name)}</span>
                  {testResult.hospital_id != null && (
                    <Badge variant="outline" className="ml-2">ID: {String(testResult.hospital_id)}</Badge>
                  )}
                </div>
              )}

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
                            {String(item.original_text ?? "")}
                          </td>
                          <td className="p-2">
                            {item.product_name ? String(item.product_name) : (
                              <span className="text-muted-foreground italic">미매칭</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {String(item.quantity ?? "")}{item.unit_type ? ` ${item.unit_type}` : ""}
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

              {testResult.parse_method != null && (
                <p className="text-xs text-muted-foreground">
                  파싱 방법: {String(testResult.parse_method)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
