import axios from "axios";

// When REACT_APP_BACKEND_URL is empty or "/", hit the same origin (production
// nginx reverse-proxies /api to the backend). Otherwise use the absolute URL.
const rawBackend = (process.env.REACT_APP_BACKEND_URL || "").trim();
const BACKEND_URL = rawBackend === "/" ? "" : rawBackend.replace(/\/+$/, "");
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    // Fail fast so a stalled network doesn't freeze the SPA
    timeout: 30_000,
});

// Attach bearer token as fallback (in case cookies are blocked cross-site)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401 so the user sees the login screen instead of infinite spinners
api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err?.response?.status === 401) {
            localStorage.removeItem("access_token");
            if (!window.location.pathname.startsWith("/login") &&
                !window.location.pathname.startsWith("/sign/")) {
                window.location.assign("/login");
            }
        }
        return Promise.reject(err);
    },
);

export function formatApiError(err) {
    const detail = err?.response?.data?.detail;
    if (detail == null) return err?.message || "Something went wrong";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail
            .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
            .join(" ");
    if (typeof detail?.msg === "string") return detail.msg;
    return String(detail);
}

export default api;
