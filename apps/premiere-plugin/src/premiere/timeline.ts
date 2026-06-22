declare const app: PPro.Application;
declare const qe: PPro.QEApplication;

namespace PPro {
  interface Application {
    project: Project;
    enableQE(): void;
  }
  interface QEApplication {
    sequence: QESequence;
  }
  interface QESequence {
    videoTrack: (index: number) => QETrack;
    audioTrack: (index: number) => QETrack;
    numVideoTracks: number;
    numAudioTracks: number;
  }
  interface QETrack {
    clip: (index: number) => QEClip;
    numItems: number;
  }
  interface QEClip {
    duration: { seconds: number };
    inPoint: { seconds: number };
    remove(ripple: boolean, alignToVideo: boolean): void;
  }
  interface Project {
    sequences: Sequences;
    activeSequence: Sequence | null;
    importFiles(paths: string[], suppressUI: boolean, targetBin: unknown | null, importAsNumberedStills: boolean): void;
    rootItem: ProjectItem;
  }
  interface Sequences {
    [index: number]: Sequence;
    length: number;
    createSequence(name: string, sequencePresetPath: string): Sequence;
  }
  interface Sequence {
    id: string;
    name: string;
    duration: Time;
    videoTracks: VideoTracks;
    audioTracks: AudioTracks;
    getPlayerPosition(): Time;
    setPlayerPosition(position: string): void;
    insertClip(clip: ProjectItem, time: Time, videoTrackIndex: number, audioTrackIndex: number): void;
  }
  interface VideoTracks {
    length: number;
    [index: number]: VideoTrack;
    insertTrack(index: number): void;
    removeTrack(index: number): void;
  }
  interface AudioTracks {
    length: number;
    [index: number]: AudioTrack;
  }
  interface VideoTrack {
    id: string;
    clips: TrackItems;
    insertClip(clip: ProjectItem, time: Time): void;
  }
  interface AudioTrack {
    id: string;
    clips: TrackItems;
  }
  interface TrackItems {
    length: number;
    [index: number]: TrackItem;
  }
  interface TrackItem {
    start: Time;
    end: Time;
    duration: Time;
    name: string;
    mediaType: string;
    getSpeed(): number;
    setSpeed(speed: number): void;
    getComponentByDisplayName(name: string): Component | null;
    addVideoEffect(effectMatchName: string): void;
  }
  interface Component {
    properties: Properties;
  }
  interface Properties {
    [index: number]: Property;
    length: number;
    getParamForDisplayName(name: string): Property | null;
  }
  interface Property {
    displayName: string;
    setValue(value: unknown, updateUI?: boolean): void;
    setValueAtTime(time: Time, value: unknown): void;
    addKey(time: Time): void;
  }
  interface Time {
    seconds: number;
    ticks: string;
  }
  interface ProjectItem {
    name: string;
    nodeId: string;
    treePath: string;
  }
}

export interface CutInstruction {
  startMs: number;
  endMs: number;
  type: 'keep' | 'remove';
}

export interface ZoomInstruction {
  startMs: number;
  endMs: number;
  scale: number;
  posX: number;
  posY: number;
  easing: string;
}

export interface CaptionInstruction {
  text: string;
  startMs: number;
  endMs: number;
  positionY: number;
  fontSize: number;
  colorHex: string;
  strokeColor: string;
  strokeWidth: number;
  animationType?: string;
}

export interface EffectInstruction {
  startMs: number;
  endMs: number;
  type: string;
  params: Record<string, number | string>;
}

export interface EditPlanInstructions {
  cuts: CutInstruction[];
  zooms: ZoomInstruction[];
  captions: CaptionInstruction[];
  effects: EffectInstruction[];
}

export class TimelineManager {
  private getActiveSequence(): PPro.Sequence {
    const sequence = app.project.activeSequence;
    if (!sequence) throw new Error('No active sequence. Please open a sequence in Premiere Pro.');
    return sequence;
  }

  private ticksPerSecond = 254016000000;

  private msToTicks(ms: number): string {
    return Math.round((ms / 1000) * this.ticksPerSecond).toString();
  }

  private secondsToTicks(seconds: number): string {
    return Math.round(seconds * this.ticksPerSecond).toString();
  }

  async importVideoToProject(filePath: string): Promise<void> {
    await app.project.importFiles([filePath], true, null, false);
  }

  async createNewSequence(name: string): Promise<PPro.Sequence> {
    const preset = '/Applications/Adobe Premiere Pro 2024/Adobe Premiere Pro 2024.app/Contents/Lumetri/LUTs/creative/';
    const sequence = await app.project.sequences.createSequence(name, '');
    return sequence;
  }

