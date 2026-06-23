function evalScript(script) {
    return new Promise((resolve) => {
        if (typeof CSInterface === 'undefined') {
            resolve(JSON.stringify({ error: 'Running outside Premiere Pro' }));
            return;
        }
        new CSInterface().evalScript(script, (result) => resolve(result ?? '{}'));
    });
}
export class TimelineManager {
    async importVideoToProject(filePath) {
        await evalScript(`importVideo(${JSON.stringify(filePath)})`);
    }
    async createNewSequence(name) {
        await evalScript(`createSequence(${JSON.stringify(name)})`);
    }
    async setupSequenceWithClip(clipName, startMs, endMs) {
        const result = await evalScript(`setupSequenceWithClip(${JSON.stringify(clipName)}, ${startMs}, ${endMs})`);
        const data = JSON.parse(result);
        if (data.error)
            throw new Error(`Could not set up sequence: ${data.error}`);
    }
    async applyEditPlan(instructions) {
        // Cuts are handled via in/out points at sequence creation — skip removeCut
        for (const zoom of instructions.zooms) {
            await evalScript(`applyZoom(${zoom.startMs}, ${zoom.endMs}, ${zoom.scale})`);
        }
        for (const caption of instructions.captions) {
            console.log(`[ShortForge] Caption: "${caption.text}" ${caption.startMs}-${caption.endMs}ms`);
        }
    }
    async setPlayheadPosition(timeMs) {
        await evalScript(`setPlayheadPosition(${timeMs})`);
    }
    async getCurrentPlayheadMs() {
        const result = await evalScript('getCurrentPlayheadMs()');
        try {
            return JSON.parse(result).ms ?? 0;
        }
        catch {
            return 0;
        }
    }
    async getSequenceInfo() {
        const result = await evalScript('getActiveSequenceInfo()');
        try {
            const data = JSON.parse(result);
            if (data.error)
                return null;
            return {
                name: data.name ?? '',
                durationMs: data.durationMs ?? 0,
                videoTrackCount: data.videoTrackCount ?? 0,
            };
        }
        catch {
            return null;
        }
    }
}
