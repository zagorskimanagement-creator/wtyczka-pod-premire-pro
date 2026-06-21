export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: TranscriptWord[];
  topic?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentScore?: number;
  hookScore?: number;
  retentionScore?: number;
  viralScore?: number;
  emotionType?: string;
  speechRate?: number;
}

export interface FullTranscript {
  text: string;
  language: string;
  confidence: number;
  durationMs: number;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
}

export interface Hook {
  text: string;
  startMs: number;
  endMs: number;
  type: 'controversial' | 'surprising' | 'emotional' | 'curiosity' | 'story' | 'question';
  score: number;
  reason: string;
}

export interface ViralMoment {
  startMs: number;
  endMs: number;
  text: string;
  viralScore: number;
  hookScore: number;
  retentionScore: number;
  emotionType: string;
  reasons: string[];
}

export interface ContentTopic {
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
  keyPoints: string[];
  sentiment: string;
}

export interface Cut {
  startMs: number;
  endMs: number;
  type: 'keep' | 'remove';
  reason?: string;
}

export interface Zoom {
  startMs: number;
  endMs: number;
  scale: number;
  posX: number;
  posY: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface CaptionConfig {
  text: string;
  startMs: number;
  endMs: number;
  words: Array<{ word: string; startMs: number; endMs: number }>;
  style: 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST';
  positionY: number;
  fontSize: number;
  animation: 'pop' | 'scale' | 'bounce' | 'fade' | 'none';
  highlightColor?: string;
}

export interface Transition {
  atMs: number;
  type: 'cut' | 'crossfade' | 'wipe' | 'zoom-in' | 'zoom-out';
  durationMs: number;
}

export interface Effect {
  startMs: number;
  endMs: number;
  type: 'punch-in' | 'shake' | 'color-grade' | 'vignette' | 'blur' | 'glow';
  params: Record<string, number | string>;
}

export interface BRollSuggestion {
  atMs: number;
  durationMs: number;
  concept: string;
  searchQuery: string;
  keywords: string[];
  category: string;
}

export interface EditPlan {
  projectId: string;
  videoId: string;
  targetDurationMs: number;
  platform: string;
  cuts: Cut[];
  zooms: Zoom[];
  captions: CaptionConfig[];
  transitions: Transition[];
  effects: Effect[];
  broll: BRollSuggestion[];
  titleSuggestion: string;
  descriptionSuggestion: string;
  hashtags: string[];
  selectedClips: SelectedClip[];
}

export interface SelectedClip {
  rank: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  viralScore: number;
  hookScore: number;
  retentionScore: number;
  title: string;
  description: string;
  hashtags: string[];
  hook: string;
}

export interface AnalysisOptions {
  targetDuration: number;
  targetPlatform: string;
  captionStyle: string;
  removeFillers: boolean;
  removeSilence: boolean;
  removeRepetitions: boolean;
  detectHooks: boolean;
  detectEmotions: boolean;
  generateTitle: boolean;
  generateDescription: boolean;
  generateHashtags: boolean;
  addBRoll: boolean;
}

export type FillerWord =
  | 'um' | 'uh' | 'like' | 'you know' | 'basically' | 'literally'
  | 'actually' | 'honestly' | 'right' | 'so' | 'and um' | 'I mean';
