import type { BRollSuggestion } from '@shortforge/shared';

export interface ConceptMatch {
  concept: string;
  startMs: number;
  endMs: number;
  keywords: string[];
  category: 'business' | 'nature' | 'people' | 'technology' | 'money' | 'abstract' | 'lifestyle';
  searchQuery: string;
  confidence: number;
}

const CONCEPT_PATTERNS: Array<{
  pattern: RegExp;
  category: ConceptMatch['category'];
  searchQuery: string;
  keywords: string[];
}> = [
  {
    pattern: /\b(revenue|income|profit|money|cash|earnings|dollars?|million|billion)\b/i,
    category: 'money',
    searchQuery: 'money business success finance',
    keywords: ['money', 'finance', 'success'],
  },
  {
    pattern: /\b(office|work|business|meeting|team|company|startup)\b/i,
    category: 'business',
    searchQuery: 'modern office business team meeting',
    keywords: ['business', 'office', 'corporate'],
  },
  {
    pattern: /\b(technology|software|app|ai|computer|phone|digital)\b/i,
    category: 'technology',
    searchQuery: 'technology innovation digital future',
    keywords: ['technology', 'digital', 'innovation'],
  },
  {
    pattern: /\b(nature|outdoor|travel|adventure|explore|mountain|beach|forest)\b/i,
    category: 'nature',
    searchQuery: 'beautiful nature outdoors travel adventure',
    keywords: ['nature', 'travel', 'adventure'],
  },
  {
    pattern: /\b(people|crowd|city|street|lifestyle|urban|community)\b/i,
    category: 'people',
    searchQuery: 'diverse people lifestyle urban city',
    keywords: ['lifestyle', 'people', 'community'],
  },
  {
    pattern: /\b(growth|chart|graph|increase|statistics|data|analytics)\b/i,
    category: 'business',
    searchQuery: 'business growth chart analytics data',
    keywords: ['growth', 'analytics', 'data'],
  },
  {
    pattern: /\b(mindset|motivation|success|goal|achieve|potential|transform)\b/i,
    category: 'abstract',
    searchQuery: 'motivation success mindset achievement',
    keywords: ['motivation', 'success', 'mindset'],
  },
];

export class BRollEngine {
  analyzeTranscript(
    words: Array<{ word: string; start: number; end: number }>,
    minGapMs = 3000,
  ): ConceptMatch[] {
    const matches: ConceptMatch[] = [];
    const windowSize = 10;

    for (let i = 0; i < words.length; i += Math.floor(windowSize / 2)) {
      const window = words.slice(i, i + windowSize);
      if (window.length < 3) continue;

      const windowText = window.map((w) => w.word).join(' ');
      const startMs = Math.round(window[0].start * 1000);
      const endMs = Math.round(window[window.length - 1].end * 1000);

      if (endMs - startMs < minGapMs) continue;

      for (const pattern of CONCEPT_PATTERNS) {
        if (pattern.pattern.test(windowText)) {
          const lastMatch = matches[matches.length - 1];
          if (lastMatch && startMs - lastMatch.endMs < 5000) continue;

          matches.push({
            concept: pattern.category,
            startMs,
            endMs,
            keywords: pattern.keywords,
            category: pattern.category,
            searchQuery: pattern.searchQuery,
            confidence: 0.8,
          });
          break;
        }
      }
    }

    return matches.slice(0, 10);
  }

  convertToBRollSuggestions(matches: ConceptMatch[]): BRollSuggestion[] {
    return matches.map((match) => ({
      atMs: match.startMs,
      durationMs: Math.min(match.endMs - match.startMs, 5000),
      concept: match.concept,
      searchQuery: match.searchQuery,
      keywords: match.keywords,
      category: match.category,
    }));
  }

  rankByRelevance(
    suggestions: BRollSuggestion[],
    transcript: string,
  ): BRollSuggestion[] {
    return suggestions.sort((a, b) => {
      const aScore = a.keywords.filter((k) =>
        transcript.toLowerCase().includes(k.toLowerCase()),
      ).length;
      const bScore = b.keywords.filter((k) =>
        transcript.toLowerCase().includes(k.toLowerCase()),
      ).length;
      return bScore - aScore;
    });
  }
}
