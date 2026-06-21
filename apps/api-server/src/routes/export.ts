import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { QueueService } from '../services/queue.service.js';
import { StorageService } from '../services/storage.service.js';
import { AppError } from '../middleware/error-handler.js';

const exportSchema = z.object({ clipId: z.string().cuid(), platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK'), resolution: z.enum(['1080x1920', '1080x1080', '1920x1080']).default('1080x1920'), format: z.enum(['mp4', 'mov']).default('mp4'), quality: z.enum(['high', 'medium', 'low']).default('high'), burnCaptions: z.boolean().default(true), watermark: z.boolean().default(false) });

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  const queue = new QueueService();
  const storage = new StorageService();

  fastify.post('/export', { schema: { tags: ['Export'], summary: 'Export clip to video file' }, preHandler: [authenticate] }, async (request, reply) => {
    const body = exportSchema.parse(request.body);
    const clip = await prisma.clip.findFirst({ where: { id: body.clipId, project: { userId: request.user.sub } }, include: { project: { include: { videos: true } }, captions: { orderBy: { startMs: 'asc' } } } });
    if (!clip) throw new AppError(404, 'Clip not found');
    const exportRecord = await prisma.export.create({ data: { userId: request.user.sub, projectId: clip.projectId, clipId: clip.id, platform: body.platform, resolution: body.resolution, format: body.format, status: 'PENDING', metadata: { quality: body.quality, burnCaptions: body.burnCaptions } as Record<string, unknown> } });
    const jobId = await queue.enqueueExport({ exportId: exportRecord.id, clipId: body.clipId, projectId: clip.projectId, storagePath: clip.project.videos[0]?.storagePath ?? '', startMs: clip.startMs, endMs: clip.endMs, captions: body.burnCaptions ? clip.captions : [], options: { platform: body.platform, resolution: body.resolution, format: body.format, quality: body.quality, watermark: body.watermark } });
    return reply.status(202).send({ exportId: exportRecord.id, jobId, status: 'pending', message: 'Export queued. You will be notified when ready.' });
  });

  fastify.get('/export/:exportId', { schema: { tags: ['Export'], summary: 'Get export status' }, preHandler: [authenticate] }, async (request, reply) => {
    const { exportId } = request.params as { exportId: string };
    const exportRecord = await prisma.export.findFirst({ where: { id: exportId, userId: request.user.sub } });
    if (!exportRecord) throw new AppError(404, 'Export not found');
    let downloadUrl = exportRecord.downloadUrl;
    if (exportRecord.status === 'COMPLETED' && exportRecord.storagePath && !downloadUrl) {
      downloadUrl = await storage.getSignedUrl(exportRecord.storagePath, 3600);
      await prisma.export.update({ where: { id: exportId }, data: { downloadUrl } });
    }
    return reply.send({ exportId, status: exportRecord.status, platform: exportRecord.platform, resolution: exportRecord.resolution, format: exportRecord.format, downloadUrl, fileSizeBytes: exportRecord.fileSizeBytes?.toString(), completedAt: exportRecord.completedAt, errorMessage: exportRecord.errorMessage });
  });

  fastify.get('/exports', { schema: { tags: ['Export'], summary: 'List all exports' }, preHandler: [authenticate] }, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as { page?: string; limit?: string };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [exports, total] = await Promise.all([prisma.export.findMany({ where: { userId: request.user.sub }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit, 10) }), prisma.export.count({ where: { userId: request.user.sub } })]);
    return reply.send({ exports, pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), pages: Math.ceil(total / parseInt(limit, 10)) } });
  });
};
