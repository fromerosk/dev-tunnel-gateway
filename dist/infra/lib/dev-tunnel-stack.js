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
exports.DevTunnelStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const custom_domain_1 = require("./custom-domain");
/**
 * Main CDK stack for the Dev Tunnel Gateway infrastructure.
 *
 * Provisions all serverless resources including:
 * - WebSocket API Gateway (control plane)
 * - HTTP API Gateway (data plane)
 * - DynamoDB tables for session state
 * - Lambda functions for request handling
 * - Optional custom domain with TLS
 */
class DevTunnelStack extends cdk.Stack {
    /** DynamoDB table storing tunnel session state */
    sessionsTable;
    /** DynamoDB table storing pending request/response correlations */
    pendingRequestsTable;
    /** Optional custom domain construct (only created when domain config is provided) */
    customDomain;
    constructor(scope, id, props) {
        super(scope, id, props);
        // --- DynamoDB Tables ---
        // Sessions table: tracks active tunnel connections
        this.sessionsTable = new dynamodb.Table(this, 'DevTunnelSessions', {
            tableName: 'DevTunnelSessions',
            partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI: lookup sessions by subdomain (used for routing inbound HTTP requests)
        this.sessionsTable.addGlobalSecondaryIndex({
            indexName: 'SubdomainIndex',
            partitionKey: { name: 'subdomain', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.INCLUDE,
            nonKeyAttributes: ['connectionId', 'status'],
        });
        // GSI: lookup sessions by tokenId (used for token expiration enforcement)
        this.sessionsTable.addGlobalSecondaryIndex({
            indexName: 'TokenIdIndex',
            partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Pending requests table: correlates forwarded requests with tunnel responses
        this.pendingRequestsTable = new dynamodb.Table(this, 'DevTunnelPendingRequests', {
            tableName: 'DevTunnelPendingRequests',
            partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // --- Optional Custom Domain ---
        // Only provision when both domainName and hostedZoneId are provided in stack props.
        // Once WebSocket and HTTP APIs are wired, pass their IDs and stage names here.
        if (props?.domainName && props?.hostedZoneId) {
            this.customDomain = new custom_domain_1.DevTunnelCustomDomain(this, 'CustomDomain', {
                domainName: props.domainName,
                hostedZoneId: props.hostedZoneId,
                // TODO: Replace with actual API IDs once the APIs are wired into this stack
                httpApiId: '', // httpApi.api.ref
                webSocketApiId: '', // webSocketApi.api.ref
                httpStageName: '$default',
                webSocketStageName: 'prod',
            });
        }
    }
}
exports.DevTunnelStack = DevTunnelStack;
//# sourceMappingURL=dev-tunnel-stack.js.map