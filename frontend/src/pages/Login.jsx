import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Sparkles, ShieldCheck, Zap, Landmark } from "lucide-react";

export default function Login() {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("admin@einvoice.my");
    const [password, setPassword] = useState("Admin@12345");
    const [name, setName] = useState("");
    const [tenant, setTenant] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { user, ready, login, register } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();
    const from = loc.state?.from?.pathname || "/";

    useEffect(() => {
        if (ready && user) nav(from, { replace: true });
    }, [ready, user, nav, from]);

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (mode === "login") {
                await login(email, password);
                toast.success("Signed in successfully");
            } else {
                await register({ email, password, name, tenant_name: tenant });
                toast.success("Organization created");
            }
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full aurora">
            <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
                <div className="hidden flex-col justify-between p-10 lg:flex">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-foreground text-background grid place-items-center">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="font-display text-lg font-semibold">Ledger.gov</div>
                    </div>
                    <div>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Enterprise E-Invoicing
                        </div>
                        <h1 className="font-display text-5xl font-semibold tracking-tight leading-[1.02]">
                            Government-ready
                            <br />
                            invoicing for
                            <br />
                            <span className="text-accent">Malaysia LHDN</span>.
                        </h1>
                        <p className="mt-6 max-w-md text-sm text-muted-foreground">
                            Multi-tenant, RBAC-secured, and API-first. Model MyTax onboarding,
                            representative permissions, and MI2U intermediary appointments before
                            you go live on MyInvois.
                        </p>
                        <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
                            <Feature icon={ShieldCheck} label="RBAC + Multi-tenant" />
                            <Feature icon={Landmark} label="LHDN Mock Adapter" />
                            <Feature icon={Zap} label="Live Timeline" />
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Ledger.gov · PreProd sandbox
                    </div>
                </div>

                <div className="flex items-center justify-center p-6 lg:p-10">
                    <Card className="w-full max-w-md border-border">
                        <CardContent className="p-8">
                            <div className="mb-6 flex gap-2">
                                <button
                                    data-testid="tab-login"
                                    onClick={() => setMode("login")}
                                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
                                        mode === "login"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Sign in
                                </button>
                                <button
                                    data-testid="tab-register"
                                    onClick={() => setMode("register")}
                                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
                                        mode === "register"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    New Organization
                                </button>
                            </div>
                            <h2 className="font-display text-2xl font-semibold">
                                {mode === "login" ? "Welcome back" : "Create your workspace"}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {mode === "login"
                                    ? "Use your admin credentials to enter the console."
                                    : "Spin up an isolated tenant in seconds."}
                            </p>

                            <form className="mt-6 space-y-4" onSubmit={submit}>
                                {mode === "register" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label>Organization name</Label>
                                            <Input
                                                data-testid="reg-tenant"
                                                value={tenant}
                                                onChange={(e) => setTenant(e.target.value)}
                                                required
                                                placeholder="Acme Holdings"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Your name</Label>
                                            <Input
                                                data-testid="reg-name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                                placeholder="Jane Tan"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Email</Label>
                                    <Input
                                        data-testid="login-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Password</Label>
                                    <Input
                                        data-testid="login-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <Button
                                    data-testid="login-submit"
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full"
                                >
                                    {submitting
                                        ? "Please wait…"
                                        : mode === "login"
                                          ? "Sign in"
                                          : "Create workspace"}
                                </Button>
                            </form>

                            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
                                <div className="mb-1 font-medium">Demo credentials</div>
                                <div className="font-mono text-muted-foreground">
                                    admin@einvoice.my / Admin@12345
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function Feature({ icon: Icon, label }) {
    return (
        <div className="rounded-lg border border-border bg-card/50 p-3">
            <Icon className="mb-1.5 h-4 w-4 text-accent" />
            <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
        </div>
    );
}
