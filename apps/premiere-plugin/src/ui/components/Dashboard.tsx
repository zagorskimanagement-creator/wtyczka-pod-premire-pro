import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { projects, loadProjects, uploadVideos, setActiveProject, processingStatus, user } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProjects().catch(() => {});
  }, [loadProjects]);

  const validExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];

  const stageFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      return validExts.includes(ext);
    });
    if (valid.length === 0) {
      setUploadError('No valid video files. Use MP4, MOV, AVI, MKV, or WebM.');
      return;
    }
    setUploadError('');
    setStagedFiles((prev) => {
      const merged = [...prev, ...valid];
      if (!projectName) setProjectName(merged[0]?.name.replace(/\.[^.]+$/, '') ?? '');
      return merged;
    });
  };

  const handleCreateProject = async () => {
    if (stagedFiles.length === 0) return;
    setIsUploading(true);
    setUploadError('');
    const name = projectName.trim() || stagedFiles[0].name.replace(/\.[^.]+$/, '');
    const projectId = await uploadVideos(stagedFiles, name, 'TIKTOK');
    setStagedFiles([]);
    setProjectName('');
    setActiveProject(projectId);
    setIsUploading(false);
    onNavigate('editor');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) stageFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const recentProjects = [...projects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ).slice(0, 10);

  return (
    <div className={`${styles.container} scrollable`}>
      <div className={styles.welcome}>
        <h2>Welcome back, {user?.name?.split(' ')[0] ?? 'Creator'}</h2>
        <p>Upload a video to generate viral short-form content</p>
      </div>

      <div
        className={`${styles.uploadZone} ${isDragging ? styles.dragging : ''} ${isUploading ? styles.uploading : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.avi,.webm,.mkv"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => e.target.files && stageFiles(e.target.files)}
        />

        {isUploading ? (
          <div className={styles.uploadingState}>
            <div className={styles.uploadSpinner} />
            <span>Creating project...</span>
          </div>
        ) : (
          <div className={styles.uploadContent}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className={styles.uploadText}>Drop videos here or click to browse</p>
            <p className={styles.uploadHint}>MP4, MOV, AVI, WebM · select multiple to merge</p>
          </div>
        )}
      </div>

      {stagedFiles.length > 0 && (
        <div className={styles.stagedFiles}>
          <div className={styles.stagedList}>
            {stagedFiles.map((f, i) => (
              <div key={i} className={styles.stagedItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>
                <span>{f.name}</span>
                <button onClick={() => setStagedFiles((p) => p.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          <input
            className={styles.projectNameInput}
            placeholder="Project name..."
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button className={styles.createBtn} onClick={() => { void handleCreateProject(); }}>
            {stagedFiles.length > 1 ? `Merge ${stagedFiles.length} Videos & Create Project` : 'Create Project'}
          </button>
        </div>
      )}

      {uploadError && <p className={styles.error}>{uploadError}</p>}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{projects.length}</span>
          <span className={styles.statLabel}>Projects</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {projects.filter((p) => p.status === 'COMPLETED').length}
          </span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {projects.reduce((sum, p) => sum + (p.clips?.length ?? 0), 0)}
          </span>
          <span className={styles.statLabel}>Clips</span>
        </div>
      </div>

      {recentProjects.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Recent Projects</h3>
          <div className={styles.projectList}>
            {recentProjects.map((project) => {
              const status = processingStatus[project.id];
              return (
                <div
                  key={project.id}
                  className={styles.projectCard}
                  onClick={() => {
                    setActiveProject(project.id);
                    onNavigate('editor');
                  }}
                >
                  <div className={styles.projectInfo}>
                    <span className={styles.projectName}>{project.name}</span>
                    <span className={styles.projectMeta}>
                      {project.platform.replace('_', ' ')} ·{' '}
                      {project.videos[0]?.durationSeconds
                        ? formatDuration(project.videos[0].durationSeconds)
                        : 'Processing'}
                    </span>
                  </div>
                  <div className={styles.projectStatus}>
                    {status?.status === 'analyzing' ? (
                      <div className={styles.processingBadge}>
                        <span className={styles.processingDot} />
                        Analyzing
                      </div>
                    ) : (
                      <StatusBadge status={project.status} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentProjects.length === 0 && !isUploading && (
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p>No projects yet. Upload your first video to get started.</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: styles.statusDraft },
    PROCESSING: { label: 'Processing', className: styles.statusProcessing },
    ANALYZED: { label: 'Analyzed', className: styles.statusAnalyzed },
    COMPLETED: { label: 'Ready', className: styles.statusCompleted },
    FAILED: { label: 'Failed', className: styles.statusFailed },
  };

  const config = statusConfig[status] ?? statusConfig['DRAFT'];
  return <span className={`${styles.statusBadge} ${config.className}`}>{config.label}</span>;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
