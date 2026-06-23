function evalScript(script) {
    return new Promise((resolve) => {
        if (typeof CSInterface === 'undefined') {
            resolve(JSON.stringify({ error: 'Running outside Premiere Pro' }));
            return;
        }
        new CSInterface().evalScript(script, (result) => resolve(result ?? '{}'));
    });
}
function msToSRTTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const f = ms % 1000;
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(f, 3)}`;
}
function buildSRT(captions) {
    return captions
        .map((c, i) => `${i + 1}\n${msToSRTTime(c.startMs)} --> ${msToSRTTime(c.endMs)}\n${c.text}`)
        .join('\n\n');
}
export class TimelineManager {
    async importVideoToProject(filePath) {
        await evalScript(`importVideo(${JSON.stringify(filePath)})`);
    }
    async createNewSequence(name) {
        await evalScript(`createSequence(${JSON.stringify(name)})`);
    }
    async setupSequenceWithSegments(clipName, segments) {
        const result = await evalScript(`setupSequenceWithSegments(${JSON.stringify(clipName)}, ${JSON.stringify(JSON.stringify(segments))})`);
        const data = JSON.parse(result);
        if (data.error)
            throw new Error(`Could not set up sequence: ${data.error}`);
    }
    async setupSequenceWithMultipleClips(clipNames, segments) {
        const result = await evalScript(`setupSequenceWithMultipleClips(${JSON.stringify(JSON.stringify(clipNames))}, ${JSON.stringify(JSON.stringify(segments))})`);
        const data = JSON.parse(result);
        if (data.error)
            throw new Error(`Could not set up multi-clip sequence: ${data.error}`);
    }
    async reframeSequence(format) {
        await evalScript(`reframeSequence(${JSON.stringify(format)})`);
    }
    async applyEditPlan(instructions) {
        for (const zoom of instructions.zooms) {
            await evalScript(`applyZoom(${zoom.startMs}, ${zoom.endMs}, ${zoom.scale})`);
        }
        if (instructions.captions.length > 0) {
            const srt = buildSRT(instructions.captions);
            const result = await evalScript(`importCaptionsText(${JSON.stringify(srt)})`);
            const data = JSON.parse(result);
            if (data.error)
                console.warn('[ShortForge] Caption import failed:', data.error);
        }
        const transitionType = instructions.transitionType ?? 'cut';
        const frames = instructions.transitionFrames ?? 15;
        await evalScript(`applyTransitions(${JSON.stringify(transitionType)}, ${frames})`);
        if (instructions.format && instructions.format !== '16:9') {
            await this.reframeSequence(instructions.format);
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
