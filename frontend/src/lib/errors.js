export const getApiErrorMessage = (error, fallback = "Something went wrong") => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (Array.isArray(data?.details) && data.details.length > 0) return data.details[0];
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (error?.code === "ECONNABORTED") return "The request timed out. Please try again.";
  if (error?.message === "Network Error") return "Network error. Check your connection and try again.";

  return fallback;
};
