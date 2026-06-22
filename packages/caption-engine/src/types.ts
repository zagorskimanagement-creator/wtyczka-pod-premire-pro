export type CaptionStyleName = 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST';
export type AnimationType = 'none' | 'pop' | 'typewriter' | 'fade' | 'bounce' | 'slide-up';
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface CaptionStyleConfig {
  name: CaptionStyleName;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  highlightColor: string;
  highlightStrokeColor: string;
  textTransform: TextTransform;
  letterSpacing: number;
  lineHeight: number;
  maxWordsPerLine: number;
  positionX: number;
  positionY: number;
  animationType: AnimationType;
  backgroundColor: string;
  backgroundPadding: number;
  backgroundBorderRadius: number;
}

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
  isFiller?: boolean;
}

export interface CaptionGroup {
  words: WordTiming[];
  startMs: number;
  endMs: number;
  text: string;
}

export interface RenderedCaption {
  id: string;
  groupIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  style: CaptionStyleConfig;
  words: WordTiming[];
  position: { x: number; y: number };
}

export interface AnimationFrame {
  timeMs: number;
  properties: Record<string, string | number>;
}

export interface CaptionAnimation {
  durationMs: number;
  frames: AnimationFrame[];
  easing: string;
}
