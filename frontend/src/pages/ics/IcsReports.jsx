import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fmtDate } from "@/lib/format";
import { Search, RotateCcw, Eye, FileDown, ScrollText } from "lucide-react";

export default function IcsReports() {
    return (
        <div>
            <PageHeader
                kicker="EIS · Reports"
                title="Reports"
                subtitle="Operation logs, sales analytics and government submission reports."
            />
            <Tabs defaultValue="op-log">
                <TabsList data-testid="rep-tabs">
                    <TabsTrigger value="op-log" data-testid="tab-op-log">
                        <ScrollText className="mr-1.5 h-3.5 w-3.5" />
                        Operation Log Report
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="op-log" className="mt-6">
                    <OperationLogReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function OperationLogReport() {
    const [F, setF] = useState({
        operator: "",
        date_from: new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10),
        date_to: new Date().toISOString().slice(0, 10),
    });
    const [applied, setApplied] = useState(F);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [details, setDetails] = useState(null);
    const [selected, setSelected] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ["op-log-report"],
        queryFn: async () => (await api.get("/audit?limit=500")).data,
        refetchInterval: 15000,
    });

    const filtered = useMemo(() => {
        return (data || []).filter((l) => {
            if (applied.operator && !(l.actor_email || "").toLowerCase().includes(applied.operator.toLowerCase())) return false;
            if (applied.date_from && l.created_at < applied.date_from) return false;
            if (applied.date_to && l.created_at > applied.date_to + "T23:59:59") return false;
            return true;
        });
    }, [data, applied]);

    const exportCsv = () => {
        const cols = ["NO", "Operator", "Operation Date", "Operation Details"];
        const csv = [cols.join(",")].concat(filtered.map((r, i) => [
            i + 1, r.actor_email, r.created_at,
            `${r.action} · ${r.entity}${r.entity_id ? ` (${r.entity_id.slice(-6)})` : ""}`,
        ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `op-log-${Date.now()}.csv`; a.click();
    };

    const viewDetails = () => {
        if (!selected) return;
        const l = filtered.find((x) => x.id === selected);
        setDetails(l);
        setDetailsOpen(true);
    };

    const set = (k, v) => setF({ ...F, [k]: v });

    return (
        <div>
            <section className="rounded-xl border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <FR l="Operator">
                        <Input value={F.operator} onChange={(e) => set("operator", e.target.value)} data-testid="rep-operator" />
                    </FR>
                    <div />
                    <FR l="Operation Date from">
                        <Input type="date" value={F.date_from} onChange={(e) => set("date_from", e.target.value)} data-testid="rep-date-from" />
                    </FR>
                    <FR l="to">
                        <Input type="date" value={F.date_to} onChange={(e) => set("date_to", e.target.value)} data-testid="rep-date-to" />
                    </FR>
                </div>
            </section>

            <div className="my-3 flex items-center justify-end gap-2 rounded-md bg-accent px-3 py-2">
                <Button size="sm" variant="secondary" onClick={() => setApplied(F)} data-testid="rep-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setF({ ...F, operator: "" }); setApplied({ ...applied, operator: "" }); }}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={viewDetails} disabled={!selected} data-testid="rep-view-details">
                    <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="rep-export">
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-accent text-accent-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3"></th>
                                <Th>NO.</Th>
                                <Th>Operator</Th>
                                <Th>Operation Date</Th>
                                <Th>Operation Details</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="rep-table">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : filtered.map((r, i) => (
                                <tr key={r.id}
                                    className={`border-b border-border/50 cursor-pointer hover:bg-secondary/40 ${selected === r.id ? "bg-secondary/60" : ""}`}
                                    onClick={() => setSelected(r.id === selected ? null : r.id)}>
                                    <td className="px-3 py-2">
                                        <input type="radio" checked={selected === r.id} onChange={() => setSelected(r.id)} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">{r.actor_email || "—"}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                                    <td className="px-3 py-2 text-xs">
                                        <span className="font-mono">{r.action}</span>
                                        <span className="ml-2 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono">
                                            {r.entity}
                                        </span>
                                        {r.entity_id && (
                                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                                {r.entity_id.slice(-8)}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Operation details</DialogTitle></DialogHeader>
                    {details && (
                        <div className="space-y-2 text-sm">
                            <D l="Operator" v={details.actor_email} />
                            <D l="When" v={fmtDate(details.created_at)} mono />
                            <D l="Action" v={details.action} mono />
                            <D l="Entity" v={`${details.entity} · ${details.entity_id || "—"}`} mono />
                            <D l="IP" v={details.ip || "—"} mono />
                            <div>
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                                    Metadata
                                </div>
                                <pre className="rounded-md border border-border bg-muted/40 p-3 text-[11px] font-mono overflow-x-auto">
{JSON.stringify(details.meta || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FR({ l, children }) {
    return (
        <div className="grid grid-cols-3 items-center gap-3">
            <Label className="col-span-1 text-sm">{l}</Label>
            <div className="col-span-2">{children}</div>
        </div>
    );
}
function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</th>;
}
function D({ l, v, mono }) {
    return (
        <div className="flex items-baseline justify-between border-b border-border/40 py-1.5 last:border-0">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</span>
            <span className={mono ? "font-mono text-xs break-all" : "text-sm"}>{v}</span>
        </div>
    );
}
