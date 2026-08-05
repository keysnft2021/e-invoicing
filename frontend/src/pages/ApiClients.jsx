import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError, API_BASE } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Plus, KeyRound, Copy, ShieldCheck, Ban, Trash2, ExternalLink, QrCode } from "lucide-react";
import { fmtDate } from "@/lib/format";

export default function ApiClients() {
    const qc = useQueryClient();
    const [regOpen, setRegOpen] = useState(false);
    const [credsOpen, setCredsOpen] = useState(false);
    const [credentials, setCredentials] = useState(null);
    const [actOpen, setActOpen] = useState(false);
    const [activateFor, setActivateFor] = useState(null);
    const [otp, setOtp] = useState("");
    const [form, setForm] = useState({ name: "", system_type: "EMR", webhook_url: "", company_id: "" });

    const { data: companies } = useQuery({
        queryKey: ["companies-for-clients"],
        queryFn: async () => (await api.get("/companies")).data,
    });
    const { data, isLoading } = useQuery({
        queryKey: ["api-clients"],
        queryFn: async () => (await api.get("/api-clients")).data,
        refetchInterval: 15000,
    });

    const register = async () => {
        if (!form.name) return toast.error("Name is required");
        if (!form.company_id) return toast.error("Select the clinic this EMR belongs to");
        try {
            const { data } = await api.post("/api-clients", form);
            setCredentials(data);
            setCredsOpen(true);
            setRegOpen(false);
            setForm({ name: "", system_type: "EMR", webhook_url: "", company_id: "" });
            qc.invalidateQueries({ queryKey: ["api-clients"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const activate = async () => {
        if (otp.length !== 6) return toast.error("Enter the 6-digit activation code");
        try {
            await api.post(`/api-clients/${activateFor.id}/activate`, { activation_code: otp });
            toast.success(`${activateFor.name} activated`);
            setActOpen(false); setOtp(""); setActivateFor(null);
            qc.invalidateQueries({ queryKey: ["api-clients"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const revoke = async (id, name) => {
        if (!window.confirm(`Revoke access for "${name}"? The client system will stop working.`)) return;
        try {
            await api.post(`/api-clients/${id}/revoke`);
            toast.success("Revoked");
            qc.invalidateQueries({ queryKey: ["api-clients"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const copy = (v, label) => {
        navigator.clipboard.writeText(v);
        toast.success(`${label} copied`);
    };

    return (
        <div>
            <PageHeader
                kicker="Bridge · API Clients"
                title="External systems"
                subtitle="Register EMR, POS or ERP systems that push invoices into this platform. Once activated they can call /api/external/invoices and every document is automatically filed to LHDN under this tenant."
                actions={
                    <Dialog open={regOpen} onOpenChange={setRegOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-client-btn">
                                <Plus className="mr-2 h-4 w-4" /> Register client
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Register API client</DialogTitle></DialogHeader>
                            <div className="grid gap-3">
                                <div>
                                    <Label>Clinic (taxpayer this EMR pushes for)</Label>
                                    <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                                        <SelectTrigger className="mt-1.5" data-testid="cli-clinic">
                                            <SelectValue placeholder="Select a clinic" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(companies || []).map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} · TIN {c.tin}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>System name</Label>
                                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="mt-1.5" placeholder="e.g. MediClinic EMR - HQ" data-testid="cli-name" />
                                </div>
                                <div>
                                    <Label>System type</Label>
                                    <Select value={form.system_type} onValueChange={(v) => setForm({ ...form, system_type: v })}>
                                        <SelectTrigger className="mt-1.5" data-testid="cli-type"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EMR">EMR (Clinic / Hospital)</SelectItem>
                                            <SelectItem value="POS">POS (Retail)</SelectItem>
                                            <SelectItem value="ERP">ERP</SelectItem>
                                            <SelectItem value="Custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Webhook URL (optional)</Label>
                                    <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                                        className="mt-1.5" placeholder="https://your-emr.com/lhdn-callback" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={register} data-testid="cli-save-btn">Generate credentials</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                }
            />

            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(data || []).map((c) => (
                        <div key={c.id} data-testid={`client-card-${c.id}`}
                             className="rounded-xl border border-border bg-card p-5">
                            <div className="mb-3 flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-md border border-border p-1.5">
                                            <KeyRound className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <div className="font-display font-semibold">{c.name}</div>
                                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                                {c.system_type}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <StatusChip status={c.status} />
                            </div>
                            <div className="space-y-1.5 text-xs">
                                <Row l="Client ID" v={c.client_id} mono copy={() => copy(c.client_id, "Client ID")} />
                                <Row l="Registered" v={fmtDate(c.registered_at)} />
                                <Row l="Activated" v={c.activated_at ? fmtDate(c.activated_at) : "—"} />
                                <Row l="Invoices bridged" v={c.invoice_count || 0} mono />
                                <Row l="Last used" v={c.last_used_at ? fmtDate(c.last_used_at) : "—"} />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {c.status === "pending" && (
                                    <Button size="sm" variant="outline"
                                        onClick={() => { setActivateFor(c); setActOpen(true); }}
                                        data-testid={`activate-${c.id}`}>
                                        <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Activate
                                    </Button>
                                )}
                                {c.status === "pending" && c.qr_data_url && (
                                    <Button size="sm" variant="outline"
                                        onClick={() => { setCredentials(c); setCredsOpen(true); }}
                                        data-testid={`show-qr-${c.id}`}>
                                        <QrCode className="mr-2 h-3.5 w-3.5" /> Show QR
                                    </Button>
                                )}
                                {c.status === "active" && (
                                    <Button size="sm" variant="outline"
                                        onClick={() => revoke(c.id, c.name)} data-testid={`revoke-${c.id}`}>
                                        <Ban className="mr-2 h-3.5 w-3.5" /> Revoke
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {(data || []).length === 0 && (
                        <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                            No API clients registered yet.
                        </div>
                    )}
                </div>
            )}

            {/* Credentials + QR modal — shown ONCE at registration */}
            <Dialog open={credsOpen} onOpenChange={setCredsOpen}>
                <DialogContent className="max-w-2xl" data-testid="creds-modal">
                    <DialogHeader>
                        <DialogTitle>{credentials?.client_secret ? "New client credentials" : "Activation QR"}</DialogTitle>
                    </DialogHeader>
                    {credentials?.client_secret && (
                        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                            <b>Save the client_secret now.</b> It's shown only this once — after closing this
                            dialog only the hash is stored.
                        </div>
                    )}
                    {credentials && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 text-xs">
                                <F l="Client ID" v={credentials.client_id} onCopy={() => copy(credentials.client_id, "Client ID")} />
                                {credentials.client_secret && (
                                    <F l="Client Secret" v={credentials.client_secret} onCopy={() => copy(credentials.client_secret, "Client Secret")} />
                                )}
                                <F l="Activation Code" v={credentials.activation_code} onCopy={() => copy(credentials.activation_code, "Activation Code")} />
                                <F l="Bridge URL" v={`${API_BASE}/external/invoices`} onCopy={() => copy(`${API_BASE}/external/invoices`, "Bridge URL")} />
                                <F l="Health URL" v={`${API_BASE}/external/health`} onCopy={() => copy(`${API_BASE}/external/health`, "Health URL")} />
                            </div>
                            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                    Scan on the client system
                                </div>
                                {credentials.qr_data_url && (
                                    <img src={credentials.qr_data_url} alt="Activation QR"
                                         className="h-44 w-44 rounded border border-border bg-white p-2"
                                         data-testid="creds-qr" />
                                )}
                                {credentials.qr_payload && (
                                    <a href={credentials.qr_payload} target="_blank" rel="noreferrer"
                                       className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline">
                                        <ExternalLink className="h-3 w-3" /> Open activation link
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setCredsOpen(false)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Activation modal */}
            <Dialog open={actOpen} onOpenChange={setActOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Activate {activateFor?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground">
                        Enter the 6-digit activation code the client system operator scanned or received.
                    </div>
                    <div className="my-4 grid place-items-center">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp} data-testid="activation-otp">
                            <InputOTPGroup>
                                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                    <DialogFooter>
                        <Button onClick={activate} data-testid="activate-confirm-btn">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Confirm activation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Row({ l, v, mono, copy }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</span>
            <span className={mono ? "font-mono text-xs truncate" : "text-xs"}>{v}</span>
            {copy && (
                <button onClick={copy} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
function F({ l, v, onCopy }) {
    return (
        <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <div className="flex-1 font-mono text-[11px] break-all">{v}</div>
                <button onClick={onCopy} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
