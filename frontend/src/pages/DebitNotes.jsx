import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
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
import { fmtMoney } from "@/lib/format";
import { ChevronDown, ChevronUp, Search, RotateCcw, PlayCircle, X, Save } from "lucide-react";
import { COUNTRIES, MY_STATES, citiesFor, areasFor } from "@/lib/malaysia";

const GENERAL_PUBLIC_TIN = "EI00000000010";
const GENERAL_PUBLIC_NAME = "General Public";

function fmtDateTime(d) {
    return d ? String(d).slice(0, 19).replace("T", " ") : "";
}
function periodOf(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const last = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}
function docNo(id, i) {
    const seed = parseInt(String(id).slice(-6), 16) || (10000 + i);
    const a = 3346680000 + (seed % 90000);
    const b = a + 7000 + (i * 300);
    return `S-${a}-S-${b}`;
}

export default function DebitNotes() {
    const [view, setView] = useState("list"); // list | form
    const [selectedInv, setSelectedInv] = useState(null);
    const { currentId } = useCompany();

    const qs = new URLSearchParams();
    if (currentId) qs.set("company_id", currentId);
    qs.set("limit", "500");
    const { data, isLoading } = useQuery({
        queryKey: ["debit-notes-src", qs.toString()],
        queryFn: async () => (await api.get(`/ics/transactions?${qs}`)).data,
    });

    const rows = useMemo(() => (data?.rows || []).map((r, i) => ({
        ...r, _doc_no: docNo(r.id, i), _period: periodOf(r.invoice_date || r.created_at),
    })), [data]);

    if (view === "form" && selectedInv) {
        return <RequestDebitNote invoice={selectedInv}
                                 onCancel={() => { setView("list"); setSelectedInv(null); }} />;
    }

    return (
        <div>
            <PageHeader
                kicker="EIS · Debit Note Management"
                title="Debit Note Management"
                subtitle="Select a source invoice to raise a debit note against."
            />
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3" />
                                <Th>NO.</Th>
                                <Th>Document Type</Th>
                                <Th>Document NO.</Th>
                                <Th>E-Invoice UUID</Th>
                                <Th>Buyer&apos;s TIN</Th>
                                <Th>Buyer&apos;s Name</Th>
                                <Th className="text-right">Total Excluding Tax</Th>
                                <Th className="text-right">Total Including Tax</Th>
                                <Th className="text-right">Total Payable Amount</Th>
                                <Th className="text-right">Total Tax Amount</Th>
                                <Th>Date Time Issued</Th>
                                <Th>Issuer TIN</Th>
                            </tr>
                        </thead>
                        <tbody data-testid="dn-source-table">
                            {rows.length === 0 ? (
                                <tr><td colSpan={13} className="p-12 text-center text-muted-foreground">No Data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id}
                                    onClick={() => { setSelectedInv(r); setView("form"); }}
                                    className="cursor-pointer border-b border-border/50 hover:bg-secondary/40"
                                    data-testid={`dn-row-${r.id}`}>
                                    <td className="px-3 py-2">
                                        <input type="radio" readOnly checked={false} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">Invoice</td>
                                    <td className="px-3 py-2 font-mono text-xs text-primary">{r._doc_no}</td>
                                    <td className="px-3 py-2 font-mono text-[10px]">{r.government?.uuid || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{GENERAL_PUBLIC_TIN}</td>
                                    <td className="px-3 py-2">{GENERAL_PUBLIC_NAME}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.subtotal)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.tax_total)}</td>
                                    <td className="px-3 py-2 text-xs">{fmtDateTime(r.government?.signed_at || r.created_at)}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin || "C24700902040"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function RequestDebitNote({ invoice, onCancel }) {
    const qc = useQueryClient();
    const period = periodOf(invoice.invoice_date || invoice.created_at);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const [form, setForm] = useState({
        code_number: "",
        currency: "MYR",
        exchange_rate: "",
        k1: "NA", incoterms: "NA", fta: "NA", k2: "NA",
        period_from: period.from, period_to: period.to,
        frequency: "Monthly",
        einvoice_datetime: now,
        // Supplier
        sup_tin: invoice.supplier_tin || "C24700902040",
        sup_name: invoice.supplier_name || "DFACE HEALTHCARE SDN BHD",
        sup_id_type: "Business Registration Number",
        sup_id_value: invoice.supplier_brn || "201601034740",
        sup_sst: "NA", sup_tourism_tax: "NA",
        sup_contact: invoice.supplier_phone || "0175510666",
        sup_email: invoice.supplier_email || "",
        sup_msic: "(86201)General medical services",
        sup_authorisation: "NA",
        sup_activity: "GP clinic with aesthetic services",
        sup_country: "MYS", sup_state: "Perak", sup_city: "Teluk Intan",
        sup_area: "Bandar Baru",
        sup_addr_0: "Jalan Raja", sup_addr_1: "69 & 71", sup_addr_2: "",
        sup_postal: "36000",
        // Buyer (General Public for consolidated debit note)
        buyer_id_type: "NRIC", buyer_id_value: "NA",
        buyer_tin: GENERAL_PUBLIC_TIN, buyer_name: GENERAL_PUBLIC_NAME,
        buyer_sst: "NA", buyer_contact: "NA", buyer_email: "",
        buyer_code: "",
        buyer_country: "MYS", buyer_state: "Not Applicable",
        buyer_city: "NA", buyer_area: "Central",
        buyer_addr_0: "NA", buyer_addr_1: "", buyer_addr_2: "",
        buyer_postal: "",
        // Section D+ (line items copy of source)
        reason: "",
    });
    const [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.code_number.trim()) return toast.error("E-Invoice Code Number is required");
        setBusy(true);
        try {
            // Create a NEW invoice as debit_note tied to source
            const body = {
                invoice_number: form.code_number,
                invoice_type: "debit_note",
                customer_id: invoice.customer_id,
                company_id: invoice.company_id,
                invoice_date: new Date().toISOString().slice(0, 10),
                due_date: form.period_to,
                currency: form.currency,
                lines: (invoice.lines || []).map((l) => ({
                    description: l.description, quantity: l.quantity,
                    unit_price: l.unit_price, tax_rate: l.tax_rate,
                    classification_code: "022",
                })),
                original_invoice_uuid: invoice.government?.uuid,
                original_invoice_number: docNo(invoice.id, 0),
                debit_note_reason: form.reason,
            };
            const { data } = await api.post("/invoices", body);
            toast.success(`Debit note ${data.invoice_number} created`);
            qc.invalidateQueries({ queryKey: ["invoices"] });
            onCancel();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setBusy(false); }
    };

    return (
        <div className="pb-24">
            <div className="mb-4 text-lg">
                <span className="text-muted-foreground">Debit Note Management</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="text-muted-foreground">Select Invoice</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="font-semibold">Request Debit Note</span>
            </div>

            {page === 0 && (
                <>
                    <SectionBar title="Section A: Basic Information" />
                    <Card>
                        <TF l="E-Invoice Code Number" required>
                            <Input value={form.code_number} onChange={(e) => set("code_number", e.target.value)}
                                   className="bg-warning/5 border-warning/40" data-testid="dn-code-number" />
                        </TF>
                        <TF l="E-Invoice Type">
                            <Input value="Debit Note" disabled />
                        </TF>
                        <TF l="Original Invoice Code Number">
                            <Input value={docNo(invoice.id, 0)} disabled data-testid="dn-orig-code" />
                        </TF>
                        <TF l="Original Invoice UUID">
                            <Input value={invoice.government?.uuid || ""} disabled data-testid="dn-orig-uuid" />
                        </TF>
                        <TF l="Invoice Currency">
                            <SelectField value={form.currency} onValueChange={(v) => set("currency", v)}
                                         options={[{v:"MYR",l:"(MYR)Malaysian Ringgit"},{v:"USD",l:"(USD)US Dollar"},{v:"SGD",l:"(SGD)Singapore Dollar"}]} />
                        </TF>
                        <TF l="Exchange Rate"><Input value={form.exchange_rate} onChange={(e) => set("exchange_rate", e.target.value)} /></TF>
                        <TF l="K1"><Input value={form.k1} onChange={(e) => set("k1", e.target.value)} /></TF>
                        <TF l="Incoterms"><Input value={form.incoterms} onChange={(e) => set("incoterms", e.target.value)} /></TF>
                        <TF l="FTA Information"><Input value={form.fta} onChange={(e) => set("fta", e.target.value)} /></TF>
                        <TF l="K2"><Input value={form.k2} onChange={(e) => set("k2", e.target.value)} /></TF>
                        <TF l="Invoice Period from"><Input type="date" value={form.period_from} onChange={(e) => set("period_from", e.target.value)} /></TF>
                        <TF l="Invoice Period to"><Input type="date" value={form.period_to} onChange={(e) => set("period_to", e.target.value)} /></TF>
                        <TF l="Frequency of Billing">
                            <SelectField value={form.frequency} onValueChange={(v) => set("frequency", v)}
                                         options={[{v:"Daily",l:"Daily"},{v:"Weekly",l:"Weekly"},{v:"Monthly",l:"Monthly"},{v:"Quarterly",l:"Quarterly"},{v:"Annually",l:"Annually"}]} />
                        </TF>
                        <TF l="E-Invoice Date Time" required>
                            <Input value={form.einvoice_datetime} onChange={(e) => set("einvoice_datetime", e.target.value)}
                                   className="bg-warning/5 border-warning/40" />
                        </TF>
                    </Card>

                    <SectionBar title="Section B: Supplier's Information" />
                    <Card>
                        <TF l="TIN"><Input value={form.sup_tin} onChange={(e) => set("sup_tin", e.target.value)} /></TF>
                        <TF l="Name"><Input value={form.sup_name} onChange={(e) => set("sup_name", e.target.value)} /></TF>
                        <TF l="ID Type">
                            <SelectField value={form.sup_id_type} onValueChange={(v) => set("sup_id_type", v)}
                                         options={[{v:"Business Registration Number",l:"Business Registration Number"},{v:"NRIC",l:"NRIC"},{v:"Passport",l:"Passport"},{v:"Army",l:"Army"}]} />
                        </TF>
                        <TF l="ID Value"><Input value={form.sup_id_value} onChange={(e) => set("sup_id_value", e.target.value)} /></TF>
                        <TF l="SST Registration Number"><Input value={form.sup_sst} onChange={(e) => set("sup_sst", e.target.value)} /></TF>
                        <TF l="Tourism Tax Registration Number"><Input value={form.sup_tourism_tax} onChange={(e) => set("sup_tourism_tax", e.target.value)} /></TF>
                        <TF l="Contact Number"><Input value={form.sup_contact} onChange={(e) => set("sup_contact", e.target.value)} /></TF>
                        <TF l="E-mail"><Input value={form.sup_email} onChange={(e) => set("sup_email", e.target.value)} /></TF>
                        <TF l="Malaysia Standard Industrial Classification">
                            <Input value={form.sup_msic} onChange={(e) => set("sup_msic", e.target.value)} />
                        </TF>
                        <TF l="Authorisation Number For Certified Exporter">
                            <Input value={form.sup_authorisation} onChange={(e) => set("sup_authorisation", e.target.value)} />
                        </TF>
                        <TF l="Business Activity Description" full>
                            <Textarea value={form.sup_activity} onChange={(e) => set("sup_activity", e.target.value)} rows={2} />
                        </TF>
                        <AddressBlock prefix="sup" form={form} set={set} />
                    </Card>

                    <SectionBar title="Section C: Buyer's Details" />
                    <Card>
                        <TF l="ID Type">
                            <SelectField value={form.buyer_id_type} onValueChange={(v) => set("buyer_id_type", v)}
                                         options={[{v:"NRIC",l:"NRIC"},{v:"Business Registration Number",l:"Business Registration Number"},{v:"Passport",l:"Passport"},{v:"Army",l:"Army"}]} />
                        </TF>
                        <TF l="ID Value"><Input value={form.buyer_id_value} onChange={(e) => set("buyer_id_value", e.target.value)} /></TF>
                        <TF l="TIN"><Input value={form.buyer_tin} onChange={(e) => set("buyer_tin", e.target.value)} /></TF>
                        <TF l="Name"><Input value={form.buyer_name} onChange={(e) => set("buyer_name", e.target.value)} /></TF>
                        <TF l="SST Registration Number"><Input value={form.buyer_sst} onChange={(e) => set("buyer_sst", e.target.value)} /></TF>
                        <TF l="Contact Number"><Input value={form.buyer_contact} onChange={(e) => set("buyer_contact", e.target.value)} /></TF>
                        <TF l="E-mail"><Input value={form.buyer_email} onChange={(e) => set("buyer_email", e.target.value)} /></TF>
                        <TF l="Buyer Code"><Input value={form.buyer_code} onChange={(e) => set("buyer_code", e.target.value)} /></TF>
                        <AddressBlock prefix="buyer" form={form} set={set} />
                    </Card>
                </>
            )}

            {page === 1 && (
                <>
                    <SectionBar title="Section D: Reason for Debit Note" />
                    <Card>
                        <TF l="Reason" full>
                            <Textarea rows={5} value={form.reason} onChange={(e) => set("reason", e.target.value)}
                                      placeholder="Explain why this debit note is being issued (additional charges, price adjustment, etc.)"
                                      data-testid="dn-reason" />
                        </TF>
                    </Card>
                </>
            )}

            <div className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 border-t border-border bg-primary px-6 py-3">
                {page === 1 && (
                    <Button variant="secondary" size="sm" onClick={() => setPage(0)} data-testid="dn-prev">
                        ◀ Previous
                    </Button>
                )}
                {page === 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setPage(1)} data-testid="dn-next">
                        Next ▶
                    </Button>
                )}
                {page === 1 && (
                    <Button variant="secondary" size="sm" onClick={submit} disabled={busy} data-testid="dn-submit">
                        <Save className="mr-2 h-3.5 w-3.5" /> Submit
                    </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onCancel} data-testid="dn-cancel">
                    <X className="mr-2 h-3.5 w-3.5" /> Cancel
                </Button>
            </div>
        </div>
    );
}

