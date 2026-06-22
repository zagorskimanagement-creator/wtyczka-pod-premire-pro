import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Dashboard.module.css';
export function Dashboard({ onNavigate }) {
    const { projects, loadProjects, uploadVideo, setActiveProject, processingStatus, user } = useStore();
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef(null);
    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);
    const handleFileUpload = async (file) => {
        const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (!validTypes.includes(file.type)) {
            setUploadError('Invalid file type. Please upload MP4, MOV, AVI, or WebM.');
            return;
        }
        const maxSizeMB = 2000;
        if (file.size > maxSizeMB * 1024 * 1024) {
            setUploadError(`File too large. Maximum ${maxSizeMB}MB.`);
            return;
        }
        setIsUploading(true);
        setUploadError('');
        try {
            const projectName = file.name.replace(/\.[^.]+$/, '');
            const projectId = await uploadVideo(file, projectName, 'TIKTOK');
            setActiveProject(projectId);
            onNavigate('editor');
        }
        catch (err) {
            setUploadError('Upload failed. Please try again.');
        }
        finally {
            setIsUploading(false);
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file)
            void handleFileUpload(file);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const recentProjects = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
    return (_jsxs("div", { className: `${styles.container} scrollable`, children: [_jsxs("div", { className: styles.welcome, children: [_jsxs("h2", { children: ["Welcome back, ", user?.name?.split(' ')[0] ?? 'Creator'] }), _jsx("p", { children: "Upload a video to generate viral short-form content" })] }), _jsxs("div", { className: `${styles.uploadZone} ${isDragging ? styles.dragging : ''} ${isUploading ? styles.uploading : ''}`, onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: () => setIsDragging(false), onClick: () => !isUploading && fileInputRef.current?.click(), children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "video/mp4,video/quicktime,video/x-msvideo,video/webm", className: styles.hiddenInput, onChange: (e) => e.target.files?.[0] && void handleFileUpload(e.target.files[0]) }), isUploading ? (_jsxs("div", { className: styles.uploadingState, children: [_jsx("div", { className: styles.uploadSpinner }), _jsx("span", { children: "Uploading video..." })] })) : (_jsxs("div", { className: styles.uploadContent, children: [_jsx("svg", { width: "40", height: "40", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }), _jsx("p", { className: styles.uploadText, children: "Drop video here or click to browse" }), _jsx("p", { className: styles.uploadHint, children: "MP4, MOV, AVI, WebM \u00B7 Up to 2GB" })] }))] }), uploadError && _jsx("p", { className: styles.error, children: uploadError }), _jsxs("div", { className: styles.statsRow, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statValue, children: projects.length }), _jsx("span", { className: styles.statLabel, children: "Projects" })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statValue, children: projects.filter((p) => p.status === 'COMPLETED').length }), _jsx("span", { className: styles.statLabel, children: "Completed" })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statValue, children: projects.reduce((sum, p) => sum + (p.clips?.length ?? 0), 0) }), _jsx("span", { className: styles.statLabel, children: "Clips" })] })] }), recentProjects.length > 0 && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "Recent Projects" }), _jsx("div", { className: styles.projectList, children: recentProjects.map((project) => {
                            const status = processingStatus[project.id];
                            return (_jsxs("div", { className: styles.projectCard, onClick: () => {
                                    setActiveProject(project.id);
                                    onNavigate('editor');
                                }, children: [_jsxs("div", { className: styles.projectInfo, children: [_jsx("span", { className: styles.projectName, children: project.name }), _jsxs("span", { className: styles.projectMeta, children: [project.platform.replace('_', ' '), " \u00B7", ' ', project.videos[0]?.durationSeconds
                                                        ? formatDuration(project.videos[0].durationSeconds)
                                                        : 'Processing'] })] }), _jsx("div", { className: styles.projectStatus, children: status?.status === 'analyzing' ? (_jsxs("div", { className: styles.processingBadge, children: [_jsx("span", { className: styles.processingDot }), "Analyzing"] })) : (_jsx(StatusBadge, { status: project.status })) })] }, project.id));
                        }) })] })), recentProjects.length === 0 && !isUploading && (_jsxs("div", { className: styles.emptyState, children: [_jsx("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1", children: _jsx("path", { d: "M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" }) }), _jsx("p", { children: "No projects yet. Upload your first video to get started." })] }))] }));
}
function StatusBadge({ status }) {
    const statusConfig = {
        DRAFT: { label: 'Draft', className: styles.statusDraft },
        PROCESSING: { label: 'Processing', className: styles.statusProcessing },
        ANALYZED: { label: 'Analyzed', className: styles.statusAnalyzed },
        COMPLETED: { label: 'Ready', className: styles.statusCompleted },
        FAILED: { label: 'Failed', className: styles.statusFailed },
    };
    const config = statusConfig[status] ?? statusConfig['DRAFT'];
    return _jsx("span", { className: `${styles.statusBadge} ${config.className}`, children: config.label });
}
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
