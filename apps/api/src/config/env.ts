import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/**
 * Validated, redacted runtime configuration.
 *
 * The process refuses to start when a variable is missing or unsafe, and the
 * startup banner only ever prints `describeConfiguration()` output - secrets
 * are never logged.
 */

function loadEnvironmentFiles(): void {
  // Walk up from this file so the same code works under `tsx src/...` and `node dist/...`.
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) dotenv.config({ path: candidate, override: false });
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config({ override: false });
}

loadEnvironmentFiles();

const DURATION = /^(\d+)\s*([smhd]?)$/i;

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  CRM_URL: z.string().default("http://localhost:5173"),
  PUBLIC_WEB_URL: z.string().default("http://localhost:3000"),
  TRUST_PROXY: booleanish,
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z
    .string()
    .default("7d")
    .refine((value) => DURATION.test(value.trim()), "JWT_EXPIRES_IN must look like 900, 30m, 12h or 7d"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  HOTEL_STATE_CODE: z.string().optional(),
  HOTEL_GSTIN: z.string().optional(),
  HOTEL_NAME: z.string().optional(),
});

export type Env = z.infer<typeof schema> & {
  JWT_EXPIRES_IN_SECONDS: number;
  isProduction: boolean;
  isDevelopment: boolean;
};

const WEAK_SECRETS = new Set([
  "changeme",
  "change-me",
  "secret",
  "password",
  "jwt-secret",
  "indian_hotel_super_secure_jwt_secret_key_2026",
]);

export class ConfigurationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

function parseDurationToSeconds(value: string): number {
  const match = DURATION.exec(value.trim());
  if (!match) return 7 * 86400;
  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multiplier = unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return amount * multiplier;
}

function collectIssues(parsed: z.infer<typeof schema>): string[] {
  const issues: string[] = [];

  if (parsed.JWT_SECRET.length < 32) issues.push("JWT_SECRET must be at least 32 characters");

  return issues;
}

/** Non-fatal warnings - printed without echoing the secret itself. */
function developmentWarnings(parsed: z.infer<typeof schema>): string[] {
  if (parsed.NODE_ENV === "production") return [];
  const warnings: string[] = [];
  if (WEAK_SECRETS.has(parsed.JWT_SECRET.trim().toLowerCase())) {
    warnings.push("JWT_SECRET is the well-known placeholder from .env.example - replace it before deploying");
  }
  return warnings;
}

function productionIssues(parsed: z.infer<typeof schema>): string[] {
  if (parsed.NODE_ENV !== "production") return [];
  const issues: string[] = [];
  const normalizedSecret = parsed.JWT_SECRET.trim().toLowerCase();
  if (WEAK_SECRETS.has(normalizedSecret)) {
    issues.push("JWT_SECRET is a well-known placeholder and must be replaced in production");
  }
  if (parsed.JWT_SECRET.length < 48) {
    issues.push("JWT_SECRET must be at least 48 characters in production (generate with `openssl rand -base64 48`)");
  }
  if (parsed.CRM_URL.startsWith("http://") && !parsed.CRM_URL.includes("localhost")) {
    issues.push("CRM_URL must use https in production");
  }
  if (parsed.PUBLIC_WEB_URL.startsWith("http://") && !parsed.PUBLIC_WEB_URL.includes("localhost")) {
    issues.push("PUBLIC_WEB_URL must use https in production");
  }
  if (parsed.DATABASE_URL.includes(":postgres@")) {
    issues.push("DATABASE_URL still uses the default postgres password in production");
  }
  if (parsed.RAZORPAY_KEY_SECRET && parsed.RAZORPAY_KEY_SECRET === "placeholder_secret") {
    issues.push("RAZORPAY_KEY_SECRET is still a placeholder in production");
  }
  return issues;
}

function buildEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Only field paths and messages - never the received values.
    const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new ConfigurationError(issues);
  }

  const parsed = result.data;
  const issues = [...collectIssues(parsed), ...productionIssues(parsed)];
  if (issues.length > 0) throw new ConfigurationError(issues);

  for (const warning of developmentWarnings(parsed)) {
    console.warn(`[config] warning: ${warning}`);
  }

  return Object.freeze({
    ...parsed,
    JWT_EXPIRES_IN_SECONDS: parseDurationToSeconds(parsed.JWT_EXPIRES_IN),
    isProduction: parsed.NODE_ENV === "production",
    isDevelopment: parsed.NODE_ENV === "development",
  });
}

export const env: Env = buildEnv();

/** Safe-to-print summary for startup logs. Contains no secrets. */
export function describeConfiguration(): Record<string, string | number | boolean> {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    API_BASE_URL: env.API_BASE_URL,
    CORS_ORIGINS: [env.CRM_URL, env.PUBLIC_WEB_URL].join(", "),
    TRUST_PROXY: env.TRUST_PROXY,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
    JWT_SECRET: `[REDACTED ${env.JWT_SECRET.length} chars]`,
    DATABASE_URL: "[REDACTED]",
    RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID ? `[REDACTED ${env.RAZORPAY_KEY_ID.length} chars]` : "(not set)",
    RATE_LIMIT: `${env.RATE_LIMIT_MAX} req / ${env.RATE_LIMIT_WINDOW_MS}ms`,
    AUTH_RATE_LIMIT: `${env.AUTH_RATE_LIMIT_MAX} attempts / ${env.AUTH_RATE_LIMIT_WINDOW_MS}ms`,
  };
}
