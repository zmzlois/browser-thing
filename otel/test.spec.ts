import { ProtobufConverter } from './protobuf-converter.js';
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Mock span data that matches real OTEL span structure
const mockSpans = [
    {
        spanContext: () => ({
            traceId: '9f5d394f93e8e3ca1a5e3c2d9310d035', // 32 chars (16 bytes)
            spanId: 'd14846a7e9a14309', // 16 chars (8 bytes)
            traceState: undefined,
            traceFlags: 1
        }),
        name: 'test-operation',
        kind: 1, // SPAN_KIND_INTERNAL
        // Use current time in [seconds, nanoseconds] format
        startTime: [1678886400, 0], // A fixed time for consistent snapshots
        endTime: [1678886400, 100000000], // +100ms
        attributes: {
            'service.name': 'test-service',
            'operation.type': 'test',
            'request.id': 'req-123',
            'user.id': 456
        },
        events: [],
        links: [],
        status: { code: 1, message: 'OK' },
        parentSpanContext: undefined // No parent for this test
    }
];

const snapshotFilePath = path.join(__dirname, 'snapshot.bin');

async function testProtobufConversion() {
    try {
        console.log('🧪 Testing protobuf conversion...');

        const converter = new ProtobufConverter();
        const protobufData = converter.convertSpansToProtobuf(mockSpans as any);

        console.log('✅ Protobuf conversion successful!');
        console.log(`📏 Data length: ${protobufData.length} bytes`);

        // Snapshot testing
        if (process.env.UPDATE_SNAPSHOT) {
            console.log('📸 Updating snapshot...');
            fs.writeFileSync(snapshotFilePath, protobufData);
            console.log('✅ Snapshot updated successfully!');
        } else if (fs.existsSync(snapshotFilePath)) {
            console.log('📸 Comparing with snapshot...');
            const snapshotData = fs.readFileSync(snapshotFilePath);
            assert.deepStrictEqual(protobufData, snapshotData, 'Protobuf data does not match snapshot');
            console.log('✅ Snapshot comparison successful!');
        } else {
            console.log('📸 No snapshot found. Creating one...');
            fs.writeFileSync(snapshotFilePath, protobufData);
            console.log('✅ Snapshot created successfully!');
        }

    } catch (error) {
        console.error('❌ Error testing protobuf conversion:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

async function testWandbEndpoint() {
    if (!process.env.WANDB_API_KEY) {
        console.log('⚠️  WANDB_API_KEY not set, skipping W&B endpoint test');
        return;
    }

    try {
        console.log('🌐 Testing W&B endpoint...');

        const converter = new ProtobufConverter();
        const protobufData = converter.convertSpansToProtobuf(mockSpans as any);

        const response = await fetch('https://trace.wandb.ai/otel/v1/traces', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-protobuf',
                'Authorization': `Basic ${Buffer.from(`api:${process.env.WANDB_API_KEY}`).toString('base64')}`,
                'project_id': 'lois-zh/frontline_mcp',
            },
            body: protobufData,
        });

        console.log(`📊 W&B response status: ${response.status}`);

        if (response.ok) {
            console.log('🎉 Successfully sent data to W&B!');
            const responseText = await response.text();
            if (responseText) {
                console.log('📝 Response:', responseText);
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Error response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: errorText
            });
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error testing W&B endpoint:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

async function runTests() {
    await testProtobufConversion();
    await testWandbEndpoint();
    console.log('✅ All tests passed!');
}

runTests();