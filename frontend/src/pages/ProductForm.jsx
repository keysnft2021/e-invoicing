import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import CodeSelect from "@/components/common/CodeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Edit3, Trash2, Check, X, ChevronLeft } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { COUNTRIES } from "@/lib/malaysia";
import { LHDN_CLASSIFICATIONS } from "@/lib/lhdnClassification";
import { MEASUREMENT_CODES } from "@/lib/measurements";
import { MSIC_CODES } from "@/lib/msic";

const TAX_TYPES = [
    { v: "01", l: "Sales Tax" },
    { v: "02", l: "Service Tax" },
    { v: "03", l: "Tourism Tax" },
    { v: "04", l: "High-Value Goods Tax" },
    { v: "05", l: "Sales Tax on Low Value Goods" },
    { v: "06", l: "Not Applicable" },
    { v: "E", l: "Tax exemption (where applicable)" },
];

const EMPTY = {
    company_id: "",
    sku: "",
    name: "",
    classification_code: "",
    measurement: "",
    unit_price: "",
    tariff_code: "",
    country_of_origin: "MYS",
    discount_rate: "",
    discount_reason: "",
    fee_charge_rate: "",
    fee_charge_reason: "",
    remarks: "",
    msic_code: "",
    msic_description: "",
    tax_details: [],
};

