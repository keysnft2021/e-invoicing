import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const CompanyCtx = createContext(null);

// Special sentinel value for "All clinics" — sent as no company_id filter.
export const ALL_COMPANIES = "__all__";

export function CompanyProvider({ children }) {
    const [companies, setCompanies] = useState([]);
    const [current, setCurrent] = useState(null); // null → All clinics
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/companies");
            setCompanies(data);
            const savedId = localStorage.getItem("current_company_id");
            if (savedId === ALL_COMPANIES) {
                setCurrent(null);
            } else if (savedId) {
                const found = data.find((c) => c.id === savedId);
                setCurrent(found || null);
            } else {
                // Default to "All clinics" so chain tenants see the full picture.
                setCurrent(null);
            }
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
        if (!id || id === ALL_COMPANIES) {
            setCurrent(null);
            localStorage.setItem("current_company_id", ALL_COMPANIES);
            return;
        }
        const c = companies.find((x) => x.id === id);
        if (c) {
            setCurrent(c);
            localStorage.setItem("current_company_id", id);
        }
    };

    return (
        <CompanyCtx.Provider
            value={{
                companies,
                current,                     // null when All clinics
                currentId: current?.id || null,
                loading,
                switchCompany,
                refresh: load,
                isAll: current === null,
            }}
        >
            {children}
        </CompanyCtx.Provider>
    );
}

export const useCompany = () => useContext(CompanyCtx);
