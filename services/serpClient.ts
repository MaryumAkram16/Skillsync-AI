import { singleFlight } from "./singleFlight";
import { log } from "../logger";

/**
 * serpClient.ts
 * Centralized, cost-optimized wrapper for SerpAPI.
 * Features:
 *  - Automatic key rotation across primary and fallback keys.
 *  - In-memory rate-limit tracking to avoid hitting 429s unnecessarily.
 *  - Deduplication of identical in-flight requests via singleFlight.
 *  - Circuit breaker: backs off all keys when repeated failures occur.
 */

const KEYS = [
  process.env.SERP_API_KEY || process.env.SERPAPI_KEY,
  process.env.SERP_API_KEY_2 || process.env.SERPAPI_KEY_2,
].filter(Boolean) as string[];

const KEY_STATUS: Record<string, { lastUsed: number; isRateLimited: boolean }> = {};

// Initialize status for each key
KEYS.forEach(key => {
  KEY_STATUS[key] = { lastUsed: 0, isRateLimited: false };
});

// Rate limit cooldown (1 hour)
const RATE_LIMIT_COOLDOWN = 60 * 60 * 1000;

// Circuit breaker: stop calling SerpAPI entirely after repeated failures
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function getAvailableKey(): string | null {
  const now = Date.now();

  if (now < circuitOpenUntil) {
    return null;
  }
  if (circuitOpenUntil > 0 && now >= circuitOpenUntil) {
    circuitOpenUntil = 0;
    consecutiveFailures = 0;
    log.info("SerpClient circuit breaker reset");
  }

  for (const key of KEYS) {
    if (KEY_STATUS[key].isRateLimited && (now - KEY_STATUS[key].lastUsed > RATE_LIMIT_COOLDOWN)) {
      KEY_STATUS[key].isRateLimited = false;
      log.info("SerpClient key rate limit reset", { key: `...${key.slice(-4)}` });
    }
  }

  const key = KEYS.find(k => !KEY_STATUS[k].isRateLimited);
  if (key) {
    KEY_STATUS[key].lastUsed = now;
    return key;
  }

  return null;
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
    log.warn("SerpClient circuit breaker OPEN", { cooldownMs: CIRCUIT_BREAKER_COOLDOWN });
  }
}

export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

export async function searchSerp(query: string, num = 8): Promise<SerpResult[]> {
  return singleFlight(`serp-search-${query}`, async () => {
    const key = getAvailableKey();
    if (!key) {
      log.warn("SerpClient: no available keys");
      return [];
    }

    try {
      const params = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: key,
        num: String(num),
        hl: "en",
        gl: "us",
      });

      const res = await fetch(`https://serpapi.com/search?${params}`);

      if (res.status === 429) {
        log.warn("SerpClient key rate limited", { key: `...${key.slice(-4)}` });
        KEY_STATUS[key].isRateLimited = true;
        KEY_STATUS[key].lastUsed = Date.now();
        recordFailure();
        return searchSerp(query, num);
      }

      if (!res.ok) {
        log.warn("SerpClient key error", { key: `...${key.slice(-4)}`, status: res.status });
        recordFailure();
        return [];
      }

      const data = await res.json();
      recordSuccess();

      const organic = (data.organic_results ?? [])
        .slice(0, num)
        .map((r: any) => ({
          title: r.title ?? "",
          url: r.link ?? "",
          snippet: r.snippet ?? "",
          source: r.source ?? "",
          date: r.date ?? "",
        }));

      if (query.toLowerCase().includes("salary")) {
        const extra: any[] = [];
        if (data.answer_box) {
          extra.push({
            title: "Answer Box",
            url: data.answer_box.link || "",
            snippet: data.answer_box.answer || data.answer_box.snippet || "",
            source: "SerpAPI Answer Box"
          });
        }
        if (data.knowledge_graph) {
          extra.push({
            title: "Knowledge Graph",
            url: "",
            snippet: data.knowledge_graph.description || (data.knowledge_graph.attributes?.[0]?.value) || "",
            source: "SerpAPI Knowledge Graph"
          });
        }
        return [...extra, ...organic].filter(r => r.snippet);
      }

      return organic.filter((r: SerpResult) => r.url && r.title);
    } catch (e: any) {
      log.error("SerpClient search failed", { error: e.message });
      recordFailure();
      return [];
    }
  });
}
