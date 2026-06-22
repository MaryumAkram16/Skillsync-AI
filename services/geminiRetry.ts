/**
 * geminiRetry.ts
 *
 * Shared helper to wrap any Gemini `generateContent` call with:
 *   - Detection of 429 / RESOURCE_EXHAUSTED rate-limit errors
 *   - Exponential backoff with jitter (does NOT retry non-429 errors —
 *     those should fall through to the OpenAI fallback immediately)
 *
 * Usage:
 *   const text = await withGeminiRetry(() => ai.models.generateContent({...}));
 */

interface RetryOptions {
  maxRetries?: number;   // default 2 retries (3 attempts total)
  baseDelayMs?: number;  // default 1000ms
  label?: string;        // for logging, e.g. "[Radar]"
}

function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const message = String(err?.message ?? "").toLowerCase();
  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("quota")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`. If it throws a rate-limit error, retries with exponential
 * backoff + jitter. Any other error is re-thrown immediately (so the
 * caller's existing "fall back to OpenAI" logic still kicks in fast).
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, label = "[Gemini]" } = opts;

  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;

      if (!isRateLimitError(err)) {
        // Not a rate-limit issue (bad request, auth error, etc.) —
        // don't waste time retrying, let the caller fall back to OpenAI.
        throw err;
      }

      if (attempt === maxRetries) {
        console.warn(`${label} Gemini rate-limited after ${maxRetries + 1} attempts — giving up, falling back.`);
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      console.warn(`${label} Gemini 429 (attempt ${attempt + 1}/${maxRetries + 1}) — retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastErr;
}

/**
 * Tiny concurrency limiter — caps how many of the given async tasks run
 * at once. Avoids adding a dependency like p-limit for a single use site.
 *
 * Usage:
 *   const results = await runWithConcurrency(items, 2, async (item) => { ... });
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      try {
        const value = await task(items[current], current);
        results[current] = { status: "fulfilled", value };
      } catch (reason) {
        results[current] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
