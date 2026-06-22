import { LRUCache } from 'lru-cache';

// Cache for storing promises of in-flight requests
const inFlightCache = new LRUCache<string, Promise<any>>({
  max: 100, // Max 100 in-flight requests
  ttl: 1000 * 60 * 5, // 5 minutes TTL for promises
});

/**
 * Ensures that only one request for a given key is "in flight" at any time.
 * If a request for the same key is already pending, it returns the existing promise.
 * Otherwise, it executes the provided function and caches its promise.
 *
 * @param key A unique key for the request (e.g., a serialized function call signature).
 * @param fn The function to execute if no request for the key is in flight.
 * @returns A promise that resolves with the result of the function.
 */
export async function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let promise = inFlightCache.get(key);

  if (promise) {
    // console.log(`[SingleFlight] Cache HIT for key: ${key}`);
    return promise;
  }

  // console.log(`[SingleFlight] Cache MISS for key: ${key} - initiating new request.`);
  promise = fn();
  inFlightCache.set(key, promise);

  // Remove the promise from cache once it settles (either resolves or rejects)
  // This prevents stale promises from being returned if the underlying operation fails
  // and needs to be retried on subsequent calls.
  promise.finally(() => {
    inFlightCache.delete(key);
  });

  return promise;
}
