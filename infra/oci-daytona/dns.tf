# infra/oci-daytona/dns.tf
#
# Optional: automates the two DNS records Daytona's setup wizard needs.
# Disabled by default (manage_cloudflare_dns = false) since the wizard
# itself can print and let you add these manually. Enable once you're
# comfortable handing this Terraform config a scoped Cloudflare token.

resource "cloudflare_record" "daytona_root" {
  count   = var.manage_cloudflare_dns ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.daytona_domain
  content = oci_core_instance.daytona_host.public_ip
  type    = "A"
  ttl     = 300
  proxied = false # must be DNS-only — Caddy needs to see the real client IP for ACME
}

resource "cloudflare_record" "daytona_wildcard_proxy" {
  count   = var.manage_cloudflare_dns ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "*.proxy.${var.daytona_domain}"
  content = oci_core_instance.daytona_host.public_ip
  type    = "A"
  ttl     = 300
  proxied = false # required: proxied wildcard breaks the DNS-01 challenge + preview routing
}
