import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Save, X } from "lucide-react";
import { COUNTRIES, MY_STATES, citiesFor, areasFor } from "@/lib/malaysia";
import MsicSelect from "@/components/common/MsicSelect";

const ID_TYPES = ["Business Registration Number", "NRIC", "Passport", "Army"];

const EMPTY = {
    tin: "", name: "",
    id_type: "Business Registration Number", id_value: "",
    sst: "NA", tourism_tax: "NA",
    contact: "", email: "",
    msic_code: "86201",
    msic_description: "General medical services",
    authorisation: "NA",
    activity: "",
    country: "MYS", state: "Perak",
    city: "Teluk Intan", area: "Bandar Baru",
    addr_0: "", addr_1: "", addr_2: "", postal: "36000",
};

export default function Suppliers() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ ...EMPTY });
    const { data, isLoading } = useQuery({
        queryKey: ["suppliers"],
        queryFn: async () => (await api.get("/suppliers")).data,
    });

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const create = async () => {
        try {
            await api.post("/suppliers", {
                name: form.name, tin: form.tin, brn: form.id_value,
                email: form.email, phone: form.contact,
                msic_code: form.msic_code,
                msic_description: form.msic_description,
                billing_address: [form.addr_0, form.addr_1, form.addr_2, form.city, form.state]
                    .filter(Boolean).join(", "),
            });
            toast.success("Supplier created");
            setOpen(false); setForm({ ...EMPTY });
            qc.invalidateQueries({ queryKey: ["suppliers"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div>
            <PageHeader
                kicker="Master data"
                title="Suppliers"
                subtitle="Manage supplier master data — LHDN-approved details for Section B."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-supplier-btn">
                                <Plus className="mr-2 h-4 w-4" /> New Supplier
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl p-0" data-testid="new-supplier-modal">
                            <div className="border-b border-border px-6 pt-5 pb-3">
                                <DialogHeader>
                                    <DialogTitle>New Supplier</DialogTitle>
                                    <DialogDescription>
                                        Section B · LHDN-approved supplier information.
                                    </DialogDescription>
                                </DialogHeader>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                                <SectionBar title="Section B: Supplier's Information" />
                                <Card>
                                    <TF l="TIN"><Input value={form.tin} onChange={(e) => set("tin", e.target.value)}
                                                       data-testid="sup-tin" /></TF>
                                    <TF l="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)}
                                                        data-testid="sup-name" /></TF>
                                    <TF l="ID Type">
                                        <SelectField value={form.id_type} onValueChange={(v) => set("id_type", v)}
                                                     options={ID_TYPES.map((t) => ({ v: t, l: t }))} />
                                    </TF>
                                    <TF l="ID Value">
                                        <Input value={form.id_value} onChange={(e) => set("id_value", e.target.value)} />
                                    </TF>
                                    <TF l="SST Registration Number">
                                        <Input value={form.sst} onChange={(e) => set("sst", e.target.value)} />
                                    </TF>
                                    <TF l="Tourism Tax Registration Number">
                                        <Input value={form.tourism_tax} onChange={(e) => set("tourism_tax", e.target.value)} />
                                    </TF>
                                    <TF l="Contact Number">
                                        <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
                                    </TF>
                                    <TF l="E-mail">
                                        <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
                                    </TF>
                                    <TF l="Malaysia Standard Industrial Classification">
                                        <MsicSelect
                                            value={form.msic_code}
                                            onChange={(code, desc) => {
                                                set("msic_code", code);
                                                set("msic_description", desc);
                                            }}
                                            testid="sup-msic"
                                        />
                                    </TF>
                                    <TF l="Authorisation Number For Certified Exporter">
                                        <Input value={form.authorisation} onChange={(e) => set("authorisation", e.target.value)} />
                                    </TF>
                                    <TF l="Business Activity Description" full>
                                        <Textarea value={form.activity} onChange={(e) => set("activity", e.target.value)} rows={2} />
                                    </TF>
                                    <AddressBlock form={form} set={set} />
                                </Card>
                            </div>
                            <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                                <Button variant="secondary" size="sm" onClick={create} data-testid="sup-save-btn">
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
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">TIN / BRN</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Phone</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((s) => (
                                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-medium">{s.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{s.tin} / {s.brn}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{s.email || "—"}</td>
                                    <td className="px-4 py-3">{s.phone || "—"}</td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                                    No suppliers yet.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function AddressBlock({ form, set }) {
    const state = form.state;
    const cities = citiesFor(state);
    const areas = areasFor(form.city);
    return (
        <div className="col-span-full mt-4 rounded border border-border bg-secondary/10 p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Address</div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                <TF l="Country">
                    <SelectField value={form.country} onValueChange={(v) => set("country", v)}
                                 options={COUNTRIES.map((c) => ({ v: c.code, l: c.name }))} />
                </TF>
                <TF l="State">
                    <SelectField value={state}
                                 onValueChange={(v) => { set("state", v); const c = citiesFor(v)[0] || ""; set("city", c); set("area", areasFor(c)[0] || "Central"); }}
                                 options={MY_STATES.map((s) => ({ v: s, l: s }))}
                                 testid="sup-state" />
                </TF>
                <TF l="City Name">
                    <SelectField value={form.city}
                                 onValueChange={(v) => { set("city", v); set("area", areasFor(v)[0] || "Central"); }}
                                 options={cities.map((c) => ({ v: c, l: c }))}
                                 testid="sup-city" />
                </TF>
                <TF l="Area">
                    <SelectField value={form.area} onValueChange={(v) => set("area", v)}
                                 options={areas.map((a) => ({ v: a, l: a }))} testid="sup-area" />
                </TF>
                <TF l="Address Line 0"><Input value={form.addr_0} onChange={(e) => set("addr_0", e.target.value)} /></TF>
                <TF l="Address Line 1"><Input value={form.addr_1} onChange={(e) => set("addr_1", e.target.value)} /></TF>
                <TF l="Address Line 2"><Input value={form.addr_2} onChange={(e) => set("addr_2", e.target.value)} /></TF>
                <TF l="Postal Zone"><Input value={form.postal} onChange={(e) => set("postal", e.target.value)} /></TF>
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
        <div className="rounded-t-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            {title}
        </div>
    );
}
function Card({ children }) {
    return (
        <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
            {children}
        </div>
    );
}
function TF({ l, children, full }) {
    return (
        <div className={full ? "col-span-full grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_1fr]" : "grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]"}>
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
