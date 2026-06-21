import React, { useState } from 'react';
import { useStore } from '../store/index.js';
import { apiClient } from '../../api/client.js';
import styles from './ExportPanel.module.css';

interface ExportPanelProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

const RESOLUTIONS = {
  TIKTOK: '1080x1920',
  INSTAGRAM_REELS: '1080x1920',
  YOUTUBE_SHORTS: '1080x1920',
} as const;

export function ExportPanel({ onNavigate }: ExportPanelProps) {
  const { currentProject, activeExports } = useStore();
  const [platform, setPlatform] = useState<'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS'>('TIKTOK');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const clips = currentProject?.clips ?? [];
  const selectedClip = clips[0];

  const handleExport = async () => {
    if (!selectedClip) return;

    setIsExporting(true);
    setError('');
    setExportStatus(null);
    setDownloadUrl(null);

    try {
      const response = await apiClient.post<{ exportId: string }>('/export', {
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
          const status = await apiClient.get<{
            status: string;
            downloadUrl: string | null;
            errorMessage: string | null;
          }>(`/export/${response.exportId}`);

          setExportStatus(status.status);

          if (status.status === 'COMPLETED') {
            setDownloadUrl(status.downloadUrl);
            setIsExporting(false);
          } else if (status.status === 'FAILED') {
            setError(status.errorMessage ?? 'Export failed');
            setIsExporting(false);
          } else {
            setTimeout(() => { void pollExport(); }, 5000);
          }
        } catch {
          setError('Failed to check export status');
          setIsExporting(false);
        }
      };

      setTimeout(() => { void pollExport(); }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setIsExporting(false);
    }
  };

  return (
    <div className={`${styles.container} scrollable`}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => onNavigate('editor')}>← Editor</button>
        <h2>Export</h2>
      </div>

      {!selectedClip ? (
        <div className={styles.empty}>
          <p>No clips available. Analyze a video first.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('editor')}>
            Go to Editor
          </button>
        </div>
      ) : (
        <>
          <div className={styles.clipPreview}>
            <div className={styles.clipInfo}>
              <span className={styles.clipName}>{selectedClip.title ?? 'Clip 1'}</span>
              <span className={styles.clipDuration}>{formatMs(selectedClip.durationMs)}</span>
            </div>
            {selectedClip.viralScore && (
              <span className={`viral-badge ${selectedClip.viralScore >= 70 ? 'high' : 'med'}`}>
                {selectedClip.viralScore} viral score
              </span>
            )}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Platform</h3>
            <div className={styles.platformGrid}>
              {([
                { id: 'TIKTOK', label: 'TikTok', icon: '♪' },
                { id: 'INSTAGRAM_REELS', label: 'Reels', icon: '◎' },
                { id: 'YOUTUBE_SHORTS', label: 'Shorts', icon: '▶' },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  className={`${styles.platformCard} ${platform === p.id ? styles.platformSelected : ''}`}
                  onClick={() => setPlatform(p.id)}
                >
                  <span className={styles.platformIcon}>{p.icon}</span>
                  <span>{p.label}</span>
                  <span className={styles.platformRes}>1080×1920</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Quality</h3>
            <div className={styles.qualityRow}>
              {(['high', 'medium', 'low'] as const).map((q) => (
                <button
                  key={q}
                  className={`${styles.qualityBtn} ${quality === q ? styles.qualitySelected : ''}`}
                  onClick={() => setQuality(q)}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={burnCaptions}
                onChange={(e) => setBurnCaptions(e.target.checked)}
              />
              <div>
                <span className={styles.toggleLabel}>Burn-in Captions</span>
                <span className={styles.toggleDesc}>Permanently embed captions into video</span>
              </div>
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {exportStatus === 'COMPLETED' && downloadUrl ? (
            <div className={styles.successSection}>
              <div className={styles.successIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--sf-success)">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className={styles.successText}>Export complete!</p>
              <a
                href={downloadUrl}
                className={styles.downloadBtn}
                target="_blank"
                rel="noreferrer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Video
              </a>
            </div>
          ) : (
            <button
              className={styles.exportBtn}
              onClick={() => { void handleExport(); }}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className={styles.spinner} />
                  {exportStatus === 'pending' ? 'Queued...' : 'Exporting...'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export for {platform === 'TIKTOK' ? 'TikTok' : platform === 'INSTAGRAM_REELS' ? 'Instagram' : 'YouTube'}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
