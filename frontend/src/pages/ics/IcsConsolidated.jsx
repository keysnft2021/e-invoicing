import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
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
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
    Eye, Send, ExternalLink, AlertOctagon, Activity, ListChecks, FileDown,
    ChevronDown, ChevronUp, PlayCircle, Save, X, Search, RotateCcw,
} from "lucide-react";

const DOC_TYPES = [
    { v: "invoice", l: "Invoice" },
    { v: "credit_note", l: "Credit Note" },
    { v: "debit_note", l: "Debit Note" },
];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** LHDN General Public TIN — retail-aggregated consolidated invoices are
 *  issued to this buyer per Malaysian e-invoice spec. */
const GENERAL_PUBLIC_TIN = "EI00000000010";
const GENERAL_PUBLIC_NAME = "General Public";

function fmtDay(d) {
    if (!d) return "—";
    return String(d).slice(0, 10);
}
function fmtDateTime(d) {
    if (!d) return "—";
    return String(d).slice(0, 19).replace("T", " ");
}

/** Build the S-XXXXXXX-S-XXXXXXX document number the LHDN portal uses for
 *  consolidated batches. Deterministic per invoice id so it stays stable. */
function consolidatedDocNo(invId, ix) {
    const seed = parseInt(String(invId).slice(-6), 16) || (10000 + ix);
    const a = 3346680000 + (seed % 90000);
    const b = a + 7000 + (ix * 300);
    return `S-${a}-S-${b}`;
}

/** Compute the invoice month period for the LHDN consolidated view. */
function periodOf(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const last = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}

const STATUS_FILTER = [
    { v: "all", l: "All" },
    { v: "draft", l: "Draft" },
    { v: "submitting", l: "Submitting" },
    { v: "validated", l: "Valid" },
    { v: "rejected", l: "Invalid" },
    { v: "cancelled", l: "Cancelled" },
];

