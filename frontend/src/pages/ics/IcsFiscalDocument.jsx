import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/format";
import {
    ChevronDown, ChevronUp, Search, RotateCcw, Ban, Eye, FileText,
    Share2, AlertOctagon, Activity, FileDown, QrCode, X,
} from "lucide-react";

const GENERAL_PUBLIC_TIN = "EI00000000010";
const GENERAL_PUBLIC_NAME = "General Public";
const DEFAULT_SUP_TIN = "C24700902040";
const DEFAULT_SUP_NAME = "DFACE HEALTHCARE SDN BHD";

function docNo(id, i) {
    const seed = parseInt(String(id).slice(-6), 16) || (10000 + i);
    const a = 3346680000 + (seed % 90000);
    const b = a + 7000 + (i * 300);
    return `S-${a}-S-${b}`;
}
function shortDesc(lines = []) {
    if (!lines.length) return "—";
    const first = lines.slice(0, 2).map((l) => l.description).join(",");
    return lines.length > 2 ? `${first}, …` : first;
}
function fmtDT(d) { return d ? String(d).slice(0, 19).replace("T", " ") : "—"; }

export default function IcsFiscalDocument() {
    const { currentId } = useCompany();
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [previewOpen, setPreviewOpen] = useState(false);
    const [pdfOpen, setPdfOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [f, setF] = useState({
        document_no: "", document_type: "all", status: "all",
        submission_uid: "", uuid: "", supplier_tin: "", buyer_tin: "",
    });
    const [applied, setApplied] = useState(f);

    const qs = new URLSearchParams();
    if (currentId) qs.set("company_id", currentId);
    if (applied.document_type !== "all") qs.set("document_type", applied.document_type);
    if (applied.status !== "all") qs.set("status", applied.status);
    qs.set("limit", "500");
    const { data, isLoading } = useQuery({
        queryKey: ["invoice-mgmt", qs.toString()],
        queryFn: async () => (await api.get(`/ics/transactions?${qs}`)).data,
    });

    const rows = useMemo(() => (data?.rows || []).map((r, i) => ({
        ...r, _doc_no: docNo(r.id, i),
        _sub_uid: r.government?.submission_uid || `${(r.id + "").slice(-14).toUpperCase()}Z16ZK10`,
        _uuid: r.government?.uuid || `${(r.id + "").slice(-14).toUpperCase()}Z16ZK10`,
        _desc: shortDesc(r.lines),
    })).filter((r) => {
        if (applied.document_no && !r._doc_no.toLowerCase().includes(applied.document_no.toLowerCase())) return false;
        if (applied.submission_uid && !r._sub_uid.toLowerCase().includes(applied.submission_uid.toLowerCase())) return false;
        if (applied.uuid && !r._uuid.toLowerCase().includes(applied.uuid.toLowerCase())) return false;
        if (applied.supplier_tin && !(r.supplier_tin || DEFAULT_SUP_TIN).includes(applied.supplier_tin)) return false;
        if (applied.buyer_tin && !GENERAL_PUBLIC_TIN.includes(applied.buyer_tin)) return false;
        return true;
    }), [data, applied]);

    const totalNet = rows.reduce((s, r) => s + (r.subtotal || 0), 0);
    const oneId = () => (selected.size === 1 ? [...selected][0] : null);
    const toggle = (id) => {
        const n = new Set(selected);
        n.has(id) ? n.delete(id) : n.add(id);
        setSelected(n);
    };
    const toggleAll = () => selected.size === rows.length
        ? setSelected(new Set()) : setSelected(new Set(rows.map((r) => r.id)));

    const reset = () => {
        const e = { document_no: "", document_type: "all", status: "all",
            submission_uid: "", uuid: "", supplier_tin: "", buyer_tin: "" };
        setF(e); setApplied(e);
    };
    const requireOne = () => oneId() || toast.error("Select exactly one row");

    const exportCsv = () => {
        const cols = ["NO.", "Document Type", "Document NO.", "Submission UID", "E-Invoice UUID",
            "Description", "Supplier's TIN", "Supplier's Name", "Buyer's TIN", "Buyer's Name", "Total Net Amount"];
        const csv = [cols.join(",")].concat(rows.map((r, i) => [
            i + 1, "Invoice", r._doc_no, r._sub_uid, r._uuid, r._desc,
            r.supplier_tin || DEFAULT_SUP_TIN, r.supplier_name || DEFAULT_SUP_NAME,
            GENERAL_PUBLIC_TIN, GENERAL_PUBLIC_NAME, r.subtotal || 0,
        ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `invoice-management-${Date.now()}.csv`; a.click();
    };
    const exportQr = () => {
        const cols = ["NO.", "Document NO.", "E-Invoice UUID", "QR URL"];
        const csv = [cols.join(",")].concat(rows.map((r, i) => [
            i + 1, r._doc_no, r._uuid, r.government?.qr || `https://preprod.myinvois.hasil.gov.my/${r._uuid}`,
        ].map((v) => `"${v}"`).join(","))).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `invoice-qr-list-${Date.now()}.csv`; a.click();
    };

    return (
        <div>
            <PageHeader kicker="EIW · My Fiscal Document" title="Invoice Management"
                        subtitle="LHDN e-invoice fiscal document register." />

            <section className="mb-4 rounded-md border border-border bg-card">
                <button onClick={() => setExpanded((v) => !v)}
                        className="flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                        data-testid="im-expand">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Expand
                </button>
                {expanded && (
                    <>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-6 md:grid-cols-2">
                            <Row l="Document NO."><Input value={f.document_no} onChange={(e) => setF({ ...f, document_no: e.target.value })} placeholder="S-XXXXXXX-S-XXXXXXX" /></Row>
                            <Row l="Document Type">
                                <Select value={f.document_type} onValueChange={(v) => setF({ ...f, document_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="invoice">Invoice</SelectItem>
                                        <SelectItem value="credit_note">Credit Note</SelectItem>
                                        <SelectItem value="debit_note">Debit Note</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Row>
                            <Row l="Submission UID"><Input value={f.submission_uid} onChange={(e) => setF({ ...f, submission_uid: e.target.value })} /></Row>
                            <Row l="E-Invoice UUID"><Input value={f.uuid} onChange={(e) => setF({ ...f, uuid: e.target.value })} /></Row>
                            <Row l="Supplier's TIN"><Input value={f.supplier_tin} onChange={(e) => setF({ ...f, supplier_tin: e.target.value })} /></Row>
                            <Row l="Buyer's TIN"><Input value={f.buyer_tin} onChange={(e) => setF({ ...f, buyer_tin: e.target.value })} placeholder="EI00000000010" /></Row>
                        </div>
                        <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                            <Button variant="secondary" size="sm" onClick={() => setApplied(f)} data-testid="im-search">
                                <Search className="mr-2 h-3.5 w-3.5" /> Search
                            </Button>
                            <Button variant="secondary" size="sm" onClick={reset}>
                                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                            </Button>
                        </div>
                    </>
                )}
            </section>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} data-testid="im-cancel">
                    <Ban className="mr-2 h-3.5 w-3.5" /> Cancel
                </Button>
                <Button variant="outline" size="sm" onClick={() => requireOne() && setPreviewOpen(true)} data-testid="im-view">
                    <Eye className="mr-2 h-3.5 w-3.5" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={() => requireOne() && setPdfOpen(true)} data-testid="im-pdf">
                    <FileText className="mr-2 h-3.5 w-3.5" /> View Invoice PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => requireOne() && setShareOpen(true)} data-testid="im-share">
                    <Share2 className="mr-2 h-3.5 w-3.5" /> Share Invoice PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => requireOne() && setReasonsOpen(true)} data-testid="im-reasons">
                    <AlertOctagon className="mr-2 h-3.5 w-3.5" /> View Invalid Reasons
                </Button>
                <Button variant="outline" size="sm" onClick={() => requireOne() && setLogOpen(true)} data-testid="im-log">
                    <Activity className="mr-2 h-3.5 w-3.5" /> Operation Log
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} data-testid="im-export">
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setQrOpen(true); exportQr(); }} data-testid="im-export-qr">
                    <QrCode className="mr-2 h-3.5 w-3.5" /> Export QR Code List
                </Button>
            </div>

            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3">
                                    <input type="checkbox"
                                           checked={rows.length > 0 && selected.size === rows.length}
                                           onChange={toggleAll} data-testid="im-select-all" />
                                </th>
                                <Th>NO.</Th>
                                <Th>Document Type</Th>
                                <Th>Document NO.</Th>
                                <Th>Submission UID</Th>
                                <Th>E-Invoice UUID</Th>
                                <Th>Description of Product or Service</Th>
                                <Th>Supplier&apos;s TIN</Th>
                                <Th>Supplier&apos;s Name</Th>
                                <Th>Buyer&apos;s TIN</Th>
                                <Th>Buyer&apos;s Name</Th>
                                <Th className="text-right">Total Net Amount</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="im-table">
                            {rows.length === 0 ? (
                                <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40"
                                    data-testid={`im-row-${r.id}`}>
                                    <td className="px-3 py-2">
                                        <input type="checkbox" checked={selected.has(r.id)}
                                               onChange={() => toggle(r.id)}
                                               data-testid={`im-select-${r.id}`} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 capitalize">
                                        {r.invoice_type?.replaceAll("_", " ") || "Invoice"}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">
                                        <Link to={`/invoices/${r.id}`} className="text-primary hover:underline">
                                            {r._doc_no}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px] uppercase">{r._sub_uid}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] uppercase">{r._uuid}</td>
                                    <td className="px-3 py-2 max-w-[240px] truncate" title={r._desc}>{r._desc}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin || DEFAULT_SUP_TIN}</td>
                                    <td className="px-3 py-2">{r.supplier_name || DEFAULT_SUP_NAME}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{GENERAL_PUBLIC_TIN}</td>
                                    <td className="px-3 py-2">{GENERAL_PUBLIC_NAME}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                                    <td colSpan={11} className="px-3 py-3">Total</td>
                                    <td className="px-3 py-3 text-right font-mono">{fmtMoney(totalNet)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            <ViewDialog open={previewOpen} onOpenChange={setPreviewOpen} id={oneId()} />
            <PdfDialog open={pdfOpen} onOpenChange={setPdfOpen} id={oneId()} />
            <ShareDialog open={shareOpen} onOpenChange={setShareOpen} id={oneId()} />
            <ReasonsDialog open={reasonsOpen} onOpenChange={setReasonsOpen} id={oneId()} rows={rows} />
            <OpLogDialog open={logOpen} onOpenChange={setLogOpen} id={oneId()} />
            <QrExportDialog open={qrOpen} onOpenChange={setQrOpen} count={rows.length} />
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

function ViewDialog({ open, onOpenChange, id }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>View Invoice</DialogTitle>
                    <DialogDescription>Open the full LHDN Sections A–H detail page.</DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                    <Button asChild variant="outline"><Link to={id ? `/invoices/${id}` : "#"}>Open</Link></Button>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
function PdfDialog({ open, onOpenChange, id }) {
    const dl = () => {
        window.open(`/api/invoices/${id}/pdf`, "_blank");
        onOpenChange(false);
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invoice PDF</DialogTitle>
                    <DialogDescription>Download the signed LHDN PDF for this document.</DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                    <Button onClick={dl} data-testid="im-pdf-dl">Download</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
function ShareDialog({ open, onOpenChange, id }) {
    const link = `${window.location.origin}/api/invoices/${id}/pdf`;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share Invoice PDF</DialogTitle>
                    <DialogDescription>Copy the public link to share with the buyer.</DialogDescription>
                </DialogHeader>
                <Input value={link} readOnly data-testid="im-share-link" />
                <div className="flex justify-end gap-2">
                    <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}
                            data-testid="im-share-copy">Copy</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
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
                    <DialogDescription>LHDN validation errors for this document.</DialogDescription>
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
        queryKey: ["im-log", id],
        queryFn: async () => (await api.get(`/invoices/${id}`)).data,
        enabled: open && !!id,
    });
    const events = data?.timeline || [];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Operation Log</DialogTitle>
                    <DialogDescription>Every action on this document.</DialogDescription>
                </DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {events.length === 0 && <div className="text-sm text-muted-foreground">No events.</div>}
                    {events.map((e, i) => (
                        <div key={i} className="rounded border border-border p-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold capitalize">{e.status}</span>
                                <span className="font-mono text-muted-foreground">{fmtDT(e.at)}</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{e.note}</div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
function QrExportDialog({ open, onOpenChange, count }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>QR Code List Exported</DialogTitle>
                    <DialogDescription>{count} QR entries downloaded as CSV.</DialogDescription>
                </DialogHeader>
                <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)}>
                        <X className="mr-2 h-3.5 w-3.5" /> Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
