import axios from "axios";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "https://nyumbadirect-bjig.onrender.com")
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  // Public API hosts may need to wake from an idle period. Always fail with
  // an actionable UI state instead of leaving screens spinning forever.
  timeout: 45000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
