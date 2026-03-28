import Message, { buildDirectChatId, buildGroupChatId } from "../models/message.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_SEARCH_LIMIT = 20;

const normalizePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
};

const shouldIncludePaginationMeta = (query = {}) => {
  return String(query.paginated || "").toLowerCase() === "true";
};

const hydrateChatIdForMessage = async (message) => {
  if (!message || message.chatId) return message;

  message.chatId =
    message.chatType === "group" && message.groupId
      ? buildGroupChatId(message.groupId)
      : buildDirectChatId(message.senderId, message.receiverId);

  await message.save();
  return message;
};

const buildPaginatedResponse = async ({ filter, query = {} }) => {
  const limit = Math.min(normalizePositiveInt(query.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);
  const skip = normalizePositiveInt(query.skip, 0);

  const docs = await Message.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit + 1);

  await Promise.all(docs.map(hydrateChatIdForMessage));

  const hasMore = docs.length > limit;
  const pageItems = hasMore ? docs.slice(0, limit) : docs;
  const items = [...pageItems].reverse();

  return {
    items,
    pagination: {
      limit,
      skip,
      hasMore,
      nextSkip: hasMore ? skip + limit : null,
    },
  };
};

export const getDirectMessagesPage = async ({ currentUserId, otherUserId, query }) => {
  const chatId = buildDirectChatId(currentUserId, otherUserId);

  return buildPaginatedResponse({
    filter: {
      $or: [
        { chatId },
        {
          $and: [
            { $or: [{ senderId: currentUserId, receiverId: otherUserId }, { senderId: otherUserId, receiverId: currentUserId }] },
            { $or: [{ chatType: "direct" }, { chatType: { $exists: false } }] },
          ],
        },
      ],
    },
    query,
  });
};

export const getGroupMessagesPage = async ({ groupId, query }) => {
  const chatId = buildGroupChatId(groupId);

  return buildPaginatedResponse({
    filter: {
      $or: [
        { chatId, chatType: "group" },
        { groupId, chatType: "group" },
      ],
    },
    query,
  });
};

export const formatMessageListResponse = (result, query = {}) => {
  if (shouldIncludePaginationMeta(query)) {
    return result;
  }

  return result.items;
};

export const searchMessagesInChat = async ({
  chatId,
  query,
  limit = 20,
  mode = "all",
}) => {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_SEARCH_LIMIT);
  const normalizedTerms = trimmedQuery
    .replace(/[^\p{L}\p{N}\s"-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedTerms || normalizedTerms.length < 2) {
    return [];
  }

  const filter = {
    chatId,
    isDeleted: false,
    $text: { $search: normalizedTerms },
  };

  if (mode === "file") {
    filter.image = { $exists: true, $ne: "" };
  }

  return Message.find(filter, {
    score: { $meta: "textScore" },
  })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(normalizedLimit)
    .select("_id senderId receiverId groupId chatType text image createdAt isDeleted isEdited score")
    .lean();
};

export const getSidebarMessageMeta = async (loggedInUserId) => {
  const currentUserId = String(loggedInUserId);

  return Message.aggregate([
    {
      $match: {
        $and: [
          {
            $or: [
              { senderId: loggedInUserId },
              { receiverId: loggedInUserId },
            ],
          },
          {
            $or: [{ chatType: "direct" }, { chatType: { $exists: false } }],
          },
        ],
      },
    },
    {
      $addFields: {
        otherUserId: {
          $cond: [{ $eq: [{ $toString: "$senderId" }, currentUserId] }, "$receiverId", "$senderId"],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$otherUserId",
        lastMessageDoc: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $toString: "$senderId" }, currentUserId] },
                  { $ne: ["$seen", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        otherUserId: { $toString: "$_id" },
        lastMessageAt: "$lastMessageDoc.createdAt",
        unreadCount: 1,
        lastMessage: {
          $cond: [
            "$lastMessageDoc.isDeleted",
            "Message deleted",
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$lastMessageDoc.text", ""] } }, 0] },
                "$lastMessageDoc.text",
                {
                  $cond: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$lastMessageDoc.image", ""] } }, 0] },
                    "Image",
                    "",
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  ]);
};
