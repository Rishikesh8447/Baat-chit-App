import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

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

  getUsers: async (silent = false) => {
    if (!silent) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
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
      toast.error(error?.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
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
      toast.error(error?.response?.data?.message || "Failed to create group");
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
      toast.error(error?.response?.data?.message || "Failed to remove member");
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
      }));
      toast.success(res.data.message || "Left group successfully");
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to leave group");
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
      }));
      toast.success(res.data.message || "Group deleted successfully");
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete group");
      return false;
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set((state) => ({
        messages: res.data,
        users: state.users.map((user) =>
          user._id === userId ? { ...user, unreadCount: 0 } : user
        ),
      }));
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load group messages");
    } finally {
      set({ isMessagesLoading: false });
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
      toast.error(error?.response?.data?.message || "Failed to mark messages as seen");
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, selectedGroup, messages } = get();
    try {
      const res = selectedGroup
        ? await axiosInstance.post(`/groups/${selectedGroup._id}/messages`, messageData)
        : await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);

      set((state) => ({
        messages: [...messages, res.data],
        users: selectedUser
          ? state.users.map((user) =>
              user._id === selectedUser._id
                ? {
                    ...user,
                    lastMessage: res.data.text?.trim()
                      ? res.data.text
                      : res.data.image
                        ? "Image"
                        : "",
                    lastMessageAt: res.data.createdAt,
                  }
                : user
            )
          : state.users,
      }));
    } catch (error) {
      toast.error(error.response.data.message);
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
      toast.error(error?.response?.data?.message || "Failed to edit message");
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
      toast.error(error?.response?.data?.message || "Failed to delete message");
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("groupUpdated");
    socket.off("groupRemoved");
    socket.off("groupDeleted");
    socket.on("newMessage", (newMessage) => {
      const selectedUser = get().selectedUser;
      const isFromOpenedChat = selectedUser?._id === newMessage.senderId;

      set((state) => ({
        messages: isFromOpenedChat ? [...state.messages, newMessage] : state.messages,
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
          messages: [...state.messages, newMessage],
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
      }));
      toast("You were removed from a group");
    });

    socket.on("groupDeleted", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        messages: state.selectedGroup?._id === groupId ? [] : state.messages,
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
    socket.off("groupUpdated");
    socket.off("groupRemoved");
    socket.off("groupDeleted");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, selectedGroup: null }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup, selectedUser: null }),
}));
