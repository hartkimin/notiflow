/**
 * Shared AI Client for Supabase Edge Functions
 *
 * Supports three providers:
 * - Anthropic (Claude) via official SDK
 * - Google (Gemini) via REST API
 * - OpenAI (GPT) via REST API
 */

import Anthropic from "npm:@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AICallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProviderSettings {
  provider: string;
  apiKey: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function callAI(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<AICallResult> {
  switch (provider) {
    case "google":
      return callGemini(apiKey, model, prompt);
    case "openai":
      return callOpenAI(apiKey, model, prompt);
    default:
      return callClaude(apiKey, model, prompt);
  }
}

export async function generateEmbedding(
  provider: string,
  apiKey: string,
  model: string,
  input: string,
): Promise<number[]> {
  switch (provider) {
    case "ollama":
      return getOllamaEmbedding(model, input);
    case "openai":
      return getOpenAIEmbedding(apiKey, model, input);
    case "google":
      return getGeminiEmbedding(apiKey, model, input);
    default:
      // If no provider but we want local, try Ollama
      return getOllamaEmbedding("nomic-embed-text", input);
  }
}

async function getOllamaEmbedding(
  model: string,
  input: string,
): Promise<number[]> {
  const baseUrl = Deno.env.get("OLLAMA_BASE_URL") || "http://host.docker.internal:11434";
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "nomic-embed-text",
      input,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama Embedding error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.embeddings?.[0] || [];
}

// ---------------------------------------------------------------------------
// Anthropic (Claude) — uses SDK already in the dependency tree
// ---------------------------------------------------------------------------

async function callClaude(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<AICallResult> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find(
    (block: { type: string }) => block.type === "text",
  );

  return {
    text: textBlock && textBlock.type === "text" ? textBlock.text : "",
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Google Gemini — REST API (no extra SDK needed)
// ---------------------------------------------------------------------------

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<AICallResult> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function getGeminiEmbedding(
  apiKey: string,
  model: string,
  input: string,
): Promise<number[]> {
  // text-embedding-004 is current standard
  const embeddingModel = model.includes("embedding") ? model : "text-embedding-004";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: input }] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Embedding error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.embedding?.values ?? [];
}

// ---------------------------------------------------------------------------
// OpenAI (GPT) — REST API (no extra SDK needed)
// ---------------------------------------------------------------------------

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<AICallResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function getOpenAIEmbedding(
  apiKey: string,
  model: string,
  input: string,
): Promise<number[]> {
  const embeddingModel = model.includes("text-embedding") ? model : "text-embedding-3-small";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input,
      dimensions: 768, // CRITICAL: DB vector(768)와 일치시킴
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Embedding error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Helpers — resolve API key from settings or environment
// ---------------------------------------------------------------------------

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * Resolve the AI provider settings from the settings map.
 * Falls back to environment variables when no DB key is stored.
 */
export function resolveAIProvider(
  settingsMap: Map<string, unknown>,
): AIProviderSettings | null {
  const provider = (["anthropic", "google", "openai"].includes(
      settingsMap.get("ai_provider") as string,
    )
    ? (settingsMap.get("ai_provider") as string)
    : "anthropic");

  // Try DB key first, then env var
  let apiKey = settingsMap.get(`ai_api_key_${provider}`) as string | null;
  if (!apiKey || typeof apiKey !== "string") {
    apiKey = Deno.env.get(ENV_KEY_MAP[provider] ?? "") ?? null;
  }

  if (!apiKey) return null;

  const model = (typeof settingsMap.get("ai_model") === "string"
    ? (settingsMap.get("ai_model") as string).replace(/^"|"$/g, "")
    : getDefaultModel(provider));

  return { provider, apiKey, model };
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google":
      return "gemini-2.0-flash";
    case "openai":
      return "gpt-4o-mini";
    default:
      return "claude-haiku-4-5-20251001";
  }
}
