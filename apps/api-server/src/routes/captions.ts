import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error-handler.js';

const generateCaptionsSchema = z.object({ clipId: z.string().cuid(), style: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).default('TIKTOK'), wordHighlighting: z.boolean().default(true), karaokMode: z.boolean().default(false), animation: z.enum(['pop', 'scale', 'bounce', 'fade', 'none']).default('pop'), maxWordsPerLine: z.number().int().min(1).max(8).default(4), fontSize: z.number().int().min(24).max(120).default(48), fontFamily: z.string().default('Montserrat'), colorHex: z.string().regex(/^#[0-9A-F]{6}$/i).default('#FFFFFF'), strokeColor: z.string().regex(/^#[0-9A-F]{6}$/i).default('#000000'), strokeWidth: z.number().int().min(0).max(10).default(3), positionY: z.number().min(0).max(1).default(0.85) });
const updateCaptionSchema = z.object({ text: z.string().optional(), startMs: z.number().int().optional(), endMs: z.number().int().optional(), positionX: z.number().min(0).max(1).optional(), positionY: z.number().min(0).max(1).optional(), fontSize: z.number().int().min(24).max(120).optional(), colorHex: z.string().optional() });

interface WordData { word: string; startMs: number; endMs: number; isFiller?: boolean; }

function groupWordsIntoCaptions(words: WordData[], maxWordsPerLine: number) {
  const groups: Array<{ text: string; startMs: number; endMs: number; words: WordData[] }> = [];
  const filtered = words.filter((w) => !w.isFiller);
  for (let i = 0; i < filtered.length; i += maxWordsPerLine) {
    const chunk = filtered.slice(i, i + maxWordsPerLine);
    if (chunk.length === 0) continue;
    groups.push({ text: chunk.map((w) => w.word).join(' '), startMs: chunk[0].startMs, endMs: chunk[chunk.length - 1].endMs, words: chunk });
  }
  return groups;
}

export const captionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/generate-captions', { schema: { tags: ['Captions'], summary: 'Generate animated captions for a clip' }, preHandler: [authenticate] }, async (request, reply) => {
    const body = generateCaptionsSchema.parse(request.body);
    const clip = await prisma.clip.findFirst({ where: { id: body.clipId, project: { userId: request.user.sub } }, include: { project: { include: { videos: { include: { transcript: { include: { words: true } } } } } } } });
    if (!clip) throw new AppError(404, 'Clip not found');
    const words = clip.project.videos[0]?.transcript?.words.filter((w) => w.startMs >= clip.startMs && w.endMs <= clip.endMs) ?? [];
    const captionGroups = groupWordsIntoCaptions(words, body.maxWordsPerLine);
    await prisma.caption.deleteMany({ where: { clipId: body.clipId } });
    const captions = await prisma.caption.createMany({ data: captionGroups.map((group) => ({ clipId: body.clipId, text: group.text, startMs: group.startMs, endMs: group.endMs, style: body.style, wordsJson: group.words as unknown as Record<string, unknown>[], positionX: 0.5, positionY: body.positionY, fontSize: body.fontSize, fontFamily: body.fontFamily, colorHex: body.colorHex, strokeColor: body.strokeColor, strokeWidth: body.strokeWidth, animationType: body.animation })) });
    const created = await prisma.caption.findMany({ where: { clipId: body.clipId }, orderBy: { startMs: 'asc' } });
    return reply.status(201).send({ clipId: body.clipId, style: body.style, captionCount: captions.count, captions: created });
  });

  fastify.get('/captions/:clipId', { schema: { tags: ['Captions'], summary: 'Get captions for a clip' }, preHandler: [authenticate] }, async (request, reply) => {
    const { clipId } = request.params as { clipId: string };
    const clip = await prisma.clip.findFirst({ where: { id: clipId, project: { userId: request.user.sub } } });
    if (!clip) throw new AppError(404, 'Clip not found');
    return reply.send({ clipId, captions: await prisma.caption.findMany({ where: { clipId }, orderBy: { startMs: 'asc' } }) });
  });

  fastify.patch('/captions/:captionId', { schema: { tags: ['Captions'], summary: 'Update a single caption' }, preHandler: [authenticate] }, async (request, reply) => {
    const { captionId } = request.params as { captionId: string };
    const body = updateCaptionSchema.parse(request.body);
    const caption = await prisma.caption.findFirst({ where: { id: captionId, clip: { project: { userId: request.user.sub } } } });
    if (!caption) throw new AppError(404, 'Caption not found');
    return reply.send({ caption: await prisma.caption.update({ where: { id: captionId }, data: body }) });
  });

  fastify.delete('/captions/:clipId', { schema: { tags: ['Captions'], summary: 'Delete all captions for a clip' }, preHandler: [authenticate] }, async (request, reply) => {
    const { clipId } = request.params as { clipId: string };
    const clip = await prisma.clip.findFirst({ where: { id: clipId, project: { userId: request.user.sub } } });
    if (!clip) throw new AppError(404, 'Clip not found');
    await prisma.caption.deleteMany({ where: { clipId } });
    return reply.send({ success: true });
  });
};
