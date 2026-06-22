import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '../store/index.js';
import { apiClient } from '../../api/client.js';
import styles from './ExportPanel.module.css';
const RESOLUTIONS = {
    TIKTOK: '1080x1920',
    INSTAGRAM_REELS: '1080x1920',
    YOUTUBE_SHORTS: '1080x1920',
};
export function ExportPanel({ onNavigate }) {
    const { currentProject } = useStore();
    const [platform, setPlatform] = useState('TIKTOK');
    const [quality, setQuality] = useState('high');
    const [burnCaptions, setBurnCaptions] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [, setExportId] = useState(null);
    const [exportStatus, setExportStatus] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [error, setError] = useState('');
    const clips = currentProject?.clips ?? [];
    const selectedClip = clips[0];
    const handleExport = async () => {
        if (!selectedClip)
            return;
        setIsExporting(true);
        setError('');
        setExportStatus(null);
        setDownloadUrl(null);
        try {
            const response = await apiClient.post('/export', {
                clipId: selectedClip.id,
                platform,
                resolution: RESOLUTIONS[platform],
                quality,
                burnCaptions,
            });
            setExportId(response.exportId);
            setExportStatus('pending');
            const pollExport = async () => {
                try {
                    const status = await apiClient.get(`/export/${response.exportId}`);
                    setExportStatus(status.status);
                    if (status.status === 'COMPLETED') {
                        setDownloadUrl(status.downloadUrl);
                        setIsExporting(false);
                    }
                    else if (status.status === 'FAILED') {
                        setError(status.errorMessage ?? 'Export failed');
                        setIsExporting(false);
                    }
                    else {
                        setTimeout(() => { void pollExport(); }, 5000);
                    }
                }
                catch {
                    setError('Failed to check export status');
                    setIsExporting(false);
                }
            };
            setTimeout(() => { void pollExport(); }, 3000);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
            setIsExporting(false);
        }
    };
    return (_jsxs("div", { className: `${styles.container} scrollable`, children: [_jsxs("div", { className: styles.header, children: [_jsx("button", { className: styles.backBtn, onClick: () => onNavigate('editor'), children: "\u2190 Editor" }), _jsx("h2", { children: "Export" })] }), !selectedClip ? (_jsxs("div", { className: styles.empty, children: [_jsx("p", { children: "No clips available. Analyze a video first." }), _jsx("button", { className: "btn btn-primary", onClick: () => onNavigate('editor'), children: "Go to Editor" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.clipPreview, children: [_jsxs("div", { className: styles.clipInfo, children: [_jsx("span", { className: styles.clipName, children: selectedClip.title ?? 'Clip 1' }), _jsx("span", { className: styles.clipDuration, children: formatMs(selectedClip.durationMs) })] }), selectedClip.viralScore && (_jsxs("span", { className: `viral-badge ${selectedClip.viralScore >= 70 ? 'high' : 'med'}`, children: [selectedClip.viralScore, " viral score"] }))] }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "Platform" }), _jsx("div", { className: styles.platformGrid, children: [
                                    { id: 'TIKTOK', label: 'TikTok', icon: '♪' },
                                    { id: 'INSTAGRAM_REELS', label: 'Reels', icon: '◎' },
                                    { id: 'YOUTUBE_SHORTS', label: 'Shorts', icon: '▶' },
                                ].map((p) => (_jsxs("button", { className: `${styles.platformCard} ${platform === p.id ? styles.platformSelected : ''}`, onClick: () => setPlatform(p.id), children: [_jsx("span", { className: styles.platformIcon, children: p.icon }), _jsx("span", { children: p.label }), _jsx("span", { className: styles.platformRes, children: "1080\u00D71920" })] }, p.id))) })] }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "Quality" }), _jsx("div", { className: styles.qualityRow, children: ['high', 'medium', 'low'].map((q) => (_jsx("button", { className: `${styles.qualityBtn} ${quality === q ? styles.qualitySelected : ''}`, onClick: () => setQuality(q), children: q.charAt(0).toUpperCase() + q.slice(1) }, q))) })] }), _jsx("div", { className: styles.section, children: _jsxs("label", { className: styles.toggle, children: [_jsx("input", { type: "checkbox", checked: burnCaptions, onChange: (e) => setBurnCaptions(e.target.checked) }), _jsxs("div", { children: [_jsx("span", { className: styles.toggleLabel, children: "Burn-in Captions" }), _jsx("span", { className: styles.toggleDesc, children: "Permanently embed captions into video" })] })] }) }), error && _jsx("p", { className: styles.error, children: error }), exportStatus === 'COMPLETED' && downloadUrl ? (_jsxs("div", { className: styles.successSection, children: [_jsx("div", { className: styles.successIcon, children: _jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "var(--sf-success)", children: _jsx("path", { d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsx("p", { className: styles.successText, children: "Export complete!" }), _jsxs("a", { href: downloadUrl, className: styles.downloadBtn, target: "_blank", rel: "noreferrer", children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }), "Download Video"] })] })) : (_jsx("button", { className: styles.exportBtn, onClick: () => { void handleExport(); }, disabled: isExporting, children: isExporting ? (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.spinner }), exportStatus === 'pending' ? 'Queued...' : 'Exporting...'] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }), "Export for ", platform === 'TIKTOK' ? 'TikTok' : platform === 'INSTAGRAM_REELS' ? 'Instagram' : 'YouTube'] })) }))] }))] }));
}
function formatMs(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
