import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { QueueService } from '../services/queue.service.js';
import { AppError } from '../middleware/error-handler.js';
import { getCache, setCache } from '../lib/redis.js';

const analyzeSchema = z.object({ projectId: z.string().cuid(), targetDuration: z.enum(['15', '30', '45', '60']).default('60'), targetPlatform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK'), captionStyle: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).default('TIKTOK'), generateTitle: z.boolean().default(true), generateDescription: z.boolean().default(true), generateHashtags: z.boolean().default(true), removeFillers: z.boolean().default(true), removeSilence: z.boolean().default(true), removeRepetitions: z.boolean().default(true), detectHooks: z.boolean().default(true), detectEmotions: z.boolean().default(true), addBRoll: z.boolean().default(false) });

export const analyzeRoutes: FastifyPluginAsync = async (fastify) => {
  const queue = new QueueService();

  fastify.post('/analyze', { schema: { tags: ['Analysis'], summary: 'Trigger AI analysis' }, preHandler: [authenticate] }, async (request, reply) => {
    const body = analyzeSchema.parse(request.body);
    const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: request.user.sub }, include: { videos: { where: { status: 'UPLOADED' }, include: { transcript: true } } } });
    if (!project) throw new AppError(404, 'Project not found', 'NOT_FOUND');
    if (!project.videos[0]) throw new AppError(400, 'No processed video found', 'NO_VIDEO');
    await prisma.project.update({ where: { id: body.projectId }, data: { status: 'PROCESSING' } });
    const jobId = await queue.enqueueAnalysis({ projectId: body.projectId, videoId: project.videos[0].id, transcriptId: project.videos[0].transcript?.id, options: { targetDuration: parseInt(body.targetDuration, 10), targetPlatform: body.targetPlatform, captionStyle: body.captionStyle, removeFillers: body.removeFillers, removeSilence: body.removeSilence, removeRepetitions: body.removeRepetitions, detectHooks: body.detectHooks, detectEmotions: body.detectEmotions, generateTitle: body.generateTitle, generateDescription: body.generateDescription, generateHashtags: body.generateHashtags, addBRoll: body.addBRoll } });
    return reply.status(202).send({ jobId, projectId: body.projectId, status: 'analyzing', message: 'Analysis job queued. This typically takes 2-5 minutes.' });
  });

  fastify.get('/analyze/:projectId', { schema: { tags: ['Analysis'], summary: 'Get analysis results' }, preHandler: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const cacheKey = `analysis:${projectId}`;
    const cached = await getCache(cacheKey);
    if (cached) return reply.send(cached);
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: request.user.sub }, include: { videos: { include: { transcript: { include: { segments: { orderBy: { viralScore: 'desc' }, take: 20 } } }, analysisResult: true } }, editPlan: true, clips: { orderBy: { viralScore: 'desc' } } } });
    if (!project) throw new AppError(404, 'Project not found', 'NOT_FOUND');
    const response = { projectId, status: project.status, analysis: project.videos[0]?.analysisResult ?? null, topSegments: project.videos[0]?.transcript?.segments ?? [], editPlan: project.editPlan ?? null, clips: project.clips };
    if (project.status === 'COMPLETED' || project.status === 'ANALYZED') await setCache(cacheKey, response, 300);
    return reply.send(response);
  });

  fastify.get('/analyze/:projectId/transcript', { schema: { tags: ['Analysis'], summary: 'Get full transcript' }, preHandler: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: request.user.sub }, select: { id: true } });
    if (!project) throw new AppError(404, 'Project not found', 'NOT_FOUND');
    const video = await prisma.video.findFirst({ where: { projectId }, include: { transcript: { include: { words: { orderBy: { startMs: 'asc' } }, segments: { orderBy: { startMs: 'asc' } } } } } });
    if (!video?.transcript) throw new AppError(404, 'Transcript not ready', 'TRANSCRIPT_NOT_FOUND');
    return reply.send({ transcriptId: video.transcript.id, fullText: video.transcript.fullText, language: video.transcript.language, confidence: video.transcript.confidence, words: video.transcript.words, segments: video.transcript.segments });
  });
};
