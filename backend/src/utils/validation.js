import mongoose from "mongoose";

const MAX_TEXT_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;
const MAX_BASE64_IMAGE_LENGTH = 10 * 1024 * 1024;
const MAX_REPLY_PREVIEW_LENGTH = 240;

const trimString = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => trimString(value).toLowerCase();
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));
const sanitizeText = (value) => trimString(value).replace(/\s+/g, " ");
const sanitizeClientMessageId = (value) => trimString(value).slice(0, 100);

const sanitizeReplyTo = (value, details) => {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    details.push("replyTo must be an object");
    return null;
  }

  const messageId = value.messageId ? String(value.messageId) : "";
  const senderId = value.senderId ? String(value.senderId) : "";
  const text = sanitizeText(value.text || "").slice(0, MAX_REPLY_PREVIEW_LENGTH);

  if (!isValidObjectId(messageId)) {
    details.push("replyTo.messageId must be a valid id");
  }
  if (senderId && !isValidObjectId(senderId)) {
    details.push("replyTo.senderId must be a valid id");
  }

  if (details.length) return null;

  return {
    messageId,
    text,
    ...(senderId ? { senderId } : {}),
  };
};

const validateImagePayload = (value, fieldName, details) => {
  if (!value) return "";
  if (typeof value !== "string") {
    details.push(`${fieldName} must be a base64 image string`);
    return "";
  }
  if (value.length > MAX_BASE64_IMAGE_LENGTH) {
    details.push(`${fieldName} exceeds the maximum supported size`);
  }
  return value;
};

export const validateAuthSignup = (req) => {
  const details = [];
  const fullName = trimString(req.body?.fullName);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!fullName) details.push("fullName is required");
  if (fullName.length > MAX_NAME_LENGTH) details.push("fullName is too long");
  if (!email) details.push("email is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) details.push("email is invalid");
  if (!isNonEmptyString(password)) details.push("password is required");
  if (typeof password === "string" && password.length < 6) {
    details.push("password must be at least 6 characters");
  }

  if (details.length) {
    return { ok: false, message: "Invalid signup payload", details };
  }

  return {
    ok: true,
    value: {
      body: { fullName, email, password },
    },
  };
};

export const validateAuthLogin = (req) => {
  const details = [];
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) details.push("email is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) details.push("email is invalid");
  if (!isNonEmptyString(password)) details.push("password is required");

  if (details.length) {
    return { ok: false, message: "Invalid login payload", details };
  }

  return { ok: true, value: { body: { email, password } } };
};

export const validateForgotPassword = (req) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return { ok: true, value: { body: { email: "" } } };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Invalid forgot password payload", details: ["email is invalid"] };
  }

  return { ok: true, value: { body: { email } } };
};

export const validateResetPassword = (req) => {
  const details = [];
  const token = trimString(req.params?.token);
  const password = req.body?.password;

  if (!token) details.push("token is required");
  if (!isNonEmptyString(password)) details.push("password is required");
  if (typeof password === "string" && password.length < 6) {
    details.push("password must be at least 6 characters");
  }

  if (details.length) {
    return { ok: false, message: "Invalid reset password payload", details };
  }

  return { ok: true, value: { params: { token }, body: { password } } };
};

export const validateProfileUpdate = (req) => {
  const details = [];
  const profilePic = validateImagePayload(req.body?.profilePic, "profilePic", details);

  if (!profilePic) details.push("profilePic is required");

  if (details.length) {
    return { ok: false, message: "Invalid profile update payload", details };
  }

  return { ok: true, value: { body: { profilePic } } };
};

export const validatePaginationQuery = (req) => {
  const details = [];
  const limit = req.query?.limit === undefined ? undefined : Number.parseInt(req.query.limit, 10);
  const skip = req.query?.skip === undefined ? undefined : Number.parseInt(req.query.skip, 10);
  const paginated = String(req.query?.paginated || "").toLowerCase() === "true";

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
    details.push("limit must be an integer between 1 and 50");
  }
  if (skip !== undefined && (!Number.isInteger(skip) || skip < 0)) {
    details.push("skip must be a non-negative integer");
  }

  if (details.length) {
    return { ok: false, message: "Invalid pagination query", details };
  }

  return {
    ok: true,
    value: {
      query: {
        ...req.query,
        ...(limit !== undefined ? { limit: String(limit) } : {}),
        ...(skip !== undefined ? { skip: String(skip) } : {}),
        ...(paginated ? { paginated: "true" } : {}),
      },
    },
  };
};

