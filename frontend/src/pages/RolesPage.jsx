import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Check } from "lucide-react";

const ROLE_DESCRIPTIONS = {
    super_admin: "Full platform administration across all tenants.",
    organization_owner: "Owns the workspace, billing and all companies.",
    company_admin: "Manages one legal entity, branches and users.",
    branch_admin: "Manages a single branch, transactions and staff.",
    finance_manager: "Approves invoices, manages tax and reporting.",
    finance_executive: "Creates & submits invoices, reconciles payments.",
    accountant: "Book-keeping, reports, cannot cancel gov docs.",
    auditor: "Read-only access to all documents and audit logs.",
    sales: "Creates invoices, manages customers.",
    purchasing: "Manages suppliers and vendor bills.",
    inventory: "Manages products, stock and pricing.",
    customer: "External portal — view own invoices and pay.",
    vendor: "External portal — issue supplier bills.",
    api_user: "Programmatic access via API keys and webhooks.",
    government_user: "LHDN liaison — special submission privileges.",
    support: "Ledger.gov support access with impersonation.",
    read_only: "View-only across the workspace.",
};

const PERM_CATEGORIES = [
    { key: "menu", label: "Menu access" },
    { key: "invoice_actions", label: "Invoice actions" },
    { key: "government", label: "Government submission" },
];

export default function RolesPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["roles-full"],
        queryFn: async () => (await api.get("/roles")).data,
    });

    if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

    return (
        <div>
            <PageHeader
                kicker="Access control"
                title="Roles & permissions"
                subtitle="Preview the 17 enterprise roles and their permission scopes. Configurable per-tenant."
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.roles.map((r) => (
                    <div
                        key={r}
                        data-testid={`role-card-${r}`}
                        className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
                    >
                        <div className="flex items-center gap-2">
                            <div className="rounded-md border border-border p-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <div className="font-display font-semibold capitalize">
                                    {r.replaceAll("_", " ")}
                                </div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                    role.{r}
                                </div>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[r] || "Custom role."}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-8">
                <h2 className="mb-4 font-display text-lg font-semibold">Permission catalog</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {PERM_CATEGORIES.map((cat) => (
                        <div key={cat.key} className="rounded-xl border border-border bg-card p-5">
                            <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                                {cat.label}
                            </div>
                            <div className="space-y-2">
                                {(data.permissions[cat.key] || []).map((p) => (
                                    <div
                                        key={p}
                                        className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs"
                                    >
                                        <Check className="h-3 w-3 text-success" />
                                        <span className="font-mono">{p}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
