import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { getApiErrorMessage } from "../lib/errors.js";

const SOCKET_BASE_URL =
  (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isRequestingPasswordReset: false,
  isResettingPassword: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  socketStatus: "disconnected",
  socketError: "",
  socketRecoveryKey: 0,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to sign up"));
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to log in"));
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to log out"));
    }
  },

  forgotPassword: async (email) => {
    set({ isRequestingPasswordReset: true });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      toast.success(res.data.message || "Reset link generated");
      return res.data;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate reset link"));
      return null;
    } finally {
      set({ isRequestingPasswordReset: false });
    }
  },

  resetPassword: async (token, password) => {
    set({ isResettingPassword: true });
    try {
      const res = await axiosInstance.post(`/auth/reset-password/${token}`, { password });
      toast.success(res.data.message || "Password reset successful");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Password reset failed"));
      return false;
    } finally {
      set({ isResettingPassword: false });
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
      return true;
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(getApiErrorMessage(error, "Failed to update profile"));
      return false;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket: existingSocket } = get();
    if (!authUser) return;
    if (existingSocket?.connected) return;

    if (existingSocket) {
      existingSocket.off("onlineUsers");
      existingSocket.off("getOnlineUsers");
      existingSocket.off("connect");
      existingSocket.off("disconnect");
      existingSocket.off("connect_error");
      existingSocket.io.off("reconnect_attempt");
      existingSocket.io.off("reconnect");
      existingSocket.io.off("reconnect_error");
      existingSocket.disconnect();
    }

    const socket = io(SOCKET_BASE_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
      query: {
        userId: authUser._id,
      },
    });

    set({ socket, socketStatus: "connecting", socketError: "" });

    socket.on("connect", () => {
      set((state) => ({
        onlineUsers: Array.isArray(state.onlineUsers) ? state.onlineUsers : [],
        socketStatus: "online",
        socketError: "",
        socketRecoveryKey: state.socketRecoveryKey + 1,
      }));
    });

    socket.on("disconnect", (reason) => {
      set({
        socketStatus: reason === "io client disconnect" ? "disconnected" : "reconnecting",
      });
    });

    socket.on("connect_error", (error) => {
      set({
        socketStatus: "reconnecting",
        socketError: error?.message || "Connection error",
      });
    });

    socket.io.on("reconnect_attempt", () => {
      set({ socketStatus: "reconnecting" });
    });

    socket.io.on("reconnect", () => {
      set({
        socketStatus: "online",
        socketError: "",
      });
    });

    socket.io.on("reconnect_error", (error) => {
      set({
        socketStatus: "reconnecting",
        socketError: error?.message || "Reconnect failed",
      });
    });

    const handleOnlineUsers = (userIds) => {
      set({ onlineUsers: Array.isArray(userIds) ? userIds : [] });
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("getOnlineUsers", handleOnlineUsers);

    socket.connect();
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.off("onlineUsers");
      socket.off("getOnlineUsers");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.io.off("reconnect_error");
      socket.disconnect();
    }
    set({
      socket: null,
      onlineUsers: [],
      socketStatus: "disconnected",
      socketError: "",
    });
  },
}));
