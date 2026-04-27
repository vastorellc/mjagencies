import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
// ATTR_SERVICE_NAMESPACE and ATTR_DEPLOYMENT_ENVIRONMENT_NAME are experimental/incubating
// in @opentelemetry/semantic-conventions@1.36.0 — import from /incubating path (07-04 fix)
import {
  ATTR_SERVICE_NAMESPACE,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions/incubating'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'

export function startNodeSdk(opts: { agencyId: string }): NodeSDK {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: `mjagency-${opts.agencyId}`,
      [ATTR_SERVICE_NAMESPACE]: 'mjagency',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? 'development',
      'agency.id': opts.agencyId,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      new PinoInstrumentation(),
    ],
  })
  sdk.start()
  process.on('SIGTERM', () => sdk.shutdown().catch(() => {}).finally(() => process.exit(0)))
  return sdk
}
