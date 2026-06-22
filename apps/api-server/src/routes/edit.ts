import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { QueueService } from '../services/queue.service.js';
import { AppError } from '../middleware/error-handler.js';

const generateEditSchema = z.object({ projectId: z.string().cuid(), clipCount: z.number().int().min(1).max(10).default(3), targetDurationSeconds: z.number().int().min(15).max(60).default(60), platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK'), captionStyle: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).default('TIKTOK'), includeZooms: z.boolean().default(true), includePunchIns: z.boolean().default(true), includeTransitions: z.boolean().default(true), aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16') });
const applyEditSchema = z.object({ projectId: z.string().cuid(), editPlanId: z.string().cuid(), clipIndex: z.number().int().min(0).optional() });

export const editRoutes: FastifyPluginAsync = async (fastify) => {
  const queue = new QueueService();

  fastify.post('/generate-edit', { schema: { tags: ['Edit'], summary: 'Generate AI edit plan' }, preHandler: [authenticate] }, async (request, reply) => {
    const body = generateEditSchema.parse(request.body);
    const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: request.user.sub }, include: { videos: { include: { analysisResult: true } } } });
    if (!project) throw new AppError(404, 'Project not found');
    if (!project.videos[0]?.analysisResult) throw new AppError(400, 'Analysis must complete before generating edit plan');
    const jobId = await queue.enqueueEditGeneration({ projectId: body.projectId, videoId: project.videos[0].id, analysisId: project.videos[0].analysisResult.id, options: { clipCount: body.clipCount, targetDurationSeconds: body.targetDurationSeconds, platform: body.platform, captionStyle: body.captionStyle, includeZooms: body.includeZooms, includePunchIns: body.includePunchIns, includeTransitions: body.includeTransitions, aspectRatio: body.aspectRatio } });
    return reply.status(202).send({ jobId, projectId: body.projectId, status: 'generating', message: 'Edit plan generation queued.' });
  });

  fastify.get('/generate-edit/:projectId', { schema: { tags: ['Edit'], summary: 'Get generated edit plan' }, preHandler: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: request.user.sub }, include: { editPlan: true, clips: { orderBy: { viralScore: 'desc' } } } });
    if (!project) throw new AppError(404, 'Project not found');
    if (!project.editPlan) throw new AppError(404, 'Edit plan not yet generated');
    return reply.send({ projectId, editPlan: project.editPlan, clips: project.clips });
  });

  fastify.post('/apply-edit', { schema: { tags: ['Edit'], summary: 'Apply edit plan' }, preHandler: [authenticate] }, async (request, reply) => {
    const body = applyEditSchema.parse(request.body);
    const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: request.user.sub }, include: { editPlan: true, clips: { include: { captions: true }, orderBy: { viralScore: 'desc' } }, videos: true } });
    if (!project) throw new AppError(404, 'Project not found');
    if (!project.editPlan) throw new AppError(404, 'Edit plan not found');
    const clip = body.clipIndex !== undefined ? project.clips[body.clipIndex] : project.clips[0];
    if (!clip) throw new AppError(404, 'Clip not found');
    return reply.send({ projectId: body.projectId, clip: { id: clip.id, startMs: clip.startMs, endMs: clip.endMs, title: clip.title, platform: clip.platform, viralScore: clip.viralScore, captions: clip.captions }, editPlan: { cuts: project.editPlan.cutsJson, zooms: project.editPlan.zoomsJson, captions: project.editPlan.captionsJson, transitions: project.editPlan.transitionsJson, effects: project.editPlan.effectsJson }, video: { storagePath: project.videos[0]?.storagePath, storageUrl: project.videos[0]?.storageUrl, durationSeconds: project.videos[0]?.durationSeconds }, titleSuggestion: project.editPlan.titleSuggestion, descriptionSuggestion: project.editPlan.descriptionSuggestion, hashtags: project.editPlan.hashtagsJson });
  });
};
