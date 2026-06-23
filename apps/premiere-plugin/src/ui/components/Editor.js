import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useStore } from '../store/index.js';
import { TimelineManager } from '../../premiere/timeline.js';
import styles from './Editor.module.css';
const PLATFORMS = ['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS'];
const CAPTION_STYLES = ['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST'];
const DURATIONS = ['15', '30', '45', '60'];
const FORMATS = ['9:16', '16:9', '1:1'];
const TRANSITIONS = ['cut', 'zoomBlur', 'spin', 'glitch', 'filmBurn', 'breathe', 'dissolve', 'flash', 'zoom', 'dip'];
const TRANSITION_LABELS = {
    cut: 'Cut',
    zoomBlur: 'Zoom Blur',
    spin: 'Spin',
    glitch: 'Glitch',
    filmBurn: 'Film Burn',
    breathe: 'Breathe',
    dissolve: 'Dissolve',
    flash: 'Flash',
    zoom: 'Zoom Punch',
    dip: 'Dip Black',
};
export function Editor({ onNavigate }) {
    const { currentProject, activeProjectId, processingStatus, triggerAnalysis, applyEditPlan, loadProject, } = useStore();
    const [platform, setPlatform] = useState('TIKTOK');
    const [captionStyle, setCaptionStyle] = useState('TIKTOK');
    const [duration, setDuration] = useState('60');
    const [format, setFormat] = useState('9:16');
    const [transitionType, setTransitionType] = useState('zoomBlur');
    const [removeFillers, setRemoveFillers] = useState(true);
    const [removeSilence, setRemoveSilence] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [applyError, setApplyError] = useState('');
    const [applySuccess, setApplySuccess] = useState(false);
    const [selectedClipIndex, setSelectedClipIndex] = useState(0);
    const projectStatus = activeProjectId ? processingStatus[activeProjectId] : null;
    const clips = currentProject?.clips ?? [];
    const editPlan = currentProject?.editPlan;
    useEffect(() => {
        if (activeProjectId && !currentProject) {
            void loadProject(activeProjectId).catch(() => { });
        }
    }, [activeProjectId, currentProject, loadProject]);
    const handleAnalyze = async () => {
        if (!activeProjectId)
            return;
        await triggerAnalysis(activeProjectId, {
            targetDuration: duration,
            platform,
            captionStyle,
            removeFillers,
            removeSilence,
            removeRepetitions: true,
            format,
            transitionType,
        });
    };
    const handleApplyToTimeline = async () => {
        if (!activeProjectId)
            return;
        setIsApplying(true);
        setApplyError('');
        setApplySuccess(false);
        try {
            const result = await applyEditPlan(activeProjectId, selectedClipIndex);
            const tm = new TimelineManager();
            const keepSegments = result.editPlan.keepSegments;
            const videoNames = result.videos.map((v) => v.name);
            // Multi-video merge or single-video cut sequence
            if (result.videos.length > 1) {
                await tm.setupSequenceWithMultipleClips(videoNames, keepSegments);
            }
            else {
                await tm.setupSequenceWithSegments(videoNames[0] ?? currentProject?.name ?? 'ShortForge Clip', keepSegments);
            }
            // Captions and zooms are already relative to the final edited clip (start at 0)
            await tm.applyEditPlan({
                keepSegments,
                zooms: result.editPlan.zooms,
                captions: result.editPlan.captions,
                effects: result.editPlan.effects,
                format: result.editPlan.format,
                transitionType: result.editPlan.transitionType,
                transitionFrames: 15,
            });
            setApplySuccess(true);
            setTimeout(() => setApplySuccess(false), 3000);
        }
        catch (err) {
            setApplyError(err instanceof Error ? err.message : 'Failed to apply to timeline');
        }
        finally {
            setIsApplying(false);
        }
    };
    if (!activeProjectId) {
        return (_jsxs("div", { className: styles.empty, children: [_jsx("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1", children: _jsx("path", { d: "M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" }) }), _jsx("p", { children: "No project selected." }), _jsx("button", { className: "btn btn-primary", onClick: () => onNavigate('dashboard'), children: "Go to Dashboard" })] }));
    }
    return (_jsxs("div", { className: `${styles.container} scrollable`, children: [_jsxs("div", { className: styles.projectHeader, children: [_jsx("button", { className: styles.backBtn, onClick: () => onNavigate('dashboard'), children: "\u2190 Back" }), _jsx("span", { className: styles.projectName, children: currentProject?.name ?? 'Loading...' }), _jsx("span", { className: styles.projectStatus, children: currentProject?.status })] }), projectStatus?.status === 'analyzing' && (_jsxs("div", { className: styles.processingBanner, children: [_jsx("div", { className: styles.processingSpinner }), _jsxs("div", { children: [_jsx("strong", { children: projectStatus.message }), _jsx("div", { className: "progress-bar", style: { marginTop: 6, width: '100%' }, children: _jsx("div", { className: "progress-bar-fill", style: { width: `${projectStatus.progress}%` } }) })] })] })), projectStatus?.status === 'failed' && (_jsxs("div", { className: styles.processingBanner, style: { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }, children: [_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "#ef4444", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }), _jsx("strong", { style: { color: '#ef4444' }, children: projectStatus.message })] })), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "AI Settings" }), _jsxs("div", { className: styles.settingGroup, children: [_jsx("label", { children: "Target Platform" }), _jsx("div", { className: styles.chipGroup, children: PLATFORMS.map((p) => (_jsx("button", { className: `${styles.chip} ${platform === p ? styles.chipActive : ''}`, onClick: () => setPlatform(p), children: p === 'TIKTOK' ? 'TikTok' : p === 'INSTAGRAM_REELS' ? 'Instagram' : 'YouTube' }, p))) })] }), _jsxs("div", { className: styles.settingGroup, children: [_jsx("label", { children: "Caption Style" }), _jsx("div", { className: styles.chipGroup, children: CAPTION_STYLES.map((s) => (_jsx("button", { className: `${styles.chip} ${captionStyle === s ? styles.chipActive : ''}`, onClick: () => setCaptionStyle(s), children: s === 'HORMOZI' ? 'Hormozi' : s === 'GADZHI' ? 'Gadzhi' : s === 'MRBEAST' ? 'MrBeast' : 'TikTok' }, s))) })] }), _jsxs("div", { className: styles.settingGroup, children: [_jsx("label", { children: "Target Duration" }), _jsx("div", { className: styles.chipGroup, children: DURATIONS.map((d) => (_jsxs("button", { className: `${styles.chip} ${duration === d ? styles.chipActive : ''}`, onClick: () => setDuration(d), children: [d, "s"] }, d))) })] }), _jsxs("div", { className: styles.settingGroup, children: [_jsx("label", { children: "Output Format" }), _jsx("div", { className: styles.chipGroup, children: FORMATS.map((f) => (_jsx("button", { className: `${styles.chip} ${format === f ? styles.chipActive : ''}`, onClick: () => setFormat(f), children: f === '9:16' ? 'TikTok 9:16' : f === '1:1' ? 'Square 1:1' : 'Wide 16:9' }, f))) })] }), _jsxs("div", { className: styles.settingGroup, children: [_jsx("label", { children: "Transition Style" }), _jsx("div", { className: styles.chipGroup, children: TRANSITIONS.map((t) => (_jsx("button", { className: `${styles.chip} ${transitionType === t ? styles.chipActive : ''}`, onClick: () => setTransitionType(t), children: TRANSITION_LABELS[t] }, t))) })] }), _jsxs("div", { className: styles.toggleRow, children: [_jsxs("label", { className: styles.toggle, children: [_jsx("input", { type: "checkbox", checked: removeFillers, onChange: (e) => setRemoveFillers(e.target.checked) }), _jsx("span", { children: "Remove filler words (um, uh, like)" })] }), _jsxs("label", { className: styles.toggle, children: [_jsx("input", { type: "checkbox", checked: removeSilence, onChange: (e) => setRemoveSilence(e.target.checked) }), _jsx("span", { children: "Remove silences" })] })] })] }), _jsx("button", { className: `${styles.analyzeBtn} ${projectStatus?.status === 'analyzing' ? styles.disabled : ''}`, onClick: () => { void handleAnalyze(); }, disabled: projectStatus?.status === 'analyzing', children: projectStatus?.status === 'analyzing' ? (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.btnSpinner }), "Analyzing..."] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" }) }), "Analyze with AI"] })) }), clips.length > 0 && (_jsxs("div", { className: styles.section, children: [_jsxs("h3", { className: styles.sectionTitle, children: ["Generated Clips (", clips.length, ")"] }), _jsx("div", { className: styles.clipList, children: clips.map((clip, i) => (_jsxs("div", { className: `${styles.clipCard} ${selectedClipIndex === i ? styles.clipSelected : ''}`, onClick: () => setSelectedClipIndex(i), children: [_jsxs("div", { className: styles.clipRank, children: ["#", i + 1] }), _jsxs("div", { className: styles.clipInfo, children: [_jsx("span", { className: styles.clipTitle, children: clip.title ?? `Clip ${i + 1}` }), _jsxs("span", { className: styles.clipMeta, children: [formatMs(clip.durationMs), " \u00B7 ", clip.platform] })] }), _jsx("div", { className: styles.clipScores, children: _jsx(ViralScore, { score: clip.viralScore ?? 0 }) })] }, clip.id))) })] })), editPlan && (_jsxs("div", { className: styles.section, children: [_jsxs("div", { className: styles.editPlanHeader, children: [_jsx("h3", { className: styles.sectionTitle, children: "Edit Plan Ready" }), _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "var(--sf-success)", children: _jsx("path", { d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) })] }), editPlan.titleSuggestion && (_jsxs("div", { className: styles.suggestion, children: [_jsx("label", { children: "Suggested Title" }), _jsx("p", { children: editPlan.titleSuggestion })] })), applyError && _jsx("p", { className: styles.error, children: applyError }), applySuccess && (_jsx("div", { className: styles.success, children: "Edit plan applied to Premiere timeline!" })), _jsx("button", { className: styles.applyBtn, onClick: () => { void handleApplyToTimeline(); }, disabled: isApplying, children: isApplying ? (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.btnSpinner }), "Applying to Timeline..."] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M5 3l14 9-14 9V3z" }) }), "Apply to Premiere Timeline"] })) })] }))] }));
}
function ViralScore({ score }) {
    const level = score >= 70 ? 'high' : score >= 40 ? 'med' : 'low';
    return (_jsx("span", { className: `viral-badge ${level}`, children: score }));
}
function formatMs(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
