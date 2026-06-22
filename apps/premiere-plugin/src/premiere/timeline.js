export class TimelineManager {
    constructor() {
        this.ticksPerSecond = 254016000000;
    }
    getActiveSequence() {
        const sequence = app.project.activeSequence;
        if (!sequence)
            throw new Error('No active sequence. Please open a sequence in Premiere Pro.');
        return sequence;
    }
    msToTicks(ms) {
        return Math.round((ms / 1000) * this.ticksPerSecond).toString();
    }
    async importVideoToProject(filePath) {
        await app.project.importFiles([filePath], true, null, false);
    }
    async createNewSequence(name) {
        return app.project.sequences.createSequence(name, '');
    }
    async applyEditPlan(instructions) {
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
    async removeCut(_sequence, startMs, endMs) {
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
        }
        catch (err) {
            console.warn('[TimelineManager] Could not remove cut:', err);
        }
    }
    async applyZooms(sequence, zooms) {
        const videoTrack = sequence.videoTracks[0];
        if (!videoTrack)
            return;
        for (const zoom of zooms) {
            for (let i = 0; i < videoTrack.clips.length; i++) {
                const clip = videoTrack.clips[i];
                if (!clip)
                    continue;
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
                    }
                    catch (err) {
                        console.warn('[TimelineManager] Could not apply zoom:', err);
                    }
                }
            }
        }
    }
    async applyEffects(sequence, effects) {
        const videoTrack = sequence.videoTracks[0];
        if (!videoTrack)
            return;
        for (const effect of effects) {
            if (effect.type === 'color-grade') {
                for (let i = 0; i < videoTrack.clips.length; i++) {
                    const clip = videoTrack.clips[i];
                    if (!clip)
                        continue;
                    try {
                        clip.addVideoEffect('AE.ADBE Saturation');
                    }
                    catch (err) {
                        console.warn('[TimelineManager] Could not apply color grade:', err);
                    }
                }
            }
        }
    }
    async addCaptions(_sequence, captions) {
        for (const caption of captions) {
            try {
                console.warn(`[ShortForge] Adding caption: "${caption.text}" at ${caption.startMs}ms-${caption.endMs}ms`);
            }
            catch (err) {
                console.warn('[TimelineManager] Could not add caption:', err);
            }
        }
    }
    async setPlayheadPosition(timeMs) {
        const sequence = this.getActiveSequence();
        sequence.setPlayerPosition(this.msToTicks(timeMs));
    }
    async getCurrentPlayheadMs() {
        const sequence = this.getActiveSequence();
        const position = sequence.getPlayerPosition();
        return position.seconds * 1000;
    }
    getSequenceInfo() {
        try {
            const sequence = this.getActiveSequence();
            return {
                name: sequence.name,
                durationMs: sequence.duration.seconds * 1000,
                videoTrackCount: sequence.videoTracks.length,
            };
        }
        catch {
            return null;
        }
    }
}
