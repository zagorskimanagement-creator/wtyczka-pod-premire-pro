import type { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { StorageService } from '../services/storage.service.js';
import { QueueService } from '../services/queue.service.js';
import { AppError } from '../middleware/error-handler.js';
import { getVideoMetadata } from '../services/video-metadata.service.js';

const UPLOAD_DIR = process.env['UPLOAD_DIR'] ?? '/tmp/shortforge/uploads';
const MAX_SIZE_MB = parseInt(process.env['MAX_VIDEO_SIZE_MB'] ?? '2000', 10);
const createProjectSchema = z.object({ name: z.string().min(1).max(200), description: z.string().max(1000).optional(), platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK') });

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  const storage = new StorageService();
  const queue = new QueueService();

  fastify.post('/upload', { schema: { tags: ['Upload'], summary: 'Upload video file', consumes: ['multipart/form-data'] }, preHandler: [authenticate] }, async (request, reply) => {
    const parts = request.parts();
    let videoFile: { filename: string; mimetype: string; localPath: string } | null = null;
    let projectData: z.infer<typeof createProjectSchema> | null = null;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'video') {
        const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mov'];
        if (!allowedMimes.includes(part.mimetype)) throw new AppError(400, 'Invalid file type', 'INVALID_FILE_TYPE');
        const filename = `${uuidv4()}${path.extname(part.filename)}`;
        const localPath = path.join(UPLOAD_DIR, filename);
        await pipeline(part.file, createWriteStream(localPath));
        const stat = await fs.stat(localPath);
        if (stat.size > MAX_SIZE_MB * 1024 * 1024) { await fs.unlink(localPath); throw new AppError(413, `File too large. Maximum ${MAX_SIZE_MB}MB`, 'FILE_TOO_LARGE'); }
        videoFile = { filename, mimetype: part.mimetype, localPath };
      } else if (part.type === 'field' && part.fieldname === 'data') {
        projectData = createProjectSchema.parse(JSON.parse(part.value as string));
      }
    }

    if (!videoFile) throw new AppError(400, 'No video file provided', 'MISSING_FILE');
    if (!projectData) projectData = { name: videoFile.filename, platform: 'TIKTOK' };

    const metadata = await getVideoMetadata(videoFile.localPath);
    const storagePath = await storage.upload(videoFile.localPath, videoFile.filename);
    const project = await prisma.project.create({
      data: { userId: request.user.sub, name: projectData.name, description: projectData.description, platform: projectData.platform, status: 'DRAFT', videos: { create: { originalName: videoFile.filename, storagePath, mimeType: videoFile.mimetype, sizeBytes: metadata.sizeBytes, durationSeconds: metadata.durationSeconds, width: metadata.width, height: metadata.height, fps: metadata.fps, bitrate: metadata.bitrate, status: 'UPLOADED', metadata: metadata as unknown as Record<string, unknown> } } },
      include: { videos: true },
    });
    await queue.enqueueTranscription({ projectId: project.id, videoId: project.videos[0].id, storagePath, durationSeconds: metadata.durationSeconds ?? 0 });
    await fs.unlink(videoFile.localPath).catch(() => null);
    return reply.status(201).send({ projectId: project.id, videoId: project.videos[0].id, status: 'processing', message: 'Video uploaded successfully. Analysis starting.' });
  });

  fastify.get('/upload/:projectId/status', { schema: { tags: ['Upload'], summary: 'Get upload status' }, preHandler: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: request.user.sub }, include: { videos: { select: { id: true, status: true, durationSeconds: true } } } });
    if (!project) throw new AppError(404, 'Project not found', 'NOT_FOUND');
    return reply.send({ projectId: project.id, projectStatus: project.status, videos: project.videos });
  });
};
