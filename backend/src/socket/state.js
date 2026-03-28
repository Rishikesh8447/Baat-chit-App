import { env } from "../config/env.js";
import { getRedisClient } from "../lib/redis.js";

const PRESENCE_TTL_SECONDS = 120;
const PRESENCE_TTL_MS = PRESENCE_TTL_SECONDS * 1000;
const localUserSocketMap = new Map();

const userSocketsKey = (userId) => `${env.redisKeyPrefix}:presence:user:${userId}:sockets`;
const socketUserKey = (socketId) => `${env.redisKeyPrefix}:presence:socket:${socketId}`;
const onlineUsersKey = `${env.redisKeyPrefix}:presence:online-users`;

const normalizeUserId = (userId) => {
  if (!userId || userId === "undefined") return null;
  return String(userId);
};

export const getUserRoom = (userId) => `user:${String(userId)}`;

const addLocalSocket = (userId, socketId) => {
  const sockets = localUserSocketMap.get(userId) || new Set();
  sockets.add(socketId);
  localUserSocketMap.set(userId, sockets);
};

const removeLocalSocket = (userId, socketId) => {
  const sockets = localUserSocketMap.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    localUserSocketMap.delete(userId);
  }
};

export const refreshUserSocket = async (userId, socketId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !socketId) return;

  addLocalSocket(normalizedUserId, socketId);

  const redis = getRedisClient();
  if (!redis) return;

  const now = Date.now();
  const multi = redis.multi();
  multi.sAdd(userSocketsKey(normalizedUserId), socketId);
  multi.expire(userSocketsKey(normalizedUserId), PRESENCE_TTL_SECONDS);
  multi.set(socketUserKey(socketId), normalizedUserId, { EX: PRESENCE_TTL_SECONDS });
  multi.zAdd(onlineUsersKey, { score: now, value: normalizedUserId });
  await multi.exec();
};

export const registerUserSocket = async (userId, socketId) => {
  await refreshUserSocket(userId, socketId);
};

export const unregisterSocket = async (socketId, userIdOverride = null) => {
  if (!socketId) return;

  const normalizedOverride = normalizeUserId(userIdOverride);
  if (normalizedOverride) {
    removeLocalSocket(normalizedOverride, socketId);
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  const storedUserId = userIdOverride ? normalizeUserId(userIdOverride) : await redis.get(socketUserKey(socketId));
  const normalizedUserId = normalizeUserId(storedUserId);
  if (normalizedUserId && !normalizedOverride) {
    removeLocalSocket(normalizedUserId, socketId);
  }

  const multi = redis.multi();
  multi.del(socketUserKey(socketId));

  if (normalizedUserId) {
    multi.sRem(userSocketsKey(normalizedUserId), socketId);
  }

  await multi.exec();

  if (!normalizedUserId) return;

  const remainingSockets = await redis.sCard(userSocketsKey(normalizedUserId));
  if (remainingSockets === 0) {
    const cleanup = redis.multi();
    cleanup.del(userSocketsKey(normalizedUserId));
    cleanup.zRem(onlineUsersKey, normalizedUserId);
    await cleanup.exec();
  }
};

export const getOnlineUserIds = async () => {
  const redis = getRedisClient();
  if (!redis) {
    return Array.from(localUserSocketMap.keys());
  }

  const cutoff = Date.now() - PRESENCE_TTL_MS;
  await redis.zRemRangeByScore(onlineUsersKey, 0, cutoff);
  return redis.zRange(onlineUsersKey, 0, -1);
};
