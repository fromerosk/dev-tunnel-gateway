import * as crypto from 'crypto';

/**
 * Subdomain generation and uniqueness checking for the Dev Tunnel Gateway.
 *
 * Subdomains are 8-character lowercase alphanumeric strings (36^8 ≈ 2.8 trillion
 * possible values), providing virtually zero collision probability for concurrent sessions.
 */

const SUBDOMAIN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUBDOMAIN_LENGTH = 8;
const MAX_ASSIGN_ATTEMPTS = 10;

/**
 * Interface for DynamoDB client operations needed by subdomain functions.
 */
export interface DDBClient {
  query(params: {
    TableName: string;
    IndexName: string;
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, unknown>;
  }): Promise<{ Items?: Array<Record<string, unknown>> }>;
}

/**
 * Generates a random 8-character lowercase alphanumeric subdomain.
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
export function generateSubdomain(): string {
  const bytes = crypto.randomBytes(SUBDOMAIN_LENGTH);
  let subdomain = '';
  for (let i = 0; i < SUBDOMAIN_LENGTH; i++) {
    subdomain += SUBDOMAIN_CHARS[bytes[i] % SUBDOMAIN_CHARS.length];
  }
  return subdomain;
}

/**
 * Checks whether a subdomain is available (no ACTIVE session exists with it).
 * Queries the SubdomainIndex GSI on the DevTunnelSessions table.
 */
export async function isSubdomainAvailable(
  subdomain: string,
  ddb: DDBClient
): Promise<boolean> {
  const tableName = process.env.SESSIONS_TABLE_NAME || 'DevTunnelSessions';

  const result = await ddb.query({
    TableName: tableName,
    IndexName: 'SubdomainIndex',
    KeyConditionExpression: 'subdomain = :subdomain',
    ExpressionAttributeValues: {
      ':subdomain': subdomain,
    },
  });

  if (!result.Items || result.Items.length === 0) {
    return true;
  }

  // Check if any returned item has ACTIVE status
  const hasActive = result.Items.some((item) => item.status === 'ACTIVE');
  return !hasActive;
}

/**
 * Generates a unique subdomain by retrying until one is available.
 * Retries up to 10 times (collision is extremely unlikely with 36^8 possible values).
 *
 * @throws Error if unable to find a unique subdomain after max attempts
 */
export async function assignSubdomain(ddb: DDBClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt++) {
    const subdomain = generateSubdomain();
    const available = await isSubdomainAvailable(subdomain, ddb);
    if (available) {
      return subdomain;
    }
  }

  throw new Error(
    `Failed to generate a unique subdomain after ${MAX_ASSIGN_ATTEMPTS} attempts`
  );
}
