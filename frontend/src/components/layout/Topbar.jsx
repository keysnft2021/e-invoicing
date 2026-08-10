import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Search, Sun, Moon, LogOut, Building2, CheckCircle2, User, KeyRound, ShieldCheck, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ModifyPasswordDialog, AccountSecurityDialog } from "@/pages/Profile";

export default function Topbar({ onMobileMenu }) {
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const { current, companies, switchCompany, isAll } = useCompany();
    const nav = useNavigate();
    const [q, setQ] = useState("");
    const [pwOpen, setPwOpen] = useState(false);
    const [secOpen, setSecOpen] = useState(false);

    const initials = (user?.email || "?").split("@")[0].slice(0, 2).toUpperCase();

    return (
        <header className="flex items-center gap-2 sm:gap-3 border-b border-border bg-background px-3 sm:px-6 py-3">
            {/* Mobile hamburger */}
            <button
                type="button"
                onClick={onMobileMenu}
                className="rounded-md p-1.5 text-foreground hover:bg-secondary md:hidden"
                data-testid="topbar-menu-btn"
                aria-label="Open menu"
            >
                <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex-1 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search Function"
                    className="pl-9"
                    data-testid="topbar-search"
                />
            </div>

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
                            <span className="ml-2 inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-primary">
                                {companies.length}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Scope dashboard & EIW</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        data-testid="switch-company-all"
                        onSelect={() => switchCompany(ALL_COMPANIES)}
                        className="flex items-center gap-2">
                        <div className="flex-1">
                            <div className="text-sm font-medium">All clinics</div>
                            <div className="text-[10px] text-muted-foreground">
                                Aggregate across {companies.length}{" "}
                                {companies.length === 1 ? "company" : "companies"}
                            </div>
                        </div>
                        {isAll && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {companies.map((c) => (
                        <DropdownMenuItem
                            key={c.id}
                            data-testid={`switch-company-${c.id}`}
                            onSelect={() => switchCompany(c.id)}
                            className="flex items-center gap-2">
                            <div className="flex-1">
                                <div className="text-sm">{c.name}</div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                    {c.tin}
                                </div>
                            </div>
                            {current?.id === c.id && (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
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
                aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        data-testid="topbar-profile-btn"
                        className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-base">
                        {user?.name || user?.email?.split("@")[0] || "User"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild data-testid="menu-view-profile">
                        <Link to="/profile" className="flex items-center gap-2">
                            <User className="h-4 w-4" /> View My Profile
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        data-testid="menu-modify-password"
                        onSelect={(e) => { e.preventDefault(); setPwOpen(true); }}
                        className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" /> Modify Password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        data-testid="menu-account-security"
                        onSelect={(e) => { e.preventDefault(); setSecOpen(true); }}
                        className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Account Security
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        data-testid="menu-logout"
                        onSelect={() => { logout(); nav("/login"); }}
                        className="flex items-center gap-2 text-destructive">
                        <LogOut className="h-4 w-4" /> Logout
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ModifyPasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
            <AccountSecurityDialog open={secOpen} onOpenChange={setSecOpen} />
        </header>
    );
}
