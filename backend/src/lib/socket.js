import { Server } from "socket.io";
import http from "http";
import express from "express";
import Group from "../models/group.model.js";

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("typing", async (payload = {}) => {
    const { chatType, receiverId, groupId, senderId, senderName } = payload;
    if (!senderId) return;

    if (chatType === "group" && groupId) {
      const group = await Group.findById(groupId).select("members");
      if (!group) return;

      group.members.forEach((memberId) => {
        const memberIdStr = memberId.toString();
        if (memberIdStr === senderId) return;
        const socketId = getReceiverSocketId(memberIdStr);
        if (socketId) {
          io.to(socketId).emit("typing", {
            chatType: "group",
            groupId,
            senderId,
            senderName,
          });
        }
      });
      return;
    }

    if (chatType === "direct" && receiverId) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", {
          chatType: "direct",
          senderId,
          senderName,
        });
      }
    }
  });

  socket.on("stopTyping", async (payload = {}) => {
    const { chatType, receiverId, groupId, senderId } = payload;
    if (!senderId) return;

    if (chatType === "group" && groupId) {
      const group = await Group.findById(groupId).select("members");
      if (!group) return;

      group.members.forEach((memberId) => {
        const memberIdStr = memberId.toString();
        if (memberIdStr === senderId) return;
        const socketId = getReceiverSocketId(memberIdStr);
        if (socketId) {
          io.to(socketId).emit("stopTyping", {
            chatType: "group",
            groupId,
            senderId,
          });
        }
      });
      return;
    }

    if (chatType === "direct" && receiverId) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stopTyping", {
          chatType: "direct",
          senderId,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId && userId !== "undefined") delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
