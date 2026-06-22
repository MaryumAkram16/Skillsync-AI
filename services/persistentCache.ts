/**
 * persistentCache.ts
 *
 * Drop-in replacement for the per-service in-memory `Map` caches in
 * radarService.ts, careerMentorService.ts, and useCasesService.ts.
 *
 * Why this exists: those caches were plain `Map<string, {result, expiresAt}>`
 * objects living in process memory. On Cloud Run (and most serverless
 * platforms) instances restart, scale to zero, or run as multiple replicas —
 * so the cache was frequently empty even for queries scanned minutes earlier
 * by a *different* instance. Every cache miss became a fresh Gemini call,
 * which is the main thing pushing you toward the rate limit.
 *
 * This module stores cache entries in Firestore (shared across all server
 * instances) and keeps a small in-memory layer on top purely as a fast path
 * + safety net: if Firestore is briefly unreachable, reads/writes fall back
 * to memory instead of throwing, so a Firestore hiccup never breaks a
 * request — it just behaves like the old in-memory-only cache for that one
 * call.
 *
 * Usage (mirrors the old Map-based helpers almost exactly):
 *
 *   import { getPersistentCache, setPersistentCache } from "./persistentCache";
 *
 *   const cached = await getPersistentCache<RadarResult>("radar", key);
 *   if (cached) return cached;
 *   ...
 *   await setPersistentCache("radar", key, result, 24 * 60 * 60 * 1000);
 *
 * The `namespace` argument (e.g. "radar", "mentor", "usecases") keeps each
 * service's keys in their own Firestore collection so they can't collide
 * and so you can inspect/clear them independently in the console.
 *
 * ── Why this uses the ADMIN SDK (not the client SDK) ────────────────────────
 * This module used to use the client Firestore SDK with a fully-open rule
 * (`allow read, write: if true`) on these collections. That made the cache
 * shareable across all users (the intended design — one user's lookup
 * benefits everyone else who asks the same question, which is real cost
 * savings) but it ALSO meant anyone on the internet — not just your app —
 * could write directly into these collections via the client SDK and the
 * public Firebase config, with no rate limit, no size cap, and no way to
 * tell a real cached AI response from a planted fake one (cache poisoning).
 *
 * The fix: writes now go through the admin SDK, which only your own server
 * process can do, and the rules for these collections are now
 * `allow read: if true; allow write: if false;` — reads stay public (so the
 * shared-cache cost savings are unchanged), but only this server-side code
 * can ever create or update an entry.
 */

import { adminDb } from "./firebaseAdmin";

// ─── In-memory fallback layer (same shape as the old per-service Maps) ──────

interface MemEntry {
  value: any;
  expiresAt: number;
}

const memFallback = new Map<string, MemEntry>();

function memKey(namespace: string, key: string): string {
  return `${namespace}::${key}`;
}

function getMemFallback<T>(namespace: string, key: string): T | null {
  const entry = memFallback.get(memKey(namespace, key));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memFallback.delete(memKey(namespace, key));
    return null;
  }
  return entry.value as T;
}

function setMemFallback(namespace: string, key: string, value: any, ttlMs: number): void {
  memFallback.set(memKey(namespace, key), { value, expiresAt: Date.now() + ttlMs });
}

// ─── Firestore key sanitisation ──────────────────────────────────────────────
// Firestore document IDs can't contain "/" and shouldn't be excessively long.

function sanitizeDocId(key: string): string {
  return key.replace(/\//g, "_").slice(0, 1500) || "_empty_";
}

const COLLECTION_PREFIX = "ai_cache_";

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Read a cached value. Tries Firestore first (shared across instances),
 * falls back to the in-process Map if Firestore is unavailable or errors.
 * Returns null on a clean miss (expired or never set) in either layer.
 */
export async function getPersistentCache<T>(namespace: string, key: string): Promise<T | null> {
  try {
    const docId = sanitizeDocId(key);
    const docRef = adminDb.collection(COLLECTION_PREFIX + namespace).doc(docId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      const expiresAt = data?.expiresAt ?? 0;
      if (expiresAt > Date.now()) {
        console.log(`[PersistentCache] Firestore HIT (${namespace}): ${key}`);
        return data?.value as T;
      }
      // Expired — best-effort delete, don't block on it.
      docRef.delete().catch(() => {});
    }
  } catch (err: any) {
    console.warn(`[PersistentCache] Firestore read failed (${namespace}), falling back to memory:`, err.message);
  }

  return getMemFallback<T>(namespace, key);
}

/**
 * Write a cached value. Writes to Firestore (best effort) AND the in-memory
 * fallback, so a Firestore write failure doesn't lose the cache entry for
 * the lifetime of this process at least.
 */
export async function setPersistentCache(
  namespace: string,
  key: string,
  value: any,
  ttlMs: number
): Promise<void> {
  // Always set the memory fallback synchronously — cheap and instant.
  setMemFallback(namespace, key, value, ttlMs);

  try {
    const docId = sanitizeDocId(key);
    await adminDb.collection(COLLECTION_PREFIX + namespace).doc(docId).set({
      value,
      expiresAt: Date.now() + ttlMs,
      cachedAt: Date.now(),
    });
    console.log(`[PersistentCache] Firestore SET (${namespace}): ${key}`);
  } catch (err: any) {
    console.warn(`[PersistentCache] Firestore write failed (${namespace}), kept in memory only:`, err.message);
  }
}