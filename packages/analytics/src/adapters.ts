import type { AnalyticsAdapter } from './tracker.js';
import type { AnyEvent } from './events.js';

export class ConsoleAdapter implements AnalyticsAdapter {
  async track(event: AnyEvent): Promise<void> { console.log('[Analytics]', event.name, { userId: event.userId, projectId: event.projectId, timestamp: event.timestamp.toISOString(), ...('properties' in event && event.properties ? event.properties as Record<string, unknown> : {}) }); }
  async identify(userId: string, traits: Record<string, unknown>): Promise<void> { console.log('[Analytics] identify', userId, traits); }
  async flush(): Promise<void> {}
}

export class DatabaseAdapter implements AnalyticsAdapter {
  private buffer: AnyEvent[] = [];
  constructor(private readonly saveEvents: (events: AnyEvent[]) => Promise<void>) {}
  async track(event: AnyEvent): Promise<void> { this.buffer.push(event); if (this.buffer.length >= 100) await this.flush(); }
  async identify(_userId: string, _traits: Record<string, unknown>): Promise<void> {}
  async flush(): Promise<void> { if (this.buffer.length === 0) return; await this.saveEvents(this.buffer.splice(0, this.buffer.length)); }
}

export class PostHogAdapter implements AnalyticsAdapter {
  private endpoint: string;
  private buffer: Array<{ event: string; distinct_id: string; properties: Record<string, unknown>; timestamp: string }> = [];
  constructor(private readonly apiKey: string, host = 'https://app.posthog.com') { this.endpoint = `${host}/batch`; }
  async track(event: AnyEvent): Promise<void> {
    this.buffer.push({ event: event.name, distinct_id: event.userId ?? event.sessionId ?? 'anonymous', properties: { ...('properties' in event && event.properties ? event.properties as Record<string, unknown> : {}), $session_id: event.sessionId, project_id: event.projectId }, timestamp: event.timestamp.toISOString() });
  }
  async identify(userId: string, traits: Record<string, unknown>): Promise<void> { this.buffer.push({ event: '$identify', distinct_id: userId, properties: { $set: traits }, timestamp: new Date().toISOString() }); }
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const res = await fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: this.apiKey, batch }) });
      if (!res.ok) { console.error('[PostHog] flush failed:', res.status); this.buffer.unshift(...batch); }
    } catch (err) { console.error('[PostHog] Network error:', err); this.buffer.unshift(...batch); }
  }
}

export class MetricsAdapter implements AnalyticsAdapter {
  private counters: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();
  async track(event: AnyEvent): Promise<void> {
    this.counters.set(event.name, (this.counters.get(event.name) ?? 0) + 1);
    const props = ('properties' in event && event.properties) ? event.properties as Record<string, unknown> : {};
    if (typeof props['processingTimeMs'] === 'number') { const t = this.timings.get(event.name) ?? []; t.push(props['processingTimeMs']); this.timings.set(event.name, t); }
  }
  async identify(_u: string, _t: Record<string, unknown>): Promise<void> {}
  async flush(): Promise<void> {}
  getMetrics(): { counts: Record<string, number>; avgTimings: Record<string, number> } {
    const counts: Record<string, number> = {}, avgTimings: Record<string, number> = {};
    for (const [k,v] of this.counters) counts[k] = v;
    for (const [k,vs] of this.timings) avgTimings[k] = vs.reduce((a,b)=>a+b,0)/vs.length;
    return { counts, avgTimings };
  }
}
