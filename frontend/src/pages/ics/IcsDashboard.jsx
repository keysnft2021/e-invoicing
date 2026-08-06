import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import PageHeader from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import { Mail, Receipt } from "lucide-react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from "recharts";

const MONTHS = [
    { v: 0, l: "All year" },
    { v: 1, l: "January" }, { v: 2, l: "February" }, { v: 3, l: "March" },
    { v: 4, l: "April" }, { v: 5, l: "May" }, { v: 6, l: "June" },
    { v: 7, l: "July" }, { v: 8, l: "August" }, { v: 9, l: "September" },
    { v: 10, l: "October" }, { v: 11, l: "November" }, { v: 12, l: "December" },
];

const COLORS = { yearly: "#f5c518", monthly: "#a9dbe6", weekly: "#279aa9", daily: "#1f5fbb" };

export default function IcsDashboard() {
    const { currentId, current, isAll } = useCompany();
    const [month, setMonth] = useState(0);
    const [statsMode, setStatsMode] = useState("Receipts/Invoices Issued");
    const { data, isLoading } = useQuery({
        queryKey: ["ics-summary", month, currentId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (month) params.set("month", month);
            if (currentId) params.set("company_id", currentId);
            const qs = params.toString();
            return (await api.get(`/ics/summary${qs ? `?${qs}` : ""}`)).data;
        },
        refetchInterval: 15000,
    });

    if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

    const s = data.sales_invoices;
    const stat = data.statistics_type;
    const pie = [
        { name: "Yearly", value: stat.yearly, key: "yearly" },
        { name: "Monthly", value: stat.monthly, key: "monthly" },
        { name: "Weekly", value: stat.weekly, key: "weekly" },
        { name: "Daily", value: stat.daily, key: "daily" },
    ].filter((p) => p.value > 0);

    return (
        <div>
            <PageHeader
                kicker={isAll ? "ICS · Integration Console · All clinics" : `ICS · ${current?.name || ""}`}
                title="Sales Invoices"
                subtitle={
                    isAll
                        ? "LHDN MyInvois-style overview of your document flow across every clinic."
                        : `LHDN MyInvois-style overview scoped to ${current?.name}.`
                }
            />

            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Messages:</span>
                <span>—</span>
            </div>

            {/* Sales Invoices card */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div className="font-display text-lg font-semibold">Sales Invoices</div>
                    <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                        <SelectTrigger className="w-40" data-testid="ics-month-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((m) => (
                                <SelectItem key={m.v} value={String(m.v)}>{m.l}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <MetricBig
                        icon={Receipt}
                        color="orange"
                        value={s.total_invoice_quantity}
                        label="Total Invoice Quantity"
                    />
                    <MetricBig
                        icon={Receipt}
                        color="red"
                        value={fmtMoney(s.total_invoice_amount)}
                        label="Total Invoice Amount"
                    />
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border pt-6">
                    <MetricSmall v={s.awaiting} l="Awaiting" testid="ics-awaiting" />
                    <MetricSmall v={s.accepted} l="Accepted" testid="ics-accepted" />
                    <MetricSmall v={s.rejected} l="Rejected" testid="ics-rejected" />
                </div>
            </div>

            {/* Statistics Type */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div className="font-display text-lg font-semibold">Statistics Type</div>
                    <Select value={statsMode} onValueChange={setStatsMode}>
                        <SelectTrigger className="w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Receipts/Invoices Issued">
                                Receipts/Invoices Issued
                            </SelectItem>
                            <SelectItem value="Receipts/Invoices Received">
                                Receipts/Invoices Received
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                    <div className="space-y-2 text-sm">
                        {pie.length > 0 ? pie.map((p) => (
                            <div key={p.key} className="flex items-center gap-3">
                                <span
                                    className="inline-block h-3 w-3 rounded"
                                    style={{ background: COLORS[p.key] }}
                                />
                                <span className="w-20 text-muted-foreground">{p.name}</span>
                                <span className="font-mono">{p.value}</span>
                            </div>
                        )) : (
                            <div className="text-sm text-muted-foreground">No data for this window.</div>
                        )}
                    </div>
                    <div className="h-64">
                        {pie.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pie}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={2}
                                    >
                                        {pie.map((p, i) => (
                                            <Cell key={i} fill={COLORS[p.key]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: "hsl(var(--popover))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricBig({ icon: Icon, color, value, label }) {
    const bg = color === "orange" ? "bg-orange-500/15 text-orange-500"
             : color === "red" ? "bg-rose-500/15 text-rose-500"
             : "bg-accent/15 text-accent";
    return (
        <div className="flex items-center gap-5">
            <div className={`rounded-lg p-4 ${bg}`}>
                <Icon className="h-7 w-7" />
            </div>
            <div>
                <div className="font-display text-4xl font-semibold text-accent">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
            </div>
        </div>
    );
}

function MetricSmall({ v, l, testid }) {
    return (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center" data-testid={testid}>
            <div className="font-display text-3xl font-semibold text-accent">{v}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
        </div>
    );
}
