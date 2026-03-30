import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const resolveSpawn = (command, args) => {
  if (process.platform === "win32" && (command === "npm" || command === "npx")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }

  return { command, args };
};

const run = (command, args, options = {}) => {
  const resolved = resolveSpawn(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : "pipe",
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout?.trim() ?? "";
};

const runJson = (command, args, options = {}) => {
  const output = run(command, args, options);
  return output ? JSON.parse(output) : {};
};

const writeTempJson = (value) => {
  const filePath = path.join(os.tmpdir(), `pausetab-${randomUUID()}.json`);
  writeFileSync(filePath, JSON.stringify(value, null, 2));
  return filePath;
};

const withTempJson = (value, callback) => {
  const filePath = writeTempJson(value);
  try {
    return callback(filePath);
  } finally {
    rmSync(filePath, { force: true });
  }
};

const readEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
};

const prefixProtocol = (value) => (value.startsWith("http") ? value : `https://${value}`);

const backendEnv = readEnvFile(path.join(rootDir, "backend", ".env"));
const websiteEnv = readEnvFile(path.join(rootDir, "website", ".env"));

const requireBackendValue = (key) => {
  const value = backendEnv[key];
  if (!value) {
    throw new Error(`Missing ${key} in backend/.env`);
  }

  return value;
};

const gitSha = run("git", ["rev-parse", "--short", "HEAD"]);
const region = process.env.AWS_REGION || run("aws", ["configure", "get", "region"]) || "eu-west-2";
const account = runJson("aws", ["sts", "get-caller-identity", "--output", "json"]).Account;
const deployPrefix = (process.env.PAUSETAB_AWS_PREFIX || "pausetab-prod").toLowerCase();
const backendRepoName = `${deployPrefix}-backend`;
const websiteRepoName = `${deployPrefix}-website`;
const backendServiceName = `${deployPrefix}-backend`;
const websiteServiceName = `${deployPrefix}-website`;
const storeBucketName = `${deployPrefix}-store-${account}-${region}`.toLowerCase();
const storeObjectKey = process.env.PAUSETAB_STORE_S3_KEY || "production/store.json";
const supportEmail = process.env.PAUSETAB_SUPPORT_EMAIL || websiteEnv.VITE_PAUSETAB_SUPPORT_EMAIL || "";
const ecrHost = `${account}.dkr.ecr.${region}.amazonaws.com`;
const backendImageUri = `${ecrHost}/${backendRepoName}:${gitSha}`;
const websiteImageUri = `${ecrHost}/${websiteRepoName}:${gitSha}`;
const apprunnerAccessRoleName = "PauseTabAppRunnerEcrAccessRole";
const apprunnerInstanceRoleName = "PauseTabAppRunnerRuntimeRole";
const autoscalingName = "PauseTabSingleInstance";
const outputDir = path.join(rootDir, "tmp");
const outputPath = path.join(outputDir, "aws-deploy-output.json");

const permissionsHint = [
  "apprunner:ListServices",
  "apprunner:CreateService",
  "apprunner:UpdateService",
  "apprunner:DescribeService",
  "apprunner:ListAutoScalingConfigurations",
  "apprunner:CreateAutoScalingConfiguration",
  "ecr:DescribeRepositories",
  "ecr:CreateRepository",
  "ecr:GetAuthorizationToken",
  "ecr:BatchCheckLayerAvailability",
  "ecr:BatchGetImage",
  "ecr:InitiateLayerUpload",
  "ecr:UploadLayerPart",
  "ecr:CompleteLayerUpload",
  "ecr:PutImage",
  "s3:CreateBucket",
  "s3:PutBucketVersioning",
  "s3:PutEncryptionConfiguration",
  "s3:GetObject",
  "s3:PutObject",
  "iam:GetRole",
  "iam:CreateRole",
  "iam:CreateServiceLinkedRole",
  "iam:AttachRolePolicy",
  "iam:PutRolePolicy",
  "iam:PassRole",
];

const permissionChecks = [
  ["aws", ["apprunner", "list-services", "--output", "json"]],
  ["aws", ["ecr", "describe-repositories", "--output", "json"]],
];

