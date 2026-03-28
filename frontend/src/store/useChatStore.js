import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { getApiErrorMessage } from "../lib/errors";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PENDING_RETRY_DISPLAY = 99;
const retryOnReconnectListenerKey = "__baatChitRetryListenerAttached";

const createClientMessageId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeMessage = (message) => ({
  ...message,
  senderId:
    typeof message?.senderId === "object" && message?.senderId?._id
      ? message.senderId._id
      : message?.senderId,
  receiverId:
    typeof message?.receiverId === "object" && message?.receiverId?._id
      ? message.receiverId._id
      : message?.receiverId,
  groupId:
    typeof message?.groupId === "object" && message?.groupId?._id
      ? message.groupId._id
      : message?.groupId,
  clientMessageId: message?.clientMessageId || null,
  deliveryStatus: message?.deliveryStatus || "sent",
  _retryCount: message?._retryCount || 0,
  _isOptimistic: Boolean(message?._isOptimistic),
});

const sortMessagesByTime = (messages) =>
  [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const getMessageIdentity = (message) => message?.clientMessageId || message?._id || null;

const isTemporaryMessage = (message) => String(message?._id || "").startsWith("temp:");

const preferMessage = (current, incoming) => {
  if (!current) return incoming;

  const currentIsTemporary = isTemporaryMessage(current);
  const incomingIsTemporary = isTemporaryMessage(incoming);

  if (currentIsTemporary && !incomingIsTemporary) {
    return {
      ...current,
      ...incoming,
      deliveryStatus: incoming.deliveryStatus || "sent",
      _isOptimistic: false,
    };
  }

  if (!currentIsTemporary && incomingIsTemporary) {
    return current;
  }

  return {
    ...current,
    ...incoming,
    deliveryStatus: incoming.deliveryStatus || current.deliveryStatus || "sent",
    _retryCount: incoming._retryCount ?? current._retryCount ?? 0,
    _isOptimistic: incoming._isOptimistic ?? current._isOptimistic ?? false,
  };
};

const mergeMessages = (currentMessages, incomingMessages, mode = "append") => {
  const existing = currentMessages.map(normalizeMessage);
  const incoming = incomingMessages.map(normalizeMessage);
  const source =
    mode === "prepend" ? [...incoming, ...existing] : [...existing, ...incoming];
  const dedupedById = new Map();

  for (const message of source) {
    const identity = getMessageIdentity(message);
    if (!identity) continue;
    dedupedById.set(identity, preferMessage(dedupedById.get(identity), message));
  }

  return sortMessagesByTime(Array.from(dedupedById.values()));
};

const emptyPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  skip: 0,
  hasMore: false,
  nextSkip: null,
};

const isRetryableSendError = (error) => {
  const status = error?.response?.status;
  return !status || status >= 500 || status === 408 || status === 429;
};

const getChatPreview = (message) =>
  message?.text?.trim() ? message.text : message?.image ? "Image" : "";

const matchesDirectChat = (entry, userId) => entry.chatType === "direct" && entry.receiverId === userId;
const matchesGroupChat = (entry, groupId) => entry.chatType === "group" && entry.groupId === groupId;

const getPendingMessagesForSelection = (pendingOutgoingMessages, selectedUser, selectedGroup) => {
  const pendingEntries = Object.values(pendingOutgoingMessages || {});

  if (selectedGroup?._id) {
    return pendingEntries
      .filter((entry) => matchesGroupChat(entry, selectedGroup._id))
      .map((entry) => entry.optimisticMessage);
  }

  if (selectedUser?._id) {
    return pendingEntries
      .filter((entry) => matchesDirectChat(entry, selectedUser._id))
      .map((entry) => entry.optimisticMessage);
  }

  return [];
};

