# infra/oci-daytona/versions.tf

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # ── Remote state backend (OPTIONAL — disabled by default) ─────────────────
  # Terraform cannot create the bucket it will use as its own backend, so
  # this must exist before `terraform init` if you enable it. See
  # scripts/bootstrap-backend.sh and backend.tf.disabled for the opt-in path.
  #
  # Left as local state by default so a first-time `terraform init && apply`
  # never fails on a backend that doesn't exist yet.
}
