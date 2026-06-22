import { ClaudeClient } from '../clients/claude.js';
import type {
  ViralMoment,
  TranscriptSegment,
  FullTranscript,
  SelectedClip,
  AnalysisOptions,
} from '../types.js';

export interface ViralAnalysis {
  moments: ViralMoment[];
  selectedClips: SelectedClip[];
  overallViralPotential: number;
  audienceMatch: Record<string, number>;
}

interface ViralScoreComponents {
  emotion: number;
  speechSpeed: number;
  sentiment: number;
  novelty: number;
  controversy: number;
  curiosity: number;
  storytelling: number;
  specificity: number;
}

export class ViralEngine {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  async analyze(transcript: FullTranscript, options: AnalysisOptions): Promise<ViralAnalysis> {
    const [scoredMoments, aiAnalysis] = await Promise.all([
      this.scoreMomentsLocally(transcript),
      this.analyzeWithAI(transcript, options),
    ]);

    const merged = this.mergeAnalyses(scoredMoments, aiAnalysis, transcript);
    merged.sort((a, b) => b.viralScore - a.viralScore);

    const selectedClips = await this.selectBestClips(
      merged,
      options.targetDuration,
      options.targetPlatform,
    );

    return {
      moments: merged,
      selectedClips,
      overallViralPotential: this.calculateOverallPotential(merged),
      audienceMatch: this.calculateAudienceMatch(transcript.text, options.targetPlatform),
    };
  }

  private scoreMomentsLocally(transcript: FullTranscript): ViralMoment[] {
    const moments: ViralMoment[] = [];
    const segmentDurationMs = 10000;

    for (let ms = 0; ms < transcript.durationMs; ms += segmentDurationMs / 2) {
      const segmentEnd = ms + segmentDurationMs;
      const words = transcript.words.filter(
        (w) => w.start * 1000 >= ms && w.end * 1000 <= segmentEnd,
      );

      if (words.length < 5) continue;

      const text = words.map((w) => w.word).join(' ');
      const scores = this.calculateViralComponents(text, words);
      const viralScore = this.combineScores(scores);

      if (viralScore >= 30) {
        moments.push({
          startMs: Math.round(ms),
          endMs: Math.round(segmentEnd),
          text,
          viralScore,
          hookScore: this.scoreHookPotential(text),
          retentionScore: this.scoreRetentionPotential(text, words),
          emotionType: this.detectEmotion(text),
          reasons: this.extractReasons(scores),
        });
      }
    }

    return moments;
  }

  private calculateViralComponents(text: string, words: Array<{ word: string; start: number; end: number }>): ViralScoreComponents {
    const durationSeconds = words.length > 1
      ? words[words.length - 1].end - words[0].start
      : 1;
    const speechSpeed = words.length / durationSeconds;

    return {
      emotion: this.scoreEmotion(text),
      speechSpeed: this.scoreSpeechSpeed(speechSpeed),
      sentiment: this.scoreSentiment(text),
      novelty: this.scoreNovelty(text),
      controversy: this.scoreControversy(text),
      curiosity: this.scoreCuriosity(text),
      storytelling: this.scoreStorytelling(text),
      specificity: this.scoreSpecificity(text),
    };
  }

  private combineScores(scores: ViralScoreComponents): number {
    return Math.round(
      scores.emotion * 0.25 +
      scores.speechSpeed * 0.10 +
      scores.sentiment * 0.15 +
      scores.novelty * 0.15 +
      scores.controversy * 0.15 +
      scores.curiosity * 0.10 +
      scores.storytelling * 0.05 +
      scores.specificity * 0.05,
    );
  }

  private scoreEmotion(text: string): number {
    const t = text.toLowerCase();
    const highEmotion = ['incredible', 'amazing', 'shocking', 'devastating', 'life-changing', 'insane', 'mind-blowing'];
    const medEmotion = ['great', 'bad', 'good', 'terrible', 'wonderful', 'awful', 'excited'];
    let score = 30;
    for (const w of highEmotion) if (t.includes(w)) score += 15;
    for (const w of medEmotion) if (t.includes(w)) score += 8;
    return Math.min(100, score);
  }