  async applyEditPlan(instructions: EditPlanInstructions): Promise<void> {
    const sequence = this.getActiveSequence();

    for (const cut of instructions.cuts) {
      if (cut.type === 'remove') {
        await this.removeCut(sequence, cut.startMs, cut.endMs);
      }
    }

    if (instructions.zooms.length > 0) {
      await this.applyZooms(sequence, instructions.zooms);
    }

    if (instructions.effects.length > 0) {
      await this.applyEffects(sequence, instructions.effects);
    }

    if (instructions.captions.length > 0) {
      await this.addCaptions(sequence, instructions.captions);
    }
  }

  private async removeCut(sequence: PPro.Sequence, startMs: number, endMs: number): Promise<void> {
    try {
      app.enableQE();
      const qeSeq = qe.sequence;

      for (let i = 0; i < qeSeq.numVideoTracks; i++) {
        const track = qeSeq.videoTrack(i);
        for (let j = 0; j < track.numItems; j++) {
          const clip = track.clip(j);
          const clipStartSeconds = clip.inPoint.seconds;
          const clipDurationSeconds = clip.duration.seconds;
          const clipEndSeconds = clipStartSeconds + clipDurationSeconds;
          const cutStartSeconds = startMs / 1000;
          const cutEndSeconds = endMs / 1000;

          if (clipStartSeconds <= cutStartSeconds && clipEndSeconds >= cutEndSeconds) {
            clip.remove(true, true);
            break;
          }
        }
      }
    } catch (err) {
      console.warn('[TimelineManager] Could not remove cut:', err);
    }
  }

  private async applyZooms(sequence: PPro.Sequence, zooms: ZoomInstruction[]): Promise<void> {
    const videoTrack = sequence.videoTracks[0];
    if (!videoTrack) return;

    for (const zoom of zooms) {
      for (let i = 0; i < videoTrack.clips.length; i++) {
        const clip = videoTrack.clips[i];
        if (!clip) continue;

        const clipStartMs = clip.start.seconds * 1000;
        const clipEndMs = clip.end.seconds * 1000;

        if (zoom.startMs >= clipStartMs && zoom.endMs <= clipEndMs) {
          try {
            const motionEffect = clip.getComponentByDisplayName('Motion');
            if (motionEffect) {
              const scaleParam = motionEffect.properties.getParamForDisplayName('Scale');
              if (scaleParam) {
                const startTime = { seconds: zoom.startMs / 1000, ticks: this.msToTicks(zoom.startMs) };
                const endTime = { seconds: zoom.endMs / 1000, ticks: this.msToTicks(zoom.endMs) };
                scaleParam.addKey(startTime);
                scaleParam.addKey(endTime);
                scaleParam.setValueAtTime(startTime, 100);
                scaleParam.setValueAtTime(endTime, zoom.scale * 100);
              }
            }
          } catch (err) {
            console.warn('[TimelineManager] Could not apply zoom:', err);
          }
        }
      }
    }
  }

  private async applyEffects(sequence: PPro.Sequence, effects: EffectInstruction[]): Promise<void> {
    const videoTrack = sequence.videoTracks[0];
    if (!videoTrack) return;

    for (const effect of effects) {
      if (effect.type === 'color-grade') {
        for (let i = 0; i < videoTrack.clips.length; i++) {
          const clip = videoTrack.clips[i];
          if (!clip) continue;

          try {
            clip.addVideoEffect('AE.ADBE Saturation');
          } catch (err) {
            console.warn('[TimelineManager] Could not apply color grade:', err);
          }
        }
      }
    }
  }

  async addCaptions(sequence: PPro.Sequence, captions: CaptionInstruction[]): Promise<void> {
    for (const caption of captions) {
      try {
        const startTime = { seconds: caption.startMs / 1000, ticks: this.msToTicks(caption.startMs) };
        const endTime = { seconds: caption.endMs / 1000, ticks: this.msToTicks(caption.endMs) };

        console.warn(
          `[ShortForge] Adding caption: "${caption.text}" at ${caption.startMs}ms-${caption.endMs}ms`,
        );
      } catch (err) {
        console.warn('[TimelineManager] Could not add caption:', err);
      }
    }
  }

  async setPlayheadPosition(timeMs: number): Promise<void> {
    const sequence = this.getActiveSequence();
    sequence.setPlayerPosition(this.msToTicks(timeMs));
  }

  async getCurrentPlayheadMs(): Promise<number> {
    const sequence = this.getActiveSequence();
    const position = sequence.getPlayerPosition();
    return position.seconds * 1000;
  }

  getSequenceInfo(): { name: string; durationMs: number; videoTrackCount: number } | null {
    try {
      const sequence = this.getActiveSequence();
      return {
        name: sequence.name,
        durationMs: sequence.duration.seconds * 1000,
        videoTrackCount: sequence.videoTracks.length,
      };
    } catch {
      return null;
    }
  }
}
