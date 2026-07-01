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
exports.DevTunnelOutputs = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const constructs_1 = require("constructs");
/**
 * CDK construct that defines SSM parameters documenting the expected
 * token path and CloudFormation outputs for the Dev Tunnel Gateway endpoints.
 *
 * NOTE: Actual authentication tokens are NOT created here — they must be
 * created manually by the developer in SSM Parameter Store at the path
 * `/dev-tunnel/tokens/{tokenId}` as SecureString parameters.
 */
class DevTunnelOutputs extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // SSM parameter documenting the expected token path prefix.
        // Tokens must be manually created under this path as SecureString parameters.
        new ssm.StringParameter(this, 'TokenPathConfig', {
            parameterName: '/dev-tunnel/config/token-path',
            stringValue: '/dev-tunnel/tokens/',
            description: 'Path prefix where authentication tokens are stored. ' +
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
exports.DevTunnelOutputs = DevTunnelOutputs;
//# sourceMappingURL=ssm-outputs.js.map