  private scoreSpeechSpeed(wps: number): number {
    if (wps >= 3.0 && wps <= 4.5) return 90;
    if (wps >= 2.0 && wps <= 5.0) return 70;
    if (wps >= 1.5 && wps <= 5.5) return 50;
    return 30;
  }

  private scoreSentiment(text: string): number {
    const positive = ['love', 'great', 'amazing', 'success', 'win', 'best', 'awesome', 'perfect', 'excellent'];
    const negative = ['hate', 'fail', 'wrong', 'terrible', 'worst', 'never', 'impossible', 'disaster'];
    const t = text.toLowerCase();
    let score = 40;
    let positiveCount = 0, negativeCount = 0;
    for (const w of positive) if (t.includes(w)) positiveCount++;
    for (const w of negative) if (t.includes(w)) negativeCount++;
    score += positiveCount * 8;
    score += negativeCount * 12;
    return Math.min(100, score);
  }

  private scoreNovelty(text: string): number {
    let score = 30;
    const t = text.toLowerCase();
    const noveltyIndicators = ['first time', 'never before', 'breakthrough', 'revolutionary', 'new way', 'discovered', 'secret', 'nobody knows'];
    for (const ind of noveltyIndicators) if (t.includes(ind)) score += 18;
    return Math.min(100, score);
  }

  private scoreControversy(text: string): number {
    let score = 20;
    const t = text.toLowerCase();
    const controversial = ['wrong', 'lie', 'scam', 'myth', 'debunk', 'unpopular', 'controversial', 'they don\'t want', 'hidden truth', 'cover up'];
    for (const w of controversial) if (t.includes(w)) score += 20;
    return Math.min(100, score);
  }

  private scoreCuriosity(text: string): number {
    let score = 30;
    const t = text.toLowerCase();
    if (text.includes('?')) score += 20;
    const curiosityTriggers = ['why', 'how', 'what if', 'imagine', 'guess what', 'you won\'t believe', 'wait until', 'here\'s the thing'];
    for (const trigger of curiosityTriggers) if (t.includes(trigger)) score += 12;
    return Math.min(100, score);
  }

  private scoreStorytelling(text: string): number {
    let score = 20;
    const t = text.toLowerCase();
    const storyMarkers = ['i was', 'i remember', 'one day', 'suddenly', 'and then', 'but then', 'that\'s when', 'i realized', 'it happened'];
    for (const marker of storyMarkers) if (t.includes(marker)) score += 15;
    return Math.min(100, score);
  }

  private scoreSpecificity(text: string): number {
    let score = 20;
    if (/\d+/.test(text)) score += 25;
    if (/%/.test(text)) score += 20;
    if (/\$/.test(text)) score += 20;
    if (/\b\d{4}\b/.test(text)) score += 10;
    return Math.min(100, score);
  }

  private scoreHookPotential(text: string): number {
    let score = 40;
    const t = text.toLowerCase();
    if (text.split(' ').length <= 10) score += 20;
    if (text.includes('?')) score += 15;
    if (/\d/.test(text)) score += 10;
    if (/\b(you|your)\b/i.test(t)) score += 15;
    return Math.min(100, score);
  }

  private scoreRetentionPotential(text: string, words: Array<{ word: string; start: number; end: number }>): number {
    const durationSeconds = words.length > 1
      ? words[words.length - 1].end - words[0].start
      : 1;
    const wps = words.length / durationSeconds;
    let score = 40;
    if (wps >= 2.5 && wps <= 4.0) score += 20;
    if (text.length > 50) score += 15;
    if (/[.!?]/.test(text)) score += 10;
    return Math.min(100, score);
  }

