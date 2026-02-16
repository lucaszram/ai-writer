import { openai } from "@ai-sdk/openai";

/**
 * Get the AI model to use.
 * When deployed on Vercel, this routes through Vercel AI Gateway automatically.
 * The gateway provides: observability, caching, rate limiting, fallbacks.
 *
 * Configure OPENAI_API_KEY in .env (or use Vercel AI Gateway BYOK).
 */
export function getModel(modelId: string = "gpt-4o-mini") {
  return openai(modelId);
}

export function getVisionModel(modelId: string = "gpt-4o-mini") {
  return openai(modelId);
}
