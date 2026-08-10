import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import SigningGate from "@/components/common/SigningGate";
import MsicSelect from "@/components/common/MsicSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import { ArrowLeft, Plus, Trash2, Save, Send, X } from "lucide-react";
import { COUNTRIES, MY_STATES, citiesFor } from "@/lib/malaysia";
import { useCompany } from "@/context/CompanyContext";

// ---------- helpers ----------
const INVOICE_TYPES = [
    { v: "invoice", l: "Invoice" },
    { v: "credit_note", l: "Credit Note" },
    { v: "debit_note", l: "Debit Note" },
    { v: "refund_note", l: "Refund Note" },
    { v: "self_billed_invoice", l: "Self-Billed Invoice" },
];
const CURRENCIES = ["MYR", "USD", "SGD", "EUR", "GBP", "CNY"];
const MEASUREMENTS = ["each", "SES", "DOSE", "TEST", "STRIP", "UNIT", "MO", "HR", "BOTTLE"];
const PAYMENT_MODES = ["01 Cash", "02 Cheque", "03 Bank Transfer", "04 Credit Card", "05 Debit Card", "06 e-Wallet", "07 Digital Bank", "08 Others"];

const emptyLine = () => ({
    product_id: null,
    msic_code: "86201",
    msic_description: "General medical services",
    description: "",
    measurement: "each",
    quantity: 1,
    unit_price: 0,
    discount_rate: 0,
    discount: 0,
    tax_rate: 6,
});

