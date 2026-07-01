import { describe, it, expect, vi } from 'vitest';
import {
  generateSubdomain,
  isSubdomainAvailable,
  assignSubdomain,
  DDBClient,
} from './subdomain';

describe('generateSubdomain', () => {
  it('returns an 8-character string', () => {
    const subdomain = generateSubdomain();
    expect(subdomain).toHaveLength(8);
  });

  it('returns only lowercase alphanumeric characters', () => {
    const subdomain = generateSubdomain();
    expect(subdomain).toMatch(/^[a-z0-9]{8}$/);
  });

  it('produces different values on successive calls', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generateSubdomain());
    }
    // With 36^8 possible values, 100 calls should produce 100 unique results
    expect(results.size).toBe(100);
  });
});

describe('isSubdomainAvailable', () => {
  it('returns true when no items are found', async () => {
    const mockDdb: DDBClient = {
      query: vi.fn().mockResolvedValue({ Items: [] }),
    };

    const available = await isSubdomainAvailable('abc12345', mockDdb);
    expect(available).toBe(true);
  });

  it('returns true when items exist but none are ACTIVE', async () => {
    const mockDdb: DDBClient = {
      query: vi.fn().mockResolvedValue({
        Items: [
          { subdomain: 'abc12345', status: 'INACTIVE', connectionId: 'conn1' },
        ],
      }),
    };

    const available = await isSubdomainAvailable('abc12345', mockDdb);
    expect(available).toBe(true);
  });

  it('returns false when an ACTIVE session exists', async () => {
    const mockDdb: DDBClient = {
      query: vi.fn().mockResolvedValue({
        Items: [
          { subdomain: 'abc12345', status: 'ACTIVE', connectionId: 'conn1' },
        ],
      }),
    };

    const available = await isSubdomainAvailable('abc12345', mockDdb);
    expect(available).toBe(false);
  });

  it('queries the correct table and index', async () => {
    const originalEnv = process.env.SESSIONS_TABLE_NAME;
    process.env.SESSIONS_TABLE_NAME = 'MyTable';

    const mockQuery = vi.fn().mockResolvedValue({ Items: [] });
    const mockDdb: DDBClient = { query: mockQuery };

    await isSubdomainAvailable('test1234', mockDdb);

    expect(mockQuery).toHaveBeenCalledWith({
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

describe('assignSubdomain', () => {
  it('returns the first subdomain when it is available', async () => {
    const mockDdb: DDBClient = {
      query: vi.fn().mockResolvedValue({ Items: [] }),
    };

    const subdomain = await assignSubdomain(mockDdb);
    expect(subdomain).toMatch(/^[a-z0-9]{8}$/);
    expect(mockDdb.query).toHaveBeenCalledTimes(1);
  });

  it('retries when a subdomain is taken and returns the next available one', async () => {
    let callCount = 0;
    const mockDdb: DDBClient = {
      query: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            Items: [{ subdomain: 'taken', status: 'ACTIVE', connectionId: 'c1' }],
          });
        }
        return Promise.resolve({ Items: [] });
      }),
    };

    const subdomain = await assignSubdomain(mockDdb);
    expect(subdomain).toMatch(/^[a-z0-9]{8}$/);
    expect(mockDdb.query).toHaveBeenCalledTimes(3);
  });

  it('throws after 10 failed attempts', async () => {
    const mockDdb: DDBClient = {
      query: vi.fn().mockResolvedValue({
        Items: [{ subdomain: 'taken', status: 'ACTIVE', connectionId: 'c1' }],
      }),
    };

    await expect(assignSubdomain(mockDdb)).rejects.toThrow(
      'Failed to generate a unique subdomain after 10 attempts'
    );
    expect(mockDdb.query).toHaveBeenCalledTimes(10);
  });
});
