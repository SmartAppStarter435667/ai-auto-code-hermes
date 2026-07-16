# infra/oci-daytona/outputs.tf

output "public_ip" {
  description = "Public IP of the Daytona host — point your DNS A records here"
  value       = oci_core_instance.daytona_host.public_ip
}

output "ssh_command" {
  description = "Quick SSH command to reach the host"
  value       = "ssh ubuntu@${oci_core_instance.daytona_host.public_ip}"
}

output "daytona_dashboard_url" {
  description = "Where the Daytona dashboard will be reachable once the setup wizard completes"
  value       = "https://${var.daytona_domain}"
}

output "daytona_server_url_for_hermes" {
  description = "Value to set as DAYTONA_SERVER_URL in Hermes' ai-service and preview-service secrets"
  value       = "https://${var.daytona_domain}"
}

output "next_step" {
  description = "What to do after `terraform apply` finishes"
  value       = "SSH in and run: cat /opt/daytona/README-DEPLOY.md"
}
