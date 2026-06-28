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
  get(key: string): any {
    try {
      const raw = isAvailable ? window.localStorage.getItem(key) : memoryFallback.get(key);
      if (raw === null || raw === undefined) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw; // Fallback to raw string if not a valid JSON string
      }
    } catch (err) {
      console.warn(`[Storage] Failed to get key: ${key}`, err);
      return null;
    }
  },

  /**
   * Alias of get() supporting dynamic JSON data extraction.
   */
  getDynamic(key: string): any {
    return this.get(key);
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
  }
};