const buildOptimisticMessage = ({ authUser, selectedUser, selectedGroup, text, image, clientMessageId }) => ({
  _id: `temp:${clientMessageId}`,
  clientMessageId,
  senderId: authUser?._id,
  receiverId: selectedUser?._id || null,
  groupId: selectedGroup?._id || null,
  chatType: selectedGroup?._id ? "group" : "direct",
  text,
  image: image || "",
  seen: false,
  isEdited: false,
  isDeleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deliveryStatus: "sending",
  _retryCount: 0,
  _isOptimistic: true,
});

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [],
  selectedUser: null,
  selectedGroup: null,
  isUsersLoading: false,
  isGroupsLoading: false,
  isCreatingGroup: false,
  isMessagesLoading: false,
  isFetchingOlderMessages: false,
  isSendingMessage: false,
  isSearchingMessages: false,
  messagePagination: emptyPagination,
  typingIndicator: null,
  searchResults: [],
  pendingOutgoingMessages: {},

  getUsers: async (silent = false) => {
    if (!silent) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load contacts"));
    } finally {
      if (!silent) set({ isUsersLoading: false });
    }
  },
  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load groups"));
    } finally {
      set({ isGroupsLoading: false });
    }
  },
  refreshGroups: async (silent = false) => {
    if (!silent) set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load groups"));
    } finally {
      if (!silent) set({ isGroupsLoading: false });
    }
  },
  createGroup: async ({ name, memberIds }) => {
    set({ isCreatingGroup: true });
    try {
      const res = await axiosInstance.post("/groups", { name, memberIds });
      set((state) => ({ groups: [res.data, ...state.groups] }));
      toast.success(`Group "${res.data.name}" created`);
      return res.data;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create group"));
      return null;
    } finally {
      set({ isCreatingGroup: false });
    }
  },
  removeGroupMember: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`);
      const updatedGroup = res.data.group;
      set((state) => ({
        groups: state.groups.map((group) =>
          group._id === groupId ? updatedGroup : group
        ),
        selectedGroup:
          state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup,
      }));
      toast.success(res.data.message || "Member removed");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove member"));
      return false;
    }
  },
  leaveGroup: async (groupId) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/leave`);
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup:
          state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        messages: state.selectedGroup?._id === groupId ? [] : state.messages,
        messagePagination:
          state.selectedGroup?._id === groupId ? emptyPagination : state.messagePagination,
        searchResults:
          state.selectedGroup?._id === groupId ? [] : state.searchResults,
      }));
      toast.success(res.data.message || "Left group successfully");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to leave group"));
      return false;
    }
  },
  deleteGroup: async (groupId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}`);
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup:
          state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        messages: state.selectedGroup?._id === groupId ? [] : state.messages,
        messagePagination:
          state.selectedGroup?._id === groupId ? emptyPagination : state.messagePagination,
        searchResults:
          state.selectedGroup?._id === groupId ? [] : state.searchResults,
      }));
      toast.success(res.data.message || "Group deleted successfully");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete group"));
      return false;
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true, messagePagination: emptyPagination });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`, {
        params: {
          paginated: true,
          limit: DEFAULT_PAGE_LIMIT,
          skip: 0,
        },
      });
      set((state) => ({
        messages: mergeMessages(
          getPendingMessagesForSelection(state.pendingOutgoingMessages, { _id: userId }, null),
          res.data.items || [],
          "append"
        ),
        messagePagination: res.data.pagination || emptyPagination,
        users: state.users.map((user) =>
          user._id === userId ? { ...user, unreadCount: 0 } : user
        ),
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load messages"));
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true, messagePagination: emptyPagination });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`, {
        params: {
          paginated: true,
          limit: DEFAULT_PAGE_LIMIT,
          skip: 0,
        },
      });
      set((state) => ({
        messages: mergeMessages(
          getPendingMessagesForSelection(state.pendingOutgoingMessages, null, { _id: groupId }),
          res.data.items || [],
          "append"
        ),
        messagePagination: res.data.pagination || emptyPagination,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load group messages"));
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  loadOlderMessages: async () => {
    const {
      selectedUser,
      selectedGroup,
      isMessagesLoading,
      isFetchingOlderMessages,
      messagePagination,
    } = get();

    if (isMessagesLoading || isFetchingOlderMessages || !messagePagination?.hasMore) {
      return false;
    }

    const chatPath = selectedGroup?._id
      ? `/groups/${selectedGroup._id}/messages`
      : selectedUser?._id
        ? `/messages/${selectedUser._id}`
        : null;

    if (!chatPath) return false;

    set({ isFetchingOlderMessages: true });

    try {
      const res = await axiosInstance.get(chatPath, {
        params: {
          paginated: true,
          limit: messagePagination.limit || DEFAULT_PAGE_LIMIT,
          skip: messagePagination.nextSkip || 0,
        },
      });

      set((state) => ({
        messages: mergeMessages(state.messages, res.data.items || [], "prepend"),
        messagePagination: res.data.pagination || state.messagePagination,
      }));

      return (res.data.items || []).length > 0;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load older messages"));
      return false;
    } finally {
      set({ isFetchingOlderMessages: false });
    }
  },
  markMessagesAsSeen: async (userId) => {
    try {
      await axiosInstance.put(`/messages/seen/${userId}`);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.senderId === userId ? { ...msg, seen: true } : msg
        ),
        users: state.users.map((user) =>
          user._id === userId ? { ...user, unreadCount: 0 } : user
        ),
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to mark messages as seen"));
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, selectedGroup } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser || (!selectedUser && !selectedGroup)) return null;

    const text = messageData.text?.trim() || "";
    const image = messageData.image || messageData.img || "";
    const clientMessageId = createClientMessageId();
    const optimisticMessage = buildOptimisticMessage({
      authUser,
      selectedUser,
      selectedGroup,
      text,
      image,
      clientMessageId,
    });
    const queueEntry = {
      clientMessageId,
      chatType: selectedGroup?._id ? "group" : "direct",
      receiverId: selectedUser?._id || null,
      groupId: selectedGroup?._id || null,
      path: selectedGroup
        ? `/groups/${selectedGroup._id}/messages`
        : `/messages/send/${selectedUser._id}`,
      payload: {
        ...messageData,
        text,
        image,
        clientMessageId,
      },
      optimisticMessage,
      attempts: 0,
      status: "queued",
    };

    set((state) => ({
      messages: mergeMessages(state.messages, [optimisticMessage], "append"),
      pendingOutgoingMessages: {
        ...state.pendingOutgoingMessages,
        [clientMessageId]: queueEntry,
      },
      users: selectedUser
        ? state.users.map((user) =>
            user._id === selectedUser._id
              ? {
                  ...user,
                  lastMessage: getChatPreview(optimisticMessage),
                  lastMessageAt: optimisticMessage.createdAt,
                }
              : user
          )
        : state.users,
    }));

    set({ isSendingMessage: true });
    try {
      const result = await get().retryPendingMessage(clientMessageId, { showQueuedToast: true });
      return result || optimisticMessage;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to send message"));
      return optimisticMessage;
    } finally {
      set({ isSendingMessage: false });
    }
  },
  retryPendingMessage: async (clientMessageId, { showQueuedToast = false } = {}) => {
    const pendingEntry = get().pendingOutgoingMessages?.[clientMessageId];
    if (!pendingEntry || pendingEntry.status === "sending") {
      return null;
    }

    const nextAttempt = pendingEntry.attempts + 1;

    set((state) => ({
      pendingOutgoingMessages: {
        ...state.pendingOutgoingMessages,
        [clientMessageId]: {
          ...state.pendingOutgoingMessages[clientMessageId],
          status: "sending",
          attempts: nextAttempt,
        },
      },
      messages: state.messages.map((message) =>
        message.clientMessageId === clientMessageId
          ? {
              ...message,
              deliveryStatus: "sending",
              _retryCount: Math.min(nextAttempt, MAX_PENDING_RETRY_DISPLAY),
            }
          : message
      ),
    }));

    try {
      const res = await axiosInstance.post(pendingEntry.path, pendingEntry.payload);
      const acknowledgedMessage = {
        ...normalizeMessage(res.data),
        deliveryStatus: "sent",
        _retryCount: Math.max(nextAttempt - 1, 0),
        _isOptimistic: false,
      };

      set((state) => {
        const nextPending = { ...state.pendingOutgoingMessages };
        delete nextPending[clientMessageId];

        return {
          pendingOutgoingMessages: nextPending,
          messages: mergeMessages(state.messages, [acknowledgedMessage], "append"),
          users: pendingEntry.receiverId
            ? state.users.map((user) =>
                user._id === pendingEntry.receiverId
                  ? {
                      ...user,
                      lastMessage: getChatPreview(acknowledgedMessage),
                      lastMessageAt: acknowledgedMessage.createdAt,
                    }
                  : user
              )
            : state.users,
        };
      });

      return acknowledgedMessage;
    } catch (error) {
      const isRetryable = isRetryableSendError(error);
      const nextStatus = isRetryable ? "queued" : "failed";

      set((state) => ({
        pendingOutgoingMessages: {
          ...state.pendingOutgoingMessages,
          [clientMessageId]: {
            ...state.pendingOutgoingMessages[clientMessageId],
            status: nextStatus,
            lastError: getApiErrorMessage(error, "Failed to send message"),
          },
        },
        messages: state.messages.map((message) =>
          message.clientMessageId === clientMessageId
            ? {
                ...message,
                deliveryStatus: nextStatus,
                _retryCount: Math.min(nextAttempt, MAX_PENDING_RETRY_DISPLAY),
              }
            : message
        ),
      }));

      if (showQueuedToast) {
        toast.error(
          isRetryable
            ? "Message queued. It will retry when the connection comes back."
            : getApiErrorMessage(error, "Failed to send message")
        );
      }

      return null;
    }
  },
  retryPendingMessages: async () => {
    const pendingIds = Object.entries(get().pendingOutgoingMessages || {})
      .filter(([, entry]) => entry?.status === "queued")
      .map(([clientMessageId]) => clientMessageId);

    for (const clientMessageId of pendingIds) {
      await get().retryPendingMessage(clientMessageId);
    }
  },
  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text });
      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === messageId ? res.data : message
        ),
      }));
      get().getUsers(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to edit message"));
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === messageId ? res.data : message
        ),
      }));
      get().getUsers(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete message"));
    }
  },
  clearActiveChat: async () => {
    const { selectedUser, selectedGroup } = get();
    if (!selectedUser && !selectedGroup) return;

    try {
      if (selectedGroup?._id) {
        const res = await axiosInstance.delete(`/groups/${selectedGroup._id}/messages`);
        set({ messages: [], messagePagination: emptyPagination });
        toast.success(res.data?.message || "Group chat cleared");
      } else if (selectedUser?._id) {
        const res = await axiosInstance.delete(`/messages/chat/${selectedUser._id}`);
        set({ messages: [], messagePagination: emptyPagination });
        toast.success(res.data?.message || "Chat cleared");
      }

      get().getUsers(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to clear chat"));
    }
  },
  searchMessages: async ({ query, mode = "all" }) => {
    const { selectedUser, selectedGroup } = get();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      set({ searchResults: [], isSearchingMessages: false });
      return [];
    }

    const path = selectedGroup?._id
      ? `/groups/${selectedGroup._id}/search`
      : selectedUser?._id
        ? `/messages/search/${selectedUser._id}`
        : null;

    if (!path) return [];

    set({ isSearchingMessages: true });
    try {
      const res = await axiosInstance.get(path, {
        params: {
          q: trimmedQuery,
          mode,
          limit: 20,
        },
      });
      set({ searchResults: res.data || [] });
      return res.data || [];
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to search messages"));
      set({ searchResults: [] });
      return [];
    } finally {
      set({ isSearchingMessages: false });
    }
  },
  clearSearchResults: () => set({ searchResults: [], isSearchingMessages: false }),

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("chatCleared");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("groupUpdated");
    socket.off("groupRemoved");
    socket.off("groupDeleted");
    socket.on("newMessage", (newMessage) => {
      const selectedUser = get().selectedUser;
      const isFromOpenedChat = selectedUser?._id === newMessage.senderId;

      set((state) => ({
        messages: isFromOpenedChat
          ? mergeMessages(state.messages, [newMessage], "append")
          : state.messages,
        typingIndicator:
          state.typingIndicator?.chatType === "direct" &&
          state.typingIndicator?.senderId === newMessage.senderId
            ? null
            : state.typingIndicator,
        users: state.users.map((user) => {
          if (user._id !== newMessage.senderId) return user;

          return {
            ...user,
            lastMessage: newMessage.text?.trim()
              ? newMessage.text
              : newMessage.image
                ? "Image"
                : "",
            lastMessageAt: newMessage.createdAt,
            unreadCount: isFromOpenedChat ? 0 : (user.unreadCount || 0) + 1,
          };
        }),
      }));

      if (isFromOpenedChat) {
        get().markMessagesAsSeen(newMessage.senderId);
      }
    });

    socket.on("newGroupMessage", (newMessage) => {
      const { selectedGroup, groups } = get();
      const isFromOpenedGroup = selectedGroup?._id === newMessage.groupId;
      const group = groups.find((g) => g._id === newMessage.groupId);

      if (isFromOpenedGroup) {
        set((state) => ({
          messages: mergeMessages(state.messages, [newMessage], "append"),
          typingIndicator:
            state.typingIndicator?.chatType === "group" &&
            state.typingIndicator?.senderId === newMessage.senderId
              ? null
              : state.typingIndicator,
        }));
      } else {
        toast.success(`New message in ${group?.name || "group"}`);
      }
    });

    socket.on("messageUpdated", (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === updatedMessage._id ? updatedMessage : message
        ),
      }));
      get().getUsers(true);
    });

    socket.on("messageDeleted", (deletedMessage) => {
      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === deletedMessage._id ? deletedMessage : message
        ),
      }));
      get().getUsers(true);
    });

    socket.on("chatCleared", (payload) => {
      const { selectedUser, selectedGroup } = get();
      const isOpenedDirectChat =
        payload?.chatType === "direct" &&
        selectedUser?._id &&
        [payload.userA, payload.userB].includes(selectedUser._id);
      const isOpenedGroupChat =
        payload?.chatType === "group" &&
        selectedGroup?._id &&
        payload.groupId === selectedGroup._id;

      if (isOpenedDirectChat || isOpenedGroupChat) {
        set({
          messages: [],
          typingIndicator: null,
          messagePagination: emptyPagination,
          searchResults: [],
        });
      }
      get().getUsers(true);
    });

    socket.on("typing", (payload) => {
      const { selectedUser, selectedGroup } = get();
      const isOpenedDirectChat =
        payload?.chatType === "direct" && selectedUser?._id === payload?.senderId;
      const isOpenedGroupChat =
        payload?.chatType === "group" && selectedGroup?._id === payload?.groupId;

      if (isOpenedDirectChat || isOpenedGroupChat) {
        set({
          typingIndicator: {
            chatType: payload.chatType,
            senderId: payload.senderId,
            senderName: payload.senderName || "Someone",
            groupId: payload.groupId || null,
          },
        });
      }
    });

    socket.on("stopTyping", (payload) => {
      set((state) => {
        const sameSender = state.typingIndicator?.senderId === payload?.senderId;
        const sameDirect = payload?.chatType === "direct" && state.typingIndicator?.chatType === "direct";
        const sameGroup =
          payload?.chatType === "group" &&
          state.typingIndicator?.chatType === "group" &&
          state.typingIndicator?.groupId === payload?.groupId;

        if (sameSender && (sameDirect || sameGroup)) {
          return { typingIndicator: null };
        }
        return state;
      });
    });

    socket.on("groupUpdated", (updatedGroup) => {
      set((state) => ({
        groups: state.groups.map((group) =>
          group._id === updatedGroup._id ? updatedGroup : group
        ),
        selectedGroup:
          state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
    });

    socket.on("groupRemoved", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        messages: state.selectedGroup?._id === groupId ? [] : state.messages,
        messagePagination:
          state.selectedGroup?._id === groupId ? emptyPagination : state.messagePagination,
        searchResults:
          state.selectedGroup?._id === groupId ? [] : state.searchResults,
      }));
      toast("You were removed from a group");
    });

    socket.on("groupDeleted", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        messages: state.selectedGroup?._id === groupId ? [] : state.messages,
        messagePagination:
          state.selectedGroup?._id === groupId ? emptyPagination : state.messagePagination,
        searchResults:
          state.selectedGroup?._id === groupId ? [] : state.searchResults,
      }));
      toast("A group was deleted");
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("chatCleared");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("groupUpdated");
    socket.off("groupRemoved");
    socket.off("groupDeleted");
  },

  setSelectedUser: (selectedUser) =>
    set({
      selectedUser,
      selectedGroup: null,
      typingIndicator: null,
      messages: [],
      messagePagination: emptyPagination,
      searchResults: [],
    }),
  setSelectedGroup: (selectedGroup) =>
    set({
      selectedGroup,
      selectedUser: null,
      typingIndicator: null,
      messages: [],
      messagePagination: emptyPagination,
      searchResults: [],
    }),
}));

if (typeof window !== "undefined" && !window[retryOnReconnectListenerKey]) {
  window.addEventListener("online", () => {
    void useChatStore.getState().retryPendingMessages();
  });
  window[retryOnReconnectListenerKey] = true;
}
