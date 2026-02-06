# Safety Checklist & Rollout Guide

## ⚠️ CRITICAL: Read Before Deploying to Production

Applying tag policies to your AWS Organization root can **immediately break all resource creation** across all accounts if done incorrectly. Follow this guide to deploy safely.

---

## Two Enforcement Modes

### 🟢 Detective Mode (SAFE - Default)

```yaml
aws-org-required-tags:enforcementMode: detective
```

**What it does:**
- ✅ Reports tag policy violations
- ✅ Does NOT block any operations
- ✅ Safe to deploy to production
- ✅ Allows you to assess impact

**How to check violations:**
```bash
# In AWS Console
AWS Organizations → Policies → Tag policies → Compliance

# Via CLI
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id <account-id>

# Find non-compliant resources
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT
```

---

### 🔴 Preventive Mode (BLOCKS OPERATIONS)

```yaml
aws-org-required-tags:enforcementMode: preventive
```

**What it does:**
- ❌ BLOCKS all non-compliant resource operations
- ❌ Can break existing automation
- ❌ Can break CI/CD pipelines
- ❌ Can break IaC deployments (Terraform, CloudFormation, etc.)

**Use only after:**
- ✅ Running in detective mode for 1-2 weeks
- ✅ Confirming 100% compliance
- ✅ Updating all automation/pipelines
- ✅ Getting team approval

---

## Safe Rollout Process

### Week 1: Detective Mode Deployment

**Step 1: Deploy to Test OU First**

Instead of the root, test on a non-production OU:

```typescript
// In index.ts, change targetId from root to OU
const policyAttachment = new aws.organizations.PolicyAttachment("required-tags-attachment", {
  policyId: tagPolicy.id,
  targetId: "ou-xxxx-yyyyyyyy", // Test OU instead of root
});
```

**Step 2: Deploy**
```bash
cd infra
pulumi up
```

**Step 3: Monitor for 1 week**
- Check compliance reports daily
- Document violations
- Identify affected teams/projects

---

### Week 2: Remediation

**Step 1: Find Non-Compliant Resources**

```bash
# List all untagged EC2 instances
aws resourcegroupstaggingapi get-resources \
  --resource-type-filters ec2:instance \
  --resources-per-page 100

# List all untagged S3 buckets
aws resourcegroupstaggingapi get-resources \
  --resource-type-filters s3:bucket
```

**Step 2: Tag Existing Resources**

```bash
# Single resource
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0 \
  --tags Environment=Production,Owner=team@example.com,CostCenter=Engineering,Project=MyApp

# Bulk tagging (create a script)
for arn in $(cat resource-arns.txt); do
  aws resourcegroupstaggingapi tag-resources \
    --resource-arn-list "$arn" \
    --tags Environment=Production,Owner=ops@example.com
done
```

**Step 3: Update IaC Templates**

Update all Terraform, CloudFormation, Pulumi templates to include required tags:

```hcl
# Terraform
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Environment = "Production"
    Owner       = "team@example.com"
    CostCenter  = "Engineering"
    Project     = "MyApp"
  }
}
```

**Step 4: Update CI/CD Pipelines**

Ensure all automation includes required tags:
- GitHub Actions workflows
- Jenkins jobs
- GitLab CI/CD
- AWS CDK apps
- Custom scripts

---

### Week 3-4: Validation

**Step 1: Verify 100% Compliance**

```bash
# Check compliance status
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id <account-id> \
  | jq '.PolicyContent | fromjson'

# Should show no violations in AWS Config
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByResources[].ResourceType' \
  --output table
```

**Step 2: Test with Detective Mode**

Create a test resource **without** tags and verify it's reported but not blocked:

```bash
# This should SUCCEED in detective mode (but be reported)
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t2.micro

# Check if it's reported as non-compliant
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id <account-id>
```

---

### Week 4+: Enable Enforcement (Optional)

**Step 1: Team Communication**

- ✅ Notify all teams 1 week in advance
- ✅ Share documentation on required tags
- ✅ Provide tagging examples
- ✅ Set up support channel for questions

