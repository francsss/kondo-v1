type Environment = Record<string, string | undefined>;

const REQUIRED_PRODUCTION_VALUES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
] as const;

const PLACEHOLDER_PATTERN = /(?:change[-_ ]?me|replace|example|<[^>]+>)/i;

export class ProductionEnvironmentError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid production environment: ${issues.join(" ")}`);
    this.name = "ProductionEnvironmentError";
  }
}

function parseUrl(
  value: string | undefined,
  variable: string,
  protocols: string[],
  issues: string[],
) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) {
      issues.push(
        `${variable} must use ${protocols.map((item) => item.replace(":", "")).join(" or ")}.`,
      );
    }
    return url;
  } catch {
    issues.push(`${variable} must be a valid URL.`);
    return null;
  }
}

function requireSecret(
  environment: Environment,
  variable: string,
  minimumLength: number,
  issues: string[],
) {
  const value = environment[variable];
  if (!value) return;
  if (new TextEncoder().encode(value).byteLength < minimumLength) {
    issues.push(`${variable} must contain at least ${minimumLength} bytes.`);
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    issues.push(`${variable} still contains a placeholder value.`);
  }
}

export function productionEnvironmentIssues(
  environment: Environment = process.env,
) {
  const issues: string[] = [];

  for (const variable of REQUIRED_PRODUCTION_VALUES) {
    const value = environment[variable]?.trim();
    if (!value) {
      issues.push(`${variable} is required.`);
    } else if (variable !== "EMAIL_FROM" && PLACEHOLDER_PATTERN.test(value)) {
      issues.push(`${variable} still contains a placeholder value.`);
    }
  }

  const databaseUrl = parseUrl(
    environment.DATABASE_URL,
    "DATABASE_URL",
    ["postgres:", "postgresql:"],
    issues,
  );
  const directUrl = parseUrl(
    environment.DIRECT_URL,
    "DIRECT_URL",
    ["postgres:", "postgresql:"],
    issues,
  );
  if (
    databaseUrl &&
    directUrl &&
    databaseUrl.toString() === directUrl.toString()
  ) {
    issues.push(
      "DATABASE_URL and DIRECT_URL must use Neon's pooled and direct connections respectively.",
    );
  }
  if (
    databaseUrl &&
    (!databaseUrl.hostname.endsWith(".neon.tech") ||
      !databaseUrl.hostname.includes("-pooler."))
  ) {
    issues.push("DATABASE_URL must use a Neon pooled connection hostname.");
  }
  if (
    directUrl &&
    (!directUrl.hostname.endsWith(".neon.tech") ||
      directUrl.hostname.includes("-pooler."))
  ) {
    issues.push("DIRECT_URL must use a Neon direct connection hostname.");
  }
  for (const [variable, url] of [
    ["DATABASE_URL", databaseUrl],
    ["DIRECT_URL", directUrl],
  ] as const) {
    if (url && url.searchParams.get("sslmode") !== "require") {
      issues.push(`${variable} must include sslmode=require.`);
    }
  }

  const appUrl = parseUrl(
    environment.NEXT_PUBLIC_APP_URL,
    "NEXT_PUBLIC_APP_URL",
    ["https:"],
    issues,
  );
  if (
    appUrl &&
    (appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash ||
      appUrl.username ||
      appUrl.password)
  ) {
    issues.push("NEXT_PUBLIC_APP_URL must be an HTTPS origin without a path.");
  }
  if (
    appUrl &&
    (appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1")
  ) {
    issues.push("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
  }

  if (environment.STORAGE_DRIVER !== "s3") {
    issues.push('STORAGE_DRIVER must be "s3" in production.');
  }
  if (environment.STORAGE_REGION !== "auto") {
    issues.push('STORAGE_REGION must be "auto" for Cloudflare R2.');
  }
  const storageEndpoint = parseUrl(
    environment.STORAGE_ENDPOINT,
    "STORAGE_ENDPOINT",
    ["https:"],
    issues,
  );
  if (
    storageEndpoint &&
    !storageEndpoint.hostname.endsWith(".r2.cloudflarestorage.com")
  ) {
    issues.push("STORAGE_ENDPOINT must be the Cloudflare R2 S3 API endpoint.");
  }
  if (
    storageEndpoint &&
    (storageEndpoint.pathname !== "/" ||
      storageEndpoint.search ||
      storageEndpoint.hash ||
      storageEndpoint.username ||
      storageEndpoint.password)
  ) {
    issues.push("STORAGE_ENDPOINT must be an HTTPS origin without a path.");
  }

  if (environment.EMAIL_PROVIDER !== "resend") {
    issues.push('EMAIL_PROVIDER must be "resend" in production.');
  }
  if (
    environment.EMAIL_FROM &&
    !/^[^@\n]+@[^@\n]+\.[^@\n]+>?$/.test(environment.EMAIL_FROM.trim())
  ) {
    issues.push("EMAIL_FROM must contain a valid sender email address.");
  }
  if (
    environment.EMAIL_FROM &&
    /(?:change[-_ ]?me|replace|example)/i.test(environment.EMAIL_FROM)
  ) {
    issues.push("EMAIL_FROM still contains a placeholder value.");
  }
  if (
    environment.RESEND_API_KEY &&
    !environment.RESEND_API_KEY.startsWith("re_")
  ) {
    issues.push("RESEND_API_KEY must be a Resend API key.");
  }

  const upstashUrl = parseUrl(
    environment.UPSTASH_REDIS_REST_URL,
    "UPSTASH_REDIS_REST_URL",
    ["https:"],
    issues,
  );
  if (upstashUrl && !upstashUrl.hostname.endsWith(".upstash.io")) {
    issues.push("UPSTASH_REDIS_REST_URL must be an Upstash REST endpoint.");
  }

  requireSecret(environment, "JWT_SECRET", 32, issues);
  requireSecret(environment, "CRON_SECRET", 32, issues);
  requireSecret(environment, "STORAGE_ACCESS_KEY_ID", 16, issues);
  requireSecret(environment, "STORAGE_SECRET_ACCESS_KEY", 32, issues);
  requireSecret(environment, "RESEND_API_KEY", 16, issues);
  requireSecret(environment, "UPSTASH_REDIS_REST_TOKEN", 20, issues);
  requireSecret(environment, "NOTIFICATION_WORKER_SECRET", 32, issues);
  requireSecret(environment, "MARKETPLACE_WORKER_SECRET", 32, issues);
  requireSecret(environment, "MEDIA_WORKER_SECRET", 32, issues);

  if (environment.KONDO_ALLOW_DESTRUCTIVE_SEED === "true") {
    issues.push("KONDO_ALLOW_DESTRUCTIVE_SEED must not be enabled.");
  }

  return [...new Set(issues)];
}

export function assertProductionEnvironment(
  environment: Environment = process.env,
) {
  const issues = productionEnvironmentIssues(environment);
  if (issues.length) throw new ProductionEnvironmentError(issues);
}

export function isVercelProduction(environment: Environment = process.env) {
  return environment.VERCEL_ENV?.trim().toLowerCase() === "production";
}
