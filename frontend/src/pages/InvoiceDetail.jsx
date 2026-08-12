import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import SigningGate from "@/components/common/SigningGate";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import { ArrowLeft, Send, XCircle, Edit3, X, Download, FileText } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ------- Malaysian LHDN-approved invoice detail (Sections A–H) -------
export default function InvoiceDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const qc = useQueryClient();
    const { data: inv, isLoading } = useQuery({
        queryKey: ["invoice", id],
        queryFn: async () => (await api.get(`/invoices/${id}`)).data,
        refetchInterval: (q) => (q.state.data?.status === "submitting" ? 1500 : false),
    });
    const [cancelReason, setCancelReason] = useState("");
    const [cancelCode, setCancelCode] = useState("1");
    const [cancelOpen, setCancelOpen] = useState(false);
    const [gateOpen, setGateOpen] = useState(false);
    const [gateAction, setGateAction] = useState(null);

    const downloadPdf = async () => {
        try {
            const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${inv?.invoice_number || "invoice"}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF downloaded");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    if (isLoading || !inv) return <Skeleton className="h-96 w-full" />;

    const gov = inv.government || {};
    const cust = inv.customer_snapshot || {};
    const lines = inv.lines || [];

    const startSubmit = () => { setGateAction("submit"); setGateOpen(true); };
    const startCancel = () => { setGateAction("cancel"); setCancelOpen(true); };

    const doGateApproved = async (sessionId) => {
        try {
            if (gateAction === "submit") {
                await api.post(`/invoices/${id}/submit`, { signing_session_id: sessionId });
                toast.success("Invoice submitted to LHDN.");
            } else {
                await api.post(`/invoices/cancel-batch`, {
                    invoiceIds: [id],
                    cancelCode: cancelCode,
                    cancelReason: cancelReason,
                });
                toast.success(`Invoice cancelled (code ${cancelCode})`);
                setCancelOpen(false); setCancelReason(""); setCancelCode("1");
            }
            qc.invalidateQueries({ queryKey: ["invoice", id] });
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setGateOpen(false); setGateAction(null); }
    };

    const canDownload = ["validated", "submitted", "cancelled"].includes(inv.status);

    const canSubmit = ["draft", "rejected"].includes(inv.status);
    const canCancel = ["validated", "submitted"].includes(inv.status);

    return (
        <div className="pb-16">
            {/* Breadcrumb + actions */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <Link to="/ics/my-transaction" className="text-muted-foreground hover:text-foreground">
                        Transaction Data Management
                    </Link>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">View</span>
                </div>
                <div className="flex gap-2">
                    {canSubmit && (
                        <Button size="sm" onClick={startSubmit} data-testid="submit-btn">
                            <Send className="mr-2 h-3.5 w-3.5" /> Submit
                        </Button>
                    )}
                    {canSubmit && (
                        <Button asChild size="sm" variant="outline" data-testid="modify-btn">
                            <Link to={`/invoices/new?from=${id}`}>
                                <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify & Issue
                            </Link>
                        </Button>
                    )}
                    {canCancel && (
                        <Button size="sm" variant="destructive" onClick={startCancel} data-testid="cancel-btn">
                            <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel / Void
                        </Button>
                    )}
                    {canDownload && (
                        <Button size="sm" variant="outline" onClick={downloadPdf} data-testid="download-pdf-btn">
                            <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => nav(-1)}>
                        <X className="mr-2 h-3.5 w-3.5" /> Close
                    </Button>
                </div>
            </div>

            <Section title="Section A: Basic Information">
                <Field l="E-Invoice Code Number" v={inv.invoice_number} />
                <Field l="E-Invoice Type" v={typeLabel(inv.invoice_type)} />
                <Field l="Invoice Currency" v={inv.currency || "MYR"} />
                <Field l="Exchange Rate" v={inv.exchange_rate || 1} />
                <Field l="K1" v="NA" />
                <Field l="Incoterms" v="NA" />
                <Field l="FTA Information" v="NA" />
                <Field l="K2" v="NA" />
                <Field l="Business System" v={inv.business_system || "—"} />
                <Field l="Store Code/Location" v={inv.store_code || "—"} />
                <Field l="E-Invoice Date Time" v={inv.created_at?.slice(0, 19).replace("T", " ") || "—"} />
                <Field l="Actual Date Time" v={gov.signed_at?.slice(0, 19).replace("T", " ") || "—"} />
                <Field l="Submission UID" v={gov.submission_uid || "—"} mono />
                <Field l="E-Invoice UUID" v={gov.uuid || "—"} mono />
                <Field l="Invoice Period from" v="—" />
                <Field l="Invoice Period to" v="—" />
                <Field l="Frequency of Billing" v="—" />
            </Section>

            <Section title="Section B: Supplier's Information">
                <Field l="TIN" v={inv.supplier_tin || "C24700902040"} mono />
                <Field l="Name" v={inv.supplier_name || "DFACE HEALTHCARE SDN BHD"} />
                <Field l="ID Type" v="Business Registration Number" />
                <Field l="ID Value" v={inv.supplier_brn || "201601034740"} mono />
                <Field l="SST Registration Number" v={inv.supplier_sst || "NA"} />
                <Field l="Tourism Tax Registration Number" v="NA" />
                <Field l="Contact Number" v={inv.supplier_phone || "+60312345678"} />
                <Field l="E-mail" v={inv.supplier_email || "—"} />
                <Field l="Malaysia Standard Industrial Classification" v={
                    inv.supplier_msic
                        ? `(${inv.supplier_msic}) ${inv.supplier_msic_desc || ""}`
                        : "(86201) General medical services"
                } />
                <Field l="Authorisation Number For Certified Exporter" v="NA" />
                <Field l="Business Activity Description" v="GP clinic with aesthetic services" full />
                <SubHeader label="Address" />
                <Field l="Country" v="MALAYSIA" />
                <Field l="State" v="Wilayah Persekutuan" />
                <Field l="City Name" v="Kuala Lumpur" />
                <Field l="Address Line 0" v="Level 12, Menara Acme" />
                <Field l="Address Line 1" v="Jalan Ampang" />
                <Field l="Address Line 2" v="—" />
                <Field l="Postal Zone" v="50450" />
            </Section>

            <Section title="Section C: Buyer's Details">
                <Field l="ID Type" v={cust.tin?.startsWith("IG") ? "NRIC" : "Business Registration Number"} />
                <Field l="ID Value" v={cust.brn || "—"} mono />
                <Field l="TIN" v={cust.tin || "—"} mono />
                <Field l="Name" v={cust.name || "—"} />
                <Field l="SST Registration Number" v="NA" />
                <Field l="Contact Number" v={cust.phone || "—"} />
                <Field l="E-mail" v={cust.email || "—"} />
                <Field l="Buyer Code" v="—" />
                <SubHeader label="Address" />
                <Field l="Country" v="MALAYSIA" />
                <Field l="State" v="—" />
                <Field l="City Name" v="—" />
                <Field l="Address Line 0" v={cust.billing_address || "—"} full />
            </Section>

            <SectionBar title="Section D: Line Item Details" />
            <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                <table className="w-full min-w-[1200px] text-sm">
                    <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                        <tr>
                            <Th>NO.</Th>
                            <Th>Classification</Th>
                            <Th>Item Name</Th>
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
                        {lines.length === 0 && (
                            <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No line items</td></tr>
                        )}
                        {lines.map((l, i) => {
                            const before = (l.quantity || 0) * (l.unit_price || 0);
                            const disc = l.discount || 0;
                            const excl = before - disc;
                            return (
                                <tr key={i} className="border-b border-border/50">
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 text-xs">
                                        {l.msic_code
                                            ? `(${l.msic_code}) ${l.msic_description || ""}`
                                            : "Medical examination"}
                                    </td>
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

            <Section title="Section E: Payment Details">
                <Field l="Payment Mode" v="—" />
                <Field l="Supplier's Bank Account Number" v="—" />
                <Field l="PrePayment Reference Number" v="—" />
                <Field l="PrePayment Amount" v="—" />
                <Field l="PrePayment Date Time" v="—" />
                <Field l="Bill Reference Number" v="—" />
                <Field l="Payment Terms" v={inv.terms || "—"} full />
            </Section>

            <SectionBar title="Section F: Tax Details" />
            <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                <table className="w-full min-w-[900px] text-sm">
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
                            <td className="px-3 py-2">{inv.tax_total > 0 ? `SST ${lines[0]?.tax_rate || 6}%` : "Not Applicable"}</td>
                            <td className="px-3 py-2 font-mono">{(lines[0]?.tax_rate || 0).toFixed(2)}</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-right font-mono">
                                {lines.reduce((s, l) => s + (l.quantity || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{fmtMoney(inv.subtotal)}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmtMoney(inv.tax_total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <SectionBar title="Section G: Additional Charge" />
            <div className="mb-6 grid place-items-center rounded-b-md border-x border-b border-border bg-card py-12 text-sm text-muted-foreground">
                No Data
            </div>

            <SectionBar title="Section H: Summary" />
            <div className="mb-6 grid grid-cols-2 gap-0 overflow-hidden rounded-b-md border-x border-b border-border bg-card md:grid-cols-4">
                <Summary l="Total Net Amount" v={fmtMoney(inv.subtotal)} />
                <Summary l="Total Discount Value" v="0.00" />
                <Summary l="Total Fee/Charge Amount" v="0.00" />
                <Summary l="Total Excluding Tax" v={fmtMoney(inv.subtotal)} />
                <Summary l="Total Tax Amount" v={fmtMoney(inv.tax_total)} />
                <Summary l="Total Including Tax" v={fmtMoney(inv.total)} />
                <Summary l="Rounding Amount" v="0.00" />
                <Summary l="Total Payable Amount" v={fmtMoney(inv.total)} highlight />
            </div>

            {/* Cancel dialog with LHDN reason code */}
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent data-testid="cancel-dialog">
                    <DialogHeader><DialogTitle>Cancel / Void invoice</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm">Cancellation Code (LHDN)</Label>
                            <Select value={cancelCode} onValueChange={setCancelCode}>
                                <SelectTrigger data-testid="cancel-code"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 — Wrong buyer details</SelectItem>
                                    <SelectItem value="2">2 — Wrong invoice details</SelectItem>
                                    <SelectItem value="3">3 — Other (reason required)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {cancelCode === "3" && (
                            <div>
                                <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
                                <Textarea
                                    placeholder="Describe why this invoice is being cancelled"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    data-testid="cancel-reason"
                                />
                            </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                            LHDN allows cancellation within 72 hours of issuance. This action is irreversible.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="destructive"
                            onClick={() => { setGateAction("cancel"); setGateOpen(true); }}
                            disabled={cancelCode === "3" && !cancelReason.trim()}
                            data-testid="cancel-confirm"
                        >
                            Continue to signing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SigningGate
                open={gateOpen}
                onOpenChange={setGateOpen}
                action={gateAction === "submit" ? "invoice.submit" : "invoice.cancel"}
                entityId={id}
                onApproved={doGateApproved}
            />
        </div>
    );
}

function typeLabel(t) {
    const map = {
        invoice: "Invoice",
        credit_note: "Credit Note",
        debit_note: "Debit Note",
        refund_note: "Refund Note",
        self_billed_invoice: "Self-Billed Invoice",
    };
    return map[t] || "Invoice";
}

function SectionBar({ title }) {
    return (
        <div className="rounded-t-md bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-foreground">
            {title}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <>
            <SectionBar title={title} />
            <div className="mb-6 grid grid-cols-1 gap-x-8 gap-y-3 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
                {children}
            </div>
        </>
    );
}

function SubHeader({ label }) {
    return (
        <div className="col-span-full mt-2 border-t border-dashed border-border pt-3 text-xs uppercase tracking-wider text-muted-foreground">
            {label}
        </div>
    );
}

function Field({ l, v, mono, full }) {
    return (
        <div className={full ? "col-span-full" : ""}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className={`mt-1 rounded border border-border bg-secondary/30 px-2 py-1.5 text-sm ${mono ? "font-mono" : ""}`}>
                {v ?? "—"}
            </div>
        </div>
    );
}

function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}

function Summary({ l, v, highlight }) {
    return (
        <div className={`flex items-center gap-3 border-b border-r border-border p-3 ${highlight ? "bg-accent/10" : ""}`}>
            <div className="w-40 rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-accent-foreground">
                {l}
            </div>
            <div className="font-mono text-sm">{v}</div>
        </div>
    );
}
