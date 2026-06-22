import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { UnauthorizedError } from './error-handler.js';

export interface JwtPayload { sub: string; email: string; role: string; iat: number; exp: number; }

declare module '@fastify/jwt' { interface FastifyJWT { user: JwtPayload; } }

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) throw new UnauthorizedError('Invalid API key');
    request.user = { sub: user.id, email: user.email, role: user.role, iat: Date.now(), exp: Date.now() + 86400000 };
    return;
  }
  try { await request.jwtVerify(); } catch { throw new UnauthorizedError('Invalid or expired token'); }
}

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (request.user.role !== 'ADMIN') throw new UnauthorizedError('Admin access required');
}

export async function requirePro(request: FastifyRequest, _reply: FastifyReply) {
  if (request.user.role === 'FREE') throw new UnauthorizedError('Pro subscription required');
}