export const validateSearchQuery = (req) => {
  const details = [];
  const q = trimString(req.query?.q);
  const mode = trimString(req.query?.mode || "all").toLowerCase();
  const limit = req.query?.limit === undefined ? undefined : Number.parseInt(req.query.limit, 10);

  if (!q) details.push("q is required");
  if (q && q.length < 2) details.push("q must be at least 2 characters");
  if (q.length > 120) details.push("q is too long");
  if (!["all", "text", "file"].includes(mode)) details.push("mode must be all, text, or file");
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 20)) {
    details.push("limit must be an integer between 1 and 20");
  }

  if (details.length) {
    return { ok: false, message: "Invalid search query", details };
  }

  return {
    ok: true,
    value: {
      query: {
        ...req.query,
        q,
        mode,
        ...(limit !== undefined ? { limit: String(limit) } : {}),
      },
    },
  };
};

export const validateObjectIdParams = (...paramNames) => (req) => {
  const details = [];
  const nextParams = { ...req.params };

  paramNames.forEach((paramName) => {
    const value = req.params?.[paramName];
    if (!isValidObjectId(value)) {
      details.push(`${paramName} must be a valid id`);
      return;
    }
    nextParams[paramName] = String(value);
  });

  if (details.length) {
    return { ok: false, message: "Invalid route parameters", details };
  }

  return { ok: true, value: { params: nextParams } };
};

export const validateSendMessage = (req) => {
  const details = [];
  const text = sanitizeText(req.body?.text || "");
  const image = validateImagePayload(req.body?.image || req.body?.img, "image", details);
  const clientMessageId = sanitizeClientMessageId(req.body?.clientMessageId);
  const replyTo = sanitizeReplyTo(req.body?.replyTo, details);

  if (!isValidObjectId(req.params?.id)) details.push("id must be a valid id");
  if (!text && !image) details.push("text or image is required");
  if (text.length > MAX_TEXT_LENGTH) details.push("text is too long");
  if (req.body?.clientMessageId && !clientMessageId) details.push("clientMessageId is invalid");

  if (details.length) {
    return { ok: false, message: "Invalid message payload", details };
  }

  return {
    ok: true,
    value: {
      params: { id: String(req.params.id) },
      body: { text, image, ...(clientMessageId ? { clientMessageId } : {}), ...(replyTo ? { replyTo } : {}) },
    },
  };
};

export const validateEditMessage = (req) => {
  const details = [];
  const text = sanitizeText(req.body?.text || "");

  if (!isValidObjectId(req.params?.id)) details.push("id must be a valid id");
  if (!text) details.push("text is required");
  if (text.length > MAX_TEXT_LENGTH) details.push("text is too long");

  if (details.length) {
    return { ok: false, message: "Invalid edit message payload", details };
  }

  return {
    ok: true,
    value: {
      params: { id: String(req.params.id) },
      body: { text },
    },
  };
};

export const validateCreateGroup = (req) => {
  const details = [];
  const name = trimString(req.body?.name);
  const memberIds = Array.isArray(req.body?.memberIds)
    ? req.body.memberIds.map((id) => String(id))
    : [];

  if (!name) details.push("name is required");
  if (name.length > MAX_NAME_LENGTH) details.push("name is too long");
  if (memberIds.some((id) => !isValidObjectId(id))) details.push("memberIds must contain valid ids only");

  if (details.length) {
    return { ok: false, message: "Invalid group payload", details };
  }

  return {
    ok: true,
    value: {
      body: {
        name,
        memberIds,
      },
    },
  };
};

export const validateGroupMessage = (req) => {
  const details = [];
  const text = sanitizeText(req.body?.text || "");
  const image = validateImagePayload(req.body?.image || req.body?.img, "image", details);
  const clientMessageId = sanitizeClientMessageId(req.body?.clientMessageId);
  const replyTo = sanitizeReplyTo(req.body?.replyTo, details);

  if (!isValidObjectId(req.params?.groupId)) details.push("groupId must be a valid id");
  if (!text && !image) details.push("text or image is required");
  if (text.length > MAX_TEXT_LENGTH) details.push("text is too long");
  if (req.body?.clientMessageId && !clientMessageId) details.push("clientMessageId is invalid");

  if (details.length) {
    return { ok: false, message: "Invalid group message payload", details };
  }

  return {
    ok: true,
    value: {
      params: { groupId: String(req.params.groupId) },
      body: { text, image, ...(clientMessageId ? { clientMessageId } : {}), ...(replyTo ? { replyTo } : {}) },
    },
  };
};
