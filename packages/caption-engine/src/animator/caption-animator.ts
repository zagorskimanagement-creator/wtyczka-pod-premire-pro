import type { AnimationFrame, CaptionAnimation, AnimationType } from '../types.js';

export class CaptionAnimator {
  buildAnimation(type: AnimationType, durationMs: number): CaptionAnimation {
    switch (type) {
      case 'pop': return { durationMs, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', frames: [{ timeMs: 0, properties: { opacity: 0, scale: 0.5 } }, { timeMs: durationMs * 0.1, properties: { opacity: 1, scale: 1.15 } }, { timeMs: durationMs * 0.2, properties: { opacity: 1, scale: 1.0 } }, { timeMs: durationMs * 0.85, properties: { opacity: 1, scale: 1.0 } }, { timeMs: durationMs, properties: { opacity: 0, scale: 0.9 } }] };
      case 'typewriter': return { durationMs, easing: 'linear', frames: [{ timeMs: 0, properties: { opacity: 1, clipProgress: 0 } }, { timeMs: durationMs * 0.4, properties: { opacity: 1, clipProgress: 1 } }, { timeMs: durationMs * 0.9, properties: { opacity: 1, clipProgress: 1 } }, { timeMs: durationMs, properties: { opacity: 0, clipProgress: 1 } }] };
      case 'fade': return { durationMs, easing: 'ease-in-out', frames: [{ timeMs: 0, properties: { opacity: 0 } }, { timeMs: durationMs * 0.15, properties: { opacity: 1 } }, { timeMs: durationMs * 0.85, properties: { opacity: 1 } }, { timeMs: durationMs, properties: { opacity: 0 } }] };
      case 'bounce': return { durationMs, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', frames: [{ timeMs: 0, properties: { opacity: 0, translateY: -30 } }, { timeMs: durationMs * 0.15, properties: { opacity: 1, translateY: 5 } }, { timeMs: durationMs * 0.35, properties: { opacity: 1, translateY: 0 } }, { timeMs: durationMs * 0.85, properties: { opacity: 1, translateY: 0 } }, { timeMs: durationMs, properties: { opacity: 0, translateY: 10 } }] };
      case 'slide-up': return { durationMs, easing: 'ease-out', frames: [{ timeMs: 0, properties: { opacity: 0, translateY: 40 } }, { timeMs: durationMs * 0.2, properties: { opacity: 1, translateY: 0 } }, { timeMs: durationMs * 0.85, properties: { opacity: 1, translateY: 0 } }, { timeMs: durationMs, properties: { opacity: 0, translateY: -20 } }] };
      default: return { durationMs, easing: 'linear', frames: [{ timeMs: 0, properties: { opacity: 1 } }, { timeMs: durationMs, properties: { opacity: 1 } }] };
    }
  }

  interpolate(animation: CaptionAnimation, timeMs: number, captionStartMs: number, captionEndMs: number): Record<string, string | number> {
    const duration = captionEndMs - captionStartMs;
    const clamped = Math.max(0, Math.min(1, (timeMs - captionStartMs) / duration));
    const frames = animation.frames;
    if (frames.length === 0) return {};
    let bi = 0, ai = 1;
    for (let i = 0; i < frames.length - 1; i++) {
      if ((frames[i]!.timeMs / duration) <= clamped) { bi = i; ai = Math.min(i + 1, frames.length - 1); }
    }
    const before = frames[bi]!, after = frames[ai]!;
    const bt = before.timeMs / duration, at = after.timeMs / duration;
    const t = at > bt ? (clamped - bt) / (at - bt) : 0;
    const result: Record<string, string | number> = {};
    for (const key of new Set([...Object.keys(before.properties), ...Object.keys(after.properties)])) {
      const fv = before.properties[key], tv = after.properties[key];
      result[key] = (typeof fv === 'number' && typeof tv === 'number') ? fv + (tv - fv) * t : (t < 0.5 ? (fv ?? tv)! : (tv ?? fv)!);
    }
    return result;
  }

  toCSS(animation: CaptionAnimation, captionId: string): string {
    const kf = animation.frames.map((f) => {
      const pct = Math.round((f.timeMs / animation.durationMs) * 100);
      const props = Object.entries(f.properties).map(([k,v]) => k==='opacity'?`opacity:${v};`:k==='scale'?`transform:scale(${v});`:k==='translateY'?`transform:translateY(${v}px);`:'').filter(Boolean).join(' ');
      return `  ${pct}% { ${props} }`;
    }).join('\n');
    return `@keyframes caption_${captionId} {\n${kf}\n}\n.caption-${captionId} {\n  animation: caption_${captionId} ${animation.durationMs}ms ${animation.easing} forwards;\n}`;
  }
}
