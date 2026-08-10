import { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "@/components/common/CommandPalette";
import { useAuth } from "@/context/AuthContext";
import { CompanyProvider } from "@/context/CompanyContext";

export default function AppShell() {
    const { user, ready } = useAuth();
    const [cmdOpen, setCmdOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setCmdOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    if (!ready) {
        return (
            <div className="grid min-h-screen place-items-center">
                <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;

    return (
        <CompanyProvider>
            <div className="flex h-screen w-screen overflow-hidden bg-background">
                <Sidebar
                    mobileOpen={mobileNavOpen}
                    onMobileClose={() => setMobileNavOpen(false)}
                />
                <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                    <Topbar
                        onOpenCommand={() => setCmdOpen(true)}
                        onMobileMenu={() => setMobileNavOpen(true)}
                    />
                    <main
                        data-testid="app-main"
                        className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8"
                    >
                        <Outlet />
                    </main>
                </div>
                <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
            </div>
        </CompanyProvider>
    );
}
