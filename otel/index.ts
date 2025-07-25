import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { CustomProtobufExporter, WANDB_BASE_URL, project_id } from './exporter.js';

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'frontline_mcp',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'service.instance.id': 'mcp-server-instance',
    'deployment.environment': 'development',
});

// Create the exporter instance
const exporter = new CustomProtobufExporter(
    WANDB_BASE_URL + "/otel/v1/traces",
    {
        "Authorization": `Basic ${Buffer.from(`api:${process.env.WANDB_API_KEY}`).toString('base64')}`,
        "project_id": project_id,
    }
);

export const sdk = new NodeSDK({
    resource: resource,
    traceExporter: exporter,
    // Use BatchSpanProcessor for better performance
    spanProcessor: new BatchSpanProcessor(exporter),
    // Configure sampling to capture more traces
    sampler: new TraceIdRatioBasedSampler(1.0), // Sample 100% of traces
    metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});
