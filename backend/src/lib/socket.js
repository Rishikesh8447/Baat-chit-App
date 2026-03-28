import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import http from "http";
import express from "express";
import { allowedOrigins } from "../config/env.js";
import { registerSocketHandlers } from "../socket/registerSocketHandlers.js";
import { connectRedis, getRedisPubClient, getRedisSubClient } from "./redis.js";

const app = express();
const server = http.createServer(app);
let socketServerInitialized = false;

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

export const initializeSocketServer = async () => {
  if (socketServerInitialized) return;

  const redisConnected = await connectRedis();
  if (redisConnected) {
    io.adapter(createAdapter(getRedisPubClient(), getRedisSubClient()));
  } else {
    console.warn("Socket.IO Redis adapter disabled. Running without Redis.");
  }

  registerSocketHandlers(io);
  socketServerInitialized = true;
};

export { io, app, server };
