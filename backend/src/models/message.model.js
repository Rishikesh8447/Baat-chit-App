import mongoose from "mongoose";

export const buildDirectChatId = (firstUserId, secondUserId) => {
  const [userA, userB] = [String(firstUserId), String(secondUserId)].sort();
  return `direct:${userA}:${userB}`;
};

export const buildGroupChatId = (groupId) => `group:${String(groupId)}`;

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    chatId: {
      type: String,
      trim: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    clientMessageId: {
      type: String,
      trim: true,
      default: null,
    },
    image: {
      type: String,
      default: "",
    },
    seen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.pre("validate", async function setChatId() {
  if (this.chatType === "group" && this.groupId) {
    this.chatId = buildGroupChatId(this.groupId);
  } else if (this.senderId && this.receiverId) {
    this.chatId = buildDirectChatId(this.senderId, this.receiverId);
  }
});

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, seen: 1, createdAt: -1 });
messageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    sparse: true,
    name: "sender_client_message_idx",
  }
);
messageSchema.index(
  { chatId: 1, isDeleted: 1, text: "text", createdAt: -1 },
  {
    name: "chat_text_search_idx",
    default_language: "english",
    weights: { text: 10 },
    partialFilterExpression: {
      isDeleted: false,
      text: { $exists: true },
    },
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
