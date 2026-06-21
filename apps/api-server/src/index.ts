import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { initTelemetry } from './telemetry.js';
import { uploadRoutes } from './routes/upload.js';
import { analyzeRoutes } from './routes/analyze.js';
import { editRoutes } from './routes/edit.js';
import { captionRoutes } from './routes/captions.js';
import { exportRoutes } from './routes/export.js';
import { projectRoutes } from './routes/project.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { prisma } from './lib/prisma.js';
import { redisClient } from './lib/redis.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

initTelemetry();

export const app = Fastify({
  logger: { level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug', transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined },
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024,
});

async function build() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'], credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(rateLimit, { global: true, max: parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10), timeWindow: parseInt(process.env['RATE_LIMIT_WINDOW'] ?? '60000', 10), redis: redisClient, keyGenerator: (request) => (request.headers['x-api-key'] as string) ?? request.ip ?? 'anonymous' });
  await app.register(jwt, { secret: process.env['JWT_SECRET'] ?? 'fallback-dev-secret', sign: { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d' } });
  await app.register(multipart, { limits: { fileSize: parseInt(process.env['MAX_VIDEO_SIZE_MB'] ?? '2000', 10) * 1024 * 1024, files: 1 } });
  await app.register(swagger, { openapi: { info: { title: 'ShortForge AI API', description: 'Production-grade AI video editing API for Premiere Pro', version: '1.0.0' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } }, security: [{ bearerAuth: [] }] } });
  await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list', deepLinking: false } });
  app.setErrorHandler(errorHandler);
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(uploadRoutes, { prefix: '/api/v1' });
  await app.register(analyzeRoutes, { prefix: '/api/v1' });
  await app.register(editRoutes, { prefix: '/api/v1' });
  await app.register(captionRoutes, { prefix: '/api/v1' });
  await app.register(exportRoutes, { prefix: '/api/v1' });
  await app.register(projectRoutes, { prefix: '/api/v1' });
  return app;
}

async function start() {
  try {
    const server = await build();
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`ShortForge AI API running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    await redisClient.quit();
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { app.log.info('SIGTERM received'); await app.close(); await prisma.$disconnect(); await redisClient.quit(); process.exit(0); });
process.on('SIGINT', async () => { app.log.info('SIGINT received'); await app.close(); await prisma.$disconnect(); await redisClient.quit(); process.exit(0); });

await start();
