#!/usr/bin/env bash
# Phase A — S3 + CloudFront helpers for get-tlush static site.
# See infra/README.md and the project plan AWS Setup Guide.
set -euo pipefail

: "${AWS_REGION:=il-central-1}"
: "${BUCKET_NAME:?Set BUCKET_NAME (globally unique, e.g. get-tlush-web-YOUR-SUFFIX)}"

echo "==> Region: $AWS_REGION"
echo "==> Bucket: $BUCKET_NAME"

create_bucket() {
  if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "Bucket already exists: $BUCKET_NAME"
    return
  fi

  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION"
  fi
  echo "Created bucket: $BUCKET_NAME"
}

block_public_access() {
  aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "Public access blocked on $BUCKET_NAME"
}

deploy_dist() {
  local dist_dir="${1:-apps/web/dist}"
  if [[ ! -d "$dist_dir" ]]; then
    echo "Missing $dist_dir — run: yarn build" >&2
    exit 1
  fi
  aws s3 sync "$dist_dir/" "s3://$BUCKET_NAME/" --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html" \
    --exclude "*.html"
  aws s3 sync "$dist_dir/" "s3://$BUCKET_NAME/" --delete \
    --cache-control "no-cache" \
    --exclude "*" \
    --include "index.html" \
    --include "*.html"
  echo "Synced $dist_dir → s3://$BUCKET_NAME/"
}

invalidate_cloudfront() {
  : "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID for CloudFront invalidation}"
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
  echo "Invalidation requested for distribution $DISTRIBUTION_ID"
}

usage() {
  cat <<'EOF'
Usage: 01-static-site.sh <command>

Commands:
  create-bucket          Create private S3 bucket
  block-public-access    Block all public access on bucket
  deploy [dist-dir]      Sync apps/web/dist to S3 (default: apps/web/dist)
  invalidate             CloudFront cache invalidation (needs DISTRIBUTION_ID)
  setup                  create-bucket + block-public-access

Environment:
  AWS_REGION             Default: il-central-1
  BUCKET_NAME            Required — globally unique bucket name
  DISTRIBUTION_ID        Required for invalidate

CloudFront + OAC: create in AWS Console first (see infra/README.md), then note
CLOUDFRONT_DOMAIN and DISTRIBUTION_ID for deploy + OAuth redirect URIs.
EOF
}

cmd="${1:-}"
case "$cmd" in
  create-bucket) create_bucket ;;
  block-public-access) block_public_access ;;
  deploy) deploy_dist "${2:-apps/web/dist}" ;;
  invalidate) invalidate_cloudfront ;;
  setup) create_bucket; block_public_access ;;
  ""|help|-h|--help) usage ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
