# --- Cloudflare Workers AI + Durable Objects ---
#
# Everything this file used to define has been removed rather than fixed:
#
#   cloudflare_worker_script "workers_ai_service" deployed
#   src/workers/edge-ai-platform/index.ts a THIRD time, under yet another
#   name (cursor-edge-ai-ai-engine) — the same file main.tf's now-removed
#   edge_ai_router deployed as cursor-edge-ai-router, and edge-ai-deploy.yml
#   deploys as cursor-edge-ai-platform. Three live copies of one file was
#   never the goal; pick one deployment path for this Worker (wrangler via
#   edge-ai-deploy.yml is already working) and let Terraform own the
#   supporting resources (KV/R2/Queue/Pages — see main.tf) instead of the
#   Worker itself.
#
#   Its durable_object_namespace_binding block used syntax that doesn't
#   exist in this provider (bindings are entries in a script's own unified
#   `bindings = [...]` list, not a separate nested block type), bound to
#   cloudflare_durable_object_namespace.ai_sqlite_memory — also not a real
#   resource type, for the same reason ai_session wasn't in main.tf.
#
#   Its secret_text_binding blocks hardcoded GROQ_API_KEY / GEMINI_API_KEY
#   as literal placeholder strings directly in this committed file. Worth
#   avoiding as a pattern even for placeholders — use a sensitive variable
#   sourced from a real secret (same pattern as cloudflare_api_token in
#   main.tf), never a literal string in version control.
#
# If real Durable Object session/memory storage turns out to be wanted
# later, that needs: (1) an actual `export class Whatever extends
# DurableObject { ... }` written in the target Worker's own source, and
# (2) a durable_object_namespace entry in THAT Worker's bindings — either
# in its wrangler.toml, or in cloudflare_workers_script if Terraform ends
# up owning that Worker's deployment. Worth doing deliberately as a real
# feature, not reverse-engineered to clear a terraform apply error.