const failedChecks = [];
for (const [command, args] of permissionChecks) {
  const result = spawnSync(command, args, { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0) {
    failedChecks.push(result.stderr?.trim() || result.stdout?.trim() || `${command} ${args.join(" ")}`);
  }
}

if (failedChecks.length > 0) {
  throw new Error(
    `AWS deploy prerequisites are missing for the current IAM user.\n\nRequired permissions include:\n- ${permissionsHint.join("\n- ")}\n\nObserved failures:\n- ${failedChecks.join("\n- ")}`,
  );
}

const dockerInfo = spawnSync("docker", ["info"], { cwd: rootDir, encoding: "utf8" });
if (dockerInfo.status !== 0) {
  throw new Error("Docker is installed but the daemon is not running. Start Docker Desktop before running npm run deploy:aws.");
}

if (!backendEnv.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
  console.warn("Warning: backend/.env is not using a live Stripe secret key. The deployed environment would use test billing.");
}

if (!supportEmail) {
  console.warn("Warning: no PAUSETAB_SUPPORT_EMAIL is configured. The website will render a placeholder support prompt.");
}

const ensureS3Bucket = (bucketName) => {
  const head = spawnSync("aws", ["s3api", "head-bucket", "--bucket", bucketName], { cwd: rootDir, encoding: "utf8" });
  if (head.status !== 0) {
    run("aws", [
      "s3api",
      "create-bucket",
      "--bucket",
      bucketName,
      "--region",
      region,
      "--create-bucket-configuration",
      `LocationConstraint=${region}`,
    ]);
  }

  run("aws", ["s3api", "put-bucket-versioning", "--bucket", bucketName, "--versioning-configuration", "Status=Enabled"]);
  withTempJson(
    {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256",
          },
        },
      ],
    },
    (filePath) => run("aws", ["s3api", "put-bucket-encryption", "--bucket", bucketName, "--server-side-encryption-configuration", `file://${filePath}`]),
  );
};

