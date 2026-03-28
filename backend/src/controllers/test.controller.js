import bcrypt from "bcryptjs";
import Message, { buildDirectChatId } from "../models/message.model.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const resetTestData = async (_req, res) => {
  await Promise.all([
    Message.deleteMany({}),
    Group.deleteMany({}),
    User.deleteMany({}),
  ]);

  return res.status(200).json({ ok: true });
};

export const seedTestData = async (req, res) => {
  const { users = [], directMessages = [] } = req.body || {};

  const createdUsers = [];
  const userByEmail = new Map();

  for (const userInput of users) {
    const hashedPassword = await hashPassword(userInput.password);
    const user = await User.create({
      fullName: userInput.fullName,
      email: userInput.email,
      password: hashedPassword,
      profilePic: userInput.profilePic || "",
    });
    createdUsers.push(user);
    userByEmail.set(user.email, user);
  }

  for (const messageInput of directMessages) {
    const sender = userByEmail.get(messageInput.senderEmail);
    const receiver = userByEmail.get(messageInput.receiverEmail);
    if (!sender || !receiver) continue;

    const message = await Message.create({
      senderId: sender._id,
      receiverId: receiver._id,
      chatId: buildDirectChatId(sender._id, receiver._id),
      chatType: "direct",
      text: messageInput.text || "",
      image: messageInput.image || "",
      seen: Boolean(messageInput.seen),
      createdAt: messageInput.createdAt ? new Date(messageInput.createdAt) : undefined,
      updatedAt: messageInput.updatedAt ? new Date(messageInput.updatedAt) : undefined,
    });

    if (messageInput.createdAt || messageInput.updatedAt) {
      await Message.updateOne(
        { _id: message._id },
        {
          $set: {
            ...(messageInput.createdAt ? { createdAt: new Date(messageInput.createdAt) } : {}),
            ...(messageInput.updatedAt ? { updatedAt: new Date(messageInput.updatedAt) } : {}),
          },
        },
        { timestamps: false }
      );
    }
  }

  return res.status(200).json({
    users: createdUsers.map((user) => ({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
    })),
  });
};
