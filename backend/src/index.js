import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import { disconnectRedis } from "./lib/redis.js";
import { allowedOrigins, env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import testRoutes from "./routes/test.route.js";
import { app, initializeSocketServer, server } from "./lib/socket.js";

const PORT = env.port;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.resolve(frontendDistPath, "index.html");

app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb", strict: true }));
app.use(cookieParser());

if (env.nodeEnv === "production") {
  console.log(`Serving frontend static files from: ${frontendDistPath}`);
  console.log(`Serving React app entry from: ${frontendIndexPath}`);
  app.use(
    express.static(frontendDistPath, {
      index: false,
    })
  );
}

const apiCors = cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
});

app.use("/api", apiCors);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
if (env.enableE2ETests) {
  app.use("/api/test/e2e", testRoutes);
}

if (env.nodeEnv === "production") {
  app.get(/^(?!\/api).*/, (req, res) => {
    console.log(`Serving frontend for route: ${req.originalUrl}`);
    return res.sendFile(frontendIndexPath);
  });
}

app.use(notFound);
app.use(errorHandler);

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await disconnectRedis();
    process.exit(0);
  });
};

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((error) => {
      console.error("Shutdown error:", error);
      process.exit(1);
    });
  });
});

const bootstrapServices = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error(`MongoDB startup warning: ${error.message}`);
  }

  try {
    await initializeSocketServer();
  } catch (error) {
    console.error(`Socket startup warning: ${error.message}`);
  }
};

server.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  void bootstrapServices();
});
