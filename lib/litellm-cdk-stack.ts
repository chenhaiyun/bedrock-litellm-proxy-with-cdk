import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
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

    // Add permissions to use STS and Bedrock
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sts:AssumeRole',
        'bedrock:InvokeModel',
        "bedrock:InvokeModelWithResponseStream",
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
      image: ecs.ContainerImage.fromAsset('./proxy'),
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

    // Create security group for Fargate tasks
    const fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSecurityGroup', {
      vpc,
      description: 'Security group for Fargate tasks',
      allowAllOutbound: true,
    });

    // Create ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Create Fargate Service with ALB
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'LiteLLMService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
      assignPublicIp: false, // Disable public IP assignment
      listenerPort: 80,
      securityGroups: [fargateSecurityGroup], // Assign security group to Fargate tasks
      loadBalancer: new elbv2.ApplicationLoadBalancer(this, 'ALB', {
        vpc,
        internetFacing: true,
        securityGroup: albSecurityGroup
      })
    });

    // Get the listener and target group
    const listener = fargateService.listener;
    const targetGroup = fargateService.targetGroup;

    // Create a rule for host-based routing
    new elbv2.ApplicationListenerRule(this, 'AllowViaDNS', {
      listener: listener,
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.hostHeaders([fargateService.loadBalancer.loadBalancerDnsName])
      ],
      action: elbv2.ListenerAction.forward([targetGroup])
    });

    // Override the default action to block direct IP access
    const cfnListener = listener.node.defaultChild as elbv2.CfnListener;
    cfnListener.defaultActions = [{
      type: 'fixed-response',
      fixedResponseConfig: {
        statusCode: '403',
        contentType: 'text/plain',
        messageBody: 'Forbidden: Access denied.',
      }
    }];

    // Configure security groups
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic only'
    );

    // Allow inbound traffic only from the ALB
    fargateSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      ec2.Port.tcp(8080),
      'Allow inbound traffic from ALB only'
    );


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
