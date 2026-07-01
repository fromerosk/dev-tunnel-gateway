import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for the DevTunnelHttpApi construct.
 */
export interface DevTunnelHttpApiProps {
  /** Lambda function that handles forwarding requests through the tunnel */
  forwardFunction: lambda.IFunction;
  /** Lambda function that handles health check requests */
  healthCheckFunction: lambda.IFunction;
}

/**
 * CDK construct for the Dev Tunnel Data Plane HTTP API Gateway.
 *
 * Creates an HTTP API that routes inbound mobile app traffic to the
 * appropriate Lambda handlers:
 * - ANY /{subdomain}/{proxy+} → Forward Lambda (tunnel traffic)
 * - GET /health → Health Check Lambda
 *
 * Uses L1 (CfnApi) constructs for full control over configuration.
 * Payload format version 2.0 is used for all integrations.
 */
export class DevTunnelHttpApi extends Construct {
  /** The HTTP API endpoint URL for inbound traffic */
  public readonly httpApiEndpoint: string;

  /** The underlying CfnApi resource */
  public readonly api: apigatewayv2.CfnApi;

  constructor(scope: Construct, id: string, props: DevTunnelHttpApiProps) {
    super(scope, id);

    // Create the HTTP API
    this.api = new apigatewayv2.CfnApi(this, 'DataPlaneApi', {
      name: 'DevTunnelDataPlane',
      protocolType: 'HTTP',
      corsConfiguration: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        allowHeaders: ['*'],
        exposeHeaders: ['*'],
        maxAge: 86400,
      },
    });

    // Create the $default stage with auto-deploy
    const stage = new apigatewayv2.CfnStage(this, 'DefaultStage', {
      apiId: this.api.ref,
      stageName: '$default',
      autoDeploy: true,
    });

    // --- Forward Lambda Integration ---
    // Grant API Gateway permission to invoke the forward function
    new lambda.CfnPermission(this, 'ForwardLambdaPermission', {
      action: 'lambda:InvokeFunction',
      functionName: props.forwardFunction.functionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: cdk.Fn.sub(
        'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/*/*',
        { ApiId: this.api.ref },
      ),
    });

    const forwardIntegration = new apigatewayv2.CfnIntegration(this, 'ForwardIntegration', {
      apiId: this.api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: props.forwardFunction.functionArn,
      integrationMethod: 'POST',
      payloadFormatVersion: '2.0',
    });

    // Route: ANY /{subdomain}/{proxy+} → Forward Lambda
    new apigatewayv2.CfnRoute(this, 'ForwardRoute', {
      apiId: this.api.ref,
      routeKey: 'ANY /{subdomain}/{proxy+}',
      target: cdk.Fn.join('/', ['integrations', forwardIntegration.ref]),
    });

    // --- Health Check Lambda Integration ---
    // Grant API Gateway permission to invoke the health check function
    new lambda.CfnPermission(this, 'HealthCheckLambdaPermission', {
      action: 'lambda:InvokeFunction',
      functionName: props.healthCheckFunction.functionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: cdk.Fn.sub(
        'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/*/*',
        { ApiId: this.api.ref },
      ),
    });

    const healthIntegration = new apigatewayv2.CfnIntegration(this, 'HealthIntegration', {
      apiId: this.api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: props.healthCheckFunction.functionArn,
      integrationMethod: 'POST',
      payloadFormatVersion: '2.0',
    });

    // Route: GET /health → Health Check Lambda
    new apigatewayv2.CfnRoute(this, 'HealthRoute', {
      apiId: this.api.ref,
      routeKey: 'GET /health',
      target: cdk.Fn.join('/', ['integrations', healthIntegration.ref]),
    });

    // Expose the API endpoint URL
    this.httpApiEndpoint = cdk.Fn.sub(
      'https://${ApiId}.execute-api.${AWS::Region}.amazonaws.com',
      { ApiId: this.api.ref },
    );

    // Add dependency so routes are created after the stage
    forwardIntegration.addDependency(stage);
    healthIntegration.addDependency(stage);
  }
}
