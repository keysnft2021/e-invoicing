export const fmtMoney = (v, ccy = "MYR") =>
    new Intl.NumberFormat("en-MY", { style: "currency", currency: ccy }).format(v ?? 0);

export const fmtNum = (v) => new Intl.NumberFormat("en-MY").format(v ?? 0);

export const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-MY", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
};

export const fmtDay = (iso) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("en-MY", {
            year: "numeric",
            month: "short",
            day: "2-digit",
        });
    } catch {
        return iso;
    }
};