// ---------- main page ----------
export default function NewInvoice() {
    const nav = useNavigate();
    const [params] = useSearchParams();
    const fromId = params.get("from");
    const { current } = useCompany();

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => (await api.get("/customers")).data,
    });
    const { data: products } = useQuery({
        queryKey: ["products"],
        queryFn: async () => (await api.get("/products")).data,
    });
    const { data: source } = useQuery({
        queryKey: ["invoice-source", fromId],
        enabled: !!fromId,
        queryFn: async () => (await api.get(`/invoices/${fromId}`)).data,
    });

    // ---------- Section A: Basic ----------
    const [invoiceType, setInvoiceType] = useState("invoice");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");
    const [currency, setCurrency] = useState("MYR");
    const [exchangeRate, setExchangeRate] = useState(1);
    const [businessSystem, setBusinessSystem] = useState("");
    const [storeCode, setStoreCode] = useState("");
    const [periodFrom, setPeriodFrom] = useState("");
    const [periodTo, setPeriodTo] = useState("");
    const [billingFrequency, setBillingFrequency] = useState("");

    // ---------- Section B: Supplier ----------
    const [supTin, setSupTin] = useState("C24700902040");
    const [supName, setSupName] = useState("DFACE HEALTHCARE SDN BHD");
    const [supIdType, setSupIdType] = useState("Business Registration Number");
    const [supIdValue, setSupIdValue] = useState("201601034740");
    const [supSst, setSupSst] = useState("NA");
    const [supTourism, setSupTourism] = useState("NA");
    const [supPhone, setSupPhone] = useState("+60312345678");
    const [supEmail, setSupEmail] = useState("");
    const [supMsicCode, setSupMsicCode] = useState("86201");
    const [supMsicDesc, setSupMsicDesc] = useState("General medical services");
    const [supAuthNumber, setSupAuthNumber] = useState("NA");
    const [supActivity, setSupActivity] = useState("GP clinic with aesthetic services");
    const [supCountry, setSupCountry] = useState("MYS");
    const [supState, setSupState] = useState("Wilayah Persekutuan Kuala Lumpur");
    const [supCity, setSupCity] = useState("Bukit Bintang");
    const [supAddr0, setSupAddr0] = useState("Level 12, Menara Acme");
    const [supAddr1, setSupAddr1] = useState("Jalan Ampang");
    const [supAddr2, setSupAddr2] = useState("");
    const [supPostal, setSupPostal] = useState("50450");

    // ---------- Section C: Buyer ----------
    const [customerId, setCustomerId] = useState("");
    const [buyerCode, setBuyerCode] = useState("");

    // ---------- Section D: Lines ----------
    const [lines, setLines] = useState([emptyLine()]);

    // ---------- Section E: Payment ----------
    const [paymentMode, setPaymentMode] = useState("03 Bank Transfer");
    const [supplierBankAccount, setSupplierBankAccount] = useState("");
    const [prepaymentRef, setPrepaymentRef] = useState("");
    const [prepaymentAmount, setPrepaymentAmount] = useState(0);
    const [prepaymentDate, setPrepaymentDate] = useState("");
    const [billReference, setBillReference] = useState("");
    const [terms, setTerms] = useState("Payment due within 30 days.");
    const [notes, setNotes] = useState("");

    // ---------- Section G: Additional Charge ----------
    const [shipping, setShipping] = useState(0);
    const [charges, setCharges] = useState(0);
    const [roundOff, setRoundOff] = useState(0);

    // ---------- submit state ----------
    const [submitting, setSubmitting] = useState(false);
    const [gateOpen, setGateOpen] = useState(false);
    const [createdInvoiceId, setCreatedInvoiceId] = useState(null);

    // ---------- prefill from source invoice ----------
    useEffect(() => {
        if (!source) return;
        setInvoiceType(source.invoice_type || "invoice");
        setInvoiceDate((source.invoice_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
        setDueDate((source.due_date || "").slice(0, 10));
        setCurrency(source.currency || "MYR");
        setExchangeRate(source.exchange_rate || 1);
        setBusinessSystem(source.business_system || "");
        setStoreCode(source.store_code || "");

        if (source.supplier_tin) setSupTin(source.supplier_tin);
        if (source.supplier_name) setSupName(source.supplier_name);
        if (source.supplier_msic) setSupMsicCode(source.supplier_msic);
        if (source.supplier_msic_desc) setSupMsicDesc(source.supplier_msic_desc);

        if (source.customer_snapshot?.id) setCustomerId(source.customer_snapshot.id);

        if (Array.isArray(source.lines) && source.lines.length) {
            setLines(source.lines.map((l) => ({
                product_id: l.product_id || null,
                msic_code: l.msic_code || "86201",
                msic_description: l.msic_description || "General medical services",
                description: l.description || "",
                measurement: l.measurement || "each",
                quantity: l.quantity || 1,
                unit_price: l.unit_price || 0,
                discount_rate: l.discount_rate || 0,
                discount: l.discount || 0,
                tax_rate: l.tax_rate ?? 6,
                hs_code: l.hs_code || null,
            })));
        }
        if (source.terms) setTerms(source.terms);
        if (source.notes) setNotes(source.notes);
        if (source.shipping) setShipping(source.shipping);
        if (source.charges) setCharges(source.charges);
    }, [source]);

    // ---------- default customer if not chosen ----------
    useEffect(() => {
        if (customers?.length && !customerId && !fromId) setCustomerId(customers[0].id);
    }, [customers, customerId, fromId]);

    // ---------- prefill supplier from active clinic ----------
    useEffect(() => {
        if (source) return; // don't override prefill-from-source
        if (!current) return;
        if (current.tin) setSupTin(current.tin);
        if (current.name) setSupName(current.name);
        if (current.brn) setSupIdValue(current.brn);
        if (current.sst) setSupSst(current.sst);
        if (current.msic_code) setSupMsicCode(current.msic_code);
        if (current.msic_description) setSupMsicDesc(current.msic_description);
    }, [current, source]);

    const selectedCustomer = useMemo(
        () => customers?.find((c) => c.id === customerId),
        [customers, customerId],
    );

    // ---------- line helpers ----------
    const addLine = () => setLines([...lines, emptyLine()]);
    const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
    const updateLine = (i, patch) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    const selectProduct = (i, pid) => {
        const p = products?.find((x) => x.id === pid);
        if (!p) return;
        const patch = {
            product_id: p.id,
            description: p.name,
            unit_price: p.unit_price,
            tax_rate: p.tax_rate,
            hs_code: p.hs_code,
            measurement: p.unit || "each",
        };
        if (p.msic_code) {
            patch.msic_code = p.msic_code;
            patch.msic_description = p.msic_description || "";
        }
        updateLine(i, patch);
    };

    // ---------- totals ----------
    const lineTotals = (l) => {
        const before = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
        const discFromRate = before * ((Number(l.discount_rate) || 0) / 100);
        const disc = Number(l.discount) || discFromRate;
        const excl = before - disc;
        const tax = excl * ((Number(l.tax_rate) || 0) / 100);
        return { before, disc, excl, tax };
    };
    const totals = lines.reduce((acc, l) => {
        const t = lineTotals(l);
        acc.before += t.before;
        acc.disc += t.disc;
        acc.excl += t.excl;
        acc.tax += t.tax;
        return acc;
    }, { before: 0, disc: 0, excl: 0, tax: 0 });
    const grandTotal = totals.excl + totals.tax + Number(shipping || 0) + Number(charges || 0) + Number(roundOff || 0);

    // ---------- save ----------
    const save = async (thenSubmit) => {
        if (!customerId) return toast.error("Select a buyer (Section C)");
        if (!lines.length) return toast.error("Add at least one line item");
        setSubmitting(true);
        try {
            const payload = {
                customer_id: customerId,
                invoice_date: invoiceDate,
                due_date: dueDate || null,
                currency,
                exchange_rate: Number(exchangeRate) || 1,
                invoice_type: invoiceType,
                business_system: businessSystem || null,
                store_code: storeCode || null,
                supplier_tin: supTin || null,
                supplier_name: supName || null,
                supplier_msic: supMsicCode || null,
                supplier_msic_desc: supMsicDesc || null,
                lines: lines.map((l) => ({
                    description: l.description,
                    quantity: Number(l.quantity),
                    unit_price: Number(l.unit_price),
                    tax_rate: Number(l.tax_rate),
                    discount: Number(l.discount || 0),
                    hs_code: l.hs_code || null,
                    product_id: l.product_id || null,
                    msic_code: l.msic_code || null,
                    msic_description: l.msic_description || null,
                })),
                shipping: Number(shipping || 0),
                charges: Number(charges || 0),
                round_off: Number(roundOff || 0),
                notes,
                terms,
            };
            const { data } = await api.post("/invoices", payload);
            toast.success(`Invoice ${data.invoice_number} created`);
            if (thenSubmit) {
                setCreatedInvoiceId(data.id);
                setGateOpen(true);
            } else {
                nav(`/invoices/${data.id}`);
            }
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSubmitting(false);
        }
    };

    const doSubmit = async (sessionId) => {
        if (!createdInvoiceId) return;
        try {
            await api.post(`/invoices/${createdInvoiceId}/submit`, {
                signing_session_id: sessionId,
            });
            toast.info("Signed & submitted to LHDN MyInvois — validating…");
            nav(`/invoices/${createdInvoiceId}`);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setGateOpen(false);
        }
    };

    const supCities = citiesFor(supState);

    return (
        <div className="pb-16">
            {/* Breadcrumb + actions */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground" data-testid="back-btn">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <Link to="/ics/my-transaction" className="text-muted-foreground hover:text-foreground">
                        Transaction Data Management
                    </Link>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">{fromId ? "Modify & Issue" : "New Invoice"}</span>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => save(false)} disabled={submitting} data-testid="save-draft-btn">
                        <Save className="mr-2 h-3.5 w-3.5" /> Save as draft
                    </Button>
                    <Button size="sm" onClick={() => save(true)} disabled={submitting} data-testid="submit-lhdn-btn">
                        <Send className="mr-2 h-3.5 w-3.5" /> Save & Submit to LHDN
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => nav(-1)}>
                        <X className="mr-2 h-3.5 w-3.5" /> Close
                    </Button>
                </div>
            </div>

            {/* Section A */}
            <Section title="Section A: Basic Information">
                <TF l="E-Invoice Type">
                    <SF value={invoiceType} onValueChange={setInvoiceType} options={INVOICE_TYPES} testid="a-invoice-type" />
                </TF>
                <TF l="Invoice Currency">
                    <SF value={currency} onValueChange={setCurrency} options={CURRENCIES.map((c) => ({ v: c, l: c }))} testid="a-currency" />
                </TF>
                <TF l="Exchange Rate">
                    <Input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} data-testid="a-exchange-rate" />
                </TF>
                <TF l="K1"><Input value="NA" disabled /></TF>
                <TF l="Incoterms"><Input value="NA" disabled /></TF>
                <TF l="FTA Information"><Input value="NA" disabled /></TF>
                <TF l="K2"><Input value="NA" disabled /></TF>
                <TF l="Business System">
                    <Input value={businessSystem} onChange={(e) => setBusinessSystem(e.target.value)} placeholder="e.g. Clinic EMR" data-testid="a-business-system" />
                </TF>
                <TF l="Store Code/Location">
                    <Input value={storeCode} onChange={(e) => setStoreCode(e.target.value)} placeholder="e.g. HQ" data-testid="a-store-code" />
                </TF>
                <TF l="E-Invoice Date Time">
                    <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} data-testid="a-invoice-date" />
                </TF>
                <TF l="Due Date">
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="a-due-date" />
                </TF>
                <TF l="Invoice Period from">
                    <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                </TF>
                <TF l="Invoice Period to">
                    <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                </TF>
                <TF l="Frequency of Billing">
                    <Input value={billingFrequency} onChange={(e) => setBillingFrequency(e.target.value)} placeholder="e.g. Monthly" />
                </TF>
            </Section>

            {/* Section B */}
            <Section title="Section B: Supplier's Information">
                <TF l="TIN"><Input value={supTin} onChange={(e) => setSupTin(e.target.value)} data-testid="b-tin" /></TF>
                <TF l="Name"><Input value={supName} onChange={(e) => setSupName(e.target.value)} data-testid="b-name" /></TF>
                <TF l="ID Type">
                    <SF value={supIdType} onValueChange={setSupIdType}
                        options={["Business Registration Number", "NRIC", "Passport", "Army"].map((t) => ({ v: t, l: t }))} />
                </TF>
                <TF l="ID Value"><Input value={supIdValue} onChange={(e) => setSupIdValue(e.target.value)} /></TF>
                <TF l="SST Registration Number"><Input value={supSst} onChange={(e) => setSupSst(e.target.value)} /></TF>
                <TF l="Tourism Tax Registration Number"><Input value={supTourism} onChange={(e) => setSupTourism(e.target.value)} /></TF>
                <TF l="Contact Number"><Input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} /></TF>
                <TF l="E-mail"><Input value={supEmail} onChange={(e) => setSupEmail(e.target.value)} /></TF>
                <TF l="Malaysia Standard Industrial Classification">
                    <MsicSelect
                        value={supMsicCode}
                        onChange={(code, desc) => { setSupMsicCode(code); setSupMsicDesc(desc); }}
                        testid="b-msic"
                    />
                </TF>
                <TF l="Authorisation Number For Certified Exporter">
                    <Input value={supAuthNumber} onChange={(e) => setSupAuthNumber(e.target.value)} />
                </TF>
                <TF l="Business Activity Description" full>
                    <Textarea rows={2} value={supActivity} onChange={(e) => setSupActivity(e.target.value)} />
                </TF>
                <SubHeader label="Address" />
                <TF l="Country">
                    <SF value={supCountry} onValueChange={setSupCountry} options={COUNTRIES.map((c) => ({ v: c.code, l: c.name }))} />
                </TF>
                <TF l="State">
                    <SF value={supState} onValueChange={(v) => { setSupState(v); const c = citiesFor(v)[0] || ""; setSupCity(c); }}
                        options={MY_STATES.map((s) => ({ v: s, l: s }))} />
                </TF>
                <TF l="City Name">
                    <SF value={supCity} onValueChange={setSupCity} options={supCities.map((c) => ({ v: c, l: c }))} />
                </TF>
                <TF l="Address Line 0"><Input value={supAddr0} onChange={(e) => setSupAddr0(e.target.value)} /></TF>
                <TF l="Address Line 1"><Input value={supAddr1} onChange={(e) => setSupAddr1(e.target.value)} /></TF>
                <TF l="Address Line 2"><Input value={supAddr2} onChange={(e) => setSupAddr2(e.target.value)} /></TF>
                <TF l="Postal Zone"><Input value={supPostal} onChange={(e) => setSupPostal(e.target.value)} /></TF>
            </Section>

            {/* Section C */}
            <Section title="Section C: Buyer's Details">
                <TF l="Buyer">
                    <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger data-testid="c-buyer-picker"><SelectValue placeholder="Select buyer" /></SelectTrigger>
                        <SelectContent>
                            {(customers || []).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TF>
                <TF l="Buyer Code">
                    <Input value={buyerCode} onChange={(e) => setBuyerCode(e.target.value)} placeholder="e.g. B-000123" />
                </TF>
                <TF l="ID Type">
                    <Input value={selectedCustomer?.tin?.startsWith("IG") ? "NRIC" : "Business Registration Number"} disabled />
                </TF>
                <TF l="ID Value"><Input value={selectedCustomer?.brn || ""} disabled /></TF>
                <TF l="TIN"><Input value={selectedCustomer?.tin || ""} disabled /></TF>
                <TF l="Name"><Input value={selectedCustomer?.name || ""} disabled /></TF>
                <TF l="SST Registration Number"><Input value="NA" disabled /></TF>
                <TF l="Contact Number"><Input value={selectedCustomer?.phone || ""} disabled /></TF>
                <TF l="E-mail"><Input value={selectedCustomer?.email || ""} disabled /></TF>
                <SubHeader label="Address" />
                <TF l="Address Line 0" full>
                    <Input value={selectedCustomer?.billing_address || ""} disabled />
                </TF>
            </Section>

            {/* Section D — Line Items */}
            <SectionBar title="Section D: Line Item Details" />
            <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                <table className="w-full min-w-[1400px] text-sm">
                    <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                        <tr>
                            <Th>NO.</Th>
                            <Th className="min-w-[260px]">Classification (MSIC)</Th>
                            <Th className="min-w-[180px]">Product</Th>
                            <Th className="min-w-[220px]">Item Name / Description</Th>
                            <Th>Measurement</Th>
                            <Th className="text-right">Qty</Th>
                            <Th className="text-right">Unit Price</Th>
                            <Th className="text-right">Disc %</Th>
                            <Th className="text-right">Tax %</Th>
                            <Th className="text-right">Excl. Tax</Th>
                            <Th />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, i) => {
                            const t = lineTotals(l);
                            return (
                                <tr key={i} className="border-b border-border/50 align-top">
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">
                                        <MsicSelect
                                            value={l.msic_code}
                                            onChange={(code, desc) => updateLine(i, { msic_code: code, msic_description: desc })}
                                            testid={`line-msic-${i}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <Select value={l.product_id || ""} onValueChange={(v) => selectProduct(i, v)}>
                                            <SelectTrigger data-testid={`line-product-${i}`}>
                                                <SelectValue placeholder="Pick product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(products || []).map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                                               placeholder="Item name / description" data-testid={`line-desc-${i}`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <SF value={l.measurement} onValueChange={(v) => updateLine(i, { measurement: v })}
                                            options={MEASUREMENTS.map((m) => ({ v: m, l: m }))} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Input type="number" step="0.01" className="text-right font-mono"
                                               value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })}
                                               data-testid={`line-qty-${i}`} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Input type="number" step="0.01" className="text-right font-mono"
                                               value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                                               data-testid={`line-price-${i}`} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Input type="number" step="0.01" className="text-right font-mono"
                                               value={l.discount_rate} onChange={(e) => updateLine(i, { discount_rate: e.target.value, discount: (Number(l.quantity) * Number(l.unit_price)) * (Number(e.target.value) / 100) })} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Input type="number" step="0.01" className="text-right font-mono"
                                               value={l.tax_rate} onChange={(e) => updateLine(i, { tax_rate: e.target.value })} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(t.excl)}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                                onClick={() => removeLine(i)} data-testid={`line-remove-${i}`}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="border-t border-border px-3 py-2">
                    <Button variant="outline" size="sm" onClick={addLine} data-testid="add-line-btn">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Add line
                    </Button>
                </div>
            </div>

            {/* Section E */}
            <Section title="Section E: Payment Details">
                <TF l="Payment Mode">
                    <SF value={paymentMode} onValueChange={setPaymentMode}
                        options={PAYMENT_MODES.map((m) => ({ v: m, l: m }))} />
                </TF>
                <TF l="Supplier's Bank Account Number">
                    <Input value={supplierBankAccount} onChange={(e) => setSupplierBankAccount(e.target.value)} />
                </TF>
                <TF l="PrePayment Reference Number">
                    <Input value={prepaymentRef} onChange={(e) => setPrepaymentRef(e.target.value)} />
                </TF>
                <TF l="PrePayment Amount">
                    <Input type="number" step="0.01" value={prepaymentAmount} onChange={(e) => setPrepaymentAmount(e.target.value)} />
                </TF>
                <TF l="PrePayment Date Time">
                    <Input type="date" value={prepaymentDate} onChange={(e) => setPrepaymentDate(e.target.value)} />
                </TF>
                <TF l="Bill Reference Number">
                    <Input value={billReference} onChange={(e) => setBillReference(e.target.value)} />
                </TF>
                <TF l="Payment Terms" full>
                    <Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </TF>
                <TF l="Notes" full>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </TF>
            </Section>

            {/* Section F — Tax (auto) */}
            <SectionBar title="Section F: Tax Details (auto)" />
            <div className="mb-6 overflow-x-auto rounded-b-md border-x border-b border-border bg-card">
                <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                        <tr>
                            <Th>NO.</Th><Th>Tax Type</Th><Th>Tax Rate</Th>
                            <Th className="text-right">Qty</Th>
                            <Th className="text-right">Net Amount</Th>
                            <Th className="text-right">Tax Amount</Th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="px-3 py-2 font-mono text-xs">1</td>
                            <td className="px-3 py-2">{totals.tax > 0 ? `SST ${lines[0]?.tax_rate || 6}%` : "Not Applicable"}</td>
                            <td className="px-3 py-2 font-mono">{Number(lines[0]?.tax_rate || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">
                                {lines.reduce((s, l) => s + Number(l.quantity || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{fmtMoney(totals.excl)}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmtMoney(totals.tax)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Section G */}
            <Section title="Section G: Additional Charge">
                <TF l="Shipping Amount">
                    <Input type="number" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} data-testid="g-shipping" />
                </TF>
                <TF l="Other Charges">
                    <Input type="number" step="0.01" value={charges} onChange={(e) => setCharges(e.target.value)} data-testid="g-charges" />
                </TF>
                <TF l="Rounding Amount">
                    <Input type="number" step="0.01" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} />
                </TF>
            </Section>

            {/* Section H — Summary */}
            <SectionBar title="Section H: Summary" />
            <div className="mb-6 grid grid-cols-2 gap-0 overflow-hidden rounded-b-md border-x border-b border-border bg-card md:grid-cols-4">
                <Summary l="Total Net Amount" v={fmtMoney(totals.before)} />
                <Summary l="Total Discount Value" v={fmtMoney(totals.disc)} />
                <Summary l="Total Fee/Charge Amount" v={fmtMoney(Number(shipping || 0) + Number(charges || 0))} />
                <Summary l="Total Excluding Tax" v={fmtMoney(totals.excl)} />
                <Summary l="Total Tax Amount" v={fmtMoney(totals.tax)} />
                <Summary l="Total Including Tax" v={fmtMoney(totals.excl + totals.tax)} />
                <Summary l="Rounding Amount" v={fmtMoney(Number(roundOff || 0))} />
                <Summary l="Total Payable Amount" v={fmtMoney(grandTotal)} highlight />
            </div>

            <SigningGate
                open={gateOpen}
                onOpenChange={setGateOpen}
                action="invoice.submit"
                entity="invoice"
                entityId={createdInvoiceId}
                title="Approve LHDN submission"
                description="You are about to sign & submit this invoice to LHDN MyInvois. Scan the QR or enter the 6-digit code to approve."
                onApproved={doSubmit}
            />
        </div>
    );
}

// ---------- shared UI ----------
function SectionBar({ title }) {
    return (
        <div className="rounded-t-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            {title}
        </div>
    );
}
function Section({ title, children }) {
    return (
        <>
            <SectionBar title={title} />
            <div className="mb-6 grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
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
function TF({ l, children, full }) {
    return (
        <div className={full
            ? "col-span-full grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_1fr]"
            : "grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]"}>
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
function SF({ value, onValueChange, options, testid }) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
            <SelectContent>
                {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
        </Select>
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
