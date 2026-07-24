// terraform/backend.tf
//
// FIX (3rd attempt, now confirmed against a known, still-open Terraform
// CLI issue — hashicorp/terraform #34616): -backend-config on the command
// line cannot set nested values like endpoints.s3; it only accepts flat
// key=value pairs. That's why "endpoints.s3=..." was rejected outright as
// "not expected for the selected backend type" — not a typo, a real CLI
// limitation with no fix at time of writing.
//
// Fix: put the endpoint (which contains only the account ID — an
// identifier, not a secret) directly in this file, in the nested
// `endpoints = { s3 = ... }` form the current backend actually expects.
// Only the genuinely secret values (access_key, secret_key) still come
// from -backend-config in CI, since those ARE flat top-level keys and
// aren't affected by this CLI limitation.
//
// ONE-TIME MANUAL STEP: replace YOUR_CLOUDFLARE_ACCOUNT_ID below with your
// real account ID (Cloudflare dashboard -> any domain -> Overview page,
// right sidebar). Not secret, safe to commit.

terraform {
  backend "s3" {
    bucket                      = "hermes-tfstate"
    key                         = "edge-ai-platform/terraform.tfstate"
    region                      = "auto"
    skip_region_validation      = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    use_path_style              = true

    endpoints = {
      s3 = "https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com"
    }
  }
}
