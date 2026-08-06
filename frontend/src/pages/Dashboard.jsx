import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import StatusChip from "@/components/common/StatusChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
    FileText,
    CheckCircle2,
    XCircle,
    Wallet,
    Activity,
    ArrowRight,
    PieChart as PieIcon,
    Plus,
} from "lucide-react";
import {
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    AreaChart,
    Area,
} from "recharts";

export default function Dashboard() {
    const { currentId, current, isAll } = useCompany();
    const scopeQs = currentId ? `?company_id=${currentId}` : "";
    const { data: stats, isLoading } = useQuery({
        queryKey: ["dashboard-stats", currentId],
        queryFn: async () => (await api.get(`/dashboard/stats${scopeQs}`)).data,
        refetchInterval: 15000,
    });
    const { data: invoices } = useQuery({
        queryKey: ["dashboard-invoices", currentId],
        queryFn: async () => {
            const url = currentId
                ? `/invoices?limit=8&company_id=${currentId}`
                : "/invoices?limit=8";
            return (await api.get(url)).data;
        },
    });
    const { data: health } = useQuery({
        queryKey: ["dashboard-health"],
        queryFn: async () => (await api.get("/dashboard/health")).data,
    });

    if (isLoading) return <DashSkeleton />;

    const s = stats || {};
    const byStatus = s.by_status || {};
    const draft = byStatus.draft?.count || 0;
    const validated = byStatus.validated?.count || 0;
    const rejected = byStatus.rejected?.count || 0;
    const submitting = byStatus.submitting?.count || 0;

    return (
        <div>
            <PageHeader
                kicker={isAll ? "Overview · All clinics" : `Overview · ${current?.name || ""}`}
                title="Command center"
                subtitle={
                    isAll
                        ? "Realtime pulse across every clinic in this tenant. Switch scope from the topbar."
                        : `Scoped to ${current?.name}${current?.tin ? ` (TIN ${current.tin})` : ""}.`
                }
                actions={
                    <Button asChild data-testid="hero-new-invoice">
                        <Link to="/invoices/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New invoice
                        </Link>
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Today's invoices"
                    value={s.today_count ?? 0}
                    hint="Documents created today"
                    icon={FileText}
                />
                <StatCard
                    label="Validated"
                    value={validated}
                    hint={`${s.success_rate ?? 0}% government success`}
                    icon={CheckCircle2}
                    accent="text-success"
                />
                <StatCard
                    label="Rejected"
                    value={rejected}
                    hint="LHDN rejections"
                    icon={XCircle}
                    accent="text-destructive"
                />
                <StatCard
                    label="Total value"
                    value={fmtMoney(s.total_value)}
                    hint={`Tax collected ${fmtMoney(s.tax_collected)}`}
                    icon={Wallet}
                />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                                Trend
                            </div>
                            <div className="font-display text-lg font-semibold">
                                Invoices last 14 days
                            </div>
                        </div>
                        <PieIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="h-56 min-h-[224px]" data-testid="dashboard-trend">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={224}>
                            <AreaChart data={s.trend || []}>
                                <defs>
                                    <linearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(d) => d.slice(5)}
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fontSize: 11 }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="hsl(var(--accent))"
                                    fill="url(#fillArea)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                                Government API
                            </div>
                            <div className="font-display text-lg font-semibold">Adapter health</div>
                        </div>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                        {(health?.adapters || []).map((a, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                            >
                                <div>
                                    <div className="text-sm font-medium uppercase">
                                        {a.country} · {a.adapter}
                                    </div>
                                    <div className="font-mono text-[11px] text-muted-foreground">
                                        {a.latency_ms}ms
                                    </div>
                                </div>
                                <StatusChip status={a.healthy ? "active" : "rejected"} />
                            </div>
                        ))}
                        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                            <div className="text-sm font-medium">Server</div>
                            <StatusChip status="active" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                            <div className="text-sm font-medium">Database</div>
                            <StatusChip status="active" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <MiniStat label="Draft" value={draft} />
                <MiniStat label="Submitting" value={submitting} />
                <MiniStat label="Validated" value={validated} />
                <MiniStat label="Rejected" value={rejected} />
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="font-display text-lg font-semibold">Recent invoices</div>
                    <Button variant="ghost" asChild size="sm">
                        <Link to="/invoices" data-testid="see-all-invoices">
                            See all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-5 py-3">Number</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Date</th>
                                <th className="px-5 py-3 text-right">Total</th>
                                <th className="px-5 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(invoices || []).slice(0, 8).map((inv) => (
                                <tr
                                    key={inv.id}
                                    className="border-b border-border/50 transition-colors hover:bg-secondary/40"
                                >
                                    <td className="px-5 py-3 font-mono text-xs">
                                        <Link to={`/invoices/${inv.id}`} className="hover:underline">
                                            {inv.invoice_number}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3">
                                        {inv.customer_snapshot?.name || "—"}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-muted-foreground">
                                        {fmtDate(inv.created_at)}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono">
                                        {fmtMoney(inv.total, inv.currency)}
                                    </td>
                                    <td className="px-5 py-3">
                                        <StatusChip status={inv.status} />
                                    </td>
                                </tr>
                            ))}
                            {(invoices || []).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                                        No invoices yet. Create your first one to see it here.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
        </div>
    );
}

function DashSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
        </div>
    );
}
