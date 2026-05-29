# --- Cloudflare Pages for Daytona Preview Function ---
# This resource provisions the server menu preview environments, 
# exposing terminal execution endpoints and managing workspace sandbox environments.

resource "cloudflare_pages_project" "daytona_preview_app" {
  account_id        = var.account_id
  name              = "${var.project_name}-daytona"
  production_branch = "main"

  build_config {
    build_command       = "npm run build --prefix daytona-preview"
    destination_dir     = "dist"
    root_dir            = "daytona-preview"
    web_analytics_tag   = ""
    web_analytics_token = ""
  }

  source {
    type = "github"
    config {
      owner                         = "user"
      repo_name                     = "daytona"
      production_branch             = "main"
      pr_comments_enabled           = false
      deployments_enabled          = true
      production_deployment_enabled = true
      preview_deployment_setting    = "all"
      preview_branch_filters        = ["*"]
    }
  }

  deployment_configs {
    production {
      environment_variables = {
        DAYTONA_SERVER_URL    = "https://daytona.cursor.internal"
        DAYTONA_TARGET_PROVIDER = "cloudflare"
        ENABLE_AUTO_HEALING   = "true"
      }
    }
    preview {
      environment_variables = {
        DAYTONA_SERVER_URL    = "https://daytona-preview.cursor.internal"
        DAYTONA_TARGET_PROVIDER = "cloudflare"
        ENABLE_AUTO_HEALING   = "true"
      }
    }
  }
}
