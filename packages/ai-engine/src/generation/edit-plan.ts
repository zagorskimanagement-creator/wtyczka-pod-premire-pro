import { ClaudeClient } from '../clients/claude.js';
import type {
  EditPlan,
  FullTranscript,
  ViralMoment,
  SelectedClip,
  Cut,
  Zoom,
  CaptionConfig,
  Transition,
  Effect,
  BRollSuggestion,
  AnalysisOptions,
} from '../types.js';

export class EditPlanGenerator {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  async generate(
    transcript: FullTranscript,
    viralMoments: ViralMoment[],
    selectedClips: SelectedClip[],
    projectId: string,
    videoId: string,
    options: AnalysisOptions,
  ): Promise<EditPlan> {
    const bestClip = selectedClips[0];
    if (!bestClip) throw new Error('No clips selected');

    const [cuts, zooms, effects, transitions, broll, captions] = await Promise.all([
      this.generateCuts(transcript, bestClip, options),
      this.generateZooms(bestClip, options),
      this.generateEffects(viralMoments, bestClip),
      this.generateTransitions(transcript, bestClip),
      options.addBRoll ? this.generateBRoll(transcript, bestClip) : Promise.resolve([]),
      this.generateCaptions(transcript, bestClip, options),
    ]);

    return {
      projectId,
      videoId,
      targetDurationMs: options.targetDuration * 1000,
      platform: options.targetPlatform,
      cuts,
      zooms,
      captions,
      transitions,
      effects,
      broll,
      titleSuggestion: bestClip.title,
      descriptionSuggestion: bestClip.description,
      hashtags: bestClip.hashtags,
      selectedClips,
    };
  }

  private async generateCuts(
    transcript: FullTranscript,
    clip: SelectedClip,
    options: AnalysisOptions,
  ): Promise<Cut[]> {
    const cuts: Cut[] = [];
    const words = transcript.words.filter(
      (w) => w.start * 1000 >= clip.startMs && w.end * 1000 <= clip.endMs,
    );

    let currentStart = clip.startMs;

    for (let i = 1; i < words.length; i++) {
      const gap = (words[i].start - words[i - 1].end) * 1000;
      const word = words[i - 1];
      const isFiller = ['um', 'uh', 'uhh', 'like', 'you know'].includes(
        word.word.toLowerCase(),
      );

      if (options.removeSilence && gap > 500) {
        if (currentStart < words[i - 1].end * 1000) {
          cuts.push({
            startMs: Math.round(currentStart),
            endMs: Math.round(words[i - 1].end * 1000),
            type: 'keep',
          });
        }
        cuts.push({
          startMs: Math.round(words[i - 1].end * 1000),
          endMs: Math.round(words[i].start * 1000),
          type: 'remove',
          reason: 'silence',
        });
        currentStart = words[i].start * 1000;
      }

      if (options.removeFillers && isFiller) {
        if (currentStart < words[i - 1].start * 1000) {
          cuts.push({
            startMs: Math.round(currentStart),
            endMs: Math.round(words[i - 1].start * 1000),
            type: 'keep',
          });
        }
        cuts.push({
          startMs: Math.round(words[i - 1].start * 1000),
          endMs: Math.round(words[i - 1].end * 1000),
          type: 'remove',
          reason: 'filler',
        });
        currentStart = words[i].start * 1000;
      }
    }

    if (words.length > 0 && currentStart < clip.endMs) {
      cuts.push({
        startMs: Math.round(currentStart),
        endMs: Math.round(clip.endMs),
        type: 'keep',
      });
    }

    return cuts.length > 0 ? cuts : [{ startMs: clip.startMs, endMs: clip.endMs, type: 'keep' }];
  }

  private generateZooms(clip: SelectedClip, options: AnalysisOptions): Zoom[] {
    if (!options.targetPlatform) return [];

    const duration = clip.endMs - clip.startMs;
    const zooms: Zoom[] = [];

    const interval = 15000;
    for (let ms = clip.startMs + interval; ms < clip.endMs - 5000; ms += interval) {
      const isOdd = zooms.length % 2 === 0;
      zooms.push({
        startMs: Math.round(ms),
        endMs: Math.round(ms + 3000),
        scale: isOdd ? 1.15 : 1.0,
        posX: 0.5,
        posY: 0.4,
        easing: 'ease-in-out',
      });
    }

    return zooms.slice(0, 8);
  }

