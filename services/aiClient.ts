/**
 * One place that decides which AI provider SkillSync's chat-completion calls
 * use. Gemini is the default whenever a Gemini key is set; OpenAI is used only
 * when no Gemini key exists or AI_PROVIDER=openai.
 *
 * Gemini is reached through Google's OpenAI-compatible endpoint, so every
 * caller keeps using the OpenAI SDK's chat.completions.create().
 *
 * Env:
 *   GEMINI_API_KEY  (or VITE_GEMINI_KEY)   — enables Gemini
 *   OPENAI_API_KEY  (or VITE_OPEN_AI_KEY)  — optional
 *   AI_PROVIDER     "gemini" | "openai"    — optional override
 *   GEMINI_MODEL                           — optional, defaults to DEFAULT_GEMINI_MODEL
 */
import OpenAI from "openai";

export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
/** Stable Flash model with no announced shutdown (Gemini 2.0 models were shut down on 2026-06-01). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
export const OPENAI_MODEL = "gpt-4o-mini";
/** Gemini counts thinking tokens against max_tokens, so answers get extra room. */
export const GEMINI_THINKING_HEADROOM = 2048;
export const AI_KEY_MISSING = "No AI key available. Set GEMINI_API_KEY (or OPENAI_API_KEY).";

export type AIProvider = "gemini" | "openai";

const env = (name: string) => (process.env[name] || "").trim();
export const geminiApiKey = () => env("GEMINI_API_KEY") || env("VITE_GEMINI_KEY");
export const openaiApiKey = () => env("OPENAI_API_KEY") || env("VITE_OPEN_AI_KEY");
export const geminiModel = () => env("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;

export function aiProvider(): AIProvider | null {
  const forced = env("AI_PROVIDER").toLowerCase();
  if (forced === "openai" && openaiApiKey()) return "openai";
  if (forced === "gemini" && geminiApiKey()) return "gemini";
  if (geminiApiKey()) return "gemini";
  if (openaiApiKey()) return "openai";
  return null;
}

export const aiKeyAvailable = () => aiProvider() !== null;

/** The model name to pass to chat.completions.create() for the active provider. */
export const chatModel = () => (aiProvider() === "openai" ? OPENAI_MODEL : geminiModel());

type CreateBody = Record<string, any>;

/** Adapts an OpenAI-style request for Gemini's OpenAI-compatible endpoint. */
export function toGeminiRequest(body: CreateBody): CreateBody {
  const { seed: _seed, ...rest } = body; // seed is not supported by the Gemini endpoint
  return {
    ...rest,
    model: geminiModel(),
    reasoning_effort: rest.reasoning_effort ?? "low",
    ...(typeof rest.max_tokens === "number" ? { max_tokens: rest.max_tokens + GEMINI_THINKING_HEADROOM } : {}),
  };
}

/** One structured log line per AI call, so slow or failing calls show up in the Vercel logs. */
export function logAICall(entry: {
  provider: AIProvider;
  model: string;
  ms: number;
  label?: string;
  finish?: string | null;
  usage?: any;
  error?: string;
  status?: number;
}): void {
  const { usage, ...rest } = entry;
  const line = {
    level: entry.error ? "warn" : "info",
    msg: entry.error ? "ai_call_failed" : "ai_call",
    ...rest,
    ...(usage
      ? {
          promptTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          thinkingTokens: usage.completion_tokens_details?.reasoning_tokens,
        }
      : {}),
  };
  (entry.error ? console.warn : console.log)(JSON.stringify(line));
}

/** Wraps chat.completions.create so every call is timed and logged. */
function instrument(client: OpenAI, provider: AIProvider, adapt: (body: CreateBody) => CreateBody): OpenAI {
  const completions = client.chat.completions;
  const create = completions.create.bind(completions);
  completions.create = (async (body: CreateBody, options?: any) => {
    const sent = adapt(body);
    const start = Date.now();
    try {
      const res: any = await create(sent as any, options);
      logAICall({ provider, model: sent.model, ms: Date.now() - start, finish: res?.choices?.[0]?.finish_reason, usage: res?.usage });
      return res;
    } catch (err: any) {
      logAICall({ provider, model: sent.model, ms: Date.now() - start, status: err?.status, error: String(err?.message ?? err).slice(0, 300) });
      throw err;
    }
  }) as any;
  return client;
}

/**
 * An OpenAI SDK client for the active provider. Call sites use it exactly like
 * `new OpenAI({ apiKey })`. `fetch` is injectable for tests.
 */
export function aiClient(opts: { fetch?: typeof fetch } = {}): OpenAI {
  const provider = aiProvider();
  if (!provider) throw new Error(AI_KEY_MISSING);
  if (provider === "openai") {
    return instrument(new OpenAI({ apiKey: openaiApiKey(), fetch: opts.fetch }), "openai", (b) => b);
  }
  const client = new OpenAI({ apiKey: geminiApiKey(), baseURL: GEMINI_OPENAI_BASE_URL, fetch: opts.fetch });
  return instrument(client, "gemini", toGeminiRequest);
}
