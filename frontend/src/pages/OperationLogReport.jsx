import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Search, RotateCcw, Eye, FileDown, X } from "lucide-react";

function fmtDT(d) { return d ? String(d).slice(0, 19).replace("T", " ") : "—"; }

function describe(action) {
    const m = {
        "auth.login": "User login success.",
        "auth.logout": "User logout success.",
        "invoice.create": "Invoice created.",
        "invoice.submit": "Invoice submitted to LHDN.",
        "invoice.cancel": "Invoice cancelled.",
        "invoice.validate": "Invoice validated by LHDN.",
        "api_client.register": "API client registered.",
        "api_client.activate": "API client activated.",
        "api_client.rate_limit": "Rate limit updated.",
        "api_client.revoke": "API client revoked.",
    };
    return m[action] || action.replace(/[._]/g, " ") + " performed.";
}

export default function OperationLogReport() {
    const [expanded, setExpanded] = useState(false);
    const [f, setF] = useState({
        actor: "",
        from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
    });
    const [applied, setApplied] = useState(f);
    const [selectedId, setSelectedId] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["op-log"],
        queryFn: async () => (await api.get(`/audit?limit=500`)).data,
    });

    const rows = (data || []).filter((r) => {
        if (applied.from && r.created_at < applied.from) return false;
        if (applied.to && r.created_at > applied.to + "T23:59:59") return false;
        if (applied.actor && !(r.actor_email || "").toLowerCase().includes(applied.actor.toLowerCase())) return false;
        return true;
    });

    const selected = rows.find((r) => r.id === selectedId) || null;

    const exportCsv = () => {
        const cols = ["NO.", "Operator", "Operation Date", "Operation Details"];
        const csv = [cols.join(",")].concat(
            rows.map((r, i) => [
                i + 1, r.actor_email || "system", fmtDT(r.created_at), describe(r.action),
            ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")),
        ).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `operation-log-${Date.now()}.csv`;
        a.click();
    };

    return (
        <div>
            <PageHeader kicker="" title="Operation Log Report" subtitle="" />

            <section className="mb-4 rounded-md border border-border bg-card">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    data-testid="op-expand">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Expand
                </button>
                {expanded && (
                    <>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-6 md:grid-cols-2">
                            <Row l="Operator">
                                <Input value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })}
                                       data-testid="op-filter-actor" />
                            </Row>
                            <div />
                            <Row l="Operation Date from">
                                <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                            </Row>
                            <Row l="to">
                                <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                            </Row>
                        </div>
                        <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                            <Button variant="secondary" size="sm" onClick={() => setApplied(f)} data-testid="op-search">
                                <Search className="mr-2 h-3.5 w-3.5" /> Search
                            </Button>
                            <Button variant="secondary" size="sm"
                                    onClick={() => { const e = { actor: "", from: "", to: "" }; setF(e); setApplied(e); }}>
                                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                            </Button>
                        </div>
                    </>
                )}
            </section>

            <div className="mb-3 flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!selected}
                        onClick={() => setDetailOpen(true)} data-testid="op-view-details">
                    <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="op-export">
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
            </div>

            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3" />
                                <Th>NO.</Th>
                                <Th>Operator</Th>
                                <Th>Operation Date</Th>
                                <Th>Operation Details</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="op-log-table">
                            {rows.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id} className={`cursor-pointer border-b border-border/50 hover:bg-secondary/40 ${selectedId === r.id ? "bg-primary/5" : ""}`}
                                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                                    data-testid={`op-row-${r.id}`}>
                                    <td className="px-3 py-2">
                                        <input type="radio" checked={selectedId === r.id} onChange={() => setSelectedId(r.id)} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">{r.actor_email || "system"}</td>
                                    <td className="px-3 py-2 text-xs">{fmtDT(r.created_at)}</td>
                                    <td className="px-3 py-2">{describe(r.action)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {rows.length > 0 && (
                <div className="mt-3 flex items-center justify-end gap-3 text-xs text-muted-foreground">
                    1-{rows.length} of {rows.length} items
                </div>
            )}

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl p-0">
                    <div className="border-b border-border px-6 pt-5 pb-3">
                        <DialogHeader>
                            <DialogTitle>
                                <span className="text-muted-foreground font-normal">Operation Log Report</span>
                                <span className="mx-2 text-muted-foreground">/</span>
                                View Details
                            </DialogTitle>
                            <DialogDescription>Detailed view of the selected audit event.</DialogDescription>
                        </DialogHeader>
                    </div>
                    {selected && (
                        <div className="space-y-4 px-6 pb-4">
                            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[200px_1fr]">
                                <Label className="pt-2">Operated Account</Label>
                                <Input value={selected.actor_email || "system"} disabled data-testid="op-detail-account" />
                            </div>
                            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[200px_1fr]">
                                <Label className="pt-2">Operation Details</Label>
                                <Textarea rows={8}
                                          value={`${describe(selected.action)}\n\nAction: ${selected.action}\nEntity: ${selected.entity}\nEntity ID: ${selected.entity_id || "—"}\nIP: ${selected.ip || "—"}\n\nMeta: ${JSON.stringify(selected.meta || {}, null, 2)}`}
                                          disabled data-testid="op-detail-body" />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-center border-t border-border bg-primary py-3">
                        <Button variant="secondary" size="sm" onClick={() => setDetailOpen(false)} data-testid="op-detail-close">
                            <X className="mr-2 h-3.5 w-3.5" /> Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Row({ l, children }) {
    return (
        <div className="grid grid-cols-3 items-center gap-3">
            <Label className="col-span-1 text-sm">{l}</Label>
            <div className="col-span-2">{children}</div>
        </div>
    );
}
function Th({ children }) {
    return <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">{children}</th>;
}
