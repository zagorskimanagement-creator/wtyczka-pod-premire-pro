import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error-handler.js';
import { deleteCache } from '../lib/redis.js';

const updateProjectSchema = z.object({ name: z.string().min(1).max(200).optional(), description: z.string().max(1000).optional(), platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).optional() });

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/projects', { schema: { tags: ['Projects'], summary: 'List all projects' }, preHandler: [authenticate] }, async (request, reply) => {
    const { page = '1', limit = '20', status } = request.query as { page?: string; limit?: string; status?: string };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = { userId: request.user.sub, ...(status ? { status: status as 'DRAFT' } : {}) };
    const [projects, total] = await Promise.all([prisma.project.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: parseInt(limit, 10), include: { _count: { select: { clips: true, exports: true } }, videos: { select: { id: true, status: true, durationSeconds: true, storageUrl: true } } } }), prisma.project.count({ where })]);
    return reply.send({ projects, pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), pages: Math.ceil(total / parseInt(limit, 10)) } });
  });

  fastify.get('/project/:id', { schema: { tags: ['Projects'], summary: 'Get project details' }, preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await prisma.project.findFirst({ where: { id, userId: request.user.sub }, include: { videos: { include: { transcript: { select: { id: true, language: true, confidence: true, durationMs: true, _count: { select: { words: true, segments: true } } } }, analysisResult: true } }, editPlan: true, clips: { include: { _count: { select: { captions: true } } }, orderBy: { viralScore: 'desc' } }, exports: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    if (!project) throw new AppError(404, 'Project not found');
    return reply.send({ project });
  });

  fastify.patch('/project/:id', { schema: { tags: ['Projects'], summary: 'Update project metadata' }, preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.parse(request.body);
    const project = await prisma.project.findFirst({ where: { id, userId: request.user.sub } });
    if (!project) throw new AppError(404, 'Project not found');
    const updated = await prisma.project.update({ where: { id }, data: body });
    await deleteCache(`analysis:${id}`);
    return reply.send({ project: updated });
  });

  fastify.delete('/project/:id', { schema: { tags: ['Projects'], summary: 'Delete project' }, preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await prisma.project.findFirst({ where: { id, userId: request.user.sub } });
    if (!project) throw new AppError(404, 'Project not found');
    await prisma.project.delete({ where: { id } });
    await deleteCache(`analysis:${id}`);
    return reply.status(204).send();
  });

  fastify.get('/project/:id/clips', { schema: { tags: ['Projects'], summary: 'Get clips for a project' }, preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await prisma.project.findFirst({ where: { id, userId: request.user.sub }, select: { id: true } });
    if (!project) throw new AppError(404, 'Project not found');
    const clips = await prisma.clip.findMany({ where: { projectId: id }, include: { captions: { orderBy: { startMs: 'asc' } }, _count: { select: { exports: true } } }, orderBy: { viralScore: 'desc' } });
    return reply.send({ clips });
  });
};
