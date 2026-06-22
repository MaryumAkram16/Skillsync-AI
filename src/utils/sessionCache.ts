/**
 * sessionCache.ts
 *
 * A robust utility to cache large API responses (such as job search results or
 * parsing outputs) in `sessionStorage` so that navigating between pages does not
 * trigger redundant network calls.
 * 
 * Supports TTL (Time to Live) and gracefully handles QuotaExceeded errors
 * or disabled/unsupported storage states (e.g., in certain sandboxed iframe modes).
 */

const CACHE_PREFIX = "skillsync_scache:";
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default cache duration

interface CacheItem<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

/**
 * Checks if sessionStorage is supported and available in the current context.
 */
function isSessionStorageAvailable(): boolean {
  try {
    const testKey = "__session_storage_test__";
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const isAvailable = isSessionStorageAvailable();

export const sessionCache = {
  /**
   * Checks if a key exists and is non-expired.
   */
  has(key: string): boolean {
    if (!isAvailable) return false;
    try {
      const fullKey = CACHE_PREFIX + key;
      const raw = window.sessionStorage.getItem(fullKey);
      if (!raw) return false;

      const item = JSON.parse(raw) as CacheItem<any>;
      if (Date.now() > item.expiresAt) {
        window.sessionStorage.removeItem(fullKey);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Retrieves an item from the cache. Returns null if not found or expired.
   */
  get<T>(key: string): T | null {
    if (!isAvailable) return null;
    try {
      const fullKey = CACHE_PREFIX + key;
      const raw = window.sessionStorage.getItem(fullKey);
      if (!raw) return null;

      const item = JSON.parse(raw) as CacheItem<T>;
      if (Date.now() > item.expiresAt) {
        // Expired — remove and return null
        window.sessionStorage.removeItem(fullKey);
        return null;
      }
      return item.value;
    } catch (err) {
      console.warn(`[SessionCache] Failed to parse cached payload for key: ${key}`, err);
      return null;
    }
  },

  /**
   * Saves an item to the cache. Cleans up expired items if QuotaExceededError is encountered.
   */
  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): boolean {
    if (!isAvailable) return false;
    try {
      const fullKey = CACHE_PREFIX + key;
      const item: CacheItem<T> = {
        value,
        expiresAt: Date.now() + ttlMs,
        cachedAt: Date.now(),
      };

      const payload = JSON.stringify(item);
      window.sessionStorage.setItem(fullKey, payload);
      return true;
    } catch (err) {
      if (err instanceof DOMException && (
        err.name === "QuotaExceededError" || 
        err.name === "NS_ERROR_DOM_QUOTA_REACHED"
      )) {
        console.warn("[SessionCache] sessionStorage is full. Attempting cleanup of expired items...");
        // Clear all expired or oldest cached items to free up space
        this.cleanExpired();
        
        try {
          // Re-try store after cleanup
          const fullKey = CACHE_PREFIX + key;
          const item: CacheItem<T> = {
            value,
            expiresAt: Date.now() + ttlMs,
            cachedAt: Date.now(),
          };
          window.sessionStorage.setItem(fullKey, JSON.stringify(item));
          return true;
        } catch {
          // If it still fails, wipe our specific prefix namespace to recover
          console.warn("[SessionCache] Cleanup of expired items was insufficient. Wiping all cached routes.");
          this.clear();
        }
      } else {
        console.warn(`[SessionCache] Write failed for key: ${key}`, err);
      }
      return false;
    }
  },

  /**
   * Removes a specific item from the session cache.
   */
  remove(key: string): void {
    if (!isAvailable) return;
    try {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
    } catch {}
  },

  /**
   * Wipes all items managed by this cache prefix.
   */
  clear(): void {
    if (!isAvailable) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const fullKey = window.sessionStorage.key(i);
        if (fullKey && fullKey.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(fullKey);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch (err) {
      console.warn("[SessionCache] Failed to clear items", err);
    }
  },

  /**
   * Purges expired items.
   */
  cleanExpired(): void {
    if (!isAvailable) return;
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const fullKey = window.sessionStorage.key(i);
        if (fullKey && fullKey.startsWith(CACHE_PREFIX)) {
          try {
            const raw = window.sessionStorage.getItem(fullKey);
            if (raw) {
              const item = JSON.parse(raw) as CacheItem<any>;
              if (now > item.expiresAt) {
                keysToRemove.push(fullKey);
              }
            }
          } catch {
            keysToRemove.push(fullKey); // Remove corrupt items
          }
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch (err) {
      console.warn("[SessionCache] Failed to perform cache cleanup of expired entries", err);
    }
  }
};
