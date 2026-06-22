import { describe, it, expect } from 'vitest';
import { HookDetector } from '../analysis/hook-detection.js';
import type { TranscriptSegment } from '../types.js';

function makeSegment(text: string, startMs = 0, endMs = 5000): TranscriptSegment {
  return {
    id: `seg-${startMs}`,
    text,
    startMs,
    endMs,
    words: [],
  };
}

describe('HookDetector', () => {
  const detector = new HookDetector();

  describe('scoreSegmentAsHook', () => {
    it('gives high score to shocking/surprising statements', () => {
      const segment = makeSegment('This shocking secret will change your life forever');
      const score = detector.scoreSegmentAsHook(segment);
      expect(score).toBeGreaterThan(30);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('gives higher score to questions', () => {
      const question = makeSegment('Did you know that 90% of businesses fail in the first year?');
      const statement = makeSegment('Many businesses fail in the first year.');
      const questionScore = detector.scoreSegmentAsHook(question);
      const statementScore = detector.scoreSegmentAsHook(statement);
      expect(questionScore).toBeGreaterThan(statementScore);
    });

    it('gives higher score to controversy triggers', () => {
      const controversial = makeSegment('Everything you know about diet is a lie');
      const plain = makeSegment('Diet advice varies by person');
      const cScore = detector.scoreSegmentAsHook(controversial);
      const pScore = detector.scoreSegmentAsHook(plain);
      expect(cScore).toBeGreaterThan(pScore);
    });

    it('gives higher score to personal story markers', () => {
      const personal = makeSegment('I was completely broke until I discovered this method');
      const generic = makeSegment('Some people find different methods work for them');
      const pScore = detector.scoreSegmentAsHook(personal);
      const gScore = detector.scoreSegmentAsHook(generic);
      expect(pScore).toBeGreaterThan(gScore);
    });

    it('respects 0-100 bounds', () => {
      const extreme = makeSegment(
        'SHOCKING! Nobody ever told you this secret lie! Exposed! Insane crazy unbelievable scam revealed! I was betrayed! You need to stop doing this NOW!',
      );
      const score = detector.scoreSegmentAsHook(extreme);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('findOpeningHook', () => {
    it('returns null when no hooks provided', () => {
      const result = detector.findOpeningHook([]);
      expect(result).toBeNull();
    });

    it('returns the highest scoring hook within the opening window', () => {
      const hooks = [
        { text: 'hook1', startMs: 5000, endMs: 8000, type: 'curiosity' as const, score: 80, reason: 'r1' },
        { text: 'hook2', startMs: 45000, endMs: 50000, type: 'surprising' as const, score: 95, reason: 'r2' },
        { text: 'hook3', startMs: 2000, endMs: 5000, type: 'emotional' as const, score: 70, reason: 'r3' },
      ];
      const result = detector.findOpeningHook(hooks, 30000);
      expect(result?.score).toBe(80);
      expect(result?.text).toBe('hook1');
    });

    it('returns highest score hook overall when no hooks within window', () => {
      const hooks = [
        { text: 'hook1', startMs: 60000, endMs: 65000, type: 'curiosity' as const, score: 70, reason: 'r1' },
        { text: 'hook2', startMs: 90000, endMs: 95000, type: 'surprising' as const, score: 90, reason: 'r2' },
      ];
      const result = detector.findOpeningHook(hooks, 30000);
      expect(result).not.toBeNull();
    });
  });
});
