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
exports.DevTunnelWebSocketApi = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
/**
 * CDK construct that creates the WebSocket API Gateway (Control Plane)
 * for the Dev Tunnel Gateway.
 *
 * Routes:
 *  - $connect: Authenticates via Lambda authorizer, registers session
 *  - $disconnect: Cleans up session state
 *  - register: Assigns subdomain and returns public URL
 *  - heartbeat: Acknowledges heartbeat from client
 *  - response: Receives proxied HTTP responses from tunnel client
 *
 * Uses L1 (Cfn) constructs for stability since the L2 WebSocket API
 * constructs in aws-cdk-lib are not yet fully stable.
 */
class DevTunnelWebSocketApi extends constructs_1.Construct {
    /** The WebSocket API endpoint URL (wss://...) */
    webSocketEndpoint;
    /** The underlying CfnApi resource */
    api;
    /** The deployed stage */
    stage;
    constructor(scope, id, props) {
        super(scope, id);
        // --- WebSocket API ---
        this.api = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
            name: 'DevTunnelControlPlane',
            protocolType: 'WEBSOCKET',
            routeSelectionExpression: '$request.body.action',
        });
        // --- Lambda Authorizer ---
        const authorizer = new apigatewayv2.CfnAuthorizer(this, 'LambdaAuthorizer', {
            apiId: this.api.ref,
            authorizerType: 'REQUEST',
            name: 'DevTunnelAuthorizer',
            authorizerUri: this.buildLambdaInvokeArn(props.authHandler),
            identitySource: ['route.request.querystring.token'],
        });
        // Grant API Gateway permission to invoke the authorizer Lambda
        props.authHandler.addPermission('ApiGatewayAuthorizerInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: cdk.Stack.of(this).formatArn({
                service: 'execute-api',
                resource: this.api.ref,
                resourceName: 'authorizers/*',
            }),
        });
        // --- Integrations ---
        const connectIntegration = this.createLambdaIntegration('ConnectIntegration', props.connectHandler);
        const disconnectIntegration = this.createLambdaIntegration('DisconnectIntegration', props.disconnectHandler);
        const registerIntegration = this.createLambdaIntegration('RegisterIntegration', props.registerHandler);
        const heartbeatIntegration = this.createLambdaIntegration('HeartbeatIntegration', props.heartbeatHandler);
        const responseIntegration = this.createLambdaIntegration('ResponseIntegration', props.responseHandler);
        // --- Routes ---
        // $connect route with authorizer
        const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
            apiId: this.api.ref,
            routeKey: '$connect',
            authorizationType: 'CUSTOM',
            authorizerId: authorizer.ref,
            target: `integrations/${connectIntegration.ref}`,
        });
        // $disconnect route
        const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
            apiId: this.api.ref,
            routeKey: '$disconnect',
            target: `integrations/${disconnectIntegration.ref}`,
        });
        // register route
        const registerRoute = new apigatewayv2.CfnRoute(this, 'RegisterRoute', {
            apiId: this.api.ref,
            routeKey: 'register',
            target: `integrations/${registerIntegration.ref}`,
        });
        // heartbeat route
        const heartbeatRoute = new apigatewayv2.CfnRoute(this, 'HeartbeatRoute', {
            apiId: this.api.ref,
            routeKey: 'heartbeat',
            target: `integrations/${heartbeatIntegration.ref}`,
        });
        // response route
        const responseRoute = new apigatewayv2.CfnRoute(this, 'ResponseRoute', {
            apiId: this.api.ref,
            routeKey: 'response',
            target: `integrations/${responseIntegration.ref}`,
        });
        // --- Stage with auto-deploy ---
        this.stage = new apigatewayv2.CfnStage(this, 'ProdStage', {
            apiId: this.api.ref,
            stageName: 'prod',
            autoDeploy: true,
        });
        // Ensure routes are created before the stage
        this.stage.addDependency(connectRoute);
        this.stage.addDependency(disconnectRoute);
        this.stage.addDependency(registerRoute);
        this.stage.addDependency(heartbeatRoute);
        this.stage.addDependency(responseRoute);
        // --- Grant API Gateway permission to invoke route handler Lambdas ---
        const routeHandlers = [
            { fn: props.connectHandler, name: 'Connect' },
            { fn: props.disconnectHandler, name: 'Disconnect' },
            { fn: props.registerHandler, name: 'Register' },
            { fn: props.heartbeatHandler, name: 'Heartbeat' },
            { fn: props.responseHandler, name: 'Response' },
        ];
        for (const { fn, name } of routeHandlers) {
            fn.addPermission(`ApiGateway${name}Invoke`, {
                principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
                sourceArn: cdk.Stack.of(this).formatArn({
                    service: 'execute-api',
                    resource: this.api.ref,
                    resourceName: '*',
                }),
            });
        }
        // --- WebSocket Endpoint URL ---
        const region = cdk.Stack.of(this).region;
        this.webSocketEndpoint = `wss://${this.api.ref}.execute-api.${region}.amazonaws.com/${this.stage.stageName}`;
        // --- Stack Output ---
        new cdk.CfnOutput(this, 'WebSocketEndpoint', {
            value: this.webSocketEndpoint,
            description: 'WebSocket API endpoint URL for the Dev Tunnel control plane',
            exportName: 'DevTunnelWebSocketEndpoint',
        });
    }
    /**
     * Creates a Lambda integration for the WebSocket API.
     */
    createLambdaIntegration(id, handler) {
        return new apigatewayv2.CfnIntegration(this, id, {
            apiId: this.api.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: this.buildLambdaInvokeArn(handler),
        });
    }
    /**
     * Builds the Lambda invoke ARN in the format expected by API Gateway integrations.
     * Format: arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{functionArn}/invocations
     */
    buildLambdaInvokeArn(handler) {
        const region = cdk.Stack.of(this).region;
        return `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${handler.functionArn}/invocations`;
    }
}
exports.DevTunnelWebSocketApi = DevTunnelWebSocketApi;
//# sourceMappingURL=websocket-api.js.map