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
exports.generateSubdomain = generateSubdomain;
exports.isSubdomainAvailable = isSubdomainAvailable;
exports.assignSubdomain = assignSubdomain;
const crypto = __importStar(require("crypto"));
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
 * Generates a random 8-character lowercase alphanumeric subdomain.
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
function generateSubdomain() {
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
async function isSubdomainAvailable(subdomain, ddb) {
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
async function assignSubdomain(ddb) {
    for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt++) {
        const subdomain = generateSubdomain();
        const available = await isSubdomainAvailable(subdomain, ddb);
        if (available) {
            return subdomain;
        }
    }
    throw new Error(`Failed to generate a unique subdomain after ${MAX_ASSIGN_ATTEMPTS} attempts`);
}
//# sourceMappingURL=subdomain.js.map