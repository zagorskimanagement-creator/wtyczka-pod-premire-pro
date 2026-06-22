import { describe, it, expect } from 'vitest';
import { RetentionScorer } from '../analysis/retention-scoring.js';
import type { TranscriptSegment } from '../types.js';

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 'test-1',
    text: 'This is a test segment',
    startMs: 0,
    endMs: 5000,
    words: [],
    ...overrides,
  };
}

describe('RetentionScorer', () => {
  const scorer = new RetentionScorer();

  it('scores a segment with overall in range 0-100', () => {
    const segment = makeSegment({ text: 'I made a million dollars in 30 days!' });
    const result = scorer.score(segment);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('gives higher energy score for high-energy text', () => {
    const highEnergy = makeSegment({ text: 'This is absolutely incredible and amazing!' });
    const lowEnergy = makeSegment({ text: 'I went to the store today.' });
    const highResult = scorer.score(highEnergy);
    const lowResult = scorer.score(lowEnergy);
    expect(highResult.energyScore).toBeGreaterThan(lowResult.energyScore);
  });

  it('gives higher specificity score for text with numbers', () => {
    const withNumbers = makeSegment({ text: 'Revenue increased by 347% in Q3 2024' });
    const withoutNumbers = makeSegment({ text: 'Revenue increased significantly' });
    const withResult = scorer.score(withNumbers);
    const withoutResult = scorer.score(withoutNumbers);
    expect(withResult.specificityScore).toBeGreaterThan(withoutResult.specificityScore);
  });

  it('scores all components between 0-100', () => {
    const segment = makeSegment({
      text: 'The shocking truth about how I made $500,000 in one year!',
      startMs: 0,
      endMs: 8000,
      sentimentScore: 0.9,
    });
    const result = scorer.score(segment);
    expect(result.sentenceLength).toBeGreaterThanOrEqual(0);
    expect(result.sentenceLength).toBeLessThanOrEqual(100);
    expect(result.energyScore).toBeGreaterThanOrEqual(0);
    expect(result.energyScore).toBeLessThanOrEqual(100);
    expect(result.emotionScore).toBeGreaterThanOrEqual(0);
    expect(result.emotionScore).toBeLessThanOrEqual(100);
    expect(result.pacingScore).toBeGreaterThanOrEqual(0);
    expect(result.pacingScore).toBeLessThanOrEqual(100);
  });

  it('gives good pacing score for optimal words per second', () => {
    const optimalPacing = makeSegment({
      text: 'This is a really great moment that changed everything for me.',
      startMs: 0,
      endMs: 4000,
    });
    const result = scorer.score(optimalPacing);
    expect(result.pacingScore).toBeGreaterThan(50);
  });

  it('gives high cliffhanger score for cliffhanger phrases', () => {
    const cliffhanger = makeSegment({
      text: 'But then suddenly everything changed and I never expected what happened next.',
    });
    const normal = makeSegment({ text: 'I went to work and had a meeting.' });
    const cliffResult = scorer.score(cliffhanger);
    const normalResult = scorer.score(normal);
    expect(cliffResult.cliffhangerScore).toBeGreaterThan(normalResult.cliffhangerScore);
  });
});
