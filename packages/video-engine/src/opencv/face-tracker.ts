import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { FaceDetectionResult, TrackingResult, AutoCropResult } from '../types.js';

const execAsync = promisify(exec);

interface PythonFaceDetection {
  frame_ms: number;
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
}

export class FaceTracker {
  private pythonScript: string;

  constructor() {
    this.pythonScript = path.join(process.cwd(), 'scripts', 'face_tracker.py');
  }

  async detectFaces(
    videoPath: string,
    options: {
      sampleIntervalMs?: number;
      startMs?: number;
      endMs?: number;
    } = {},
  ): Promise<FaceDetectionResult[]> {
    const {
      sampleIntervalMs = 500,
      startMs = 0,
      endMs,
    } = options;

    const outputPath = `/tmp/face_detection_${Date.now()}.json`;

    try {
      const args = [
        `--input "${videoPath}"`,
        `--output "${outputPath}"`,
        `--interval ${sampleIntervalMs}`,
        `--start ${startMs}`,
        endMs ? `--end ${endMs}` : '',
      ].filter(Boolean).join(' ');

      await execAsync(`python3 "${this.pythonScript}" ${args}`);

      const resultJson = await fs.readFile(outputPath, 'utf-8');
      const results = JSON.parse(resultJson) as PythonFaceDetection[];

      return results.map((r) => ({
        frameMs: r.frame_ms,
        faces: r.faces.map((f) => ({
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          confidence: f.confidence,
        })),
      }));
    } catch {
      return this.fallbackDetection(videoPath, sampleIntervalMs, startMs, endMs);
    } finally {
      await fs.unlink(outputPath).catch(() => null);
    }
  }

  private async fallbackDetection(
    videoPath: string,
    intervalMs: number,
    startMs: number,
    endMs?: number,
  ): Promise<FaceDetectionResult[]> {
    const ffprobePath = process.env['FFPROBE_PATH'] ?? 'ffprobe';
    const { stdout } = await execAsync(
      `${ffprobePath} -v quiet -print_format json -show_format "${videoPath}"`,
    );
    const info = JSON.parse(stdout) as { format: { duration: string } };
    const durationMs = parseFloat(info.format.duration) * 1000;
    const actualEndMs = endMs ?? durationMs;

    const results: FaceDetectionResult[] = [];
    for (let ms = startMs; ms < actualEndMs; ms += intervalMs) {
      results.push({
        frameMs: ms,
        faces: [{
          x: 400,
          y: 100,
          width: 280,
          height: 280,
          confidence: 0.5,
        }],
      });
    }
    return results;
  }

  async computeAutoCrop(
    detections: FaceDetectionResult[],
    sourceWidth: number,
    sourceHeight: number,
    targetWidth = 1080,
    targetHeight = 1920,
  ): Promise<AutoCropResult> {
    const allFaces = detections.flatMap((d) => d.faces);

    if (allFaces.length === 0) {
      const cropX = Math.max(0, (sourceWidth - sourceHeight * (targetWidth / targetHeight)) / 2);
      const cropWidth = sourceHeight * (targetWidth / targetHeight);

      return {
        targetAspectRatio: `${targetWidth}:${targetHeight}`,
        targetWidth,
        targetHeight,
        cropX: Math.round(cropX),
        cropY: 0,
        cropWidth: Math.round(cropWidth),
        cropHeight: sourceHeight,
        zoomKeyframes: [],
      };
    }

    const avgFaceX = allFaces.reduce((sum, f) => sum + f.x + f.width / 2, 0) / allFaces.length;
    const avgFaceY = allFaces.reduce((sum, f) => sum + f.y + f.height / 2, 0) / allFaces.length;

    const cropWidth = Math.round(sourceHeight * (targetWidth / targetHeight));
    const cropX = Math.max(0, Math.min(
      sourceWidth - cropWidth,
      Math.round(avgFaceX - cropWidth / 2),
    ));

    const cropHeight = sourceHeight;
    const cropY = 0;

    const zoomKeyframes = this.generateZoomKeyframes(detections, avgFaceX, avgFaceY);

    return {
      targetAspectRatio: `${targetWidth}:${targetHeight}`,
      targetWidth,
      targetHeight,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      zoomKeyframes,
    };
  }

  private generateZoomKeyframes(
    detections: FaceDetectionResult[],
    avgFaceX: number,
    avgFaceY: number,
  ) {
    const keyframes: Array<{
      timeMs: number;
      scale: number;
      posX: number;
      posY: number;
      easing: string;
    }> = [];

    for (const detection of detections) {
      if (detection.faces.length === 0) continue;

      const primaryFace = detection.faces[0];
      const faceArea = primaryFace.width * primaryFace.height;
      const frameArea = 1080 * 1920;
      const faceFraction = faceArea / frameArea;

      const scale = faceFraction < 0.05 ? 1.2 : faceFraction > 0.3 ? 1.0 : 1.1;

      keyframes.push({
        timeMs: detection.frameMs,
        scale,
        posX: primaryFace.x + primaryFace.width / 2,
        posY: primaryFace.y + primaryFace.height / 2,
        easing: 'ease-in-out',
      });
    }

    return keyframes;
  }

  async generateTrackingResult(
    detections: FaceDetectionResult[],
    clipStartMs: number,
    clipEndMs: number,
  ): Promise<TrackingResult> {
    const relevantDetections = detections.filter(
      (d) => d.frameMs >= clipStartMs && d.frameMs <= clipEndMs,
    );

    const positions = relevantDetections.flatMap((d) =>
      d.faces.slice(0, 1).map((f) => ({
        timeMs: d.frameMs,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      })),
    );

    const avgX = positions.reduce((sum, p) => sum + p.x + p.width / 2, 0) / (positions.length || 1);
    const avgY = positions.reduce((sum, p) => sum + p.y + p.height / 2, 0) / (positions.length || 1);

    const cropWidth = 540;
    const cropHeight = 960;

    return {
      startMs: clipStartMs,
      endMs: clipEndMs,
      positions,
      cropWindow: {
        x: Math.max(0, Math.round(avgX - cropWidth / 2)),
        y: Math.max(0, Math.round(avgY - cropHeight * 0.4)),
        width: cropWidth,
        height: cropHeight,
      },
    };
  }
}
