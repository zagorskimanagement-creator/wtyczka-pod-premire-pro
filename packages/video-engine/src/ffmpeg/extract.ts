import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

export class VideoExtractor {
  async extractAudio(
    inputPath: string,
    outputPath: string,
    options: { sampleRate?: number; channels?: number; format?: string } = {},
  ): Promise<string> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const sampleRate = options.sampleRate ?? 16000;
    const channels = options.channels ?? 1;
    const format = options.format ?? 'mp3';

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec(format === 'mp3' ? 'mp3' : 'pcm_s16le')
        .audioFrequency(sampleRate)
        .audioChannels(channels)
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async extractFrame(
    inputPath: string,
    outputPath: string,
    timeMs: number,
    quality = 2,
  ): Promise<string> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(timeMs / 1000)
        .frames(1)
        .outputOptions([`-q:v ${quality}`])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async extractFramesBatch(
    inputPath: string,
    outputDir: string,
    timestampsMs: number[],
  ): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const outputPaths: string[] = [];

    const batchSize = 5;
    for (let i = 0; i < timestampsMs.length; i += batchSize) {
      const batch = timestampsMs.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((timeMs, idx) => {
          const outputPath = path.join(outputDir, `frame_${i + idx}_${timeMs}.jpg`);
          return this.extractFrame(inputPath, outputPath, timeMs);
        }),
      );
      outputPaths.push(...results);
    }

    return outputPaths;
  }

  async extractThumbnail(
    inputPath: string,
    outputPath: string,
    timeMs: number,
    width = 1280,
    height = 720,
  ): Promise<string> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(timeMs / 1000)
        .frames(1)
        .size(`${width}x${height}`)
        .outputOptions(['-q:v 2'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async extractAudioWaveform(
    inputPath: string,
    sampleCount = 1000,
  ): Promise<number[]> {
    const tmpPath = `/tmp/waveform_${Date.now()}.raw`;

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .noVideo()
          .audioCodec('pcm_s16le')
          .audioFrequency(8000)
          .audioChannels(1)
          .format('s16le')
          .output(tmpPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      const buffer = await fs.readFile(tmpPath);
      const samples: number[] = [];
      const step = Math.floor(buffer.length / 2 / sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        const offset = i * step * 2;
        if (offset + 1 < buffer.length) {
          const sample = buffer.readInt16LE(offset);
          samples.push(Math.abs(sample) / 32768);
        }
      }

      return samples;
    } finally {
      await fs.unlink(tmpPath).catch(() => null);
    }
  }
}
