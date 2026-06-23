// CSInterface is loaded via <script src="./CSInterface.js"> in index.html
declare const CSInterface: new () => {
  evalScript(script: string, callback?: (result: string) => void): void;
};

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

function evalScript(script: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof CSInterface === 'undefined') {
      resolve(JSON.stringify({ error: 'Running outside Premiere Pro' }));
      return;
    }
    new CSInterface().evalScript(script, (result) => resolve(result ?? '{}'));
  });
}

export class TimelineManager {
  async importVideoToProject(filePath: string): Promise<void> {
    await evalScript(`importVideo(${JSON.stringify(filePath)})`);
  }

  async createNewSequence(name: string): Promise<void> {
    await evalScript(`createSequence(${JSON.stringify(name)})`);
  }

  async ensureSequenceExists(clipName: string): Promise<void> {
    const info = await this.getSequenceInfo();
    if (info) return;
    const result = await evalScript(`createSequenceFromClip(${JSON.stringify(clipName)})`);
    const data = JSON.parse(result) as { error?: string };
    if (data.error) throw new Error(`Could not create sequence: ${data.error}`);
  }

  async applyEditPlan(instructions: EditPlanInstructions): Promise<void> {
    for (const cut of instructions.cuts) {
      if (cut.type === 'remove') {
        await evalScript(`removeCut(${cut.startMs}, ${cut.endMs})`);
      }
    }
    for (const zoom of instructions.zooms) {
      await evalScript(`applyZoom(${zoom.startMs}, ${zoom.endMs}, ${zoom.scale})`);
    }
    for (const caption of instructions.captions) {
      console.log(`[ShortForge] Caption: "${caption.text}" ${caption.startMs}-${caption.endMs}ms`);
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
