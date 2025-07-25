import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { ExportResult } from '@opentelemetry/core';
import { ProtobufConverter } from './protobuf-converter.js';

export const WANDB_BASE_URL = "https://trace.wandb.ai"
export const project_id = "lois-zh/frontline_mcp"

// Custom protobuf exporter that converts spans to protobuf format
export class CustomProtobufExporter implements SpanExporter {
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
            //  console.log(`Exporting ${spans.length} spans to W&B`);
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
