import type { AnyEvent, BaseEvent, EventName } from './events.js';

export interface AnalyticsAdapter { track(event: AnyEvent): Promise<void>; identify(userId: string, traits: Record<string, unknown>): Promise<void>; flush(): Promise<void>; }
export interface TrackerConfig { adapters: AnalyticsAdapter[]; enabled: boolean; sessionId?: string; userId?: string; }

export class AnalyticsTracker {
  private config: TrackerConfig;
  private queue: AnyEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: TrackerConfig) {
    this.config = config;
    if (this.config.enabled) this.scheduleFlush();
  }

  setUser(userId: string): void { this.config.userId = userId; }
  clearUser(): void { this.config.userId = undefined; }

  track(name: EventName, properties: Record<string, unknown> = {}, overrides: Partial<BaseEvent> = {}): void {
    if (!this.config.enabled) return;
    this.queue.push({ name, timestamp: new Date(), sessionId: this.config.sessionId, userId: overrides.userId ?? this.config.userId, projectId: overrides.projectId, properties } as AnyEvent);
    if (this.queue.length >= 50) void this.flush();
  }

  async identify(userId: string, traits: Record<string, unknown> = {}): Promise<void> {
    if (!this.config.enabled) return;
    this.setUser(userId);
    await Promise.allSettled(this.config.adapters.map((a) => a.identify(userId, traits)));
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, this.queue.length);
    await Promise.allSettled(events.flatMap((event) => this.config.adapters.map((a) => a.track(event))));
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    await this.flush();
    await Promise.allSettled(this.config.adapters.map((a) => a.flush()));
  }

  private scheduleFlush(): void {
    this.flushTimer = setTimeout(async () => { await this.flush(); if (this.config.enabled) this.scheduleFlush(); }, 5000);
  }
}
