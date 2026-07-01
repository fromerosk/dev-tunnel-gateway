"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const args_1 = require("./args");
(0, vitest_1.describe)('parseArgs', () => {
    (0, vitest_1.it)('returns a valid CLIConfig when all args are provided', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://example.com', '--token', 'abc123', '--port', '3000']);
        (0, vitest_1.expect)(result).toEqual({
            gatewayUrl: 'wss://example.com',
            authToken: 'abc123',
            localPort: 3000,
        });
    });
    (0, vitest_1.it)('accepts args in any order', () => {
        const result = (0, args_1.parseArgs)(['--port', '8080', '--token', 'mytoken', '--gateway-url', 'wss://gw.io']);
        (0, vitest_1.expect)(result).toEqual({
            gatewayUrl: 'wss://gw.io',
            authToken: 'mytoken',
            localPort: 8080,
        });
    });
    (0, vitest_1.it)('accepts port 1 (minimum)', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '1']);
        (0, vitest_1.expect)(result).not.toHaveProperty('error');
        (0, vitest_1.expect)(result.localPort).toBe(1);
    });
    (0, vitest_1.it)('accepts port 65535 (maximum)', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '65535']);
        (0, vitest_1.expect)(result).not.toHaveProperty('error');
        (0, vitest_1.expect)(result.localPort).toBe(65535);
    });
    (0, vitest_1.it)('returns error when --gateway-url is missing', () => {
        const result = (0, args_1.parseArgs)(['--token', 'abc', '--port', '3000']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('--gateway-url');
    });
    (0, vitest_1.it)('returns error when --token is missing', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--port', '3000']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('--token');
    });
    (0, vitest_1.it)('returns error when --port is missing', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 'abc']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('--port');
    });
    (0, vitest_1.it)('returns error listing all missing args when none provided', () => {
        const result = (0, args_1.parseArgs)([]);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        const error = result.error;
        (0, vitest_1.expect)(error).toContain('--gateway-url');
        (0, vitest_1.expect)(error).toContain('--token');
        (0, vitest_1.expect)(error).toContain('--port');
    });
    (0, vitest_1.it)('returns error for port 0', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '0']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('Invalid port');
    });
    (0, vitest_1.it)('returns error for port 65536', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '65536']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('Invalid port');
    });
    (0, vitest_1.it)('returns error for non-integer port', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '3.14']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('Invalid port');
    });
    (0, vitest_1.it)('returns error for non-numeric port', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', 'abc']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('Invalid port');
    });
    (0, vitest_1.it)('returns error for negative port', () => {
        const result = (0, args_1.parseArgs)(['--gateway-url', 'wss://x', '--token', 't', '--port', '-1']);
        (0, vitest_1.expect)(result).toHaveProperty('error');
        (0, vitest_1.expect)(result.error).toContain('Invalid port');
    });
});
//# sourceMappingURL=args.test.js.map