"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevTunnelCustomDomain = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const constructs_1 = require("constructs");
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
class DevTunnelCustomDomain extends constructs_1.Construct {
    /** The custom domain URL (https://{domainName}) */
    customDomainUrl;
    constructor(scope, id, props) {
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
exports.DevTunnelCustomDomain = DevTunnelCustomDomain;
//# sourceMappingURL=custom-domain.js.map