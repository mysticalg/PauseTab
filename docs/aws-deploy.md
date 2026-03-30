# AWS Deployment Notes

## Target shape

- `backend/` deployed as an AWS App Runner service
- `website/` deployed as a second AWS App Runner service
- backend data stored in S3 via `PAUSETAB_STORE_S3_BUCKET`
- extension package rebuilt against the deployed backend and website URLs

## Command

```bash
npm run deploy:aws
```

The deploy script reads:

- `backend/.env` for Stripe keys, price IDs, webhook secret, and token pepper
- `website/.env` or `PAUSETAB_SUPPORT_EMAIL` for the public support email

It writes deployment metadata to `tmp/aws-deploy-output.json`.

## Required IAM permissions

- `apprunner:ListServices`
- `apprunner:CreateService`
- `apprunner:UpdateService`
- `apprunner:DescribeService`
- `apprunner:ListAutoScalingConfigurations`
- `apprunner:CreateAutoScalingConfiguration`
- `ecr:DescribeRepositories`
- `ecr:CreateRepository`
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:PutImage`
- `s3:CreateBucket`
- `s3:PutBucketVersioning`
- `s3:PutBucketEncryption`
- `s3:GetObject`
- `s3:PutObject`
- `iam:GetRole`
- `iam:CreateRole`
- `iam:AttachRolePolicy`
- `iam:PutRolePolicy`
- `iam:PassRole`

## Launch caveats

- If `backend/.env` still uses `sk_test_...`, the deployed environment will use Stripe test mode.
- Replace the local Stripe listener secret with a real Stripe Dashboard webhook secret before going live.
- Set a real support email before publishing the website or extension listing.
