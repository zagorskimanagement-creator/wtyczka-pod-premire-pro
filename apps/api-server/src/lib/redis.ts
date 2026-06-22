import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true, retryStrategy(times) { return Math.min(times * 50, 2000); } });
redisClient.on('error', (err) => console.error('[Redis] Connection error:', err.message));
redisClient.on('connect', () => console.warn('[Redis] Connected successfully'));

export const cacheClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: true });

export async function getCache<T>(key: string): Promise<T | null> {
  const value = await cacheClient.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
  await cacheClient.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> { await cacheClient.del(key); }

export async function deleteCachePattern(pattern: string): Promise<void> {
  const keys = await cacheClient.keys(pattern);
  if (keys.length > 0) await cacheClient.del(...keys);
}
