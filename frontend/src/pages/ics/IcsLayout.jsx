import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Wallet, FileArchive, BarChart3, Info, ChevronRight } from "lucide-react";

const ICS_NAV = [
    { to: "/ics", end: true, label: "Dashboard", icon: Wallet, testid: "ics-nav-dashboard" },
    { to: "/ics/my-transaction", label: "My Transaction", icon: FileArchive, testid: "ics-nav-transaction" },
    { to: "/ics/consolidated", label: "Consolidated Task", icon: FileArchive, testid: "ics-nav-consolidated" },
    { to: "/ics/fiscal-document", label: "My Fiscal Document", icon: FileArchive, testid: "ics-nav-fiscal" },
    { to: "/ics/reports", label: "Reports", icon: BarChart3, testid: "ics-nav-reports" },
    { to: "/ics/basic-info", label: "Basic Info", icon: Info, testid: "ics-nav-basic" },
];

export default function IcsLayout() {
    return (
        <div className="flex gap-6">
            <aside data-testid="ics-sidebar" className="hidden lg:block w-56 shrink-0">
                <div className="sticky top-4 rounded-xl border border-border bg-card">
                    <div className="rounded-t-xl bg-accent px-5 py-3 text-center text-sm font-semibold uppercase tracking-widest text-accent-foreground">
                        ICS
                    </div>
                    <nav className="p-2">
                        {ICS_NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.end}
                                data-testid={n.testid}
                                className={({ isActive }) =>
                                    cn(
                                        "group flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                                        isActive
                                            ? "bg-secondary text-foreground font-medium"
                                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                                    )
                                }
                            >
                                <span className="flex items-center gap-2">
                                    <n.icon className="h-3.5 w-3.5" />
                                    {n.label}
                                </span>
                                <ChevronRight className="h-3 w-3 opacity-60" />
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </aside>
            <div className="flex-1 min-w-0">
                <Outlet />
            </div>
        </div>
    );
}
