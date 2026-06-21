import { ClaudeClient } from '../clients/claude.js';
import type { ContentTopic, TranscriptSegment, FullTranscript } from '../types.js';

interface SegmentationResult {
  topics: ContentTopic[];
  sections: Array<{
    title: string;
    startMs: number;
    endMs: number;
    type: 'intro' | 'story' | 'main-point' | 'example' | 'cta' | 'conclusion';
  }>;
  overallTheme: string;
  contentType: string;
}

export class ContentSegmenter {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  async segment(transcript: FullTranscript): Promise<SegmentationResult> {
    const CHUNK_SIZE = 4000;
    const text = transcript.text;

    if (text.length > CHUNK_SIZE) {
      return this.segmentLargeTranscript(transcript);
    }

    return this.segmentWithClaude(transcript);
  }

  private async segmentWithClaude(transcript: FullTranscript): Promise<SegmentationResult> {
    const wordTimings = transcript.words.map((w, i) =>
      `[${this.msToTimestamp(Math.round(w.start * 1000))}] ${w.word}`
    ).join(' ');

    const prompt = `Analyze this video transcript and segment it into coherent topics and sections.

TRANSCRIPT WITH TIMESTAMPS:
${wordTimings}

Return a JSON object with this exact structure:
{
  "topics": [
    {
      "title": "string",
      "startMs": number,
      "endMs": number,
      "summary": "string",
      "keyPoints": ["string"],
      "sentiment": "positive|negative|neutral"
    }
  ],
  "sections": [
    {
      "title": "string",
      "startMs": number,
      "endMs": number,
      "type": "intro|story|main-point|example|cta|conclusion"
    }
  ],
  "overallTheme": "string",
  "contentType": "educational|entertainment|motivational|tutorial|interview|vlog|other"
}

Rules:
- Use exact millisecond timestamps from the transcript
- Keep topics between 30-120 seconds
- Identify the natural story arc`;

    return this.claude.messageJSON<SegmentationResult>(prompt, {
      systemPrompt: 'You are an expert content analyst. Always respond with valid JSON.',
      temperature: 0.3,
    });
  }

  private async segmentLargeTranscript(transcript: FullTranscript): Promise<SegmentationResult> {
    const CHUNK_DURATION_MS = 300000;
    const chunks: FullTranscript[] = [];

    let chunkStart = 0;
    while (chunkStart < transcript.durationMs) {
      const chunkEnd = Math.min(chunkStart + CHUNK_DURATION_MS, transcript.durationMs);
      const chunkWords = transcript.words.filter(
        (w) => w.start * 1000 >= chunkStart && w.start * 1000 < chunkEnd,
      );

      chunks.push({
        ...transcript,
        words: chunkWords,
        text: chunkWords.map((w) => w.word).join(' '),
        durationMs: chunkEnd - chunkStart,
      });

      chunkStart = chunkEnd;
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) => this.segmentWithClaude(chunk)),
    );

    return this.mergeSegmentationResults(chunkResults);
  }

  private mergeSegmentationResults(results: SegmentationResult[]): SegmentationResult {
    const allTopics: ContentTopic[] = [];
    const allSections: SegmentationResult['sections'] = [];

    for (const result of results) {
      allTopics.push(...result.topics);
      allSections.push(...result.sections);
    }

    return {
      topics: allTopics,
      sections: allSections,
      overallTheme: results[0]?.overallTheme ?? 'General content',
      contentType: results[0]?.contentType ?? 'other',
    };
  }

  private msToTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  enrichSegmentsWithTopics(
    segments: TranscriptSegment[],
    topics: ContentTopic[],
  ): TranscriptSegment[] {
    return segments.map((segment) => {
      const topic = topics.find(
        (t) => segment.startMs >= t.startMs && segment.endMs <= t.endMs,
      );
      return {
        ...segment,
        topic: topic?.title,
        sentiment: (topic?.sentiment as 'positive' | 'negative' | 'neutral') ?? 'neutral',
        sentimentScore: topic?.sentiment === 'positive' ? 0.7
          : topic?.sentiment === 'negative' ? -0.7 : 0,
      };
    });
  }
}
