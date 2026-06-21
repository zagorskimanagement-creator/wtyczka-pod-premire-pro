import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError, ConflictError, UnauthorizedError } from '../middleware/error-handler.js';
import { authenticate } from '../middleware/auth.js';

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(100), name: z.string().min(1).max(100).optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', { schema: { tags: ['Auth'], summary: 'Register new user' } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw new ConflictError('Email already registered');
    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({ data: { email: body.email, name: body.name, passwordHash: hashedPassword } as Parameters<typeof prisma.user.create>[0]['data'], select: { id: true, email: true, name: true, role: true, createdAt: true } });
    const token = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return reply.status(201).send({ token, user });
  });

  fastify.post('/login', { schema: { tags: ['Auth'], summary: 'Login user' } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } }) as (Awaited<ReturnType<typeof prisma.user.findUnique>> & { passwordHash?: string }) | null;
    if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');
    if (!await bcrypt.compare(body.password, user.passwordHash)) throw new UnauthorizedError('Invalid credentials');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  fastify.get('/me', { schema: { tags: ['Auth'], summary: 'Get current user' }, preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, lastLoginAt: true, _count: { select: { projects: true, exports: true } } } });
    if (!user) throw new AppError(404, 'User not found');
    return reply.send({ user });
  });

  fastify.post('/refresh', { schema: { tags: ['Auth'], summary: 'Refresh JWT token' }, preHandler: [authenticate] }, async (request, reply) => {
    return reply.send({ token: fastify.jwt.sign({ sub: request.user.sub, email: request.user.email, role: request.user.role }) });
  });

  fastify.delete('/logout', { schema: { tags: ['Auth'], summary: 'Logout user' }, preHandler: [authenticate] }, async (_request, reply) => {
    return reply.send({ success: true });
  });
};
