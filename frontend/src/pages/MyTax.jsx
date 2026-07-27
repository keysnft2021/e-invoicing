import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Timeline from "@/components/common/Timeline";
import { Plus, ScrollText, Users, Landmark } from "lucide-react";
import { fmtDay } from "@/lib/format";

const ROLE_TYPES = [
    { v: "estate_administrator", l: "Estate Administrator" },
    { v: "company_director", l: "Company Director" },
    { v: "tax_agent_admin_firm", l: "Tax Agent Admin Firm" },
    { v: "representative_non_able", l: "Representative of the Non-Able" },
    { v: "employer", l: "Employer" },
    { v: "lawyer", l: "Lawyer" },
];

export default function MyTax() {
    return (
        <div>
            <PageHeader
                kicker="LHDN · MyTax / MyInvois"
                title="Government onboarding"
                subtitle="Model the LHDN onboarding journey: role applications, representative permissions and MI2U intermediary appointments — before you connect to production."
            />
            <Tabs defaultValue="roles" className="w-full">
                <TabsList data-testid="mytax-tabs">
                    <TabsTrigger value="roles" data-testid="tab-roleapps">
                        <ScrollText className="mr-1.5 h-3.5 w-3.5" />
                        Role Applications
                    </TabsTrigger>
                    <TabsTrigger value="reps" data-testid="tab-reps">
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        Representatives
                    </TabsTrigger>
                    <TabsTrigger value="inter" data-testid="tab-inter">
                        <Landmark className="mr-1.5 h-3.5 w-3.5" />
                        Intermediaries
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="roles" className="mt-6"><RoleApplications /></TabsContent>
                <TabsContent value="reps" className="mt-6"><Representatives /></TabsContent>
                <TabsContent value="inter" className="mt-6"><Intermediaries /></TabsContent>
            </Tabs>
        </div>
    );
}

