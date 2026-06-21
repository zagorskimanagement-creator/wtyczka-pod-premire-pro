import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import * as Sentry from '@sentry/node';

let sdk: NodeSDK | null = null;

export function initTelemetry() {
  if (process.env['SENTRY_DSN']) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
      integrations: [new Sentry.Integrations.Http({ tracing: true }), new Sentry.Integrations.Express()],
    });
  }
  if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
    sdk = new NodeSDK({
      resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: 'shortforge-api', [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0', [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] ?? 'development' }),
      traceExporter: new OTLPTraceExporter({ url: `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/traces` }),
    });
    sdk.start();
  }
}

export function shutdownTelemetry() { return sdk?.shutdown(); }
export function captureException(error: Error, context?: Record<string, unknown>) { Sentry.captureException(error, { extra: context }); }
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') { Sentry.captureMessage(message, level); }
