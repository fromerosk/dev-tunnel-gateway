#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DevTunnelStack } from '../lib/dev-tunnel-stack';

const app = new cdk.App();

new DevTunnelStack(app, 'DevTunnelStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION,
  },
  description: 'Dev Tunnel Gateway - serverless ngrok-like relay for local development',
});