  private detectEmotion(text: string): string {
    const t = text.toLowerCase();
    if (/\b(amazing|incredible|awesome|fantastic|love)\b/.test(t)) return 'joy';
    if (/\b(shocking|unbelievable|surprised|stunned|wow)\b/.test(t)) return 'surprise';
    if (/\b(angry|furious|outraged|mad|hate)\b/.test(t)) return 'anger';
    if (/\b(inspired|motivated|powerful|determined|ready)\b/.test(t)) return 'inspiration';
    if (/\b(sad|devastated|heartbroken|loss|crying)\b/.test(t)) return 'sadness';
    if (/\b(scared|afraid|terrified|worried|anxious)\b/.test(t)) return 'fear';
    return 'neutral';
  }

  private extractReasons(scores: ViralScoreComponents): string[] {
    const reasons: string[] = [];
    if (scores.emotion > 70) reasons.push('High emotional impact');
    if (scores.controversy > 60) reasons.push('Controversial content');
    if (scores.curiosity > 70) reasons.push('Creates curiosity gap');
    if (scores.novelty > 60) reasons.push('Novel or surprising information');
    if (scores.specificity > 70) reasons.push('Specific data and numbers');
    if (scores.storytelling > 60) reasons.push('Strong storytelling elements');
    return reasons;
  }

  private async analyzeWithAI(transcript: FullTranscript, options: AnalysisOptions): Promise<Partial<ViralMoment>[]> {
    const truncatedText = transcript.text.slice(0, 6000);

    const prompt = `Identify the TOP 10 most viral moments in this video transcript for ${options.targetPlatform}.

TRANSCRIPT:
${truncatedText}

Total duration: ${Math.round(transcript.durationMs / 1000)} seconds

Return JSON array:
[
  {
    "startMs": number,
    "endMs": number,
    "text": "exact quote",
    "viralScore": number (0-100),
    "emotionType": "joy|surprise|anger|inspiration|sadness|fear|neutral",
    "reasons": ["reason1", "reason2"]
  }
]

Focus on:
1. Moments that would make someone stop scrolling
2. Statements that create strong emotions
3. Surprising revelations or statistics
4. Personal stories with high stakes
5. Controversy or contrarian views`;

    return this.claude.messageJSON<Partial<ViralMoment>[]>(prompt, {
      temperature: 0.5,
    });
  }

  private mergeAnalyses(
    local: ViralMoment[],
    ai: Partial<ViralMoment>[],
    transcript: FullTranscript,
  ): ViralMoment[] {
    const merged = new Map<string, ViralMoment>();

    for (const moment of local) {
      const key = `${moment.startMs}-${moment.endMs}`;
      merged.set(key, moment);
    }

    for (const aiMoment of ai) {
      if (!aiMoment.startMs || !aiMoment.endMs) continue;

      const overlap = this.findOverlapping(aiMoment.startMs, aiMoment.endMs, merged);
      if (overlap) {
        const existing = merged.get(overlap)!;
        const aiScore = aiMoment.viralScore ?? 0;
        merged.set(overlap, {
          ...existing,
          viralScore: Math.round((existing.viralScore * 0.4) + (aiScore * 0.6)),
          emotionType: aiMoment.emotionType ?? existing.emotionType,
          reasons: [...new Set([...existing.reasons, ...(aiMoment.reasons ?? [])])],
        });
      } else {
        const key = `${aiMoment.startMs}-${aiMoment.endMs}`;
        const words = transcript.words.filter(
          (w) => w.start * 1000 >= aiMoment.startMs! && w.end * 1000 <= aiMoment.endMs!,
        );
        merged.set(key, {
          startMs: aiMoment.startMs,
          endMs: aiMoment.endMs,
          text: aiMoment.text ?? words.map((w) => w.word).join(' '),
          viralScore: aiMoment.viralScore ?? 50,
          hookScore: 50,
          retentionScore: 50,
          emotionType: aiMoment.emotionType ?? 'neutral',
          reasons: aiMoment.reasons ?? [],
        });
      }
    }

    return Array.from(merged.values());
  }

