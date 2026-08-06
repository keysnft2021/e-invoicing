import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useCompany, ALL_COMPANIES } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Sun, Moon, LogOut, Command, Building2, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Topbar({ onOpenCommand }) {
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const { current, companies, switchCompany, isAll } = useCompany();

    const initials = (user?.name || user?.email || "?")
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("");

    return (
        <header
            data-testid="app-topbar"
            className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 md:px-6"
        >
            <button
                data-testid="global-search-btn"
                onClick={onOpenCommand}
                className="group flex flex-1 max-w-md items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search invoices, customers…</span>
                <kbd className="kbd">⌘K</kbd>
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        data-testid="topbar-company-btn"
                        variant="outline"
                        size="sm"
                        className="hidden md:inline-flex"
                    >
                        <Building2 className="mr-2 h-3.5 w-3.5" />
                        <span className="max-w-[180px] truncate">
                            {isAll ? "All clinics" : (current?.name || "No company")}
                        </span>
                        {isAll && (
                            <span className="ml-2 inline-flex items-center rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-accent">
                                {companies.length}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Scope dashboard & ICS</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        data-testid="switch-company-all"
                        onSelect={() => switchCompany(ALL_COMPANIES)}
                        className="flex items-center gap-2"
                    >
                        <div className="flex-1">
                            <div className="text-sm font-medium">All clinics</div>
                            <div className="text-[10px] text-muted-foreground">
                                Aggregate across {companies.length}{" "}
                                {companies.length === 1 ? "company" : "companies"}
                            </div>
                        </div>
                        {isAll && <CheckCircle2 className="h-4 w-4 text-accent" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {companies.map((c) => (
                        <DropdownMenuItem
                            key={c.id}
                            data-testid={`switch-company-${c.id}`}
                            onSelect={() => switchCompany(c.id)}
                            className="flex items-center gap-2"
                        >
                            <div className="flex-1">
                                <div className="text-sm">{c.name}</div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                    {c.tin}
                                </div>
                            </div>
                            {current?.id === c.id && (
                                <CheckCircle2 className="h-4 w-4 text-accent" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                data-testid="theme-toggle-btn"
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="Toggle theme"
            >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button data-testid="user-menu-btn" className="rounded-full outline-none">
                        <Avatar className="h-8 w-8 border border-border">
                            <AvatarFallback className="bg-foreground text-background text-xs font-medium">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                        <div className="text-sm">{user?.name}</div>
                        <div className="text-xs text-muted-foreground">{user?.email}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-testid="menu-logout" onSelect={logout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
