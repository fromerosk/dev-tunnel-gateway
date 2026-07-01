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
exports.DevTunnelHttpApi = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const constructs_1 = require("constructs");
/**
 * CDK construct for the Dev Tunnel Data Plane HTTP API Gateway.
 *
 * Creates an HTTP API that routes inbound mobile app traffic to the
 * appropriate Lambda handlers:
 * - ANY /{subdomain}/{proxy+} → Forward Lambda (tunnel traffic)
 * - GET /health → Health Check Lambda
 *
 * Uses L1 (CfnApi) constructs for full control over configuration.
 * Payload format version 2.0 is used for all integrations.
 */
class DevTunnelHttpApi extends constructs_1.Construct {
    /** The HTTP API endpoint URL for inbound traffic */
    httpApiEndpoint;
    /** The underlying CfnApi resource */
    api;
    constructor(scope, id, props) {
        super(scope, id);
        // Create the HTTP API
        this.api = new apigatewayv2.CfnApi(this, 'DataPlaneApi', {
            name: 'DevTunnelDataPlane',
            protocolType: 'HTTP',
            corsConfiguration: {
                allowOrigins: ['*'],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                allowHeaders: ['*'],
                exposeHeaders: ['*'],
                maxAge: 86400,
            },
        });
        // Create the $default stage with auto-deploy
        const stage = new apigatewayv2.CfnStage(this, 'DefaultStage', {
            apiId: this.api.ref,
            stageName: '$default',
            autoDeploy: true,
        });
        // --- Forward Lambda Integration ---
        // Grant API Gateway permission to invoke the forward function
        new lambda.CfnPermission(this, 'ForwardLambdaPermission', {
            action: 'lambda:InvokeFunction',
            functionName: props.forwardFunction.functionArn,
            principal: 'apigateway.amazonaws.com',
            sourceArn: cdk.Fn.sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/*/*', { ApiId: this.api.ref }),
        });
        const forwardIntegration = new apigatewayv2.CfnIntegration(this, 'ForwardIntegration', {
            apiId: this.api.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: props.forwardFunction.functionArn,
            integrationMethod: 'POST',
            payloadFormatVersion: '2.0',
        });
        // Route: ANY /{subdomain}/{proxy+} → Forward Lambda
        new apigatewayv2.CfnRoute(this, 'ForwardRoute', {
            apiId: this.api.ref,
            routeKey: 'ANY /{subdomain}/{proxy+}',
            target: cdk.Fn.join('/', ['integrations', forwardIntegration.ref]),
        });
        // --- Health Check Lambda Integration ---
        // Grant API Gateway permission to invoke the health check function
        new lambda.CfnPermission(this, 'HealthCheckLambdaPermission', {
            action: 'lambda:InvokeFunction',
            functionName: props.healthCheckFunction.functionArn,
            principal: 'apigateway.amazonaws.com',
            sourceArn: cdk.Fn.sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/*/*', { ApiId: this.api.ref }),
        });
        const healthIntegration = new apigatewayv2.CfnIntegration(this, 'HealthIntegration', {
            apiId: this.api.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: props.healthCheckFunction.functionArn,
            integrationMethod: 'POST',
            payloadFormatVersion: '2.0',
        });
        // Route: GET /health → Health Check Lambda
        new apigatewayv2.CfnRoute(this, 'HealthRoute', {
            apiId: this.api.ref,
            routeKey: 'GET /health',
            target: cdk.Fn.join('/', ['integrations', healthIntegration.ref]),
        });
        // Expose the API endpoint URL
        this.httpApiEndpoint = cdk.Fn.sub('https://${ApiId}.execute-api.${AWS::Region}.amazonaws.com', { ApiId: this.api.ref });
        // Add dependency so routes are created after the stage
        forwardIntegration.addDependency(stage);
        healthIntegration.addDependency(stage);
    }
}
exports.DevTunnelHttpApi = DevTunnelHttpApi;
//# sourceMappingURL=http-api.js.map