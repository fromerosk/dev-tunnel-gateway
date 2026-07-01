import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
/**
 * Props for the DevTunnelStack, extending standard CDK StackProps
 * with optional custom domain configuration.
 */
export interface DevTunnelStackProps extends cdk.StackProps {
    /** Optional custom domain name for the tunnel gateway (e.g., "tunnel.example.com") */
    domainName?: string;
    /** Optional Route53 hosted zone ID for DNS record creation */
    hostedZoneId?: string;
}
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
export declare class DevTunnelStack extends cdk.Stack {
    readonly sessionsTable: dynamodb.Table;
    readonly pendingRequestsTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: DevTunnelStackProps);
}
//# sourceMappingURL=dev-tunnel-stack.d.ts.map