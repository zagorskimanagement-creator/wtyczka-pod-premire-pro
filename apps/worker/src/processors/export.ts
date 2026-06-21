import type { Job } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { FFmpegWrapper, VideoTranscoder } from '@shortforge/video-engine';

interface ExportJobData {
  exportId: string;
  clipId: string;
  projectId: string;
  storagePath: string;
  startMs: number;
  endMs: number;
  captions: Array<{
    text: string;
    startMs: number;
    endMs: number;
    positionX: number;
    positionY: number;
    fontSize: number;
    colorHex: string;
    strokeColor: string;
    strokeWidth: number;
  }>;
  options: {
    platform: string;
    resolution: string;
    format: string;
    quality: 'high' | 'medium' | 'low';
    watermark: boolean;
  };
}

export async function exportProcessor(
  job: Job<ExportJobData>,
  prisma: PrismaClient,
): Promise<void> {
  const { exportId, storagePath, startMs, endMs, captions, options } = job.data;

  console.warn(`[Export] Starting export ${exportId}`);
  await job.updateProgress(5);

  await prisma.export.update({
    where: { id: exportId },
    data: { status: 'PROCESSING' },
  });

  const tmpDir = `/tmp/shortforge/exports/${exportId}`;
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const localVideoPath = await getLocalVideoPath(storagePath);
    const clippedPath = path.join(tmpDir, 'clip.mp4');

    await job.updateProgress(15);

    const ffmpeg = new FFmpegWrapper();
    await ffmpeg.extractClip(localVideoPath, clippedPath, startMs, endMs, { keepAudio: true });

    await job.updateProgress(40);

    let processingPath = clippedPath;
    const [targetWidth, targetHeight] = options.resolution.split('x').map(Number);

    if (targetWidth && targetHeight) {
      const reframedPath = path.join(tmpDir, 'reframed.mp4');
      await ffmpeg.resize(localVideoPath, reframedPath, targetWidth, targetHeight, { keepAudio: true });
      processingPath = reframedPath;
    }

    await job.updateProgress(60);

    let finalPath = processingPath;

    if (captions.length > 0) {
      const srtContent = ffmpeg.generateSRT(captions);
      const srtPath = path.join(tmpDir, 'captions.srt');
      await fs.writeFile(srtPath, srtContent);

      const captionedPath = path.join(tmpDir, 'captioned.mp4');
      await ffmpeg.burnCaptions(processingPath, captionedPath, srtPath, {
        fontSize: captions[0]?.fontSize ?? 48,
        colorHex: captions[0]?.colorHex ?? '#FFFFFF',
        strokeColor: captions[0]?.strokeColor ?? '#000000',
        strokeWidth: captions[0]?.strokeWidth ?? 3,
      });
      finalPath = captionedPath;
    }

    await job.updateProgress(80);

    const transcoder = new VideoTranscoder();
    const outputPath = path.join(tmpDir, `export.${options.format}`);
    const result = await transcoder.exportForPlatform(finalPath, outputPath, options.platform, options.quality);

    await job.updateProgress(95);

    const storedPath = `exports/${exportId}/export.${options.format}`;
    const localStoragePath = process.env['LOCAL_STORAGE_PATH'] ?? '/tmp/shortforge/storage';
    const storageDir = path.join(localStoragePath, 'exports', exportId);
    await fs.mkdir(storageDir, { recursive: true });
    await fs.copyFile(outputPath, path.join(localStoragePath, storedPath));

    const downloadUrl = `${process.env['APP_URL'] ?? 'http://localhost:3001'}/files/${storedPath}`;

    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: 'COMPLETED',
        storagePath: storedPath,
        downloadUrl,
        fileSizeBytes: result.fileSizeBytes,
        durationMs: result.durationMs,
        completedAt: new Date(),
      },
    });

    await job.updateProgress(100);
    console.warn(`[Export] Completed ${exportId}: ${result.fileSizeBytes} bytes`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.export.update({
      where: { id: exportId },
      data: { status: 'FAILED', errorMessage: message },
    });
    throw error;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function getLocalVideoPath(storagePath: string): Promise<string> {
  const localPath = path.join(
    process.env['LOCAL_STORAGE_PATH'] ?? '/tmp/shortforge/storage',
    storagePath,
  );
  const exists = await fs.access(localPath).then(() => true).catch(() => false);
  if (exists) return localPath;
  throw new Error(`Video not found at ${localPath}`);
}
