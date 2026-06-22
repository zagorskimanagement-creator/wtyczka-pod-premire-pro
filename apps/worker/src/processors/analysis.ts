import type { Job } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import {
  ContentSegmenter,
  HookDetector,
  RetentionScorer,
  ViralEngine,
} from '@shortforge/ai-engine';
import type { FullTranscript, TranscriptWord } from '@shortforge/ai-engine';

interface AnalysisJobData {
  projectId: string;
  videoId: string;
  transcriptId?: string;
  options: {
    targetDuration: number;
    targetPlatform: string;
    captionStyle: string;
    removeFillers: boolean;
    removeSilence: boolean;
    removeRepetitions: boolean;
    detectHooks: boolean;
    detectEmotions: boolean;
    generateTitle: boolean;
    generateDescription: boolean;
    generateHashtags: boolean;
    addBRoll: boolean;
  };
}

export async function analysisProcessor(
  job: Job<AnalysisJobData>,
  prisma: PrismaClient,
): Promise<void> {
  const { projectId, videoId, transcriptId, options } = job.data;

  console.warn(`[Analysis] Starting for project ${projectId}`);
  await job.updateProgress(5);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'PROCESSING' },
  });

  const transcriptData = transcriptId
    ? await prisma.transcript.findUnique({
        where: { id: transcriptId },
        include: {
          words: { orderBy: { startMs: 'asc' } },
        },
      })
    : await prisma.transcript.findUnique({
        where: { videoId },
        include: { words: { orderBy: { startMs: 'asc' } } },
      });

  if (!transcriptData) {
    throw new Error(`Transcript not found for video ${videoId}`);
  }

  const transcript: FullTranscript = {
    text: transcriptData.fullText,
    language: transcriptData.language,
    confidence: transcriptData.confidence ?? 0.9,
    durationMs: transcriptData.durationMs ?? 0,
    words: transcriptData.words.map((w) => ({
      word: w.word,
      start: w.startMs / 1000,
      end: w.endMs / 1000,
      confidence: w.confidence ?? undefined,
    })) as TranscriptWord[],
    segments: [],
  };

  await job.updateProgress(15);

  const segmenter = new ContentSegmenter();
  const segmentation = await segmenter.segment(transcript);

  await job.updateProgress(35);

  const hookDetector = new HookDetector();
  const hooks = await hookDetector.detectHooks(transcript);

  await job.updateProgress(50);

  const retentionScorer = new RetentionScorer();
  await job.updateProgress(60);

  const viralEngine = new ViralEngine();
  const viralAnalysis = await viralEngine.analyze(transcript, {
    targetDuration: options.targetDuration,
    targetPlatform: options.targetPlatform,
    captionStyle: options.captionStyle,
    removeFillers: options.removeFillers,
    removeSilence: options.removeSilence,
    removeRepetitions: options.removeRepetitions,
    detectHooks: options.detectHooks,
    detectEmotions: options.detectEmotions,
    generateTitle: options.generateTitle,
    generateDescription: options.generateDescription,
    generateHashtags: options.generateHashtags,
    addBRoll: options.addBRoll,
  });

  await job.updateProgress(80);

  await prisma.analysisResult.upsert({
    where: { videoId },
    create: {
      videoId,
      topicsJson: segmentation.topics as unknown as object,
      hookMomentsJson: hooks.hooks as unknown as object,
      viralClipsJson: viralAnalysis.moments as unknown as object,
      overallScore: viralAnalysis.overallViralPotential,
    },
    update: {
      topicsJson: segmentation.topics as unknown as object,
      hookMomentsJson: hooks.hooks as unknown as object,
      viralClipsJson: viralAnalysis.moments as unknown as object,
      overallScore: viralAnalysis.overallViralPotential,
    },
  });

  await job.updateProgress(90);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'ANALYZED' },
  });

  await job.updateProgress(100);
  console.warn(
    `[Analysis] Completed for project ${projectId}. ` +
    `Found ${viralAnalysis.moments.length} viral moments, ` +
    `${hooks.hooks.length} hooks, overall score: ${viralAnalysis.overallViralPotential}`,
  );
}
