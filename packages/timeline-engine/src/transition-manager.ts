import type { TransitionDef, TimelineSequence } from './types.js';

export interface TransitionRenderData {
  type: TransitionDef['type'];
  atMs: number;
  durationMs: number;
  filterComplex?: string;
  xfadeTransition?: string;
  xfadeOffset?: number;
}

export class TransitionManager {
  render(transition: TransitionDef): TransitionRenderData {
    const xfadeOffset = transition.atMs / 1000;

    switch (transition.type) {
      case 'dissolve':
        return {
          type: 'dissolve',
          atMs: transition.atMs,
          durationMs: transition.durationMs,
          xfadeTransition: 'fade',
          xfadeOffset,
          filterComplex: `xfade=transition=fade:duration=${transition.durationMs / 1000}:offset=${xfadeOffset}`,
        };

      case 'wipe':
        return {
          type: 'wipe',
          atMs: transition.atMs,
          durationMs: transition.durationMs,
          xfadeTransition: transition.direction === 'left' ? 'wipeleft' : 'wiperight',
          xfadeOffset,
          filterComplex: `xfade=transition=${transition.direction === 'left' ? 'wipeleft' : 'wiperight'}:duration=${transition.durationMs / 1000}:offset=${xfadeOffset}`,
        };

      case 'slide':
        return {
          type: 'slide',
          atMs: transition.atMs,
          durationMs: transition.durationMs,
          xfadeTransition: `slide${transition.direction ?? 'left'}`,
          xfadeOffset,
          filterComplex: `xfade=transition=slide${transition.direction ?? 'left'}:duration=${transition.durationMs / 1000}:offset=${xfadeOffset}`,
        };

      case 'zoom':
        return {
          type: 'zoom',
          atMs: transition.atMs,
          durationMs: transition.durationMs,
          xfadeTransition: 'zoomin',
          xfadeOffset,
          filterComplex: `xfade=transition=zoomin:duration=${transition.durationMs / 1000}:offset=${xfadeOffset}`,
        };

      case 'flash':
        return {
          type: 'flash',
          atMs: transition.atMs,
          durationMs: transition.durationMs,
          xfadeTransition: 'fadewhite',
          xfadeOffset,
          filterComplex: `xfade=transition=fadewhite:duration=${transition.durationMs / 1000}:offset=${xfadeOffset}`,
        };

      case 'cut':
      default:
        return {
          type: 'cut',
          atMs: transition.atMs,
          durationMs: 0,
        };
    }
  }

  renderAll(transitions: TransitionDef[]): TransitionRenderData[] {
    return transitions.map((t) => this.render(t));
  }

  buildFFmpegFilterComplex(transitions: TransitionDef[], clipCount: number): string {
    const nonCuts = transitions.filter((t) => t.type !== 'cut');
    if (nonCuts.length === 0 || clipCount < 2) return '';

    const parts: string[] = [];
    let prev = '[0:v]';

    for (let i = 0; i < nonCuts.length && i < clipCount - 1; i++) {
      const t = nonCuts[i]!;
      const rendered = this.render(t);
      const next = `[${i + 1}:v]`;
      const out = i < nonCuts.length - 1 ? `[v${i}]` : '[vout]';
      parts.push(`${prev}${next}${rendered.filterComplex ?? 'xfade=fade'}${out}`);
      prev = out;
    }

    return parts.join('; ');
  }

  suggestTransitions(sequence: TimelineSequence): TransitionDef[] {
    const videoTrack = sequence.tracks.find((t) => t.type === 'video');
    if (!videoTrack || videoTrack.clips.length < 2) return [];

    return videoTrack.clips.slice(0, -1).map((clip) => ({
      type: 'cut' as const,
      durationMs: 0,
      atMs: clip.endMs,
    }));
  }
}
