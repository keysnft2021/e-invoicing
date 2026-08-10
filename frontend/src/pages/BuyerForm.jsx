import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, X, ChevronLeft } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { COUNTRIES, MY_STATES, citiesFor } from "@/lib/malaysia";

const ID_TYPES = [
    { v: "Business Registration Number", l: "Business Registration Number" },
    { v: "NRIC", l: "NRIC" },
    { v: "Passport", l: "Passport" },
    { v: "Army", l: "Army" },
];

const EMPTY = {
    company_id: "",
    id_type: "Business Registration Number",
    brn: "",       // ID Value
    tin: "",
    name: "",
    sst_registration_number: "",
    phone: "",     // Contact Number
    email: "",
    buyer_code: "",
    country: "MYS",
    state: "",
    city: "",
    addr_line_0: "",
    addr_line_1: "",
    addr_line_2: "",
    postal_zone: "",
    billing_address: "",
    payment_terms: "NET30",
    credit_limit: 0,
};

export default function BuyerForm() {
    const nav = useNavigate();
    const qc = useQueryClient();
    const { id } = useParams();
    const [params] = useSearchParams();
    const isView = params.get("view") === "1";
    const isEdit = !!id;
    const { companies, currentId } = useCompany();

    const [form, setForm] = useState({ ...EMPTY });

    const { data: existing } = useQuery({
        queryKey: ["customer", id],
        enabled: !!id,
        queryFn: async () => (await api.get(`/customers/${id}`)).data,
    });

    useEffect(() => {
        if (!existing) return;
        setForm((f) => ({ ...f, ...existing }));
    }, [existing]);

    useEffect(() => {
        if (!id && !form.company_id && currentId) {
            setForm((f) => ({ ...f, company_id: currentId }));
        }
    }, [id, currentId, form.company_id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const validate = () => {
        if (!form.id_type) return "ID Type is required";
        if (!form.brn.trim()) return "ID Value is required";
        if (!form.tin.trim()) return "TIN is required";
        if (!form.name.trim()) return "Name is required";
        if (!form.phone.trim()) return "Contact Number is required";
        return null;
    };

    const submit = async () => {
        const err = validate();
        if (err) return toast.error(err);
        const billing = [form.addr_line_0, form.addr_line_1, form.addr_line_2, form.city, form.state]
            .filter(Boolean).join(", ");
        const payload = { ...form, billing_address: billing };
        try {
            if (isEdit) {
                await api.put(`/customers/${id}`, payload);
                toast.success("Buyer updated");
            } else {
                await api.post("/customers", payload);
                toast.success("Buyer created");
            }
            qc.invalidateQueries({ queryKey: ["customers"] });
            nav("/customers");
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
                <Link to="/customers" className="text-muted-foreground hover:text-foreground">Buyers</Link>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{title}</span>
            </div>

            <div className="rounded-md border border-border bg-card px-6 py-6">
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                    <TF l="My Company">
                        <Select value={form.company_id} onValueChange={(v) => set("company_id", v)} disabled={isView}>
                            <SelectTrigger data-testid="b-company"><SelectValue placeholder="Please Select" /></SelectTrigger>
                            <SelectContent>
                                {(companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>
                    <TF l={<Req>ID Type</Req>}>
                        <Select value={form.id_type} onValueChange={(v) => set("id_type", v)} disabled={isView}>
                            <SelectTrigger data-testid="b-id-type"
                                className="bg-yellow-50 dark:bg-yellow-500/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ID_TYPES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </TF>

                    <TF l={<Req>ID Value</Req>}>
                        <Input value={form.brn} onChange={(e) => set("brn", e.target.value)}
                               placeholder="e.g. 201601034740" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="b-id-value" />
                    </TF>
                    <TF l={<Req>TIN</Req>}>
                        <Input value={form.tin} onChange={(e) => set("tin", e.target.value)}
                               placeholder="e.g. C24700902040" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="b-tin" />
                    </TF>

                    <TF l={<Req>Name</Req>}>
                        <Input value={form.name} onChange={(e) => set("name", e.target.value)}
                               placeholder="e.g. Acme Sdn Bhd" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="b-name" />
                    </TF>
                    <TF l="SST Registration Number">
                        <Input value={form.sst_registration_number}
                               onChange={(e) => set("sst_registration_number", e.target.value)}
                               placeholder="NA" disabled={isView} data-testid="b-sst" />
                    </TF>

                    <TF l={<Req>Contact Number</Req>}>
                        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                               placeholder="e.g. +60312345678" disabled={isView}
                               className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="b-contact" />
                    </TF>
                    <TF l="E-mail">
                        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                               placeholder="e.g. billing@acme.my" disabled={isView} data-testid="b-email" />
                    </TF>

                    <TF l="Buyer Code">
                        <Input value={form.buyer_code} onChange={(e) => set("buyer_code", e.target.value)}
                               placeholder="e.g. B-000123" disabled={isView} data-testid="b-buyer-code" />
                    </TF>
                    <TF l="Payment Terms">
                        <Input value={form.payment_terms}
                               onChange={(e) => set("payment_terms", e.target.value)}
                               placeholder="NET30" disabled={isView} />
                    </TF>

                    <TF l="Credit Limit" full>
                        <Input type="number" step="0.01" value={form.credit_limit}
                               onChange={(e) => set("credit_limit", e.target.value)}
                               placeholder="0.00" disabled={isView} />
                    </TF>
                </div>

                <div className="mt-6 rounded-md border border-border p-4">
                    <div className="mb-3 text-sm font-semibold">Address</div>
                    <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                        <TF l={<Req>Country</Req>}>
                            <Select value={form.country} onValueChange={(v) => set("country", v)} disabled={isView}>
                                <SelectTrigger data-testid="b-country"
                                    className="bg-yellow-50 dark:bg-yellow-500/10"><SelectValue placeholder="Please Select" /></SelectTrigger>
                                <SelectContent>
                                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>
                        <TF l={<Req>State</Req>}>
                            <Select value={form.state} onValueChange={(v) => { set("state", v); set("city", ""); }}
                                    disabled={isView || form.country !== "MYS"}>
                                <SelectTrigger data-testid="b-state"
                                    className="bg-yellow-50 dark:bg-yellow-500/10"><SelectValue placeholder="Please Select" /></SelectTrigger>
                                <SelectContent>
                                    {MY_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>

                        <TF l={<Req>City Name</Req>}>
                            <Select value={form.city} onValueChange={(v) => set("city", v)}
                                    disabled={isView || !form.state}>
                                <SelectTrigger data-testid="b-city"
                                    className="bg-yellow-50 dark:bg-yellow-500/10"><SelectValue placeholder="Please Select" /></SelectTrigger>
                                <SelectContent>
                                    {stateCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TF>
                        <TF l={<Req>Address Line 0</Req>}>
                            <Input value={form.addr_line_0} onChange={(e) => set("addr_line_0", e.target.value)}
                                   placeholder="Building / Unit" disabled={isView}
                                   className="bg-yellow-50 dark:bg-yellow-500/10" data-testid="b-addr-0" />
                        </TF>

                        <TF l="Address Line 1">
                            <Input value={form.addr_line_1} onChange={(e) => set("addr_line_1", e.target.value)}
                                   placeholder="Street" disabled={isView} />
                        </TF>
                        <TF l="Address Line 2">
                            <Input value={form.addr_line_2} onChange={(e) => set("addr_line_2", e.target.value)}
                                   placeholder="Area" disabled={isView} />
                        </TF>

                        <TF l="Postal Zone">
                            <Input value={form.postal_zone} onChange={(e) => set("postal_zone", e.target.value)}
                                   placeholder="e.g. 50450" disabled={isView} data-testid="b-postal" />
                        </TF>
                    </div>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-primary py-3">
                <div className="flex justify-center gap-3">
                    {!isView && (
                        <Button variant="secondary" onClick={submit} data-testid="b-submit">
                            <Check className="mr-2 h-4 w-4" /> Submit
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => nav("/customers")} data-testid="b-cancel">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
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
