# --- Cloudflare Pages for Git Operations App ---
# Same fix as pages_daytona.tf — see that file's comment for the full
# reasoning on why the source{} block (owner = "user", repo_name =
# "cursor-app" — also placeholders, unrelated to this repo) was removed
# rather than patched in place.
#
# Note: NEXT_PUBLIC_API_URL below references "${var.project_name}-ai-api",
# which doesn't match any Worker name actually in use elsewhere
# (cursor-edge-ai-platform / cursor-edge-ai-router / cursor-edge-ai-ai-engine
# all showed up across the other files) — worth deciding on one canonical
# name for this Worker and making every reference to it consistent, rather
# than fixing this one URL in isolation.

resource "cloudflare_pages_project" "git_ops_app" {
  account_id        = var.account_id
  name              = "${var.project_name}-git-ops"
  production_branch = "main"

  deployment_configs = {
    production = {
      environment_variables = {
        NEXT_PUBLIC_APP_ENV     = "production"
        NEXT_PUBLIC_API_URL     = "https://${var.project_name}-ai-api.workers.dev"     # TODO: confirm real Worker name
        NEXT_PUBLIC_DAYTONA_URL = "https://${var.project_name}-daytona.pages.dev"
      }
    }
    preview = {
      environment_variables = {
        NEXT_PUBLIC_APP_ENV     = "preview"
        NEXT_PUBLIC_API_URL     = "https://${var.project_name}-ai-api-preview.workers.dev" # TODO: confirm real Worker name
        NEXT_PUBLIC_DAYTONA_URL = "https://${var.project_name}-daytona-preview.pages.dev"
      }
    }
  }
}
