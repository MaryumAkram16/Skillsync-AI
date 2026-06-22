import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocking the environment and status for the test
const MOCK_KEYS = ["KEY_1", "KEY_2"];
let KEY_STATUS: Record<string, { lastUsed: number; isRateLimited: boolean }> = {};

function getAvailableKey(keys: string[]): string | null {
  const now = Date.now();
  const key = keys.find(k => !KEY_STATUS[k]?.isRateLimited);
  if (key) {
    if (!KEY_STATUS[key]) KEY_STATUS[key] = { lastUsed: 0, isRateLimited: false };
    KEY_STATUS[key].lastUsed = now;
    return key;
  }
  return null;
}

describe('SerpAPI Client & Key Rotation', () => {
  
  beforeEach(() => {
    KEY_STATUS = {
      "KEY_1": { lastUsed: 0, isRateLimited: false },
      "KEY_2": { lastUsed: 0, isRateLimited: false }
    };
  });

  it('should use the first key by default', () => {
    const key = getAvailableKey(MOCK_KEYS);
    expect(key).toBe("KEY_1");
  });

  it('should rotate to the second key if the first is rate limited', () => {
    KEY_STATUS["KEY_1"].isRateLimited = true;
    const key = getAvailableKey(MOCK_KEYS);
    expect(key).toBe("KEY_2");
  });

  it('should return null if all keys are rate limited', () => {
    KEY_STATUS["KEY_1"].isRateLimited = true;
    KEY_STATUS["KEY_2"].isRateLimited = true;
    const key = getAvailableKey(MOCK_KEYS);
    expect(key).toBeNull();
  });

  it('should update lastUsed timestamp when a key is selected', () => {
    const before = Date.now();
    getAvailableKey(MOCK_KEYS);
    const after = Date.now();
    expect(KEY_STATUS["KEY_1"].lastUsed).toBeGreaterThanOrEqual(before);
    expect(KEY_STATUS["KEY_1"].lastUsed).toBeLessThanOrEqual(after);
  });
});
