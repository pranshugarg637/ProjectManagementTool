/**
 * Minimal Google Gemini client (REST, no SDK) — SERVER ONLY.
 * The API key is read from process.env on the server and is never sent to the browser.
 */
import "server-only";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set", 503);
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    },
  );

  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const message =
      res.status === 429
        ? "The Gemini free-tier quota is used up for now. Try again in a minute."
        : (json.error?.message ?? `Gemini request failed (${res.status})`);
    throw new GeminiError(message, res.status);
  }

  if (json.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini declined to summarise this board.", 422);
  }
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError("Gemini returned an empty answer.", 502);
  return text;
}
