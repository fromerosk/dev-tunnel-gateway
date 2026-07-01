import { describe, it, expect } from 'vitest';
import { parseArgs, CLIConfig } from './args';

describe('parseArgs', () => {
  it('returns a valid CLIConfig when all args are provided', () => {
    const result = parseArgs(['--gateway-url', 'wss://example.com', '--token', 'abc123', '--port', '3000']);
    expect(result).toEqual({
      gatewayUrl: 'wss://example.com',
      authToken: 'abc123',
      localPort: 3000,
    });
  });

  it('accepts args in any order', () => {
    const result = parseArgs(['--port', '8080', '--token', 'mytoken', '--gateway-url', 'wss://gw.io']);
    expect(result).toEqual({
      gatewayUrl: 'wss://gw.io',
      authToken: 'mytoken',
      localPort: 8080,
    });
  });

  it('accepts port 1 (minimum)', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '1']);
    expect(result).not.toHaveProperty('error');
    expect((result as CLIConfig).localPort).toBe(1);
  });

  it('accepts port 65535 (maximum)', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '65535']);
    expect(result).not.toHaveProperty('error');
    expect((result as CLIConfig).localPort).toBe(65535);
  });

  it('returns error when --gateway-url is missing', () => {
    const result = parseArgs(['--token', 'abc', '--port', '3000']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('--gateway-url');
  });

  it('returns error when --token is missing', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--port', '3000']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('--token');
  });

  it('returns error when --port is missing', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 'abc']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('--port');
  });

  it('returns error listing all missing args when none provided', () => {
    const result = parseArgs([]);
    expect(result).toHaveProperty('error');
    const error = (result as { error: string }).error;
    expect(error).toContain('--gateway-url');
    expect(error).toContain('--token');
    expect(error).toContain('--port');
  });

  it('returns error for port 0', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '0']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid port');
  });

  it('returns error for port 65536', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '65536']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid port');
  });

  it('returns error for non-integer port', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '3.14']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid port');
  });

  it('returns error for non-numeric port', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', 'abc']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid port');
  });

  it('returns error for negative port', () => {
    const result = parseArgs(['--gateway-url', 'wss://x', '--token', 't', '--port', '-1']);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid port');
  });
});
