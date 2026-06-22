import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry } from "./geminiRetry";

/**
 * Shared AI caller used by all three career-mentor features (quiz
 * generation, the adaptive assessment, and mentor recommendations).
 *
 * `provider` controls routing:
 *   "gemini-first" (default) — try Gemini, fall back to OpenAI on failure.
 *                               Used for generation, where we want maximum
 *                               uptime even if it costs an OpenAI call.
 *   "gemini"        — Gemini ONLY, no OpenAI fallback. Used for validation:
 *                      a narrow deterministic fact-check task that doesn't
 *                      need GPT, and callers already tolerate "skip
 *                      validation if it fails" so there's no uptime loss
 *                      from refusing to spend an OpenAI call here.
 *   "openai"        — OpenAI ONLY, no Gemini attempt. Reserved for cases
 *                      where you explicitly want to bypass Gemini (e.g. a
 *                      final fallback attempt after Gemini has already
 *                      failed twice in the same flow).
 */

export interface AICallOptions {
  temperature?: number;
  seed?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  provider?: "gemini-first" | "gemini" | "openai";
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  opts: AICallOptions
): Promise<string> {
  const { temperature = 0.3, maxTokens = 3000, jsonMode = true } = opts;
  const geminiKey = (process.env.CAREER_MENTOR_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  if (!geminiKey) throw new Error("No Gemini key available (GEMINI_API_KEY / VITE_GEMINI_KEY / CAREER_MENTOR_GEMINI_API_KEY).");

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const result = await withGeminiRetry(
    () =>
      ai.models.generateContent({
        model: "gemini-2.0-flash-thinking-exp",
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: jsonMode ? "application/json" : undefined,
          // Enable thinking for nuanced career guidance
          thinkingConfig: { thinkingBudget: 2000 },
        },
      }),
    { label: "[CareerMentor]" }
  );
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response was truncated (MAX_TOKENS) — increase maxTokens or shorten the prompt");
  }
  const text = result.text;
  if (!text) throw new Error("Gemini empty response");
  console.log("[CareerMentor] Gemini used ✓");
  return text;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  openaiKey: string,
  opts: AICallOptions
): Promise<string> {
  const { temperature = 0.3, maxTokens = 3000, jsonMode = true } = opts;
  if (!openaiKey) throw new Error("No AI key available. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  const openai = new OpenAI({ apiKey: openaiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    seed: opts.seed ?? 42,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  if (completion.choices[0]?.finish_reason === "length") {
    throw new Error("OpenAI response was truncated (finish_reason=length) — increase maxTokens or shorten the prompt");
  }
  console.log("[CareerMentor] OpenAI used ✓");
  return completion.choices[0]?.message?.content || "{}";
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  openaiKey: string,
  opts: AICallOptions = {}
): Promise<string> {
  const provider = opts.provider ?? "gemini-first";

  if (provider === "openai") {
    return callOpenAI(systemPrompt, userPrompt, openaiKey, opts);
  }

  if (provider === "gemini") {
    // No fallback — caller has decided this step shouldn't spend an
    // OpenAI call under any circumstances. Let it throw on failure;
    // callers of validation already catch and proceed unvalidated.
    return callGemini(systemPrompt, userPrompt, opts);
  }

  // "gemini-first" (default): try Gemini, fall back to OpenAI on failure.
  try {
    return await callGemini(systemPrompt, userPrompt, opts);
  } catch (err: any) {
    console.warn(`[CareerMentor] Gemini failed (${err.message}) — falling back to OpenAI`);
    return callOpenAI(systemPrompt, userPrompt, openaiKey, opts);
  }
}