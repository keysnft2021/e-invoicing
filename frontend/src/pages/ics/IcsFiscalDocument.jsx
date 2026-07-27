import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtMoney, fmtDay } from "@/lib/format";
import {
    Search, RotateCcw, Eye, Ban, FileText, Share2, AlertOctagon,
    Activity, FileDown, QrCode, ChevronDown, ChevronUp, PlusCircle,
} from "lucide-react";

const CONFIRMATION_STATUSES = ["pending", "confirmed", "rejected"];
const SOURCES = ["portal", "erp", "csv_upload", "api"];
const CURRENCIES = ["MYR", "USD", "SGD", "EUR", "CNY"];
const INVOICE_STATUSES = ["draft", "submitting", "validated", "rejected", "cancelled", "voided"];

export default function IcsFiscalDocument() {
    return (
        <div>
            <PageHeader
                kicker="ICS · My Fiscal Document"
                title="Fiscal Document Management"
                subtitle="Browse, cancel, share and export LHDN-validated fiscal documents."
            />
            <Tabs defaultValue="invoice" className="w-full">
                <TabsList data-testid="fd-tabs">
                    <TabsTrigger value="invoice" data-testid="tab-invoice-mgmt">Invoice Management</TabsTrigger>
                    <TabsTrigger value="purchase" data-testid="tab-purchase">My Purchase Invoices</TabsTrigger>
                    <TabsTrigger value="credit" data-testid="tab-credit">Credit Note Management</TabsTrigger>
                    <TabsTrigger value="debit" data-testid="tab-debit">Debit Note Management</TabsTrigger>
                    <TabsTrigger value="refund" data-testid="tab-refund">Refund Note Management</TabsTrigger>
                </TabsList>
                <TabsContent value="invoice" className="mt-6"><DocumentPanel kind="invoice" /></TabsContent>
                <TabsContent value="purchase" className="mt-6"><PurchasePanel /></TabsContent>
                <TabsContent value="credit" className="mt-6"><DocumentPanel kind="credit_note" /></TabsContent>
                <TabsContent value="debit" className="mt-6"><DocumentPanel kind="debit_note" /></TabsContent>
                <TabsContent value="refund" className="mt-6"><DocumentPanel kind="refund_note" /></TabsContent>
            </Tabs>
        </div>
    );
}

