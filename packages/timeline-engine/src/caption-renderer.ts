import type { CaptionBlock } from './types.js';

export interface RenderedCaption {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  css: Record<string, string | number>;
  words: Array<{ word: string; startMs: number; endMs: number; css: Record<string, string> }>;
  animation: { keyframes: Array<{ time: number; props: Record<string, string | number> }> };
}

const STYLE_CONFIGS = {
  TIKTOK: { fontFamily: '"Arial Black", Impact, sans-serif', fontWeight: '900', fontSize: 52, color: '#FFFFFF', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', WebkitTextStroke: '2px #000000', textTransform: 'uppercase' as const, letterSpacing: '0.02em', highlightColor: '#FFFC00' },
  HORMOZI: { fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: '900', fontSize: 64, color: '#FFFFFF', textShadow: '3px 3px 0px #000000', WebkitTextStroke: '3px #000000', textTransform: 'uppercase' as const, letterSpacing: '0.05em', highlightColor: '#FF0000' },
  GADZHI: { fontFamily: '"Montserrat", "Helvetica Neue", sans-serif', fontWeight: '800', fontSize: 48, color: '#FFFFFF', textShadow: '0 0 20px #00FFFF, 0 0 40px #00FFFF', WebkitTextStroke: '1px #00FFFF', textTransform: 'uppercase' as const, letterSpacing: '0.08em', highlightColor: '#00FFFF' },
  MRBEAST: { fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: '900', fontSize: 72, color: '#FFD700', textShadow: '4px 4px 0px #000000, -2px -2px 0px #000000', WebkitTextStroke: '4px #000000', textTransform: 'uppercase' as const, letterSpacing: '0.04em', highlightColor: '#FF6B00' },
} as const;

export class CaptionRenderer {
  render(caption: CaptionBlock): RenderedCaption {
    const config = STYLE_CONFIGS[caption.style] ?? STYLE_CONFIGS.TIKTOK;
    const fontSize = caption.fontSize || config.fontSize;
    const baseCss: Record<string, string | number> = {
      position: 'absolute', left: `${caption.positionX * 100}%`, top: `${caption.positionY * 100}%`,
      transform: 'translate(-50%, -50%)', fontFamily: config.fontFamily, fontWeight: config.fontWeight,
      fontSize: `${fontSize}px`, color: caption.colorHex || config.color, textShadow: config.textShadow,
      WebkitTextStroke: `${caption.strokeWidth ?? 2}px ${caption.strokeColor ?? '#000000'}`,
      textTransform: config.textTransform, letterSpacing: config.letterSpacing, textAlign: 'center',
      maxWidth: '90%', lineHeight: '1.2', userSelect: 'none',
    };
    const words = caption.words.map((w) => ({ word: w.word, startMs: w.startMs, endMs: w.endMs, css: { color: config.highlightColor } }));
    return { id: caption.id, text: caption.text, startMs: caption.startMs, endMs: caption.endMs, css: baseCss, words, animation: this.buildAnimation(caption.animationType) };
  }

  renderAll(captions: CaptionBlock[]): RenderedCaption[] { return captions.map((c) => this.render(c)); }

  toSRTBlock(caption: CaptionBlock, index: number): string {
    return `${index}\n${this.msToSRT(caption.startMs)} --> ${this.msToSRT(caption.endMs)}\n${caption.text}\n`;
  }

  toSRT(captions: CaptionBlock[]): string {
    return captions.sort((a, b) => a.startMs - b.startMs).map((c, i) => this.toSRTBlock(c, i + 1)).join('\n');
  }

  toASS(captions: CaptionBlock[], width: number, height: number): string {
    const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`;
    const styles = Object.entries(STYLE_CONFIGS).map(([name, cfg]) => `Style: ${name},${cfg.fontFamily.split(',')[0]!.replace(/"/g, '')},${cfg.fontSize},${this.hexToASS(cfg.color)},${this.hexToASS(cfg.color)},${this.hexToASS('#000000')},&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,10,1`).join('\n');
    const events = `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${captions.map((c) => `Dialogue: 0,${this.msToASS(c.startMs)},${this.msToASS(c.endMs)},${c.style},,0,0,0,,{\\an5}${c.text}`).join('\n')}`;
    return `${header}\n${styles}\n\n${events}`;
  }

  private buildAnimation(type: CaptionBlock['animationType']): RenderedCaption['animation'] {
    switch (type) {
      case 'pop': return { keyframes: [{ time: 0, props: { transform: 'scale(0.5)', opacity: 0 } }, { time: 0.1, props: { transform: 'scale(1.15)', opacity: 1 } }, { time: 0.2, props: { transform: 'scale(1.0)', opacity: 1 } }, { time: 0.9, props: { transform: 'scale(1.0)', opacity: 1 } }, { time: 1.0, props: { transform: 'scale(0.9)', opacity: 0 } }] };
      case 'fade': return { keyframes: [{ time: 0, props: { opacity: 0 } }, { time: 0.15, props: { opacity: 1 } }, { time: 0.85, props: { opacity: 1 } }, { time: 1.0, props: { opacity: 0 } }] };
      case 'bounce': return { keyframes: [{ time: 0, props: { transform: 'translateY(-30px)', opacity: 0 } }, { time: 0.15, props: { transform: 'translateY(5px)', opacity: 1 } }, { time: 0.35, props: { transform: 'translateY(0)', opacity: 1 } }, { time: 1.0, props: { transform: 'translateY(10px)', opacity: 0 } }] };
      default: return { keyframes: [{ time: 0, props: { opacity: 1 } }, { time: 1, props: { opacity: 1 } }] };
    }
  }

  private msToSRT(ms: number): string {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), ms_ = ms % 1000;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms_).padStart(3,'0')}`;
  }

  private msToASS(ms: number): string {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10);
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  private hexToASS(hex: string): string {
    const r = hex.slice(1,3), g = hex.slice(3,5), b = hex.slice(5,7);
    return `&H00${b}${g}${r}`.toUpperCase();
  }
}
