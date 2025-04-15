# LiteLLM CDK Deployment

This project contains the AWS CDK infrastructure code for deploying LiteLLM on AWS Fargate.

## Prerequisites

1. AWS CLI installed and configured with appropriate credentials
2. Node.js and npm installed
3. AWS CDK CLI installed (`npm install -g aws-cdk`)
4. Docker installed (for building container images)

## Deployment Steps

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

3. Deploy the stack:
```bash
cdk deploy
```

## Post-Deployment Steps

After deployment, you'll need to update the following secrets in AWS Secrets Manager:

1. `litellm/azure-api-key`: Your Azure OpenAI API key
2. `litellm/azure-api-base`: Your Azure OpenAI endpoint URL
3. `litellm/gemini-api-key`: Your Google Gemini API key

The `litellm/master-key` will be automatically generated during deployment.

## Architecture

- VPC with 2 Availability Zones
- ECS Cluster running on Fargate
- Application Load Balancer
- Auto-scaling configuration (1-4 tasks based on CPU utilization)
- AWS Secrets Manager for storing sensitive credentials
- IAM roles with least privilege access
- Container running on port 8080

## Security

- All sensitive information is stored in AWS Secrets Manager
- AWS credentials are obtained through STS
- Task IAM role has minimal required permissions
- Network access is controlled through Security Groups

## Monitoring

- Container insights enabled for the ECS cluster
- CloudWatch logs for container output
- Load balancer access logs (optional)

## Cleanup

To remove all resources:
```bash
cdk destroy
