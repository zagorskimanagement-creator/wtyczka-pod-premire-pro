import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface VideoMetadata { durationSeconds: number | null; width: number | null; height: number | null; fps: number | null; bitrate: number | null; codec: string | null; audioCodec: string | null; sizeBytes: bigint; }

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  const stat = await fs.stat(filePath);
  const sizeBytes = BigInt(stat.size);
  const ffprobePath = process.env['FFPROBE_PATH'] ?? 'ffprobe';
  try {
    const { stdout } = await execAsync(`${ffprobePath} -v quiet -print_format json -show_streams -show_format "${filePath}"`);
    const data = JSON.parse(stdout) as { streams?: Array<{ codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }>; format?: { duration?: string; bit_rate?: string } };
    const videoStream = data.streams?.find((s) => s.codec_type === 'video');
    const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
    let fps: number | null = null;
    if (videoStream?.r_frame_rate) { const [num, den] = videoStream.r_frame_rate.split('/').map(Number); fps = den ? num / den : null; }
    return { durationSeconds: data.format?.duration ? parseFloat(data.format.duration) : null, width: videoStream?.width ?? null, height: videoStream?.height ?? null, fps, bitrate: data.format?.bit_rate ? parseInt(data.format.bit_rate, 10) : null, codec: videoStream?.codec_name ?? null, audioCodec: audioStream?.codec_name ?? null, sizeBytes };
  } catch {
    return { durationSeconds: null, width: null, height: null, fps: null, bitrate: null, codec: null, audioCodec: null, sizeBytes };
  }
}
