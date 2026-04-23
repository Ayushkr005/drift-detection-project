terraform {
  backend "s3" {
    bucket         = "drift-state-ayush-12345"
    key            = "drift/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-lock"
  }
}