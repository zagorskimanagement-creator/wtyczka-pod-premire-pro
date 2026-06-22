import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViralEngine } from '../analysis/viral-engine.js';
import type { FullTranscript } from '../types.js';

vi.mock('../clients/claude.js', () => ({
  ClaudeClient: vi.fn().mockImplementation(() => ({
    messageJSON: vi.fn().mockResolvedValue([]),
    message: vi.fn().mockResolvedValue(''),
  })),
}));

function makeTranscript(durationMs = 60000): FullTranscript {
  const words = [];
  const wordTexts = [
    'I', 'discovered', 'a', 'shocking', 'secret', 'that', 'completely',
    'changed', 'my', 'life', 'and', 'made', 'me', 'a', 'million', 'dollars',
    'you', 'won\'t', 'believe', 'what', 'happened', 'next', 'I', 'was',
    'completely', 'broke', 'before', 'this', 'incredible', 'discovery',
  ];

  const wordDuration = durationMs / wordTexts.length / 1000;
  for (let i = 0; i < wordTexts.length; i++) {
    words.push({
      word: wordTexts[i],
      start: i * wordDuration,
      end: (i + 0.8) * wordDuration,
      confidence: 0.95,
    });
  }

  return {
    text: wordTexts.join(' '),
    language: 'en',
    confidence: 0.95,
    durationMs,
    words,
    segments: [],
  };
}

describe('ViralEngine', () => {
  let engine: ViralEngine;

  beforeEach(() => {
    engine = new ViralEngine();
  });

  it('analyzes transcript and returns viral moments', async () => {
    const transcript = makeTranscript(60000);
    const result = await engine.analyze(transcript, {
      targetDuration: 60,
      targetPlatform: 'TIKTOK',
      captionStyle: 'TIKTOK',
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

    expect(result).toBeDefined();
    expect(result.moments).toBeInstanceOf(Array);
    expect(result.selectedClips).toBeInstanceOf(Array);
    expect(result.overallViralPotential).toBeGreaterThanOrEqual(0);
    expect(result.overallViralPotential).toBeLessThanOrEqual(100);
  });

  it('all viral scores are in range 0-100', async () => {
    const transcript = makeTranscript(60000);
    const result = await engine.analyze(transcript, {
      targetDuration: 60,
      targetPlatform: 'TIKTOK',
      captionStyle: 'TIKTOK',
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

    for (const moment of result.moments) {
      expect(moment.viralScore).toBeGreaterThanOrEqual(0);
      expect(moment.viralScore).toBeLessThanOrEqual(100);
    }
  });

  it('selectedClips have required fields', async () => {
    const transcript = makeTranscript(120000);
    const result = await engine.analyze(transcript, {
      targetDuration: 60,
      targetPlatform: 'TIKTOK',
      captionStyle: 'TIKTOK',
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

    for (const clip of result.selectedClips) {
      expect(clip.startMs).toBeGreaterThanOrEqual(0);
      expect(clip.endMs).toBeGreaterThan(clip.startMs);
      expect(clip.durationMs).toBe(clip.endMs - clip.startMs);
      expect(clip.hashtags).toBeInstanceOf(Array);
      expect(clip.rank).toBeGreaterThan(0);
    }
  });
});