  private generateEffects(moments: ViralMoment[], clip: SelectedClip): Effect[] {
    const effects: Effect[] = [];

    const topMoments = moments
      .filter((m) => m.startMs >= clip.startMs && m.endMs <= clip.endMs)
      .sort((a, b) => b.viralScore - a.viralScore)
      .slice(0, 5);

    for (const moment of topMoments) {
      if (moment.viralScore > 70) {
        effects.push({
          startMs: moment.startMs,
          endMs: moment.startMs + 500,
          type: 'punch-in',
          params: { scale: 1.05, duration: 200 },
        });
      }

      if (moment.emotionType === 'anger' || moment.emotionType === 'surprise') {
        effects.push({
          startMs: moment.startMs,
          endMs: moment.startMs + 300,
          type: 'shake',
          params: { intensity: 5, frequency: 20 },
        });
      }

      effects.push({
        startMs: clip.startMs,
        endMs: clip.endMs,
        type: 'color-grade',
        params: {
          saturation: 1.15,
          contrast: 1.1,
          brightness: 0.05,
        },
      });
    }

    return effects;
  }

  private generateTransitions(transcript: FullTranscript, clip: SelectedClip): Transition[] {
    const transitions: Transition[] = [];
    const PAUSE_THRESHOLD_MS = 800;

    const words = transcript.words.filter(
      (w) => w.start * 1000 >= clip.startMs && w.end * 1000 <= clip.endMs,
    );

    for (let i = 1; i < words.length; i++) {
      const gap = (words[i].start - words[i - 1].end) * 1000;
      if (gap >= PAUSE_THRESHOLD_MS && gap < 2000) {
        transitions.push({
          atMs: Math.round(words[i - 1].end * 1000 + gap / 2),
          type: 'cut',
          durationMs: 0,
        });
      }
    }

    return transitions.slice(0, 20);
  }

  private async generateBRoll(transcript: FullTranscript, clip: SelectedClip): Promise<BRollSuggestion[]> {
    const text = transcript.words
      .filter((w) => w.start * 1000 >= clip.startMs && w.end * 1000 <= clip.endMs)
      .map((w) => w.word)
      .join(' ')
      .slice(0, 2000);

    const prompt = `Analyze this video clip transcript and suggest B-roll footage.

TRANSCRIPT:
${text}

Return JSON array (max 5 suggestions):
[
  {
    "atMs": number (timestamp in clip),
    "durationMs": number (3000-8000),
    "concept": "what to show",
    "searchQuery": "stock footage search query",
    "keywords": ["keyword1", "keyword2"],
    "category": "business|nature|people|technology|money|abstract"
  }
]`;

    try {
      return await this.claude.messageJSON<BRollSuggestion[]>(prompt, { temperature: 0.5 });
    } catch {
      return [];
    }
  }

  private generateCaptions(
    transcript: FullTranscript,
    clip: SelectedClip,
    options: AnalysisOptions,
  ): CaptionConfig[] {
    const MAX_WORDS = 4;
    const words = transcript.words.filter(
      (w) => w.start * 1000 >= clip.startMs && w.end * 1000 <= clip.endMs,
    );

    const captions: CaptionConfig[] = [];

    for (let i = 0; i < words.length; i += MAX_WORDS) {
      const chunk = words.slice(i, i + MAX_WORDS);
      if (chunk.length === 0) continue;

      captions.push({
        text: chunk.map((w) => w.word).join(' '),
        startMs: Math.round(chunk[0].start * 1000),
        endMs: Math.round(chunk[chunk.length - 1].end * 1000),
        words: chunk.map((w) => ({
          word: w.word,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        })),
        style: options.captionStyle as 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST',
        positionY: 0.85,
        fontSize: 48,
        animation: 'pop',
      });
    }

    return captions;
  }
}