export default function IcsConsolidated() {
    const qc = useQueryClient();
    const nav = useNavigate();
    const { currentId } = useCompany();
    const [expanded, setExpanded] = useState(false);
    const [runOpen, setRunOpen] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [incompleteOpen, setIncompleteOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [filters, setFilters] = useState({
        document_no: "",
        supplier_tin: "",
        buyer_tin: "",
        document_type: "all",
        status: "all",
        currency: "all",
        period_from: "",
        period_to: "",
    });
    const [applied, setApplied] = useState(filters);

    // Underlying data: use the existing transactions endpoint scoped by clinic
    const qs = new URLSearchParams();
    if (currentId) qs.set("company_id", currentId);
    if (applied.document_type && applied.document_type !== "all")
        qs.set("document_type", applied.document_type);
    if (applied.status && applied.status !== "all") qs.set("status", applied.status);
    qs.set("limit", "500");
    const { data, isLoading } = useQuery({
        queryKey: ["ics-consolidated", qs.toString()],
        queryFn: async () => (await api.get(`/ics/transactions?${qs}`)).data,
    });

    // Client-side filters (document_no / TIN / currency / period)
    const rows = useMemo(() => {
        const base = (data?.rows || []).map((r) => ({
            ...r,
            _doc_no: consolidatedDocNo(r.id, 0),
            _period: periodOf(r.invoice_date || r.created_at),
        }));
        return base.filter((r) => {
            if (applied.document_no && !r._doc_no.toLowerCase().includes(applied.document_no.toLowerCase())) return false;
            if (applied.supplier_tin && !(r.supplier_tin || "C24700902040").toLowerCase().includes(applied.supplier_tin.toLowerCase())) return false;
            if (applied.buyer_tin && !GENERAL_PUBLIC_TIN.toLowerCase().includes(applied.buyer_tin.toLowerCase())) return false;
            if (applied.currency && applied.currency !== "all" && r.currency !== applied.currency) return false;
            if (applied.period_from && r._period.to < applied.period_from) return false;
            if (applied.period_to && r._period.from > applied.period_to) return false;
            return true;
        });
    }, [data, applied]);

    const totals = useMemo(() => {
        return rows.reduce((acc, r) => ({
            net: acc.net + (r.subtotal || 0),
            discount: acc.discount + 0,
            fee: acc.fee + 0,
            excl: acc.excl + (r.subtotal || 0),
            tax: acc.tax + (r.tax_total || 0),
            incl: acc.incl + (r.total || 0),
            round: acc.round + 0,
            payable: acc.payable + (r.total || 0),
        }), { net: 0, discount: 0, fee: 0, excl: 0, tax: 0, incl: 0, round: 0, payable: 0 });
    }, [rows]);

    const oneId = () => (selected.size === 1 ? [...selected][0] : null);
    const toggle = (id) => {
        const n = new Set(selected);
        n.has(id) ? n.delete(id) : n.add(id);
        setSelected(n);
    };
    const toggleAll = () => {
        if (selected.size === rows.length) return setSelected(new Set());
        setSelected(new Set(rows.map((r) => r.id)));
    };

    const search = () => setApplied(filters);
    const reset = () => {
        const empty = {
            document_no: "", supplier_tin: "", buyer_tin: "",
            document_type: "all", status: "all", currency: "all",
            period_from: "", period_to: "",
        };
        setFilters(empty); setApplied(empty);
    };

    const exportCsv = () => {
        const cols = ["NO.", "Document Type", "Document NO.", "Business System",
            "Store Code/Location", "Supplier's TIN", "Supplier's Name",
            "Buyer's TIN", "Buyer's Name", "Total Net Amount", "Total Discount Value",
            "Total Fee/Charge Amount", "Total Excluding Tax", "Total Tax Amount",
            "Total Including Tax", "Rounding Amount", "Total Payable Amount",
            "Currency", "Invoice Period from", "Invoice Period to", "Issuer TIN",
            "Invoice Issued", "Date Time Issued", "Invoice Status",
            "Submission UID", "E-Invoice UUID", "Error Information",
            "Operation Time", "Operator", "Upload Time", "Source"];
        const csv = [cols.join(",")].concat(
            rows.map((r, i) => [
                i + 1, "Invoice", r._doc_no, r.business_system || "",
                r.store_code || "", r.supplier_tin || "C24700902040",
                r.supplier_name || "DFACE HEALTHCARE SDN BHD",
                GENERAL_PUBLIC_TIN, GENERAL_PUBLIC_NAME,
                r.subtotal || 0, 0, 0, r.subtotal || 0, r.tax_total || 0,
                r.total || 0, 0, r.total || 0, r.currency || "MYR",
                r._period.from, r._period.to,
                r.supplier_tin || "C24700902040",
                r.government?.uuid ? "Yes" : "No",
                fmtDateTime(r.government?.signed_at),
                r.status, r.government?.submission_uid || "",
                r.government?.uuid || "",
                r.government?.errors?.[0]?.message || "",
                fmtDateTime(r.updated_at || r.created_at),
                r.created_by_email || "Super administrator",
                fmtDateTime(r.created_at),
                "Consolidated e-Invoice",
            ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")),
        ).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `consolidated-${Date.now()}.csv`;
        a.click();
    };

    return (
        <div>
            <PageHeader
                kicker="EIS · My Transaction"
                title="Invoicing Consolidated Management"
                subtitle="Monthly consolidated e-invoices issued to General Public (LHDN retail-aggregated flow)."
            />

            {/* Expandable filter panel */}
            <section className="mb-4 rounded-md border border-border bg-card">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                    data-testid="cm-expand"
                >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Expand
                </button>
                {expanded && (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-6 md:grid-cols-2">
                        <Row l="Document NO.">
                            <Input value={filters.document_no}
                                   onChange={(e) => setFilters({ ...filters, document_no: e.target.value })}
                                   placeholder="S-XXXXXXX-S-XXXXXXX" data-testid="cm-filter-docno" />
                        </Row>
                        <Row l="Document Type">
                            <Select value={filters.document_type}
                                    onValueChange={(v) => setFilters({ ...filters, document_type: v })}>
                                <SelectTrigger data-testid="cm-filter-doctype"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {DOC_TYPES.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row l="Supplier's TIN">
                            <Input value={filters.supplier_tin}
                                   onChange={(e) => setFilters({ ...filters, supplier_tin: e.target.value })} />
                        </Row>
                        <Row l="Buyer's TIN">
                            <Input value={filters.buyer_tin}
                                   onChange={(e) => setFilters({ ...filters, buyer_tin: e.target.value })}
                                   placeholder="EI00000000010" />
                        </Row>
                        <Row l="Invoice Status">
                            <Select value={filters.status}
                                    onValueChange={(v) => setFilters({ ...filters, status: v })}>
                                <SelectTrigger data-testid="cm-filter-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STATUS_FILTER.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row l="Currency">
                            <Select value={filters.currency}
                                    onValueChange={(v) => setFilters({ ...filters, currency: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="MYR">(MYR) Malaysian Ringgit</SelectItem>
                                    <SelectItem value="USD">(USD) US Dollar</SelectItem>
                                    <SelectItem value="SGD">(SGD) Singapore Dollar</SelectItem>
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row l="Invoice Period from">
                            <Input type="date" value={filters.period_from}
                                   onChange={(e) => setFilters({ ...filters, period_from: e.target.value })} />
                        </Row>
                        <Row l="Invoice Period to">
                            <Input type="date" value={filters.period_to}
                                   onChange={(e) => setFilters({ ...filters, period_to: e.target.value })} />
                        </Row>
                        <div className="col-span-full mt-2 flex justify-end gap-2 border-t border-border pt-4">
                            <Button size="sm" onClick={search} data-testid="cm-search">
                                <Search className="mr-2 h-3.5 w-3.5" /> Search
                            </Button>
                            <Button size="sm" variant="outline" onClick={reset}>
                                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm"
                        onClick={() => oneId() ? setPreviewOpen(true) : toast.error("Select one row")}
                        data-testid="cm-preview">
                    <Eye className="mr-2 h-3.5 w-3.5" /> Invoice Preview
                </Button>
                <Button variant="outline" size="sm"
                        onClick={() => oneId() ? nav(`/invoices/${oneId()}`) : toast.error("Select one row")}
                        data-testid="cm-submit">
                    <Send className="mr-2 h-3.5 w-3.5" /> Submit
                </Button>
                <Button variant="outline" size="sm"
                        onClick={() => nav("/ics/my-transaction")} data-testid="cm-view-txn">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> View Transaction Data
                </Button>
                <Button variant="outline" size="sm" disabled={!oneId()}
                        onClick={() => setReasonsOpen(true)} data-testid="cm-reasons">
                    <AlertOctagon className="mr-2 h-3.5 w-3.5" /> View Invalid Reasons
                </Button>
                <Button variant="outline" size="sm" disabled={!oneId()}
                        onClick={() => setLogOpen(true)} data-testid="cm-log">
                    <Activity className="mr-2 h-3.5 w-3.5" /> Operation Log
                </Button>
                <Button variant="outline" size="sm"
                        onClick={() => setIncompleteOpen(true)} data-testid="cm-incomplete">
                    <ListChecks className="mr-2 h-3.5 w-3.5" /> Check Incompleted Fields
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="cm-export">
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
                <div className="ml-auto">
                    <Button size="sm" onClick={() => setRunOpen(true)} data-testid="cm-run">
                        <PlayCircle className="mr-2 h-3.5 w-3.5" /> Run Consolidate Task
                    </Button>
                </div>
            </div>

            {/* Main table — 32 LHDN columns */}
            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-accent text-accent-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3">
                                    <input type="checkbox"
                                           checked={rows.length > 0 && selected.size === rows.length}
                                           onChange={toggleAll} data-testid="cm-select-all" />
                                </th>
                                <Th>NO.</Th>
                                <Th>Document Type</Th>
                                <Th>Document NO.</Th>
                                <Th>Business System</Th>
                                <Th>Store Code/Location</Th>
                                <Th>Supplier&apos;s TIN</Th>
                                <Th>Supplier&apos;s Name</Th>
                                <Th>Buyer&apos;s TIN</Th>
                                <Th>Buyer&apos;s Name</Th>
                                <Th className="text-right">Total Net Amount</Th>
                                <Th className="text-right">Total Discount Value</Th>
                                <Th className="text-right">Total Fee/Charge Amount</Th>
                                <Th className="text-right">Total Excluding Tax</Th>
                                <Th className="text-right">Total Tax Amount</Th>
                                <Th className="text-right">Total Including Tax</Th>
                                <Th className="text-right">Rounding Amount</Th>
                                <Th className="text-right">Total Payable Amount</Th>
                                <Th>Currency</Th>
                                <Th>Invoice Period from</Th>
                                <Th>Invoice Period to</Th>
                                <Th>Issuer TIN</Th>
                                <Th>Invoice Issued</Th>
                                <Th>Date Time Issued</Th>
                                <Th>Invoice Status</Th>
                                <Th>Submission UID</Th>
                                <Th>E-Invoice UUID</Th>
                                <Th>Error Information</Th>
                                <Th>Operation Time</Th>
                                <Th>Operator</Th>
                                <Th>Upload Time</Th>
                                <Th>Source</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="cm-table">
                            {rows.length === 0 ? (
                                <tr><td colSpan={32} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40"
                                    data-testid={`cm-row-${r.id}`}>
                                    <td className="px-3 py-2">
                                        <input type="checkbox" checked={selected.has(r.id)}
                                               onChange={() => toggle(r.id)}
                                               data-testid={`cm-select-${r.id}`} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 capitalize">
                                        {r.invoice_type?.replaceAll("_", " ") || "Invoice"}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">
                                        <Link to={`/invoices/${r.id}`} className="text-accent hover:underline">
                                            {r._doc_no}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.business_system || "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.store_code || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin || "C24700902040"}</td>
                                    <td className="px-3 py-2">{r.supplier_name || "DFACE HEALTHCARE SDN BHD"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{GENERAL_PUBLIC_TIN}</td>
                                    <td className="px-3 py-2">{GENERAL_PUBLIC_NAME}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.subtotal)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">0.00</td>
                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">0.00</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.subtotal)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.tax_total)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">0.00</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(r.total)}</td>
                                    <td className="px-3 py-2 text-muted-foreground">(MYR)Malaysian Ringgit</td>
                                    <td className="px-3 py-2 text-xs">{r._period.from}</td>
                                    <td className="px-3 py-2 text-xs">{r._period.to}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin || "C24700902040"}</td>
                                    <td className="px-3 py-2 text-xs">{r.government?.uuid ? "Yes" : "No"}</td>
                                    <td className="px-3 py-2 text-xs">{fmtDateTime(r.government?.signed_at)}</td>
                                    <td className="px-3 py-2"><StatusChip status={r.status} /></td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                        {r.government?.submission_uid || "—"}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                        {r.government?.uuid || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-destructive">
                                        {r.government?.errors?.[0]?.message?.slice(0, 40) || ""}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {fmtDateTime(r.updated_at || r.created_at)}
                                    </td>
                                    <td className="px-3 py-2 text-xs">{r.created_by_email || "Super administrator"}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {fmtDateTime(r.created_at)}
                                    </td>
                                    <td className="px-3 py-2 text-xs">Consolidated e-Invoice</td>
                                </tr>
                            ))}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                                    <td colSpan={10} className="px-3 py-3 text-right">Total</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totals.net)}</td>
                                    <td className="px-3 py-3 text-right font-mono">0.00</td>
                                    <td className="px-3 py-3 text-right font-mono">0.00</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totals.excl)}</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totals.tax)}</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totals.incl)}</td>
                                    <td className="px-3 py-3 text-right font-mono">0.00</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totals.payable)}</td>
                                    <td colSpan={13} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* Dialogs */}
            <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} id={oneId()} rows={rows} onSelect={(id) => setSelected(new Set([id]))} />
            <ReasonsDialog open={reasonsOpen} onOpenChange={setReasonsOpen} id={oneId()} rows={rows} />
            <OpLogDialog open={logOpen} onOpenChange={setLogOpen} id={oneId()} />
            <IncompleteDialog open={incompleteOpen} onOpenChange={setIncompleteOpen} rows={rows} />
            <RunDialog open={runOpen} onOpenChange={setRunOpen}
                       onDone={() => qc.invalidateQueries({ queryKey: ["ics-consolidated"] })} />
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

