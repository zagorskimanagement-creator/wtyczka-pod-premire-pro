import * as Sentry from '@sentry/node';

export interface TelemetryConfig { sentryDsn?: string; environment: string; release?: string; tracesSampleRate: number; enabled: boolean; }

let initialized = false;

export function initTelemetry(config: TelemetryConfig): void {
  if (initialized || !config.enabled) return;
  if (config.sentryDsn) {
    Sentry.init({ dsn: config.sentryDsn, environment: config.environment, release: config.release, tracesSampleRate: config.tracesSampleRate, integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()] });
  }
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => { if (context) scope.setExtras(context); Sentry.captureException(error); });
}

export function captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => { if (context) scope.setExtras(context); Sentry.captureMessage(message, level); });
}

export function setUser(userId: string, email?: string): void { if (!initialized) return; Sentry.setUser({ id: userId, email }); }
export function clearUser(): void { if (!initialized) return; Sentry.setUser(null); }
export function startTransaction(name: string, op: string): Sentry.Span | undefined { if (!initialized) return undefined; return Sentry.startInactiveSpan({ name, op }); }
export async function withSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> { if (!initialized) return fn(); return Sentry.startSpan({ name, op }, fn); }