function RoleApplications() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        application_type: "new",
        role_type: "company_director",
        identification_type: "NRIC",
        identification_no: "",
        applicant_name: "",
        applicant_email: "",
        supporting_document_name: "",
        notes: "",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["role-apps"],
        queryFn: async () => (await api.get("/mytax/role-applications")).data,
    });
    const create = async () => {
        try {
            await api.post("/mytax/role-applications", form);
            toast.success("Role application submitted");
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["role-apps"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    const act = async (id, kind) => {
        try {
            await api.post(`/mytax/role-applications/${id}/${kind}`);
            toast.success(`Application ${kind}`);
            qc.invalidateQueries({ queryKey: ["role-apps"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Simulates the MyTax &ldquo;Role Application&rdquo; flow (Appendix 2). Apply for a role, upload
                    supporting document, then approve or reject.
                </p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="new-roleapp-btn">
                            <Plus className="mr-2 h-4 w-4" /> New application
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Role application</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Application type</Label>
                                <Select
                                    value={form.application_type}
                                    onValueChange={(v) => setForm({ ...form, application_type: v })}
                                >
                                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New Application</SelectItem>
                                        <SelectItem value="termination">Termination</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Role type</Label>
                                <Select
                                    value={form.role_type}
                                    onValueChange={(v) => setForm({ ...form, role_type: v })}
                                >
                                    <SelectTrigger className="mt-1.5" data-testid="ra-role-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLE_TYPES.map((r) => (
                                            <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>ID type</Label>
                                <Select
                                    value={form.identification_type}
                                    onValueChange={(v) => setForm({ ...form, identification_type: v })}
                                >
                                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NRIC">NRIC</SelectItem>
                                        <SelectItem value="Passport">Passport</SelectItem>
                                        <SelectItem value="BRN">Business Reg No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>ID number</Label>
                                <Input
                                    className="mt-1.5"
                                    value={form.identification_no}
                                    onChange={(e) => setForm({ ...form, identification_no: e.target.value })}
                                    data-testid="ra-id-no"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label>Applicant name</Label>
                                <Input
                                    className="mt-1.5"
                                    value={form.applicant_name}
                                    onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
                                    data-testid="ra-name"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label>Applicant email</Label>
                                <Input
                                    className="mt-1.5"
                                    value={form.applicant_email}
                                    onChange={(e) => setForm({ ...form, applicant_email: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label>Supporting document name</Label>
                                <Input
                                    className="mt-1.5"
                                    placeholder="e.g. Directors resolution.pdf (≤ 2MB)"
                                    value={form.supporting_document_name}
                                    onChange={(e) => setForm({ ...form, supporting_document_name: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label>Notes</Label>
                                <Textarea
                                    className="mt-1.5"
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={create} data-testid="ra-save-btn">Submit application</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="space-y-3">
                    {(data || []).map((r) => (
                        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium">{r.applicant_name}</div>
                                        <StatusChip status={r.status} />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {r.role_type?.replaceAll("_", " ")} · {r.application_type} · ID {r.identification_no}
                                    </div>
                                </div>
                                {r.status === "new" && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => act(r.id, "reject")} data-testid={`ra-reject-${r.id}`}>
                                            Reject
                                        </Button>
                                        <Button size="sm" onClick={() => act(r.id, "approve")} data-testid={`ra-approve-${r.id}`}>
                                            Approve
                                        </Button>
                                    </div>
                                )}
                            </div>
                            {r.timeline?.length > 1 && (
                                <div className="mt-4 border-t border-border pt-4">
                                    <Timeline events={r.timeline} />
                                </div>
                            )}
                        </div>
                    ))}
                    {(data || []).length === 0 && (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            No role applications yet.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Representatives() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        identification_type: "NRIC",
        identification_no: "",
        email: "",
        role_type: "company_director",
        permissions: { document: ["view"], taxpayer: [], notifications: [], intermediary: [] },
        status: "active",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["reps"],
        queryFn: async () => (await api.get("/mytax/representatives")).data,
    });

    const togglePerm = (cat, key) => {
        const arr = form.permissions[cat] || [];
        const nxt = arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
        setForm({ ...form, permissions: { ...form.permissions, [cat]: nxt } });
    };

    const create = async () => {
        try {
            await api.post("/mytax/representatives", form);
            toast.success("Representative added");
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["reps"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Grant granular permissions to user representatives (Appendix 3.2). Document · View
                    is always enabled by LHDN policy.
                </p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="new-rep-btn">
                            <Plus className="mr-2 h-4 w-4" /> Add representative
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>New representative</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="rep-name" />
                            </div>
                            <div>
                                <Label>Identification number</Label>
                                <Input value={form.identification_no} onChange={(e) => setForm({ ...form, identification_no: e.target.value })} className="mt-1.5" data-testid="rep-id" />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" />
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <PermGroup title="Document" cat="document" items={[
                                { k: "view", l: "View (always enabled)", disabled: true },
                                { k: "submit", l: "Submit" },
                                { k: "cancel", l: "Cancel" },
                                { k: "reject", l: "Reject" },
                            ]} form={form} togglePerm={togglePerm} />
                            <PermGroup title="Taxpayer" cat="taxpayer" items={[
                                { k: "edit_profile", l: "Edit profile information" },
                                { k: "manage_person_reps", l: "Manage person representatives" },
                                { k: "manage_erps", l: "Manage ERPs" },
                                { k: "manage_intermediaries", l: "Manage intermediaries" },
                                { k: "edit_visual_templates", l: "Edit visual templates" },
                            ]} form={form} togglePerm={togglePerm} />
                            <PermGroup title="Notifications" cat="notifications" items={[
                                { k: "view", l: "View" },
                            ]} form={form} togglePerm={togglePerm} />
                            <PermGroup title="Intermediary" cat="intermediary" items={[
                                { k: "view_companies_summary", l: "View companies' summary data" },
                            ]} form={form} togglePerm={togglePerm} />
                        </div>
                        <DialogFooter>
                            <Button onClick={create} data-testid="rep-save-btn">Save representative</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="space-y-3">
                    {(data || []).map((r) => (
                        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium">{r.name}</div>
                                        <StatusChip status={r.status} />
                                    </div>
                                    <div className="font-mono text-xs text-muted-foreground">
                                        {r.identification_type} · {r.identification_no}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {["document", "taxpayer", "notifications", "intermediary"].flatMap((cat) =>
                                        (r.permissions?.[cat] || []).map((p) => (
                                            <span key={cat + p} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono">
                                                {cat}.{p}
                                            </span>
                                        )),
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PermGroup({ title, cat, items, form, togglePerm }) {
    return (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                {title}
            </div>
            <div className="space-y-2">
                {items.map((it) => {
                    const checked = form.permissions[cat]?.includes(it.k);
                    return (
                        <label key={it.k} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={checked}
                                disabled={it.disabled}
                                onCheckedChange={() => !it.disabled && togglePerm(cat, it.k)}
                                data-testid={`perm-${cat}-${it.k}`}
                            />
                            <span>{it.l}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function Intermediaries() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        tin: "",
        brn: "",
        name: "",
        representation_from: new Date().toISOString().slice(0, 10),
        representation_to: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        is_foreign_company: false,
        is_peppol_supported: false,
        is_registered_intermediary: true,
        status: "active",
        permissions: {
            doc_view: true,
            doc_submit: true,
            doc_cancel: false,
            doc_request_rejection: false,
            notifications_view: false,
        },
    });
    const { data, isLoading } = useQuery({
        queryKey: ["inter"],
        queryFn: async () => (await api.get("/mytax/intermediaries")).data,
    });
    const create = async () => {
        try {
            await api.post("/mytax/intermediaries", form);
            toast.success("Intermediary appointed");
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["inter"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Appoint intermediaries (e.g. MI2U) with representation dates and granular
                    permissions (Appendix 3.3).
                </p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="new-inter-btn">
                            <Plus className="mr-2 h-4 w-4" /> Add intermediary
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Appoint intermediary</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>TIN *</Label>
                                <Input value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} className="mt-1.5" data-testid="int-tin" />
                            </div>
                            <div>
                                <Label>BRN *</Label>
                                <Input value={form.brn} onChange={(e) => setForm({ ...form, brn: e.target.value })} className="mt-1.5" data-testid="int-brn" />
                            </div>
                            <div>
                                <Label>Name *</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="int-name" />
                            </div>
                            <div>
                                <Label>Representation from *</Label>
                                <Input type="date" value={form.representation_from} onChange={(e) => setForm({ ...form, representation_from: e.target.value })} className="mt-1.5" />
                            </div>
                            <div>
                                <Label>Representation to *</Label>
                                <Input type="date" value={form.representation_to} onChange={(e) => setForm({ ...form, representation_to: e.target.value })} className="mt-1.5" />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <Switch checked={form.is_foreign_company} onCheckedChange={(v) => setForm({ ...form, is_foreign_company: v })} />
                                <Label className="text-xs">Foreign company</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={form.is_peppol_supported} onCheckedChange={(v) => setForm({ ...form, is_peppol_supported: v })} />
                                <Label className="text-xs">Peppol supported</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={form.is_registered_intermediary} onCheckedChange={(v) => setForm({ ...form, is_registered_intermediary: v })} />
                                <Label className="text-xs">Registered intermediary</Label>
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
                            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                                Permissions
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <SwitchRow l="Document · View (always enabled)" checked disabled />
                                <SwitchRow l="Document · Submit" checked={form.permissions.doc_submit} onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, doc_submit: v } })} />
                                <SwitchRow l="Document · Cancel" checked={form.permissions.doc_cancel} onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, doc_cancel: v } })} />
                                <SwitchRow l="Document · Request rejection" checked={form.permissions.doc_request_rejection} onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, doc_request_rejection: v } })} />
                                <SwitchRow l="Notifications · View" checked={form.permissions.notifications_view} onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, notifications_view: v } })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={create} data-testid="int-save-btn">Add intermediary</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">TIN / BRN</th>
                                <th className="px-4 py-3">Representation</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((r) => (
                                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-medium">{r.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{r.tin} / {r.brn}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {fmtDay(r.representation_from)} → {fmtDay(r.representation_to)}
                                    </td>
                                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                                        No intermediaries appointed yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function SwitchRow({ l, checked, onCheckedChange, disabled }) {
    return (
        <label className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <span className="text-xs">{l}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </label>
    );
}
