# infra/oci-daytona/variables.tf

# ── OCI Authentication (API key auth — needed for GitHub Actions) ───────────

variable "oci_tenancy_ocid" {
  description = "OCI tenancy OCID"
  type        = string
}

variable "oci_user_ocid" {
  description = "OCID of the OCI user whose API key is used for auth"
  type        = string
}

variable "oci_fingerprint" {
  description = "Fingerprint of the uploaded API signing key"
  type        = string
}

variable "oci_private_key_path" {
  description = "Path to the API signing private key (PEM). In CI, this is written from a secret before terraform runs."
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "oci_region" {
  description = "OCI region, e.g. ap-tokyo-1, us-ashburn-1"
  type        = string
  default     = "ap-tokyo-1"
}

variable "compartment_ocid" {
  description = "Compartment OCID to create resources in (root compartment OCID is acceptable for solo projects)"
  type        = string
}

# ── Compute sizing ────────────────────────────────────────────────────────
# Defaults fit inside the OCI Always Free Ampere A1 allocation as of mid-2026
# (2 OCPU / 12 GB total). Bump these only if you're on Pay-As-You-Go and
# want more headroom for concurrent sandboxes.

variable "instance_ocpus" {
  description = "OCPUs for the Daytona host (VM.Standard.A1.Flex)"
  type        = number
  default     = 2
}

variable "instance_memory_gbs" {
  description = "Memory in GB for the Daytona host"
  type        = number
  default     = 12
}

variable "boot_volume_size_gbs" {
  description = "Boot volume size in GB (Daytona docs: 4GB+ RAM host, this is disk not RAM — 50GB gives comfortable headroom for Docker images)"
  type        = number
  default     = 50
}

variable "data_volume_size_gbs" {
  description = "Separate block volume for persistent Daytona workspace/sandbox data"
  type        = number
  default     = 50
}

variable "ssh_public_key" {
  description = "SSH public key content for instance access"
  type        = string
}

variable "ssh_admin_cidr" {
  description = "CIDR allowed to reach port 22. Restrict this to your own IP/32 in production instead of 0.0.0.0/0."
  type        = string
  default     = "0.0.0.0/0"
}

# ── Daytona / domain configuration ───────────────────────────────────────

variable "daytona_domain" {
  description = "Base domain for the Daytona dashboard, e.g. daytona.example.com. Preview URLs will use {port}-{sandboxId}.proxy.<this domain>."
  type        = string
}

variable "github_repo_url" {
  description = "Daytona OSS repo to clone. Pin to a commit SHA (not a branch) for reproducibility, since the repo is frozen as of June 2026 and main will not move further — but pinning still protects you if you ever re-point this at a fork."
  type        = string
  default     = "https://github.com/daytonaio/daytona.git"
}

variable "daytona_git_ref" {
  description = "Branch, tag, or commit SHA to check out. Defaults to main (safe now that the repo is frozen), but set explicitly once you've verified a working commit."
  type        = string
  default     = "main"
}

# ── Optional Cloudflare DNS automation ───────────────────────────────────

variable "manage_cloudflare_dns" {
  description = "If true, Terraform creates the A record and wildcard A record in Cloudflare pointing at the OCI public IP. Requires cloudflare_api_token and cloudflare_zone_id."
  type        = bool
  default     = false
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token scoped to Zone:DNS:Edit for the target zone. Also reused by Caddy on the host for the DNS-01 wildcard cert challenge."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for daytona_domain's root domain"
  type        = string
  default     = ""
}
