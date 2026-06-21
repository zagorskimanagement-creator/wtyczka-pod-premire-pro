import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import type { ExportOptions } from '../types.js';

const PLATFORM_PRESETS: Record<string, ExportOptions> = {
  TIKTOK: {
    outputPath: '',
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    bitrate: '8000k',
    audioBitrate: '192k',
    codec: 'libx264',
    format: 'mp4',
    preset: 'fast',
    crf: 23,
  },
  INSTAGRAM_REELS: {
    outputPath: '',
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    bitrate: '6000k',
    audioBitrate: '192k',
    codec: 'libx264',
    format: 'mp4',
    preset: 'fast',
    crf: 23,
  },
  YOUTUBE_SHORTS: {
    outputPath: '',
    resolution: { width: 1080, height: 1920 },
    fps: 60,
    bitrate: '10000k',
    audioBitrate: '256k',
    codec: 'libx264',
    format: 'mp4',
    preset: 'medium',
    crf: 21,
  },
};

export class VideoTranscoder {
  async exportForPlatform(
    inputPath: string,
    outputPath: string,
    platform: string,
    quality: 'high' | 'medium' | 'low' = 'high',
  ): Promise<{ outputPath: string; fileSizeBytes: number; durationMs: number }> {
    const preset = { ...PLATFORM_PRESETS[platform] ?? PLATFORM_PRESETS['TIKTOK'] };
    preset.outputPath = outputPath;

    const qualityMap = { high: 22, medium: 26, low: 30 };
    preset.crf = qualityMap[quality];

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await this.transcode(inputPath, preset);

    const stat = await fs.stat(outputPath);
    const durationMs = await this.getDurationMs(outputPath);

    return {
      outputPath,
      fileSizeBytes: stat.size,
      durationMs,
    };
  }

  private async transcode(inputPath: string, options: ExportOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec(options.codec)
        .audioCodec('aac')
        .size(`${options.resolution.width}x${options.resolution.height}`)
        .fps(options.fps)
        .videoBitrate(options.bitrate)
        .audioBitrate(options.audioBitrate)
        .outputOptions([
          `-preset ${options.preset}`,
          `-crf ${options.crf}`,
          '-movflags +faststart',
          '-profile:v main',
          '-level 4.0',
          '-pix_fmt yuv420p',
          '-ar 44100',
          '-ac 2',
        ])
        .output(options.outputPath)
        .on('progress', (progress) => {
          process.stdout.write(`\r[Transcode] ${Math.round(progress.percent ?? 0)}%`);
        })
        .on('end', () => {
          process.stdout.write('\n');
          resolve();
        })
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async reframe9to16(
    inputPath: string,
    outputPath: string,
    facePositions?: Array<{ timeMs: number; faceX: number; faceY: number; faceWidth: number }>,
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise<void>((resolve, reject) => {
      let cropFilter: string;

      if (facePositions && facePositions.length > 0) {
        const avgFaceX = facePositions.reduce((sum, p) => sum + p.faceX, 0) / facePositions.length;
        const cropX = Math.max(0, avgFaceX - 540);
        cropFilter = `crop=1080:1920:${Math.round(cropX)}:0`;
      } else {
        cropFilter = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0';
      }

      ffmpeg(inputPath)
        .videoFilters([cropFilter, 'scale=1080:1920'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 22',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  private async getDurationMs(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(Math.round((metadata.format.duration ?? 0) * 1000));
      });
    });
  }
}
