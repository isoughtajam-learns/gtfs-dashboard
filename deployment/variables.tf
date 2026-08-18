variable "aws_region" {
  type        = string
  default     = "us-east-2"
  description = "AWS Region to deploy resources - must match ../gtfs-realtime/deployment's var.aws_region."
}

variable "app_name" {
  type        = string
  default     = "gtfs-realtime"
  description = "Shared app name prefix. Must match ../gtfs-realtime/deployment's var.app_name - this stack looks up that stack's ECS cluster, execution role, and secrets by the names it derives from this, not by reading that stack's state file."
}

variable "frontend_image_tag" {
  type        = string
  description = "Git tag (e.g. v0.1.0) of this repo to deploy. Must be a tag reachable from origin/main - deploy.sh enforces this and pushes the matching image before applying."
}

variable "frontend_desired_count" {
  type        = number
  default     = 1
  description = "Number of frontend (nginx + dashboard) tasks to run"
}