function AddressBlock({ prefix, form, set }) {
    const state = form[`${prefix}_state`];
    const city = form[`${prefix}_city`];
    const cities = citiesFor(state);
    const areas = areasFor(city);
    return (
        <div className="col-span-full mt-4 rounded border border-border bg-secondary/10 p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Address</div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                <TF l="Country">
                    <SelectField value={form[`${prefix}_country`]}
                                 onValueChange={(v) => set(`${prefix}_country`, v)}
                                 options={COUNTRIES.map((c) => ({ v: c.code, l: c.name }))} />
                </TF>
                <TF l="State">
                    <SelectField value={state}
                                 onValueChange={(v) => { set(`${prefix}_state`, v); set(`${prefix}_city`, citiesFor(v)[0] || ""); set(`${prefix}_area`, areasFor(citiesFor(v)[0] || "")[0] || "Central"); }}
                                 options={MY_STATES.map((s) => ({ v: s, l: s }))}
                                 testid={`${prefix}-state`} />
                </TF>
                <TF l="City Name">
                    <SelectField value={city}
                                 onValueChange={(v) => { set(`${prefix}_city`, v); set(`${prefix}_area`, areasFor(v)[0] || "Central"); }}
                                 options={cities.map((c) => ({ v: c, l: c }))}
                                 testid={`${prefix}-city`} />
                </TF>
                <TF l="Area">
                    <SelectField value={form[`${prefix}_area`]}
                                 onValueChange={(v) => set(`${prefix}_area`, v)}
                                 options={areas.map((a) => ({ v: a, l: a }))}
                                 testid={`${prefix}-area`} />
                </TF>
                <TF l="Address Line 0"><Input value={form[`${prefix}_addr_0`]} onChange={(e) => set(`${prefix}_addr_0`, e.target.value)} /></TF>
                <TF l="Address Line 1"><Input value={form[`${prefix}_addr_1`]} onChange={(e) => set(`${prefix}_addr_1`, e.target.value)} /></TF>
                <TF l="Address Line 2"><Input value={form[`${prefix}_addr_2`]} onChange={(e) => set(`${prefix}_addr_2`, e.target.value)} /></TF>
                <TF l="Postal Zone"><Input value={form[`${prefix}_postal`]} onChange={(e) => set(`${prefix}_postal`, e.target.value)} /></TF>
            </div>
        </div>
    );
}

function SelectField({ value, onValueChange, options, testid }) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
            <SelectContent>
                {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function SectionBar({ title }) {
    return (
        <div className="mt-4 rounded-t-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            {title}
        </div>
    );
}

function Card({ children }) {
    return (
        <div className="mb-2 grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
            {children}
        </div>
    );
}

function TF({ l, children, required, full }) {
    return (
        <div className={full ? "col-span-full grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_1fr]" : "grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]"}>
            <Label className="text-sm">
                {l} {required && <span className="text-destructive">*</span>}
            </Label>
            <div>{children}</div>
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
