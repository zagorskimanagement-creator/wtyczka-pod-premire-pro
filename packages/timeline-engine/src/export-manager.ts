import type { BuiltTimeline } from './types.js';
import { CaptionRenderer } from './caption-renderer.js';
import { EffectManager } from './effect-manager.js';

export interface ExportSpec {
  outputPath: string;
  platform: 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS';
  quality: 'high' | 'medium' | 'low';
  burnCaptions: boolean;
  format: 'mp4' | 'mov' | 'webm';
}

export interface FFmpegCommand {
  inputs: string[];
  filterComplex: string;
  outputOptions: string[];
  outputPath: string;
}

const QUALITY_PRESETS = {
  high: { videoBitrate: '8000k', audioBitrate: '192k', crf: 18 },
  medium: { videoBitrate: '4000k', audioBitrate: '128k', crf: 23 },
  low: { videoBitrate: '2000k', audioBitrate: '96k', crf: 28 },
} as const;

const PLATFORM_SIZES = {
  TIKTOK: { width: 1080, height: 1920 },
  INSTAGRAM_REELS: { width: 1080, height: 1920 },
  YOUTUBE_SHORTS: { width: 1080, height: 1920 },
} as const;

export class ExportManager {
  private captionRenderer = new CaptionRenderer();
  private effectManager = new EffectManager();

  buildFFmpegCommand(timeline: BuiltTimeline, spec: ExportSpec): FFmpegCommand {
    const { width, height } = PLATFORM_SIZES[spec.platform];
    const quality = QUALITY_PRESETS[spec.quality];
    const videoTrack = timeline.sequence.tracks.find((t) => t.type === 'video');
    if (!videoTrack || videoTrack.clips.length === 0) throw new Error('No video clips in timeline');

    const inputs = [...new Set(videoTrack.clips.map((c) => c.mediaPath))];
    const filterParts: string[] = [];

    for (let i = 0; i < videoTrack.clips.length; i++) {
      const clip = videoTrack.clips[i]!;
      filterParts.push(`[${i}:v]trim=start=${clip.mediaStartMs/1000}:end=${clip.mediaEndMs/1000},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[v${i}]`);
    }

    filterParts.push(`${videoTrack.clips.map((_,i)=>`[v${i}]`).join('')}concat=n=${videoTrack.clips.length}:v=1:a=0[vconcat]`);

    const effectFilter = this.effectManager.buildFilterString(timeline.effects);
    if (effectFilter) filterParts.push(`[vconcat]${effectFilter}[vfx]`);

    let finalLabel = effectFilter ? '[vfx]' : '[vconcat]';

    if (spec.burnCaptions && timeline.captions.length > 0) {
      filterParts.push(`${finalLabel}subtitles=CAPTIONS_SRT_PATH[vout]`);
      finalLabel = '[vout]';
    }

    const codec = spec.format === 'webm' ? 'libvpx-vp9' : 'libx264';
    const audioCodec = spec.format === 'webm' ? 'libopus' : 'aac';

    return {
      inputs,
      filterComplex: filterParts.join('; '),
      outputOptions: [`-map ${finalLabel}`, '-map 0:a?', `-c:v ${codec}`, `-b:v ${quality.videoBitrate}`, `-crf ${quality.crf}`, '-preset fast', `-c:a ${audioCodec}`, `-b:a ${quality.audioBitrate}`, '-movflags +faststart', '-pix_fmt yuv420p', `-r ${timeline.sequence.frameRate}`],
      outputPath: spec.outputPath,
    };
  }

  generateSRT(timeline: BuiltTimeline): string { return this.captionRenderer.toSRT(timeline.captions); }
  generateASS(timeline: BuiltTimeline): string { return this.captionRenderer.toASS(timeline.captions, timeline.sequence.width, timeline.sequence.height); }

  estimateOutputSize(timeline: BuiltTimeline, quality: 'high' | 'medium' | 'low'): number {
    const preset = QUALITY_PRESETS[quality];
    const vbps = parseInt(preset.videoBitrate) * 1000;
    const abps = parseInt(preset.audioBitrate) * 1000;
    return Math.round((vbps + abps) * (timeline.durationMs / 1000) / 8 / 1024 / 1024);
  }
}
