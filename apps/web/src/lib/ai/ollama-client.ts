const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT = 60_000;

export interface OllamaGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "qwen3.5:9b";
}

export async function ollamaGenerate(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<OllamaGenerateResult> {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? getOllamaModel(),
        prompt,
        format: "json",
        stream: false,
        options: { temperature: opts?.temperature ?? 0.1, num_predict: opts?.maxTokens ?? 1024 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Ollama API error (${res.status}): ${err}`); }
    const data = await res.json();
    return { text: data.response ?? "", inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0, durationMs: Math.round((data.total_duration ?? 0) / 1e6) };
  } finally { clearTimeout(timeout); }
}

export async function ollamaChat(
  systemPrompt: string,
  userPrompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<OllamaGenerateResult> {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? getOllamaModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        stream: false,
        think: false,
        options: { temperature: opts?.temperature ?? 0.1, num_predict: opts?.maxTokens ?? 1024 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Ollama API error (${res.status}): ${err}`); }
    const data = await res.json();
    // Qwen 3.5+ may put content in thinking field if think mode is not disabled
    const content = data.message?.content || data.message?.thinking || "";
    return { text: content, inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0, durationMs: Math.round((data.total_duration ?? 0) / 1e6) };
  } finally { clearTimeout(timeout); }
}

export async function ollamaHealthCheck(): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const baseUrl = getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models ?? []).map((m: { name: string }) => m.name);
    return { ok: true, models };
  } catch (e) { return { ok: false, models: [], error: (e as Error).message }; }
}
