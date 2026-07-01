import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Props for DevTunnelOutputs construct.
 * Accepts endpoint URLs to expose as CloudFormation outputs.
 */
export interface DevTunnelOutputsProps {
  /** The WebSocket API endpoint URL (wss://) */
  webSocketEndpointUrl: string;
  /** The HTTP API endpoint URL (https://) */
  httpEndpointUrl: string;
  /** The health check URL (https://...​/health) */
  healthCheckUrl: string;
}

/**
 * CDK construct that defines SSM parameters documenting the expected
 * token path and CloudFormation outputs for the Dev Tunnel Gateway endpoints.
 *
 * NOTE: Actual authentication tokens are NOT created here — they must be
 * created manually by the developer in SSM Parameter Store at the path
 * `/dev-tunnel/tokens/{tokenId}` as SecureString parameters.
 */
export class DevTunnelOutputs extends Construct {
  constructor(scope: Construct, id: string, props: DevTunnelOutputsProps) {
    super(scope, id);

    // SSM parameter documenting the expected token path prefix.
    // Tokens must be manually created under this path as SecureString parameters.
    new ssm.StringParameter(this, 'TokenPathConfig', {
      parameterName: '/dev-tunnel/config/token-path',
      stringValue: '/dev-tunnel/tokens/',
      description:
        'Path prefix where authentication tokens are stored. ' +
        'Create tokens manually as SecureString parameters at /dev-tunnel/tokens/{tokenId}.',
    });

    // CloudFormation outputs for endpoint discovery
    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: props.webSocketEndpointUrl,
      description: 'WebSocket API endpoint URL for tunnel control channel (WSS)',
    });

    new cdk.CfnOutput(this, 'HttpApiEndpoint', {
      value: props.httpEndpointUrl,
      description: 'HTTP API endpoint URL for inbound mobile app traffic',
    });

    new cdk.CfnOutput(this, 'HealthCheckUrl', {
      value: props.healthCheckUrl,
      description: 'Health check endpoint URL (GET /health)',
    });
  }
}
