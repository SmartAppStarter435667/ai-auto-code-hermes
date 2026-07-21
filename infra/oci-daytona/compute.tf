// infra/oci-daytona/compute.tf

data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_volume" "daytona_data" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "hermes-daytona-data"
  size_in_gbs         = var.data_volume_size_gbs
}

resource "oci_core_instance" "daytona_host" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "hermes-daytona-host"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public_subnet.id
    assign_public_ip = true
    display_name     = "hermes-daytona-vnic"
    hostname_label   = "daytona"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_gbs
  }

  metadata = {
    # FIX: was `var.ssh_public_key` directly. OCI's LaunchInstance API is
    # strict about ssh_authorized_keys format — a single line, no leading/
    # trailing whitespace or embedded newlines. trimspace() only handles
    # leading/trailing whitespace (including a trailing newline from a
    # `cat file.pub` copy-paste, the single most common cause). It can't
    # fix a key that got wrapped across multiple actual newlines when it
    # was copied into the GitHub secret — if this still 400s after
    # redeploying, re-copy the key with:
    #   cat ~/.ssh/id_ed25519.pub | tr -d '\n' | pbcopy   (or xclip on Linux)
    # to guarantee no embedded line breaks before pasting into the secret.
    ssh_authorized_keys = trimspace(var.ssh_public_key)
    user_data = base64encode(templatefile("${path.module}/templates/cloud-init.yaml.tpl", {
      daytona_domain   = var.daytona_domain
      github_repo_url  = var.github_repo_url
      daytona_git_ref  = var.daytona_git_ref
      data_volume_path = "/dev/oracleoci/oraclevdb"
    }))
  }

  preserve_boot_volume = false

  lifecycle {
    ignore_changes = [
      metadata["user_data"],
    ]
  }
}

resource "oci_core_volume_attachment" "daytona_data_attach" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.daytona_host.id
  volume_id       = oci_core_volume.daytona_data.id
  display_name    = "hermes-daytona-data-attach"
}
