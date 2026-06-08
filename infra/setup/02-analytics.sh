#!/usr/bin/env bash
# Phase B — KMS + DynamoDB + Lambda + API Gateway helpers for analytics ingest.
# See infra/README.md and specs/analytics/SPEC.md.
set -euo pipefail

: "${AWS_REGION:=il-central-1}"
: "${TABLE_NAME:=salary_observations}"
: "${KMS_ALIAS:=alias/get-tlush-analytics}"
: "${LAMBDA_ROLE_NAME:=get-tlush-ingest-lambda}"
: "${LAMBDA_FUNCTION_NAME:=get-tlush-ingest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$INFRA_DIR/.." && pwd)"

create_kms_key() {
  local key_id
  key_id="$(aws kms create-key \
    --description "get-tlush salary observations" \
    --query KeyMetadata.KeyId \
    --output text)"
  aws kms create-alias --alias-name "$KMS_ALIAS" --target-key-id "$key_id"
  echo "KMS_KEY_ID=$key_id"
  echo "Created KMS key and alias $KMS_ALIAS"
}

create_dynamodb_table() {
  if aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    echo "Table already exists: $TABLE_NAME"
    return
  fi

  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
      AttributeName=contributor_token,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification "Enabled=true,SSEType=KMS,KMSMasterKeyId=$KMS_ALIAS" \
    --global-secondary-indexes '[
      {
        "IndexName": "contributor_token-index",
        "KeySchema": [{"AttributeName":"contributor_token","KeyType":"HASH"}],
        "Projection": {"ProjectionType":"KEYS_ONLY"}
      }
    ]'

  aws dynamodb update-continuous-backups \
    --table-name "$TABLE_NAME" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

  echo "Created DynamoDB table: $TABLE_NAME (PITR enabled)"
}

create_lambda_role() {
  local account_id trust_path policy_path role_arn
  account_id="$(aws sts get-caller-identity --query Account --output text)"
  trust_path="$INFRA_DIR/iam/lambda-trust.json"
  policy_path="$INFRA_DIR/iam/lambda-ingest-policy.json"

  if aws iam get-role --role-name "$LAMBDA_ROLE_NAME" >/dev/null 2>&1; then
    echo "IAM role already exists: $LAMBDA_ROLE_NAME"
    return
  fi

  aws iam create-role \
    --role-name "$LAMBDA_ROLE_NAME" \
    --assume-role-policy-document "file://$trust_path"

  aws iam attach-role-policy \
    --role-name "$LAMBDA_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  policy_path_resolved="$(cd "$(dirname "$policy_path")" && pwd)/$(basename "$policy_path")"
  sed "s/ACCOUNT_ID/$account_id/g; s|alias/get-tlush-analytics|$KMS_ALIAS|g" \
    "$policy_path_resolved" > /tmp/lambda-ingest-policy-resolved.json

  aws iam put-role-policy \
    --role-name "$LAMBDA_ROLE_NAME" \
    --policy-name get-tlush-ingest-inline \
    --policy-document "file:///tmp/lambda-ingest-policy-resolved.json"

  role_arn="arn:aws:iam::${account_id}:role/${LAMBDA_ROLE_NAME}"
  echo "LAMBDA_ROLE_ARN=$role_arn"
  echo "Created IAM role: $LAMBDA_ROLE_NAME"
}

deploy_lambda() {
  : "${LAMBDA_ROLE_ARN:?Set LAMBDA_ROLE_ARN (from create-lambda-role)}"
  : "${KMS_KEY_ID:?Set KMS_KEY_ID}"
  local ingest_dir="$REPO_ROOT/apps/ingest"
  local zip_file="/tmp/get-tlush-ingest.zip"

  if [[ ! -d "$ingest_dir" ]]; then
    echo "apps/ingest not implemented yet — skip Lambda deploy" >&2
    exit 1
  fi

  (cd "$ingest_dir" && yarn build && zip -j "$zip_file" dist/handler.js)

  if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" >/dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name "$LAMBDA_FUNCTION_NAME" \
      --zip-file "fileb://$zip_file"
    echo "Updated Lambda: $LAMBDA_FUNCTION_NAME"
  else
    aws lambda create-function \
      --function-name "$LAMBDA_FUNCTION_NAME" \
      --runtime nodejs20.x \
      --role "$LAMBDA_ROLE_ARN" \
      --handler handler.main \
      --zip-file "fileb://$zip_file" \
      --environment "Variables={TABLE_NAME=$TABLE_NAME,KMS_KEY_ID=$KMS_KEY_ID}"
    echo "Created Lambda: $LAMBDA_FUNCTION_NAME"
  fi
}

create_api_gateway() {
  : "${LAMBDA_FUNCTION_ARN:?Set LAMBDA_FUNCTION_ARN}"
  : "${INGEST_PATH_SEGMENT:?Set INGEST_PATH_SEGMENT (non-guessable, e.g. 32-char random)}"

  local api_id integration_id
  api_id="$(aws apigatewayv2 create-api \
    --name get-tlush-ingest \
    --protocol-type HTTP \
    --query ApiId \
    --output text)"

  integration_id="$(aws apigatewayv2 create-integration \
    --api-id "$api_id" \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):function:${LAMBDA_FUNCTION_NAME}" \
    --payload-format-version "2.0" \
    --query IntegrationId \
    --output text)"

  aws apigatewayv2 create-route \
    --api-id "$api_id" \
    --route-key "POST /${INGEST_PATH_SEGMENT}" \
    --target "integrations/${integration_id}"

  aws apigatewayv2 create-stage \
    --api-id "$api_id" \
    --stage-name prod \
    --auto-deploy

  local endpoint
  endpoint="$(aws apigatewayv2 get-api --api-id "$api_id" --query ApiEndpoint --output text)"
  echo "VITE_ANALYTICS_INGEST_URL=${endpoint}/${INGEST_PATH_SEGMENT}"
  echo "Store the ingest URL in GitHub secret VITE_ANALYTICS_INGEST_URL — do not commit it."
}

usage() {
  cat <<'EOF'
Usage: 02-analytics.sh <command>

Commands:
  create-kms             Create CMK + alias/get-tlush-analytics
  create-table           Create salary_observations DynamoDB table
  create-lambda-role     Create get-tlush-ingest-lambda IAM role
  deploy-lambda          Build apps/ingest and create/update Lambda
  create-api             Create HTTP API + POST route (needs INGEST_PATH_SEGMENT)
  setup-core             create-kms + create-table + create-lambda-role

Environment:
  AWS_REGION             Default: il-central-1
  TABLE_NAME             Default: salary_observations
  KMS_ALIAS              Default: alias/get-tlush-analytics
  KMS_KEY_ID             Required for deploy-lambda
  LAMBDA_ROLE_ARN        Required for deploy-lambda
  LAMBDA_FUNCTION_ARN    Required for create-api
  INGEST_PATH_SEGMENT    Non-guessable path for POST route
EOF
}

cmd="${1:-}"
case "$cmd" in
  create-kms) create_kms_key ;;
  create-table) create_dynamodb_table ;;
  create-lambda-role) create_lambda_role ;;
  deploy-lambda) deploy_lambda ;;
  create-api) create_api_gateway ;;
  setup-core) create_kms_key; create_dynamodb_table; create_lambda_role ;;
  ""|help|-h|--help) usage ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
