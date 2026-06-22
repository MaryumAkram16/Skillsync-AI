import { describe, it, expect } from "vitest";
import { selectRateLimitKey } from "../firestoreRateLimitStore";

/**
 * Tests for selectRateLimitKey — extracted from server.ts's inline
 * keyGenerator closure specifically so this logic could be tested without
 * spinning up the whole Express app. This is the logic behind Issue 7
 * from the original review: a verified user always gets their own key,
 * and an invalid/expired token can never fall back to a client-supplied
 * body.userId (which would let someone dodge their rate limit by just
 * changing that field).
 */

describe("selectRateLimitKey", () => {
  it("prefers verifiedUid over everything else", () => {
    const key = selectRateLimitKey({
      verifiedUid: "user-123",
      bodyUserId: "someone-else",
      ip: "1.2.3.4",
    });
    expect(key).toBe("user-123");
  });

  it("falls back to bodyUserId when there's no verified uid and no invalid token", () => {
    const key = selectRateLimitKey({
      bodyUserId: "user-456",
      ip: "1.2.3.4",
    });
    expect(key).toBe("user-456");
  });

  it("ignores bodyUserId of 'anonymous' and falls back further to IP", () => {
    const key = selectRateLimitKey({
      bodyUserId: "anonymous",
      ip: "1.2.3.4",
    });
    expect(key).toBe("1.2.3.4");
  });

  it("CRITICAL: never trusts bodyUserId when a token was sent but failed verification", () => {
    // This is the actual security property: an expired/forged token must
    // not let the client pick a fresh rate-limit bucket via body.userId.
    const key = selectRateLimitKey({
      authTokenInvalid: true,
      bodyUserId: "attacker-controlled-value",
      ip: "1.2.3.4",
    });
    expect(key).toBe("1.2.3.4");
    expect(key).not.toBe("attacker-controlled-value");
  });

  it("falls back to IP when nothing else is available", () => {
    expect(selectRateLimitKey({ ip: "5.6.7.8" })).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when even IP is unavailable", () => {
    expect(selectRateLimitKey({})).toBe("unknown");
  });

  it("a user spamming different bodyUserId values after an invalid token always collapses to the same IP key", () => {
    const key1 = selectRateLimitKey({ authTokenInvalid: true, bodyUserId: "fake-1", ip: "9.9.9.9" });
    const key2 = selectRateLimitKey({ authTokenInvalid: true, bodyUserId: "fake-2", ip: "9.9.9.9" });
    expect(key1).toBe(key2);
    expect(key1).toBe("9.9.9.9");
  });
});
