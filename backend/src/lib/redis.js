import { createClient } from "redis";
import { env } from "../config/env.js";

let commandClient = null;
let pubClient = null;
let subClient = null;
let redisReadyPromise = null;
let redisAvailable = false;

const logRedisError = (label) => (error) => {
  if (!env.redisUrl) return;
  console.warn(`Redis ${label} warning: ${error.message}`);
};

const createRedisConnection = (name) => {
  const client = createClient({
    url: env.redisUrl,
    socket: {
      reconnectStrategy(retries) {
        if (retries >= 3) {
          return new Error("Redis connection retries exhausted");
        }
        return Math.min(1_000 * retries, 5_000);
      },
    },
  });

  client.on("error", logRedisError(name));
  return client;
};

export const connectRedis = async () => {
  if (!env.redisUrl) {
    redisAvailable = false;
    return false;
  }

  if (redisReadyPromise) {
    return redisReadyPromise;
  }

  commandClient = createRedisConnection("command");
  pubClient = commandClient.duplicate();
  subClient = commandClient.duplicate();

  redisReadyPromise = Promise.all([
    commandClient.connect(),
    pubClient.connect(),
    subClient.connect(),
  ])
    .then(() => {
      console.log("Redis connected");
      redisAvailable = true;
      return true;
    })
    .catch(async (error) => {
      console.warn(`Redis unavailable, continuing without it: ${error.message}`);
      redisAvailable = false;
      redisReadyPromise = null;
      await disconnectRedis();
      return false;
    });

  return redisReadyPromise;
};

export const isRedisAvailable = () => redisAvailable;
export const getRedisClient = () => (redisAvailable && commandClient?.isOpen ? commandClient : null);
export const getRedisPubClient = () => (redisAvailable && pubClient?.isOpen ? pubClient : null);
export const getRedisSubClient = () => (redisAvailable && subClient?.isOpen ? subClient : null);

export const disconnectRedis = async () => {
  const clients = [subClient, pubClient, commandClient].filter(Boolean);

  await Promise.all(
    clients.map(async (client) => {
      if (client.isOpen) {
        await client.quit();
      }
    })
  );

  commandClient = null;
  pubClient = null;
  subClient = null;
  redisReadyPromise = null;
  redisAvailable = false;
};
