export interface TimelineClip {
  id: string;
  startMs: number;
  endMs: number;
  trackIndex: number;
  mediaPath: string;
  mediaStartMs: number;
  mediaEndMs: number;
  volume: number;
  speed: number;
  label?: string;
}

export interface TimelineTrack {
  index: number;
  type: 'video' | 'audio' | 'caption';
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
}

export interface TimelineSequence {
  id: string;
  name: string;
  durationMs: number;
  frameRate: number;
  width: number;
  height: number;
  tracks: TimelineTrack[];
}

export interface CutPoint {
  startMs: number;
  endMs: number;
  reason: 'silence' | 'filler' | 'low_energy' | 'manual';
}

export interface ZoomKeyframe {
  timeMs: number;
  scale: number;
  centerX: number;
  centerY: number;
  easingIn: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  easingOut: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface TransitionDef {
  type: 'cut' | 'dissolve' | 'wipe' | 'slide' | 'zoom' | 'flash';
  durationMs: number;
  atMs: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  easing?: string;
}

export interface EffectDef {
  type: 'color-grade' | 'vignette' | 'film-grain' | 'sharpen' | 'punch-in';
  startMs: number;
  endMs: number;
  intensity: number;
  params?: Record<string, number | string | boolean>;
}

export interface CaptionBlock {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  style: 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST';
  positionX: number;
  positionY: number;
  fontSize: number;
  colorHex: string;
  strokeColor: string;
  strokeWidth: number;
  animationType: 'none' | 'pop' | 'typewriter' | 'fade' | 'bounce' | 'slide-up';
  words: Array<{ word: string; startMs: number; endMs: number }>;
}

export interface BuiltTimeline {
  sequence: TimelineSequence;
  cuts: CutPoint[];
  zooms: ZoomKeyframe[];
  transitions: TransitionDef[];
  effects: EffectDef[];
  captions: CaptionBlock[];
  durationMs: number;
  estimatedFileSizeMb: number;
}

export interface SequenceBuilderOptions {
  platform: 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS';
  frameRate: number;
  includeAudio: boolean;
  captionTrack: boolean;
}

export interface ClipEditOperation {
  type: 'trim' | 'split' | 'delete' | 'move' | 'speed' | 'volume';
  clipId: string;
  params: Record<string, number | string>;
}