  private findOverlapping(startMs: number, endMs: number, moments: Map<string, ViralMoment>): string | null {
    for (const [key, moment] of moments) {
      const overlapStart = Math.max(startMs, moment.startMs);
      const overlapEnd = Math.min(endMs, moment.endMs);
      const overlapDuration = overlapEnd - overlapStart;
      const momentDuration = moment.endMs - moment.startMs;

      if (overlapDuration > momentDuration * 0.5) {
        return key;
      }
    }
    return null;
  }

  private async selectBestClips(
    moments: ViralMoment[],
    targetDurationSeconds: number,
    platform: string,
  ): Promise<SelectedClip[]> {
    const targetMs = targetDurationSeconds * 1000;
    const nonOverlapping = this.removeOverlappingMoments(moments);
    const candidates = this.expandToTargetDuration(nonOverlapping, targetMs);

    return candidates.slice(0, 5).map((clip, i) => ({
      rank: i + 1,
      startMs: clip.startMs,
      endMs: clip.endMs,
      durationMs: clip.endMs - clip.startMs,
      viralScore: clip.viralScore,
      hookScore: clip.hookScore,
      retentionScore: clip.retentionScore,
      title: `${platform} Clip #${i + 1}`,
      description: `Viral moment with ${clip.viralScore}% engagement potential`,
      hashtags: this.generateHashtagSuggestions(clip, platform),
      hook: clip.text.slice(0, 100),
    }));
  }

  private removeOverlappingMoments(moments: ViralMoment[]): ViralMoment[] {
    const selected: ViralMoment[] = [];

    for (const moment of moments) {
      const hasOverlap = selected.some(
        (s) => !(moment.endMs <= s.startMs || moment.startMs >= s.endMs),
      );
      if (!hasOverlap) selected.push(moment);
    }

    return selected;
  }

  private expandToTargetDuration(moments: ViralMoment[], targetMs: number): ViralMoment[] {
    return moments.map((moment) => {
      const currentDuration = moment.endMs - moment.startMs;
      if (currentDuration >= targetMs) {
        return { ...moment, endMs: moment.startMs + targetMs };
      }

      const padding = (targetMs - currentDuration) / 2;
      return {
        ...moment,
        startMs: Math.max(0, moment.startMs - padding),
        endMs: moment.endMs + padding,
      };
    });
  }

  private calculateOverallPotential(moments: ViralMoment[]): number {
    if (moments.length === 0) return 0;
    const top5 = moments.slice(0, 5);
    return Math.round(top5.reduce((sum, m) => sum + m.viralScore, 0) / top5.length);
  }

  private calculateAudienceMatch(text: string, platform: string): Record<string, number> {
    const t = text.toLowerCase();
    return {
      tiktok: platform === 'TIKTOK' ? 85 : 60,
      instagram: /\b(lifestyle|fashion|beauty|travel|food)\b/.test(t) ? 85 : 65,
      youtube: /\b(how to|tutorial|review|guide)\b/.test(t) ? 85 : 60,
    };
  }

  private generateHashtagSuggestions(clip: ViralMoment, platform: string): string[] {
    const platformTags: Record<string, string[]> = {
      TIKTOK: ['#viral', '#foryou', '#fyp', '#tiktok', '#trending'],
      INSTAGRAM_REELS: ['#reels', '#instagram', '#viral', '#trending', '#explore'],
      YOUTUBE_SHORTS: ['#shorts', '#youtube', '#viral', '#trending'],
    };

    const baseTags = platformTags[platform] ?? platformTags['TIKTOK'];
    const emotionTags: Record<string, string[]> = {
      inspiration: ['#motivation', '#mindset', '#success'],
      joy: ['#happiness', '#positive', '#lifestyle'],
      surprise: ['#shocking', '#mindblown', '#facts'],
      anger: ['#truth', '#facts', '#real'],
    };

    return [
      ...baseTags,
      ...(emotionTags[clip.emotionType] ?? []),
    ].slice(0, 10);
  }
}
