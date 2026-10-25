import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((request) => {
  const token = localStorage.getItem("namsamart-token");
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || (error.code === "ERR_NETWORK" ? "Unable to reach the server. Check your connection and try again." : fallback);
  }
  return fallback;
}

export function departmentLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatBytes(bytes: number) {
  if (!bytes) return "Reference link";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
