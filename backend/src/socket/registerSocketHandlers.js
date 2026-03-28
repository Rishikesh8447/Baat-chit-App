import { emitOnlineUsers, emitStopTypingEvent, emitTypingEvent, initializeSocketService } from "./socket.service.js";
import { getUserRoom, refreshUserSocket, registerUserSocket, unregisterSocket } from "./state.js";

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
        .then(() => emitOnlineUsers())
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
        .then(() => emitOnlineUsers())
        .catch((error) => {
          console.error("Failed to unregister socket presence:", error);
        });
    });
  });
};
