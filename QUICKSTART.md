# Quick Start Guide

Get AWS Organizations required tags **monitoring** running safely in under 5 minutes.

## ⚠️ IMPORTANT: Safety First!

This tool has **TWO MODES**:

- 🟢 **Detective (Monitor-Only)** - Reports violations, does NOT block (SAFE - default)
- 🔴 **Preventive (Enforcement)** - BLOCKS non-compliant operations (DANGEROUS)

**Always start with detective mode!** See [SAFETY.md](SAFETY.md) for the full rollout guide.

---

## Prerequisites Check

Before you begin, ensure you have:

- [ ] AWS CLI installed and configured
- [ ] Access to AWS Organizations management (root) account
- [ ] Pulumi CLI installed (`pulumi version`)
- [ ] Node.js 14+ installed (`node --version`)
- [ ] **Read [SAFETY.md](SAFETY.md)** for deployment safety

## 3-Step Setup (Detective Mode)

### 1. Enable Tag Policies in AWS Organizations

First, find your organization root ID:

```bash
aws organizations list-roots
```

Then enable tag policies (replace `r-xxxx` with your root ID):

```bash
aws organizations enable-policy-type \
  --root-id r-xxxx \
  --policy-type TAG_POLICY
```

### 2. Configure Your Required Tags

Edit `infra/Pulumi.prod.yaml`:

```yaml
config:
  aws:region: us-east-1
  # CRITICAL: Start in detective mode (monitor-only)
  aws-org-required-tags:enforcementMode: detective
  aws-org-required-tags:requiredTags:
    Environment:
      - Development
      - Staging
      - Production
    Owner: []       # Any value allowed
    CostCenter: []  # Any value allowed
    Project: []
```

**Tag Rules:**
- **Restricted values**: `["Dev", "Prod"]` - Only these values allowed
- **Any value**: `[]` - Any value allowed, but tag must exist

**Enforcement Modes:**
- `detective` - Monitor-only, reports violations, does NOT block ✅ SAFE
- `preventive` - BLOCKS non-compliant operations ⚠️ DANGEROUS

### 3. Deploy (Detective Mode)

```bash
cd infra
npm install
pulumi up
```

✅ **Done!** Tag policy is now **monitoring** (not blocking) all AWS resources.

---

## 4. Check for Violations

After deployment, check what resources are non-compliant:

```bash
# View in AWS Console
# Go to: AWS Organizations → Policies → Tag policies → Compliance tab

# Or use AWS CLI
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id <account-id>

# Find non-compliant resources with AWS Config
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT \
  --output table
```

---

## 5. Tag Non-Compliant Resources

Before enabling enforcement, tag all existing resources:

```bash
# Find untagged EC2 instances
aws resourcegroupstaggingapi get-resources \
  --resource-type-filters ec2:instance

# Tag a resource
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list arn:aws:ec2:us-east-1:123456789012:instance/i-xxxxx \
  --tags Environment=Production,Owner=john@example.com,CostCenter=Engineering,Project=MyApp
```

---

## 6. Enable Enforcement (Optional - After Confirming Compliance)

⚠️ **WARNING**: Only do this after:
- Running in detective mode for 1-2 weeks
- Confirming 100% compliance
- Updating all automation/pipelines

```yaml
# Pulumi.prod.yaml
aws-org-required-tags:enforcementMode: preventive
```

```bash
pulumi up
```

**Emergency rollback if issues occur:**
```bash
pulumi config set aws-org-required-tags:enforcementMode detective
pulumi up -y
```

## How It Works

The solution uses AWS's `*@@all_supported*` wildcard, which:

- ✅ Automatically enforces tags on **100+ resource types**
- ✅ Covers **all AWS services** that support tag policies
- ✅ Auto-updates when AWS adds support for new resource types
- ✅ Requires **zero maintenance**

## What's Covered

The `*@@all_supported*` wildcard automatically includes:

### Compute & Containers
- EC2 instances, volumes, VPCs, security groups, etc.
- Lambda functions
- ECS clusters, services, tasks
- EKS clusters
- Elastic Beanstalk apps and environments

### Storage
- S3 buckets
- EBS volumes and snapshots
- EFS file systems
- FSx file systems

### Database
- RDS instances and clusters
- DynamoDB tables
- ElastiCache clusters
- Redshift clusters

### Networking
- VPCs, subnets, route tables
- CloudFront distributions
- Route53 hosted zones
- API Gateway REST APIs
- Load balancers and target groups

### Security & Identity
- IAM roles, users, policies
- KMS keys
- Secrets Manager secrets

### Analytics & Integration
- Athena workgroups
- Glue jobs and crawlers
- Kinesis streams
- SNS topics
- SQS queues
- Step Functions state machines

**...and 40+ more AWS services!**

See the [full list in AWS documentation](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_supported-resources-enforcement.html)

