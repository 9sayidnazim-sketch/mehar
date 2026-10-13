#!/usr/bin/env bash
set -e

# THREDO - AWS Automated Deployment Script
# Supports: AWS App Runner (recommended) & AWS Elastic Container Registry (ECR)

echo "========================================================"
echo "🚀 Deploying THREDO to Amazon Web Services (AWS)"
echo "========================================================"

# 1. Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed. Please install it from https://aws.amazon.com/cli/"
    exit 1
fi

# 2. Check AWS Credentials
echo "🔍 Checking AWS authentication..."
CALLER_IDENTITY=$(aws sts get-caller-identity 2>&1 || true)
if echo "$CALLER_IDENTITY" | grep -q "NoCredentials"; then
    echo "❌ AWS credentials are not configured on this machine."
    echo ""
    echo "Please configure your AWS credentials using one of the following methods:"
    echo "  1. Run 'aws configure' and provide your AWS Access Key ID, Secret Key, and default region (e.g., us-east-1)."
    echo "  2. Or set environment variables:"
    echo "       export AWS_ACCESS_KEY_ID='your-access-key-id'"
    echo "       export AWS_SECRET_ACCESS_KEY='your-secret-access-key'"
    echo "       export AWS_DEFAULT_REGION='us-east-1'"
    echo ""
    echo "Alternatively, you can deploy in 2 clicks via the AWS Console:"
    echo "  - Open AWS App Runner: https://console.aws.amazon.com/apprunner/"
    echo "  - Create Service -> Source: 'Source code repository' (GitHub: 9sayidnazim-sketch/mehar)"
    echo "  - The repository includes 'apprunner.yaml' and 'Dockerfile' for instant deployment!"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-$(aws configure get region || echo "us-east-1")}
APP_NAME="thredo-app"
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${APP_NAME}"

echo "✅ Authenticated as AWS Account: ${ACCOUNT_ID} (Region: ${REGION})"

# 3. Check or Create ECR Repository
echo "📦 Verifying ECR repository '${APP_NAME}'..."
aws ecr describe-repositories --repository-names "${APP_NAME}" --region "${REGION}" &>/dev/null || \
aws ecr create-repository --repository-name "${APP_NAME}" --region "${REGION}"

# 4. Login to ECR
echo "🔑 Logging in to Amazon ECR..."
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# 5. Build and Tag Docker Image
echo "🔨 Building Docker image..."
docker build -t "${APP_NAME}:latest" .
docker tag "${APP_NAME}:latest" "${ECR_REPO}:latest"

# 6. Push to ECR
echo "⬆️ Pushing image to Amazon ECR..."
docker push "${ECR_REPO}:latest"

echo "========================================================"
echo "🎉 Image pushed successfully to: ${ECR_REPO}:latest"
echo "You can now launch or update your AWS App Runner or ECS service with this image."
echo "========================================================"
