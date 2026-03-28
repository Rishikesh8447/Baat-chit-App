import dotenv from "dotenv";

dotenv.config();

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getNumberEnv = (name, fallback) => {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOrigins = (origins = []) =>
  Array.from(new Set(origins.filter(Boolean).map((origin) => origin.replace(/\/+$/, ""))));

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: getNumberEnv("PORT", 5000),
  mongoUri: getRequiredEnv("MONGODB_URI"),
  redisUrl: process.env.REDIS_URL?.trim() || "",
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || "baat-chit",
  jwtSecret: getRequiredEnv("JWT_SECRET"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  authRateLimitWindowMs: getNumberEnv("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  authRateLimitMax: getNumberEnv("AUTH_RATE_LIMIT_MAX", 10),
  messageRateLimitWindowMs: getNumberEnv("MESSAGE_RATE_LIMIT_WINDOW_MS", 60 * 1000),
  messageRateLimitMax: getNumberEnv("MESSAGE_RATE_LIMIT_MAX", 30),
  enableE2ETests: process.env.ENABLE_E2E_TESTS === "true",
};

if (env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}

export const allowedOrigins = normalizeOrigins([
  env.frontendUrl,
  "http://localhost:5173",
  "http://localhost:5174",
]);

export const isProduction = env.nodeEnv === "production";
