import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Save } from "lucide-react";

const ROLE_DESCRIPTIONS = {
    super_admin: "Full platform administration across all tenants.",
    organization_owner: "Owns the workspace, billing and all companies.",
    company_admin: "Manages one legal entity, branches and users.",
    branch_admin: "Manages a single branch, transactions and staff.",
    finance_manager: "Approves invoices, manages tax and reporting.",
    finance_executive: "Creates & submits invoices, reconciles payments.",
    accountant: "Book-keeping, reports, cannot cancel gov docs.",
    auditor: "Read-only across documents and audit logs.",
    sales: "Creates invoices, manages customers.",
    purchasing: "Manages suppliers and vendor bills.",
    inventory: "Manages products, stock and pricing.",
    customer: "External portal — view own invoices and pay.",
    vendor: "External portal — issue supplier bills.",
    api_user: "Programmatic access via API keys and webhooks.",
    government_user: "LHDN liaison — special submission privileges.",
    support: "Support access with impersonation.",
    read_only: "View-only across the workspace.",
};

const DEFAULTS = {
    super_admin: { menu: "*", invoice_actions: "*", government: "*" },
    organization_owner: { menu: "*", invoice_actions: "*", government: "*" },
    company_admin: { menu: "*", invoice_actions: ["create","edit","submit","approve","cancel","download","export"], government: ["submit","cancel","resubmit"] },
    finance_manager: { menu: ["dashboard","invoices","customers","suppliers","products","mytax","audit"], invoice_actions: ["create","edit","submit","approve","cancel","download","export"], government: ["submit","cancel","resubmit"] },
    finance_executive: { menu: ["dashboard","invoices","customers","suppliers","products"], invoice_actions: ["create","edit","submit","download","export"], government: ["submit"] },
    accountant: { menu: ["dashboard","invoices","customers","audit"], invoice_actions: ["create","edit","download","export"], government: [] },
    auditor: { menu: ["dashboard","invoices","audit"], invoice_actions: ["download","export"], government: [] },
    sales: { menu: ["dashboard","invoices","customers"], invoice_actions: ["create","edit","submit"], government: ["submit"] },
    read_only: { menu: ["dashboard","invoices"], invoice_actions: [], government: [] },
};

export default function RolesPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["roles-full"],
        queryFn: async () => (await api.get("/roles")).data,
    });
    const [role, setRole] = useState("finance_manager");
    const [perms, setPerms] = useState({});

    useEffect(() => {
        if (!data) return;
        const saved = data.saved?.[role];
        setPerms(saved || DEFAULTS[role] || { menu: [], invoice_actions: [], government: [] });
    }, [role, data]);

    if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

    const has = (cat, k) => {
        const v = perms[cat];
        return v === "*" || (Array.isArray(v) && v.includes(k));
    };
    const toggle = (cat, k) => {
        const cur = perms[cat] === "*" ? data.permissions[cat] : (Array.isArray(perms[cat]) ? perms[cat] : []);
        const nxt = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
        setPerms({ ...perms, [cat]: nxt });
    };
    const save = async () => {
        try {
            await api.put("/roles/permissions", { role, permissions: perms });
            toast.success(`Permissions saved for ${role.replaceAll("_", " ")}`);
            qc.invalidateQueries({ queryKey: ["roles-full"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div>
            <PageHeader
                kicker="Access control"
                title="Roles & permissions"
                subtitle="Configure the 17 enterprise roles. Toggle menu access, invoice actions and government submission scopes per role — saved per tenant."
                actions={
                    <Button onClick={save} data-testid="save-role-perms">
                        <Save className="mr-2 h-4 w-4" /> Save permissions
                    </Button>
                }
            />
            <div className="mb-6 flex flex-wrap items-center gap-3">
                <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="w-72" data-testid="role-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {data.roles.map((r) => (
                            <SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role] || "Custom role."}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                    { key: "menu", label: "Menu access" },
                    { key: "invoice_actions", label: "Invoice actions" },
                    { key: "government", label: "Government submission" },
                ].map((cat) => (
                    <div key={cat.key} className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                {cat.label}
                            </div>
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            {(data.permissions[cat.key] || []).map((p) => (
                                <label key={p} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
                                    <span className="font-mono">{p}</span>
                                    <Switch
                                        checked={has(cat.key, p)}
                                        onCheckedChange={() => toggle(cat.key, p)}
                                        data-testid={`perm-${cat.key}-${p}`}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
