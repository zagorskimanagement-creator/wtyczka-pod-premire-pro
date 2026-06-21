import OpenAI from 'openai';

export class OpenAIClient {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      organization: process.env['OPENAI_ORG_ID'],
      maxRetries: 3,
      timeout: 120000,
    });
    this.model = process.env['OPENAI_MODEL'] ?? 'gpt-4o';
  }

  async transcribeAudio(audioPath: string, language = 'en'): Promise<{
    text: string;
    words: Array<{ word: string; start: number; end: number }>;
    language: string;
  }> {
    const fs = await import('fs');
    const audioFile = fs.createReadStream(audioPath);

    const response = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const words = (response.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    return {
      text: response.text,
      words,
      language: response.language,
    };
  }

  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json' | 'text';
      model?: string;
    } = {},
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options.model ?? this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
      response_format: options.responseFormat === 'json'
        ? { type: 'json_object' }
        : { type: 'text' },
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async chatJSON<T>(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<T> {
    const text = await this.chat(messages, { ...options, responseFormat: 'json' });
    return JSON.parse(text) as T;
  }
}
