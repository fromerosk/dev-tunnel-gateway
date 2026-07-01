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
exports.DevTunnelLambdas = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const nodejs = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
const path = __importStar(require("path"));
/**
 * CDK construct that defines all Lambda functions for the Dev Tunnel Gateway.
 *
 * Creates 8 Lambda functions with NodejsFunction (esbuild bundling):
 * - auth-handler: WebSocket authorizer
 * - connect-handler: $connect route handler
 * - register-handler: Registration route handler
 * - forward-handler: HTTP API forwarding handler
 * - disconnect-handler: $disconnect route handler
 * - heartbeat-handler: Heartbeat route handler
 * - health-handler: Health check endpoint handler
 * - response-handler: Tunnel response receiver
 */
class DevTunnelLambdas extends constructs_1.Construct {
    authHandler;
    connectHandler;
    registerHandler;
    forwardHandler;
    disconnectHandler;
    heartbeatHandler;
    healthHandler;
    responseHandler;
    constructor(scope, id, props) {
        super(scope, id);
        const handlersDir = path.join(__dirname, '../../handlers');
        const commonBundling = {
            minify: true,
            sourceMap: true,
            target: 'node20',
            // esbuild performs tree shaking by default when bundling
        };
        const commonEnv = {
            SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
            PENDING_REQUESTS_TABLE_NAME: props.pendingRequestsTable.tableName,
            WEBSOCKET_API_ENDPOINT: props.webSocketApiEndpoint,
        };
        const defaultFunctionProps = {
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 256,
            timeout: cdk.Duration.seconds(10),
            bundling: commonBundling,
            environment: commonEnv,
        };
        // Auth Handler - WebSocket Lambda Authorizer
        this.authHandler = new nodejs.NodejsFunction(this, 'AuthHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'auth-handler.ts'),
            functionName: 'dev-tunnel-auth-handler',
            description: 'WebSocket API authorizer - validates auth tokens from SSM',
            environment: {
                ...commonEnv,
                SSM_TOKEN_PARAMETER_PATH: props.ssmTokenParameterPath,
            },
        });
        // Connect Handler - $connect route
        this.connectHandler = new nodejs.NodejsFunction(this, 'ConnectHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'connect-handler.ts'),
            functionName: 'dev-tunnel-connect-handler',
            description: 'Handles WebSocket $connect route - creates session in DynamoDB',
        });
        // Register Handler - register action route
        this.registerHandler = new nodejs.NodejsFunction(this, 'RegisterHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'register-handler.ts'),
            functionName: 'dev-tunnel-register-handler',
            description: 'Handles tunnel registration - assigns subdomain and public URL',
        });
        // Forward Handler - HTTP API forwarding (longer timeout for request relay)
        this.forwardHandler = new nodejs.NodejsFunction(this, 'ForwardHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'forward-handler.ts'),
            functionName: 'dev-tunnel-forward-handler',
            description: 'Forwards HTTP requests through WebSocket tunnel to CLI client',
            timeout: cdk.Duration.seconds(35),
        });
        // Disconnect Handler - $disconnect route
        this.disconnectHandler = new nodejs.NodejsFunction(this, 'DisconnectHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'disconnect-handler.ts'),
            functionName: 'dev-tunnel-disconnect-handler',
            description: 'Handles WebSocket $disconnect - marks session inactive',
        });
        // Heartbeat Handler - heartbeat action route
        this.heartbeatHandler = new nodejs.NodejsFunction(this, 'HeartbeatHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'heartbeat-handler.ts'),
            functionName: 'dev-tunnel-heartbeat-handler',
            description: 'Processes heartbeat messages and updates session timestamps',
        });
        // Health Handler - HTTP health check endpoint
        this.healthHandler = new nodejs.NodejsFunction(this, 'HealthHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'health-handler.ts'),
            functionName: 'dev-tunnel-health-handler',
            description: 'Health check endpoint - verifies DynamoDB connectivity',
        });
        // Response Handler - receives proxied responses from tunnel client
        this.responseHandler = new nodejs.NodejsFunction(this, 'ResponseHandler', {
            ...defaultFunctionProps,
            entry: path.join(handlersDir, 'response-handler.ts'),
            functionName: 'dev-tunnel-response-handler',
            description: 'Receives HTTP responses relayed back through the WebSocket tunnel',
        });
        // --- Permissions ---
        // Grant DynamoDB read/write to all handlers
        const allFunctions = [
            this.authHandler,
            this.connectHandler,
            this.registerHandler,
            this.forwardHandler,
            this.disconnectHandler,
            this.heartbeatHandler,
            this.healthHandler,
            this.responseHandler,
        ];
        for (const fn of allFunctions) {
            props.sessionsTable.grantReadWriteData(fn);
            props.pendingRequestsTable.grantReadWriteData(fn);
        }
        // Grant SSM read permission to auth-handler
        this.authHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
            resources: [
                cdk.Arn.format({
                    service: 'ssm',
                    resource: 'parameter',
                    resourceName: props.ssmTokenParameterPath.replace(/^\//, '') + '/*',
                }, cdk.Stack.of(this)),
            ],
        }));
        // Grant API Gateway management permission to forward-handler (PostToConnection)
        this.forwardHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [
                cdk.Arn.format({
                    service: 'execute-api',
                    resource: props.webSocketApiId,
                    resourceName: `${props.webSocketApiStage}/POST/@connections/*`,
                }, cdk.Stack.of(this)),
            ],
        }));
    }
}
exports.DevTunnelLambdas = DevTunnelLambdas;
//# sourceMappingURL=lambda-functions.js.map