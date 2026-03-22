const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT = 60_000;
const KEEP_ALIVE = "24h";

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
  return process.env.OLLAMA_MODEL || "qwen3.5:latest";
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
        keep_alive: KEEP_ALIVE,
        options: { temperature: opts?.temperature ?? 0.1, num_predict: opts?.maxTokens ?? 1024 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Ollama API error (${res.status}): ${err}`); }
    const data = await res.json();
    return { text: data.response ?? "", inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0, durationMs: Math.round((data.total_duration ?? 0) / 1e6) };
  } finally { clearTimeout(timeout); }
}

export interface OllamaChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Set false to disable JSON format enforcement (for natural language responses) */
  json?: boolean;
}

export async function ollamaChat(
  systemPrompt: string,
  userPrompt: string,
  opts?: OllamaChatOptions,
): Promise<OllamaGenerateResult> {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  const useJson = opts?.json !== false;
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
        ...(useJson ? { format: "json" } : {}),
        stream: false,
        think: false,
        keep_alive: KEEP_ALIVE,
        options: { temperature: opts?.temperature ?? 0.1, num_predict: opts?.maxTokens ?? 1024 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Ollama API error (${res.status}): ${err}`); }
    const data = await res.json();
    const content = data.message?.content || data.message?.thinking || "";
    return { text: content, inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0, durationMs: Math.round((data.total_duration ?? 0) / 1e6) };
  } finally { clearTimeout(timeout); }
}

/** Preload model into memory (fire and forget) */
export function ollamaPreload(): void {
  const baseUrl = getOllamaBaseUrl();
  fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getOllamaModel(),
      messages: [{ role: "user", content: "ping" }],
      stream: false, think: false, keep_alive: KEEP_ALIVE,
      options: { num_predict: 1 },
    }),
  }).catch(() => {});
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