## Testing the Policy

### This will FAIL (missing required tags):
```bash
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t2.micro
```

### This will SUCCEED (has required tags):
```bash
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t2.micro \
  --tag-specifications 'ResourceType=instance,Tags=[
    {Key=Environment,Value=Production},
    {Key=Owner,Value=john@example.com},
    {Key=CostCenter,Value=Engineering},
    {Key=Project,Value=MyProject}
  ]'
```

## Verify Deployment

```bash
# View the policy
pulumi stack output policyContent

# Get policy ID
pulumi stack output policyId

# Check in AWS
aws organizations describe-policy --policy-id $(pulumi stack output policyId)

# List all tag policies
aws organizations list-policies --filter TAG_POLICY
```

## Common Tasks

### Update Required Tags

1. Edit `infra/Pulumi.prod.yaml`
2. Run `pulumi up`
3. Changes apply immediately

### Add a New Required Tag

```yaml
config:
  aws-org-required-tags:requiredTags:
    Environment: ["Dev", "Prod"]
    Owner: []
    NewTag: []  # Add this line
```

### Change Allowed Values

```yaml
config:
  aws-org-required-tags:requiredTags:
    Environment:
      - Development
      - Staging
      - Production
      - DR  # Add new allowed value
```

### Attach to Specific OU Instead of Root

Edit `infra/index.ts`:

```typescript
const policyAttachment = new aws.organizations.PolicyAttachment("required-tags-attachment", {
  policyId: tagPolicy.id,
  targetId: "ou-xxxx-yyyyyyyy", // Your OU ID instead of root
});
```

## Finding Non-Compliant Resources

Existing resources aren't automatically tagged. To find them:

```bash
# Using AWS Config
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT

# Using Resource Groups Tagging API
aws resourcegroupstaggingapi get-resources \
  --resource-type-filters ec2:instance \
  --tag-filters Key=Environment
```

## Tag Existing Resources

```bash
# Tag a single resource
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0 \
  --tags Environment=Production,Owner=john@example.com,CostCenter=Engineering,Project=MyApp

# Batch tag multiple resources
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list \
    arn:aws:ec2:us-east-1:123456789012:instance/i-1111111111111111 \
    arn:aws:ec2:us-east-1:123456789012:instance/i-2222222222222222 \
  --tags Environment=Production,Owner=team@example.com
```

## Troubleshooting

### "Policy not found" or "Access Denied"
- ✅ Confirm you're in the **management (root) account**
- ✅ Verify tag policies are enabled: `aws organizations describe-organization`
- ✅ Check IAM permissions include `organizations:*`

### Policy not enforcing
- ✅ Confirm policy is attached: `aws organizations list-policies-for-target --target-id r-xxxx --filter TAG_POLICY`
- ✅ Check you're creating resources in an account under the organization
- ✅ Wait a few minutes for policy propagation

### Pulumi errors
```bash
# Reinstall dependencies
cd infra
rm -rf node_modules
npm install

# Verify config
pulumi config

# Check AWS credentials
aws sts get-caller-identity
```

## Understanding the Policy

The generated policy uses this structure:

```json
{
  "tags": {
    "TagName": {
      "tag_key": {
        "@@assign": "TagName"
      },
      "tag_value": {
        "@@assign": ["AllowedValue1", "AllowedValue2"]
      },
      "enforced_for": {
        "@@assign": ["*@@all_supported*"]
      }
    }
  }
}
```

The `*@@all_supported*` wildcard means:
- Applies to **all resource types** that AWS supports for tag policies
- **Automatically updates** when AWS adds new resource types
- **No maintenance** required to keep up with new AWS services

## Key Benefits of *@@all_supported*

| Traditional Approach | *@@all_supported* Wildcard |
|---------------------|---------------------------|
| List 100+ resource types manually | Single wildcard covers all |
| Update list when AWS adds services | Auto-includes new services |
| Complex, error-prone | Simple, reliable |
| Requires maintenance | Zero maintenance |

## Next Steps

1. **Tag existing resources** using AWS Config or scripts
2. **Set up monitoring** for tag compliance violations
3. **Create different policies per OU** if needed
4. **Document tagging standards** for your team
5. **Automate tagging** in CI/CD pipelines

## Getting Help

- 📖 [Full README](infra/README.md) - Detailed documentation
- 🔗 [AWS Tag Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html)
- 🔗 [Tag Policy Syntax](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_example-tag-policies.html)
- 🔗 [Pulumi AWS Organizations](https://www.pulumi.com/registry/packages/aws/api-docs/organizations/)

## Important Reminders

- ⚠️ Deploy from the **management (root) account** only
- ⚠️ Test in non-production first
- ⚠️ Enforcement blocks operations **immediately**
- ⚠️ Existing resources **are not** automatically tagged
- ✅ The `*@@all_supported*` wildcard handles all resource types automatically
