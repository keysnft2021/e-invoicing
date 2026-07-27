import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
    Search, RotateCcw, PlayCircle, AlertOctagon, FileDown, Save, X,
} from "lucide-react";

const DOC_TYPES = [
    { v: "all", l: "All" },
    { v: "invoice", l: "Invoice" },
    { v: "credit_note", l: "CN" },
];
const STATUSES = [
    { v: "completed", l: "Completed" },
    { v: "running", l: "Running" },
    { v: "no_data", l: "No Data" },
    { v: "failed", l: "Failed" },
];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export default function IcsConsolidated() {
    const qc = useQueryClient();
    const [view, setView] = useState("list"); // list | run
    const [filters, setFilters] = useState({
        monthly_task_serial_number: "",
        issuer_tin: "",
        document_type: "",
        status: "",
        operation_date_from: new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10),
        operation_date_to: new Date().toISOString().slice(0, 10),
    });
    const [applied, setApplied] = useState(filters);
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [reasonsData, setReasonsData] = useState(null);
    const [selected, setSelected] = useState(null);

    const qs = new URLSearchParams(
        Object.entries(applied).filter(([, v]) => v !== "" && v != null),
    ).toString();

    const { data, isLoading } = useQuery({
        queryKey: ["ics-consolidated", qs],
        queryFn: async () => (await api.get(`/ics/consolidated?${qs}`)).data,
    });

    const viewReasons = async () => {
        if (!selected) return toast.error("Select a task first");
        try {
            const { data } = await api.get(`/ics/consolidated/${selected}/failure-reasons`);
            setReasonsData(data);
            setReasonsOpen(true);
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const exportCsv = () => {
        const rows = data || [];
        const cols = ["NO", "Monthly Task Serial Number", "Issuer TIN", "Document Type",
                      "Invoice Period", "Task Start Time", "Task End Time", "Task Type",
                      "Status", "Matched", "Total Amount"];
        const csv = [cols.join(",")].concat(
            rows.map((r, i) => [i + 1, r.serial_number, r.issuer_tin, r.document_type,
                                r.invoice_period, r.task_start_time, r.task_end_time,
                                r.task_type, r.status, r.matched_documents, r.total_amount]
                .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")),
        ).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `consolidated-${Date.now()}.csv`;
        a.click();
    };

    if (view === "run") {
        return <RunConsolidateForm onDone={() => { setView("list"); qc.invalidateQueries({ queryKey: ["ics-consolidated"] }); }} onCancel={() => setView("list")} />;
    }

    const F = (k) => filters[k];
    const set = (k, v) => setFilters({ ...filters, [k]: v });

    return (
        <div>
            <PageHeader
                kicker="ICS · My Transaction"
                title="Transaction Consolidated Task"
                subtitle="Monthly aggregation of transactions per issuer TIN."
            />

            <section className="rounded-xl border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <Row l="Monthly Task Serial Number">
                        <Input value={F("monthly_task_serial_number")}
                            onChange={(e) => set("monthly_task_serial_number", e.target.value)}
                            data-testid="ct-filter-serial" />
                    </Row>
                    <Row l="Issuer TIN">
                        <Input value={F("issuer_tin")}
                            onChange={(e) => set("issuer_tin", e.target.value)}
                            data-testid="ct-filter-tin" />
                    </Row>
                    <Row l="Document Type">
                        <Select value={F("document_type")} onValueChange={(v) => set("document_type", v)}>
                            <SelectTrigger data-testid="ct-filter-doctype"><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {DOC_TYPES.map((d) => (<SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </Row>
                    <Row l="Status">
                        <Select value={F("status")} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (<SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </Row>
                    <Row l="Operation Date from">
                        <Input type="date" value={F("operation_date_from")}
                            onChange={(e) => set("operation_date_from", e.target.value)} />
                    </Row>
                    <Row l="to">
                        <Input type="date" value={F("operation_date_to")}
                            onChange={(e) => set("operation_date_to", e.target.value)} />
                    </Row>
                </div>
            </section>

            <div className="my-3 flex items-center justify-end gap-2 rounded-md bg-accent px-3 py-2">
                <Button size="sm" variant="secondary" onClick={() => setApplied(filters)} data-testid="ct-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setFilters({ ...filters, monthly_task_serial_number: "", issuer_tin: "", document_type: "", status: "" }); setApplied({ ...applied, monthly_task_serial_number: "", issuer_tin: "", document_type: "", status: "" }); }}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setView("run")} data-testid="ct-run-btn">
                    <PlayCircle className="mr-2 h-3.5 w-3.5" /> Run Consolidate Task
                </Button>
                <Button variant="outline" size="sm" onClick={viewReasons} disabled={!selected} data-testid="ct-reasons">
                    <AlertOctagon className="mr-2 h-3.5 w-3.5" /> View Failure Reasons
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="ct-export">
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
                                <Th>NO.</Th><Th>Monthly Task Serial Number</Th><Th>Issuer TIN</Th>
                                <Th>Document Type</Th><Th>Invoice Period</Th><Th>Task Start Time</Th>
                                <Th>Task End Time</Th><Th>Task Type</Th><Th>Status</Th>
                                <Th className="text-right">Matched</Th><Th className="text-right">Total</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="ct-table">
                            {(data || []).length === 0 ? (
                                <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : (
                                (data || []).map((r, i) => (
                                    <tr key={r.id}
                                        className={`border-b border-border/50 cursor-pointer hover:bg-secondary/40 ${selected === r.id ? "bg-secondary/60" : ""}`}
                                        onClick={() => setSelected(r.id === selected ? null : r.id)}>
                                        <td className="px-3 py-2">
                                            <input type="radio" checked={selected === r.id} onChange={() => setSelected(r.id)} data-testid={`ct-radio-${r.id}`} />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.serial_number}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.issuer_tin}</td>
                                        <td className="px-3 py-2 capitalize">{r.document_type}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.invoice_period}</td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.task_start_time)}</td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.task_end_time)}</td>
                                        <td className="px-3 py-2">{r.task_type?.replaceAll("_", " ")}</td>
                                        <td className="px-3 py-2"><StatusChip status={r.status === "completed" ? "active" : r.status === "no_data" ? "inactive" : "pending"} /></td>
                                        <td className="px-3 py-2 text-right font-mono">{r.matched_documents}</td>
                                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total_amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={reasonsOpen} onOpenChange={setReasonsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Failure reasons</DialogTitle></DialogHeader>
                    {(reasonsData?.failure_reasons || []).length === 0 ? (
                        <div className="text-sm text-muted-foreground">No failure reasons — matched {reasonsData?.matched_documents} documents.</div>
                    ) : (
                        <ul className="ml-4 list-disc space-y-1 text-sm">
                            {reasonsData.failure_reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RunConsolidateForm({ onDone, onCancel }) {
    const { data: tins } = useQuery({
        queryKey: ["ics-tins"],
        queryFn: async () => (await api.get("/ics/tin-list")).data,
    });
    const [issuerTin, setIssuerTin] = useState("");
    const now = new Date();
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [docType, setDocType] = useState("all");
    const [busy, setBusy] = useState(false);

    const selected = (tins || []).find((t) => t.tin === issuerTin);

    const submit = async () => {
        if (!issuerTin) return toast.error("Issuer TIN is required");
        if (!period.month || !period.year) return toast.error("Invoice Period is required");
        setBusy(true);
        try {
            const { data } = await api.post("/ics/consolidated/run", {
                document_type: docType,
                issuer_tin: issuerTin,
                period_year: period.year,
                period_month: period.month,
            });
            toast.success(`Task ${data.serial_number} completed`);
            onDone();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div className="mb-6">
                <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    ICS · My Transaction
                </div>
                <h1 className="font-display text-3xl font-semibold">
                    Transaction Consolidated Task <span className="text-muted-foreground">/</span> Run Consolidate Task
                </h1>
            </div>

            <section className="rounded-xl border border-border bg-card p-6">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                    <FRow l="Issuer TIN" required>
                        <Select value={issuerTin} onValueChange={setIssuerTin}>
                            <SelectTrigger className="border-warning/40 bg-warning/5" data-testid="run-issuer-tin">
                                <SelectValue placeholder="Please Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {(tins || []).map((t) => (
                                    <SelectItem key={t.tin} value={t.tin}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                                {(tins || []).length === 0 && (
                                    <div className="p-3 text-xs text-muted-foreground">
                                        No companies. Add one in /companies.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </FRow>
                    <FRow l="Name">
                        <Input value={selected?.name || ""} disabled className="bg-muted/40" data-testid="run-name" />
                    </FRow>
                    <FRow l="Invoice Period" required>
                        <div className="grid grid-cols-2 gap-2">
                            <Select
                                value={String(period.month)}
                                onValueChange={(v) => setPeriod({ ...period, month: Number(v) })}
                            >
                                <SelectTrigger className="border-warning/40 bg-warning/5" data-testid="run-month">
                                    <SelectValue placeholder="Select month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input type="number" value={period.year}
                                onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}
                                data-testid="run-year" />
                        </div>
                    </FRow>
                    <FRow l="Document Type">
                        <Select value={docType} onValueChange={setDocType}>
                            <SelectTrigger data-testid="run-doc-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DOC_TYPES.map((d) => (<SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </FRow>
                </div>
            </section>

            <div className="mt-4 flex items-center justify-center gap-3 rounded-md bg-accent px-3 py-3">
                <Button variant="secondary" onClick={submit} disabled={busy} data-testid="run-submit-btn">
                    <Save className="mr-2 h-4 w-4" /> Submit
                </Button>
                <Button variant="secondary" onClick={onCancel} data-testid="run-cancel-btn">
                    <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
            </div>
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
function FRow({ l, required, children }) {
    return (
        <div className="grid grid-cols-3 items-center gap-3">
            <Label className="col-span-1 text-sm">
                {l} {required && <span className="text-destructive">*</span>}
            </Label>
            <div className="col-span-2">{children}</div>
        </div>
    );
}
function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</th>;
}
