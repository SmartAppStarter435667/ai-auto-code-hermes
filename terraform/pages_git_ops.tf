# --- Cloudflare Pages for Git Operations App ---
# This resource provisions the primary user interface containing
# repository menus, editor split-views, history logs, and Vault settings.

resource "cloudflare_pages_project" "git_ops_app" {
  account_id        = var.account_id
  name              = "${var.project_name}-git-ops"
  production_branch = "main"

  build_config {
    build_command       = "npm run build"
    destination_dir     = "dist"
    root_dir            = ""
    web_analytics_tag   = ""
    web_analytics_token = ""
  }

  source {
    type = "github"
    config {
      owner                         = "user"
      repo_name                     = "cursor-app"
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled          = true
      production_deployment_enabled = true
      preview_deployment_setting    = "all"
      preview_branch_filters        = ["*"]
    }
  }

  deployment_configs {
    production {
      environment_variables = {
        NEXT_PUBLIC_APP_ENV   = "production"
        NEXT_PUBLIC_API_URL   = "https://${var.project_name}-ai-api.workers.dev"
        NEXT_PUBLIC_DAYTONA_URL = "https://${var.project_name}-daytona.pages.dev"
      }
    }
    preview {
      environment_variables = {
        NEXT_PUBLIC_APP_ENV   = "preview"
        NEXT_PUBLIC_API_URL   = "https://${var.project_name}-ai-api-preview.workers.dev"
        NEXT_PUBLIC_DAYTONA_URL = "https://${var.project_name}-daytona-preview.pages.dev"
      }
    }
  }
}
