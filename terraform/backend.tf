// terraform/backend.tf
//
// Fixes the recurring "already exists" conflicts for good: state now
// persists in an R2 bucket instead of vanishing with every CI runner.
//
// Partial config on purpose — account_id/keys are injected via
// `-backend-config` flags in edge-ai-deploy.yml's terraform init step
// (from GitHub secrets), not hardcoded here. Requires the bucket to exist
// first: run .github/workflows/bootstrap-tfstate-bucket.yml once (tap
// "Run workflow" — no local CLI needed) before this takes effect.

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
    # endpoint and access keys come from -backend-config in CI
  }
}
