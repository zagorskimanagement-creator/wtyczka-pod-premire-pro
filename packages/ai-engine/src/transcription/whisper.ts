import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAIClient } from '../clients/openai.js';
import type { FullTranscript, TranscriptWord } from '../types.js';

const execAsync = promisify(exec);

const FILLER_WORDS = new Set([
  'um', 'uh', 'uhh', 'umm', 'hmm', 'ah', 'ahh',
  'like', 'you know', 'basically', 'literally', 'actually',
  'honestly', 'right', 'okay', 'ok', 'so', 'well', 'i mean',
  'kind of', 'sort of', 'you see', 'right?', 'okay?',
]);

const SILENCE_THRESHOLD_MS = 500;

export class WhisperTranscriber {
  private openai: OpenAIClient;

  constructor() {
    this.openai = new OpenAIClient();
  }

  async transcribe(videoPath: string, language = 'en'): Promise<FullTranscript> {
    const audioPath = await this.extractAudio(videoPath);

    try {
      const raw = await this.openai.transcribeAudio(audioPath, language);

      const words = this.processWords(raw.words);
      const segments = this.buildSegments(words);
      const fullText = this.buildCleanText(words);

      return {
        text: fullText,
        language: raw.language,
        confidence: this.calculateConfidence(words),
        durationMs: words.length > 0 ? words[words.length - 1].end * 1000 : 0,
        words,
        segments,
      };
    } finally {
      await fs.unlink(audioPath).catch(() => null);
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    const outputPath = path.join(
      path.dirname(videoPath),
      `audio_${Date.now()}.mp3`,
    );
    const ffmpegPath = process.env['FFMPEG_PATH'] ?? 'ffmpeg';

    await execAsync(
      `${ffmpegPath} -i "${videoPath}" -vn -acodec mp3 -ar 16000 -ac 1 -ab 128k "${outputPath}" -y`,
    );

    return outputPath;
  }

  private processWords(rawWords: Array<{ word: string; start: number; end: number }>): TranscriptWord[] {
    return rawWords.map((w) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
      confidence: 0.95,
    }));
  }

  private buildSegments(words: TranscriptWord[]) {
    const segments: Array<{
      text: string;
      startMs: number;
      endMs: number;
      words: TranscriptWord[];
      isFiller: boolean;
      isSilence: boolean;
    }> = [];

    let currentGroup: TranscriptWord[] = [];
    let lastEndMs = 0;

    for (const word of words) {
      const startMs = word.start * 1000;
      const endMs = word.end * 1000;
      const gap = startMs - lastEndMs;
      const isFiller = FILLER_WORDS.has(word.word.toLowerCase());

      if (gap > SILENCE_THRESHOLD_MS && currentGroup.length > 0) {
        segments.push(this.buildSegment(currentGroup, false, false));
        segments.push({
          text: '',
          startMs: lastEndMs,
          endMs: startMs,
          words: [],
          isFiller: false,
          isSilence: true,
        });
        currentGroup = [];
      }

      if (isFiller) {
        if (currentGroup.length > 0) {
          segments.push(this.buildSegment(currentGroup, false, false));
          currentGroup = [];
        }
        segments.push(this.buildSegment([word], true, false));
      } else {
        currentGroup.push(word);
      }

      lastEndMs = endMs;
    }

    if (currentGroup.length > 0) {
      segments.push(this.buildSegment(currentGroup, false, false));
    }

    return segments;
  }

  private buildSegment(words: TranscriptWord[], isFiller: boolean, isSilence: boolean) {
    return {
      text: words.map((w) => w.word).join(' '),
      startMs: Math.round(words[0].start * 1000),
      endMs: Math.round(words[words.length - 1].end * 1000),
      words,
      isFiller,
      isSilence,
    };
  }

  private buildCleanText(words: TranscriptWord[]): string {
    return words
      .filter((w) => !FILLER_WORDS.has(w.word.toLowerCase()))
      .map((w) => w.word)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateConfidence(words: TranscriptWord[]): number {
    if (words.length === 0) return 0;
    const total = words.reduce((sum, w) => sum + (w.confidence ?? 0.9), 0);
    return total / words.length;
  }

  identifyFillerWords(words: TranscriptWord[]): TranscriptWord[] {
    return words.filter((w) => FILLER_WORDS.has(w.word.toLowerCase()));
  }

  identifySilences(words: TranscriptWord[]): Array<{ startMs: number; endMs: number; durationMs: number }> {
    const silences: Array<{ startMs: number; endMs: number; durationMs: number }> = [];

    for (let i = 1; i < words.length; i++) {
      const prevEnd = words[i - 1].end * 1000;
      const currStart = words[i].start * 1000;
      const gap = currStart - prevEnd;

      if (gap >= SILENCE_THRESHOLD_MS) {
        silences.push({
          startMs: Math.round(prevEnd),
          endMs: Math.round(currStart),
          durationMs: Math.round(gap),
        });
      }
    }

    return silences;
  }
}
