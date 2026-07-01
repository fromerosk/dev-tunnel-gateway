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
const lambda_functions_1 = require("./lambda-functions");
const websocket_api_1 = require("./websocket-api");
const http_api_1 = require("./http-api");
const ssm_outputs_1 = require("./ssm-outputs");
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
    sessionsTable;
    pendingRequestsTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        // --- DynamoDB Tables ---
        this.sessionsTable = new dynamodb.Table(this, 'DevTunnelSessions', {
            tableName: 'DevTunnelSessions',
            partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.sessionsTable.addGlobalSecondaryIndex({
            indexName: 'SubdomainIndex',
            partitionKey: { name: 'subdomain', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.INCLUDE,
            nonKeyAttributes: ['connectionId', 'status'],
        });
        this.sessionsTable.addGlobalSecondaryIndex({
            indexName: 'TokenIdIndex',
            partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        this.pendingRequestsTable = new dynamodb.Table(this, 'DevTunnelPendingRequests', {
            tableName: 'DevTunnelPendingRequests',
            partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // --- WebSocket API (Control Plane) ---
        // We need the Lambdas first but they need the WS endpoint...
        // Break the circular dependency by creating the WebSocket API first with placeholder Lambdas,
        // then creating Lambdas with the endpoint. Instead, use a two-pass approach with Lazy values.
        // Create a placeholder for the WebSocket endpoint that will be resolved later
        const ssmTokenParameterPath = '/dev-tunnel/tokens';
        // Step 1: Create Lambdas with a lazy-resolved WebSocket endpoint
        // We'll use Fn.sub with the API ID after creating the WebSocket API
        // Actually, CDK handles this with token resolution. Create WS API first.
        // Create a temporary Lambda set with dummy endpoint, then fix with .addEnvironment
        // Better approach: create WebSocket API first (it doesn't need lambdas to exist for the CfnApi),
        // but it DOES need lambda ARNs for integrations. So we need lambdas first.
        // The correct CDK pattern: Create lambdas → Create APIs (referencing lambda ARNs) → 
        // Add env var to lambdas (referencing API endpoint). CDK resolves tokens at synth time.
        // Step 1: Create Lambdas with placeholder endpoint (will be overridden)
        const lambdas = new lambda_functions_1.DevTunnelLambdas(this, 'Lambdas', {
            sessionsTable: this.sessionsTable,
            pendingRequestsTable: this.pendingRequestsTable,
            webSocketApiEndpoint: 'PLACEHOLDER', // Will override below
            webSocketApiId: 'PLACEHOLDER',
            webSocketApiStage: 'prod',
            ssmTokenParameterPath,
        });
        // Step 2: Create WebSocket API with the Lambda functions
        const webSocketApi = new websocket_api_1.DevTunnelWebSocketApi(this, 'WebSocketApi', {
            connectHandler: lambdas.connectHandler,
            disconnectHandler: lambdas.disconnectHandler,
            registerHandler: lambdas.registerHandler,
            heartbeatHandler: lambdas.heartbeatHandler,
            responseHandler: lambdas.responseHandler,
            authHandler: lambdas.authHandler,
        });
        // Step 3: Create HTTP API with forward and health Lambdas
        const httpApi = new http_api_1.DevTunnelHttpApi(this, 'HttpApi', {
            forwardFunction: lambdas.forwardHandler,
            healthCheckFunction: lambdas.healthHandler,
        });
        // Step 4: Override the WebSocket endpoint env var on lambdas that need it
        // The real endpoint uses the API ID which is a CDK token resolved at deploy
        const wsEndpoint = `https://${webSocketApi.api.ref}.execute-api.${this.region}.amazonaws.com/${webSocketApi.stage.stageName}`;
        lambdas.forwardHandler.addEnvironment('WEBSOCKET_API_ENDPOINT', wsEndpoint);
        lambdas.registerHandler.addEnvironment('WEBSOCKET_API_ENDPOINT', wsEndpoint);
        lambdas.heartbeatHandler.addEnvironment('WEBSOCKET_API_ENDPOINT', wsEndpoint);
        lambdas.responseHandler.addEnvironment('WEBSOCKET_API_ENDPOINT', wsEndpoint);
        // Also pass the HTTP API endpoint to the register handler (for constructing public URLs)
        lambdas.registerHandler.addEnvironment('HTTP_API_ENDPOINT', httpApi.httpApiEndpoint);
        // Fix the forward handler's ManageConnections permission with the real API ID
        lambdas.forwardHandler.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.api.ref}/prod/POST/@connections/*`,
            ],
        }));
        // Step 5: Outputs
        new ssm_outputs_1.DevTunnelOutputs(this, 'Outputs', {
            webSocketEndpointUrl: webSocketApi.webSocketEndpoint,
            httpEndpointUrl: httpApi.httpApiEndpoint,
            healthCheckUrl: `${httpApi.httpApiEndpoint}/health`,
        });
        // Step 6: Optional custom domain
        if (props?.domainName && props?.hostedZoneId) {
            new custom_domain_1.DevTunnelCustomDomain(this, 'CustomDomain', {
                domainName: props.domainName,
                hostedZoneId: props.hostedZoneId,
                httpApiId: httpApi.api.ref,
                webSocketApiId: webSocketApi.api.ref,
                httpStageName: '$default',
                webSocketStageName: 'prod',
            });
        }
    }
}
exports.DevTunnelStack = DevTunnelStack;
//# sourceMappingURL=dev-tunnel-stack.js.map