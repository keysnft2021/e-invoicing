import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError, API_BASE } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney, fmtDay } from "@/lib/format";
import {
    Search, RotateCcw, Plus, Edit3, Eye, Ban, Upload, ListChecks,
    Send, AlertOctagon, Activity, FileDown, ChevronDown, ChevronUp,
} from "lucide-react";

const DOCUMENT_TYPES = [
    { v: "invoice", l: "Invoice" },
    { v: "credit_note", l: "Credit Note (CN)" },
    { v: "debit_note", l: "Debit Note (DN)" },
    { v: "refund_note", l: "Refund Note" },
    { v: "self_billed_invoice", l: "Self-billed Invoice" },
];
const TRANSACTION_STATUSES = ["draft", "submitting", "validated", "rejected", "cancelled", "voided"];
const INVOICE_STATUSES = TRANSACTION_STATUSES;
const SOURCES = ["portal", "erp", "csv_upload", "api"];
const CONFIRMATION_STATUSES = ["pending", "confirmed", "rejected"];
const VALIDATION_RESULTS = ["pending", "valid", "invalid"];
const CURRENCIES = ["MYR", "USD", "SGD", "EUR", "CNY"];

const EMPTY = {
    document_type: "",
    document_no: "",
    supplier_tin: "",
    supplier_name: "",
    buyer_tin: "",
    buyer_name: "",
    transaction_date_from: new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10),
    transaction_date_to: new Date().toISOString().slice(0, 10),
    transaction_status: "",
    invoice_issued: "",
    e_invoice_uuid: "",
    invoice_status: "",
    source: "",
    invoice_confirmation_status: "",
    business_system: "",
    validation_result: "",
    store_code: "",
    currency: "",
    amount_from: "",
    amount_to: "",
};