/** Shared panel for Invoice / Credit / Debit / Refund management */
function DocumentPanel({ kind }) {
    const qc = useQueryClient();
    const [advanced, setAdvanced] = useState(false);
    const [F, setF] = useState({
        document_type: kind,
        document_no: "",
        e_invoice_uuid: "",
        original_invoice_uuid: "",
        issuer_tin: "",
        invoice_status: "",
        issued_from: new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10),
        issued_to: new Date().toISOString().slice(0, 10),
        supplier_tin: "",
        supplier_name: "",
        buyer_tin: "",
        buyer_name: "",
        invoice_confirmation_status: "",
        source: "",
        currency: "",
        submission_uid: "",
    });
    const [applied, setApplied] = useState(F);
    const [selected, setSelected] = useState(new Set());
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [reasonsData, setReasonsData] = useState(null);
    const [logOpen, setLogOpen] = useState(false);
    const [logData, setLogData] = useState([]);

    const q = useMemo(() => {
        const p = new URLSearchParams();
        p.append("document_type", kind);
        if (applied.document_no) p.append("document_no", applied.document_no);
        if (applied.e_invoice_uuid) p.append("e_invoice_uuid", applied.e_invoice_uuid);
        if (applied.issuer_tin) p.append("supplier_tin", applied.issuer_tin);
        if (applied.invoice_status) p.append("invoice_status", applied.invoice_status);
        if (applied.issued_from) p.append("transaction_date_from", applied.issued_from);
        if (applied.issued_to) p.append("transaction_date_to", applied.issued_to);
        if (applied.supplier_tin) p.append("supplier_tin", applied.supplier_tin);
        if (applied.supplier_name) p.append("supplier_name", applied.supplier_name);
        if (applied.buyer_tin) p.append("buyer_tin", applied.buyer_tin);
        if (applied.buyer_name) p.append("buyer_name", applied.buyer_name);
        if (applied.invoice_confirmation_status) p.append("invoice_confirmation_status", applied.invoice_confirmation_status);
        if (applied.source) p.append("source", applied.source);
        if (applied.currency) p.append("currency", applied.currency);
        return p.toString();
    }, [applied, kind]);

    const { data, isLoading } = useQuery({
        queryKey: ["fd-list", kind, q],
        queryFn: async () => (await api.get(`/ics/transactions?${q}`)).data,
    });

    const set = (k, v) => setF({ ...F, [k]: v });
    const one = () => (selected.size === 1 ? [...selected][0] : null);
    const toggle = (id) => {
        const nxt = new Set(selected);
        nxt.has(id) ? nxt.delete(id) : nxt.add(id);
        setSelected(nxt);
    };
    const toggleAll = () => {
        if (selected.size === (data?.rows?.length || 0)) setSelected(new Set());
        else setSelected(new Set((data?.rows || []).map((r) => r.id)));
    };

    const doCancel = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        try {
            await api.post(`/ics/transactions/${id}/request-cancel`, { reason });
            toast.success("Cancellation requested");
            setCancelOpen(false); setReason(""); setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["fd-list"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const doRequestCN = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        try {
            const { data } = await api.post(`/ics/transactions/${id}/request-credit-note`);
            toast.success(`Credit note ${data.invoice_number} created`);
            qc.invalidateQueries({ queryKey: ["fd-list"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const openReasons = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        try {
            const { data } = await api.get(`/ics/transactions/${id}/invalid-reasons`);
            setReasonsData(data); setReasonsOpen(true);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const openLog = async () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        try {
            const { data } = await api.get(`/ics/transactions/${id}/operation-log`);
            setLogData(data); setLogOpen(true);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const share = () => {
        const id = one();
        if (!id) return toast.error("Select exactly one row");
        const url = `${window.location.origin}/invoices/${id}`;
        navigator.clipboard.writeText(url);
        toast.success("Invoice link copied — share via email or chat");
    };

    const exportCsv = (qrOnly = false) => {
        const rows = data?.rows || [];
        const cols = qrOnly
            ? ["NO", "Document NO", "E-Invoice UUID", "QR URL"]
            : ["NO", "Document Type", "Document NO", "Submission UID", "E-Invoice UUID",
               "Supplier TIN", "Supplier Name", "Buyer TIN", "Buyer Name",
               "Issued Date", "Status", "Currency", "Total"];
        const line = (r, i) => qrOnly
            ? [i + 1, r.invoice_number, r.government?.uuid || "", r.government?.qr || ""]
            : [i + 1, r.invoice_type, r.invoice_number, r.government?.submission_uid || "",
               r.government?.uuid || "", r.supplier_tin || "", r.supplier_name || "",
               r.customer_snapshot?.tin || "", r.customer_snapshot?.name || "",
               r.invoice_date || "", r.status, r.currency, r.total];
        const csv = [cols.join(",")]
            .concat(rows.map((r, i) => line(r, i).map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${kind}-${qrOnly ? "qr-" : ""}${Date.now()}.csv`; a.click();
    };

    return (
        <div>
            {/* Filters */}
            <section className="rounded-xl border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <FR l="Document Type">
                        <Select value={F.document_type} onValueChange={(v) => set("document_type", v)}>
                            <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={kind}>All</SelectItem>
                                {kind === "debit_note" && (<>
                                    <SelectItem value="debit_note">Debit Note</SelectItem>
                                    <SelectItem value="self_billed_debit_note">Self-billed Debit Note</SelectItem>
                                </>)}
                                {kind === "credit_note" && (<>
                                    <SelectItem value="credit_note">Credit Note</SelectItem>
                                    <SelectItem value="self_billed_credit_note">Self-billed Credit Note</SelectItem>
                                </>)}
                                {kind === "refund_note" && (<>
                                    <SelectItem value="refund_note">Refund Note</SelectItem>
                                    <SelectItem value="self_billed_refund_note">Self-billed Refund Note</SelectItem>
                                </>)}
                                {kind === "invoice" && (<>
                                    <SelectItem value="invoice">Invoice</SelectItem>
                                    <SelectItem value="self_billed_invoice">Self-billed Invoice</SelectItem>
                                </>)}
                            </SelectContent>
                        </Select>
                    </FR>
                    <FR l="Document NO.">
                        <Input value={F.document_no} onChange={(e) => set("document_no", e.target.value)} data-testid="fd-doc-no" />
                    </FR>
                    <FR l={kind === "credit_note" ? "E-Invoice UUID" : "Submission UID"}>
                        <Input value={kind === "credit_note" ? F.e_invoice_uuid : F.submission_uid}
                            onChange={(e) => set(kind === "credit_note" ? "e_invoice_uuid" : "submission_uid", e.target.value)} />
                    </FR>
                    {kind === "credit_note" ? (
                        <FR l="Original Invoice UUID">
                            <Input value={F.original_invoice_uuid}
                                onChange={(e) => set("original_invoice_uuid", e.target.value)} />
                        </FR>
                    ) : (
                        <FR l="E-Invoice UUID">
                            <Input value={F.e_invoice_uuid} onChange={(e) => set("e_invoice_uuid", e.target.value)} />
                        </FR>
                    )}
                    <FR l="Issuer TIN">
                        <Input value={F.issuer_tin} onChange={(e) => set("issuer_tin", e.target.value)} data-testid="fd-issuer-tin" />
                    </FR>
                    <FR l="Invoice Status">
                        <Select value={F.invoice_status} onValueChange={(v) => set("invoice_status", v)}>
                            <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {INVOICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FR>
                    <FR l="Issued Date from">
                        <Input type="date" value={F.issued_from} onChange={(e) => set("issued_from", e.target.value)} />
                    </FR>
                    <FR l="to">
                        <Input type="date" value={F.issued_to} onChange={(e) => set("issued_to", e.target.value)} />
                    </FR>
                    {advanced && (
                        <>
                            <FR l="Supplier's TIN"><Input value={F.supplier_tin} onChange={(e) => set("supplier_tin", e.target.value)} /></FR>
                            <FR l="Supplier's Name"><Input value={F.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} /></FR>
                            <FR l="Buyer's TIN"><Input value={F.buyer_tin} onChange={(e) => set("buyer_tin", e.target.value)} /></FR>
                            <FR l="Buyer's Name"><Input value={F.buyer_name} onChange={(e) => set("buyer_name", e.target.value)} /></FR>
                            <FR l="Invoice Confirmation Status">
                                <Select value={F.invoice_confirmation_status} onValueChange={(v) => set("invoice_confirmation_status", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>
                                        {CONFIRMATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FR>
                            <FR l="Source">
                                <Select value={F.source} onValueChange={(v) => set("source", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </FR>
                            <FR l="Currency">
                                <Select value={F.currency} onValueChange={(v) => set("currency", v)}>
                                    <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </FR>
                        </>
                    )}
                </div>
            </section>

            <div className="my-3 flex items-center justify-end gap-2 rounded-md bg-accent px-3 py-2">
                <Button size="sm" variant="secondary" onClick={() => setApplied(F)}><Search className="mr-2 h-3.5 w-3.5" /> Search</Button>
                <Button size="sm" variant="secondary" onClick={() => { setF({ ...F, document_no: "", e_invoice_uuid: "", issuer_tin: "", invoice_status: "", supplier_tin: "", supplier_name: "", buyer_tin: "", buyer_name: "", invoice_confirmation_status: "", source: "", currency: "", submission_uid: "", original_invoice_uuid: "" }); setApplied({ ...applied, document_no: "" }); }}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAdvanced(!advanced)}>
                    {advanced ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Basic Search</>
                              : <><ChevronDown className="mr-2 h-3.5 w-3.5" /> Advanced Search</>}
                </Button>
            </div>

            {/* Ops */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                {kind === "credit_note" && (
                    <Button variant="outline" size="sm" onClick={doRequestCN} disabled={selected.size !== 1} data-testid="fd-request-cn">
                        <PlusCircle className="mr-2 h-3.5 w-3.5" /> Request Credit Note
                    </Button>
                )}
                <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={selected.size !== 1} data-testid="fd-cancel">
                            <Ban className="mr-2 h-3.5 w-3.5" /> Cancel
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Cancel document</DialogTitle></DialogHeader>
                        <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="fd-cancel-reason" />
                        <DialogFooter><Button variant="destructive" onClick={doCancel}>Confirm</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                <Button asChild variant="outline" size="sm" disabled={selected.size !== 1} data-testid="fd-view">
                    <Link to={one() ? `/invoices/${one()}` : "#"}><Eye className="mr-2 h-3.5 w-3.5" /> View</Link>
                </Button>
                {kind !== "credit_note" && (
                    <>
                        <Button asChild variant="outline" size="sm" disabled={selected.size !== 1} data-testid="fd-view-pdf">
                            <Link to={one() ? `/invoices/${one()}` : "#"} target="_blank"><FileText className="mr-2 h-3.5 w-3.5" /> View Invoice PDF</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={share} disabled={selected.size !== 1} data-testid="fd-share">
                            <Share2 className="mr-2 h-3.5 w-3.5" /> Share Invoice PDF
                        </Button>
                    </>
                )}
                <Button variant="outline" size="sm" onClick={openReasons} disabled={selected.size !== 1} data-testid="fd-reasons">
                    <AlertOctagon className="mr-2 h-3.5 w-3.5" /> View Invalid Reasons
                </Button>
                {kind !== "credit_note" && (
                    <Button variant="outline" size="sm" onClick={openLog} disabled={selected.size !== 1} data-testid="fd-log">
                        <Activity className="mr-2 h-3.5 w-3.5" /> Operation Log
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => exportCsv(false)} data-testid="fd-export">
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
                {kind !== "credit_note" && (
                    <Button variant="outline" size="sm" onClick={() => exportCsv(true)} data-testid="fd-export-qr">
                        <QrCode className="mr-2 h-3.5 w-3.5" /> Export QR Code List
                    </Button>
                )}
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-accent text-accent-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3">
                                    <input type="checkbox" onChange={toggleAll} checked={selected.size === (data?.rows?.length || 0) && data?.rows?.length > 0} />
                                </th>
                                <Th>NO.</Th><Th>Document Type</Th><Th>Document NO.</Th>
                                <Th>Submission UID</Th><Th>E-Invoice UUID</Th>
                                {kind === "credit_note" && (<>
                                    <Th>Original Invoice Code Number</Th><Th>Original Invoice UUID</Th>
                                </>)}
                                <Th>Description of Product or Service</Th><Th>Supplier's Name</Th>
                                <Th>Buyer's Name</Th><Th>Issued Date</Th>
                                <Th className="text-right">Total</Th><Th>Status</Th>
                            </tr>
                        </thead>
                        <tbody data-testid={`fd-table-${kind}`}>
                            {(data?.rows || []).length === 0 ? (
                                <tr><td colSpan={14} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : (data.rows).map((r, i) => (
                                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-3 py-2">
                                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} data-testid={`fd-sel-${r.id}`} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 capitalize">{r.invoice_type?.replaceAll("_", " ")}</td>
                                    <td className="px-3 py-2 font-mono text-xs">
                                        <Link to={`/invoices/${r.id}`} className="hover:underline">{r.invoice_number}</Link>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                        {r.government?.submission_uid || "—"}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                        {r.government?.uuid || "—"}
                                    </td>
                                    {kind === "credit_note" && (<>
                                        <td className="px-3 py-2 font-mono text-xs">{r.original_invoice_number || "—"}</td>
                                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                                            {r.original_invoice_uuid || "—"}
                                        </td>
                                    </>)}
                                    <td className="px-3 py-2 text-xs max-w-xs truncate">
                                        {(r.lines || []).map((l) => l.description).filter(Boolean).join(", ") || "—"}
                                    </td>
                                    <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                                    <td className="px-3 py-2">{r.customer_snapshot?.name || "—"}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDay(r.invoice_date || r.created_at)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total, r.currency)}</td>
                                    <td className="px-3 py-2"><StatusChip status={r.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-border bg-secondary/30">
                                <td colSpan={kind === "credit_note" ? 12 : 12} className="px-3 py-3 text-sm font-medium">Total</td>
                                <td className="px-3 py-3 text-right font-mono">{fmtMoney(data?.total || 0)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <Dialog open={reasonsOpen} onOpenChange={setReasonsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Invalid reasons</DialogTitle></DialogHeader>
                    {(reasonsData?.errors || []).length === 0 ? (
                        <div className="text-sm text-muted-foreground">No invalid reasons — status {reasonsData?.status}.</div>
                    ) : reasonsData.errors.map((e, i) => (
                        <div key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                            <div className="font-mono font-semibold">{e.code}</div>
                            <div className="mt-1">{e.message}</div>
                        </div>
                    ))}
                </DialogContent>
            </Dialog>
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Operation log</DialogTitle></DialogHeader>
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                        {logData.length === 0 && <div className="text-sm text-muted-foreground">No entries.</div>}
                        {logData.map((l) => (
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
        </div>
    );
}

/** My Purchase Invoices — different fields per screenshot */
function PurchasePanel() {
    const qc = useQueryClient();
    const { data: tins } = useQuery({
        queryKey: ["ics-tins"],
        queryFn: async () => (await api.get("/ics/tin-list")).data,
    });
    const [F, setF] = useState({
        buyer_tin: "",
        type_name: "",
        status: "",
        uuid: "",
        search_query: "",
        submission_from: "",
        submission_to: "",
        issued_from: new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10),
        issued_to: new Date().toISOString().slice(0, 10),
    });
    const [applied, setApplied] = useState(F);
    const [selected, setSelected] = useState(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState("");

    const q = useMemo(() => {
        const p = new URLSearchParams();
        if (applied.buyer_tin) p.append("buyer_tin", applied.buyer_tin);
        if (applied.type_name) p.append("document_type", applied.type_name);
        if (applied.status) p.append("invoice_status", applied.status);
        if (applied.uuid) p.append("e_invoice_uuid", applied.uuid);
        if (applied.search_query) p.append("document_no", applied.search_query);
        if (applied.issued_from) p.append("transaction_date_from", applied.issued_from);
        if (applied.issued_to) p.append("transaction_date_to", applied.issued_to);
        return p.toString();
    }, [applied]);

    const { data, isLoading } = useQuery({
        queryKey: ["fd-purchase", q],
        queryFn: async () => (await api.get(`/ics/transactions?${q}`)).data,
    });

    const set = (k, v) => setF({ ...F, [k]: v });

    const doReject = async () => {
        if (!selected) return toast.error("Select a row");
        try {
            await api.post(`/ics/transactions/${selected}/reject`, { reason });
            toast.success("Rejected");
            setRejectOpen(false); setReason("");
            qc.invalidateQueries({ queryKey: ["fd-purchase"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div>
            <section className="rounded-xl border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <FR l="Buyer's TIN">
                        <Select value={F.buyer_tin} onValueChange={(v) => set("buyer_tin", v)}>
                            <SelectTrigger data-testid="pi-buyer-tin"><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {(tins || []).map((t) => (
                                    <SelectItem key={t.tin} value={t.tin}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FR>
                    <FR l="Type Name">
                        <Select value={F.type_name} onValueChange={(v) => set("type_name", v)}>
                            <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice">Invoice</SelectItem>
                                <SelectItem value="credit_note">Credit Note</SelectItem>
                                <SelectItem value="debit_note">Debit Note</SelectItem>
                                <SelectItem value="refund_note">Refund Note</SelectItem>
                                <SelectItem value="self_billed_invoice">Self-billed Invoice</SelectItem>
                            </SelectContent>
                        </Select>
                    </FR>
                    <FR l="Status">
                        <Select value={F.status} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {INVOICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FR>
                    <FR l="UUID"><Input value={F.uuid} onChange={(e) => set("uuid", e.target.value)} data-testid="pi-uuid" /></FR>
                    <FR l="Search Query" full>
                        <Input value={F.search_query} onChange={(e) => set("search_query", e.target.value)} placeholder="Document number, description, keyword…" />
                    </FR>
                    <FR l="Submission Date from"><Input type="date" value={F.submission_from} onChange={(e) => set("submission_from", e.target.value)} /></FR>
                    <FR l="to"><Input type="date" value={F.submission_to} onChange={(e) => set("submission_to", e.target.value)} /></FR>
                    <FR l="Issued Date from"><Input type="date" value={F.issued_from} onChange={(e) => set("issued_from", e.target.value)} /></FR>
                    <FR l="to"><Input type="date" value={F.issued_to} onChange={(e) => set("issued_to", e.target.value)} /></FR>
                </div>
            </section>

            <div className="my-3 flex items-center justify-end gap-2 rounded-md bg-accent px-3 py-2">
                <Button size="sm" variant="secondary" onClick={() => setApplied(F)} data-testid="pi-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setF({ ...F, buyer_tin: "", type_name: "", status: "", uuid: "", search_query: "" }); setApplied({ ...applied, buyer_tin: "", type_name: "", status: "", uuid: "", search_query: "" }); }}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" disabled={!selected} data-testid="pi-view">
                    <Link to={selected ? `/invoices/${selected}` : "#"}><Eye className="mr-2 h-3.5 w-3.5" /> View</Link>
                </Button>
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={!selected} data-testid="pi-reject">
                            <Ban className="mr-2 h-3.5 w-3.5" /> Reject
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Reject purchase invoice</DialogTitle></DialogHeader>
                        <Textarea placeholder="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="pi-reject-reason" />
                        <DialogFooter><Button variant="destructive" onClick={doReject}>Confirm reject</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" data-testid="pi-export">
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
                                <Th>NO.</Th><Th>UUID</Th><Th>Submission UID</Th>
                                <Th>Long ID</Th><Th>Internal ID</Th><Th>Type Name</Th>
                                <Th>Supplier's Name</Th><Th>Issued Date</Th>
                                <Th className="text-right">Total</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="pi-table">
                            {(data?.rows || []).length === 0 ? (
                                <tr><td colSpan={10} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : data.rows.map((r, i) => (
                                <tr key={r.id} className={`border-b border-border/50 cursor-pointer hover:bg-secondary/40 ${selected === r.id ? "bg-secondary/60" : ""}`}
                                    onClick={() => setSelected(r.id === selected ? null : r.id)}>
                                    <td className="px-3 py-2">
                                        <input type="radio" checked={selected === r.id} onChange={() => setSelected(r.id)} data-testid={`pi-radio-${r.id}`} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.government?.uuid || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.government?.submission_uid || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.government?.long_id || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                                    <td className="px-3 py-2 capitalize">{r.invoice_type?.replaceAll("_", " ")}</td>
                                    <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDay(r.invoice_date || r.created_at)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total, r.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function FR({ l, children, full }) {
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
