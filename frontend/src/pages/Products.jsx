import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import { Plus, Save, X } from "lucide-react";
import { COUNTRIES } from "@/lib/malaysia";

// MSIC-mapped classifications for Malaysian medical/clinic e-invoices
const CLASSIFICATIONS = [
    "Medical examination or vaccination expenses",
    "Consultation fees (physician / specialist)",
    "Laboratory and diagnostic services",
    "Pharmacy — dispensed medicine",
    "Dental services",
    "Physiotherapy and rehabilitation",
    "Aesthetic / cosmetic procedures",
    "Radiology / imaging (X-ray, CT, MRI)",
    "Surgery — day-care procedure",
    "Nursing / home care service",
];

const MEASUREMENTS = ["each", "SES", "DOSE", "TEST", "STRIP", "UNIT", "MO", "HR", "BOTTLE"];

const EMPTY = {
    classification: "Medical examination or vaccination expenses",
    item_name: "",
    sku: "",
    measurement: "each",
    quantity: 1,
    unit_price: 0,
    discount_rate: 0,
    tax_rate: 0,
    fee_charge_rate: 0,
    fee_charge_amount: 0,
    tariff_code: "",
    country_of_origin: "MYS",
    description: "",
};

function calc(f) {
    const before = (Number(f.quantity) || 0) * (Number(f.unit_price) || 0);
    const disc = before * ((Number(f.discount_rate) || 0) / 100);
    const excl = before - disc;
    const tax = excl * ((Number(f.tax_rate) || 0) / 100);
    const fee = Number(f.fee_charge_amount) || 0;
    const subtotal = excl + tax + fee;
    return { before, disc, excl, tax, subtotal };
}

export default function Products() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ ...EMPTY });
    const { data, isLoading } = useQuery({
        queryKey: ["products"],
        queryFn: async () => (await api.get("/products")).data,
    });

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const totals = calc(form);

    const create = async () => {
        if (!form.item_name.trim()) return toast.error("Item Name is required");
        if (!form.sku.trim()) return toast.error("SKU is required");
        try {
            await api.post("/products", {
                sku: form.sku, name: form.item_name,
                type: "service",
                unit_price: Number(form.unit_price) || 0,
                tax_rate: Number(form.tax_rate) || 0,
                hs_code: form.tariff_code,
                classification_code: "022",
                unit: form.measurement,
                description: `${form.classification}${form.description ? " — " + form.description : ""}`,
            });
            toast.success("Product created");
            setOpen(false); setForm({ ...EMPTY });
            qc.invalidateQueries({ queryKey: ["products"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div>
            <PageHeader
                kicker="Master data"
                title="Products & Services"
                subtitle="Clinic services and pharmacy items — LHDN Section D line item catalog."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-product-btn">
                                <Plus className="mr-2 h-4 w-4" /> New Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl p-0" data-testid="new-product-modal">
                            <div className="border-b border-border px-6 pt-5 pb-3">
                                <DialogHeader>
                                    <DialogTitle>New Product / Service</DialogTitle>
                                    <DialogDescription>
                                        Section D · LHDN-approved line item catalog.
                                    </DialogDescription>
                                </DialogHeader>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                                <SectionBar title="Section D: Line Item Details" />
                                <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
                                    <TF l="Classification">
                                        <SF value={form.classification} onValueChange={(v) => set("classification", v)}
                                            options={CLASSIFICATIONS.map((c) => ({ v: c, l: c }))}
                                            testid="prod-classification" />
                                    </TF>
                                    <TF l="Item Name">
                                        <Input value={form.item_name} onChange={(e) => set("item_name", e.target.value)}
                                               placeholder="Medicine" data-testid="prod-item-name" />
                                    </TF>
                                    <TF l="SKU / Item Code">
                                        <Input value={form.sku} onChange={(e) => set("sku", e.target.value)}
                                               placeholder="MED-…" data-testid="prod-sku" />
                                    </TF>
                                    <TF l="Measurement">
                                        <SF value={form.measurement} onValueChange={(v) => set("measurement", v)}
                                            options={MEASUREMENTS.map((m) => ({ v: m, l: m }))}
                                            testid="prod-measurement" />
                                    </TF>
                                    <TF l="Quantity">
                                        <Input type="number" step="0.01" value={form.quantity}
                                               onChange={(e) => set("quantity", e.target.value)} />
                                    </TF>
                                    <TF l="Unit Price (MYR)">
                                        <Input type="number" step="0.01" value={form.unit_price}
                                               onChange={(e) => set("unit_price", e.target.value)}
                                               data-testid="prod-unit-price" />
                                    </TF>
                                    <TF l="Total Before Discount">
                                        <Input value={totals.before.toFixed(2)} disabled />
                                    </TF>
                                    <TF l="Discount Rate (%)">
                                        <Input type="number" step="0.01" value={form.discount_rate}
                                               onChange={(e) => set("discount_rate", e.target.value)} />
                                    </TF>
                                    <TF l="Total Excluding Tax">
                                        <Input value={totals.excl.toFixed(2)} disabled />
                                    </TF>
                                    <TF l="Tax Rate (%)">
                                        <Input type="number" step="0.01" value={form.tax_rate}
                                               onChange={(e) => set("tax_rate", e.target.value)} />
                                    </TF>
                                    <TF l="Tax Amount">
                                        <Input value={totals.tax.toFixed(2)} disabled />
                                    </TF>
                                    <TF l="Subtotal">
                                        <Input value={totals.subtotal.toFixed(2)} disabled />
                                    </TF>
                                    <TF l="Fee/Charge Rate (%)">
                                        <Input type="number" step="0.01" value={form.fee_charge_rate}
                                               onChange={(e) => set("fee_charge_rate", e.target.value)} />
                                    </TF>
                                    <TF l="Fee/Charge Amount">
                                        <Input type="number" step="0.01" value={form.fee_charge_amount}
                                               onChange={(e) => set("fee_charge_amount", e.target.value)} />
                                    </TF>
                                    <TF l="Product Tariff Code">
                                        <Input value={form.tariff_code} onChange={(e) => set("tariff_code", e.target.value)}
                                               placeholder="3004.90" data-testid="prod-tariff" />
                                    </TF>
                                    <TF l="Country of Origin">
                                        <SF value={form.country_of_origin} onValueChange={(v) => set("country_of_origin", v)}
                                            options={COUNTRIES.map((c) => ({ v: c.code, l: c.name }))} />
                                    </TF>
                                </div>
                            </div>
                            <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                                <Button variant="secondary" size="sm" onClick={create} data-testid="prod-save-btn">
                                    <Save className="mr-2 h-3.5 w-3.5" /> Save
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                                    <X className="mr-2 h-3.5 w-3.5" /> Cancel
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                }
            />

            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">SKU</th>
                                <th className="px-4 py-3 text-left">Item Name</th>
                                <th className="px-4 py-3 text-left">Classification</th>
                                <th className="px-4 py-3 text-left">Measurement</th>
                                <th className="px-4 py-3 text-right">Unit Price</th>
                                <th className="px-4 py-3 text-right">Tax Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((p) => (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                                    <td className="px-4 py-3 font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {(p.description || "").split(" — ")[0] || "Medical examination or vaccination expenses"}
                                    </td>
                                    <td className="px-4 py-3">{p.unit || "each"}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(p.unit_price)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{p.tax_rate}%</td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                                    No products yet.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
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
function SectionBar({ title }) {
    return (
        <div className="rounded-t-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            {title}
        </div>
    );
}
function TF({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
