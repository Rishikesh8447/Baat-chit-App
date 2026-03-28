import Group from "../models/group.model.js";
import { getOnlineUserIds, getUserRoom } from "./state.js";

let ioInstance = null;

export const initializeSocketService = (io) => {
  ioInstance = io;
};

export const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return false;

  ioInstance.to(getUserRoom(userId)).emit(event, payload);
  return true;
};

export const emitToUsers = (userIds = [], event, payload, { excludeUserIds = [] } = {}) => {
  const excluded = new Set(excludeUserIds.map(String));

  userIds.forEach((userId) => {
    const normalizedUserId = String(userId);
    if (excluded.has(normalizedUserId)) return;
    emitToUser(normalizedUserId, event, payload);
  });
};

export const emitOnlineUsers = async () => {
  if (!ioInstance) return;
  const onlineUsers = await getOnlineUserIds();
  ioInstance.emit("onlineUsers", onlineUsers);
};

export const emitPresenceUpdated = ({ userId, online, lastSeen = null }) => {
  if (!ioInstance || !userId) return;
  ioInstance.emit("presenceUpdated", {
    userId: String(userId),
    online: Boolean(online),
    lastSeen,
  });
};

export const emitDirectMessage = (receiverId, message) =>
  emitToUser(receiverId, "newMessage", message);

export const emitGroupMessage = (memberIds, message) =>
  emitToUsers(memberIds, "newGroupMessage", message);

export const emitMessageUpdated = async (message) => {
  if (message.chatType === "group" && message.groupId) {
    const group = await Group.findById(message.groupId).select("members");
    if (!group) return;
    emitToUsers(group.members, "messageUpdated", message);
    return;
  }

  emitToUser(message.senderId, "messageUpdated", message);
  if (message.receiverId) {
    emitToUser(message.receiverId, "messageUpdated", message);
  }
};

export const emitMessageDeleted = async (message) => {
  if (message.chatType === "group" && message.groupId) {
    const group = await Group.findById(message.groupId).select("members");
    if (!group) return;
    emitToUsers(group.members, "messageDeleted", message);
    return;
  }

  emitToUser(message.senderId, "messageDeleted", message);
  if (message.receiverId) {
    emitToUser(message.receiverId, "messageDeleted", message);
  }
};

export const emitDirectChatCleared = ({ userA, userB }) => {
  const payload = { chatType: "direct", userA, userB };
  emitToUser(userA, "chatCleared", payload);
  emitToUser(userB, "chatCleared", payload);
};

export const emitGroupChatCleared = (memberIds, groupId) => {
  emitToUsers(memberIds, "chatCleared", { chatType: "group", groupId });
};

export const emitGroupUpdated = (memberIds, group) => {
  emitToUsers(memberIds, "groupUpdated", group);
};

export const emitGroupRemoved = (userId, groupId) => {
  emitToUser(userId, "groupRemoved", { groupId });
};

export const emitGroupDeleted = (memberIds, groupId) => {
  emitToUsers(memberIds, "groupDeleted", { groupId });
};

export const emitTypingEvent = async (payload = {}) => {
  const { chatType, receiverId, groupId, senderId, senderName } = payload;
  if (!senderId) return;

  if (chatType === "group" && groupId) {
    const group = await Group.findById(groupId).select("members");
    if (!group) return;

    emitToUsers(
      group.members,
      "typing",
      {
        chatType: "group",
        groupId,
        senderId,
        senderName,
      },
      { excludeUserIds: [senderId] }
    );
    return;
  }

  if (chatType === "direct" && receiverId) {
    emitToUser(receiverId, "typing", {
      chatType: "direct",
      senderId,
      senderName,
    });
  }
};

export const emitStopTypingEvent = async (payload = {}) => {
  const { chatType, receiverId, groupId, senderId } = payload;
  if (!senderId) return;

  if (chatType === "group" && groupId) {
    const group = await Group.findById(groupId).select("members");
    if (!group) return;

    emitToUsers(
      group.members,
      "stopTyping",
      {
        chatType: "group",
        groupId,
        senderId,
      },
      { excludeUserIds: [senderId] }
    );
    return;
  }

  if (chatType === "direct" && receiverId) {
    emitToUser(receiverId, "stopTyping", {
      chatType: "direct",
      senderId,
    });
  }
};
