import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
      maxRetries: 3,
      timeout: 120000,
    });
    this.model = process.env['CLAUDE_MODEL'] ?? 'claude-opus-4-8';
  }

  async message(
    prompt: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {},
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: options.model ?? this.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      system: options.systemPrompt ?? 'You are an expert video editor and content strategist specializing in short-form viral content.',
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return '';
    return content.text;
  }

  async messageJSON<T>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<T> {
    const systemPrompt = options?.systemPrompt
      ? `${options.systemPrompt}\n\nAlways respond with valid JSON only. No markdown, no explanation.`
      : 'You are an expert video editor. Always respond with valid JSON only. No markdown, no explanation.';

    const text = await this.message(prompt, { ...options, systemPrompt });

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }

  async analyzeContent(
    transcript: string,
    instructions: string,
  ): Promise<string> {
    return this.message(
      `Transcript:\n${transcript}\n\n${instructions}`,
      {
        systemPrompt: 'You are an expert content strategist and viral video editor with deep understanding of TikTok, Instagram Reels, and YouTube Shorts. Analyze content and provide actionable insights.',
        temperature: 0.5,
        maxTokens: 8192,
      },
    );
  }
}
