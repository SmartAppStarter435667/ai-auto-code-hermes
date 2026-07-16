# infra/oci-daytona/network.tf

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

resource "oci_core_vcn" "daytona_vcn" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.20.0.0/16"
  display_name   = "hermes-daytona-vcn"
  dns_label      = "hermesdaytona"
}

resource "oci_core_internet_gateway" "igw" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.daytona_vcn.id
  display_name   = "hermes-daytona-igw"
  enabled        = true
}

resource "oci_core_route_table" "public_rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.daytona_vcn.id
  display_name   = "hermes-daytona-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.igw.id
  }
}

# ── Security list ────────────────────────────────────────────────────────
# Ports per Daytona's official oss-deployment docs:
#   22    SSH (admin access)
#   80    HTTP  → Caddy (redirects to 443, serves ACME HTTP-01 fallback)
#   443   HTTPS → Caddy (API, dashboard, wildcard sandbox proxy, Dex OIDC)
#   2222  SSH Gateway (git operations into sandboxes) — TCP, bypasses Caddy
resource "oci_core_security_list" "daytona_sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.daytona_vcn.id
  display_name   = "hermes-daytona-sl"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = var.ssh_admin_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 2222
      max = 2222
    }
  }

  # ICMP for path MTU discovery / diagnostics
  ingress_security_rules {
    protocol = "1"
    source   = "0.0.0.0/0"
    icmp_options {
      type = 3
      code = 4
    }
  }
}

resource "oci_core_subnet" "public_subnet" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.daytona_vcn.id
  cidr_block                 = "10.20.1.0/24"
  display_name               = "hermes-daytona-public-subnet"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public_rt.id
  security_list_ids          = [oci_core_security_list.daytona_sl.id]
  prohibit_public_ip_on_vnic = false
}
