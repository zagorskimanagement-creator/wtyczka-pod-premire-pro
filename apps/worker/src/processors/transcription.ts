import type { Job } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { WhisperTranscriber } from '@shortforge/ai-engine';

interface TranscriptionJobData {
  projectId: string;
  videoId: string;
  storagePath: string;
  durationSeconds: number;
}

export async function transcriptionProcessor(
  job: Job<TranscriptionJobData>,
  prisma: PrismaClient,
): Promise<void> {
  const { projectId, videoId, storagePath, durationSeconds } = job.data;

  console.warn(`[Transcription] Starting for video ${videoId}`);
  await job.updateProgress(5);

  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'PROCESSING' },
  });

  const localPath = await downloadVideo(storagePath);

  try {
    await job.updateProgress(15);

    const transcriber = new WhisperTranscriber();
    const transcript = await transcriber.transcribe(localPath);

    await job.updateProgress(80);

    const fillerWords = new Set(['um', 'uh', 'uhh', 'like', 'you know', 'basically', 'literally', 'actually']);

    const transcriptRecord = await prisma.transcript.create({
      data: {
        videoId,
        fullText: transcript.text,
        language: transcript.language,
        confidence: transcript.confidence,
        durationMs: transcript.durationMs,
        words: {
          createMany: {
            data: transcript.words.map((w) => ({
              word: w.word,
              startMs: Math.round(w.start * 1000),
              endMs: Math.round(w.end * 1000),
              confidence: w.confidence,
              isFiller: fillerWords.has(w.word.toLowerCase()),
              isSilence: false,
            })),
          },
        },
      },
    });

    await job.updateProgress(90);

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'TRANSCRIBED' },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ANALYZED' },
    });

    await job.updateProgress(100);
    console.warn(`[Transcription] Completed for video ${videoId}, ${transcript.words.length} words`);
  } finally {
    await fs.unlink(localPath).catch(() => null);
  }
}

async function downloadVideo(storagePath: string): Promise<string> {
  const localStoragePath = process.env['LOCAL_STORAGE_PATH'] ?? '/tmp/shortforge/storage';
  const sourcePath = path.join(localStoragePath, storagePath);
  const exists = await fs.access(sourcePath).then(() => true).catch(() => false);

  if (exists) return sourcePath;

  throw new Error(`Video file not found: ${storagePath}`);
}
