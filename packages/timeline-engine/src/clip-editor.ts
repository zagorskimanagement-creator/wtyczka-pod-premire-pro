import type { TimelineClip, TimelineSequence, ClipEditOperation } from './types.js';

export class ClipEditor {
  trimClip(
    sequence: TimelineSequence,
    clipId: string,
    newStartMs: number,
    newEndMs: number,
  ): TimelineSequence {
    return this.mapClip(sequence, clipId, (clip) => {
      const trimStart = newStartMs - clip.startMs;
      const trimEnd = clip.endMs - newEndMs;
      return {
        ...clip,
        startMs: newStartMs,
        endMs: newEndMs,
        mediaStartMs: clip.mediaStartMs + trimStart,
        mediaEndMs: clip.mediaEndMs - trimEnd,
      };
    });
  }

  splitClip(sequence: TimelineSequence, clipId: string, splitAtMs: number): TimelineSequence {
    let splitClip: TimelineClip | undefined;
    let trackIndex = -1;
    let clipIndex = -1;

    for (let ti = 0; ti < sequence.tracks.length; ti++) {
      const track = sequence.tracks[ti]!;
      for (let ci = 0; ci < track.clips.length; ci++) {
        if (track.clips[ci]!.id === clipId) {
          splitClip = track.clips[ci]!;
          trackIndex = ti;
          clipIndex = ci;
          break;
        }
      }
    }

    if (!splitClip || splitAtMs <= splitClip.startMs || splitAtMs >= splitClip.endMs) {
      return sequence;
    }

    const mediaOffset = splitAtMs - splitClip.startMs;
    const partA: TimelineClip = {
      ...splitClip,
      id: `${splitClip.id}_a`,
      endMs: splitAtMs,
      mediaEndMs: splitClip.mediaStartMs + mediaOffset,
    };
    const partB: TimelineClip = {
      ...splitClip,
      id: `${splitClip.id}_b`,
      startMs: splitAtMs,
      mediaStartMs: splitClip.mediaStartMs + mediaOffset,
    };

    const newTracks = sequence.tracks.map((track, ti) => {
      if (ti !== trackIndex) return track;
      const newClips = [...track.clips];
      newClips.splice(clipIndex, 1, partA, partB);
      return { ...track, clips: newClips };
    });

    return { ...sequence, tracks: newTracks };
  }

  deleteClip(sequence: TimelineSequence, clipId: string): TimelineSequence {
    const newTracks = sequence.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== clipId),
    }));
    return { ...sequence, tracks: newTracks };
  }

  moveClip(sequence: TimelineSequence, clipId: string, newStartMs: number): TimelineSequence {
    return this.mapClip(sequence, clipId, (clip) => {
      const duration = clip.endMs - clip.startMs;
      return { ...clip, startMs: newStartMs, endMs: newStartMs + duration };
    });
  }

  setClipSpeed(sequence: TimelineSequence, clipId: string, speed: number): TimelineSequence {
    return this.mapClip(sequence, clipId, (clip) => {
      const duration = (clip.endMs - clip.startMs) / speed;
      return { ...clip, speed, endMs: clip.startMs + duration };
    });
  }

  setClipVolume(sequence: TimelineSequence, clipId: string, volume: number): TimelineSequence {
    return this.mapClip(sequence, clipId, (clip) => ({ ...clip, volume }));
  }

  applyOperation(sequence: TimelineSequence, op: ClipEditOperation): TimelineSequence {
    switch (op.type) {
      case 'trim':
        return this.trimClip(
          sequence,
          op.clipId,
          op.params['startMs'] as number,
          op.params['endMs'] as number,
        );
      case 'split':
        return this.splitClip(sequence, op.clipId, op.params['splitAtMs'] as number);
      case 'delete':
        return this.deleteClip(sequence, op.clipId);
      case 'move':
        return this.moveClip(sequence, op.clipId, op.params['startMs'] as number);
      case 'speed':
        return this.setClipSpeed(sequence, op.clipId, op.params['speed'] as number);
      case 'volume':
        return this.setClipVolume(sequence, op.clipId, op.params['volume'] as number);
      default:
        return sequence;
    }
  }

  applyOperations(sequence: TimelineSequence, ops: ClipEditOperation[]): TimelineSequence {
    return ops.reduce((seq, op) => this.applyOperation(seq, op), sequence);
  }

  reorderClips(sequence: TimelineSequence, trackIndex: number): TimelineSequence {
    const newTracks = sequence.tracks.map((track, i) => {
      if (i !== trackIndex) return track;
      const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
      return { ...track, clips: sorted };
    });
    return { ...sequence, tracks: newTracks };
  }

  private mapClip(
    sequence: TimelineSequence,
    clipId: string,
    fn: (clip: TimelineClip) => TimelineClip,
  ): TimelineSequence {
    const newTracks = sequence.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? fn(clip) : clip)),
    }));
    return { ...sequence, tracks: newTracks };
  }
}
