import axios from "axios";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const axiosInstance = axios.create({
  baseURL: apiBaseUrl ? `${apiBaseUrl}/api` : "/api",
  withCredentials: true,
  timeout: 15000,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error?.response && !error?.message) {
      error.message = "Unexpected network error";
    }

    return Promise.reject(error);
  }
);
