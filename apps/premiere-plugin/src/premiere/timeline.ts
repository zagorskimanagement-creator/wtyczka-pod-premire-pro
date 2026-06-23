// CSInterface is loaded via <script src="./CSInterface.js"> in index.html
declare const CSInterface: new () => {
  evalScript(script: string, callback?: (result: string) => void): void;
};

export interface KeepSegment {
  startMs: number;
  endMs: number;
  clipIndex?: number;
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
  keepSegments: KeepSegment[];
  zooms: ZoomInstruction[];
  captions: CaptionInstruction[];
  effects: EffectInstruction[];
  format?: '9:16' | '16:9' | '1:1';
  transitionType?: 'cut' | 'dissolve' | 'zoom' | 'flash' | 'dip' | 'zoomBlur' | 'spin' | 'slide' | 'shake' | 'glitch';
  transitionFrames?: number;
}

function evalScript(script: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof CSInterface === 'undefined') {
      resolve(JSON.stringify({ error: 'Running outside Premiere Pro' }));
      return;
    }
    new CSInterface().evalScript(script, (result) => resolve(result ?? '{}'));
  });
}

function msToSRTTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = ms % 1000;
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(f, 3)}`;
}

function buildSRT(captions: CaptionInstruction[]): string {
  return captions
    .map((c, i) => `${i + 1}\n${msToSRTTime(c.startMs)} --> ${msToSRTTime(c.endMs)}\n${c.text}`)
    .join('\n\n');
}

export class TimelineManager {
  async importVideoToProject(filePath: string): Promise<void> {
    await evalScript(`importVideo(${JSON.stringify(filePath)})`);
  }

  async createNewSequence(name: string): Promise<void> {
    await evalScript(`createSequence(${JSON.stringify(name)})`);
  }

  async setupSequenceWithSegments(clipName: string, segments: KeepSegment[]): Promise<void> {
    const result = await evalScript(
      `setupSequenceWithSegments(${JSON.stringify(clipName)}, ${JSON.stringify(JSON.stringify(segments))})`,
    );
    const data = JSON.parse(result) as { error?: string };
    if (data.error) throw new Error(`Could not set up sequence: ${data.error}`);
  }

  async setupSequenceWithMultipleClips(clipNames: string[], segments: KeepSegment[]): Promise<void> {
    const result = await evalScript(
      `setupSequenceWithMultipleClips(${JSON.stringify(JSON.stringify(clipNames))}, ${JSON.stringify(JSON.stringify(segments))})`,
    );
    const data = JSON.parse(result) as { error?: string };
    if (data.error) throw new Error(`Could not set up multi-clip sequence: ${data.error}`);
  }

  async reframeSequence(format: '9:16' | '16:9' | '1:1'): Promise<void> {
    await evalScript(`reframeSequence(${JSON.stringify(format)})`);
  }

  async applyEditPlan(instructions: EditPlanInstructions): Promise<void> {
    for (const zoom of instructions.zooms) {
      await evalScript(`applyZoom(${zoom.startMs}, ${zoom.endMs}, ${zoom.scale})`);
    }

    if (instructions.captions.length > 0) {
      const srt = buildSRT(instructions.captions);
      const result = await evalScript(`importCaptionsText(${JSON.stringify(srt)})`);
      const data = JSON.parse(result) as { error?: string };
      if (data.error) console.warn('[ShortForge] Caption import failed:', data.error);
    }

    const transitionType = instructions.transitionType ?? 'cut';
    const frames = instructions.transitionFrames ?? 15;
    await evalScript(`applyTransitions(${JSON.stringify(transitionType)}, ${frames})`);

    if (instructions.format && instructions.format !== '16:9') {
      await this.reframeSequence(instructions.format);
    }
  }

  async setPlayheadPosition(timeMs: number): Promise<void> {
    await evalScript(`setPlayheadPosition(${timeMs})`);
  }

  async getCurrentPlayheadMs(): Promise<number> {
    const result = await evalScript('getCurrentPlayheadMs()');
    try { return (JSON.parse(result) as { ms?: number }).ms ?? 0; } catch { return 0; }
  }

  async getSequenceInfo(): Promise<{ name: string; durationMs: number; videoTrackCount: number } | null> {
    const result = await evalScript('getActiveSequenceInfo()');
    try {
      const data = JSON.parse(result) as { error?: string; name?: string; durationMs?: number; videoTrackCount?: number };
      if (data.error) return null;
      return {
        name: data.name ?? '',
        durationMs: data.durationMs ?? 0,
        videoTrackCount: data.videoTrackCount ?? 0,
      };
    } catch { return null; }
  }
}
