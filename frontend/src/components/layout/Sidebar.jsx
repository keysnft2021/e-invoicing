import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
    LayoutList,
    ChevronRight,
    ChevronDown,
    Wallet,
    FileArchive,
    BarChart3,
    Info,
} from "lucide-react";

const ICS_CHILDREN = [
    { to: "/ics", end: true, label: "Dashboard", icon: Wallet, testid: "ics-nav-dashboard" },
    { to: "/ics/my-transaction", label: "My Transaction", icon: FileArchive, testid: "ics-nav-transaction" },
    { to: "/ics/consolidated", label: "Consolidated Task", icon: FileArchive, testid: "ics-nav-consolidated" },
    { to: "/ics/fiscal-document", label: "My Fiscal Document", icon: FileArchive, testid: "ics-nav-fiscal" },
    { to: "/ics/reports", label: "Reports", icon: BarChart3, testid: "ics-nav-reports" },
    { to: "/ics/basic-info", label: "Basic Info", icon: Info, testid: "ics-nav-basic" },
];

const NAV = [
    { to: "/", label: "Overview", icon: LayoutDashboard, testid: "nav-overview" },
    { label: "ICS Console", icon: LayoutList, testid: "nav-ics", children: ICS_CHILDREN, matchPath: "/ics" },
    { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
    { to: "/suppliers", label: "Suppliers", icon: Truck, testid: "nav-suppliers" },
    { to: "/products", label: "Products", icon: Package, testid: "nav-products" },
    { to: "/mytax", label: "MyTax / MyInvois", icon: Landmark, testid: "nav-mytax" },
    { to: "/gov-config", label: "Gov API Config", icon: KeyRound, testid: "nav-gov-config" },
    { to: "/api-clients", label: "API Clients / Bridge", icon: KeyRound, testid: "nav-api-clients" },
    { to: "/companies", label: "Companies", icon: Building2, testid: "nav-companies" },
    { to: "/users", label: "Users", icon: UserCog, testid: "nav-users" },
    { to: "/roles", label: "Roles & RBAC", icon: ShieldCheck, testid: "nav-roles" },
    { to: "/audit", label: "Audit Trail", icon: ScrollText, testid: "nav-audit" },
    { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [openGroups, setOpenGroups] = useState({});
    const { user } = useAuth();
    const { current } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();

    // Auto-open a group when we're on one of its child routes
    useEffect(() => {
        const next = { ...openGroups };
        let changed = false;
        NAV.forEach((n) => {
            if (n.children && n.matchPath && location.pathname.startsWith(n.matchPath) && !next[n.label]) {
                next[n.label] = true;
                changed = true;
            }
        });
        if (changed) setOpenGroups(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    const toggleGroup = (label) => setOpenGroups((s) => ({ ...s, [label]: !s[label] }));

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
                        <span className="font-display font-semibold text-sm">eInvoices.world</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            LHDN MyInvois
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
                {NAV.map((n) => {
                    if (n.children) {
                        const isOpen = !!openGroups[n.label] || (n.matchPath && location.pathname.startsWith(n.matchPath));
                        const groupActive = n.matchPath && location.pathname.startsWith(n.matchPath);
                        return (
                            <div key={n.label}>
                                <button
                                    type="button"
                                    data-testid={n.testid}
                                    onClick={() => {
                                        if (collapsed) return;
                                        toggleGroup(n.label);
                                        if (!groupActive) navigate(n.children[0].to);
                                    }}
                                    className={cn(
                                        "mx-2 my-0.5 flex w-[calc(100%-16px)] items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                        groupActive
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                    )}
                                >
                                    <span className="flex items-center gap-3">
                                        <n.icon className="h-4 w-4 shrink-0" />
                                        {!collapsed && <span>{n.label}</span>}
                                    </span>
                                    {!collapsed && (
                                        isOpen
                                            ? <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                            : <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                    )}
                                </button>
                                {!collapsed && isOpen && (
                                    <div className="ml-4 border-l border-border/60 pl-2">
                                        {n.children.map((c) => (
                                            <NavLink
                                                key={c.to}
                                                to={c.to}
                                                end={c.end}
                                                data-testid={c.testid}
                                                className={({ isActive }) =>
                                                    cn(
                                                        "mx-2 my-0.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                                                        isActive
                                                            ? "bg-secondary text-foreground font-medium"
                                                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                                                    )
                                                }
                                            >
                                                <c.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                                <span>{c.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return (
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
                    );
                })}
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
