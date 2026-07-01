import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
/**
 * Props for the DevTunnelLambdas construct.
 */
export interface DevTunnelLambdasProps {
    /** DynamoDB sessions table */
    sessionsTable: dynamodb.ITable;
    /** DynamoDB pending requests table */
    pendingRequestsTable: dynamodb.ITable;
    /** WebSocket API endpoint URL (for PostToConnection calls) */
    webSocketApiEndpoint: string;
    /** WebSocket API ID (for IAM permissions) */
    webSocketApiId: string;
    /** WebSocket API stage name */
    webSocketApiStage: string;
    /** SSM parameter path prefix for auth tokens (e.g., "/dev-tunnel/tokens") */
    ssmTokenParameterPath: string;
}
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
export declare class DevTunnelLambdas extends Construct {
    readonly authHandler: nodejs.NodejsFunction;
    readonly connectHandler: nodejs.NodejsFunction;
    readonly registerHandler: nodejs.NodejsFunction;
    readonly forwardHandler: nodejs.NodejsFunction;
    readonly disconnectHandler: nodejs.NodejsFunction;
    readonly heartbeatHandler: nodejs.NodejsFunction;
    readonly healthHandler: nodejs.NodejsFunction;
    readonly responseHandler: nodejs.NodejsFunction;
    constructor(scope: Construct, id: string, props: DevTunnelLambdasProps);
}
//# sourceMappingURL=lambda-functions.d.ts.map