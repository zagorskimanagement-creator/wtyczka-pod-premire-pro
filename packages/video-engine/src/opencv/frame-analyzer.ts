import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { VideoExtractor } from '../ffmpeg/extract.js';

export interface FrameAnalysis {
  timeMs: number;
  brightness: number;
  contrast: number;
  colorfulness: number;
  sharpness: number;
  hasMotion: boolean;
  motionScore: number;
  isBlurry: boolean;
  dominantColors: string[];
  qualityScore: number;
}

export class FrameAnalyzer {
  private extractor: VideoExtractor;

  constructor() {
    this.extractor = new VideoExtractor();
  }

  async analyzeKeyFrames(
    videoPath: string,
    startMs: number,
    endMs: number,
    sampleCount = 10,
  ): Promise<FrameAnalysis[]> {
    const duration = endMs - startMs;
    const interval = duration / sampleCount;
    const timestamps = Array.from(
      { length: sampleCount },
      (_, i) => Math.round(startMs + i * interval),
    );

    const tmpDir = `/tmp/frames_${Date.now()}`;
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      const framePaths = await this.extractor.extractFramesBatch(videoPath, tmpDir, timestamps);
      const analyses = await Promise.all(
        framePaths.map((framePath, i) =>
          this.analyzeFrame(framePath, timestamps[i]),
        ),
      );
      return analyses.filter((a): a is FrameAnalysis => a !== null);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private async analyzeFrame(framePath: string, timeMs: number): Promise<FrameAnalysis | null> {
    try {
      const image = sharp(framePath);
      const metadata = await image.metadata();
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { brightness, contrast, colorfulness } = this.calculateImageStats(
        data,
        info.width,
        info.height,
        info.channels,
      );

      const sharpness = this.estimateSharpness(data, info.width, info.height, info.channels);
      const isBlurry = sharpness < 50;
      const dominantColors = this.getDominantColors(data, info.width, info.height, info.channels);

      const qualityScore = Math.round(
        brightness * 0.2 +
        contrast * 0.2 +
        colorfulness * 0.2 +
        sharpness * 0.4,
      );

      return {
        timeMs,
        brightness,
        contrast,
        colorfulness,
        sharpness,
        hasMotion: false,
        motionScore: 0,
        isBlurry,
        dominantColors,
        qualityScore,
      };
    } catch {
      return null;
    }
  }

  private calculateImageStats(
    data: Buffer,
    width: number,
    height: number,
    channels: number,
  ): { brightness: number; contrast: number; colorfulness: number } {
    let sumR = 0, sumG = 0, sumB = 0;
    let minBrightness = 255, maxBrightness = 0;
    const pixelCount = width * height;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);

      sumR += r;
      sumG += g;
      sumB += b;
    }

    const avgR = sumR / pixelCount;
    const avgG = sumG / pixelCount;
    const avgB = sumB / pixelCount;

    const brightness = Math.round((avgR + avgG + avgB) / 3 / 255 * 100);
    const contrast = Math.round((maxBrightness - minBrightness) / 255 * 100);

    const rg = Math.abs(avgR - avgG);
    const yb = Math.abs(0.5 * (avgR + avgG) - avgB);
    const colorfulness = Math.min(100, Math.round(Math.sqrt(rg * rg + yb * yb) / 2));

    return { brightness, contrast, colorfulness };
  }

  private estimateSharpness(
    data: Buffer,
    width: number,
    height: number,
    channels: number,
  ): number {
    let laplacianSum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y += 4) {
      for (let x = 1; x < width - 1; x += 4) {
        const idx = (y * width + x) * channels;
        const top = data[(y - 1) * width * channels + x * channels] ?? 0;
        const bottom = data[(y + 1) * width * channels + x * channels] ?? 0;
        const left = data[y * width * channels + (x - 1) * channels] ?? 0;
        const right = data[y * width * channels + (x + 1) * channels] ?? 0;
        const center = data[idx] ?? 0;

        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        laplacianSum += laplacian;
        count++;
      }
    }

    const avgLaplacian = count > 0 ? laplacianSum / count : 0;
    return Math.min(100, Math.round(avgLaplacian / 2));
  }

  private getDominantColors(
    data: Buffer,
    width: number,
    height: number,
    channels: number,
  ): string[] {
    const colorBuckets = new Map<string, number>();

    const step = Math.max(1, Math.floor((width * height) / 1000));

    for (let i = 0; i < data.length; i += channels * step) {
      const r = Math.round((data[i] ?? 0) / 32) * 32;
      const g = Math.round((data[i + 1] ?? 0) / 32) * 32;
      const b = Math.round((data[i + 2] ?? 0) / 32) * 32;
      const key = `${r},${g},${b}`;
      colorBuckets.set(key, (colorBuckets.get(key) ?? 0) + 1);
    }

    return Array.from(colorBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
  }

  findBestThumbnailFrame(analyses: FrameAnalysis[]): FrameAnalysis | null {
    if (analyses.length === 0) return null;
    return analyses.reduce((best, frame) =>
      frame.qualityScore > best.qualityScore ? frame : best,
    );
  }
}
