import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_KEY_MISSING,
  DEFAULT_GEMINI_MODEL,
  GEMINI_THINKING_HEADROOM,
  OPENAI_MODEL,
  aiClient,
  aiProvider,
  chatModel,
  toGeminiRequest,
} from "../services/aiClient";

const KEYS = ["GEMINI_API_KEY", "VITE_GEMINI_KEY", "OPENAI_API_KEY", "VITE_OPEN_AI_KEY", "AI_PROVIDER", "GEMINI_MODEL"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]));
});

/** Captures the request the SDK sends and answers like a chat-completions API. */
function fakeFetch() {
  const calls: { url: string; auth: string | null; body: any }[] = [];
  const fn = (async (url: any, init: any) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(url), auth: headers.get("authorization"), body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({
        id: "x", object: "chat.completion", created: 0, model: "m",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"ok":true}' } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return { fn, calls };
}

describe("aiProvider", () => {
  it("prefers Gemini whenever a Gemini key is set", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.OPENAI_API_KEY = "o";
    expect(aiProvider()).toBe("gemini");
    expect(chatModel()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("uses OpenAI only without a Gemini key, or when forced", () => {
    process.env.OPENAI_API_KEY = "o";
    expect(aiProvider()).toBe("openai");
    expect(chatModel()).toBe(OPENAI_MODEL);
    process.env.GEMINI_API_KEY = "g";
    process.env.AI_PROVIDER = "openai";
    expect(aiProvider()).toBe("openai");
  });

  it("ignores a forced provider that has no key", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.AI_PROVIDER = "openai";
    expect(aiProvider()).toBe("gemini");
  });

  it("reports no provider, and aiClient refuses, without any key", () => {
    expect(aiProvider()).toBeNull();
    expect(() => aiClient()).toThrow(AI_KEY_MISSING);
  });

  it("honours GEMINI_MODEL", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.GEMINI_MODEL = "gemini-custom";
    expect(chatModel()).toBe("gemini-custom");
  });
});

describe("toGeminiRequest", () => {
  it("swaps the model, drops seed, sets low reasoning and adds thinking headroom", () => {
    const out = toGeminiRequest({ model: "gpt-4o-mini", seed: 42, max_tokens: 500, temperature: 0.2, messages: [] });
    expect(out).toEqual({
      model: DEFAULT_GEMINI_MODEL,
      max_tokens: 500 + GEMINI_THINKING_HEADROOM,
      temperature: 0.2,
      messages: [],
      reasoning_effort: "low",
    });
  });

  it("keeps an explicit reasoning_effort and leaves max_tokens out when absent", () => {
    const out = toGeminiRequest({ model: "x", reasoning_effort: "high", messages: [] });
    expect(out.reasoning_effort).toBe("high");
    expect(out).not.toHaveProperty("max_tokens");
  });
});

describe("aiClient", () => {
  const request = {
    model: "gpt-4o-mini",
    seed: 42,
    max_tokens: 300,
    response_format: { type: "json_object" as const },
    messages: [{ role: "user" as const, content: "hi" }],
  };

  it("sends Gemini requests to Google's OpenAI-compatible endpoint with the Gemini key", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.OPENAI_API_KEY = "openai-test-key";
    const { fn, calls } = fakeFetch();
    const res = await aiClient({ fetch: fn }).chat.completions.create(request);
    expect(res.choices[0].message.content).toBe('{"ok":true}');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(calls[0].auth).toBe("Bearer gemini-test-key");
    expect(calls[0].body.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(calls[0].body).not.toHaveProperty("seed");
    expect(calls[0].body.response_format).toEqual({ type: "json_object" });
  });

  it("sends OpenAI requests unchanged to OpenAI", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    const { fn, calls } = fakeFetch();
    await aiClient({ fetch: fn }).chat.completions.create(request);
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(calls[0].auth).toBe("Bearer openai-test-key");
    expect(calls[0].body.model).toBe("gpt-4o-mini");
    expect(calls[0].body.seed).toBe(42);
    expect(calls[0].body.max_tokens).toBe(300);
  });
});

describe("AI call logging", () => {
  it("logs one line per call with duration, model, finish reason and thinking tokens, never the key", async () => {
    process.env.GEMINI_API_KEY = "gemini-secret-key";
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s: string) => lines.push(s);
    try {
      const fetchWithUsage = (async () =>
        new Response(
          JSON.stringify({
            id: "x", object: "chat.completion", created: 0, model: "m",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "hi" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, completion_tokens_details: { reasoning_tokens: 300 } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as typeof fetch;
      await aiClient({ fetch: fetchWithUsage }).chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] });
    } finally {
      console.log = orig;
    }
    const entry = JSON.parse(lines.find((l) => l.includes('"ai_call"'))!);
    expect(entry).toMatchObject({ msg: "ai_call", provider: "gemini", model: DEFAULT_GEMINI_MODEL, finish: "stop", promptTokens: 10, outputTokens: 5, thinkingTokens: 300 });
    expect(typeof entry.ms).toBe("number");
    expect(lines.join("\n")).not.toContain("gemini-secret-key");
  });

  it("logs failures with the status and rethrows", async () => {
    process.env.GEMINI_API_KEY = "g";
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (s: string) => warns.push(s);
    try {
      const failing = (async () => new Response(JSON.stringify({ error: { message: "bad model" } }), { status: 400, headers: { "content-type": "application/json" } })) as typeof fetch;
      await expect(aiClient({ fetch: failing }).chat.completions.create({ model: "x", messages: [] })).rejects.toThrow();
    } finally {
      console.warn = orig;
    }
    expect(JSON.parse(warns.find((w) => w.includes("ai_call_failed"))!)).toMatchObject({ provider: "gemini", status: 400 });
  });
});
