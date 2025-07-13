import { ProtobufConverter } from './protobuf-converter.js';

// Mock span data for testing
const mockSpans = [
    {
        spanContext: () => ({
            traceId: '1234567890abcdef1234567890abcdef',
            spanId: 'abcdef1234567890',
            traceState: undefined
        }),
        name: 'test-span',
        kind: 1, // SERVER
        startTime: [1234567890, 123456789],
        endTime: [1234567891, 123456789],
        attributes: {
            'http.method': 'GET',
            'http.url': '/test',
            'user.id': 123
        },
        events: [
            {
                time: [1234567890, 123456789],
                name: 'test-event',
                attributes: { 'event.type': 'test' }
            }
        ],
        links: [],
        status: { code: 1, message: 'OK' }
    }
];

async function testProtobufConversion() {
    try {
        console.log('Testing protobuf conversion...');
        
        const converter = new ProtobufConverter();
        const protobufData = converter.convertSpansToProtobuf(mockSpans as any);
        
        console.log('Protobuf conversion successful!');
        console.log('Data length:', protobufData.length, 'bytes');
        console.log('First 20 bytes:', Array.from(protobufData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Test sending to W&B (if API key is available)
        if (process.env.WANDB_API_KEY) {
            console.log('Testing W&B endpoint...')
            console.log("protobufData", protobufData)
            
            const response = await fetch('https://trace.wandb.ai/otel/v1/traces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-protobuf',
                    'Authorization': 'Basic YXBpOmEzZWY2ZGNlM2E4YTdkYzA5NmNhYTI1N2Y0MjhlMDUyNWY4MTExNmQ=',
                   // 'Authorization': `Bearer ${Buffer.from(`api:${process.env.WANDB_API_KEY}`).toString('base64')}`,
                    'project_id': 'lois-zh/frontline_mcp',
                    'Accept': 'application/x-protobuf',
                   // 'Method': 'POST',
                },
                body: protobufData,
            });
            console.log('response', response);
            console.log('W&B response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error response:', errorText);
            } else {
                console.log('Successfully sent data to W&B!');
            }
        } else {
            console.log('WANDB_API_KEY not set, skipping W&B test');
        }
        
    } catch (error) {
        console.error('Error testing protobuf conversion:', error);
    }
}

testProtobufConversion(); 