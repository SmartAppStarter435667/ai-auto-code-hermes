terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0" # was ~> 4.0 — see note below
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "account_id" {
  type = string
}

variable "project_name" {
  type    = string
  default = "cursor-edge-ai"
}

# --- Storage Layer ---
# These two are the actual fix for the placeholder IDs sitting in
# src/workers/edge-ai-platform/wrangler.toml right now. Once this applies,
# copy the real values from the outputs below into that file.

resource "cloudflare_workers_kv_namespace" "ai_cache" {
  account_id = var.account_id
  title      = "${var.project_name}-cache"
}

resource "cloudflare_r2_bucket" "ai_logs" {
  account_id = var.account_id
  name       = "${var.project_name}-logs"
}

resource "cloudflare_queue" "log_queue" {
  account_id = var.account_id
  queue_name = "${var.project_name}-log-queue" # was `name` — v5 renamed this argument
}

output "ai_cache_kv_id" {
  value = cloudflare_workers_kv_namespace.ai_cache.id
}

output "ai_logs_bucket_name" {
  value = cloudflare_r2_bucket.ai_logs.name
}

# ── Removed: cloudflare_worker_script "edge_ai_router" ──────────────────────
# This deployed src/workers/edge-ai-platform/index.ts a second time under
# the name cursor-edge-ai-router. edge-ai-deploy.yml already deploys the
# exact same file as cursor-edge-ai-platform. Same source, two live
# Workers to keep in sync for no benefit — removed rather than fixed.
# If you'd rather have Terraform own that Worker's deployment instead of
# wrangler, that's a reasonable thing to set up deliberately — but it
# should replace the wrangler path, not run alongside it.

# ── Removed: cloudflare_durable_object_namespace "ai_session" ───────────────
# This resource type doesn't exist in the provider — Durable Object
# namespaces are provisioned implicitly by whichever Worker script exports
# the class (via that script's own `migrations` block), not as a standalone
# resource. Also moot regardless: SessionStorageDurableObject, the class
# this was meant to back, isn't implemented in index.ts yet.
