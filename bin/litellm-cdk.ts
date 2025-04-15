#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LitellmCdkStack } from '../lib/litellm-cdk-stack';

const app = new cdk.App();
new LitellmCdkStack(app, 'LitellmCdkStack', {
  // 使用当前 CLI 配置的 AWS 账户和区域
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },

  // 添加标签
  tags: {
    Environment: 'production',
    Service: 'litellm',
    Deployer: 'cdk'
  },
});
