import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
/**
 * Props for the DevTunnelHttpApi construct.
 */
export interface DevTunnelHttpApiProps {
    /** Lambda function that handles forwarding requests through the tunnel */
    forwardFunction: lambda.IFunction;
    /** Lambda function that handles health check requests */
    healthCheckFunction: lambda.IFunction;
}
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
export declare class DevTunnelHttpApi extends Construct {
    /** The HTTP API endpoint URL for inbound traffic */
    readonly httpApiEndpoint: string;
    /** The underlying CfnApi resource */
    readonly api: apigatewayv2.CfnApi;
    constructor(scope: Construct, id: string, props: DevTunnelHttpApiProps);
}
//# sourceMappingURL=http-api.d.ts.map