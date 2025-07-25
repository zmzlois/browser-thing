import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

// Manual protobuf encoder for OTLP ExportTraceServiceRequest
// Based on the working format from Weave tests
export class ProtobufConverter {
    constructor() {
        console.log('✅ Manual protobuf converter initialized');
    }

    convertSpansToProtobuf(spans: ReadableSpan[]): Uint8Array {
        console.log("Converting", spans.length, "spans to protobuf...");

        try {
            // Create a simplified protobuf message that matches the working test format
            const resourceSpans = this.encodeResourceSpans(spans);
            const exportRequest = this.encodeExportTraceServiceRequest(resourceSpans);
            
            console.log('✅ Protobuf conversion successful! Length:', exportRequest.length, 'bytes');
            return exportRequest;
        } catch (error) {
            console.error('❌ Error in convertSpansToProtobuf:', error);
            throw error;
        }
    }

    private encodeExportTraceServiceRequest(resourceSpans: Uint8Array): Uint8Array {
        // ExportTraceServiceRequest: field 1 = repeated ResourceSpans resource_spans
        return this.encodeMessage([
            this.encodeField(1, 2, resourceSpans) // field 1, wire type 2 (length-delimited)
        ]);
    }

    private encodeResourceSpans(spans: ReadableSpan[]): Uint8Array {
        const convertedSpans = spans.map(span => this.convertSpan(span));

        // Resource (field 1)
        const resource = this.encodeResource();

        // ScopeSpans (field 2)
        const scopeSpans = this.encodeScopeSpans(convertedSpans);

        return this.encodeMessage([
            this.encodeField(1, 2, resource),    // field 1: resource
            this.encodeField(2, 2, scopeSpans)   // field 2: scope_spans (repeated)
        ]);
    }

    private encodeResource(): Uint8Array {
        // Resource with service attributes
        const attributes = [
            this.encodeKeyValue("service.name", "frontline_mcp"),
            this.encodeKeyValue("service.version", "1.0.0")
        ];

        return this.encodeMessage([
            ...attributes.map(attr => this.encodeField(1, 2, attr)) // field 1: attributes (repeated)
        ]);
    }

    private encodeScopeSpans(spans: Uint8Array[]): Uint8Array {
        // InstrumentationScope (field 1)
        const scope = this.encodeMessage([
            this.encodeField(1, 2, this.encodeString("@opentelemetry/auto-instrumentations-node")), // name
            this.encodeField(2, 2, this.encodeString("1.0.0")) // version
        ]);

        // Spans (field 2)
        const spansData = spans.map(span => this.encodeField(2, 2, span));

        return this.encodeMessage([
            this.encodeField(1, 2, scope), // field 1: scope
            ...spansData // field 2: spans (repeated)
        ]);
    }

    private convertSpan(span: ReadableSpan): Uint8Array {
        const spanContext = span.spanContext();
        
        // Convert time properly - OpenTelemetry uses [seconds, nanoseconds]
        const startTimeNano = this.convertTimeToNano(span.startTime);
        const endTimeNano = this.convertTimeToNano(span.endTime);

        // Get parent span ID
        let parentSpanId = new Uint8Array(0);
        if (span.parentSpanContext) {
            parentSpanId = this.hexToBytes(span.parentSpanContext.spanId);
        }
        
        const traceId = this.hexToBytes(spanContext.traceId);
        const spanId = this.hexToBytes(spanContext.spanId);

        console.log('Converting span:', {
            name: span.name,
            trace_id: spanContext.traceId,
            span_id: spanContext.spanId
        });

        // Build span protobuf message
        const fields = [
            this.encodeField(1, 2, traceId),                                    // trace_id
            this.encodeField(2, 2, spanId),                                     // span_id
            this.encodeField(5, 2, this.encodeString(span.name)),              // name
            this.encodeField(6, 0, this.encodeVarint(span.kind || 1)),         // kind
            this.encodeField(7, 1, this.encodeFixed64(startTimeNano)),         // start_time_unix_nano
            this.encodeField(8, 1, this.encodeFixed64(endTimeNano)),           // end_time_unix_nano
        ];

        // Add parent span ID if present
        if (parentSpanId.length > 0) {
            fields.push(this.encodeField(4, 2, parentSpanId));                 // parent_span_id
        }

        // Add attributes
        const attributes = this.convertAttributes(span.attributes);
        attributes.forEach(attr => {
            fields.push(this.encodeField(9, 2, attr));                         // attributes (repeated)
        });

        // Add status
        const status = this.encodeStatus(span.status);
        fields.push(this.encodeField(15, 2, status));                          // status

        return this.encodeMessage(fields);
    }

