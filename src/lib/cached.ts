import { ApiError } from './api';
import { db } from './db';

export type Cached<T> = { data: T; stale: boolean; savedAt: number };
// Network first. Only fresh server data is ever written to the cache, so stale data never overwrites newer data.
export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<Cached<T>> {
  try {
    const data = await fetcher();
    const savedAt = Date.now();
    await db.cache.put({ key, value: data, savedAt });
    return { data, stale: false, savedAt };
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) throw e;
    const c = await db.cache.get(key);
    if (c) return { data: c.value as T, stale: true, savedAt: c.savedAt };
    throw e;
  }
}
