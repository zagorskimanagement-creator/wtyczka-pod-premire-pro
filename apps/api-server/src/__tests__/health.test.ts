import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../routes/health.js';

vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } }));
vi.mock('../lib/redis.js', () => ({ redisClient: { ping: vi.fn().mockResolvedValue('PONG') }, getCache: vi.fn(), setCache: vi.fn(), deleteCache: vi.fn(), deleteCachePattern: vi.fn() }));

describe('Health Routes', () => {
  const app = Fastify({ logger: false });
  beforeAll(async () => { await app.register(healthRoutes, { prefix: '/api/v1' }); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health returns 200 when services are up', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { status: string; services: { database: string; redis: string } };
    expect(body.status).toBe('healthy');
    expect(body.services.database).toBe('up');
    expect(body.services.redis).toBe('up');
  });

  it('GET /api/v1/health/ready returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(200);
    expect((JSON.parse(response.body) as { ready: boolean }).ready).toBe(true);
  });

  it('GET /api/v1/health/live returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect((JSON.parse(response.body) as { alive: boolean }).alive).toBe(true);
  });
});
