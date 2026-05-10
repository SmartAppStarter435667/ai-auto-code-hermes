
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
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

resource "cloudflare_workers_kv_namespace" "ai_cache" {
  account_id = var.account_id
  title      = "${var.project_name}-cache"
}

resource "cloudflare_r2_bucket" "ai_logs" {
  account_id = var.account_id
  name       = "${var.project_name}-logs"
}

# --- Compute Layer (Workers) ---

resource "cloudflare_worker_script" "edge_ai_router" {
  account_id = var.account_id
  name       = "${var.project_name}-router"
  content    = file("../src/workers/edge-ai-platform/index.ts")

  kv_namespace_binding {
    name         = "AI_CACHE"
    namespace_id = cloudflare_workers_kv_namespace.ai_cache.id
  }

  r2_bucket_binding {
    name        = "LOG_BUCKET"
    bucket_name = cloudflare_r2_bucket.ai_logs.name
  }

  analytics_engine_binding {
    dataset = "ai_metrics"
    name    = "METRICS"
  }
}

resource "cloudflare_durable_object_namespace" "ai_session" {
  account_id = var.account_id
  name       = "${var.project_name}-sessions"
}

# --- Message Queue (Async Logging) ---

resource "cloudflare_queue" "log_queue" {
  account_id = var.account_id
  name       = "${var.project_name}-log-queue"
}
