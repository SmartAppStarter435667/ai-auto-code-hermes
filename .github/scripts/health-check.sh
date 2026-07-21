#!/usr/bin/env bash
# .github/scripts/health-check.sh
#
# Usage:
#   health-check.sh pages <project-name>
#   health-check.sh worker <worker-name> <cloudflare-api-token> <account-id>
#
# Pages projects have a predictable production URL (https://<name>.pages.dev),
# so no API call is needed for those. Workers don't — the workers.dev
# subdomain is account-specific, so it's fetched from the Cloudflare API
# rather than guessed or hardcoded.
#
# Retries with backoff: a fresh deploy can take a few seconds to actually
# propagate, so checking once immediately would produce false failures.

set -euo pipefail

TYPE="${1:?Usage: health-check.sh pages|worker <name> [api-token] [account-id]}"
NAME="${2:?name required}"
MAX_ATTEMPTS=6
DELAY_SECONDS=5

resolve_url() {
  if [ "$TYPE" = "pages" ]; then
    echo "https://${NAME}.pages.dev/"
  elif [ "$TYPE" = "worker" ]; then
    local token="${3:?api token required for worker health checks}"
    local account_id="${4:?account id required for worker health checks}"
    local subdomain
    subdomain=$(curl -s -H "Authorization: Bearer ${token}" \
      "https://api.cloudflare.com/client/v4/accounts/${account_id}/workers/subdomain" \
      | node -e "process.stdin.on('data', d => { try { console.log(JSON.parse(d).result.subdomain) } catch { process.exit(1) } })")
    if [ -z "$subdomain" ]; then
      echo "Could not resolve workers.dev subdomain from the API — skipping URL construction" >&2
      exit 1
    fi
    echo "https://${NAME}.${subdomain}.workers.dev/"
  else
    echo "Unknown type: $TYPE (expected 'pages' or 'worker')" >&2
    exit 1
  fi
}

URL=$(resolve_url "$@")
echo "Health check target: $URL"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" || echo "000")

  # 2xx/3xx = healthy. 404 is accepted too — some Workers/Pages projects
  # don't define a root route, and that's a routing choice, not evidence
  # the deploy itself failed. 5xx and connection failures (000) are the
  # signal actually worth failing the job over.
  if [[ "$STATUS" =~ ^[23] ]] || [ "$STATUS" = "404" ]; then
    echo "✅ Healthy (HTTP $STATUS) after attempt $attempt/$MAX_ATTEMPTS"
    exit 0
  fi

  echo "Attempt $attempt/$MAX_ATTEMPTS: got HTTP $STATUS, retrying in ${DELAY_SECONDS}s…"
  sleep "$DELAY_SECONDS"
done

echo "❌ Health check failed after $MAX_ATTEMPTS attempts (last status: $STATUS)"
exit 1
