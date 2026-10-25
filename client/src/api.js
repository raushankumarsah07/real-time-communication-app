import axios from "axios";

const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = axios.create({ baseURL: `${apiUrl}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (err) =>
  err.response?.data?.message ||
  "Could not reach the server. Is the backend running?";

export default api;
