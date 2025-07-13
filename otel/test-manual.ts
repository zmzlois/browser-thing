import { ProtobufConverter } from './protobuf-converter-v2.js';

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
        startTime: [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000000],
        endTime: [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000000 + 100000000], // +100ms
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

async function testManualProtobuf() {
    try {
        console.log('🧪 Testing manual protobuf encoding...');
        
        const converter = new ProtobufConverter();
        const protobufData = converter.convertSpansToProtobuf(mockSpans as any);
        
        console.log('✅ Manual protobuf conversion successful!');
        console.log(`📏 Data length: ${protobufData.length} bytes`);
        console.log(`🔍 First 20 bytes: ${Array.from(protobufData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        
        // First, save the binary data to a file for verification
        console.log('💾 Saving protobuf data to trace_request.bin...');
        await Bun.write('./otel/trace_request.bin', protobufData);
        console.log('✅ Binary file saved successfully');
        
        // Test the actual W&B endpoint if API key is available
        if (process.env.WANDB_API_KEY) {
            console.log('🌐 Testing W&B endpoint...');
            
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
            }
        } else {
            console.log('⚠️  WANDB_API_KEY not set, skipping W&B test');
        }
        
    } catch (error) {
        console.error('❌ Error testing manual protobuf conversion:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
    }
}

testManualProtobuf();