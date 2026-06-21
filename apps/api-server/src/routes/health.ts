import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redisClient } from '../lib/redis.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', { schema: { tags: ['Health'], summary: 'Health check' } }, async (_request, reply) => {
    const checks = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redisClient.ping()]);
    const dbOk = checks[0].status === 'fulfilled', redisOk = checks[1].status === 'fulfilled', allOk = dbOk && redisOk;
    return reply.status(allOk ? 200 : 503).send({ status: allOk ? 'healthy' : 'degraded', timestamp: new Date().toISOString(), version: process.env['npm_package_version'] ?? '1.0.0', services: { database: dbOk ? 'up' : 'down', redis: redisOk ? 'up' : 'down' } });
  });
  fastify.get('/health/ready', async (_request, reply) => reply.send({ ready: true }));
  fastify.get('/health/live', async (_request, reply) => reply.send({ alive: true }));
};