    // Helper methods for manual protobuf encoding
    private convertTimeToNano(time: [number, number]): number {
        const totalNano = time[0] * 1e9 + time[1];
        return totalNano > 0 ? totalNano : Date.now() * 1e6;
    }

    private convertAttributes(attributes: Record<string, any>): Uint8Array[] {
        return Object.entries(attributes).map(([key, value]) =>
            this.encodeKeyValue(key, value)
        );
    }

    private encodeKeyValue(key: string, value: any): Uint8Array {
        return this.encodeMessage([
            this.encodeField(1, 2, this.encodeString(key)),        // key
            this.encodeField(2, 2, this.encodeAnyValue(value))     // value
        ]);
    }

    private encodeAnyValue(value: any): Uint8Array {
        if (typeof value === 'string') {
            return this.encodeMessage([
                this.encodeField(1, 2, this.encodeString(value))   // string_value
            ]);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return this.encodeMessage([
                    this.encodeField(3, 0, this.encodeVarint(value)) // int_value
                ]);
            } else {
                return this.encodeMessage([
                    this.encodeField(4, 1, this.encodeDouble(value)) // double_value
                ]);
            }
        } else if (typeof value === 'boolean') {
            return this.encodeMessage([
                this.encodeField(2, 0, this.encodeVarint(value ? 1 : 0)) // bool_value
            ]);
        } else {
            // Fallback to string
            return this.encodeMessage([
                this.encodeField(1, 2, this.encodeString(String(value))) // string_value
            ]);
        }
    }

    private encodeStatus(status: any): Uint8Array {
        return this.encodeMessage([
            this.encodeField(2, 0, this.encodeVarint(status?.code || 1)), // code (OK)
            this.encodeField(3, 2, this.encodeString(status?.message || "")) // message
        ]);
    }

    private hexToBytes(hex: string): Uint8Array {
        hex = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    // Low-level protobuf encoding methods
    private encodeVarint(value: number): Uint8Array {
        const bytes: number[] = [];
        while (value >= 0x80) {
            bytes.push((value & 0xFF) | 0x80);
            value >>>= 7;
        }
        bytes.push(value & 0xFF);
        return new Uint8Array(bytes);
    }

    private encodeFixed64(value: number): Uint8Array {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, BigInt(value), true); // little endian
        return new Uint8Array(buffer);
    }

    private encodeDouble(value: number): Uint8Array {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value, true); // little endian
        return new Uint8Array(buffer);
    }

    private encodeString(str: string): Uint8Array {
        const encoded = new TextEncoder().encode(str);
        const length = this.encodeVarint(encoded.length);
        return this.concat([length, encoded]);
    }

    private encodeField(fieldNumber: number, wireType: number, data: Uint8Array): Uint8Array {
        const tag = this.encodeVarint((fieldNumber << 3) | wireType);
        return wireType === 2 ? this.concat([tag, data]) : this.concat([tag, data]);
    }

    private encodeMessage(fields: Uint8Array[]): Uint8Array {
        return this.concat(fields);
    }

    private concat(arrays: Uint8Array[]): Uint8Array {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
} 