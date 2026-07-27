import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const CompanyCtx = createContext(null);

export function CompanyProvider({ children }) {
    const [companies, setCompanies] = useState([]);
    const [current, setCurrent] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/companies");
            setCompanies(data);
            const savedId = localStorage.getItem("current_company_id");
            const found = data.find((c) => c.id === savedId) || data[0];
            setCurrent(found || null);
        } catch {
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const switchCompany = (id) => {
        const c = companies.find((x) => x.id === id);
        if (c) {
            setCurrent(c);
            localStorage.setItem("current_company_id", id);
        }
    };

    return (
        <CompanyCtx.Provider value={{ companies, current, loading, switchCompany, refresh: load }}>
            {children}
        </CompanyCtx.Provider>
    );
}

export const useCompany = () => useContext(CompanyCtx);
