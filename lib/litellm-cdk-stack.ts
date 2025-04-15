import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class LitellmCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new ec2.Vpc(this, 'LiteLLMVpc', {
      maxAzs: 2,
      natGateways: 1
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'LiteLLMCluster', {
      vpc: vpc,
      containerInsights: true,
    });

    // Create Secrets
    const masterKeySecret = new secretsmanager.Secret(this, 'LiteLLMMasterKey', {
      secretName: 'litellm/master-key',
      generateSecretString: {
        passwordLength: 32,
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    const azureApiKeySecret = new secretsmanager.Secret(this, 'AzureApiKey', {
      secretName: 'litellm/azure-api-key',
      generateSecretString: {
        passwordLength: 32,
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    const azureApiBaseSecret = new secretsmanager.Secret(this, 'AzureApiBase', {
      secretName: 'litellm/azure-api-base',
      generateSecretString: {
        generateStringKey: 'url',
        secretStringTemplate: JSON.stringify({ url: 'https://your-azure-endpoint.openai.azure.com/' }),
      },
    });

    const geminiApiKeySecret = new secretsmanager.Secret(this, 'GeminiApiKey', {
      secretName: 'litellm/gemini-api-key',
      generateSecretString: {
        passwordLength: 32,
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    // Create Task Role
    const taskRole = new iam.Role(this, 'LiteLLMTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add permissions to access Secret Manager
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        masterKeySecret.secretArn,
        azureApiKeySecret.secretArn,
        azureApiBaseSecret.secretArn,
        geminiApiKeySecret.secretArn
      ],
    }));

    // Add permissions to use STS
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sts:AssumeRole',
      ],
      resources: ['*'],
    }));

    // Create Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'LiteLLMTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole: taskRole,
    });

    // Add container to task definition
    const container = taskDefinition.addContainer('LiteLLMContainer', {
      image: ecs.ContainerImage.fromAsset('../LiteLLM'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'LiteLLM' }),
      environment: {
        PORT: '8080',
      },
      secrets: {
        LITELLM_MASTER_KEY: ecs.Secret.fromSecretsManager(masterKeySecret),
        AZURE_API_KEY: ecs.Secret.fromSecretsManager(azureApiKeySecret),
        AZURE_API_BASE: ecs.Secret.fromSecretsManager(azureApiBaseSecret, 'url'),
        GEMINI_API_KEY: ecs.Secret.fromSecretsManager(geminiApiKeySecret),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Create Fargate Service
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'LiteLLMService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
      assignPublicIp: true,
      listenerPort: 80,
    });

    // Add scaling policy
    const scaling = fargateService.service.autoScaleTaskCount({
      maxCapacity: 4,
      minCapacity: 1,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Output the Load Balancer DNS
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'The DNS name of the load balancer',
    });
  }
}
