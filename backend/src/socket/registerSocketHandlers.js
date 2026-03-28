import User from "../models/user.model.js";
import {
  emitOnlineUsers,
  emitPresenceUpdated,
  emitStopTypingEvent,
  emitTypingEvent,
  initializeSocketService,
} from "./socket.service.js";
import { getUserRoom, isUserOnline, refreshUserSocket, registerUserSocket, unregisterSocket } from "./state.js";

const PRESENCE_REFRESH_INTERVAL_MS = 60_000;

export const registerSocketHandlers = (io) => {
  initializeSocketService(io);

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    const normalizedUserId = userId ? String(userId) : null;
    let presenceHeartbeat = null;

    if (normalizedUserId && normalizedUserId !== "undefined") {
      socket.join(getUserRoom(normalizedUserId));
      registerUserSocket(normalizedUserId, socket.id)
        .then(async () => {
          const user = await User.findById(normalizedUserId).select("lastSeen");
          emitPresenceUpdated({
            userId: normalizedUserId,
            online: true,
            lastSeen: user?.lastSeen || null,
          });
          await emitOnlineUsers();
        })
        .catch((error) => {
          console.error("Failed to register socket presence:", error);
        });

      presenceHeartbeat = setInterval(() => {
        refreshUserSocket(normalizedUserId, socket.id).catch((error) => {
          console.error("Failed to refresh socket presence:", error);
        });
      }, PRESENCE_REFRESH_INTERVAL_MS);
      presenceHeartbeat.unref?.();
    }

    socket.on("typing", async (payload = {}) => {
      await emitTypingEvent(payload);
    });

    socket.on("stopTyping", async (payload = {}) => {
      await emitStopTypingEvent(payload);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
      if (presenceHeartbeat) {
        clearInterval(presenceHeartbeat);
      }

      unregisterSocket(socket.id, normalizedUserId)
        .then(async () => {
          const stillOnline = await isUserOnline(normalizedUserId);
          let lastSeen = null;

          if (!stillOnline && normalizedUserId && normalizedUserId !== "undefined") {
            lastSeen = new Date();
            await User.findByIdAndUpdate(normalizedUserId, { lastSeen });
          }

          emitPresenceUpdated({
            userId: normalizedUserId,
            online: stillOnline,
            lastSeen,
          });
          await emitOnlineUsers();
        })
        .catch((error) => {
          console.error("Failed to unregister socket presence:", error);
        });
    });
  });
};
