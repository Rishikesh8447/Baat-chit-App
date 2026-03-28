import { createClient } from "redis";
import { env } from "../config/env.js";

let commandClient = null;
let pubClient = null;
let subClient = null;
let redisReadyPromise = null;

const logRedisError = (label) => (error) => {
  console.error(`Redis ${label} error:`, error);
};

const createRedisConnection = (name) => {
  const client = createClient({
    url: env.redisUrl,
    socket: {
      reconnectStrategy(retries) {
        return Math.min(1_000 * retries, 5_000);
      },
    },
  });

  client.on("error", logRedisError(name));
  return client;
};

export const connectRedis = async () => {
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
    })
    .catch((error) => {
      redisReadyPromise = null;
      throw error;
    });

  return redisReadyPromise;
};

const assertClient = (client, label) => {
  if (!client?.isOpen) {
    throw new Error(`Redis ${label} client is not connected`);
  }

  return client;
};

export const getRedisClient = () => assertClient(commandClient, "command");
export const getRedisPubClient = () => assertClient(pubClient, "pub");
export const getRedisSubClient = () => assertClient(subClient, "sub");

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
};
