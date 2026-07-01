"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const subdomain_1 = require("./subdomain");
(0, vitest_1.describe)('generateSubdomain', () => {
    (0, vitest_1.it)('returns an 8-character string', () => {
        const subdomain = (0, subdomain_1.generateSubdomain)();
        (0, vitest_1.expect)(subdomain).toHaveLength(8);
    });
    (0, vitest_1.it)('returns only lowercase alphanumeric characters', () => {
        const subdomain = (0, subdomain_1.generateSubdomain)();
        (0, vitest_1.expect)(subdomain).toMatch(/^[a-z0-9]{8}$/);
    });
    (0, vitest_1.it)('produces different values on successive calls', () => {
        const results = new Set();
        for (let i = 0; i < 100; i++) {
            results.add((0, subdomain_1.generateSubdomain)());
        }
        // With 36^8 possible values, 100 calls should produce 100 unique results
        (0, vitest_1.expect)(results.size).toBe(100);
    });
});
(0, vitest_1.describe)('isSubdomainAvailable', () => {
    (0, vitest_1.it)('returns true when no items are found', async () => {
        const mockDdb = {
            query: vitest_1.vi.fn().mockResolvedValue({ Items: [] }),
        };
        const available = await (0, subdomain_1.isSubdomainAvailable)('abc12345', mockDdb);
        (0, vitest_1.expect)(available).toBe(true);
    });
    (0, vitest_1.it)('returns true when items exist but none are ACTIVE', async () => {
        const mockDdb = {
            query: vitest_1.vi.fn().mockResolvedValue({
                Items: [
                    { subdomain: 'abc12345', status: 'INACTIVE', connectionId: 'conn1' },
                ],
            }),
        };
        const available = await (0, subdomain_1.isSubdomainAvailable)('abc12345', mockDdb);
        (0, vitest_1.expect)(available).toBe(true);
    });
    (0, vitest_1.it)('returns false when an ACTIVE session exists', async () => {
        const mockDdb = {
            query: vitest_1.vi.fn().mockResolvedValue({
                Items: [
                    { subdomain: 'abc12345', status: 'ACTIVE', connectionId: 'conn1' },
                ],
            }),
        };
        const available = await (0, subdomain_1.isSubdomainAvailable)('abc12345', mockDdb);
        (0, vitest_1.expect)(available).toBe(false);
    });
    (0, vitest_1.it)('queries the correct table and index', async () => {
        const originalEnv = process.env.SESSIONS_TABLE_NAME;
        process.env.SESSIONS_TABLE_NAME = 'MyTable';
        const mockQuery = vitest_1.vi.fn().mockResolvedValue({ Items: [] });
        const mockDdb = { query: mockQuery };
        await (0, subdomain_1.isSubdomainAvailable)('test1234', mockDdb);
        (0, vitest_1.expect)(mockQuery).toHaveBeenCalledWith({
            TableName: 'MyTable',
            IndexName: 'SubdomainIndex',
            KeyConditionExpression: 'subdomain = :subdomain',
            ExpressionAttributeValues: {
                ':subdomain': 'test1234',
            },
        });
        process.env.SESSIONS_TABLE_NAME = originalEnv;
    });
});
(0, vitest_1.describe)('assignSubdomain', () => {
    (0, vitest_1.it)('returns the first subdomain when it is available', async () => {
        const mockDdb = {
            query: vitest_1.vi.fn().mockResolvedValue({ Items: [] }),
        };
        const subdomain = await (0, subdomain_1.assignSubdomain)(mockDdb);
        (0, vitest_1.expect)(subdomain).toMatch(/^[a-z0-9]{8}$/);
        (0, vitest_1.expect)(mockDdb.query).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('retries when a subdomain is taken and returns the next available one', async () => {
        let callCount = 0;
        const mockDdb = {
            query: vitest_1.vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                    return Promise.resolve({
                        Items: [{ subdomain: 'taken', status: 'ACTIVE', connectionId: 'c1' }],
                    });
                }
                return Promise.resolve({ Items: [] });
            }),
        };
        const subdomain = await (0, subdomain_1.assignSubdomain)(mockDdb);
        (0, vitest_1.expect)(subdomain).toMatch(/^[a-z0-9]{8}$/);
        (0, vitest_1.expect)(mockDdb.query).toHaveBeenCalledTimes(3);
    });
    (0, vitest_1.it)('throws after 10 failed attempts', async () => {
        const mockDdb = {
            query: vitest_1.vi.fn().mockResolvedValue({
                Items: [{ subdomain: 'taken', status: 'ACTIVE', connectionId: 'c1' }],
            }),
        };
        await (0, vitest_1.expect)((0, subdomain_1.assignSubdomain)(mockDdb)).rejects.toThrow('Failed to generate a unique subdomain after 10 attempts');
        (0, vitest_1.expect)(mockDdb.query).toHaveBeenCalledTimes(10);
    });
});
//# sourceMappingURL=subdomain.test.js.map