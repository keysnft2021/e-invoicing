import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import {
    LayoutDashboard,
    FileText,
    Users,
    Building2,
    Package,
    Truck,
    ShieldCheck,
    ScrollText,
    Landmark,
    Settings as SettingsIcon,
    UserCog,
    ChevronsLeft,
    ChevronsRight,
    Sparkles,
    KeyRound,
} from "lucide-react";

const NAV = [
    { to: "/", label: "Overview", icon: LayoutDashboard, testid: "nav-overview" },
    { to: "/invoices", label: "Invoices", icon: FileText, testid: "nav-invoices" },
    { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
    { to: "/suppliers", label: "Suppliers", icon: Truck, testid: "nav-suppliers" },
    { to: "/products", label: "Products", icon: Package, testid: "nav-products" },
    { to: "/mytax", label: "MyTax / MyInvois", icon: Landmark, testid: "nav-mytax" },
    { to: "/gov-config", label: "Gov API Config", icon: KeyRound, testid: "nav-gov-config" },
    { to: "/companies", label: "Companies", icon: Building2, testid: "nav-companies" },
    { to: "/users", label: "Users", icon: UserCog, testid: "nav-users" },
    { to: "/roles", label: "Roles & RBAC", icon: ShieldCheck, testid: "nav-roles" },
    { to: "/audit", label: "Audit Trail", icon: ScrollText, testid: "nav-audit" },
    { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { user } = useAuth();
    const { current } = useCompany();
    const navigate = useNavigate();

    return (
        <aside
            data-testid="app-sidebar"
            className={cn(
                "hidden md:flex flex-col border-r border-border bg-card/40 transition-[width] duration-200",
                collapsed ? "w-[68px]" : "w-[248px]",
            )}
        >
            <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-foreground text-background grid place-items-center">
                    <Sparkles className="h-4 w-4" />
                </div>
                {!collapsed && (
                    <div className="flex flex-col leading-tight">
                        <span className="font-display font-semibold text-sm">Ledger.gov</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            E-Invoicing
                        </span>
                    </div>
                )}
            </div>

            {!collapsed && current && (
                <button
                    data-testid="company-switcher-btn"
                    onClick={() => navigate("/companies")}
                    className="mx-3 mt-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left transition-colors hover:bg-secondary"
                >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Company
                    </div>
                    <div className="truncate text-sm font-medium">{current.name}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {current.tin} · {current.country}
                    </div>
                </button>
            )}

            <nav className="flex-1 overflow-y-auto py-3">
                {NAV.map((n) => (
                    <NavLink
                        key={n.to}
                        to={n.to}
                        end={n.to === "/"}
                        data-testid={n.testid}
                        className={({ isActive }) =>
                            cn(
                                "mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                isActive
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )
                        }
                    >
                        <n.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{n.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="border-t border-border p-3">
                {!collapsed && user && (
                    <div className="mb-2 px-1">
                        <div className="text-xs font-medium truncate">{user.name || user.email}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {user.role?.replaceAll("_", " ")}
                        </div>
                    </div>
                )}
                <button
                    data-testid="sidebar-collapse-btn"
                    onClick={() => setCollapsed((c) => !c)}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                >
                    {collapsed ? (
                        <ChevronsRight className="h-3.5 w-3.5" />
                    ) : (
                        <>
                            <ChevronsLeft className="h-3.5 w-3.5" /> Collapse
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
