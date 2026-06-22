import { ClaudeClient } from '../clients/claude.js';

interface GeneratedMetadata {
  title: string;
  description: string;
  hashtags: string[];
  thumbnailConcept: string;
  bestPostingTime: string;
  targetAudience: string;
  estimatedViews: string;
}

export class MetadataGenerator {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  async generate(
    clipText: string,
    platform: string,
    emotionType: string,
    viralScore: number,
  ): Promise<GeneratedMetadata> {
    const platformGuide: Record<string, string> = {
      TIKTOK: 'TikTok (casual, energetic, trending sounds, 150 char description)',
      INSTAGRAM_REELS: 'Instagram Reels (aesthetic, lifestyle, 2200 char description)',
      YOUTUBE_SHORTS: 'YouTube Shorts (search-optimized, clear value prop, 5000 char description)',
    };

    const prompt = `Generate viral metadata for this ${platformGuide[platform] ?? 'social media'} clip.

CLIP CONTENT:
${clipText.slice(0, 2000)}

CLIP STATS:
- Viral Score: ${viralScore}/100
- Primary Emotion: ${emotionType}
- Platform: ${platform}

Return JSON:
{
  "title": "Viral hook title (max 100 chars, no emojis in title)",
  "description": "Platform-optimized description with call-to-action",
  "hashtags": ["tag1", "tag2", ...] (15 hashtags max, mix trending and niche),
  "thumbnailConcept": "Description of ideal thumbnail",
  "bestPostingTime": "Day and time recommendation",
  "targetAudience": "Primary audience description",
  "estimatedViews": "Conservative view estimate range"
}

Rules:
- Title must create MASSIVE curiosity
- Use numbers when possible
- ${platform === 'TIKTOK' ? 'Keep title under 60 chars for TikTok' : ''}
- Hashtags should be a mix of: 5 mega-viral, 5 niche, 5 topic-specific`;

    return this.claude.messageJSON<GeneratedMetadata>(prompt, { temperature: 0.7 });
  }

  async generateABTestVariants(
    originalTitle: string,
    clipText: string,
  ): Promise<{ variants: string[]; recommendation: string }> {
    const prompt = `Create 3 A/B test variants for this viral video title.

ORIGINAL: "${originalTitle}"
CLIP CONTENT: ${clipText.slice(0, 500)}

Return JSON:
{
  "variants": ["variant1", "variant2", "variant3"],
  "recommendation": "Which variant and why"
}

Each variant should use a different psychological trigger:
1. Curiosity gap
2. Controversy/contrarian
3. Specific outcome/number`;

    return this.claude.messageJSON<{ variants: string[]; recommendation: string }>(prompt);
  }
}
