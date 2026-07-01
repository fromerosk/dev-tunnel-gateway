/**
 * Interface for DynamoDB client operations needed by subdomain functions.
 */
export interface DDBClient {
    query(params: {
        TableName: string;
        IndexName: string;
        KeyConditionExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
    }): Promise<{
        Items?: Array<Record<string, unknown>>;
    }>;
}
/**
 * Generates a random 8-character lowercase alphanumeric subdomain.
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
export declare function generateSubdomain(): string;
/**
 * Checks whether a subdomain is available (no ACTIVE session exists with it).
 * Queries the SubdomainIndex GSI on the DevTunnelSessions table.
 */
export declare function isSubdomainAvailable(subdomain: string, ddb: DDBClient): Promise<boolean>;
/**
 * Generates a unique subdomain by retrying until one is available.
 * Retries up to 10 times (collision is extremely unlikely with 36^8 possible values).
 *
 * @throws Error if unable to find a unique subdomain after max attempts
 */
export declare function assignSubdomain(ddb: DDBClient): Promise<string>;
//# sourceMappingURL=subdomain.d.ts.map