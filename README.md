# AWS Organizations Required Tags with Pulumi

This Pulumi TypeScript program automatically enforces required tags across **all** AWS resource types that support tag policies in your organization using the `*@@all_supported*` wildcard.

## Features

- 🎯 **Universal Coverage**: Uses AWS's `*@@all_supported*` wildcard to automatically cover all supported resource types
- 🔄 **Automatic Updates**: New AWS resource types are automatically included as AWS adds tag policy support
- ⚙️ **Configurable**: Define required tags and allowed values via Pulumi config
- 🏢 **Organization-Wide**: Applies to all accounts in your AWS Organization
- 📝 **Simple**: No need to maintain lists of resource types - AWS handles it automatically

## Prerequisites

1. **AWS Organizations Access**: You must deploy this from the management account (root account) of your AWS Organization
2. **Tag Policies Enabled**: Enable tag policies in AWS Organizations:
   ```bash
   aws organizations enable-policy-type \
     --root-id r-xxxx \
     --policy-type TAG_POLICY
   ```
3. **IAM Permissions**: Ensure you have permissions to:
   - Create and manage AWS Organizations policies
   - Attach policies to organizational units

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Required Tags

Edit `Pulumi.prod.yaml` (or create a new stack config):

```yaml
config:
  aws:region: us-east-1
  # IMPORTANT: Start with "detective" mode!
  aws-org-required-tags:enforcementMode: detective
  aws-org-required-tags:requiredTags:
    Environment:
      - Development
      - Staging
      - Production
    Owner: []        # Empty array means any value is allowed
    CostCenter: []   # Any value is allowed, but tag is required
    Project: []
    Application: []
```

**Tag Configuration:**
- **With allowed values**: `["Value1", "Value2"]` - Only these values are permitted
- **Without restrictions**: `[]` - Any value is allowed, but the tag must be present

**Enforcement Modes:**
- **`detective`** (RECOMMENDED): Monitor-only mode. Reports violations but does NOT block operations
- **`preventive`**: Enforcement mode. BLOCKS non-compliant operations

⚠️ **IMPORTANT**: Always start with `detective` mode to assess impact before enforcing!

### 3. Deploy in Detective Mode

```bash
# Preview changes
pulumi preview

# Deploy to AWS (monitor-only mode)
pulumi up
```

### 4. Review Compliance Reports

After deploying in detective mode, check for violations:

```bash
# View compliance in AWS Console
# Go to: AWS Organizations → Policies → Tag policies → View compliance

# Or use AWS CLI
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id <account-id>

# Use AWS Config to find non-compliant resources
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT
```

### 5. Fix Non-Compliant Resources

Tag existing resources before enabling enforcement:

```bash
# Find untagged resources
aws resourcegroupstaggingapi get-resources \
  --resource-type-filters ec2:instance

# Tag resources
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list <resource-arn> \
  --tags Environment=Production,Owner=john@example.com
```

### 6. Enable Enforcement (Optional)

Once all resources are compliant, switch to preventive mode:

```yaml
config:
  aws-org-required-tags:enforcementMode: preventive  # Now blocks non-compliant ops
```

Then deploy:
```bash
pulumi up
```

## Enforcement Modes Explained

AWS Organizations tag policies support two enforcement modes:

### Detective Mode (Monitor-Only) ✅ SAFE

- **Field**: `*@@report_required_tag_for*`
- **Behavior**: Reports violations but does NOT block operations
- **Use case**: Initial deployment, compliance assessment
- **Safety**: ✅ Safe to deploy to production
- **View reports**: AWS Organizations console, AWS Config, or API

```yaml
aws-org-required-tags:enforcementMode: detective
```

### Preventive Mode (Enforcement) ⚠️ BLOCKS OPERATIONS

- **Field**: `enforced_for`
- **Behavior**: BLOCKS all non-compliant resource operations
- **Use case**: After confirming compliance in detective mode
- **Safety**: ⚠️ Can break existing automation, CI/CD, IaC
- **Impact**: Immediate - affects all accounts

