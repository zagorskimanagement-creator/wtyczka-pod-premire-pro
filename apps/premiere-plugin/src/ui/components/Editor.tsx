import { useState, useEffect } from 'react';
import { useStore } from '../store/index.js';
import { TimelineManager } from '../../premiere/timeline.js';
import styles from './Editor.module.css';

interface EditorProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

const PLATFORMS = ['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS'] as const;
const CAPTION_STYLES = ['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST'] as const;
const DURATIONS = ['15', '30', '45', '60'] as const;

export function Editor({ onNavigate }: EditorProps) {
  const {
    currentProject,
    activeProjectId,
    processingStatus,
    triggerAnalysis,
    applyEditPlan,
    loadProject,
  } = useStore();

  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>('TIKTOK');
  const [captionStyle, setCaptionStyle] = useState<typeof CAPTION_STYLES[number]>('TIKTOK');
  const [duration, setDuration] = useState<typeof DURATIONS[number]>('60');
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
      void loadProject(activeProjectId).catch(() => {});
    }
  }, [activeProjectId, currentProject, loadProject]);

  const handleAnalyze = async () => {
    if (!activeProjectId) return;
    await triggerAnalysis(activeProjectId, {
      targetDuration: duration,
      platform,
      captionStyle,
      removeFillers,
      removeSilence,
      removeRepetitions: true,
    });
  };

  const handleApplyToTimeline = async () => {
    if (!activeProjectId) return;
    setIsApplying(true);
    setApplyError('');
    setApplySuccess(false);

    try {
      const result = await applyEditPlan(activeProjectId, selectedClipIndex);

      const tm = new TimelineManager();
      await tm.ensureSequenceExists(currentProject?.name ?? 'ShortForge Clip');
      await tm.applyEditPlan({
        cuts: (result.editPlan.cuts as CutInstruction[]) ?? [],
        zooms: (result.editPlan.zooms as ZoomInstruction[]) ?? [],
        captions: (result.editPlan.captions as CaptionInstruction[]) ?? [],
        effects: (result.editPlan.effects as EffectInstruction[]) ?? [],
      });

      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply to timeline');
    } finally {
      setIsApplying(false);
    }
  };

  if (!activeProjectId) {
    return (
      <div className={styles.empty}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <p>No project selected.</p>
        <button className="btn btn-primary" onClick={() => onNavigate('dashboard')}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.container} scrollable`}>
      <div className={styles.projectHeader}>
        <button className={styles.backBtn} onClick={() => onNavigate('dashboard')}>
          ← Back
        </button>
        <span className={styles.projectName}>{currentProject?.name ?? 'Loading...'}</span>
        <span className={styles.projectStatus}>{currentProject?.status}</span>
      </div>

      {projectStatus?.status === 'analyzing' && (
        <div className={styles.processingBanner}>
          <div className={styles.processingSpinner} />
          <div>
            <strong>{projectStatus.message}</strong>
            <div className="progress-bar" style={{ marginTop: 6, width: '100%' }}>
              <div className="progress-bar-fill" style={{ width: `${projectStatus.progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {projectStatus?.status === 'failed' && (
        <div className={styles.processingBanner} style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <strong style={{ color: '#ef4444' }}>{projectStatus.message}</strong>
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>AI Settings</h3>

        <div className={styles.settingGroup}>
          <label>Target Platform</label>
          <div className={styles.chipGroup}>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                className={`${styles.chip} ${platform === p ? styles.chipActive : ''}`}
                onClick={() => setPlatform(p)}
              >
                {p === 'TIKTOK' ? 'TikTok' : p === 'INSTAGRAM_REELS' ? 'Instagram' : 'YouTube'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.settingGroup}>
          <label>Caption Style</label>
          <div className={styles.chipGroup}>
            {CAPTION_STYLES.map((s) => (
              <button
                key={s}
                className={`${styles.chip} ${captionStyle === s ? styles.chipActive : ''}`}
                onClick={() => setCaptionStyle(s)}
              >
                {s === 'HORMOZI' ? 'Hormozi' : s === 'GADZHI' ? 'Gadzhi' : s === 'MRBEAST' ? 'MrBeast' : 'TikTok'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.settingGroup}>
          <label>Target Duration</label>
          <div className={styles.chipGroup}>
            {DURATIONS.map((d) => (
              <button
                key={d}
                className={`${styles.chip} ${duration === d ? styles.chipActive : ''}`}
                onClick={() => setDuration(d)}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={removeFillers}
              onChange={(e) => setRemoveFillers(e.target.checked)}
            />
            <span>Remove filler words (um, uh, like)</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={removeSilence}
              onChange={(e) => setRemoveSilence(e.target.checked)}
            />
            <span>Remove silences</span>
          </label>
        </div>
      </div>

      <button
        className={`${styles.analyzeBtn} ${projectStatus?.status === 'analyzing' ? styles.disabled : ''}`}
        onClick={() => { void handleAnalyze(); }}
        disabled={projectStatus?.status === 'analyzing'}
      >
        {projectStatus?.status === 'analyzing' ? (
          <>
            <span className={styles.btnSpinner} />
            Analyzing...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Analyze with AI
          </>
        )}
      </button>

      {clips.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Generated Clips ({clips.length})</h3>
          <div className={styles.clipList}>
            {clips.map((clip, i) => (
              <div
                key={clip.id}
                className={`${styles.clipCard} ${selectedClipIndex === i ? styles.clipSelected : ''}`}
                onClick={() => setSelectedClipIndex(i)}
              >
                <div className={styles.clipRank}>#{i + 1}</div>
                <div className={styles.clipInfo}>
                  <span className={styles.clipTitle}>{clip.title ?? `Clip ${i + 1}`}</span>
                  <span className={styles.clipMeta}>
                    {formatMs(clip.durationMs)} · {clip.platform}
                  </span>
                </div>
                <div className={styles.clipScores}>
                  <ViralScore score={clip.viralScore ?? 0} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editPlan && (
        <div className={styles.section}>
          <div className={styles.editPlanHeader}>
            <h3 className={styles.sectionTitle}>Edit Plan Ready</h3>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--sf-success)">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {editPlan.titleSuggestion && (
            <div className={styles.suggestion}>
              <label>Suggested Title</label>
              <p>{editPlan.titleSuggestion}</p>
            </div>
          )}

          {applyError && <p className={styles.error}>{applyError}</p>}
          {applySuccess && (
            <div className={styles.success}>
              Edit plan applied to Premiere timeline!
            </div>
          )}

          <button
            className={styles.applyBtn}
            onClick={() => { void handleApplyToTimeline(); }}
            disabled={isApplying}
          >
            {isApplying ? (
              <>
                <span className={styles.btnSpinner} />
                Applying to Timeline...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                Apply to Premiere Timeline
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ViralScore({ score }: { score: number }) {
  const level = score >= 70 ? 'high' : score >= 40 ? 'med' : 'low';
  return (
    <span className={`viral-badge ${level}`}>
      {score}
    </span>
  );
}

function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

interface CutInstruction { startMs: number; endMs: number; type: 'keep' | 'remove'; }
interface ZoomInstruction { startMs: number; endMs: number; scale: number; posX: number; posY: number; easing: string; }
interface CaptionInstruction { text: string; startMs: number; endMs: number; positionY: number; fontSize: number; colorHex: string; strokeColor: string; strokeWidth: number; }
interface EffectInstruction { startMs: number; endMs: number; type: string; params: Record<string, number | string>; }
