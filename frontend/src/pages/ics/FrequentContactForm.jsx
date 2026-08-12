import { useEffect, useState } from "react";
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
import { Check, X, ChevronLeft, QrCode, Search } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { COUNTRIES, MY_STATES, citiesFor } from "@/lib/malaysia";
import { MSIC_CODES } from "@/lib/msic";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const ID_TYPES = [
    { v: "Business Registration Number", l: "Business Registration Number" },
    { v: "NRIC", l: "NRIC" },
    { v: "Passport", l: "Passport" },
    { v: "Army", l: "Army" },
];

const EMPTY = {
    company_id: "",
    party_type: "both",
    id_type: "Business Registration Number",
    id_value: "",
    tin: "",
    name: "",
    sst_registration_number: "",
    tourism_tax_registration_number: "",
    contact_number: "",
    email: "",
    buyer_code: "",
    msic_code: "",
    msic_description: "",
    authorisation_number: "",
    business_activity: "",
    country: "MYS",
    state: "",
    city: "",
    addr_line_0: "",
    addr_line_1: "",
    addr_line_2: "",
    postal_zone: "",
};

export default function FrequentContactForm() {
    const nav = useNavigate();
    const qc = useQueryClient();
    const { id } = useParams();
    const [params] = useSearchParams();
    const isView = params.get("view") === "1";
    const isEdit = !!id;
    const { companies, currentId } = useCompany();

    const [form, setForm] = useState({ ...EMPTY });
    const [lookupOpen, setLookupOpen] = useState(false);
    const [lookupMode, setLookupMode] = useState("tin"); // tin | qr
    const [lookupInput, setLookupInput] = useState("");
    const [lookupBusy, setLookupBusy] = useState(false);

    const runLookup = async () => {
        if (!lookupInput.trim()) return toast.error("Enter a value");
        setLookupBusy(true);
        try {
            const url = lookupMode === "tin" ? "/taxpayer/by-tin" : "/taxpayer/lookup-qr";
            const body = lookupMode === "tin" ? { tin: lookupInput } : { qrCode: lookupInput };
            const { data: p } = await api.post(url, body);
            setForm((f) => ({
                ...f,
                tin: p.tin || f.tin,
                id_type: p.id_type || f.id_type,
                id_value: p.id_number || f.id_value,
                name: p.name || f.name,
                sst_registration_number: p.sst || f.sst_registration_number,
                contact_number: p.contact_number || f.contact_number,
                email: p.email || f.email,
                msic_code: p.msic || f.msic_code,
                msic_description: p.business_activity_description_en || f.msic_description,
                business_activity: p.business_activity_description_en || f.business_activity,
                country: p.country || f.country,
                state: p.state || f.state,
                city: p.city || f.city,
                addr_line_0: p.address_line_0 || f.addr_line_0,
                addr_line_1: p.address_line_1 || f.addr_line_1,
                addr_line_2: p.address_line_2 || f.addr_line_2,
                postal_zone: p.postal_zone || f.postal_zone,
            }));
            toast.success(`Loaded ${p.name} from LHDN`);
            setLookupOpen(false); setLookupInput("");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setLookupBusy(false); }
    };

    const { data: existing } = useQuery({
        queryKey: ["frequent-contact", id],
        enabled: !!id,
        queryFn: async () => (await api.get(`/frequent-contacts/${id}`)).data,
    });

    useEffect(() => {
        if (!existing) return;
        setForm({ ...EMPTY, ...existing });
    }, [existing]);

    useEffect(() => {
        if (!id && !form.company_id && currentId) {
            setForm((f) => ({ ...f, company_id: currentId }));
        }
    }, [id, currentId, form.company_id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const validate = () => {
        if (!form.company_id) return "My Company is required";
        if (!form.id_type) return "ID Type is required";
        if (!form.id_value.trim()) return "ID Value is required";
        if (!form.tin.trim()) return "TIN is required";
        if (!form.name.trim()) return "Name is required";
        if (!form.contact_number.trim()) return "Contact Number is required";
        if (!form.country) return "Country is required";
        if (form.country === "MYS" && !form.state) return "State is required";
        if (form.country === "MYS" && !form.city) return "City Name is required";
        if (!form.addr_line_0.trim()) return "Address Line 0 is required";
        return null;
    };

    const submit = async () => {
        const err = validate();
        if (err) return toast.error(err);
        try {
            if (isEdit) {
                await api.put(`/frequent-contacts/${id}`, form);
                toast.success("Contact updated");
            } else {
                await api.post("/frequent-contacts", form);
                toast.success("Contact created");
            }
            qc.invalidateQueries({ queryKey: ["frequent-contacts"] });
            nav("/ics/frequent-contacts");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const stateCities = citiesFor(form.state) || [];
    const title = isView ? "View" : isEdit ? "Modify" : "Add";

    return (
        <div className="pb-24">
            <div className="mb-4 flex items-center gap-2 text-sm">
                <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground" data-testid="back-btn">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <Link to="/ics/frequent-contacts" className="text-muted-foreground hover:text-foreground">
                    Supplier & Buyer
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{title}</span>
                {!isView && (
                    <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm"
                                onClick={() => { setLookupMode("tin"); setLookupOpen(true); }}
                                data-testid="lookup-tin-btn">
                            <Search className="mr-2 h-3.5 w-3.5" /> Lookup by TIN
                        </Button>
                        <Button variant="outline" size="sm"
                                onClick={() => { setLookupMode("qr"); setLookupOpen(true); }}
                                data-testid="lookup-qr-btn">
                            <QrCode className="mr-2 h-3.5 w-3.5" /> Scan QR
                        </Button>
                    </div>
                )}
            </div>

            <div className="rounded-md border border-border bg-card px-6 py-6">
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                    {/* Left col row 1 */}
                    <TF l={<Req>My Company</Req>}>
                        <Select value={form.company_id} onValueChange={(v) => set("company_id", v)} disabled={isView}>
                            <SelectTrigger data-testid="c-company"
                                className="bg-yellow-50 dark:bg-yellow-500/10">
                                <SelectValue placeholder="Please Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {(companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>
                    <TF l={<Req>ID Type</Req>}>
                        <Select value={form.id_type} onValueChange={(v) => set("id_type", v)} disabled={isView}>
                            <SelectTrigger data-testid="c-id-type"
                                className="bg-yellow-50 dark:bg-yellow-500/10">
                                <SelectValue placeholder="Please Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {ID_TYPES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>

                    <TF l={<Req>ID Value</Req>}>
                        <Input value={form.id_value} onChange={(e) => set("id_value", e.target.value)}
                               placeholder="e.g. 201601034740" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="c-id-value" />
                    </TF>
                    <TF l={<Req>TIN</Req>}>
                        <Input value={form.tin} onChange={(e) => set("tin", e.target.value)}
                               placeholder="e.g. C24700902040" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="c-tin" />
                    </TF>

                    <TF l={<Req>Name</Req>}>
                        <Input value={form.name} onChange={(e) => set("name", e.target.value)}
                               placeholder="e.g. Acme Sdn Bhd" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="c-name" />
                    </TF>
                    <TF l="SST Registration Number">
                        <Input value={form.sst_registration_number}
                               onChange={(e) => set("sst_registration_number", e.target.value)}
                               placeholder="NA" disabled={isView} data-testid="c-sst" />
                    </TF>

                    <TF l={<Req>Contact Number</Req>}>
                        <Input value={form.contact_number}
                               onChange={(e) => set("contact_number", e.target.value)}
                               placeholder="e.g. +60312345678" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="c-contact" />
                    </TF>
                    <TF l="E-mail">
                        <Input type="email" value={form.email}
                               onChange={(e) => set("email", e.target.value)}
                               placeholder="e.g. billing@acme.my" disabled={isView} data-testid="c-email" />
                    </TF>

                    <TF l="Buyer Code">
                        <Input value={form.buyer_code} onChange={(e) => set("buyer_code", e.target.value)}
                               placeholder="e.g. B-000123" disabled={isView} data-testid="c-buyer-code" />
                    </TF>
                    <TF l="Tourism Tax Registration Number">
                        <Input value={form.tourism_tax_registration_number}
                               onChange={(e) => set("tourism_tax_registration_number", e.target.value)}
                               placeholder="NA" disabled={isView} />
                    </TF>

                    <TF l="Malaysia Standard Industrial Classification">
                        <CodeSelect
                            options={MSIC_CODES}
                            value={form.msic_code}
                            onChange={(code, desc) => { set("msic_code", code); set("msic_description", desc); }}
                            testid="c-msic"
                        />
                    </TF>
                    <TF l="Authorisation Number For Certified Exporter">
                        <Input value={form.authorisation_number}
                               onChange={(e) => set("authorisation_number", e.target.value)}
                               placeholder="NA" disabled={isView} />
                    </TF>

                    <TF l="Business Activity Description" full>
                        <Textarea rows={2} value={form.business_activity}
                                  onChange={(e) => set("business_activity", e.target.value)}
                                  disabled={isView} data-testid="c-activity" />
                    </TF>
                </div>

                {/* Address */}
                <div className="mt-6 rounded-md border border-border p-4">
                    <div className="mb-3 text-sm font-semibold">Address</div>
                    <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                        <TF l={<Req>Country</Req>}>
                            <Select value={form.country} onValueChange={(v) => set("country", v)} disabled={isView}>
                                <SelectTrigger data-testid="c-country"
                                    className="bg-yellow-50 dark:bg-yellow-500/10">
                                    <SelectValue placeholder="Please Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>
                        <TF l={<Req>State</Req>}>
                            <Select value={form.state} onValueChange={(v) => { set("state", v); set("city", ""); }}
                                    disabled={isView || form.country !== "MYS"}>
                                <SelectTrigger data-testid="c-state"
                                    className="bg-yellow-50 dark:bg-yellow-500/10">
                                    <SelectValue placeholder="Please Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MY_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>

                        <TF l={<Req>City Name</Req>}>
                            <Select value={form.city} onValueChange={(v) => set("city", v)}
                                    disabled={isView || !form.state}>
                                <SelectTrigger data-testid="c-city"
                                    className="bg-yellow-50 dark:bg-yellow-500/10">
                                    <SelectValue placeholder="Please Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stateCities.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>
                        <TF l={<Req>Address Line 0</Req>}>
                            <Input value={form.addr_line_0} onChange={(e) => set("addr_line_0", e.target.value)}
                                   placeholder="Building / Unit" disabled={isView}
                                   className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="c-addr-0" />
                        </TF>

                        <TF l="Address Line 1">
                            <Input value={form.addr_line_1} onChange={(e) => set("addr_line_1", e.target.value)}
                                   placeholder="Street" disabled={isView} data-testid="c-addr-1" />
                        </TF>
                        <TF l="Address Line 2">
                            <Input value={form.addr_line_2} onChange={(e) => set("addr_line_2", e.target.value)}
                                   placeholder="Area" disabled={isView} data-testid="c-addr-2" />
                        </TF>

                        <TF l="Postal Zone">
                            <Input value={form.postal_zone} onChange={(e) => set("postal_zone", e.target.value)}
                                   placeholder="e.g. 50450" disabled={isView} data-testid="c-postal" />
                        </TF>
                    </div>
                </div>
            </div>

            {/* Sticky action bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-primary py-3">
                <div className="flex justify-center gap-3">
                    {!isView && (
                        <Button variant="secondary" onClick={submit} data-testid="c-submit">
                            <Check className="mr-2 h-4 w-4" /> Submit
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => nav("/ics/frequent-contacts")} data-testid="c-cancel">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                </div>
            </div>

            <TaxpayerLookupDialog
                open={lookupOpen}
                onOpenChange={setLookupOpen}
                mode={lookupMode}
                value={lookupInput}
                onChange={setLookupInput}
                onRun={runLookup}
                busy={lookupBusy}
            />
        </div>
    );
}

function Req({ children }) {
    return <span>{children} <span className="text-destructive">*</span></span>;
}

// Lookup dialog rendered inside the parent component tree via portal.
export function TaxpayerLookupDialog({ open, onOpenChange, mode, value, onChange, onRun, busy }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="taxpayer-lookup-dialog">
                <DialogHeader>
                    <DialogTitle>{mode === "tin" ? "Lookup taxpayer by TIN" : "Scan LHDN QR"}</DialogTitle>
                    <DialogDescription>
                        {mode === "tin"
                            ? "Query LHDN for the party record and auto-fill this form."
                            : "Paste the decoded QR string. Try 'tin:C24700902040' for the demo dataset."}
                    </DialogDescription>
                </DialogHeader>
                <Input value={value} onChange={(e) => onChange(e.target.value)}
                       placeholder={mode === "tin" ? "e.g. C24700902040" : "tin:C1234567890 or Base64…"}
                       data-testid="lookup-input" />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onRun} disabled={busy} data-testid="lookup-run">
                        {busy ? "Looking up…" : "Fetch & Fill"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
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
