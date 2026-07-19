# --- Cloudflare Pages for Daytona Preview Function ---
# Provisions the server-menu preview environment.
#
# FIX: removed the `source { type = "github" ... } }` block. That config
# is for git-connected deployments (Cloudflare pulls from a repo on push),
# but it pointed at owner = "user", repo_name = "daytona" — placeholder
# values, not this repository. The actual deployment happens via
# `wrangler pages deploy` (direct upload) in deploy.yml, a different,
# incompatible mechanism. Direct-upload projects only need
# account_id/name/production_branch — no source block, and the invalid
# preview_branch_filters argument (real name: preview_branch_includes)
# goes away along with it since it lived inside that block.
#
# Once this applies, deploy.yml's "Project not found" error for
# cursor-edge-ai-daytona is gone for good — no more manually running
# `wrangler pages project create`.
#
# deployment_configs is unrelated to the source/build mechanism — it just
# sets runtime environment variables for Pages Functions — so it's kept,
# though the URLs below are still placeholders you'll want to fill in with
# real values once the underlying services have settled on final names.

resource "cloudflare_pages_project" "daytona_preview_app" {
  account_id        = var.account_id
  name              = "${var.project_name}-daytona"
  production_branch = "main"

  deployment_configs = {
    production = {
      environment_variables = {
        DAYTONA_SERVER_URL      = "https://daytona.cursor.internal" # TODO: real value
        DAYTONA_TARGET_PROVIDER = "cloudflare"
        ENABLE_AUTO_HEALING     = "true"
      }
    }
    preview = {
      environment_variables = {
        DAYTONA_SERVER_URL      = "https://daytona-preview.cursor.internal" # TODO: real value
        DAYTONA_TARGET_PROVIDER = "cloudflare"
        ENABLE_AUTO_HEALING     = "true"
      }
    }
  }
}
