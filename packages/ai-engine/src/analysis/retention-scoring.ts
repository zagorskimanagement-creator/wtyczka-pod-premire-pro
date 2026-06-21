import type { TranscriptSegment, TranscriptWord } from '../types.js';

export interface RetentionScore {
  overall: number;
  sentenceLength: number;
  energyScore: number;
  emotionScore: number;
  pacingScore: number;
  specificityScore: number;
  cliffhangerScore: number;
}

export class RetentionScorer {
  score(segment: TranscriptSegment, context?: { previousSegments?: TranscriptSegment[] }): RetentionScore {
    const words = segment.text.split(/\s+/);
    const durationSeconds = (segment.endMs - segment.startMs) / 1000;

    const sentenceLength = this.scoreSentenceLength(words.length);
    const energyScore = this.scoreEnergy(segment.text);
    const emotionScore = this.scoreEmotion(segment.text, segment.sentimentScore);
    const pacingScore = this.scorePacing(words.length, durationSeconds);
    const specificityScore = this.scoreSpecificity(segment.text);
    const cliffhangerScore = this.scoreCliffhanger(segment.text, context?.previousSegments);

    const overall = Math.round(
      sentenceLength * 0.15 +
      energyScore * 0.25 +
      emotionScore * 0.25 +
      pacingScore * 0.15 +
      specificityScore * 0.10 +
      cliffhangerScore * 0.10,
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      sentenceLength,
      energyScore,
      emotionScore,
      pacingScore,
      specificityScore,
      cliffhangerScore,
    };
  }

  private scoreSentenceLength(wordCount: number): number {
    if (wordCount >= 8 && wordCount <= 15) return 90;
    if (wordCount >= 5 && wordCount <= 20) return 75;
    if (wordCount >= 3 && wordCount <= 25) return 60;
    if (wordCount < 3) return 40;
    return 50;
  }

  private scoreEnergy(text: string): number {
    let score = 50;
    const t = text.toLowerCase();

    const highEnergyWords = [
      'amazing', 'incredible', 'massive', 'huge', 'powerful', 'epic',
      'insane', 'crazy', 'wild', 'unreal', 'mind-blowing', 'game-changing',
      'revolutionary', 'explosive', 'dominate', 'crush', 'destroy',
    ];

    const actionVerbs = [
      'build', 'create', 'launch', 'grow', 'scale', 'transform', 'achieve',
      'discover', 'unlock', 'master', 'conquer', 'win', 'succeed',
    ];

    for (const word of highEnergyWords) {
      if (t.includes(word)) score += 8;
    }
    for (const word of actionVerbs) {
      if (t.includes(word)) score += 5;
    }

    if (text.includes('!')) score += 10;
    if (/\d+/.test(text)) score += 8;
    if (text.match(/\b\d{1,3}(,\d{3})*\b/)) score += 12;

    return Math.min(100, score);
  }

  private scoreEmotion(text: string, sentimentScore?: number): number {
    let score = 50;

    if (sentimentScore !== undefined) {
      score += Math.abs(sentimentScore) * 30;
    }

    const emotionWords: Record<string, number> = {
      love: 15, hate: 15, fear: 20, excited: 18, devastated: 20,
      shocked: 22, inspired: 15, motivated: 15, angry: 18, happy: 12,
      sad: 12, frustrated: 15, grateful: 12, proud: 15, embarrassed: 18,
    };

    const t = text.toLowerCase();
    for (const [word, points] of Object.entries(emotionWords)) {
      if (t.includes(word)) score += points;
    }

    const firstPerson = (t.match(/\b(i|my|me|mine|myself)\b/g) ?? []).length;
    score += firstPerson * 3;

    return Math.min(100, Math.max(0, score));
  }

  private scorePacing(wordCount: number, durationSeconds: number): number {
    if (durationSeconds === 0) return 50;
    const wps = wordCount / durationSeconds;

    if (wps >= 2.5 && wps <= 3.5) return 95;
    if (wps >= 2.0 && wps <= 4.0) return 80;
    if (wps >= 1.5 && wps <= 4.5) return 65;
    if (wps < 1.0) return 30;
    if (wps > 5.0) return 40;
    return 50;
  }

  private scoreSpecificity(text: string): number {
    let score = 40;

    const hasNumbers = /\d+/.test(text);
    const hasPercentage = /%|\bpercent\b/i.test(text);
    const hasMonetary = /\$|\beuro?\b|\bdollar\b/i.test(text);
    const hasTimeframe = /\b(day|week|month|year|hour|minute)\b/i.test(text);
    const hasProperNoun = /\b[A-Z][a-z]+\b/.test(text);
    const hasList = /\b(first|second|third|\d+\.|step \d)\b/i.test(text);

    if (hasNumbers) score += 15;
    if (hasPercentage) score += 20;
    if (hasMonetary) score += 20;
    if (hasTimeframe) score += 12;
    if (hasProperNoun) score += 8;
    if (hasList) score += 15;

    return Math.min(100, score);
  }

  private scoreCliffhanger(text: string, previousSegments?: TranscriptSegment[]): number {
    let score = 30;
    const t = text.toLowerCase();

    const cliffhangerPhrases = [
      'but then', 'until i', 'and then suddenly', 'you won\'t believe',
      'here\'s the thing', 'here\'s what happened', 'the real reason',
      'what nobody tells you', 'i never expected', 'changed everything',
      'and that\'s when', 'but wait', 'the secret is',
    ];

    for (const phrase of cliffhangerPhrases) {
      if (t.includes(phrase)) score += 25;
    }

    if (text.trim().endsWith('...') || text.trim().endsWith('—')) score += 20;

    if (previousSegments && previousSegments.length > 0) {
      const prev = previousSegments[previousSegments.length - 1];
      if (prev && prev.retentionScore !== undefined && prev.retentionScore > 80) {
        score += 15;
      }
    }

    return Math.min(100, score);
  }

  scoreWordLevel(word: TranscriptWord, wordIndex: number, allWords: TranscriptWord[]): number {
    let score = 50;
    const w = word.word.toLowerCase();

    if (wordIndex === 0 || wordIndex === 1) score += 20;
    if (word.word.length > 8) score += 5;
    if (/^\d+$/.test(word.word)) score += 20;
    if (/[A-Z]/.test(word.word[0]) && wordIndex > 0) score += 10;

    const gap = wordIndex > 0
      ? (word.start - allWords[wordIndex - 1].end) * 1000
      : 0;
    if (gap > 300) score += 15;

    return Math.min(100, score);
  }
}
