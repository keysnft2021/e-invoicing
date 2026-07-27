import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking
    const [ready, setReady] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch {
            setUser(false);
        } finally {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        if (data.token) localStorage.setItem("access_token", data.token);
        setUser(data.user);
        return data.user;
    };
    const register = async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        if (data.token) localStorage.setItem("access_token", data.token);
        setUser(data.user);
        return data.user;
    };
    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            /* ignore */
        }
        localStorage.removeItem("access_token");
        setUser(false);
    };

    return (
        <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh: load }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);
