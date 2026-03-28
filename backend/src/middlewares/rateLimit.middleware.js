import crypto from "crypto";
import { env } from "../config/env.js";
import { getRedisClient } from "../lib/redis.js";

const toRateLimitKey = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const resolveIdentifier = (req) => req.user?._id?.toString() || req.ip || "anonymous";

export const rateLimit = ({
  key = "default",
  windowMs = 60_000,
  max = 60,
  message = "Too many requests, please try again later",
} = {}) => {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      if (!redis) {
        return next();
      }

      const identifier = toRateLimitKey(resolveIdentifier(req));
      const redisKey = `${env.redisKeyPrefix}:ratelimit:${key}:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      const requestId = `${now}-${crypto.randomUUID()}`;

      const pipeline = redis.multi();
      pipeline.zRemRangeByScore(redisKey, 0, windowStart);
      pipeline.zCard(redisKey);
      pipeline.zAdd(redisKey, { score: now, value: requestId });
      pipeline.pExpire(redisKey, windowMs);
      pipeline.zRange(redisKey, 0, 0, { WITHSCORES: true });

      const [, currentCountEntry, , , oldestEntry] = await pipeline.exec();
      const currentCount = Number(currentCountEntry ?? 0);

      if (currentCount >= max) {
        await redis.zRem(redisKey, requestId);

        const oldestScore = Number(oldestEntry?.[0]?.score ?? now);
        const retryAfterSeconds = Math.ceil((oldestScore + windowMs - now) / 1000);

        res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", "0");
        return res.status(429).json({ message });
      }

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(max - (currentCount + 1), 0)));
      return next();
    } catch (error) {
      console.warn(`Rate limiter fallback for ${key}: ${error.message}`);
      return next();
    }
  };
};
