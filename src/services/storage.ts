/**
 * storage.ts
 *
 * A robust client-side storage utility that wraps localStorage.
 * Includes a memory fallback in case localStorage is disabled or restricted
 * in sandboxed iframes.
 */

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__local_storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const isAvailable = isLocalStorageAvailable();

// In-memory fallback if localStorage is blocked (e.g., inside sandboxed iframe without allow-same-origin)
const memoryFallback = new Map<string, string>();

export const storage = {
  /**
   * Retrieves an item from storage. Automatically parses JSON strings if valid.
   */
  get<T = any>(key: string): T | null {
    try {
      const raw = isAvailable ? window.localStorage.getItem(key) : memoryFallback.get(key);
      if (raw === null || raw === undefined) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T; // Fallback to raw string if not a valid JSON string
      }
    } catch (err) {
      console.warn(`[Storage] Failed to get key: ${key}`, err);
      return null;
    }
  },

  /**
   * Alias of get() supporting dynamic JSON data extraction.
   */
  getDynamic<T = any>(key: string): T | null {
    return this.get<T>(key);
  },

  /**
   * Saves an item to storage. Automatically handles serialization for non-string types.
   */
  set(key: string, value: any): void {
    try {
      const payload = typeof value === "string" ? value : JSON.stringify(value);
      if (isAvailable) {
        window.localStorage.setItem(key, payload);
      } else {
        memoryFallback.set(key, payload);
      }
    } catch (err) {
      console.warn(`[Storage] Failed to set key: ${key}`, err);
    }
  },

  /**
   * Alias of set() supporting dynamic JSON data storage.
   */
  setDynamic(key: string, value: any): void {
    this.set(key, value);
  },

  /**
   * Removes a specific item from storage.
   */
  remove(key: string): void {
    try {
      if (isAvailable) {
        window.localStorage.removeItem(key);
      } else {
        memoryFallback.delete(key);
      }
    } catch (err) {
      console.warn(`[Storage] Failed to remove key: ${key}`, err);
    }
  },

  /**
   * Alias of remove() supporting dynamic JSON data removal.
   */
  removeDynamic(key: string): void {
    this.remove(key);
  }
};