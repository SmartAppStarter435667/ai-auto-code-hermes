# infra/oci-daytona/providers.tf

provider "oci" {
  tenancy_ocid     = var.oci_tenancy_ocid
  user_ocid        = var.oci_user_ocid
  fingerprint      = var.oci_fingerprint
  private_key_path = var.oci_private_key_path
  region           = var.oci_region
}

# Only required if manage_cloudflare_dns = true.
# Reuses the same Cloudflare account Athena's other Cloudflare-native
# projects already run under.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