export default function IcsTransactions() {
    const qc = useQueryClient();
    const [advanced, setAdvanced] = useState(false);
    const [filters, setFilters] = useState(EMPTY);
    const [applied, setApplied] = useState(EMPTY);
    const [selected, setSelected] = useState(new Set());
    const [voidOpen, setVoidOpen] = useState(false);
    const [voidReason, setVoidReason] = useState("");
    const [logOpen, setLogOpen] = useState(false);
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [uploadedOpen, setUploadedOpen] = useState(false);
    const fileRef = useRef(null);

    const uploadFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const fd = new FormData();
        fd.append("file", f);
        try {
            const { data } = await api.post("/ics/bulk/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success(`${data.invoices_created} invoices created from ${data.row_count} rows`);
            if (data.parse_errors?.length) {
                toast.error(`${data.parse_errors.length} row(s) had errors — check Uploaded Records`);
            }
            qc.invalidateQueries({ queryKey: ["ics-transactions"] });
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            e.target.value = "";
        }
    };
    const downloadTemplate = () => {
        window.open(`${API_BASE}/ics/bulk/template`, "_blank");
    };

    const queryString = useMemo(() => {
        const p = new URLSearchParams();
        Object.entries(applied).forEach(([k, v]) => {
            if (v !== "" && v != null) p.append(k, v);
        });
        return p.toString();
    }, [applied]);

    const { data, isLoading } = useQuery({
        queryKey: ["ics-transactions", queryString],
        queryFn: async () => (await api.get(`/ics/transactions?${queryString}`)).data,
    });

    const search = () => setApplied(filters);
    const reset = () => {
        setFilters(EMPTY);
        setApplied(EMPTY);
    };

    const F = (k) => filters[k];
    const set = (k, v) => setFilters({ ...filters, [k]: v });

    const toggleSel = (id) => {
        const nxt = new Set(selected);
        nxt.has(id) ? nxt.delete(id) : nxt.add(id);
        setSelected(nxt);
    };
    const toggleAll = () => {
        if (selected.size === (data?.rows?.length || 0)) setSelected(new Set());
        else setSelected(new Set((data?.rows || []).map((r) => r.id)));
    };
    const one = () => (selected.size === 1 ? [...selected][0] : null);

    const doVoid = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        try {
            await api.post(`/ics/transactions/${id}/void`, { reason: voidReason });
            toast.success("Voided");
            setVoidOpen(false);
            setVoidReason("");
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["ics-transactions"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const openLog = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        setActiveId(id);
        setLogOpen(true);
    };
    const openReasons = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        setActiveId(id);
        setReasonsOpen(true);
    };

    const exportCsv = () => {
        const rows = data?.rows || [];
        const cols = [
            "NO", "Document Type", "Document NO", "Business System", "Store Code/Location",
            "Supplier TIN", "Supplier Name", "Buyer TIN", "Buyer Name", "Transaction Date",
            "Status", "Currency", "Total", "E-Invoice UUID",
        ];
        const csv = [cols.join(",")]
            .concat(rows.map((r, i) => [
                i + 1, r.invoice_type, r.invoice_number, r.business_system || "",
                r.store_code || "", r.supplier_tin || "", r.supplier_name || "",
                r.customer_snapshot?.tin || "", r.customer_snapshot?.name || "",
                r.invoice_date || "", r.status, r.currency,
                r.total, r.government?.uuid || "",
            ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ics-transactions-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <PageHeader
                kicker="ICS · My Transaction"
                title="Transaction Data Management"
                subtitle="Search, add, modify, void and submit e-invoice transactions to LHDN MyInvois."
            />

            {/* Filter Panel */}
            <section className="rounded-xl border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <FRow l="Document Type">
                        <Select value={F("document_type")} onValueChange={(v) => set("document_type", v)}>
                            <SelectTrigger data-testid="filter-document-type"><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {DOCUMENT_TYPES.map((d) => (
                                    <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FRow>
                    <FRow l="Document NO.">
                        <Input value={F("document_no")} onChange={(e) => set("document_no", e.target.value)} data-testid="filter-document-no" />
                    </FRow>
                    <FRow l="Supplier's TIN">
                        <Input value={F("supplier_tin")} onChange={(e) => set("supplier_tin", e.target.value)} data-testid="filter-supplier-tin" />
                    </FRow>
                    <FRow l="Supplier's Name">
                        <Input value={F("supplier_name")} onChange={(e) => set("supplier_name", e.target.value)} />
                    </FRow>
                    <FRow l="Buyer's TIN">
                        <Input value={F("buyer_tin")} onChange={(e) => set("buyer_tin", e.target.value)} data-testid="filter-buyer-tin" />
                    </FRow>
                    <FRow l="Buyer's Name">
                        <Input value={F("buyer_name")} onChange={(e) => set("buyer_name", e.target.value)} />
                    </FRow>
                    <FRow l="Transaction Date from">
                        <Input type="date" value={F("transaction_date_from")} onChange={(e) => set("transaction_date_from", e.target.value)} data-testid="filter-date-from" />
                    </FRow>
                    <FRow l="to">
                        <Input type="date" value={F("transaction_date_to")} onChange={(e) => set("transaction_date_to", e.target.value)} data-testid="filter-date-to" />
                    </FRow>

                    {advanced && (
                        <>
                            <FRow l="Transaction Status">
                                <Select value={F("transaction_status")} onValueChange={(v) => set("transaction_status", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {TRANSACTION_STATUSES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Invoice Issued">
                                <Select value={F("invoice_issued")} onValueChange={(v) => set("invoice_issued", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="yes">Yes</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="E-Invoice UUID">
                                <Input value={F("e_invoice_uuid")} onChange={(e) => set("e_invoice_uuid", e.target.value)} />
                            </FRow>
                            <FRow l="Invoice Status">
                                <Select value={F("invoice_status")} onValueChange={(v) => set("invoice_status", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {INVOICE_STATUSES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Source">
                                <Select value={F("source")} onValueChange={(v) => set("source", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {SOURCES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Invoice Confirmation Status">
                                <Select value={F("invoice_confirmation_status")} onValueChange={(v) => set("invoice_confirmation_status", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {CONFIRMATION_STATUSES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Business System">
                                <Input value={F("business_system")} onChange={(e) => set("business_system", e.target.value)} />
                            </FRow>
                            <FRow l="Validation Result">
                                <Select value={F("validation_result")} onValueChange={(v) => set("validation_result", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {VALIDATION_RESULTS.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Store Code/Location">
                                <Input value={F("store_code")} onChange={(e) => set("store_code", e.target.value)} />
                            </FRow>
                            <FRow l="Currency">
                                <Select value={F("currency")} onValueChange={(v) => set("currency", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FRow>
                            <FRow l="Total Payable Amount Range" full>
                                <div className="flex items-center gap-2">
                                    <Input type="number" placeholder="from" value={F("amount_from")} onChange={(e) => set("amount_from", e.target.value)} />
                                    <span className="text-xs text-muted-foreground">to</span>
                                    <Input type="number" placeholder="to" value={F("amount_to")} onChange={(e) => set("amount_to", e.target.value)} />
                                </div>
                            </FRow>
                        </>
                    )}
                </div>
            </section>

            {/* Action bar */}
            <div className="my-3 flex items-center justify-end gap-2 rounded-md bg-accent px-3 py-2">
                <Button size="sm" variant="secondary" onClick={search} data-testid="btn-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={reset} data-testid="btn-reset">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setAdvanced((a) => !a)}
                    data-testid="btn-toggle-advanced"
                >
                    {advanced ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Basic Search</>
                              : <><ChevronDown className="mr-2 h-3.5 w-3.5" /> Advanced Search</>}
                </Button>
            </div>

            {/* Ops toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" data-testid="op-add">
                    <Link to="/invoices/new">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Add
                    </Link>
                </Button>
                <Button
                    asChild variant="outline" size="sm" data-testid="op-modify"
                    disabled={selected.size !== 1}
                >
                    <Link to={one() ? `/invoices/${one()}` : "#"}>
                        <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify & Issue
                    </Link>
                </Button>
                <Button
                    asChild variant="outline" size="sm" data-testid="op-view"
                    disabled={selected.size !== 1}
                >
                    <Link to={one() ? `/invoices/${one()}` : "#"}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                    </Link>
                </Button>
                <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={selected.size !== 1} data-testid="op-void">
                            <Ban className="mr-2 h-3.5 w-3.5" /> Void
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Void transaction</DialogTitle></DialogHeader>
                        <Textarea
                            placeholder="Reason"
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            data-testid="void-reason"
                        />
                        <DialogFooter>
                            <Button variant="destructive" onClick={doVoid} data-testid="void-confirm">Confirm void</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" data-testid="op-upload" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-2 h-3.5 w-3.5" /> Upload Template
                </Button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={uploadFile} data-testid="op-upload-file" />
                <Button variant="ghost" size="sm" onClick={downloadTemplate} data-testid="op-template-dl">
                    Download template
                </Button>
                <Button variant="outline" size="sm" data-testid="op-uploaded" onClick={() => setUploadedOpen(true)}>
                    <ListChecks className="mr-2 h-3.5 w-3.5" /> Uploaded Records
                </Button>
                <Button asChild variant="outline" size="sm" data-testid="op-submit" disabled={selected.size !== 1}>
                    <Link to={one() ? `/invoices/${one()}` : "#"}>
                        <Send className="mr-2 h-3.5 w-3.5" /> Submit
                    </Link>
                </Button>
                <Button variant="outline" size="sm" disabled={selected.size !== 1} onClick={openReasons} data-testid="op-reasons">
                    <AlertOctagon className="mr-2 h-3.5 w-3.5" /> View Invalid Reasons
                </Button>
                <Button variant="outline" size="sm" disabled={selected.size !== 1} onClick={openLog} data-testid="op-log">
                    <Activity className="mr-2 h-3.5 w-3.5" /> Operation Log
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="op-export">
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
                                <th className="w-10 px-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.size === (data?.rows?.length || 0) && data?.rows?.length > 0}
                                        onChange={toggleAll}
                                        data-testid="select-all"
                                    />
                                </th>
                                <Th>NO.</Th>
                                <Th>Document Type</Th>
                                <Th>Document NO.</Th>
                                <Th>Business System</Th>
                                <Th>Store Code/Location</Th>
                                <Th>Supplier's TIN</Th>
                                <Th>Supplier's Name</Th>
                                <Th>Buyer's TIN</Th>
                                <Th>Buyer's Name</Th>
                                <Th>Transaction Date</Th>
                                <Th className="text-right">Total</Th>
                                <Th>Status</Th>
                                <Th>E-Invoice UUID</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="ics-txn-table">
                            {(data?.rows || []).length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="p-12 text-center text-muted-foreground">
                                        No Data
                                    </td>
                                </tr>
                            ) : (
                                (data.rows || []).map((r, i) => (
                                    <tr key={r.id}
                                        className="border-b border-border/50 hover:bg-secondary/40"
                                        data-testid={`ics-row-${r.id}`}
                                    >
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(r.id)}
                                                onChange={() => toggleSel(r.id)}
                                                data-testid={`select-${r.id}`}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                        <td className="px-3 py-2 capitalize">{r.invoice_type?.replaceAll("_", " ") || "invoice"}</td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            <Link to={`/invoices/${r.id}`} className="hover:underline">
                                                {r.invoice_number}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">{r.business_system || "—"}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{r.store_code || "—"}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin || "—"}</td>
                                        <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.customer_snapshot?.tin || "—"}</td>
                                        <td className="px-3 py-2">{r.customer_snapshot?.name || "—"}</td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {fmtDay(r.invoice_date || r.created_at)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {fmtMoney(r.total, r.currency)}
                                        </td>
                                        <td className="px-3 py-2"><StatusChip status={r.status} /></td>
                                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                            {r.government?.uuid || "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-border bg-secondary/30">
                                <td colSpan={11} className="px-3 py-3 text-sm font-medium">Total</td>
                                <td className="px-3 py-3 text-right font-mono">{fmtMoney(data?.total || 0)}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <OperationLogDialog open={logOpen} onOpenChange={setLogOpen} id={activeId} />
            <InvalidReasonsDialog open={reasonsOpen} onOpenChange={setReasonsOpen} id={activeId} />
            <UploadedRecordsDialog open={uploadedOpen} onOpenChange={setUploadedOpen} />
        </div>
    );
}

function UploadedRecordsDialog({ open, onOpenChange }) {
    const { data } = useQuery({
        queryKey: ["upload-jobs"],
        queryFn: async () => (await api.get("/ics/bulk/jobs")).data,
        enabled: open,
    });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Uploaded Records</DialogTitle></DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {(data || []).length === 0 && (
                        <div className="text-sm text-muted-foreground">No bulk uploads yet.</div>
                    )}
                    {(data || []).map((j) => (
                        <div key={j.id} className="rounded border border-border p-3 text-xs" data-testid={`job-${j.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <div className="font-mono">{j.filename}</div>
                                    <div className="text-muted-foreground">
                                        {j.uploaded_at} · {j.uploaded_by} · {Math.round(j.size_bytes / 1024)} KB
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono">
                                        {j.invoices_created}/{j.row_count} rows
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        {j.status}
                                    </div>
                                </div>
                            </div>
                            {j.parse_errors?.length > 0 && (
                                <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-[10px]">
                                    {j.parse_errors.slice(0, 5).map((e, i) => (
                                        <div key={i}>Row {e.row}: {e.error}</div>
                                    ))}
                                    {j.parse_errors.length > 5 && (
                                        <div className="text-muted-foreground">+{j.parse_errors.length - 5} more…</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FRow({ l, children, full }) {
    return (
        <div className={`grid grid-cols-3 items-center gap-3 ${full ? "md:col-span-2" : ""}`}>
            <Label className="col-span-1 text-sm">{l}</Label>
            <div className="col-span-2">{children}</div>
        </div>
    );
}
function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</th>;
}

function OperationLogDialog({ open, onOpenChange, id }) {
    const { data } = useQuery({
        queryKey: ["op-log", id],
        queryFn: async () => (await api.get(`/ics/transactions/${id}/operation-log`)).data,
        enabled: !!id && open,
    });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Operation log</DialogTitle></DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto text-sm">
                    {(data || []).length === 0 && <div className="text-muted-foreground">No entries.</div>}
                    {(data || []).map((l) => (
                        <div key={l.id} className="rounded border border-border p-2 text-xs">
                            <div className="flex justify-between">
                                <span className="font-mono">{l.action}</span>
                                <span className="text-muted-foreground">{l.created_at}</span>
                            </div>
                            <div className="text-muted-foreground">{l.actor_email}</div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
function InvalidReasonsDialog({ open, onOpenChange, id }) {
    const { data } = useQuery({
        queryKey: ["reasons", id],
        queryFn: async () => (await api.get(`/ics/transactions/${id}/invalid-reasons`)).data,
        enabled: !!id && open,
    });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Invalid reasons</DialogTitle></DialogHeader>
                {(data?.errors || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No invalid reasons — status {data?.status}.</div>
                ) : (
                    <div className="space-y-2">
                        {data.errors.map((e, i) => (
                            <div key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                                <div className="font-mono font-semibold">{e.code}</div>
                                <div className="mt-1">{e.message}</div>
                                {e.path && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{e.path}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
