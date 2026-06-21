import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { projects, loadProjects, uploadVideo, setActiveProject, processingStatus, user } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleFileUpload = async (file: File) => {
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
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileUpload(file);
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
          accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
          className={styles.hiddenInput}
          onChange={(e) => e.target.files?.[0] && void handleFileUpload(e.target.files[0])}
        />

        {isUploading ? (
          <div className={styles.uploadingState}>
            <div className={styles.uploadSpinner} />
            <span>Uploading video...</span>
          </div>
        ) : (
          <div className={styles.uploadContent}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className={styles.uploadText}>Drop video here or click to browse</p>
            <p className={styles.uploadHint}>MP4, MOV, AVI, WebM · Up to 2GB</p>
          </div>
        )}
      </div>

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
