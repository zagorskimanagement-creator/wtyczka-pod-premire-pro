import type { Job } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import {
  EditPlanGenerator,
  MetadataGenerator,
  ViralEngine,
} from '@shortforge/ai-engine';
import type { FullTranscript, TranscriptWord } from '@shortforge/ai-engine';

interface EditGenerationJobData {
  projectId: string;
  videoId: string;
  analysisId: string;
  options: {
    clipCount: number;
    targetDurationSeconds: number;
    platform: string;
    captionStyle: string;
    includeZooms: boolean;
    includePunchIns: boolean;
    includeTransitions: boolean;
    aspectRatio: string;
  };
}

export async function editGenerationProcessor(
  job: Job<EditGenerationJobData>,
  prisma: PrismaClient,
): Promise<void> {
  const { projectId, videoId, analysisId, options } = job.data;

  console.warn(`[EditGen] Starting for project ${projectId}`);
  await job.updateProgress(5);

  const analysis = await prisma.analysisResult.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) throw new Error('Analysis not found');

  const transcript = await prisma.transcript.findUnique({
    where: { videoId },
    include: { words: { orderBy: { startMs: 'asc' } } },
  });

  if (!transcript) throw new Error('Transcript not found');

  const fullTranscript: FullTranscript = {
    text: transcript.fullText,
    language: transcript.language,
    confidence: transcript.confidence ?? 0.9,
    durationMs: transcript.durationMs ?? 0,
    words: transcript.words.map((w: { word: string; startMs: number; endMs: number; confidence: number | null }) => ({
      word: w.word,
      start: w.startMs / 1000,
      end: w.endMs / 1000,
      confidence: w.confidence ?? undefined,
    })) as TranscriptWord[],
    segments: [],
  };

  await job.updateProgress(20);

  const viralEngine = new ViralEngine();
  const viralAnalysis = await viralEngine.analyze(fullTranscript, {
    targetDuration: options.targetDurationSeconds,
    targetPlatform: options.platform,
    captionStyle: options.captionStyle,
    removeFillers: true,
    removeSilence: true,
    removeRepetitions: true,
    detectHooks: true,
    detectEmotions: true,
    generateTitle: true,
    generateDescription: true,
    generateHashtags: true,
    addBRoll: false,
  });

  await job.updateProgress(50);

  const editGenerator = new EditPlanGenerator();
  const editPlan = await editGenerator.generate(
    fullTranscript,
    viralAnalysis.moments,
    viralAnalysis.selectedClips,
    projectId,
    videoId,
    {
      targetDuration: options.targetDurationSeconds,
      targetPlatform: options.platform,
      captionStyle: options.captionStyle,
      removeFillers: true,
      removeSilence: true,
      removeRepetitions: true,
      detectHooks: true,
      detectEmotions: true,
      generateTitle: true,
      generateDescription: true,
      generateHashtags: true,
      addBRoll: false,
    },
  );

  await job.updateProgress(75);

  const metadataGen = new MetadataGenerator();
  const bestClip = viralAnalysis.selectedClips[0];
  const metadata = bestClip ? await metadataGen.generate(
    bestClip.hook,
    options.platform,
    viralAnalysis.moments[0]?.emotionType ?? 'neutral',
    viralAnalysis.overallViralPotential,
  ) : null;

  await prisma.editPlan.upsert({
    where: { projectId },
    create: {
      projectId,
      cutsJson: editPlan.cuts as unknown as object,
      zoomsJson: editPlan.zooms as unknown as object,
      captionsJson: editPlan.captions as unknown as object,
      transitionsJson: editPlan.transitions as unknown as object,
      effectsJson: editPlan.effects as unknown as object,
      brollJson: editPlan.broll as unknown as object,
      titleSuggestion: metadata?.title ?? editPlan.titleSuggestion,
      descriptionSuggestion: metadata?.description ?? editPlan.descriptionSuggestion,
      hashtagsJson: (metadata?.hashtags ?? editPlan.hashtags) as unknown as object,
      targetDuration: options.targetDurationSeconds,
    },
    update: {
      cutsJson: editPlan.cuts as unknown as object,
      zoomsJson: editPlan.zooms as unknown as object,
      captionsJson: editPlan.captions as unknown as object,
      transitionsJson: editPlan.transitions as unknown as object,
      effectsJson: editPlan.effects as unknown as object,
      brollJson: editPlan.broll as unknown as object,
      titleSuggestion: metadata?.title ?? editPlan.titleSuggestion,
      descriptionSuggestion: metadata?.description ?? editPlan.descriptionSuggestion,
      hashtagsJson: (metadata?.hashtags ?? editPlan.hashtags) as unknown as object,
      targetDuration: options.targetDurationSeconds,
      appliedAt: null,
    },
  });

  const savedEditPlan = await prisma.editPlan.findUnique({ where: { projectId } });

  for (const clip of viralAnalysis.selectedClips.slice(0, options.clipCount)) {
    await prisma.clip.create({
      data: {
        projectId,
        editPlanId: savedEditPlan?.id,
        title: metadata?.title ?? clip.title,
        description: metadata?.description ?? clip.description,
        hashtags: metadata?.hashtags ?? clip.hashtags,
        platform: options.platform as 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS',
        startMs: clip.startMs,
        endMs: clip.endMs,
        durationMs: clip.durationMs,
        viralScore: clip.viralScore,
        hookScore: clip.hookScore,
        retentionScore: clip.retentionScore,
        captionStyle: options.captionStyle as 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST',
        aspectRatio: options.aspectRatio,
        status: 'ready',
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'COMPLETED' },
  });

  await job.updateProgress(100);
  console.warn(
    `[EditGen] Completed for project ${projectId}. ` +
    `Generated ${viralAnalysis.selectedClips.length} clips.`,
  );
}
