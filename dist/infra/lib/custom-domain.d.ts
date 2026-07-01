import { Construct } from 'constructs';
/**
 * Props for the DevTunnelCustomDomain construct.
 */
export interface DevTunnelCustomDomainProps {
    /** The custom domain name (e.g., "tunnel.example.com") */
    domainName: string;
    /** The Route53 hosted zone ID for DNS record creation */
    hostedZoneId: string;
    /** The HTTP API Gateway ID to map to the custom domain */
    httpApiId: string;
    /** The WebSocket API Gateway ID to map to the custom domain */
    webSocketApiId: string;
    /** The stage name for the HTTP API (e.g., "$default") */
    httpStageName: string;
    /** The stage name for the WebSocket API (e.g., "prod") */
    webSocketStageName: string;
}
/**
 * CDK construct that provisions a custom domain with TLS for the Dev Tunnel Gateway.
 *
 * This construct:
 * 1. Looks up an existing Route53 hosted zone by ID
 * 2. Creates an ACM certificate with DNS validation
 * 3. Creates an API Gateway v2 custom domain name
 * 4. Maps both the HTTP and WebSocket APIs to the custom domain
 * 5. Creates a Route53 A record (alias) pointing to the API Gateway domain
 *
 * This construct should only be instantiated when `domainName` and `hostedZoneId`
 * are provided in the stack props. The conditional check is done in the stack,
 * not within this construct.
 */
export declare class DevTunnelCustomDomain extends Construct {
    /** The custom domain URL (https://{domainName}) */
    readonly customDomainUrl: string;
    constructor(scope: Construct, id: string, props: DevTunnelCustomDomainProps);
}
//# sourceMappingURL=custom-domain.d.ts.map