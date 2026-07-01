import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { DevTunnelCustomDomain } from './custom-domain';

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
export class DevTunnelStack extends cdk.Stack {
  /** DynamoDB table storing tunnel session state */
  public readonly sessionsTable: dynamodb.Table;

  /** DynamoDB table storing pending request/response correlations */
  public readonly pendingRequestsTable: dynamodb.Table;

  /** Optional custom domain construct (only created when domain config is provided) */
  public readonly customDomain?: DevTunnelCustomDomain;

  constructor(scope: Construct, id: string, props?: DevTunnelStackProps) {
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
      this.customDomain = new DevTunnelCustomDomain(this, 'CustomDomain', {
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
