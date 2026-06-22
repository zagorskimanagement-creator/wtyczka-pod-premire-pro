import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import type { VideoInfo } from '../types.js';

const FFMPEG_PATH = process.env['FFMPEG_PATH'] ?? 'ffmpeg';
const FFPROBE_PATH = process.env['FFPROBE_PATH'] ?? 'ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

export class FFmpegWrapper {
  async probe(inputPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

        if (!videoStream) return reject(new Error('No video stream found'));

        const fpsString = videoStream.r_frame_rate ?? '30/1';
        const [num, den] = fpsString.split('/').map(Number);
        const fps = den ? num / den : 30;

        resolve({
          width: videoStream.width ?? 1920,
          height: videoStream.height ?? 1080,
          fps,
          durationSeconds: metadata.format.duration ?? 0,
          bitrate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate, 10) : 0,
          codec: videoStream.codec_name ?? 'h264',
          audioCodec: audioStream?.codec_name ?? 'aac',
          hasAudio: !!audioStream,
        });
      });
    });
  }

  async extractClip(
    inputPath: string,
    outputPath: string,
    startMs: number,
    endMs: number,
    options: { keepAudio?: boolean } = {},
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const startSeconds = startMs / 1000;
      const durationSeconds = (endMs - startMs) / 1000;

      let cmd = ffmpeg(inputPath)
        .setStartTime(startSeconds)
        .setDuration(durationSeconds)
        .videoCodec('libx264')
        .outputOptions([
          '-preset fast',
          '-crf 22',
          '-movflags +faststart',
          '-avoid_negative_ts make_zero',
        ]);

      if (!options.keepAudio) {
        cmd = cmd.noAudio();
      } else {
        cmd = cmd.audioCodec('aac').audioBitrate('192k');
      }

      cmd
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async removeSilences(
    inputPath: string,
    outputPath: string,
    cuts: Array<{ startMs: number; endMs: number; type: 'keep' | 'remove' }>,
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const keepSegments = cuts.filter((c) => c.type === 'keep');
    if (keepSegments.length === 0) {
      throw new Error('No segments to keep');
    }

    if (keepSegments.length === 1) {
      const seg = keepSegments[0];
      return this.extractClip(inputPath, outputPath, seg.startMs, seg.endMs, { keepAudio: true });
    }

    const tmpDir = path.join(path.dirname(outputPath), `tmp_${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      const segmentPaths: string[] = [];
      for (let i = 0; i < keepSegments.length; i++) {
        const seg = keepSegments[i];
        const segPath = path.join(tmpDir, `seg_${i}.mp4`);
        await this.extractClip(inputPath, segPath, seg.startMs, seg.endMs, { keepAudio: true });
        segmentPaths.push(segPath);
      }

      await this.concatenate(segmentPaths, outputPath);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const listPath = path.join(path.dirname(outputPath), `concat_${Date.now()}.txt`);
    const listContent = inputPaths.map((p) => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, listContent);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f concat', '-safe 0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .output(outputPath)
          .outputOptions(['-movflags +faststart'])
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
    } finally {
      await fs.unlink(listPath).catch(() => null);
    }
  }

  async resize(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number,
    options: {
      cropX?: number;
      cropY?: number;
      cropWidth?: number;
      cropHeight?: number;
      keepAudio?: boolean;
    } = {},
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      let filterComplex = '';

      if (options.cropX !== undefined) {
        filterComplex = `crop=${options.cropWidth}:${options.cropHeight}:${options.cropX}:${options.cropY},scale=${targetWidth}:${targetHeight}`;
      } else {
        filterComplex = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`;
      }

      let cmd = ffmpeg(inputPath)
        .videoFilters(filterComplex)
        .videoCodec('libx264')
        .outputOptions([
          '-preset fast',
          '-crf 22',
          '-movflags +faststart',
        ]);

      if (!options.keepAudio) {
        cmd = cmd.noAudio();
      } else {
        cmd = cmd.audioCodec('aac').audioBitrate('192k');
      }

      cmd
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async burnCaptions(
    inputPath: string,
    outputPath: string,
    srtPath: string,
    style: { fontSize: number; colorHex: string; strokeColor: string; strokeWidth: number },
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const colorBGR = this.hexToBGR(style.colorHex);
    const strokeBGR = this.hexToBGR(style.strokeColor);

    const subtitleFilter = `subtitles=${srtPath}:force_style='FontSize=${style.fontSize},PrimaryColour=&H${colorBGR},OutlineColour=&H${strokeBGR},Outline=${style.strokeWidth},Bold=1'`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(subtitleFilter)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset fast', '-crf 22', '-movflags +faststart'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async extractFrames(
    inputPath: string,
    outputDir: string,
    fps = 1,
    startMs?: number,
    endMs?: number,
  ): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      if (startMs !== undefined && endMs !== undefined) {
        cmd = cmd.setStartTime(startMs / 1000).setDuration((endMs - startMs) / 1000);
      }

      cmd
        .fps(fps)
        .output(path.join(outputDir, 'frame_%04d.jpg'))
        .outputOptions(['-q:v 2'])
        .on('end', async () => {
          const files = await fs.readdir(outputDir);
          const framePaths = files
            .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
            .sort()
            .map((f) => path.join(outputDir, f));
          resolve(framePaths);
        })
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async addZoomEffect(
    inputPath: string,
    outputPath: string,
    keyframes: Array<{ timeMs: number; scale: number; posX: number; posY: number }>,
  ): Promise<void> {
    if (keyframes.length === 0) {
      await fs.copyFile(inputPath, outputPath);
      return;
    }

    const zoompanExpressions = keyframes.map((kf, i) => {
      const t = kf.timeMs / 1000;
      return `if(between(t,${t},${t + 3}),${kf.scale},1)`;
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`scale=8000:-1,zoompan=z='${zoompanExpressions[0]}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920`)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset fast', '-crf 22'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  generateSRT(
    captions: Array<{ text: string; startMs: number; endMs: number }>,
  ): string {
    return captions
      .map((caption, i) => {
        const start = this.msToSRTTime(caption.startMs);
        const end = this.msToSRTTime(caption.endMs);
        return `${i + 1}\n${start} --> ${end}\n${caption.text}\n`;
      })
      .join('\n');
  }

  private msToSRTTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }

  private hexToBGR(hex: string): string {
    const r = hex.slice(1, 3);
    const g = hex.slice(3, 5);
    const b = hex.slice(5, 7);
    return `FF${b}${g}${r}`.toUpperCase();
  }
}
