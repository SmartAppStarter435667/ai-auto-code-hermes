#!/usr/bin/env bash
# infra/oci-daytona/scripts/bootstrap-backend.sh
#
# One-time setup for the OPTIONAL remote state backend (backend.tf.disabled).
# Run this once, before ever renaming backend.tf.disabled -> backend.tf.
# Requires the OCI CLI, already configured (`oci setup config`).
#
# Usage:
#   ./bootstrap-backend.sh <compartment-ocid> [bucket-name] [region]

set -euo pipefail

COMPARTMENT_OCID="${1:?Usage: $0 <compartment-ocid> [bucket-name] [region]}"
BUCKET_NAME="${2:-hermes-daytona-tfstate}"
REGION="${3:-ap-tokyo-1}"

echo "→ Checking for existing bucket '${BUCKET_NAME}' in ${REGION}…"

if oci os bucket get --bucket-name "${BUCKET_NAME}" --region "${REGION}" > /dev/null 2>&1; then
  echo "✓ Bucket already exists — nothing to do."
  exit 0
fi

echo "→ Creating bucket '${BUCKET_NAME}'…"
oci os bucket create \
  --compartment-id "${COMPARTMENT_OCID}" \
  --name "${BUCKET_NAME}" \
  --region "${REGION}" \
  --versioning Enabled

NAMESPACE=$(oci os ns get --query 'data' --raw-output --region "${REGION}")

echo ""
echo "✓ Bucket created."
echo ""
echo "Next steps:"
echo "  1. Generate a Customer Secret Key (NOT your API signing key):"
echo "     OCI Console → Profile → Customer Secret Keys → Generate Secret Key"
echo "  2. export AWS_ACCESS_KEY_ID=<access key>"
echo "     export AWS_SECRET_ACCESS_KEY=<secret key>"
echo "  3. In backend.tf.disabled, set:"
echo "       bucket   = \"${BUCKET_NAME}\""
echo "       endpoint = \"https://${NAMESPACE}.compat.objectstorage.${REGION}.oraclecloud.com\""
echo "  4. mv backend.tf.disabled backend.tf"
echo "  5. terraform init -migrate-state"
