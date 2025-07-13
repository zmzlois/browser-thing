import { op, init } from "weave";
import protobuf from "protobufjs";
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { ExportResult } from '@opentelemetry/core';
import { ProtobufConverter } from './protobuf-converter.js';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export const WANDB_BASE_URL = "https://trace.wandb.ai"
export const project_id = "lois-zh/frontline_mcp"

// Custom protobuf exporter that converts spans to protobuf format
class CustomProtobufExporter implements SpanExporter {
    private url: string;
    private headers: Record<string, string>;
    private converter: ProtobufConverter;

    constructor(url: string, headers: Record<string, string>) {
        this.url = url;
        this.headers = headers;
        this.converter = new ProtobufConverter();
    }

    async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
        try {
            console.log(`Exporting ${spans.length} spans to W&B`);
            // Convert spans to protobuf format using the proper converter
            const protobufData = this.converter.convertSpansToProtobuf(spans);
            
            // Send the protobuf data
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-protobuf',
                },
                body: protobufData,
            });

            if (response.ok) {
                console.log(`✅ Successfully exported ${spans.length} spans to W&B`);
                resultCallback({ code: 0 });
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to export spans:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: errorText
                });
                resultCallback({ code: 1, error: new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`) });
            }
        } catch (error) {
            console.error('Error exporting spans:', error);
            resultCallback({ code: 1, error: error as Error });
        }
    }

    async shutdown(): Promise<void> {
        // Cleanup if needed
    }
}

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

console.log("bearer", `Bearer ${Buffer.from(`api:${process.env.WANDB_API_KEY}`).toString('base64')}`)
