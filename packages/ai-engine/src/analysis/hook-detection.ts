import { ClaudeClient } from '../clients/claude.js';
import type { Hook, TranscriptSegment, FullTranscript } from '../types.js';

interface HookDetectionResult {
  hooks: Hook[];
  bestHook: Hook | null;
  hookDensity: number;
  recommendedOpeningMs: number;
}

export class HookDetector {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  async detectHooks(transcript: FullTranscript): Promise<HookDetectionResult> {
    const textWithTimings = this.formatTranscriptForAnalysis(transcript);

    const prompt = `Analyze this video transcript to find viral hooks and engaging moments.

TRANSCRIPT:
${textWithTimings}

Find all hooks - moments that would make viewers STOP SCROLLING and watch.

Return JSON:
{
  "hooks": [
    {
      "text": "exact quote from transcript",
      "startMs": number,
      "endMs": number,
      "type": "controversial|surprising|emotional|curiosity|story|question",
      "score": number (0-100),
      "reason": "why this is a hook"
    }
  ],
  "bestHook": {same structure as above or null},
  "hookDensity": number (hooks per minute),
  "recommendedOpeningMs": number (best timestamp to start the clip)
}

Hook scoring criteria:
- Controversial statements that challenge beliefs: 90-100
- Surprising statistics or revelations: 80-95
- Emotional peaks (anger, joy, shock, inspiration): 75-90
- Pattern interrupts and curiosity gaps: 70-85
- Strong personal stories: 65-80
- Questions that demand answers: 60-75

The best hook should appear in the first 3 seconds of content.`;

    const result = await this.claude.messageJSON<HookDetectionResult>(prompt, {
      temperature: 0.4,
    });

    result.hooks.sort((a, b) => b.score - a.score);
    return result;
  }

  private formatTranscriptForAnalysis(transcript: FullTranscript): string {
    return transcript.words
      .map((w) => `[${Math.round(w.start * 1000)}ms] ${w.word}`)
      .join(' ')
      .slice(0, 8000);
  }

  scoreSegmentAsHook(segment: TranscriptSegment): number {
    let score = 0;
    const text = segment.text.toLowerCase();

    const patterns: Array<[RegExp, number]> = [
      [/\b(never|always|nobody|everybody|no one|everyone)\b/i, 15],
      [/\b(secret|reveal|truth|real reason|exposed)\b/i, 20],
      [/\b(mistake|wrong|lie|myth|debunk)\b/i, 18],
      [/\b(shocking|insane|crazy|unbelievable|impossible)\b/i, 15],
      [/\b(million|billion|percent|%)\b/i, 10],
      [/\?$/, 12],
      [/\b(i was|i made|i lost|i gained|i discovered)\b/i, 14],
      [/\b(you need to|you should|stop|start|quit)\b/i, 12],
      [/\b(step \d|number \d|\d things)\b/i, 8],
      [/\b(if you|when you|before you|after you)\b/i, 8],
    ];

    for (const [pattern, points] of patterns) {
      if (pattern.test(text)) score += points;
    }

    const wordCount = segment.text.split(' ').length;
    const durationMs = segment.endMs - segment.startMs;
    const wordsPerSecond = wordCount / (durationMs / 1000);
    if (wordsPerSecond > 2.5) score += 10;
    if (wordsPerSecond > 3.5) score += 5;

    if (segment.sentimentScore !== undefined && Math.abs(segment.sentimentScore) > 0.7) {
      score += 15;
    }

    return Math.min(100, score);
  }

  findOpeningHook(hooks: Hook[], maxOpeningMs = 30000): Hook | null {
    const earlyHooks = hooks.filter((h) => h.startMs <= maxOpeningMs);
    if (earlyHooks.length === 0) return hooks[0] ?? null;
    return earlyHooks.reduce((best, h) => h.score > best.score ? h : best);
  }
}
