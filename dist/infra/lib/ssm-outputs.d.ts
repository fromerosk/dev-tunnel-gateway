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
export declare class DevTunnelOutputs extends Construct {
    constructor(scope: Construct, id: string, props: DevTunnelOutputsProps);
}
//# sourceMappingURL=ssm-outputs.d.ts.map