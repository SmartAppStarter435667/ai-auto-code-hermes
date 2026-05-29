# --- Cloudflare Workers AI + Durable Objects ---
# This layer executes prompt routes, interacts with Groq and Gemini,
# and hosts the long-term SQLite states for mem0 session memories.

resource "cloudflare_worker_script" "workers_ai_service" {
  account_id = var.account_id
  name       = "${var.project_name}-ai-engine"
  content    = file("../src/workers/edge-ai-platform/index.ts")

  # Link to memories through Durable Object binding
  durable_object_namespace_binding {
    name       = "SESSION_STORAGE"
    namespace_id = cloudflare_durable_object_namespace.ai_session.id
  }

  plain_text_binding {
    name = "EMBED_MODEL"
    text = "bge-large-zh-v1.5"
  }

  secret_text_binding {
    name = "GROQ_API_KEY"
    text = "secret-groq-key-placeholder"
  }

  secret_text_binding {
    name = "GEMINI_API_KEY"
    text = "secret-gemini-key-placeholder"
  }
}

# Bindings for the mem0 relational database storage
resource "cloudflare_durable_object_namespace" "ai_sqlite_memory" {
  account_id = var.account_id
  name       = "${var.project_name}-sqlite-memory"
}
