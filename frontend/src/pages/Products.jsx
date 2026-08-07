import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import CodeSelect from "@/components/common/CodeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import {
    Search, RotateCcw, Plus, Edit3, Trash2, Eye, CheckCircle2, Ban,
    Upload, FileDown,
} from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { LHDN_CLASSIFICATIONS } from "@/lib/lhdnClassification";

const STATUSES = [
    { v: "all", l: "All" },
    { v: "enabled", l: "Enabled" },
    { v: "disabled", l: "Disabled" },
];

const EMPTY_FILTER = {
    company_id: "all",
    item_code: "",
    item_name: "",
    classification: "",
    status: "all",
    tariff_code: "",
    date_from: firstOfMonth(),
    date_to: today(),
};

function today() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
}

export default function Products() {
    const nav = useNavigate();
    const qc = useQueryClient();
    const { companies } = useCompany();

    const [filter, setFilter] = useState({ ...EMPTY_FILTER });
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });
    const [selected, setSelected] = useState(new Set());

    const { data, isLoading } = useQuery({
        queryKey: ["products"],
        queryFn: async () => (await api.get("/products")).data,
    });

    const rows = useMemo(() => {
        let list = data || [];
        if (applied.item_code) list = list.filter((p) => (p.sku || "").toLowerCase().includes(applied.item_code.toLowerCase()));
        if (applied.item_name) list = list.filter((p) => (p.name || "").toLowerCase().includes(applied.item_name.toLowerCase()));
        if (applied.classification) list = list.filter((p) => (p.classification_code || "") === applied.classification);
        if (applied.tariff_code) list = list.filter((p) => (p.hs_code || "").toLowerCase().includes(applied.tariff_code.toLowerCase()));
        if (applied.status && applied.status !== "all") {
            const on = applied.status === "enabled";
            list = list.filter((p) => (p.enabled !== false) === on);
        }
        return list;
    }, [data, applied]);

    const set = (k, v) => setFilter((f) => ({ ...f, [k]: v }));
    const onSearch = () => setApplied({ ...filter });
    const onReset = () => { setFilter({ ...EMPTY_FILTER }); setApplied({ ...EMPTY_FILTER }); };

    const toggleRow = (id) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };
    const toggleAll = () => {
        if (selected.size === rows.length) setSelected(new Set());
        else setSelected(new Set(rows.map((r) => r.id)));
    };
    const oneSelected = () => selected.size === 1 ? [...selected][0] : null;

    const requireOne = () => {
        if (selected.size !== 1) {
            toast.error("Please select exactly one row");
            return null;
        }
        return oneSelected();
    };

    const doDelete = async () => {
        if (selected.size === 0) return toast.error("Please select at least one row");
        if (!window.confirm(`Delete ${selected.size} product(s)?`)) return;
        try {
            for (const id of selected) {
                await api.delete(`/products/${id}`);
            }
            toast.success(`${selected.size} deleted`);
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["products"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const doToggle = async (enable) => {
        if (selected.size === 0) return toast.error("Please select at least one row");
        try {
            for (const id of selected) {
                const row = (data || []).find((r) => r.id === id);
                if (!row) continue;
                await api.put(`/products/${id}`, { ...row, enabled: enable });
            }
            toast.success(`${selected.size} ${enable ? "enabled" : "disabled"}`);
            qc.invalidateQueries({ queryKey: ["products"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const doExport = () => {
        const header = ["NO.", "My Company", "Item Code", "Classification", "Item Name", "Measurement", "Unit Price"];
        const csv = [header.join(",")].concat(
            rows.map((r, i) => [
                i + 1,
                q(r.company_name || ""),
                q(r.sku || ""),
                q(classifLabel(r.classification_code)),
                q(r.name || ""),
                q(r.unit || ""),
                r.unit_price || 0,
            ].join(",")),
        ).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `products_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported");
    };

    return (
        <div className="pb-16">
            <PageHeader kicker="Master data" title="Product & Services"
                subtitle="LHDN-approved product / service catalog. Manage codes, classifications and tax details." />

            {/* Filter card */}
            <div className="mb-3 grid grid-cols-1 gap-x-8 gap-y-3 rounded-md border border-border bg-card px-6 py-5 md:grid-cols-2">
                <TF l="My Company">
                    <Select value={filter.company_id} onValueChange={(v) => set("company_id", v)}>
                        <SelectTrigger data-testid="f-company"><SelectValue placeholder="Please Select" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All clinics</SelectItem>
                            {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TF>
                <TF l="Item Code">
                    <Input value={filter.item_code} onChange={(e) => set("item_code", e.target.value)}
                           placeholder="e.g. MED-001" data-testid="f-item-code" />
                </TF>
                <TF l="Classification">
                    <CodeSelect
                        options={LHDN_CLASSIFICATIONS}
                        value={filter.classification}
                        onChange={(code) => set("classification", code)}
                        testid="f-classification"
                    />
                </TF>
                <TF l="Item Name">
                    <Input value={filter.item_name} onChange={(e) => set("item_name", e.target.value)}
                           placeholder="e.g. Paracetamol" data-testid="f-item-name" />
                </TF>
                <TF l="Status">
                    <SelectField value={filter.status} onValueChange={(v) => set("status", v)}
                                 options={STATUSES} testid="f-status" />
                </TF>
                <TF l="Product Tariff Code">
                    <Input value={filter.tariff_code} onChange={(e) => set("tariff_code", e.target.value)}
                           placeholder="e.g. 3004.90" data-testid="f-tariff" />
                </TF>
                <TF l="Operation Date from">
                    <Input type="date" value={filter.date_from}
                           onChange={(e) => set("date_from", e.target.value)} data-testid="f-date-from" />
                </TF>
                <TF l="to">
                    <Input type="date" value={filter.date_to}
                           onChange={(e) => set("date_to", e.target.value)} data-testid="f-date-to" />
                </TF>
            </div>

            {/* Search / Reset bar (LHDN red) */}
            <div className="mb-3 flex items-center justify-center gap-2 rounded-md bg-primary py-2">
                <Button size="sm" variant="secondary" onClick={onSearch} data-testid="btn-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={onReset} data-testid="btn-reset">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            {/* Ops toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" data-testid="op-add">
                    <Link to="/products/new"><Plus className="mr-2 h-3.5 w-3.5" /> Add</Link>
                </Button>
                <Button variant="outline" size="sm" data-testid="op-modify"
                        disabled={selected.size !== 1}
                        onClick={() => { const id = requireOne(); if (id) nav(`/products/${id}/edit`); }}>
                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify
                </Button>
                <Button variant="outline" size="sm" data-testid="op-delete"
                        disabled={selected.size === 0} onClick={doDelete}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </Button>
                <Button variant="outline" size="sm" data-testid="op-view"
                        disabled={selected.size !== 1}
                        onClick={() => { const id = requireOne(); if (id) nav(`/products/${id}/edit?view=1`); }}>
                    <Eye className="mr-2 h-3.5 w-3.5" /> View
                </Button>
                <Button variant="outline" size="sm" data-testid="op-enable"
                        disabled={selected.size === 0} onClick={() => doToggle(true)}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Enable
                </Button>
                <Button variant="outline" size="sm" data-testid="op-disable"
                        disabled={selected.size === 0} onClick={() => doToggle(false)}>
                    <Ban className="mr-2 h-3.5 w-3.5" /> Disable
                </Button>
                <Button variant="outline" size="sm" data-testid="op-import"
                        onClick={() => toast.info("Batch import coming soon")}>
                    <Upload className="mr-2 h-3.5 w-3.5" /> Batch Import
                </Button>
                <Button variant="outline" size="sm" data-testid="op-export" onClick={doExport}>
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
            </div>

            {/* Table */}
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="w-10 px-3 py-3">
                                    <Checkbox
                                        checked={rows.length > 0 && selected.size === rows.length}
                                        onCheckedChange={toggleAll}
                                        data-testid="row-select-all"
                                    />
                                </th>
                                <th className="px-3 py-3 text-left">NO.</th>
                                <th className="px-3 py-3 text-left">My Company</th>
                                <th className="px-3 py-3 text-left">Item Code</th>
                                <th className="px-3 py-3 text-left">Classification</th>
                                <th className="px-3 py-3 text-left">Item Name</th>
                                <th className="px-3 py-3 text-left">Measurement</th>
                                <th className="px-3 py-3 text-right">Unit Price</th>
                                <th className="px-3 py-3 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-3 py-2">
                                        <Checkbox
                                            checked={selected.has(r.id)}
                                            onCheckedChange={() => toggleRow(r.id)}
                                            data-testid={`row-select-${r.id}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">{r.company_name || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                                    <td className="px-3 py-2 text-xs">
                                        {r.classification_code
                                            ? `(${r.classification_code}) ${classifLabel(r.classification_code)}`
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-2 font-medium">{r.name}</td>
                                    <td className="px-3 py-2">{r.unit || "each"}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.unit_price)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                                            r.enabled === false ? "bg-muted text-muted-foreground" : "bg-emerald-500/20 text-emerald-600"
                                        }`}>
                                            {r.enabled === false ? "Disabled" : "Enabled"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ------------ helpers ------------
function classifLabel(code) {
    if (!code) return "";
    const c = LHDN_CLASSIFICATIONS.find((x) => x.code === code);
    return c ? c.description : code;
}
function q(s) { s = String(s ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

function TF({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
function SelectField({ value, onValueChange, options, testid }) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger data-testid={testid}><SelectValue placeholder="Please Select" /></SelectTrigger>
            <SelectContent>
                {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}
