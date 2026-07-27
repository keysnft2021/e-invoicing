import PageHeader from "@/components/common/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Moon } from "lucide-react";

export default function Settings() {
    const { user } = useAuth();
    const { theme, toggle } = useTheme();
    return (
        <div>
            <PageHeader
                kicker="Workspace"
                title="Settings"
                subtitle="Workspace configuration, theme and notification preferences."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-4 font-display text-lg font-semibold">Appearance</div>
                    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                            <span>Dark mode</span>
                        </div>
                        <Switch checked={theme === "dark"} onCheckedChange={toggle} data-testid="settings-theme" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-4 font-display text-lg font-semibold">Profile</div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span>{user?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-mono text-xs">{user?.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Role</span>
                            <span className="capitalize">{user?.role?.replaceAll("_", " ")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tenant ID</span>
                            <span className="font-mono text-xs">{user?.tenant_id?.slice(-8)}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
                    <div className="mb-4 font-display text-lg font-semibold">API surface</div>
                    <div className="text-sm text-muted-foreground">
                        A complete OpenAPI schema is available at{" "}
                        <a
                            href={`${process.env.REACT_APP_BACKEND_URL}/docs`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                            data-testid="link-openapi"
                        >
                            /docs
                        </a>{" "}
                        (Swagger UI). Every module — invoices, customers, MyTax, adapters — is exposed
                        as versioned REST endpoints.
                    </div>
                </div>
            </div>
        </div>
    );
}
