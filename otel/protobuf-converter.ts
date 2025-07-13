import protobuf from "protobufjs";
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export class ProtobufConverter {
    private root: protobuf.Root;

    constructor() {
        try {
            // Create a simple protobuf schema that we know works
            this.root = new protobuf.Root();
            
            // Define the proper OTLP schema that matches OpenTelemetry specification
            const schema = `
                syntax = "proto3";
                
                message ExportTraceServiceRequest {
                    repeated ResourceSpans resource_spans = 1;
                }
                
                message ResourceSpans {
                    Resource resource = 1;
                    repeated ScopeSpans scope_spans = 2;
                    string schema_url = 3;
                }
                
                message Resource {
                    repeated KeyValue attributes = 1;
                    uint32 dropped_attributes_count = 2;
                }
                
                message ScopeSpans {
                    InstrumentationScope scope = 1;
                    repeated Span spans = 2;
                    string schema_url = 3;
                }
                
                message InstrumentationScope {
                    string name = 1;
                    string version = 2;
                    repeated KeyValue attributes = 3;
                    uint32 dropped_attributes_count = 4;
                }
                
                message Span {
                    bytes trace_id = 1;
                    bytes span_id = 2;
                    string trace_state = 3;
                    bytes parent_span_id = 4;
                    string name = 5;
                    SpanKind kind = 6;
                    fixed64 start_time_unix_nano = 7;
                    fixed64 end_time_unix_nano = 8;
                    repeated KeyValue attributes = 9;
                    uint32 dropped_attributes_count = 10;
                    repeated Event events = 11;
                    uint32 dropped_events_count = 12;
                    repeated Link links = 13;
                    uint32 dropped_links_count = 14;
                    Status status = 15;
                }
                
                enum SpanKind {
                    SPAN_KIND_UNSPECIFIED = 0;
                    SPAN_KIND_INTERNAL = 1;
                    SPAN_KIND_SERVER = 2;
                    SPAN_KIND_CLIENT = 3;
                    SPAN_KIND_PRODUCER = 4;
                    SPAN_KIND_CONSUMER = 5;
                }
                
                message Event {
                    fixed64 time_unix_nano = 1;
                    string name = 2;
                    repeated KeyValue attributes = 3;
                    uint32 dropped_attributes_count = 4;
                }
                
                message Link {
                    bytes trace_id = 1;
                    bytes span_id = 2;
                    string trace_state = 3;
                    repeated KeyValue attributes = 4;
                    uint32 dropped_attributes_count = 5;
                }
                
                message KeyValue {
                    string key = 1;
                    AnyValue value = 2;
                }
                
                message AnyValue {
                    oneof value {
                        string string_value = 1;
                        bool bool_value = 2;
                        int64 int_value = 3;
                        double double_value = 4;
                        ArrayValue array_value = 5;
                        KeyValueList kvlist_value = 6;
                        bytes bytes_value = 7;
                    }
                }
                
                message ArrayValue {
                    repeated AnyValue values = 1;
                }
                
                message KeyValueList {
                    repeated KeyValue values = 1;
                }
                
                message Status {
                    StatusCode code = 2;
                    string message = 3;
                }
                
                enum StatusCode {
                    STATUS_CODE_UNSET = 0;
                    STATUS_CODE_OK = 1;
                    STATUS_CODE_ERROR = 2;
                }
            `;
            
            // Parse the schema
            const parsed = protobuf.parse(schema, this.root);
            console.log('Protobuf schema loaded successfully');
            console.log('Available types:', Object.keys(this.root.nested || {}));
        } catch (error) {
            console.error('Error initializing ProtobufConverter:', error);
            throw error;
        }
    }

    convertSpansToProtobuf(spans: ReadableSpan[]): Uint8Array {
        console.log("convertSpansToProtobuf.spans", spans)
        try {
            console.log('Converting spans to protobuf...');
            console.log('Input spans:', spans.length);
            
            // Get the message type
            const ExportTraceServiceRequest = this.root.lookupType("ExportTraceServiceRequest");
            if (!ExportTraceServiceRequest) {
                throw new Error("Failed to find ExportTraceServiceRequest type");
            }
            
            console.log('✅ Found ExportTraceServiceRequest type');
            
            // Convert spans to protobuf message format using exact protobuf field names (snake_case)
            const resource_spans = [{
                resource: {
                    attributes: [
                        { key: "service.name", value: { string_value: "frontline_mcp" } },
                        { key: "service.version", value: { string_value: "1.0.0" } }
                    ],
                    dropped_attributes_count: 0
                },
                scope_spans: [{
                    scope: {
                        name: "@opentelemetry/auto-instrumentations-node",
                        version: "1.0.0",
                        attributes: [],
                        dropped_attributes_count: 0
                    },
                    spans: spans.map(span => this.convertSpan(span)),
                    schema_url: ""
                }],
                schema_url: ""
            }];

            const message = {
                resource_spans: resource_spans
            };

            console.log('✅ Message structure created successfully');

            // Validate the message before encoding
            const errMsg = ExportTraceServiceRequest.verify(message);
            if (errMsg) {
                throw new Error(`Protobuf validation failed: ${errMsg}`);
            }
            console.log('Message validation passed');

            // Create a message instance and encode it
            console.log('Creating message instance...');
            const messageInstance = ExportTraceServiceRequest.create(message) as unknown as typeof ExportTraceServiceRequest['create'] & {
                resourceSpans: any[];
                resource_spans: any[];
            };
            
            // Force the protobuf to use only our snake_case data, remove any camelCase duplicates 
            // @ts-ignore
            if (messageInstance.resourceSpans || messageInstance.resourceSpans.length === 0 || messageInstance.resource_spans) {
                console.log('Fixing protobuf field mapping: copying resource_spans to resourceSpans');
                messageInstance.resourceSpans = messageInstance.resource_spans;
                delete (messageInstance as any).resource_spans;
            }
            
            console.log('Message instance created with resource spans count:', messageInstance.resourceSpans?.length || 0);
            
            console.log('Encoding message...');
            const buffer = ExportTraceServiceRequest.encode(messageInstance).finish();
            console.log('Buffer created, length:', buffer.length);
            
            if (buffer.length === 0) {
                console.error('❌ Empty buffer detected! Message might be invalid');
                console.log('Debug - message keys:', Object.keys(message));
                console.log('Debug - messageInstance keys:', Object.keys(messageInstance));
                console.log('Debug - resource_spans length:', message.resource_spans?.length);
                throw new Error('Empty protobuf buffer generated');
            }
            
            const result = new Uint8Array(buffer);
            console.log('Final Uint8Array length:', result.length);
            console.log('First few bytes:', Array.from(result.slice(0, 10)));
            
            return result;
        } catch (error) {
            console.error('Error in convertSpansToProtobuf:', error);
            throw error;
        }
    }

    private convertSpan(span: ReadableSpan): any {
        try {
            const spanContext = span.spanContext();
            
            // Convert time properly - OpenTelemetry uses [seconds, nanoseconds]
            const startTimeNano = this.convertTimeToNano(span.startTime);
            const endTimeNano = this.convertTimeToNano(span.endTime);
            
            // Get parent span ID - handle both real spans and mock spans
            let parentSpanId = new Uint8Array(0);
            if (span.parentSpanContext) {
                // @ts-ignore
                parentSpanId = this.hexToBytes(span.parentSpanContext.spanId);
                // @ts-ignore
            } else if (span.parentSpanId) {
                // @ts-ignore
                parentSpanId = this.hexToBytes(span.parentSpanId);
            }

            const convertedSpan = {
                trace_id: this.hexToBytes(spanContext.traceId),
                span_id: this.hexToBytes(spanContext.spanId),
                trace_state: "",
                parent_span_id: parentSpanId,
                name: span.name,
                kind: span.kind || 1, // SPAN_KIND_INTERNAL
                start_time_unix_nano: startTimeNano,
                end_time_unix_nano: endTimeNano,
                attributes: this.convertAttributes(span.attributes),
                dropped_attributes_count: 0,
                events: (span.events || []).map(event => this.convertEvent(event)),
                dropped_events_count: 0,
                links: (span.links || []).map(link => this.convertLink(link)),
                dropped_links_count: 0,
                status: this.convertStatus(span.status)
            };
            
            console.log('Converted span:', {
                name: convertedSpan.name,
                trace_id: spanContext.traceId,
                span_id: spanContext.spanId,
                start_time: startTimeNano,
                end_time: endTimeNano
            });
            
            return convertedSpan;
        } catch (error) {
            console.error('Error converting span:', error);
            throw error;
        }
    }

    private convertTimeToNano(time: [number, number]): number {
        // OpenTelemetry time is [seconds, nanoseconds]
        // Convert to total nanoseconds (fixed64 format for protobuf)
        const totalNano = time[0] * 1e9 + time[1];
        
        // Ensure we have a valid timestamp (not negative, not too far in future)
        if (totalNano < 0) {
            console.warn('Invalid negative timestamp, using current time');
            return Date.now() * 1e6; // Convert ms to ns
        }
        
        return totalNano;
    }

    private convertAttributes(attributes: Record<string, any>): any[] {
        return Object.entries(attributes).map(([key, value]) => ({
            key,
            value: this.convertValue(value)
        }));
    }

    private convertValue(value: any): any {
        // AnyValue must have exactly one field set in the oneof
        let result: any;
        
        if (typeof value === 'string') {
            result = { string_value: value };
        } else if (typeof value === 'boolean') {
            result = { bool_value: value };
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                result = { int_value: value };
            } else {
                result = { double_value: value };
            }
        } else if (Array.isArray(value)) {
            result = { 
                array_value: { 
                    values: value.map(v => this.convertValue(v)) 
                } 
            };
        } else if (typeof value === 'object' && value !== null) {
            result = { 
                kvlist_value: { 
                    values: Object.entries(value).map(([k, v]) => ({ 
                        key: k, 
                        value: this.convertValue(v) 
                    })) 
                } 
            };
        } else if (value === null || value === undefined) {
            // For null/undefined, use empty string
            result = { string_value: "" };
        } else {
            // Fallback: convert to string
            result = { string_value: String(value) };
        }
        
        // Debug: log if AnyValue might be invalid
        const hasValue = Object.keys(result).some(key => result[key] !== undefined && result[key] !== null);
        if (!hasValue) {
            console.warn('⚠️ AnyValue may be empty:', { originalValue: value, result });
        }
        
        return result;
    }

    private convertStatus(status: any): any {
        return {
            code: status.code || 0, // STATUS_CODE_UNSET
            message: status.message || ""
        };
    }

    private convertEvent(event: any): any {
        return {
            time_unix_nano: this.convertTimeToNano(event.time),
            name: event.name,
            attributes: this.convertAttributes(event.attributes || {}),
            dropped_attributes_count: 0
        };
    }

    private convertLink(link: any): any {
        return {
            trace_id: this.hexToBytes(link.context.traceId),
            span_id: this.hexToBytes(link.context.spanId),
            trace_state: link.context.traceState || "",
            attributes: this.convertAttributes(link.attributes || {}),
            dropped_attributes_count: 0
        };
    }

    private hexToBytes(hex: string): Uint8Array {
        // Remove any non-hex characters and ensure lowercase
        hex = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        
        // Validate expected lengths: trace_id=32 chars (16 bytes), span_id=16 chars (8 bytes)
        if (hex.length !== 32 && hex.length !== 16) {
            console.warn(`Unexpected hex ID length: ${hex.length}, expected 32 (trace_id) or 16 (span_id)`);
        }
        
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
} 