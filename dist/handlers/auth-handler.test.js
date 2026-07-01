"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mockSend = vitest_1.vi.fn();
vitest_1.vi.mock('@aws-sdk/client-ssm', () => {
    return {
        SSMClient: class {
            send = mockSend;
        },
        GetParametersByPathCommand: class {
            input;
            constructor(input) {
                this.input = input;
            }
        },
    };
});
function createEvent(overrides = {}) {
    return {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789:abc123/dev/$connect',
        resource: '$connect',
        path: '/$connect',
        httpMethod: 'GET',
        headers: {},
        multiValueHeaders: {},
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
            accountId: '123456789',
            apiId: 'abc123',
            authorizer: {},
            httpMethod: 'GET',
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: '192.168.1.100',
                user: null,
                userAgent: null,
                userArn: null,
            },
            path: '/$connect',
            protocol: 'HTTP/1.1',
            requestId: 'req-123',
            requestTimeEpoch: Date.now(),
            resourceId: 'resource-id',
            resourcePath: '/$connect',
            stage: 'dev',
        },
        ...overrides,
    };
}
(0, vitest_1.describe)('auth-handler', () => {
    (0, vitest_1.beforeEach)(() => {
        mockSend.mockReset();
    });
    (0, vitest_1.it)('should return Deny when token query parameter is missing', async () => {
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: null });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Deny');
        (0, vitest_1.expect)(result.principalId).toBe('anonymous');
        // Should not call SSM
        (0, vitest_1.expect)(mockSend).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should return Deny when token query parameter is empty', async () => {
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: { token: '' } });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Deny');
        (0, vitest_1.expect)(result.principalId).toBe('anonymous');
    });
    (0, vitest_1.it)('should return Allow with context for a valid token', async () => {
        const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
        mockSend.mockResolvedValueOnce({
            Parameters: [
                {
                    Name: '/dev-tunnel/tokens/token-1',
                    Value: JSON.stringify({ secret: 'my-secret-123', expiresAt: futureExpiry, owner: 'dev-user' }),
                },
            ],
            NextToken: undefined,
        });
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: { token: 'my-secret-123' } });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Allow');
        (0, vitest_1.expect)(result.principalId).toBe('token-1');
        (0, vitest_1.expect)(result.context).toEqual({
            tokenId: 'token-1',
            expiresAt: futureExpiry,
        });
    });
    (0, vitest_1.it)('should return Deny for an expired token', async () => {
        const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
        mockSend.mockResolvedValueOnce({
            Parameters: [
                {
                    Name: '/dev-tunnel/tokens/token-expired',
                    Value: JSON.stringify({ secret: 'expired-secret', expiresAt: pastExpiry, owner: 'dev-user' }),
                },
            ],
            NextToken: undefined,
        });
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: { token: 'expired-secret' } });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Deny');
        (0, vitest_1.expect)(result.principalId).toBe('anonymous');
    });
    (0, vitest_1.it)('should return Deny for a token not found in store', async () => {
        const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
        mockSend.mockResolvedValueOnce({
            Parameters: [
                {
                    Name: '/dev-tunnel/tokens/token-1',
                    Value: JSON.stringify({ secret: 'actual-secret', expiresAt: futureExpiry, owner: 'dev-user' }),
                },
            ],
            NextToken: undefined,
        });
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: { token: 'wrong-secret' } });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Deny');
        (0, vitest_1.expect)(result.principalId).toBe('anonymous');
    });
    (0, vitest_1.it)('should return Deny when SSM call fails', async () => {
        mockSend.mockRejectedValueOnce(new Error('SSM access denied'));
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({ queryStringParameters: { token: 'some-token' } });
        const result = await handler(event);
        (0, vitest_1.expect)(result.policyDocument.Statement[0].Effect).toBe('Deny');
        (0, vitest_1.expect)(result.principalId).toBe('anonymous');
    });
    (0, vitest_1.it)('should use correct methodArn in policy Resource', async () => {
        const { handler } = await Promise.resolve().then(() => __importStar(require('./auth-handler')));
        const event = createEvent({
            queryStringParameters: null,
            methodArn: 'arn:aws:execute-api:us-west-2:999:xyz/prod/$connect',
        });
        const result = await handler(event);
        const statement = result.policyDocument.Statement[0];
        (0, vitest_1.expect)(statement.Resource).toBe('arn:aws:execute-api:us-west-2:999:xyz/prod/$connect');
    });
});
//# sourceMappingURL=auth-handler.test.js.map