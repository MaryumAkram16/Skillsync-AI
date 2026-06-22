import { singleFlight } from "./singleFlight";

/**
 * serpClient.ts
 * Centralized, cost-optimized wrapper for SerpAPI.
 * Features:
 *  - Automatic key rotation across primary and fallback keys.
 *  - In-memory rate-limit tracking to avoid hitting 429s unnecessarily.
 *  - Deduplication of identical in-flight requests via singleFlight.
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

function getAvailableKey(): string | null {
  const now = Date.now();
  
  // Reset rate limit status if cooldown has passed
  for (const key of KEYS) {
    if (KEY_STATUS[key].isRateLimited && (now - KEY_STATUS[key].lastUsed > RATE_LIMIT_COOLDOWN)) {
      KEY_STATUS[key].isRateLimited = false;
      console.log(`[SerpClient] Resetting rate limit for key: ...${key.slice(-4)}`);
    }
  }

  // Find the first key that isn't rate limited
  const key = KEYS.find(k => !KEY_STATUS[k].isRateLimited);
  if (key) {
    KEY_STATUS[key].lastUsed = now;
    return key;
  }

  return null;
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
      console.warn("[SerpClient] No available keys (all rate limited).");
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
        console.warn(`[SerpClient] Key ...${key.slice(-4)} rate limited (429)`);
        KEY_STATUS[key].isRateLimited = true;
        KEY_STATUS[key].lastUsed = Date.now();
        // Try again with a different key
        return searchSerp(query, num);
      }

      if (!res.ok) {
        console.warn(`[SerpClient] Key ...${key.slice(-4)} error: ${res.status}`);
        return [];
      }

      const data = await res.json();
      
      // Handle organic results
      const organic = (data.organic_results ?? [])
        .slice(0, num)
        .map((r: any) => ({
          title: r.title ?? "",
          url: r.link ?? "",
          snippet: r.snippet ?? "",
          source: r.source ?? "",
          date: r.date ?? "",
        }));

      // If it's a salary query, we might want answer_box or knowledge_graph
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
      console.error(`[SerpClient] Search failed:`, e.message);
      return [];
    }
  });
}
