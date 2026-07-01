"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const { mockSend } = vitest_1.vi.hoisted(() => {
    const mockSend = vitest_1.vi.fn().mockResolvedValue({});
    return { mockSend };
});
vitest_1.vi.mock('@aws-sdk/client-dynamodb', () => {
    return {
        DynamoDBClient: class {
            send = mockSend;
        },
        PutItemCommand: class {
            input;
            constructor(input) {
                this.input = input;
            }
        },
    };
});
const connect_handler_1 = require("./connect-handler");
function createConnectEvent(overrides = {}) {
    return {
        requestContext: {
            connectionId: overrides.connectionId ?? 'test-connection-id',
            authorizer: {
                tokenId: overrides.tokenId ?? 'token-123',
                expiresAt: overrides.expiresAt ?? 1700000000,
            },
        },
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        resource: '',
    };
}
(0, vitest_1.describe)('connect-handler', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        process.env.SESSIONS_TABLE_NAME = 'TestSessionsTable';
    });
    (0, vitest_1.it)('returns statusCode 200 with body Connected', async () => {
        const event = createConnectEvent();
        const result = await (0, connect_handler_1.handler)(event);
        (0, vitest_1.expect)(result.statusCode).toBe(200);
        (0, vitest_1.expect)(result.body).toBe('Connected');
    });
    (0, vitest_1.it)('calls DynamoDB PutItemCommand with correct session record', async () => {
        const now = Math.floor(Date.now() / 1000);
        const event = createConnectEvent({
            connectionId: 'conn-abc',
            tokenId: 'tok-xyz',
            expiresAt: 1700000000,
        });
        await (0, connect_handler_1.handler)(event);
        (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(1);
        const putCommand = mockSend.mock.calls[0][0];
        const item = putCommand.input.Item;
        (0, vitest_1.expect)(putCommand.input.TableName).toBe('TestSessionsTable');
        (0, vitest_1.expect)(item.connectionId).toEqual({ S: 'conn-abc' });
        (0, vitest_1.expect)(item.status).toEqual({ S: 'PENDING' });
        (0, vitest_1.expect)(item.tokenId).toEqual({ S: 'tok-xyz' });
        (0, vitest_1.expect)(item.tokenExpiresAt).toEqual({ N: '1700000000' });
        const createdAt = Number(item.createdAt.N);
        const ttl = Number(item.ttl.N);
        (0, vitest_1.expect)(createdAt).toBeGreaterThanOrEqual(now - 1);
        (0, vitest_1.expect)(createdAt).toBeLessThanOrEqual(now + 1);
        (0, vitest_1.expect)(ttl).toBe(createdAt + 3600);
        (0, vitest_1.expect)(item.updatedAt).toEqual(item.createdAt);
    });
});
//# sourceMappingURL=connect-handler.test.js.map