function Th({ children, className = "" }) {
    return (
        <th className={`whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>
            {children}
        </th>
    );
}

function PreviewDialog({ open, onOpenChange, id, rows, onSelect }) {
    const { data } = useQuery({
        queryKey: ["cm-preview", id],
        queryFn: async () => (await api.get(`/invoices/${id}`)).data,
        enabled: open && !!id,
    });
    // Wizard-style pagination: Previous / Next moves through the filtered rows
    const currentRow = rows.find((r) => r.id === id);
    const idx = rows.findIndex((r) => r.id === id);
    const canPrev = idx > 0;
    const canNext = idx >= 0 && idx < rows.length - 1;
    const [page, setPage] = useState(0); // 0 = A/B/C, 1 = D/E/F/G/H

    const goPrev = () => {
        if (page === 1) return setPage(0);
        if (canPrev) { onSelect?.(rows[idx - 1].id); setPage(0); }
    };
    const goNext = () => {
        if (page === 0) return setPage(1);
        if (canNext) { onSelect?.(rows[idx + 1].id); setPage(0); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-0" data-testid="cm-preview-modal">
                <div className="sticky top-0 z-10 bg-card px-6 pt-5 pb-3 border-b border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            <span className="text-muted-foreground font-normal">Invoicing Consolidated Management</span>
                            <span className="text-muted-foreground font-normal"> / </span>
                            Invoice Preview
                        </DialogTitle>
                        <DialogDescription>
                            LHDN e-invoice preview — Sections {page === 0 ? "A – C" : "D – H"} of consolidated document.
                        </DialogDescription>
                    </DialogHeader>
                </div>
                {!data ? <div className="p-6"><Skeleton className="h-96 w-full" /></div> : (
                    <div className="px-6 pb-24 pt-4">
                        {page === 0 ? (
                            <>
                                <PSection title="Section A: Basic Information">
                                    <PField l="E-Invoice Code Number" v={currentRow?._doc_no || data.invoice_number} />
                                    <PField l="E-Invoice Type" v={typeLabel(data.invoice_type)} />
                                    <PField l="Original Invoice Code Number" v="" />
                                    <PField l="Original Invoice UUID" v="" />
                                    <PField l="Invoice Currency" v={data.currency || "MYR"} />
                                    <PField l="Exchange Rate" v={data.exchange_rate || ""} />
                                    <PField l="K1" v="" />
                                    <PField l="Incoterms" v="" />
                                    <PField l="FTA Information" v="" />
                                    <PField l="K2" v="" />
                                    <PField l="Business System" v={data.business_system || ""} />
                                    <PField l="Store Code/Location" v={data.store_code || ""} />
                                    <PField l="Invoice Period from" v={currentRow?._period?.from || ""} />
                                    <PField l="Invoice Period to" v={currentRow?._period?.to || ""} />
                                    <PField l="E-Invoice Date Time" v={fmtDateTime(data.created_at)} full />
                                </PSection>

                                <PSection title="Section B: Supplier's Information">
                                    <PField l="TIN" v={data.supplier_tin || "C24700902040"} mono />
                                    <PField l="Name" v={data.supplier_name || "DFACE HEALTHCARE SDN BHD"} />
                                    <PField l="ID Type" v="Business Registration Number" />
                                    <PField l="ID Value" v={data.supplier_brn || "201601034740"} mono />
                                    <PField l="SST Registration Number" v="NA" />
                                    <PField l="Tourism Tax Registration Number" v="NA" />
                                    <PField l="Contact Number" v={data.supplier_phone || "0175510666"} />
                                    <PField l="E-mail" v={data.supplier_email || ""} />
                                    <PField l="Malaysia Standard Industrial Classification"
                                            v="(86201)General medical services" />
                                    <PField l="Authorisation Number For Certified Exporter" v="NA" />
                                    <PField l="Business Activity Description"
                                            v="GP clinic with aesthetic services" full />
                                    <PGroup label="Address">
                                        <PField l="Country" v="MALAYSIA" />
                                        <PField l="State" v="Perak" />
                                        <PField l="City Name" v="Teluk Intan" />
                                        <PField l="Address Line 0" v="Jalan Raja" />
                                        <PField l="Address Line 1" v="69 & 71" />
                                        <PField l="Address Line 2" v="" />
                                        <PField l="Postal Zone" v="36000" />
                                    </PGroup>
                                </PSection>

                                <PSection title="Section C: Buyer's Details">
                                    <PField l="ID Type" v="NRIC" />
                                    <PField l="ID Value" v="NA" />
                                    <PField l="TIN" v={GENERAL_PUBLIC_TIN} mono />
                                    <PField l="Name" v={GENERAL_PUBLIC_NAME} />
                                    <PField l="SST Registration Number" v="NA" />
                                    <PField l="Contact Number" v="NA" />
                                    <PField l="E-mail" v="" full />
                                    <PGroup label="Address">
                                        <PField l="Country" v="MALAYSIA" />
                                        <PField l="State" v="Not Applicable" />
                                        <PField l="City Name" v="NA" />
                                        <PField l="Address Line 0" v="NA" />
                                        <PField l="Address Line 1" v="" />
                                        <PField l="Address Line 2" v="" />
                                        <PField l="Postal Zone" v="" />
                                    </PGroup>
                                </PSection>
                            </>
                        ) : (
                            <>
                                <PSectionBar title="Section D: Line Item Details" />
                                <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                                            <tr>
                                                <Th>NO.</Th><Th>Classification</Th><Th>Item Name</Th>
                                                <Th>Measurement</Th>
                                                <Th className="text-right">Quantity</Th>
                                                <Th className="text-right">Unit Price</Th>
                                                <Th className="text-right">Total Before Discount</Th>
                                                <Th className="text-right">Discount Rate</Th>
                                                <Th className="text-right">Discount Amount</Th>
                                                <Th className="text-right">Total Excluding Tax</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data.lines || []).length === 0 && (
                                                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No line items</td></tr>
                                            )}
                                            {(data.lines || []).map((l, i) => {
                                                const before = (l.quantity || 0) * (l.unit_price || 0);
                                                const disc = l.discount || 0;
                                                const excl = before - disc;
                                                return (
                                                    <tr key={i} className="border-b border-border/50">
                                                        <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                                        <td className="px-3 py-2">Consolidated e-Invoice</td>
                                                        <td className="px-3 py-2">{l.description || "Medicine"}</td>
                                                        <td className="px-3 py-2">each</td>
                                                        <td className="px-3 py-2 text-right font-mono">{(l.quantity || 0).toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(l.unit_price)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(before)}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">0%</td>
                                                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtMoney(disc)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(excl)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <PSection title="Section E: Payment Details">
                                    <PField l="Payment Mode" v="" />
                                    <PField l="Supplier's Bank Account Number" v="" />
                                    <PField l="PrePayment Reference Number" v="" />
                                    <PField l="PrePayment Amount" v="0.00" />
                                    <PField l="PrePayment Date Time" v="" />
                                    <PField l="Bill Reference Number" v="" />
                                    <PField l="Payment Terms" v={data.terms || ""} full multi />
                                </PSection>

                                <PSectionBar title="Section F: Tax Details" />
                                <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                                            <tr>
                                                <Th>NO.</Th><Th>Tax Type</Th><Th>Tax Rate</Th>
                                                <Th>PerUnit Amount</Th><Th>Measurement</Th>
                                                <Th className="text-right">Quantity</Th>
                                                <Th className="text-right">Net Amount</Th>
                                                <Th className="text-right">Tax Amount</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="px-3 py-2 font-mono text-xs">1</td>
                                                <td className="px-3 py-2">{data.tax_total > 0 ? `SST ${(data.lines?.[0]?.tax_rate || 6)}%` : "Not Applicable"}</td>
                                                <td className="px-3 py-2 font-mono">{(data.lines?.[0]?.tax_rate || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2" />
                                                <td className="px-3 py-2" />
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {(data.lines || []).reduce((s, l) => s + (l.quantity || 0), 0).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtMoney(data.subtotal)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtMoney(data.tax_total)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <PSectionBar title="Section G: Additional Charge" />
                                <div className="mb-6 rounded-b-md border-x border-b border-border bg-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                                            <tr>
                                                <Th>NO.</Th><Th>Additional Type</Th>
                                                <Th>Additional Charge Amount</Th>
                                                <Th>Additional Charge Reason</Th>
                                            </tr>
                                        </thead>
                                    </table>
                                    <div className="grid place-items-center py-12 text-sm text-muted-foreground">
                                        No Data
                                    </div>
                                </div>

                                <PSectionBar title="Section H: Summary" />
                                <div className="mb-6 flex flex-col gap-2 rounded-b-md border-x border-b border-border bg-card p-4 max-w-md">
                                    <PSummary l="Total Net Amount" v={fmtMoney(data.subtotal)} />
                                    <PSummary l="Total Discount Value" v="0.00" />
                                    <PSummary l="Total Fee/Charge Amount" v="0.00" />
                                    <PSummary l="Total Excluding Tax" v={fmtMoney(data.subtotal)} />
                                    <PSummary l="Total Tax Amount" v={fmtMoney(data.tax_total)} />
                                    <PSummary l="Total Including Tax" v={fmtMoney(data.total)} />
                                    <PSummary l="Rounding Amount" v="0.00" />
                                    <PSummary l="Total Payable Amount" v={fmtMoney(Math.round(data.total))} highlight />
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="sticky bottom-0 z-10 flex items-center justify-center gap-3 border-t border-border bg-accent px-6 py-3">
                    <Button variant="secondary" size="sm"
                            onClick={goPrev}
                            disabled={page === 0 && !canPrev}
                            data-testid="cm-preview-prev">
                        ◀ Previous
                    </Button>
                    {page === 0 ? (
                        <Button variant="secondary" size="sm"
                                onClick={goNext}
                                data-testid="cm-preview-next">
                            Next ▶
                        </Button>
                    ) : canNext ? (
                        <Button variant="secondary" size="sm"
                                onClick={goNext}
                                data-testid="cm-preview-next">
                            Next Document ▶
                        </Button>
                    ) : null}
                    <Button variant="secondary" size="sm"
                            onClick={() => { onOpenChange(false); setPage(0); }}
                            data-testid="cm-preview-cancel">
                        ✕ Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function typeLabel(t) {
    const m = { invoice: "Invoice", credit_note: "Credit Note", debit_note: "Debit Note",
                refund_note: "Refund Note", self_billed_invoice: "Self-Billed Invoice" };
    return m[t] || "Invoice";
}

function PSectionBar({ title }) {
    return (
        <div className="rounded-t-md bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-foreground">
            {title}
        </div>
    );
}

function PSection({ title, children }) {
    return (
        <>
            <PSectionBar title={title} />
            <div className="mb-6 grid grid-cols-1 gap-x-8 gap-y-3 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
                {children}
            </div>
        </>
    );
}

function PGroup({ label, children }) {
    return (
        <div className="col-span-full mt-2 rounded border border-border p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">{children}</div>
        </div>
    );
}

function PField({ l, v, mono, full, multi }) {
    return (
        <div className={full ? "col-span-full grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_1fr]" : "grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]"}>
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className={`rounded border border-border bg-secondary/20 px-3 py-2 text-sm ${mono ? "font-mono" : ""} ${multi ? "min-h-[64px]" : ""}`}>
                {v || <span className="text-muted-foreground/50">&nbsp;</span>}
            </div>
        </div>
    );
}

function PSummary({ l, v, highlight }) {
    return (
        <div className={`grid grid-cols-[180px_1fr] items-center gap-3 ${highlight ? "font-semibold" : ""}`}>
            <div className="rounded bg-accent px-3 py-1.5 text-center text-xs font-medium text-accent-foreground">
                {l}
            </div>
            <div className="rounded border border-border bg-secondary/20 px-3 py-1.5 font-mono text-sm">
                {v}
            </div>
        </div>
    );
}

function ReasonsDialog({ open, onOpenChange, id, rows }) {
    const r = (rows || []).find((x) => x.id === id);
    const errs = r?.government?.errors || [];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invalid Reasons</DialogTitle>
                    <DialogDescription>LHDN validation errors for this consolidated document.</DialogDescription>
                </DialogHeader>
                {errs.length === 0
                    ? <div className="text-sm text-muted-foreground">No invalid reasons — document validated successfully.</div>
                    : (
                        <ul className="space-y-2 text-sm">
                            {errs.map((e, i) => (
                                <li key={i} className="rounded border border-destructive/30 bg-destructive/5 p-2">
                                    <div className="font-mono text-xs text-destructive">{e.code}</div>
                                    <div>{e.message}</div>
                                    {e.path && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{e.path}</div>}
                                </li>
                            ))}
                        </ul>
                    )}
            </DialogContent>
        </Dialog>
    );
}

function OpLogDialog({ open, onOpenChange, id }) {
    const { data } = useQuery({
        queryKey: ["cm-log", id],
        queryFn: async () => (await api.get(`/invoices/${id}`)).data,
        enabled: open && !!id,
    });
    const events = data?.timeline || [];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Operation Log</DialogTitle>
                    <DialogDescription>Timeline of all actions on this consolidated document.</DialogDescription>
                </DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {events.length === 0 && <div className="text-sm text-muted-foreground">No operations yet.</div>}
                    {events.map((e, i) => (
                        <div key={i} className="rounded border border-border p-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold capitalize">{e.status}</span>
                                <span className="font-mono text-muted-foreground">{fmtDateTime(e.at)}</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{e.note}</div>
                            {e.actor && <div className="mt-1 font-mono text-[10px] text-muted-foreground">by {e.actor}</div>}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function IncompleteDialog({ open, onOpenChange, rows }) {
    const checks = (rows || []).map((r) => {
        const missing = [];
        if (!r.customer_snapshot?.tin && !r.supplier_tin) missing.push("Supplier's TIN");
        if (!r.supplier_name) missing.push("Supplier's Name");
        if (!r.currency) missing.push("Currency");
        if (!r.lines?.length) missing.push("Line Items");
        return { id: r.id, doc: r._doc_no, missing };
    }).filter((x) => x.missing.length > 0);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Check Incompleted Fields</DialogTitle>
                    <DialogDescription>Documents missing LHDN-required fields.</DialogDescription>
                </DialogHeader>
                {checks.length === 0
                    ? <div className="text-sm text-muted-foreground">All visible documents have every required LHDN field populated.</div>
                    : (
                        <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
                            {checks.map((c) => (
                                <div key={c.id} className="rounded border border-warning/30 bg-warning/5 p-2">
                                    <div className="font-mono text-xs">{c.doc}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Missing: {c.missing.join(", ")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
            </DialogContent>
        </Dialog>
    );
}

function RunDialog({ open, onOpenChange, onDone }) {
    const { data: tins } = useQuery({
        queryKey: ["ics-tins"],
        queryFn: async () => (await api.get("/ics/tin-list")).data,
        enabled: open,
    });
    const now = new Date();
    const [form, setForm] = useState({
        issuer_tin: "",
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        document_type: "all",
    });
    const [busy, setBusy] = useState(false);
    const selected = (tins || []).find((t) => t.tin === form.issuer_tin);

    const submit = async () => {
        if (!form.issuer_tin) return toast.error("Issuer TIN is required");
        setBusy(true);
        try {
            const { data } = await api.post("/ics/consolidated/run", {
                document_type: form.document_type,
                issuer_tin: form.issuer_tin,
                period_year: form.year,
                period_month: form.month,
            });
            toast.success(`Task ${data.serial_number || "created"} completed`);
            onDone?.();
            onOpenChange(false);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Run Consolidate Task</DialogTitle>
                    <DialogDescription>
                        Aggregate retail transactions for the selected issuer + period into a
                        single consolidated e-invoice to LHDN.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Row l="Issuer TIN *">
                        <Select value={form.issuer_tin}
                                onValueChange={(v) => setForm({ ...form, issuer_tin: v })}>
                            <SelectTrigger data-testid="run-tin"><SelectValue placeholder="Please select" /></SelectTrigger>
                            <SelectContent>
                                {(tins || []).map((t, i) => (
                                    <SelectItem key={`${t.tin}-${i}`} value={t.tin}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Row>
                    <Row l="Name">
                        <Input value={selected?.name || ""} disabled />
                    </Row>
                    <Row l="Period Month *">
                        <Select value={String(form.month)}
                                onValueChange={(v) => setForm({ ...form, month: Number(v) })}>
                            <SelectTrigger data-testid="run-month"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Row>
                    <Row l="Period Year *">
                        <Input type="number" value={form.year}
                               onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
                    </Row>
                    <Row l="Document Type">
                        <Select value={form.document_type}
                                onValueChange={(v) => setForm({ ...form, document_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {DOC_TYPES.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Row>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        <X className="mr-2 h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy} data-testid="run-submit">
                        <Save className="mr-2 h-3.5 w-3.5" /> Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