**Step 2: Switch to Preventive Mode**

```yaml
# Pulumi.prod.yaml
config:
  aws-org-required-tags:enforcementMode: preventive
```

**Step 3: Deploy**

```bash
pulumi up
```

**Step 4: Monitor Closely**

- Watch for broken deployments
- Be ready to switch back to detective mode
- Have rollback plan ready

**Emergency Rollback:**
```yaml
# Switch back immediately if issues occur
aws-org-required-tags:enforcementMode: detective
```
```bash
pulumi up -y
```

---

## Pre-Deployment Checklist

Before deploying to production root:

- [ ] Deployed to test OU successfully
- [ ] Ran in detective mode for at least 1-2 weeks
- [ ] All non-compliant resources identified
- [ ] All resources have been tagged
- [ ] All IaC templates updated
- [ ] All CI/CD pipelines updated
- [ ] Team trained on required tags
- [ ] Documentation created
- [ ] Support process established
- [ ] Rollback plan ready

---

## Common Issues & Solutions

### Issue: CI/CD Pipeline Failing

**Symptom:** Terraform/CloudFormation deployments fail after enabling preventive mode

**Solution:**
1. Switch back to detective mode immediately
2. Update IaC templates to include required tags
3. Test in detective mode
4. Re-enable preventive mode

### Issue: Automated Scaling Breaking

**Symptom:** Auto-scaling groups can't launch instances

**Solution:**
1. Update launch templates/configurations with required tags
2. Ensure tags are propagated to instances:
```hcl
tag_specifications {
  resource_type = "instance"
  tags = {
    Environment = "Production"
    Owner       = "autoscaling@example.com"
  }
}
```

### Issue: Too Many Violations

**Symptom:** Thousands of non-compliant resources

**Solution:**
1. Stay in detective mode
2. Prioritize by resource type (start with new resources)
3. Use bulk tagging scripts
4. Consider phased rollout by OU instead of root

---

## Monitoring Compliance

### AWS Console

1. Go to **AWS Organizations**
2. Click **Policies** → **Tag policies**
3. Click your policy
4. View **Compliance** tab

### AWS CLI

```bash
# Get effective policy for an account
aws organizations describe-effective-policy \
  --policy-type TAG_POLICY \
  --target-id 123456789012

# List all non-compliant resources
aws configservice describe-compliance-by-resource \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByResources[].{Type:ResourceType,Id:ResourceId}' \
  --output table

# Get compliance summary
aws configservice get-compliance-summary-by-resource-type
```

### AWS Config Rules

Set up automated compliance checks:
```bash
aws configservice put-config-rule \
  --config-rule file://required-tags-config-rule.json
```

---

## Emergency Procedures

### If Enforcement Breaks Production

**Immediate Action (< 5 minutes):**

```bash
# 1. Switch to detective mode
cd infra
pulumi config set aws-org-required-tags:enforcementMode detective

# 2. Deploy immediately
pulumi up -y

# 3. Verify policy updated
aws organizations describe-policy --policy-id $(pulumi stack output policyId)
```

**Follow-up Actions:**
1. Investigate what broke
2. Fix the root cause
3. Test in detective mode
4. Only re-enable preventive after confirming fix

---

## Best Practices

1. **Always start with detective mode** - Never go straight to preventive
2. **Test on OU first** - Don't start with the organization root
3. **Monitor for weeks** - Give teams time to adapt
4. **Communicate clearly** - Give advance notice before enforcement
5. **Document everything** - Required tags, values, and processes
6. **Have a rollback plan** - Know how to switch back quickly
7. **Use exemptions sparingly** - Consider OU-level policies for exceptions

---

## Additional Resources

- [AWS Tag Policies Documentation](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html)
- [Tag Policy Examples](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_example-tag-policies.html)
- [AWS Config for Compliance](https://docs.aws.amazon.com/config/latest/developerguide/required-tags.html)
- [Resource Groups Tagging API](https://docs.aws.amazon.com/resourcegroupstagging/latest/APIReference/Welcome.html)