```yaml
aws-org-required-tags:enforcementMode: preventive
```

## Safe Rollout Strategy

### Phase 1: Detective Mode (Week 1-2)

1. Deploy in `detective` mode to root or test OU
2. Monitor compliance reports in AWS Organizations
3. Identify non-compliant resources across all accounts
4. Document which automation/pipelines need updates

### Phase 2: Remediation (Week 2-4)

1. Tag existing resources
2. Update IaC templates (Terraform, CloudFormation, Pulumi)
3. Update CI/CD pipelines to include required tags
4. Update documentation and team processes

### Phase 3: Enforcement (Week 4+)

1. Verify 100% compliance in detective mode
2. Switch to `preventive` mode
3. Monitor for any issues
4. Be ready to switch back to `detective` if needed

## How service:ALL_SUPPORTED Works

Instead of listing every resource type, this solution uses `service:ALL_SUPPORTED`:

- `ec2:ALL_SUPPORTED` - All EC2 resources (instances, volumes, VPCs, etc.)
- `s3:ALL_SUPPORTED` - All S3 resources
- `rds:ALL_SUPPORTED` - All RDS resources
- etc.

This approach:

1. **Automatically includes all resource types** within each service
2. **Stays up-to-date** - New resource types are automatically covered
3. **Simplifies maintenance** - No need to update individual resource types

### Example Policy Structure

The generated policy looks like this:

```json
{
  "tags": {
    "Environment": {
      "tag_key": {
        "@@assign": "Environment"
      },
      "tag_value": {
        "@@assign": ["Development", "Staging", "Production"]
      },
      "enforced_for": {
        "@@assign": ["*@@all_supported*"]
      }
    },
    "Owner": {
      "tag_key": {
        "@@assign": "Owner"
      },
      "enforced_for": {
        "@@assign": ["*@@all_supported*"]
      }
    }
  }
}
```

## Supported AWS Services

The `*@@all_supported*` wildcard automatically covers 100+ resource types across 40+ AWS services, including:

- **Compute**: EC2, Lambda, ECS, EKS, Elastic Beanstalk
- **Storage**: S3, EBS, EFS, FSx
- **Database**: RDS, DynamoDB, ElastiCache, Redshift, Neptune
- **Networking**: VPC, CloudFront, Route53, API Gateway, ELB
- **Security**: IAM, KMS, Secrets Manager, ACM
- **Analytics**: Athena, Glue, Kinesis, EMR
- **And many more...**

For the complete list, see: [AWS Tag Policy Supported Resources](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_supported-resources-enforcement.html)

## Project Structure

```
infra/
├── index.ts                      # Main Pulumi program
├── scripts/
│   └── fetch-supported-resources.ts  # Optional: Generate resource type list for reference
├── generated/                    # Optional: Generated documentation
├── package.json                  # npm scripts and dependencies
└── Pulumi.yaml                   # Pulumi project configuration
```

## NPM Scripts

- `npm run build` - Compile TypeScript
- `npm run preview` - Preview infrastructure changes (alias for `pulumi preview`)
- `npm run deploy` - Deploy the tag policy to AWS (alias for `pulumi up`)
- `npm run refresh-tags` - (Optional) Generate resource type documentation

## Configuration Examples

### Strict Tagging (Allowed Values)

```yaml
config:
  aws-org-required-tags:requiredTags:
    Environment:
      - dev
      - staging
      - prod
    DataClassification:
      - public
      - internal
      - confidential
      - restricted
```

### Flexible Tagging (Any Value)

```yaml
config:
  aws-org-required-tags:requiredTags:
    Owner: []
    CostCenter: []
    Project: []
    ContactEmail: []
```

### Mixed Approach

