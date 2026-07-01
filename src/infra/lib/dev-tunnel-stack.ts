import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { DevTunnelLambdas } from './lambda-functions';
import { DevTunnelWebSocketApi } from './websocket-api';
import { DevTunnelHttpApi } from './http-api';
import { DevTunnelOutputs } from './ssm-outputs';
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
  public readonly sessionsTable: dynamodb.Table;
  public readonly pendingRequestsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DevTunnelStackProps) {
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
    const lambdas = new DevTunnelLambdas(this, 'Lambdas', {
      sessionsTable: this.sessionsTable,
      pendingRequestsTable: this.pendingRequestsTable,
      webSocketApiEndpoint: 'PLACEHOLDER', // Will override below
      webSocketApiId: 'PLACEHOLDER',
      webSocketApiStage: 'prod',
      ssmTokenParameterPath,
    });

    // Step 2: Create WebSocket API with the Lambda functions
    const webSocketApi = new DevTunnelWebSocketApi(this, 'WebSocketApi', {
      connectHandler: lambdas.connectHandler,
      disconnectHandler: lambdas.disconnectHandler,
      registerHandler: lambdas.registerHandler,
      heartbeatHandler: lambdas.heartbeatHandler,
      responseHandler: lambdas.responseHandler,
      authHandler: lambdas.authHandler,
    });

    // Step 3: Create HTTP API with forward and health Lambdas
    const httpApi = new DevTunnelHttpApi(this, 'HttpApi', {
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
    lambdas.forwardHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.api.ref}/prod/POST/@connections/*`,
        ],
      })
    );

    // Step 5: Outputs
    new DevTunnelOutputs(this, 'Outputs', {
      webSocketEndpointUrl: webSocketApi.webSocketEndpoint,
      httpEndpointUrl: httpApi.httpApiEndpoint,
      healthCheckUrl: `${httpApi.httpApiEndpoint}/health`,
    });

    // Step 6: Optional custom domain
    if (props?.domainName && props?.hostedZoneId) {
      new DevTunnelCustomDomain(this, 'CustomDomain', {
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
