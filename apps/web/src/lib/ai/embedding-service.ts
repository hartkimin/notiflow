import { getOllamaBaseUrl } from "./ollama-client";

const DIMENSION = 768;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

/** Generate embedding using Gemini API → Ollama fallback */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  // Try Gemini first
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:embedContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality: DIMENSION,
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const values = data.embedding?.values;
        if (values?.length) return { embedding: values.slice(0, DIMENSION), model: "gemini-embedding" };
      }
    } catch { /* fall through to Ollama */ }
  }

  // Ollama fallback
  const baseUrl = getOllamaBaseUrl();
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  const emb = data.embeddings?.[0];
  if (!emb) throw new Error("No embedding returned");
  return { embedding: emb.slice(0, DIMENSION), model: "nomic-embed-text" };
}

/** Bulk embeddings */
export async function generateEmbeddingsBulk(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
