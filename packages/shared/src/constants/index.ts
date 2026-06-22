export const PLATFORM_SPECS = {
  TIKTOK: {
    name: 'TikTok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDurationSeconds: 60,
    maxFileSizeMB: 287,
    formats: ['mp4'],
    fps: 30,
  },
  INSTAGRAM_REELS: {
    name: 'Instagram Reels',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDurationSeconds: 60,
    maxFileSizeMB: 250,
    formats: ['mp4'],
    fps: 30,
  },
  YOUTUBE_SHORTS: {
    name: 'YouTube Shorts',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDurationSeconds: 60,
    maxFileSizeMB: 256000,
    formats: ['mp4'],
    fps: 60,
  },
} as const;

export const FILLER_WORDS = [
  'um', 'uh', 'uhh', 'umm', 'hmm', 'ah', 'ahh',
  'like', 'you know', 'basically', 'literally', 'actually',
  'honestly', 'right', 'okay', 'ok', 'so', 'well', 'i mean',
  'kind of', 'sort of', 'you see',
] as const;

export const SILENCE_THRESHOLD_MS = 500;

export const VIRAL_SCORE_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
  LOW: 0,
} as const;

export const MAX_CLIP_DURATION_MS = 60000;
export const MIN_CLIP_DURATION_MS = 10000;

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
] as const;

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  ANALYSIS: 'analysis',
  EDIT_GENERATION: 'edit-generation',
  EXPORT: 'export',
} as const;
