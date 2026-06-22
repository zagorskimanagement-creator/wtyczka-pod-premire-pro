export interface VideoInfo {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  bitrate: number;
  codec: string;
  audioCodec: string;
  hasAudio: boolean;
}

export interface ExportOptions {
  outputPath: string;
  resolution: { width: number; height: number };
  fps: number;
  bitrate: string;
  audioBitrate: string;
  codec: string;
  format: 'mp4' | 'mov' | 'webm';
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow';
  crf: number;
}

export interface ClipOptions {
  startMs: number;
  endMs: number;
  keepAudio: boolean;
}

export interface CaptionBurnOptions {
  captions: Array<{
    text: string;
    startMs: number;
    endMs: number;
    positionX: number;
    positionY: number;
    fontSize: number;
    colorHex: string;
    strokeColor: string;
    strokeWidth: number;
  }>;
  videoWidth: number;
  videoHeight: number;
}

export interface FaceDetectionResult {
  frameMs: number;
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    landmarks?: {
      eyes: [{ x: number; y: number }, { x: number; y: number }];
      nose: { x: number; y: number };
      mouth: { x: number; y: number };
    };
  }>;
}

export interface TrackingResult {
  startMs: number;
  endMs: number;
  positions: Array<{
    timeMs: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  cropWindow: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ZoomKeyframe {
  timeMs: number;
  scale: number;
  posX: number;
  posY: number;
  easing: string;
}

export interface AutoCropResult {
  targetAspectRatio: string;
  targetWidth: number;
  targetHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  zoomKeyframes: ZoomKeyframe[];
}
