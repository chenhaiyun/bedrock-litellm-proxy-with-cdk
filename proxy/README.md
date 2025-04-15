# LiteLLM Proxy Server

A containerized LiteLLM proxy server implementation that provides a unified interface for multiple LLM providers including AWS Bedrock, Azure OpenAI, and Google Gemini.

## Supported Models

- **AWS Bedrock Models**
  - Claude 3.5 Sonnet v2
  - Claude 3.7 Sonnet v1
  - DeepSeek R1
  - Mistral Large
  - Llama 3.1 405B
  - Cohere Command R+

- **Azure OpenAI Models**
  - DALL-E 3
  - GPT-4

- **Google Models**
  - Gemini 2.0

## Setup

### Environment Variables

Create a `.env` file based on the provided `.env.example`:

```bash
AZURE_API_KEY=your_azure_key
AZURE_API_BASE=https://your_instance.openai.azure.com
AWS_ACCESS_KEY_ID=your_aws_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SESSION_TOKEN=your_aws_session_token
AWS_REGION=us-west-2
GEMINI_API_KEY=your_gemini_key
LITELLM_MASTER_KEY=your_master_key
PORT=4000
HOST=127.0.0.1
```

### Configuration

The `litellm-config.yaml` file contains the model configurations. Each model entry specifies:
- Model name alias
- Provider-specific parameters
- API credentials (loaded from environment variables)

## Docker Deployment

### Build and Run

Use the provided `build.sh` script to build and deploy the Docker container:

```bash
./build.sh
```

This script will:
1. Stop and remove any existing litellm-proxy container
2. Build a new Docker image
3. Start the container with auto-restart enabled
4. Expose the service on port 8080

### Manual Docker Commands

If you prefer to run Docker commands manually:

```bash
# Build the image
docker build -t litellm-proxy .

# Run the container
docker run -d -p 8080:8080 --restart always --name litellm-proxy litellm-proxy
```

## Local Development

To run the server locally without Docker:

1. Set up your environment variables:
```bash
export $(cat .env | xargs)
```

2. Start the server:
```bash
./start.sh
```

Or run directly with litellm:
```bash
litellm --config litellm-config.yaml --host 0.0.0.0 --port 8080
```

## API Usage

The server exposes a REST API endpoint that follows the OpenAI API format. You can make requests using your preferred HTTP client with the configured LITELLM_MASTER_KEY for authentication.

Example endpoint: `http://localhost:8080/v1/chat/completions`

## Security Notes

- Always keep your API keys and credentials secure
- Use environment variables for sensitive information
- The LITELLM_MASTER_KEY is required for API authentication
- Consider network security when deploying in production
