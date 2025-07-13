# OpenTelemetry Protobuf Exporter for Weights & Biases

This project implements a custom OpenTelemetry exporter that converts trace data to protobuf format and sends it to Weights & Biases trace endpoint.

## Features

- **Custom Protobuf Exporter**: Converts OpenTelemetry spans to OTLP protobuf format
- **Weights & Biases Integration**: Sends trace data to W&B's trace endpoint
- **Proper Authentication**: Uses W&B API key for authentication
- **Full OTLP Schema Support**: Implements the complete OpenTelemetry protobuf schema

## Installation

```bash
bun install
```

## Configuration

Set your Weights & Biases API key as an environment variable:

```bash
export WANDB_API_KEY="your_api_key_here"
```

## Usage

### Basic Usage

```typescript
import { sdk } from './index.js';

// Start the SDK
sdk.start();

// Your application code here...

// Shutdown when done
sdk.shutdown();
```

### Testing the Protobuf Conversion

Run the test script to verify protobuf conversion:

```bash
bun run test-protobuf.ts
```

## How It Works

### 1. Custom Protobuf Exporter

The `CustomProtobufExporter` class implements the OpenTelemetry `SpanExporter` interface and:

- Converts OpenTelemetry spans to OTLP protobuf format
- Sends data via HTTP POST with `application/x-protobuf` content type
- Handles authentication with W&B API key

### 2. Protobuf Conversion

The `ProtobufConverter` class handles the conversion from OpenTelemetry spans to protobuf format:

- Implements the complete OTLP protobuf schema
- Converts all span properties (trace ID, span ID, attributes, events, etc.)
- Handles different data types (strings, numbers, booleans, arrays, objects)

### 3. Data Flow

1. OpenTelemetry SDK collects spans
2. Custom exporter receives spans
3. Protobuf converter transforms spans to binary protobuf format
4. Data is sent to W&B trace endpoint via HTTP POST
5. W&B processes and stores the trace data

## Files

- `index.ts` - Main SDK configuration and custom exporter
- `protobuf-converter.ts` - Protobuf conversion logic
- `test-protobuf.ts` - Test script for verification
- `package.json` - Dependencies and project configuration

## Dependencies

- `@opentelemetry/sdk-node` - OpenTelemetry Node.js SDK
- `@opentelemetry/exporter-trace-otlp-http` - OTLP HTTP exporter (for reference)
- `protobufjs` - Protobuf parsing and encoding
- `@opentelemetry/auto-instrumentations-node` - Auto-instrumentation

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure `WANDB_API_KEY` is set correctly
2. **Protobuf Encoding Errors**: Check that span data is in the expected format
3. **Network Errors**: Verify connectivity to `https://trace.wandb.ai`

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
export OTEL_LOG_LEVEL=debug
```

## Example Integration

```typescript
import { sdk } from './index.js';
import { trace } from '@opentelemetry/api';

// Start the SDK
sdk.start();

// Create a tracer
const tracer = trace.getTracer('my-app');

// Create a span
const span = tracer.startSpan('my-operation');
span.setAttribute('custom.attribute', 'value');

// Do some work
await someAsyncOperation();

// End the span
span.end();

// Shutdown when done
sdk.shutdown();
```

This will automatically send the span data to Weights & Biases in protobuf format.
