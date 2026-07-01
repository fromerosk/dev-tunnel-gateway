import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
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
export class DevTunnelCustomDomain extends Construct {
  /** The custom domain URL (https://{domainName}) */
  public readonly customDomainUrl: string;

  constructor(scope: Construct, id: string, props: DevTunnelCustomDomainProps) {
    super(scope, id);

    // 1. Look up the existing Route53 hosted zone by ID
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName.split('.').slice(1).join('.') || props.domainName,
    });

    // 2. Create an ACM certificate for the domain with DNS validation
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // 3. Create an API Gateway v2 domain name
    const domainName = new apigatewayv2.CfnDomainName(this, 'DomainName', {
      domainName: props.domainName,
      domainNameConfigurations: [
        {
          endpointType: 'REGIONAL',
          certificateArn: certificate.certificateArn,
        },
      ],
    });

    // 4. Create API mappings for both HTTP and WebSocket APIs
    new apigatewayv2.CfnApiMapping(this, 'HttpApiMapping', {
      apiId: props.httpApiId,
      domainName: props.domainName,
      stage: props.httpStageName,
    }).addDependency(domainName);

    new apigatewayv2.CfnApiMapping(this, 'WebSocketApiMapping', {
      apiId: props.webSocketApiId,
      domainName: props.domainName,
      stage: props.webSocketStageName,
      apiMappingKey: 'ws',
    }).addDependency(domainName);

    // 5. Create a Route53 A record (alias) pointing to the API Gateway domain
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: domainName.attrRegionalDomainName,
          hostedZoneId: domainName.attrRegionalHostedZoneId,
        }),
      }),
    });

    // 6. Expose the custom domain URL
    this.customDomainUrl = `https://${props.domainName}`;

    // CloudFormation output
    new cdk.CfnOutput(this, 'CustomDomainUrl', {
      value: this.customDomainUrl,
      description: 'Custom domain URL for the Dev Tunnel Gateway',
    });
  }
}
