import type { CaptionConfig, TranscriptWord } from '../types.js';

export interface CaptionStyle {
  name: string;
  fontFamily: string;
  fontSize: number;
  colorHex: string;
  strokeColor: string;
  strokeWidth: number;
  highlightColor: string;
  shadowColor: string;
  shadowBlur: number;
  positionY: number;
  maxWordsPerLine: number;
  animation: 'pop' | 'scale' | 'bounce' | 'fade' | 'none';
  uppercase: boolean;
  bold: boolean;
  letterSpacing: number;
  lineHeight: number;
  background?: {
    color: string;
    opacity: number;
    borderRadius: number;
    padding: number;
  };
  wordHighlight: {
    enabled: boolean;
    color: string;
    scale?: number;
  };
}

export const CAPTION_STYLES: Record<string, CaptionStyle> = {
  TIKTOK: {
    name: 'TikTok Classic',
    fontFamily: 'Proxima Nova',
    fontSize: 52,
    colorHex: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    highlightColor: '#FFE900',
    shadowColor: '#000000',
    shadowBlur: 8,
    positionY: 0.85,
    maxWordsPerLine: 4,
    animation: 'pop',
    uppercase: false,
    bold: true,
    letterSpacing: 0,
    lineHeight: 1.2,
    wordHighlight: { enabled: true, color: '#FFE900', scale: 1.1 },
  },

  HORMOZI: {
    name: 'Alex Hormozi',
    fontFamily: 'Impact',
    fontSize: 64,
    colorHex: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 6,
    highlightColor: '#FF0000',
    shadowColor: '#000000',
    shadowBlur: 10,
    positionY: 0.88,
    maxWordsPerLine: 3,
    animation: 'scale',
    uppercase: true,
    bold: true,
    letterSpacing: 2,
    lineHeight: 1.1,
    background: {
      color: '#000000',
      opacity: 0.6,
      borderRadius: 4,
      padding: 8,
    },
    wordHighlight: { enabled: true, color: '#FF0000', scale: 1.15 },
  },

  GADZHI: {
    name: 'Iman Gadzhi',
    fontFamily: 'Montserrat',
    fontSize: 56,
    colorHex: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
    highlightColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowBlur: 20,
    positionY: 0.83,
    maxWordsPerLine: 4,
    animation: 'bounce',
    uppercase: false,
    bold: true,
    letterSpacing: 1,
    lineHeight: 1.3,
    wordHighlight: { enabled: true, color: '#00D4FF', scale: 1.05 },
  },

  MRBEAST: {
    name: 'MrBeast',
    fontFamily: 'Arial Black',
    fontSize: 72,
    colorHex: '#FFFF00',
    strokeColor: '#000000',
    strokeWidth: 8,
    highlightColor: '#FF0000',
    shadowColor: '#000000',
    shadowBlur: 15,
    positionY: 0.82,
    maxWordsPerLine: 3,
    animation: 'bounce',
    uppercase: true,
    bold: true,
    letterSpacing: 3,
    lineHeight: 1.0,
    background: {
      color: '#000000',
      opacity: 0.8,
      borderRadius: 8,
      padding: 12,
    },
    wordHighlight: { enabled: true, color: '#FF0000', scale: 1.2 },
  },
};

export class CaptionGenerator {
  generateFromWords(
    words: TranscriptWord[],
    styleName: string,
    clipStartMs: number,
    clipEndMs: number,
  ): CaptionConfig[] {
    const style = CAPTION_STYLES[styleName] ?? CAPTION_STYLES['TIKTOK'];
    const filtered = words.filter(
      (w) => w.start * 1000 >= clipStartMs && w.end * 1000 <= clipEndMs,
    );

    const captions: CaptionConfig[] = [];

    for (let i = 0; i < filtered.length; i += style.maxWordsPerLine) {
      const chunk = filtered.slice(i, i + style.maxWordsPerLine);
      if (chunk.length === 0) continue;

      const text = style.uppercase
        ? chunk.map((w) => w.word.toUpperCase()).join(' ')
        : chunk.map((w) => w.word).join(' ');

      captions.push({
        text,
        startMs: Math.round(chunk[0].start * 1000),
        endMs: Math.round(chunk[chunk.length - 1].end * 1000 + 100),
        words: chunk.map((w) => ({
          word: style.uppercase ? w.word.toUpperCase() : w.word,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        })),
        style: styleName as 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST',
        positionY: style.positionY,
        fontSize: style.fontSize,
        animation: style.animation,
        highlightColor: style.highlightColor,
      });
    }

    return captions;
  }

  getStyleConfig(styleName: string): CaptionStyle {
    return CAPTION_STYLES[styleName] ?? CAPTION_STYLES['TIKTOK'];
  }

  getAllStyles(): Record<string, CaptionStyle> {
    return CAPTION_STYLES;
  }

  previewCaptionCSS(styleName: string): Record<string, string> {
    const style = this.getStyleConfig(styleName);
    return {
      fontFamily: style.fontFamily,
      fontSize: `${style.fontSize}px`,
      color: style.colorHex,
      WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
      textShadow: `0 0 ${style.shadowBlur}px ${style.shadowColor}`,
      fontWeight: style.bold ? 'bold' : 'normal',
      letterSpacing: `${style.letterSpacing}px`,
      lineHeight: String(style.lineHeight),
      textTransform: style.uppercase ? 'uppercase' : 'none',
    };
  }
}