```yaml
config:
  aws-org-required-tags:requiredTags:
    Environment:           # Strict - only these values
      - Development
      - Staging
      - Production
    Owner: []              # Flexible - any value allowed
    CostCenter: []         # Flexible - any value allowed
    Compliance:            # Strict - compliance categories
      - HIPAA
      - PCI-DSS
      - SOC2
      - None
```

## Outputs

After deployment, the following outputs are available:

- `policyId` - The ID of the created tag policy
- `policyArn` - The ARN of the tag policy
- `requiredTagKeys` - List of required tag keys
- `policyContent` - Full JSON content of the policy

View outputs:
```bash
pulumi stack output
pulumi stack output policyContent --show-secrets
```

## Example: Viewing Policy

```bash
# View the policy in AWS CLI
aws organizations describe-policy --policy-id $(pulumi stack output policyId)

# List all policies
aws organizations list-policies --filter TAG_POLICY

# View effective tag policy for an account
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id 123456789012
```

## Advanced Configuration

### Attaching to Specific OUs

By default, the policy attaches to the organization root. To attach to specific organizational units instead:

```typescript
// In index.ts, replace the policyAttachment with:
const policyAttachment = new aws.organizations.PolicyAttachment("required-tags-attachment", {
  policyId: tagPolicy.id,
  targetId: "ou-xxxx-yyyyyyyy", // Your OU ID
});
```

### Service-Specific Tags

If you want different tags for different services, you can create multiple policies:

```typescript
// Tag policy for EC2 resources only
const ec2TagPolicy = {
  tags: {
    "AutoShutdown": {
      tag_key: { "@@assign": "AutoShutdown" },
      tag_value: { "@@assign": ["true", "false"] },
      enforced_for: { "@@assign": ["ec2:instance", "ec2:volume"] }
    }
  }
};
```

## Enforcement Modes

AWS Organizations tag policies support two enforcement modes:

1. **Preventive (Default)**: Blocks non-compliant resource operations
2. **Detective**: Allows operations but reports compliance violations

This program uses **preventive enforcement** by default.

## Troubleshooting

### Policy Not Applied
```bash
# Verify tag policies are enabled
aws organizations describe-organization

# Check the policy is attached
aws organizations list-policies-for-target \
  --target-id r-xxxx \
  --filter TAG_POLICY
```

### Resources Not Compliant
- Existing resources are not retroactively tagged
- Use AWS Config to find non-compliant resources:
  ```bash
  aws configservice describe-compliance-by-resource \
    --compliance-types NON_COMPLIANT
  ```
- Tag existing resources:
  ```bash
  aws resourcegroupstaggingapi tag-resources \
    --resource-arn-list arn:aws:ec2:region:account:instance/i-xxxxx \
    --tags Environment=Production,Owner=john@example.com
  ```

### Testing Tag Enforcement

Try creating a resource without required tags (should fail):
```bash
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t2.micro
```

Create with required tags (should succeed):
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

## Updating Tags

To modify required tags:

1. Edit `Pulumi.prod.yaml`
2. Run `pulumi up`
3. Review and confirm changes

The policy updates are applied immediately across all accounts.

## References

- [AWS Organizations Tag Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html)
- [Tag Policy Examples and Syntax](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_example-tag-policies.html)
- [Supported Resources for Tag Enforcement](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_supported-resources-enforcement.html)
- [Pulumi AWS Organizations](https://www.pulumi.com/registry/packages/aws/api-docs/organizations/)

## Why *@@all_supported* is Better

Compared to maintaining a list of specific resource types:

| Approach | Pros | Cons |
|----------|------|------|
| **Specific List** | Explicit, visible resource types | Requires maintenance, can miss new services |
| ***@@all_supported*** | Auto-updates, comprehensive, simple | Less explicit about what's covered |

We chose `*@@all_supported*` because:
- ✅ Zero maintenance required
- ✅ Automatically includes new AWS services
- ✅ Covers all 100+ supported resource types
- ✅ Simpler, more maintainable code

## License

See LICENSE file in the repository root
