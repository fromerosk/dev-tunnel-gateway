import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
/**
 * Props for the DevTunnelWebSocketApi construct.
 * Each Lambda function is passed in so this construct remains decoupled
 * from how the functions are defined.
 */
export interface DevTunnelWebSocketApiProps {
    /** Lambda function for the $connect route (registers tunnel session) */
    connectHandler: lambda.IFunction;
    /** Lambda function for the $disconnect route (cleans up session) */
    disconnectHandler: lambda.IFunction;
    /** Lambda function for the register action (assigns subdomain/public URL) */
    registerHandler: lambda.IFunction;
    /** Lambda function for the heartbeat action (acknowledges heartbeat) */
    heartbeatHandler: lambda.IFunction;
    /** Lambda function for the response action (receives proxied responses) */
    responseHandler: lambda.IFunction;
    /** Lambda authorizer function for the $connect route */
    authHandler: lambda.IFunction;
}
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
export declare class DevTunnelWebSocketApi extends Construct {
    /** The WebSocket API endpoint URL (wss://...) */
    readonly webSocketEndpoint: string;
    /** The underlying CfnApi resource */
    readonly api: apigatewayv2.CfnApi;
    /** The deployed stage */
    readonly stage: apigatewayv2.CfnStage;
    constructor(scope: Construct, id: string, props: DevTunnelWebSocketApiProps);
    /**
     * Creates a Lambda integration for the WebSocket API.
     */
    private createLambdaIntegration;
    /**
     * Builds the Lambda invoke ARN in the format expected by API Gateway integrations.
     * Format: arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{functionArn}/invocations
     */
    private buildLambdaInvokeArn;
}
//# sourceMappingURL=websocket-api.d.ts.map