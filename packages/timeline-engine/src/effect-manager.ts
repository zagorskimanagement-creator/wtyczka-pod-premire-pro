import type { EffectDef } from './types.js';

export interface EffectFilterChain {
  videoFilters: string[];
  audioFilters: string[];
}

export class EffectManager {
  toFFmpegFilters(effects: EffectDef[]): EffectFilterChain {
    const videoFilters: string[] = [];
    const audioFilters: string[] = [];

    for (const effect of effects) {
      switch (effect.type) {
        case 'color-grade':
          videoFilters.push(this.colorGradeFilter(effect.intensity));
          break;
        case 'vignette':
          videoFilters.push(this.vignetteFilter(effect.intensity));
          break;
        case 'film-grain':
          videoFilters.push(this.filmGrainFilter(effect.intensity));
          break;
        case 'sharpen':
          videoFilters.push(this.sharpenFilter(effect.intensity));
          break;
        case 'punch-in':
          videoFilters.push(this.punchInFilter(effect.startMs, effect.endMs, effect.intensity));
          break;
      }
    }

    return { videoFilters, audioFilters };
  }

  buildFilterString(effects: EffectDef[]): string {
    const { videoFilters } = this.toFFmpegFilters(effects);
    return videoFilters.filter(Boolean).join(',');
  }

  private colorGradeFilter(intensity: number): string {
    const contrast = 1 + intensity * 0.2;
    const saturation = 1 + intensity * 0.3;
    const brightness = 1 + intensity * 0.02;
    return `eq=contrast=${contrast.toFixed(2)}:saturation=${saturation.toFixed(2)}:brightness=${brightness.toFixed(2)}`;
  }

  private vignetteFilter(intensity: number): string {
    const angle = (Math.PI / 5) * intensity;
    return `vignette=angle=${angle.toFixed(3)}:mode=forward`;
  }

  private filmGrainFilter(intensity: number): string {
    const strength = Math.round(intensity * 50);
    return `noise=alls=${strength}:allf=t+u`;
  }

  private sharpenFilter(intensity: number): string {
    const amount = 0.5 + intensity * 2;
    return `unsharp=5:5:${amount.toFixed(1)}:5:5:0`;
  }

  private punchInFilter(startMs: number, endMs: number, intensity: number): string {
    const scale = 1 + intensity * 0.15;
    const startSec = (startMs / 1000).toFixed(3);
    const endSec = (endMs / 1000).toFixed(3);
    return `zoompan=z='if(between(t,${startSec},${endSec}),${scale.toFixed(2)},1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:fps=30`;
  }

  validateEffects(effects: EffectDef[]): string[] {
    const errors: string[] = [];
    for (const effect of effects) {
      if (effect.startMs >= effect.endMs) {
        errors.push(`Effect ${effect.type}: startMs must be less than endMs`);
      }
      if (effect.intensity < 0 || effect.intensity > 1) {
        errors.push(`Effect ${effect.type}: intensity must be between 0 and 1`);
      }
    }
    return errors;
  }
}
