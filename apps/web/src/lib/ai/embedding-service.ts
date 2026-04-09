import { getOllamaBaseUrl } from "./ollama-client";

const DIMENSION = 768;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

/** Generate embedding using Gemini API → Ollama fallback */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  // Try Ollama (Local) First - This is our primary model
  const baseUrl = getOllamaBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", input: text }),
      signal: AbortSignal.timeout(10_000), // Shorter timeout for local
    });
    if (res.ok) {
      const data = await res.json();
      const emb = data.embeddings?.[0];
      if (emb) return { embedding: emb.slice(0, DIMENSION), model: "nomic-embed-text" };
    }
  } catch (err) {
    console.warn("Local Ollama embedding failed, checking fallback:", (err as Error).message);
  }

  // Fallback to Gemini only if explicitly configured (Optional)
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {

/** Bulk embeddings */
export async function generateEmbeddingsBulk(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
