import type { EditPlan } from '@shortforge/ai-engine';
import { PLATFORM_SPECS } from '@shortforge/shared';
import type {
  BuiltTimeline,
  CaptionBlock,
  CutPoint,
  EffectDef,
  SequenceBuilderOptions,
  TimelineClip,
  TimelineSequence,
  TimelineTrack,
  TransitionDef,
  ZoomKeyframe,
} from './types.js';

export class SequenceBuilder {
  buildFromEditPlan(
    editPlan: EditPlan,
    mediaPath: string,
    sourceDurationMs: number,
    options: SequenceBuilderOptions,
  ): BuiltTimeline {
    const spec = PLATFORM_SPECS[options.platform];
    const cuts = this.buildCuts(editPlan);
    const segments = this.cutsToSegments(cuts, sourceDurationMs);
    const tracks = this.buildTracks(segments, mediaPath, options);
    const captions = this.buildCaptions(editPlan);
    const zooms = this.buildZooms(editPlan, cuts);
    const transitions = this.buildTransitions(editPlan, segments);
    const effects = this.buildEffects(editPlan, segments);

    const durationMs = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

    const sequence: TimelineSequence = {
      id: `seq_${Date.now()}`,
      name: 'ShortForge Export',
      durationMs,
      frameRate: options.frameRate,
      width: spec.width,
      height: spec.height,
      tracks,
    };

    const estimatedFileSizeMb = Math.round((durationMs / 1000) * 2.5);

    return { sequence, cuts, zooms, transitions, effects, captions, durationMs, estimatedFileSizeMb };
  }

  private buildCuts(editPlan: EditPlan): CutPoint[] {
    return editPlan.cuts.map((c) => ({
      startMs: c.startMs,
      endMs: c.endMs,
      reason: c.reason as CutPoint['reason'],
    }));
  }

  private cutsToSegments(cuts: CutPoint[], totalDurationMs: number): Array<{ start: number; end: number }> {
    const cutRanges = cuts.sort((a, b) => a.startMs - b.startMs);
    const segments: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const cut of cutRanges) {
      if (cut.startMs > cursor) segments.push({ start: cursor, end: cut.startMs });
      cursor = cut.endMs;
    }
    if (cursor < totalDurationMs) segments.push({ start: cursor, end: totalDurationMs });
    return segments;
  }

  private buildTracks(segments: Array<{ start: number; end: number }>, mediaPath: string, options: SequenceBuilderOptions): TimelineTrack[] {
    let timelineCursor = 0;
    const videoClips: TimelineClip[] = segments.map((seg, i) => {
      const clip: TimelineClip = {
        id: `clip_${i}`,
        startMs: timelineCursor,
        endMs: timelineCursor + (seg.end - seg.start),
        trackIndex: 0,
        mediaPath,
        mediaStartMs: seg.start,
        mediaEndMs: seg.end,
        volume: 1.0,
        speed: 1.0,
      };
      timelineCursor += seg.end - seg.start;
      return clip;
    });
    const tracks: TimelineTrack[] = [{ index: 0, type: 'video', clips: videoClips, locked: false, muted: false }];
    if (options.includeAudio) {
      tracks.push({ index: 1, type: 'audio', clips: videoClips.map((c) => ({ ...c, trackIndex: 1 })), locked: false, muted: false });
    }
    if (options.captionTrack) {
      tracks.push({ index: 2, type: 'caption', clips: [], locked: false, muted: false });
    }
    return tracks;
  }

  private buildCaptions(editPlan: EditPlan): CaptionBlock[] {
    return editPlan.captions.map((c, i) => ({
      id: `caption_${i}`,
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      style: c.style as CaptionBlock['style'],
      positionX: 0.5,
      positionY: c.positionY ?? 0.85,
      fontSize: c.fontSize ?? 48,
      colorHex: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2,
      animationType: (c.animation as CaptionBlock['animationType']) ?? 'pop',
      words: (c.words ?? []).map((w) => ({ word: w.word, startMs: w.startMs, endMs: w.endMs })),
    }));
  }

  private buildZooms(editPlan: EditPlan, cuts: CutPoint[]): ZoomKeyframe[] {
    const cutSet = new Set(cuts.map((c) => c.startMs));
    return editPlan.zooms.filter((z) => !cutSet.has(z.startMs)).flatMap((z) => {
      const durationMs = z.endMs - z.startMs;
      return [
        { timeMs: z.startMs, scale: 1.0, centerX: z.posX, centerY: z.posY, easingIn: 'ease-in-out' as const, easingOut: 'ease-in-out' as const },
        { timeMs: z.startMs + durationMs * 0.3, scale: z.scale, centerX: z.posX, centerY: z.posY, easingIn: 'ease-in-out' as const, easingOut: 'ease-in-out' as const },
        { timeMs: z.endMs, scale: 1.0, centerX: z.posX, centerY: z.posY, easingIn: 'ease-in-out' as const, easingOut: 'ease-in-out' as const },
      ];
    });
  }

  private buildTransitions(editPlan: EditPlan, segments: Array<{ start: number; end: number }>): TransitionDef[] {
    const transitions: TransitionDef[] = [];
    let cursor = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      cursor += segments[i]!.end - segments[i]!.start;
      const pt = editPlan.transitions[i];
      transitions.push({ type: (pt?.type as TransitionDef['type']) ?? 'cut', durationMs: pt?.durationMs ?? 0, atMs: cursor });
    }
    return transitions;
  }

  private buildEffects(editPlan: EditPlan, segments: Array<{ start: number; end: number }>): EffectDef[] {
    const totalDuration = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);
    const effects: EffectDef[] = (editPlan.effects ?? []).map((e) => ({
      type: e.type as EffectDef['type'],
      startMs: e.startMs,
      endMs: e.endMs,
      intensity: (e.params['intensity'] as number | undefined) ?? 1.0,
      params: e.params as Record<string, number | string | boolean>,
    }));
    if (!effects.some((e) => e.type === 'color-grade')) {
      effects.push({ type: 'color-grade', startMs: 0, endMs: totalDuration, intensity: 0.3 });
    }
    return effects;
  }
}
