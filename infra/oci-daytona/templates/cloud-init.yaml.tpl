#cloud-config
# infra/oci-daytona/templates/cloud-init.yaml.tpl
#
# Prepares the VM fully: Docker, Docker Compose, the data volume, and a
# checkout of Daytona OSS. Deliberately stops short of running Daytona's
# official setup-domain-oss-deployment.sh unattended — that script expects
# interactive input (GitHub OAuth app Client ID/Secret, DNS confirmation),
# and guessing its flags/env-var names risks a broken deploy. Instead this
# leaves a README-DEPLOY.md with the exact next command to run over SSH.

package_update: true
package_upgrade: false

packages:
  - ca-certificates
  - curl
  - gnupg
  - ufw
  - xfsprogs

write_files:
  - path: /opt/daytona/README-DEPLOY.md
    permissions: '0644'
    content: |
      # Daytona — Final Setup Step (manual, one-time)

      Everything except the interactive wizard is done: Docker, Docker
      Compose, the data volume (mounted at /opt/daytona/data), and the
      repo checkout are ready at /opt/daytona/src.

      Run the official domain setup wizard now:

          cd /opt/daytona/src
          sudo ./setup-domain-oss-deployment.sh

      It will prompt for:
        - Domain: ${daytona_domain}
        - Identity provider: github (recommended, matches Hermes' own GitHub integration)
        - GitHub OAuth App Client ID / Secret
            Homepage URL:   https://${daytona_domain}
            Callback URL:   https://${daytona_domain}/api/auth/callback
        - DNS provider for the wildcard TLS cert (DNS-01 challenge): choose
          Cloudflare if your zone lives there. You'll need an API token with
          Zone:DNS:Edit scope for this domain.

      Before running it, make sure DNS is pointed at this host's public IP:
        ${daytona_domain}        A     <this host's public IP>
        *.proxy.${daytona_domain}  A   <this host's public IP>   (DNS-only / grey-cloud, NOT proxied)

      Once the wizard finishes, the dashboard is at https://${daytona_domain}
      and the API is ready for Hermes' preview-service to call.

  - path: /opt/daytona/.env.example
    permissions: '0644'
    content: |
      # Copy to .env after the setup wizard runs, or let the wizard write it.
      DOMAIN=${daytona_domain}
      RUN_MIGRATIONS=true

runcmd:
  # ── Docker Engine (official repo, arm64) ─────────────────────────────────
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - >
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc]
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" |
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  - apt-get update -y
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - usermod -aG docker ubuntu

  # ── Data volume: format (first boot only) and mount ─────────────────────
  - |
    DEV=${data_volume_path}
    if [ -b "$DEV" ]; then
      if ! blkid "$DEV" > /dev/null 2>&1; then
        mkfs.xfs "$DEV"
      fi
      mkdir -p /opt/daytona/data
      mount "$DEV" /opt/daytona/data
      echo "$DEV /opt/daytona/data xfs defaults,nofail 0 2" >> /etc/fstab
    fi

  # ── Firewall (matches Daytona's documented port requirements) ────────────
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 2222/tcp
  - ufw --force enable

  # ── Clone Daytona OSS (frozen as of June 2026 — see README.md for context) ─
  - mkdir -p /opt/daytona/src
  - git clone ${github_repo_url} /opt/daytona/src || true
  - cd /opt/daytona/src && git checkout ${daytona_git_ref}

  - chown -R ubuntu:ubuntu /opt/daytona

final_message: "Hermes/Daytona host ready after $UPTIME seconds. SSH in and read /opt/daytona/README-DEPLOY.md for the last manual step."
