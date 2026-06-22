import { adminDb } from "./services/firebaseAdmin";
import type { Store, Options, ClientRateLimitInfo } from "express-rate-limit";

/**
 * Firestore-backed store for express-rate-limit.
 *
 * Why this exists: express-rate-limit's default store is an in-memory Map,
 * which only tracks counts within a single process. On Cloud Run (or any
 * multi-instance / autoscaling environment) that means:
 *   - Each instance has its own counter, so a user spread across N instances
 *     effectively gets N x the configured limit.
 *   - Any restart/redeploy/scale-to-zero wipes all counters back to 0.
 * Both defeat the actual purpose of these limiters, which is capping AI
 * spend per user. This store puts the counter in Firestore so every
 * instance reads/writes the same counter.
 *
 * Each limiter (heavy/medium/light) should get its own FirestoreRateLimitStore
 * instance with a distinct `name`, so a user's heavy-limiter count doesn't
 * collide with their light-limiter count.
 *
 * Collection: rate_limits/{name}__{sanitizedKey}
 */

const COLLECTION = "rate_limits";

/**
 * Pure rate-limit key selection logic, extracted from server.ts's inline
 * keyGenerator closure so it's actually testable without spinning up the
 * whole Express app. Behavior is unchanged — just pulled out.
 *
 * Priority: verified Firebase UID > body.userId (only when no token was
 * sent at all, never when a token was sent but failed verification) > IP.
 */
export function selectRateLimitKey(input: {
  verifiedUid?: string;
  authTokenInvalid?: boolean;
  bodyUserId?: string;
  ip?: string;
}): string {
  if (input.verifiedUid) return input.verifiedUid;

  if (!input.authTokenInvalid) {
    if (input.bodyUserId && input.bodyUserId !== "anonymous") {
      return input.bodyUserId;
    }
  }

  return input.ip || "unknown";
}

function sanitizeDocId(raw: string): string {
  // Firestore doc IDs can't contain "/" and shouldn't be excessively long.
  return raw.replace(/[/\s]/g, "_").slice(0, 300) || "_unknown_";
}

export class FirestoreRateLimitStore implements Store {
  private name: string;
  private windowMs = 60 * 60 * 1000; // overwritten by init()

  constructor(name: string) {
    this.name = name;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private docRef(key: string) {
    return adminDb.collection(COLLECTION).doc(`${this.name}__${sanitizeDocId(key)}`);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const ref = this.docRef(key);
    const now = Date.now();

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : null;

        let totalHits: number;
        let resetTime: number;

        if (!data || !data.resetTime || data.resetTime <= now) {
          // No window yet, or the previous window has expired — start fresh.
          totalHits = 1;
          resetTime = now + this.windowMs;
        } else {
          totalHits = (data.totalHits ?? 0) + 1;
          resetTime = data.resetTime;
        }

        tx.set(ref, { totalHits, resetTime, updatedAt: now });
        return { totalHits, resetTime };
      });

      return { totalHits: result.totalHits, resetTime: new Date(result.resetTime) };
    } catch (err: any) {
      // Fail OPEN, not closed: if Firestore/ADC is unreachable (e.g. no
      // metadata server in a sandboxed/local environment), a broken rate
      // limiter should never take down every route in front of it. Log it
      // so it's visible, but let the request through as if it were the
      // first hit in a fresh window.
      console.warn(`[RateLimit] Firestore unreachable for "${this.name}", failing open:`, err.message);
      return { totalHits: 1, resetTime: new Date(now + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    const ref = this.docRef(key);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const totalHits = Math.max(0, (data?.totalHits ?? 0) - 1);
      tx.update(ref, { totalHits });
    }).catch(() => {
      // Best-effort — a failed decrement just means a slightly stricter
      // window for this user, not a correctness or security issue.
    });
  }

  async resetKey(key: string): Promise<void> {
    await this.docRef(key).delete().catch(() => {});
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const snap = await this.docRef(key).get();
    if (!snap.exists) return undefined;
    const data = snap.data();
    if (!data) return undefined;
    return { totalHits: data.totalHits ?? 0, resetTime: data.resetTime ? new Date(data.resetTime) : undefined };
  }
}