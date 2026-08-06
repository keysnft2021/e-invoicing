import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fmtMoney, fmtDay } from "@/lib/format";
import { FileText, Plus, Search } from "lucide-react";

const STATUSES = [
    { v: "all", l: "All statuses" },
    { v: "draft", l: "Draft" },
    { v: "submitting", l: "Submitting" },
    { v: "validated", l: "Validated" },
    { v: "rejected", l: "Rejected" },
    { v: "cancelled", l: "Cancelled" },
];

export default function Invoices() {
    const [status, setStatus] = useState("all");
    const [q, setQ] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["invoices", status],
        queryFn: async () => {
            const url = status === "all" ? "/invoices" : `/invoices?status=${status}`;
            return (await api.get(url)).data;
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const filtered = useMemo(() => {
        if (!data) return [];
        if (!q) return data;
        const lq = q.toLowerCase();
        return data.filter(
            (i) =>
                i.invoice_number?.toLowerCase().includes(lq) ||
                i.customer_snapshot?.name?.toLowerCase().includes(lq),
        );
    }, [data, q]);

    return (
        <div>
            <PageHeader
                kicker="Documents"
                title="Invoices"
                subtitle="Create, submit and track your e-invoices through the LHDN MyInvois lifecycle."
                actions={
                    <Button asChild data-testid="new-invoice-btn">
                        <Link to="/invoices/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New invoice
                        </Link>
                    </Button>
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        data-testid="invoice-search"
                        placeholder="Search invoice # or customer…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger data-testid="invoice-status-filter" className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUSES.map((s) => (
                            <SelectItem key={s.v} value={s.v}>
                                {s.l}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No invoices found"
                    description="Adjust filters or create your first invoice."
                    action={
                        <Button asChild>
                            <Link to="/invoices/new">
                                <Plus className="mr-2 h-4 w-4" /> New invoice
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-4 py-3">Number</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 font-mono">Gov UUID</th>
                            </tr>
                        </thead>
                        <tbody data-testid="invoices-table">
                            {filtered.map((inv) => (
                                <tr
                                    key={inv.id}
                                    className="border-b border-border/50 transition-colors hover:bg-secondary/40"
                                    data-testid={`invoice-row-${inv.id}`}
                                >
                                    <td className="px-4 py-3 font-mono text-xs">
                                        <Link
                                            to={`/invoices/${inv.id}`}
                                            className="hover:underline"
                                        >
                                            {inv.invoice_number}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{inv.customer_snapshot?.name}</div>
                                        <div className="font-mono text-[10px] text-muted-foreground">
                                            {inv.customer_snapshot?.tin}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {fmtDay(inv.invoice_date || inv.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {fmtMoney(inv.total, inv.currency)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusChip status={inv.status} />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                        {inv.government?.uuid || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
