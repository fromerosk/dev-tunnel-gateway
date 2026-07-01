import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for the DevTunnelWebSocketApi construct.
 * Each Lambda function is passed in so this construct remains decoupled
 * from how the functions are defined.
 */
export interface DevTunnelWebSocketApiProps {
  /** Lambda function for the $connect route (registers tunnel session) */
  connectHandler: lambda.IFunction;
  /** Lambda function for the $disconnect route (cleans up session) */
  disconnectHandler: lambda.IFunction;
  /** Lambda function for the register action (assigns subdomain/public URL) */
  registerHandler: lambda.IFunction;
  /** Lambda function for the heartbeat action (acknowledges heartbeat) */
  heartbeatHandler: lambda.IFunction;
  /** Lambda function for the response action (receives proxied responses) */
  responseHandler: lambda.IFunction;
  /** Lambda authorizer function for the $connect route */
  authHandler: lambda.IFunction;
}

/**
 * CDK construct that creates the WebSocket API Gateway (Control Plane)
 * for the Dev Tunnel Gateway.
 *
 * Routes:
 *  - $connect: Authenticates via Lambda authorizer, registers session
 *  - $disconnect: Cleans up session state
 *  - register: Assigns subdomain and returns public URL
 *  - heartbeat: Acknowledges heartbeat from client
 *  - response: Receives proxied HTTP responses from tunnel client
 *
 * Uses L1 (Cfn) constructs for stability since the L2 WebSocket API
 * constructs in aws-cdk-lib are not yet fully stable.
 */
export class DevTunnelWebSocketApi extends Construct {
  /** The WebSocket API endpoint URL (wss://...) */
  public readonly webSocketEndpoint: string;
  /** The underlying CfnApi resource */
  public readonly api: apigatewayv2.CfnApi;
  /** The deployed stage */
  public readonly stage: apigatewayv2.CfnStage;

  constructor(scope: Construct, id: string, props: DevTunnelWebSocketApiProps) {
    super(scope, id);

    // --- WebSocket API ---
    this.api = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: 'DevTunnelControlPlane',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    // --- Lambda Authorizer ---
    const authorizer = new apigatewayv2.CfnAuthorizer(this, 'LambdaAuthorizer', {
      apiId: this.api.ref,
      authorizerType: 'REQUEST',
      name: 'DevTunnelAuthorizer',
      authorizerUri: this.buildLambdaInvokeArn(props.authHandler),
      identitySource: ['route.request.querystring.token'],
    });

    // Grant API Gateway permission to invoke the authorizer Lambda
    props.authHandler.addPermission('ApiGatewayAuthorizerInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: cdk.Stack.of(this).formatArn({
        service: 'execute-api',
        resource: this.api.ref,
        resourceName: 'authorizers/*',
      }),
    });

    // --- Integrations ---
    const connectIntegration = this.createLambdaIntegration('ConnectIntegration', props.connectHandler);
    const disconnectIntegration = this.createLambdaIntegration('DisconnectIntegration', props.disconnectHandler);
    const registerIntegration = this.createLambdaIntegration('RegisterIntegration', props.registerHandler);
    const heartbeatIntegration = this.createLambdaIntegration('HeartbeatIntegration', props.heartbeatHandler);
    const responseIntegration = this.createLambdaIntegration('ResponseIntegration', props.responseHandler);

    // --- Routes ---
    // $connect route with authorizer
    const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: this.api.ref,
      routeKey: '$connect',
      authorizationType: 'CUSTOM',
      authorizerId: authorizer.ref,
      target: `integrations/${connectIntegration.ref}`,
    });

    // $disconnect route
    const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: this.api.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    // register route
    const registerRoute = new apigatewayv2.CfnRoute(this, 'RegisterRoute', {
      apiId: this.api.ref,
      routeKey: 'register',
      target: `integrations/${registerIntegration.ref}`,
    });

    // heartbeat route
    const heartbeatRoute = new apigatewayv2.CfnRoute(this, 'HeartbeatRoute', {
      apiId: this.api.ref,
      routeKey: 'heartbeat',
      target: `integrations/${heartbeatIntegration.ref}`,
    });

    // response route
    const responseRoute = new apigatewayv2.CfnRoute(this, 'ResponseRoute', {
      apiId: this.api.ref,
      routeKey: 'response',
      target: `integrations/${responseIntegration.ref}`,
    });

    // --- Stage with auto-deploy ---
    this.stage = new apigatewayv2.CfnStage(this, 'ProdStage', {
      apiId: this.api.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Ensure routes are created before the stage
    this.stage.addDependency(connectRoute);
    this.stage.addDependency(disconnectRoute);
    this.stage.addDependency(registerRoute);
    this.stage.addDependency(heartbeatRoute);
    this.stage.addDependency(responseRoute);

    // --- Grant API Gateway permission to invoke route handler Lambdas ---
    const routeHandlers = [
      { fn: props.connectHandler, name: 'Connect' },
      { fn: props.disconnectHandler, name: 'Disconnect' },
      { fn: props.registerHandler, name: 'Register' },
      { fn: props.heartbeatHandler, name: 'Heartbeat' },
      { fn: props.responseHandler, name: 'Response' },
    ];

    for (const { fn, name } of routeHandlers) {
      fn.addPermission(`ApiGateway${name}Invoke`, {
        principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        sourceArn: cdk.Stack.of(this).formatArn({
          service: 'execute-api',
          resource: this.api.ref,
          resourceName: '*',
        }),
      });
    }

    // --- WebSocket Endpoint URL ---
    const region = cdk.Stack.of(this).region;
    this.webSocketEndpoint = `wss://${this.api.ref}.execute-api.${region}.amazonaws.com/${this.stage.stageName}`;

    // --- Stack Output ---
    new cdk.CfnOutput(this, 'WebSocketEndpoint', {
      value: this.webSocketEndpoint,
      description: 'WebSocket API endpoint URL for the Dev Tunnel control plane',
      exportName: 'DevTunnelWebSocketEndpoint',
    });
  }

  /**
   * Creates a Lambda integration for the WebSocket API.
   */
  private createLambdaIntegration(id: string, handler: lambda.IFunction): apigatewayv2.CfnIntegration {
    return new apigatewayv2.CfnIntegration(this, id, {
      apiId: this.api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: this.buildLambdaInvokeArn(handler),
    });
  }

  /**
   * Builds the Lambda invoke ARN in the format expected by API Gateway integrations.
   * Format: arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{functionArn}/invocations
   */
  private buildLambdaInvokeArn(handler: lambda.IFunction): string {
    const region = cdk.Stack.of(this).region;
    return `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${handler.functionArn}/invocations`;
  }
}