const ensureEcrRepository = (name) => {
  const result = spawnSync("aws", ["ecr", "describe-repositories", "--repository-names", name, "--output", "json"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return JSON.parse(result.stdout).repositories[0];
  }

  return runJson("aws", ["ecr", "create-repository", "--repository-name", name, "--image-scanning-configuration", "scanOnPush=true", "--output", "json"]).repository;
};

const ensureRole = (roleName, assumeRolePolicyDocument) => {
  const getResult = spawnSync("aws", ["iam", "get-role", "--role-name", roleName, "--output", "json"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (getResult.status === 0) {
    return JSON.parse(getResult.stdout).Role.Arn;
  }

  return withTempJson(assumeRolePolicyDocument, (filePath) =>
    runJson("aws", ["iam", "create-role", "--role-name", roleName, "--assume-role-policy-document", `file://${filePath}`, "--output", "json"]).Role.Arn,
  );
};

const attachManagedPolicy = (roleName, policyArn) => {
  run("aws", ["iam", "attach-role-policy", "--role-name", roleName, "--policy-arn", policyArn]);
};

const putInlinePolicy = (roleName, policyName, policyDocument) => {
  withTempJson(policyDocument, (filePath) =>
    run("aws", ["iam", "put-role-policy", "--role-name", roleName, "--policy-name", policyName, "--policy-document", `file://${filePath}`]),
  );
};

const ensureAutoscalingConfigurationArn = () => {
  const response = runJson("aws", ["apprunner", "list-auto-scaling-configurations", "--output", "json"]);
  const existing = (response.AutoScalingConfigurationSummaryList ?? [])
    .filter((item) => item.AutoScalingConfigurationName === autoscalingName)
    .sort((left, right) => Number(right.AutoScalingConfigurationRevision ?? 0) - Number(left.AutoScalingConfigurationRevision ?? 0))[0];

  if (existing?.AutoScalingConfigurationArn) {
    return existing.AutoScalingConfigurationArn;
  }

  return runJson("aws", [
    "apprunner",
    "create-auto-scaling-configuration",
    "--auto-scaling-configuration-name",
    autoscalingName,
    "--max-concurrency",
    "25",
    "--max-size",
    "1",
    "--min-size",
    "1",
    "--output",
    "json",
  ]).AutoScalingConfiguration.AutoScalingConfigurationArn;
};

const dockerLoginToEcr = () => {
  const password = run("aws", ["ecr", "get-login-password", "--region", region]);
  const login = spawnSync("docker", ["login", "--username", "AWS", "--password-stdin", ecrHost], {
    cwd: rootDir,
    encoding: "utf8",
    input: password,
  });

  if (login.status !== 0) {
    throw new Error(login.stderr?.trim() || login.stdout?.trim() || "Docker login to ECR failed.");
  }
};

const buildAndPushImage = ({ dockerfile, imageUri, buildArgs = {} }) => {
  const args = ["build", "-f", dockerfile, "-t", imageUri];
  for (const [key, value] of Object.entries(buildArgs)) {
    args.push("--build-arg", `${key}=${value}`);
  }
  args.push(".");

  run("docker", args, { capture: false });
  run("docker", ["push", imageUri], { capture: false });
};

const listServices = () => runJson("aws", ["apprunner", "list-services", "--output", "json"]).ServiceSummaryList ?? [];

const describeService = (serviceArn) => runJson("aws", ["apprunner", "describe-service", "--service-arn", serviceArn, "--output", "json"]).Service;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServiceReady = async (serviceArn) => {
  const failureStates = new Set(["CREATE_FAILED", "DELETE_FAILED"]);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const service = describeService(serviceArn);
    if (service.Status === "RUNNING") {
      return service;
    }
    if (failureStates.has(service.Status)) {
      throw new Error(`App Runner service failed with status ${service.Status}`);
    }

    await sleep(15000);
  }

  throw new Error(`Timed out waiting for App Runner service ${serviceArn} to become ready.`);
};

const deployService = async ({
  serviceName,
  imageUri,
  accessRoleArn,
  instanceRoleArn,
  port,
  env,
  healthPath,
  autoscalingArn,
}) => {
  const existing = listServices().find((item) => item.ServiceName === serviceName);

  const sourceConfiguration = {
    AutoDeploymentsEnabled: false,
    AuthenticationConfiguration: accessRoleArn ? { AccessRoleArn: accessRoleArn } : undefined,
    ImageRepository: {
      ImageIdentifier: imageUri,
      ImageRepositoryType: "ECR",
      ImageConfiguration: {
        Port: String(port),
        RuntimeEnvironmentVariables: env,
      },
    },
  };

  const basePayload = {
    SourceConfiguration: sourceConfiguration,
    InstanceConfiguration: {
      Cpu: "0.25 vCPU",
      Memory: "0.5 GB",
      ...(instanceRoleArn ? { InstanceRoleArn: instanceRoleArn } : {}),
    },
    HealthCheckConfiguration: {
      Protocol: "HTTP",
      Path: healthPath,
      Interval: 10,
      Timeout: 5,
      HealthyThreshold: 1,
      UnhealthyThreshold: 5,
    },
    AutoScalingConfigurationArn: autoscalingArn,
  };

  const response = existing
    ? withTempJson(
        {
          ...basePayload,
          ServiceArn: existing.ServiceArn,
        },
        (filePath) => runJson("aws", ["apprunner", "update-service", "--cli-input-json", `file://${filePath}`, "--output", "json"]),
      )
    : withTempJson(
        {
          ...basePayload,
          ServiceName: serviceName,
        },
        (filePath) => runJson("aws", ["apprunner", "create-service", "--cli-input-json", `file://${filePath}`, "--output", "json"]),
      );

  return waitForServiceReady(response.Service.ServiceArn);
};

const ensureBackendRuntimeRole = (bucketName) => {
  const roleArn = ensureRole(apprunnerInstanceRoleName, {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "tasks.apprunner.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  });

  putInlinePolicy(apprunnerInstanceRoleName, "PauseTabStoreAccess", {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:ListBucket"],
        Resource: [`arn:aws:s3:::${bucketName}`],
      },
      {
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:PutObject"],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  });

  return roleArn;
};

const ensureEcrAccessRole = () => {
  const roleArn = ensureRole(apprunnerAccessRoleName, {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "build.apprunner.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  });

  attachManagedPolicy(apprunnerAccessRoleName, "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess");
  return roleArn;
};

const buildExtensionArtifact = (backendUrl, websiteUrl) => {
  run("npm", ["run", "package:extension"], {
    capture: false,
    env: {
      ...process.env,
      VITE_PAUSETAB_API_BASE_URL: backendUrl,
      VITE_PAUSETAB_SITE_URL: websiteUrl,
      VITE_PAUSETAB_ENABLE_LOCAL_TRIAL: "false",
    },
  });
};

mkdirSync(outputDir, { recursive: true });

ensureS3Bucket(storeBucketName);
ensureEcrRepository(backendRepoName);
ensureEcrRepository(websiteRepoName);

dockerLoginToEcr();

const accessRoleArn = ensureEcrAccessRole();
const instanceRoleArn = ensureBackendRuntimeRole(storeBucketName);
const autoscalingArn = ensureAutoscalingConfigurationArn();

buildAndPushImage({
  dockerfile: "backend/Dockerfile",
  imageUri: backendImageUri,
});

const placeholderUrl = "https://example.com";
const backendServiceInitial = await deployService({
  serviceName: backendServiceName,
  imageUri: backendImageUri,
  accessRoleArn,
  instanceRoleArn,
  port: 8787,
  env: {
    NODE_ENV: "production",
    PORT: "8787",
    PAUSETAB_PUBLIC_URL: placeholderUrl,
    PAUSETAB_ALLOWED_ORIGINS: placeholderUrl,
    PAUSETAB_ALLOWED_RETURN_ORIGINS: placeholderUrl,
    PAUSETAB_STORE_S3_BUCKET: storeBucketName,
    PAUSETAB_STORE_S3_KEY: storeObjectKey,
    PAUSETAB_TOKEN_PEPPER: requireBackendValue("PAUSETAB_TOKEN_PEPPER"),
    STRIPE_SECRET_KEY: requireBackendValue("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: requireBackendValue("STRIPE_WEBHOOK_SECRET"),
    STRIPE_PRICE_PRO_MONTHLY: requireBackendValue("STRIPE_PRICE_PRO_MONTHLY"),
    STRIPE_PRICE_PRO_ANNUAL: requireBackendValue("STRIPE_PRICE_PRO_ANNUAL"),
    STRIPE_PRICE_LIFETIME: requireBackendValue("STRIPE_PRICE_LIFETIME"),
  },
  healthPath: "/health",
  autoscalingArn,
});

const backendUrl = prefixProtocol(backendServiceInitial.ServiceUrl);

buildAndPushImage({
  dockerfile: "website/Dockerfile",
  imageUri: websiteImageUri,
  buildArgs: {
    VITE_PAUSETAB_API_BASE_URL: backendUrl,
    VITE_PAUSETAB_SUPPORT_EMAIL: supportEmail,
  },
});

const websiteService = await deployService({
  serviceName: websiteServiceName,
  imageUri: websiteImageUri,
  accessRoleArn,
  port: 80,
  env: {},
  healthPath: "/",
  autoscalingArn,
});

const websiteUrl = prefixProtocol(websiteService.ServiceUrl);

await deployService({
  serviceName: backendServiceName,
  imageUri: backendImageUri,
  accessRoleArn,
  instanceRoleArn,
  port: 8787,
  env: {
    NODE_ENV: "production",
    PORT: "8787",
    PAUSETAB_PUBLIC_URL: websiteUrl,
    PAUSETAB_ALLOWED_ORIGINS: websiteUrl,
    PAUSETAB_ALLOWED_RETURN_ORIGINS: websiteUrl,
    PAUSETAB_STORE_S3_BUCKET: storeBucketName,
    PAUSETAB_STORE_S3_KEY: storeObjectKey,
    PAUSETAB_TOKEN_PEPPER: requireBackendValue("PAUSETAB_TOKEN_PEPPER"),
    STRIPE_SECRET_KEY: requireBackendValue("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: requireBackendValue("STRIPE_WEBHOOK_SECRET"),
    STRIPE_PRICE_PRO_MONTHLY: requireBackendValue("STRIPE_PRICE_PRO_MONTHLY"),
    STRIPE_PRICE_PRO_ANNUAL: requireBackendValue("STRIPE_PRICE_PRO_ANNUAL"),
    STRIPE_PRICE_LIFETIME: requireBackendValue("STRIPE_PRICE_LIFETIME"),
  },
  healthPath: "/health",
  autoscalingArn,
});

buildExtensionArtifact(backendUrl, websiteUrl);

const outputs = {
  deployedAt: new Date().toISOString(),
  aws: {
    region,
    account,
  },
  billingMode: backendEnv.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test",
  backendUrl,
  websiteUrl,
  storeBucketName,
  storeObjectKey,
  backendImageUri,
  websiteImageUri,
};

writeFileSync(outputPath, JSON.stringify(outputs, null, 2));

console.log(JSON.stringify(outputs, null, 2));
