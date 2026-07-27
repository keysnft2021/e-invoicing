import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import SigningGate from "@/components/common/SigningGate";
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
import { Plus, Trash2, Save } from "lucide-react";

export default function NewInvoice() {
    const nav = useNavigate();
    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => (await api.get("/customers")).data,
    });
    const { data: products } = useQuery({
        queryKey: ["products"],
        queryFn: async () => (await api.get("/products")).data,
    });

    const [customerId, setCustomerId] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");
    const [currency, setCurrency] = useState("MYR");
    const [notes, setNotes] = useState("");
    const [terms, setTerms] = useState("Payment due within 30 days.");
    const [shipping, setShipping] = useState(0);
    const [charges, setCharges] = useState(0);
    const [lines, setLines] = useState([
        { description: "", quantity: 1, unit_price: 0, tax_rate: 6, discount: 0, product_id: null },
    ]);
    const [submitting, setSubmitting] = useState(false);
    const [gateOpen, setGateOpen] = useState(false);
    const [createdInvoiceId, setCreatedInvoiceId] = useState(null);

    useEffect(() => {
        if (customers?.length && !customerId) setCustomerId(customers[0].id);
    }, [customers, customerId]);

    const addLine = () =>
        setLines([...lines, { description: "", quantity: 1, unit_price: 0, tax_rate: 6, discount: 0 }]);
    const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
    const updateLine = (i, patch) =>
        setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

    const selectProduct = (i, pid) => {
        const p = products?.find((x) => x.id === pid);
        if (!p) return;
        updateLine(i, {
            product_id: p.id,
            description: p.name,
            unit_price: p.unit_price,
            tax_rate: p.tax_rate,
            hs_code: p.hs_code,
        });
    };

    const totals = lines.reduce(
        (acc, l) => {
            const net = l.quantity * l.unit_price - (l.discount || 0);
            const tax = net * (l.tax_rate / 100);
            acc.subtotal += net;
            acc.tax += tax;
            return acc;
        },
        { subtotal: 0, tax: 0 },
    );
    const grandTotal = totals.subtotal + totals.tax + Number(shipping || 0) + Number(charges || 0);

    const save = async (thenSubmit) => {
        if (!customerId) return toast.error("Select a customer");
        if (!lines.length) return toast.error("Add at least one line item");
        setSubmitting(true);
        try {
            const payload = {
                customer_id: customerId,
                invoice_date: invoiceDate,
                due_date: dueDate || null,
                currency,
                lines: lines.map((l) => ({
                    description: l.description,
                    quantity: Number(l.quantity),
                    unit_price: Number(l.unit_price),
                    tax_rate: Number(l.tax_rate),
                    discount: Number(l.discount || 0),
                    hs_code: l.hs_code,
                    product_id: l.product_id,
                })),
                shipping: Number(shipping || 0),
                charges: Number(charges || 0),
                notes,
                terms,
            };
            const { data } = await api.post("/invoices", payload);
            toast.success(`Invoice ${data.invoice_number} created`);
            if (thenSubmit) {
                // Step-up MFA gate required for gov submission
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

    return (
        <div>
            <PageHeader
                kicker="Document"
                title="New Invoice"
                subtitle="Draft an invoice, save as draft or submit directly to LHDN MyInvois."
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => save(false)}
                            disabled={submitting}
                            data-testid="save-draft-btn"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save as draft
                        </Button>
                        <Button
                            onClick={() => save(true)}
                            disabled={submitting}
                            data-testid="submit-lhdn-btn"
                        >
                            Save & submit to LHDN
                        </Button>
                    </>
                }
            />

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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <section className="rounded-xl border border-border bg-card p-6">
                        <h2 className="mb-4 font-display text-lg font-semibold">Header</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Customer</Label>
                                <Select value={customerId} onValueChange={setCustomerId}>
                                    <SelectTrigger data-testid="select-customer">
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(customers || []).map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Currency</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MYR">MYR — Ringgit</SelectItem>
                                        <SelectItem value="USD">USD — Dollar</SelectItem>
                                        <SelectItem value="SGD">SGD — Sing Dollar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Invoice date</Label>
                                <Input
                                    type="date"
                                    value={invoiceDate}
                                    onChange={(e) => setInvoiceDate(e.target.value)}
                                    data-testid="invoice-date"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Due date</Label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-border bg-card p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-display text-lg font-semibold">Line items</h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addLine}
                                data-testid="add-line-btn"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add line
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {lines.map((l, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border p-3"
                                >
                                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                                        <Label className="text-[10px]">Product</Label>
                                        <Select
                                            value={l.product_id || ""}
                                            onValueChange={(v) => selectProduct(i, v)}
                                        >
                                            <SelectTrigger data-testid={`line-product-${i}`}>
                                                <SelectValue placeholder="Pick product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(products || []).map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            className="mt-1"
                                            placeholder="Description"
                                            value={l.description}
                                            onChange={(e) =>
                                                updateLine(i, { description: e.target.value })
                                            }
                                            data-testid={`line-desc-${i}`}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-2 space-y-1.5">
                                        <Label className="text-[10px]">Qty</Label>
                                        <Input
                                            type="number"
                                            value={l.quantity}
                                            onChange={(e) =>
                                                updateLine(i, { quantity: e.target.value })
                                            }
                                            data-testid={`line-qty-${i}`}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-2 space-y-1.5">
                                        <Label className="text-[10px]">Unit price</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={l.unit_price}
                                            onChange={(e) =>
                                                updateLine(i, { unit_price: e.target.value })
                                            }
                                            data-testid={`line-price-${i}`}
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-2 space-y-1.5">
                                        <Label className="text-[10px]">Tax %</Label>
                                        <Input
                                            type="number"
                                            value={l.tax_rate}
                                            onChange={(e) =>
                                                updateLine(i, { tax_rate: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeLine(i)}
                                            data-testid={`line-remove-${i}`}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-border bg-card p-6">
                        <h2 className="mb-4 font-display text-lg font-semibold">Notes & terms</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label>Terms</Label>
                                <Textarea
                                    value={terms}
                                    onChange={(e) => setTerms(e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-4">
                    <div className="sticky top-16 rounded-xl border border-border bg-card p-6">
                        <h3 className="mb-4 font-display text-lg font-semibold">Totals</h3>
                        <Row label="Subtotal" value={fmtMoney(totals.subtotal, currency)} />
                        <Row label="Tax" value={fmtMoney(totals.tax, currency)} />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-[10px]">Shipping</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={shipping}
                                    onChange={(e) => setShipping(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[10px]">Charges</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={charges}
                                    onChange={(e) => setCharges(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="mt-4 border-t border-border pt-4">
                            <div className="flex items-baseline justify-between">
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                    Total
                                </div>
                                <div className="font-mono text-2xl font-semibold">
                                    {fmtMoney(grandTotal, currency)}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                            Tip: Set a line total ending in <span className="font-mono">.13</span> to
                            simulate a LHDN rejection.
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex items-baseline justify-between py-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono">{value}</span>
        </div>
    );
}
