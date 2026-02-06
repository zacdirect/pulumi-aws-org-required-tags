import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Get the Pulumi configuration
const config = new pulumi.Config();

// Define the required tags you want to enforce
// You can override these in your Pulumi stack configuration
const requiredTags = config.getObject<Record<string, string[]>>("requiredTags") || {
  "Environment": ["Development", "Staging", "Production"],
  "Owner": [],  // Empty array means any value is acceptable
  "CostCenter": [],
  "Project": [],
};

/**
 * Enforcement mode for tag policies
 *
 * - "detective": Monitor-only mode. Reports violations but DOES NOT BLOCK operations.
 *                Use this first to assess impact! Uses "*@@report_required_tag_for*"
 *
 * - "preventive": Enforcement mode. BLOCKS non-compliant operations.
 *                 Only use after confirming detective mode results! Uses "enforced_for"
 *
 * IMPORTANT: Start with "detective" mode to avoid breaking existing automation!
 */
const enforcementMode = config.get("enforcementMode") || "detective";

/**
 * AWS services that support tag policies
 * Use service:ALL_SUPPORTED to enforce tags on all resource types for each service
 *
 * Reference: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_supported-resources-enforcement.html
 */
const SUPPORTED_SERVICES = [
  "access-analyzer",
  "apigateway",
  "appmesh",
  "appstream",
  "athena",
  "cloudformation",
  "cloudfront",
  "cloudtrail",
  "cloudwatch",
  "codebuild",
  "codecommit",
  "codepipeline",
  "config",
  "dynamodb",
  "ec2",
  "ecr",
  "ecs",
  "elasticfilesystem",
  "eks",
  "elasticbeanstalk",
  "elasticache",
  "elasticloadbalancing",
  "es",
  "events",
  "fsx",
  "glue",
  "iam",
  "kinesis",
  "kms",
  "lambda",
  "logs",
  "rds",
  "redshift",
  "route53",
  "s3",
  "sagemaker",
  "secretsmanager",
  "sns",
  "sqs",
  "states",
  "ssm",
  "waf",
  "wafv2",
  "workspaces",
];

/**
 * Build the tag policy content using AWS Organizations syntax
 *
 * Uses service:ALL_SUPPORTED for each AWS service to enforce/report tags on all supported
 * resource types within that service.
 *
 * Reference: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_example-tag-policies.html
 */
const enforcedForKey = enforcementMode === "detective"
  ? "*@@report_required_tag_for*"  // Monitor only - reports violations
  : "enforced_for";                 // Enforcement - blocks operations

const tagPolicyContent = {
  tags: Object.entries(requiredTags).reduce((acc, [tagKey, allowedValues]) => {
    acc[tagKey] = {
      tag_key: {
        "@@assign": tagKey,
      },
      // If allowedValues is empty, any value is allowed (but the tag is still required)
      // If allowedValues has items, only those specific values are allowed
      ...(allowedValues.length > 0 && {
        tag_value: {
          "@@assign": allowedValues,
        },
      }),
      [enforcedForKey]: {
        // Use service:ALL_SUPPORTED for each service
        "@@assign": SUPPORTED_SERVICES.map(service => `${service}:ALL_SUPPORTED`),
      },
    };
    return acc;
  }, {} as Record<string, any>),
};

// Create the tag policy
const tagPolicy = new aws.organizations.Policy("required-tags-policy", {
  name: "required-tags-policy",
  description: `Tag policy (${enforcementMode} mode) for required tags across ${SUPPORTED_SERVICES.length} AWS services`,
  type: "TAG_POLICY",
  content: JSON.stringify(tagPolicyContent, null, 2),
});

// Get the AWS Organization root
const org = aws.organizations.getOrganizationOutput();

// Attach the tag policy to the organization root
// This applies the policy to all accounts in the organization
const policyAttachment = new aws.organizations.PolicyAttachment("required-tags-attachment", {
  policyId: tagPolicy.id,
  targetId: org.roots[0].id,
});

// Export useful information
export const policyId = tagPolicy.id;
export const policyName = tagPolicy.name;
export const policyArn = tagPolicy.arn;
export const supportedServiceCount = SUPPORTED_SERVICES.length;
export const requiredTagKeys = Object.keys(requiredTags);
export const mode = enforcementMode;
