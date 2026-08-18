terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------------------------
# Cross-stack references - looked up by the shared naming convention that
# ../gtfs-realtime/deployment uses to create these, NOT by reading that
# stack's state file. This stack has no filesystem/state dependency on that
# repo at all, only a naming one (var.app_name must match).
# ------------------------------------------------------------------------------
data "aws_ecs_cluster" "main" {
  cluster_name = "${var.app_name}-cluster"
}

data "aws_iam_role" "execution" {
  name = "${var.app_name}-execution-role"
}

data "aws_secretsmanager_secret" "database_url" {
  name = "${var.app_name}/database-url"
}

data "aws_secretsmanager_secret" "app_secret_key" {
  name = "${var.app_name}/app-secret-key"
}

# Provisioned by hand via the Secrets Manager console, not by Terraform in
# either stack - looked up by name rather than hardcoded, so this doesn't
# depend on knowing the random suffix Secrets Manager appends to the ARN.
data "aws_secretsmanager_secret" "tls_cert" {
  name = "${var.app_name}/tls-cert"
}

data "aws_secretsmanager_secret" "tls_key" {
  name = "${var.app_name}/tls-key"
}

locals {
  container_port = 8000

  # The dashboard (nginx + static build) built from this repo's Dockerfile,
  # at the git tag named by var.frontend_image_tag.
  frontend_image = "${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}"

  frontend_secrets = [
    { name = "DATABASE_URL", valueFrom = data.aws_secretsmanager_secret.database_url.arn },
    { name = "SECRET_KEY", valueFrom = data.aws_secretsmanager_secret.app_secret_key.arn },
    { name = "TLS_CERT", valueFrom = data.aws_secretsmanager_secret.tls_cert.arn },
    { name = "TLS_KEY", valueFrom = data.aws_secretsmanager_secret.tls_key.arn },
  ]
}

# ------------------------------------------------------------------------------
# ECR
# ------------------------------------------------------------------------------
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.app_name}-frontend"
  image_tag_mutability = "MUTABLE"
}

# ------------------------------------------------------------------------------
# Task Definition + Service - EC2 launch type, host networking (shares the
# ../gtfs-realtime EC2 instance's network stack, so it can reach the backend
# via localhost - see that repo's main.tf for the instance itself).
# ------------------------------------------------------------------------------
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.app_name}-frontend"
  network_mode             = "host"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = data.aws_iam_role.execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name              = "frontend"
      image             = local.frontend_image
      essential         = true
      cpu               = 128
      memoryReservation = 128
      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        },
        {
          containerPort = 443
          hostPort      = 443
          protocol      = "tcp"
        }
      ]
      # nginx.conf's envsubst template proxies /api/ to this at container start.
      # Literal IP, not "localhost": nginx's resolver-based DNS lookup for the
      # dynamic proxy_pass needs Docker's embedded DNS (127.0.0.11), which only
      # exists in bridge-mode containers - not present under host networking.
      environment = [{ name = "BACKEND_URL", value = "http://127.0.0.1:${local.container_port}" }]
      # TLS_CERT/TLS_KEY land as env vars; the image's own entrypoint script
      # (see this repo's Dockerfile) writes them to files and enables the 443
      # listener only when both are present, so this same image still works
      # unmodified for local HTTP-only dev.
      secrets = local.frontend_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.app_name}"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.app_name}-frontend"
  cluster         = data.aws_ecs_cluster.main.arn
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "EC2"

  force_new_deployment               = true
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
}