export default function ProductForm() {
    const nav = useNavigate();
    const qc = useQueryClient();
    const { id } = useParams();
    const [params] = useSearchParams();
    const isView = params.get("view") === "1";
    const isEdit = !!id;
    const { companies, currentId } = useCompany();

    const [form, setForm] = useState({ ...EMPTY });
    const [taxSel, setTaxSel] = useState(null);
    const [taxDialog, setTaxDialog] = useState(null); // {mode:"add"|"edit", row}

    const { data: existing } = useQuery({
        queryKey: ["product", id],
        enabled: !!id,
        queryFn: async () => (await api.get(`/products/${id}`)).data,
    });

    useEffect(() => {
        if (!existing) return;
        setForm({
            company_id: existing.company_id || "",
            sku: existing.sku || "",
            name: existing.name || "",
            classification_code: existing.classification_code || "",
            measurement: existing.unit || "",
            unit_price: existing.unit_price ?? "",
            tariff_code: existing.hs_code || "",
            country_of_origin: existing.country_of_origin || "MYS",
            discount_rate: existing.discount_rate ?? "",
            discount_reason: existing.discount_reason || "",
            fee_charge_rate: existing.fee_charge_rate ?? "",
            fee_charge_reason: existing.fee_charge_reason || "",
            remarks: existing.remarks || existing.description || "",
            msic_code: existing.msic_code || "",
            msic_description: existing.msic_description || "",
            tax_details: existing.tax_details || [],
        });
    }, [existing]);

    // Default the company selector to current clinic on new-form load
    useEffect(() => {
        if (!id && !form.company_id && currentId) {
            setForm((f) => ({ ...f, company_id: currentId }));
        }
    }, [id, currentId, form.company_id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const validate = () => {
        if (!form.company_id) return "My Company is required";
        if (!form.classification_code) return "Classification is required";
        if (!form.sku.trim()) return "Item Code is required";
        if (!form.name.trim()) return "Item Name is required";
        if (form.unit_price === "" || Number(form.unit_price) < 0) return "Unit Price is required";
        return null;
    };

    const submit = async () => {
        const err = validate();
        if (err) return toast.error(err);
        const payload = {
            company_id: form.company_id,
            sku: form.sku,
            name: form.name,
            type: "service",
            classification_code: form.classification_code,
            unit: form.measurement || "each",
            unit_price: Number(form.unit_price) || 0,
            tax_rate: Number(form.tax_details?.[0]?.tax_rate || 0),
            hs_code: form.tariff_code || null,
            country_of_origin: form.country_of_origin || "MYS",
            discount_rate: Number(form.discount_rate) || 0,
            discount_reason: form.discount_reason || "",
            fee_charge_rate: Number(form.fee_charge_rate) || 0,
            fee_charge_reason: form.fee_charge_reason || "",
            remarks: form.remarks || "",
            description: form.remarks || "",
            msic_code: form.msic_code || null,
            msic_description: form.msic_description || null,
            tax_details: form.tax_details || [],
        };
        try {
            if (isEdit) {
                await api.put(`/products/${id}`, payload);
                toast.success("Product updated");
            } else {
                await api.post("/products", payload);
                toast.success("Product created");
            }
            qc.invalidateQueries({ queryKey: ["products"] });
            nav("/products");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    // ------- Tax details CRUD -------
    const addTax = () => setTaxDialog({ mode: "add", row: {
        tax_type: "01", tax_rate: 6, per_unit_amount: 0, measurement: "",
    } });
    const editTax = () => {
        if (taxSel == null) return toast.error("Please select a tax row");
        setTaxDialog({ mode: "edit", index: taxSel, row: { ...form.tax_details[taxSel] } });
    };
    const removeTax = () => {
        if (taxSel == null) return toast.error("Please select a tax row");
        set("tax_details", form.tax_details.filter((_, i) => i !== taxSel));
        setTaxSel(null);
    };
    const saveTaxDialog = () => {
        const list = [...(form.tax_details || [])];
        if (taxDialog.mode === "add") list.push(taxDialog.row);
        else list[taxDialog.index] = taxDialog.row;
        set("tax_details", list);
        setTaxDialog(null);
        setTaxSel(null);
    };

    const title = isView ? "View" : isEdit ? "Modify" : "Add";

    return (
        <div className="pb-24">
            {/* Breadcrumb */}
            <div className="mb-4 flex items-center gap-2 text-sm">
                <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground" data-testid="back-btn">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <Link to="/products" className="text-muted-foreground hover:text-foreground">Product & Services</Link>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{title}</span>
            </div>

            {/* 2-column body */}
            <div className="rounded-md border border-border bg-card px-6 py-6">
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                    {/* Left column */}
                    <TF l={<Req>My Company</Req>}>
                        <Select value={form.company_id} onValueChange={(v) => set("company_id", v)} disabled={isView}>
                            <SelectTrigger data-testid="p-company"
                                           className="bg-yellow-50 dark:bg-yellow-500/10">
                                <SelectValue placeholder="Please Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {(companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>
                    <TF l={<Req>Item Code</Req>}>
                        <Input value={form.sku} onChange={(e) => set("sku", e.target.value)}
                               placeholder="e.g. MED-001" data-testid="p-item-code"
                               disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" />
                    </TF>

                    <TF l={<Req>Classification</Req>}>
                        <CodeSelect
                            options={LHDN_CLASSIFICATIONS}
                            value={form.classification_code}
                            onChange={(code) => set("classification_code", code)}
                            testid="p-classification"
                            className="bg-yellow-50 dark:bg-yellow-500/10"
                        />
                    </TF>
                    <TF l={<Req>Item Name</Req>}>
                        <Input value={form.name} onChange={(e) => set("name", e.target.value)}
                               placeholder="e.g. Paracetamol 500mg" data-testid="p-item-name"
                               disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" />
                    </TF>

                    <TF l="Measurement">
                        <CodeSelect
                            options={MEASUREMENT_CODES}
                            value={form.measurement}
                            onChange={(code) => set("measurement", code)}
                            testid="p-measurement"
                        />
                    </TF>
                    <TF l={<Req>Unit Price</Req>}>
                        <Input type="number" step="0.01" value={form.unit_price}
                               onChange={(e) => set("unit_price", e.target.value)}
                               placeholder="0.00" data-testid="p-unit-price"
                               disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" />
                    </TF>

                    <TF l="Product Tariff Code">
                        <Input value={form.tariff_code} onChange={(e) => set("tariff_code", e.target.value)}
                               placeholder="e.g. 3004.90" data-testid="p-tariff" disabled={isView} />
                    </TF>
                    <TF l="Country of Origin">
                        <Select value={form.country_of_origin} onValueChange={(v) => set("country_of_origin", v)}
                                disabled={isView}>
                            <SelectTrigger data-testid="p-country"><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>

                    <TF l="Discount Rate">
                        <div className="flex items-center gap-2">
                            <Input type="number" step="0.01" value={form.discount_rate}
                                   onChange={(e) => set("discount_rate", e.target.value)} disabled={isView}
                                   data-testid="p-discount-rate" />
                            <span className="text-sm text-muted-foreground">%</span>
                        </div>
                    </TF>
                    <TF l="Fee/Charge Rate">
                        <div className="flex items-center gap-2">
                            <Input type="number" step="0.01" value={form.fee_charge_rate}
                                   onChange={(e) => set("fee_charge_rate", e.target.value)} disabled={isView} />
                            <span className="text-sm text-muted-foreground">%</span>
                        </div>
                    </TF>

                    <TF l="Discount Reason" full>
                        <Textarea rows={2} value={form.discount_reason}
                                  onChange={(e) => set("discount_reason", e.target.value)} disabled={isView} />
                    </TF>
                    <TF l="Fee/Charge Reason" full>
                        <Textarea rows={2} value={form.fee_charge_reason}
                                  onChange={(e) => set("fee_charge_reason", e.target.value)} disabled={isView} />
                    </TF>

                    <TF l="MSIC" full>
                        <CodeSelect
                            options={MSIC_CODES}
                            value={form.msic_code}
                            onChange={(code, desc) => { set("msic_code", code); set("msic_description", desc); }}
                            testid="p-msic"
                        />
                    </TF>
                </div>

                {/* Tax Details */}
                <div className="mt-8">
                    <div className="mb-2 text-sm font-medium">Tax Details</div>
                    <div className="mb-2 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={addTax} disabled={isView} data-testid="tax-add">
                            <Plus className="mr-2 h-3.5 w-3.5" /> Add
                        </Button>
                        <Button variant="outline" size="sm" onClick={editTax} disabled={isView || taxSel == null} data-testid="tax-modify">
                            <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify
                        </Button>
                        <Button variant="outline" size="sm" onClick={removeTax} disabled={isView || taxSel == null} data-testid="tax-delete">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </Button>
                    </div>
                    <div className="overflow-hidden rounded-md border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-primary text-primary-foreground">
                                <tr>
                                    <th className="w-10 px-3 py-2" />
                                    <th className="px-3 py-2 text-left">NO.</th>
                                    <th className="px-3 py-2 text-left">Tax Type</th>
                                    <th className="px-3 py-2 text-left">Tax Rate (%)</th>
                                    <th className="px-3 py-2 text-left">PerUnit Amount</th>
                                    <th className="px-3 py-2 text-left">Measurement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(form.tax_details || []).map((t, i) => (
                                    <tr key={i} className="border-b border-border/50 cursor-pointer hover:bg-secondary/40"
                                        onClick={() => setTaxSel(i)}
                                        data-testid={`tax-row-${i}`}>
                                        <td className="px-3 py-2">
                                            <input type="radio" checked={taxSel === i} onChange={() => setTaxSel(i)} />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                        <td className="px-3 py-2">{taxTypeLabel(t.tax_type)}</td>
                                        <td className="px-3 py-2 font-mono">{Number(t.tax_rate || 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 font-mono">{Number(t.per_unit_amount || 0).toFixed(2)}</td>
                                        <td className="px-3 py-2">{t.measurement || "—"}</td>
                                    </tr>
                                ))}
                                {(!form.tax_details || form.tax_details.length === 0) && (
                                    <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No Data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-4">
                    <TF l="Remarks" full>
                        <Textarea rows={3} value={form.remarks}
                                  onChange={(e) => set("remarks", e.target.value)} disabled={isView}
                                  data-testid="p-remarks" />
                    </TF>
                </div>
            </div>

            {/* Sticky action bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-primary py-3">
                <div className="flex justify-center gap-3">
                    {!isView && (
                        <Button variant="secondary" onClick={submit} data-testid="p-submit">
                            <Check className="mr-2 h-4 w-4" /> Submit
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => nav("/products")} data-testid="p-cancel">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                </div>
            </div>

            {/* Tax modal */}
            {taxDialog && (
                <TaxDialog
                    initial={taxDialog.row}
                    mode={taxDialog.mode}
                    onSave={(r) => { taxDialog.row = r; saveTaxDialog(); }}
                    onCancel={() => setTaxDialog(null)}
                />
            )}
        </div>
    );
}

function TaxDialog({ initial, mode, onSave, onCancel }) {
    const [row, setRow] = useState(initial);
    const set = (k, v) => setRow((r) => ({ ...r, [k]: v }));
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-md border border-border bg-card p-6 shadow-xl">
                <div className="mb-4 text-lg font-semibold">{mode === "add" ? "Add Tax Detail" : "Modify Tax Detail"}</div>
                <div className="grid grid-cols-1 gap-3">
                    <Field l="Tax Type">
                        <Select value={row.tax_type} onValueChange={(v) => set("tax_type", v)}>
                            <SelectTrigger data-testid="tax-dlg-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TAX_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field l="Tax Rate (%)">
                        <Input type="number" step="0.01" value={row.tax_rate}
                               onChange={(e) => set("tax_rate", e.target.value)} data-testid="tax-dlg-rate" />
                    </Field>
                    <Field l="PerUnit Amount">
                        <Input type="number" step="0.01" value={row.per_unit_amount}
                               onChange={(e) => set("per_unit_amount", e.target.value)} />
                    </Field>
                    <Field l="Measurement">
                        <CodeSelect
                            options={MEASUREMENT_CODES}
                            value={row.measurement}
                            onChange={(code) => set("measurement", code)}
                            testid="tax-dlg-measurement"
                        />
                    </Field>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button size="sm" onClick={() => onSave(row)} data-testid="tax-dlg-save">Save</Button>
                </div>
            </div>
        </div>
    );
}

function taxTypeLabel(v) {
    const t = TAX_TYPES.find((x) => x.v === v);
    return t ? t.l : v || "—";
}

function Req({ children }) {
    return <span>{children} <span className="text-destructive">*</span></span>;
}
function TF({ l, children, full }) {
    return (
        <div className={full ? "col-span-full grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_1fr]"
                             : "grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]"}>
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
function Field({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[140px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
