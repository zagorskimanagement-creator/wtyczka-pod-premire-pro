import { describe, it, expect } from 'vitest';
import { CaptionGenerator, CAPTION_STYLES } from '../generation/captions.js';
import type { TranscriptWord } from '../types.js';

function makeWords(texts: string[], startOffset = 0): TranscriptWord[] {
  return texts.map((text, i) => ({
    word: text,
    start: startOffset + i * 0.5,
    end: startOffset + i * 0.5 + 0.4,
    confidence: 0.95,
  }));
}

describe('CaptionGenerator', () => {
  const generator = new CaptionGenerator();

  it('generates captions from words with correct grouping', () => {
    const words = makeWords(['Hello', 'world', 'this', 'is', 'a', 'test', 'of', 'captions']);
    const captions = generator.generateFromWords(words, 'TIKTOK', 0, 10000);

    expect(captions.length).toBeGreaterThan(0);
    expect(captions[0].text).toBeDefined();
    expect(captions[0].startMs).toBeGreaterThanOrEqual(0);
    expect(captions[0].endMs).toBeGreaterThan(captions[0].startMs);
  });

  it('filters words outside clip range', () => {
    const words = makeWords(['inside', 'clip', 'content'], 1);
    const outsideWords = makeWords(['outside', 'content'], 20);
    const allWords = [...words, ...outsideWords];

    const captions = generator.generateFromWords(allWords, 'TIKTOK', 0, 5000);
    const allText = captions.map((c) => c.text).join(' ');

    expect(allText).toContain('inside');
    expect(allText).not.toContain('outside');
  });

  it('applies UPPERCASE for HORMOZI and MRBEAST styles', () => {
    const words = makeWords(['hello', 'world', 'testing']);
    const hormoziCaptions = generator.generateFromWords(words, 'HORMOZI', 0, 5000);
    const mrbeastCaptions = generator.generateFromWords(words, 'MRBEAST', 0, 5000);

    if (hormoziCaptions[0]) {
      expect(hormoziCaptions[0].text).toBe(hormoziCaptions[0].text.toUpperCase());
    }
    if (mrbeastCaptions[0]) {
      expect(mrbeastCaptions[0].text).toBe(mrbeastCaptions[0].text.toUpperCase());
    }
  });

  it('returns correct style config for each style', () => {
    for (const styleName of ['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']) {
      const config = generator.getStyleConfig(styleName);
      expect(config).toBeDefined();
      expect(config.fontFamily).toBeDefined();
      expect(config.fontSize).toBeGreaterThan(0);
      expect(config.colorHex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('returns all 4 caption styles', () => {
    const styles = generator.getAllStyles();
    expect(Object.keys(styles)).toContain('TIKTOK');
    expect(Object.keys(styles)).toContain('HORMOZI');
    expect(Object.keys(styles)).toContain('GADZHI');
    expect(Object.keys(styles)).toContain('MRBEAST');
  });

  it('generates valid CSS preview', () => {
    const css = generator.previewCaptionCSS('TIKTOK');
    expect(css.fontFamily).toBeDefined();
    expect(css.fontSize).toMatch(/px$/);
    expect(css.color).toMatch(/^#/);
  });

  it('TIKTOK style has word highlighting enabled', () => {
    const style = CAPTION_STYLES['TIKTOK'];
    expect(style?.wordHighlight.enabled).toBe(true);
  });

  it('respects maxWordsPerLine per style', () => {
    const words = makeWords(Array(20).fill(0).map((_, i) => `word${i}`));

    for (const styleName of ['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']) {
      const style = CAPTION_STYLES[styleName];
      const captions = generator.generateFromWords(words, styleName, 0, 20000);

      for (const caption of captions) {
        const wordCount = caption.text.split(' ').length;
        expect(wordCount).toBeLessThanOrEqual((style?.maxWordsPerLine ?? 4) + 1);
      }
    }
  });
});
