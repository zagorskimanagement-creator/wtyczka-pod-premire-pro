import type { CaptionGroup, CaptionStyleConfig, RenderedCaption, WordTiming } from '../types.js';
import { TIKTOK_STYLE } from '../styles/tiktok.js';
import { HORMOZI_STYLE } from '../styles/hormozi.js';
import { GADZHI_STYLE } from '../styles/gadzhi.js';
import { MRBEAST_STYLE } from '../styles/mrbeast.js';

const STYLES: Record<string, CaptionStyleConfig> = { TIKTOK: TIKTOK_STYLE, HORMOZI: HORMOZI_STYLE, GADZHI: GADZHI_STYLE, MRBEAST: MRBEAST_STYLE };

export class CaptionRenderer {
  private style: CaptionStyleConfig;

  constructor(styleName: string = 'TIKTOK') {
    this.style = STYLES[styleName] ?? TIKTOK_STYLE;
  }

  groupWords(words: WordTiming[], wordsPerGroup: number = 4): CaptionGroup[] {
    const filtered = words.filter((w) => !w.isFiller);
    const groups: CaptionGroup[] = [];
    for (let i = 0; i < filtered.length; i += wordsPerGroup) {
      const chunk = filtered.slice(i, i + wordsPerGroup);
      if (chunk.length === 0) continue;
      groups.push({ words: chunk, startMs: chunk[0]!.startMs, endMs: chunk[chunk.length - 1]!.endMs, text: this.formatText(chunk.map((w) => w.word).join(' ')) });
    }
    return groups;
  }

  render(group: CaptionGroup, index: number): RenderedCaption {
    return { id: `caption_${index}`, groupIndex: index, text: group.text, startMs: group.startMs, endMs: group.endMs, style: this.style, words: group.words, position: { x: this.style.positionX, y: this.style.positionY } };
  }

  renderAll(words: WordTiming[], wordsPerGroup: number = 4): RenderedCaption[] {
    return this.groupWords(words, wordsPerGroup).map((g, i) => this.render(g, i));
  }

  toCSSObject(caption: RenderedCaption): Record<string, string> {
    const s = caption.style;
    return {
      position: 'absolute', left: `${caption.position.x * 100}%`, top: `${caption.position.y * 100}%`,
      transform: 'translate(-50%, -50%)', fontFamily: s.fontFamily, fontWeight: s.fontWeight,
      fontSize: `${s.fontSize}px`, color: s.color,
      textShadow: `${s.shadowOffsetX}px ${s.shadowOffsetY}px ${s.shadowBlur}px ${s.shadowColor}`,
      WebkitTextStroke: `${s.strokeWidth}px ${s.strokeColor}`, textTransform: s.textTransform,
      letterSpacing: `${s.letterSpacing}em`, lineHeight: `${s.lineHeight}`, textAlign: 'center',
      maxWidth: '90%', userSelect: 'none', pointerEvents: 'none',
    };
  }

  toSRT(captions: RenderedCaption[]): string {
    return [...captions].sort((a, b) => a.startMs - b.startMs).map((c, i) => {
      const fmt = (ms: number) => { const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000),ms_=ms%1000; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms_).padStart(3,'0')}`; };
      return `${i+1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text}\n`;
    }).join('\n');
  }

  private formatText(text: string): string {
    if (this.style.textTransform === 'uppercase') return text.toUpperCase();
    if (this.style.textTransform === 'lowercase') return text.toLowerCase();
    if (this.style.textTransform === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
    return text;
  }
}
