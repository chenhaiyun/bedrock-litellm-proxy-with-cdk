#!/bin/bash
# export $(cat .env | xargs)
# litellm --config litellm-config.yaml

# Stop proxy if it is running
docker stop litellm-proxy

# Delete docker container if it exists
docker rm -f litellm-proxy

# Delete docker image if it exists
docker rmi -f litellm-proxy

# Build docker image
docker build -t litellm-proxy .

# Run docker container with auto-restart
docker run -d -p 8080:8080 --restart always --name litellm-proxy litellm-proxy