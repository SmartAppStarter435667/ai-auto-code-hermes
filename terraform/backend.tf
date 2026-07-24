// terraform/backend.tf
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
    # endpoints.s3 and access keys come from -backend-config in CI
  }
}
