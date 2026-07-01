"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const { mockSend } = vitest_1.vi.hoisted(() => {
    const mockSend = vitest_1.vi.fn();
    return { mockSend };
});
vitest_1.vi.mock('@aws-sdk/client-dynamodb', () => {
    return {
        DynamoDBClient: class {
            send = mockSend;
        },
        ScanCommand: class {
            input;
            constructor(input) {
                this.input = input;
            }
        },
    };
});
const health_handler_1 = require("./health-handler");
function createHealthEvent() {
    return {
        requestContext: {},
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/health',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        resource: '',
    };
}
(0, vitest_1.describe)('health-handler', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        process.env.SESSIONS_TABLE_NAME = 'TestSessionsTable';
    });
    (0, vitest_1.it)('returns 200 with healthy status when DynamoDB is reachable', async () => {
        // First call: connectivity check (Scan limit 1)
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
        // Second call: active sessions count
        mockSend.mockResolvedValueOnce({ Count: 3 });
        const result = await (0, health_handler_1.handler)(createHealthEvent());
        const body = JSON.parse(result.body);
        (0, vitest_1.expect)(result.statusCode).toBe(200);
        (0, vitest_1.expect)(body.status).toBe('healthy');
        (0, vitest_1.expect)(body.canAcceptConnections).toBe(true);
        (0, vitest_1.expect)(body.activeSessionCount).toBe(3);
        (0, vitest_1.expect)(body.timestamp).toBeDefined();
    });
    (0, vitest_1.it)('returns 503 with degraded status when DynamoDB is unreachable', async () => {
        mockSend.mockRejectedValueOnce(new Error('Connection refused'));
        const result = await (0, health_handler_1.handler)(createHealthEvent());
        const body = JSON.parse(result.body);
        (0, vitest_1.expect)(result.statusCode).toBe(503);
        (0, vitest_1.expect)(body.status).toBe('degraded');
        (0, vitest_1.expect)(body.canAcceptConnections).toBe(false);
        (0, vitest_1.expect)(body.activeSessionCount).toBe(0);
        (0, vitest_1.expect)(body.timestamp).toBeDefined();
    });
    (0, vitest_1.it)('returns activeSessionCount of 0 when no active sessions exist', async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
        mockSend.mockResolvedValueOnce({ Count: 0 });
        const result = await (0, health_handler_1.handler)(createHealthEvent());
        const body = JSON.parse(result.body);
        (0, vitest_1.expect)(result.statusCode).toBe(200);
        (0, vitest_1.expect)(body.activeSessionCount).toBe(0);
    });
    (0, vitest_1.it)('sets Content-Type header to application/json', async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
        mockSend.mockResolvedValueOnce({ Count: 1 });
        const result = await (0, health_handler_1.handler)(createHealthEvent());
        (0, vitest_1.expect)(result.headers).toEqual({ 'Content-Type': 'application/json' });
    });
    (0, vitest_1.it)('makes two DynamoDB calls: connectivity check and active count', async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
        mockSend.mockResolvedValueOnce({ Count: 5 });
        await (0, health_handler_1.handler)(createHealthEvent());
        (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(2);
        // First call: connectivity scan with Limit 1
        const firstCall = mockSend.mock.calls[0][0];
        (0, vitest_1.expect)(firstCall.input.TableName).toBe('TestSessionsTable');
        (0, vitest_1.expect)(firstCall.input.Limit).toBe(1);
        // Second call: active sessions count
        const secondCall = mockSend.mock.calls[1][0];
        (0, vitest_1.expect)(secondCall.input.TableName).toBe('TestSessionsTable');
        (0, vitest_1.expect)(secondCall.input.Select).toBe('COUNT');
        (0, vitest_1.expect)(secondCall.input.FilterExpression).toBe('#status = :active');
        (0, vitest_1.expect)(secondCall.input.ExpressionAttributeValues).toEqual({
            ':active': { S: 'ACTIVE' },
        });
    });
    (0, vitest_1.it)('returns 503 if the active sessions count query fails', async () => {
        // Connectivity check succeeds
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });
        // Active count fails
        mockSend.mockRejectedValueOnce(new Error('Throttled'));
        const result = await (0, health_handler_1.handler)(createHealthEvent());
        const body = JSON.parse(result.body);
        (0, vitest_1.expect)(result.statusCode).toBe(503);
        (0, vitest_1.expect)(body.status).toBe('degraded');
        (0, vitest_1.expect)(body.canAcceptConnections).toBe(false);
    });
});
//# sourceMappingURL=health-handler.test.js.map