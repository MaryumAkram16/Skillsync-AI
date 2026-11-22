import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ThinkingLevel } from "@google/genai";
import { DEFAULT_GEMINI_MODEL, GEMINI_THINKING, GEMINI_TIMEOUT_MS, geminiHttpOptions } from "../services/aiClient";

// Chatbot replies took ~45 s: a slow default model with thinking switched on.
// These guards keep every Gemini call on the fast settings.
const sources = [
  "server.ts",
  ...readdirSync("services")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join("services", f)),
];

describe("Gemini speed settings", () => {
  it("defaults to Flash-Lite with low thinking and a time limit", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(GEMINI_THINKING).toEqual({ thinkingLevel: ThinkingLevel.LOW });
    expect(GEMINI_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(geminiHttpOptions.timeout).toBe(GEMINI_TIMEOUT_MS);
  });

  it("no call sets its own thinking budget", () => {
    const offenders = sources.filter((f) => /thinkingBudget/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("every Gemini call uses the shared thinking setting and every client the shared time limit", () => {
    for (const f of sources) {
      const src = readFileSync(f, "utf8");
      const calls = (src.match(/generateContent\(\{/g) ?? []).length;
      if (!calls || f.endsWith("geminiRetry.ts")) continue;
      expect((src.match(/thinkingConfig: GEMINI_THINKING/g) ?? []).length, f).toBe(calls);
      const clients = (src.match(/new GoogleGenAI\(/g) ?? []).length;
      expect((src.match(/httpOptions: geminiHttpOptions/g) ?? []).length, f).toBe(clients);
    }
  });
});
