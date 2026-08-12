import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import BatchImportButton from "@/components/common/BatchImportButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtDay } from "@/lib/format";
import {
    Search, RotateCcw, Plus, Edit3, Trash2, Eye, CheckCircle2, Ban,
    Upload, FileDown,
} from "lucide-react";
import { useCompany } from "@/context/CompanyContext";

const ID_TYPES = [
    { v: "Business Registration Number", l: "Business Registration Number" },
    { v: "NRIC", l: "NRIC" },
    { v: "Passport", l: "Passport" },
    { v: "Army", l: "Army" },
];
const STATUSES = [
    { v: "all", l: "All" },
    { v: "enabled", l: "Enabled" },
    { v: "disabled", l: "Disabled" },
];

const EMPTY_FILTER = {
    company_id: "all",
    id_type: "all",
    id_value: "",
    tin: "",
    name: "",
    status: "all",
    date_from: firstOfMonth(),
    date_to: today(),
};

function today() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

export default function Suppliers() {
    const nav = useNavigate();
    const qc = useQueryClient();
    const { companies } = useCompany();

    const [filter, setFilter] = useState({ ...EMPTY_FILTER });
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });
    const [selected, setSelected] = useState(new Set());

    const { data, isLoading } = useQuery({
        queryKey: ["suppliers"],
        queryFn: async () => (await api.get("/suppliers")).data,
    });

    const rows = useMemo(() => {
        let list = data || [];
        if (applied.company_id !== "all") list = list.filter((r) => r.company_id === applied.company_id);
        if (applied.id_type !== "all") list = list.filter((r) => (r.id_type || "Business Registration Number") === applied.id_type);
        if (applied.id_value) list = list.filter((r) => (r.brn || "").toLowerCase().includes(applied.id_value.toLowerCase()));
        if (applied.tin) list = list.filter((r) => (r.tin || "").toLowerCase().includes(applied.tin.toLowerCase()));
        if (applied.name) list = list.filter((r) => (r.name || "").toLowerCase().includes(applied.name.toLowerCase()));
        if (applied.status !== "all") {
            const on = applied.status === "enabled";
            list = list.filter((r) => (r.enabled !== false) === on);
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

    const doDelete = async () => {
        if (selected.size === 0) return toast.error("Please select at least one row");
        if (!window.confirm(`Delete ${selected.size} supplier(s)?`)) return;
        try {
            for (const id of selected) await api.delete(`/suppliers/${id}`);
            toast.success(`${selected.size} deleted`);
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["suppliers"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const doToggle = async (enable) => {
        if (selected.size === 0) return toast.error("Please select at least one row");
        try {
            for (const id of selected) {
                const row = (data || []).find((r) => r.id === id);
                if (!row) continue;
                const { id: _, ...rest } = row;
                await api.put(`/suppliers/${id}`, { ...rest, enabled: enable });
            }
            toast.success(`${selected.size} ${enable ? "enabled" : "disabled"}`);
            qc.invalidateQueries({ queryKey: ["suppliers"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const doExport = () => {
        const header = ["NO.", "My Company", "ID Type", "ID Value", "TIN", "Name",
                        "SST Registration Number", "Contact Number", "E-mail",
                        "Status", "Operation Date"];
        const csv = [header.join(",")].concat(
            rows.map((r, i) => [
                i + 1,
                q(companyName(r.company_id, companies) || ""),
                q(r.id_type || "Business Registration Number"),
                q(r.brn || ""),
                q(r.tin || ""),
                q(r.name || ""),
                q(r.sst_registration_number || ""),
                q(r.phone || ""),
                q(r.email || ""),
                r.enabled === false ? "Disabled" : "Enabled",
                q(fmtDay(r.updated_at || r.created_at) || ""),
            ].join(",")),
        ).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `suppliers_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported");
    };

    return (
        <div className="pb-16">
            <PageHeader kicker="Master data" title="Suppliers"
                subtitle="LHDN-approved supplier registry — Section B parties used across e-invoices." />

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
                <TF l="ID Type">
                    <Select value={filter.id_type} onValueChange={(v) => set("id_type", v)}>
                        <SelectTrigger data-testid="f-id-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {ID_TYPES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TF>
                <TF l="ID Value">
                    <Input value={filter.id_value} onChange={(e) => set("id_value", e.target.value)}
                           placeholder="e.g. 201601034740" data-testid="f-id-value" />
                </TF>
                <TF l="TIN">
                    <Input value={filter.tin} onChange={(e) => set("tin", e.target.value)}
                           placeholder="e.g. C24700902040" data-testid="f-tin" />
                </TF>
                <TF l="Name">
                    <Input value={filter.name} onChange={(e) => set("name", e.target.value)}
                           placeholder="e.g. Acme Sdn Bhd" data-testid="f-name" />
                </TF>
                <TF l="Status">
                    <Select value={filter.status} onValueChange={(v) => set("status", v)}>
                        <SelectTrigger data-testid="f-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {STATUSES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TF>
                <div className="grid grid-cols-2 gap-4">
                    <TF l="Operation Date from">
                        <Input type="date" value={filter.date_from}
                               onChange={(e) => set("date_from", e.target.value)} data-testid="f-date-from" />
                    </TF>
                    <TF l="to">
                        <Input type="date" value={filter.date_to}
                               onChange={(e) => set("date_to", e.target.value)} data-testid="f-date-to" />
                    </TF>
                </div>
            </div>

            <div className="mb-3 flex items-center justify-center gap-2 rounded-md bg-primary py-2">
                <Button size="sm" variant="secondary" onClick={onSearch} data-testid="btn-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={onReset} data-testid="btn-reset">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" data-testid="op-add">
                    <Link to="/suppliers/new"><Plus className="mr-2 h-3.5 w-3.5" /> Add</Link>
                </Button>
                <Button variant="outline" size="sm" data-testid="op-modify"
                        disabled={selected.size !== 1}
                        onClick={() => { const id = oneSelected(); if (id) nav(`/suppliers/${id}/edit`); }}>
                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify
                </Button>
                <Button variant="outline" size="sm" data-testid="op-delete"
                        disabled={selected.size === 0} onClick={doDelete}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </Button>
                <Button variant="outline" size="sm" data-testid="op-view"
                        disabled={selected.size !== 1}
                        onClick={() => { const id = oneSelected(); if (id) nav(`/suppliers/${id}/edit?view=1`); }}>
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
                <BatchImportButton entity="suppliers"
                    onDone={() => qc.invalidateQueries({ queryKey: ["suppliers"] })} />
                <Button variant="outline" size="sm" data-testid="op-export" onClick={doExport}>
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
            </div>

            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-card">
                    <table className="w-full min-w-[1400px] text-sm">
                        <thead className="sticky top-0 z-20 bg-primary text-primary-foreground">
                            <tr>
                                <th className="sticky left-0 z-30 w-10 bg-primary px-3 py-3">
                                    <Checkbox checked={rows.length > 0 && selected.size === rows.length}
                                              onCheckedChange={toggleAll} data-testid="row-select-all" />
                                </th>
                                <th className="px-3 py-3 text-left">NO.</th>
                                <th className="px-3 py-3 text-left">My Company</th>
                                <th className="px-3 py-3 text-left">ID Type</th>
                                <th className="px-3 py-3 text-left">ID Value</th>
                                <th className="px-3 py-3 text-left">TIN</th>
                                <th className="px-3 py-3 text-left">Name</th>
                                <th className="px-3 py-3 text-left">SST Registration Number</th>
                                <th className="px-3 py-3 text-left">Contact Number</th>
                                <th className="px-3 py-3 text-left">E-mail</th>
                                <th className="px-3 py-3 text-left">Status</th>
                                <th className="px-3 py-3 text-left">Operation Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.id} className="group border-b border-border/50 hover:bg-secondary/40">
                                    <td className="sticky left-0 z-10 w-10 bg-card px-3 py-2 group-hover:bg-secondary/40">
                                        <Checkbox checked={selected.has(r.id)}
                                                  onCheckedChange={() => toggleRow(r.id)}
                                                  data-testid={`row-select-${r.id}`} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2">{companyName(r.company_id, companies) || "—"}</td>
                                    <td className="px-3 py-2">{r.id_type || "Business Registration Number"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.brn || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.tin || "—"}</td>
                                    <td className="px-3 py-2 font-medium">{r.name}</td>
                                    <td className="px-3 py-2">{r.sst_registration_number || "—"}</td>
                                    <td className="px-3 py-2">{r.phone || "—"}</td>
                                    <td className="px-3 py-2">{r.email || "—"}</td>
                                    <td className="px-3 py-2">
                                        <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                                            r.enabled === false ? "bg-muted text-muted-foreground" : "bg-emerald-500/20 text-emerald-600"
                                        }`}>
                                            {r.enabled === false ? "Disabled" : "Enabled"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs">{fmtDay(r.updated_at || r.created_at)}</td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={12} className="py-10 text-center text-sm text-muted-foreground">No Data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function q(s) { s = String(s ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function companyName(id, companies) {
    if (!id || !companies) return "";
    return companies.find((c) => c.id === id)?.name || "";
}
function TF({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
