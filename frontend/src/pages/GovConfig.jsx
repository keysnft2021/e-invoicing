import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ShieldCheck, PlugZap, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtDate } from "@/lib/format";

export default function GovConfig() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["gov-config"],
        queryFn: async () => (await api.get("/gov-config")).data,
    });

    const existingMY = (data || []).find((d) => d.country === "MY");

    const [form, setForm] = useState({
        country: "MY",
        environment: existingMY?.environment || "preprod",
        client_id: "",
        client_secret: "",
        certificate_pem: "",
        private_key_pem: "",
        enabled: existingMY?.enabled ?? true,
    });
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        try {
            await api.post("/gov-config", form);
            toast.success("Government credentials saved");
            qc.invalidateQueries({ queryKey: ["gov-config"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const verify = async () => {
        setBusy(true);
        try {
            const { data } = await api.post(`/gov-config/${form.country}/verify`);
            if (data.ok) toast.success(`Verified · ${data.issuer || "connected"}`);
            else toast.error(`Verification failed: ${data.error}`);
            qc.invalidateQueries({ queryKey: ["gov-config"] });
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageHeader
                kicker="Government API"
                title="LHDN MyInvois credentials"
                subtitle="Paste your LHDN client_id, client_secret, and optionally the X.509 certificate + private key used to sign submissions. The platform will auto-switch from the Mock adapter to the real LHDN adapter as soon as credentials verify."
                actions={
                    <>
                        <Button variant="outline" onClick={verify} disabled={busy || !existingMY} data-testid="gov-verify-btn">
                            <PlugZap className="mr-2 h-4 w-4" />
                            Verify connection
                        </Button>
                        <Button onClick={save} disabled={busy} data-testid="gov-save-btn">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Save credentials
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-border bg-card p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-display text-lg font-semibold">Malaysia · LHDN</h2>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Enabled</span>
                                <Switch
                                    checked={form.enabled}
                                    onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                                    data-testid="gov-enabled-switch"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label>Environment</Label>
                                <Select
                                    value={form.environment}
                                    onValueChange={(v) => setForm({ ...form, environment: v })}
                                >
                                    <SelectTrigger className="mt-1.5" data-testid="gov-environment">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="preprod">PreProd (sandbox)</SelectItem>
                                        <SelectItem value="prod">Production</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Country</Label>
                                <Input value="MY (Malaysia)" disabled className="mt-1.5" />
                            </div>
                            <div>
                                <Label>Client ID</Label>
                                <Input
                                    value={form.client_id}
                                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                                    placeholder={existingMY?.client_id || "e.g. 82a3ff41-8f9e-4a2d-…"}
                                    className="mt-1.5 font-mono"
                                    data-testid="gov-client-id"
                                />
                            </div>
                            <div>
                                <Label>Client Secret</Label>
                                <Input
                                    type="password"
                                    value={form.client_secret}
                                    onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                                    placeholder={existingMY?.client_secret_set ? "•••• saved ••••" : ""}
                                    className="mt-1.5 font-mono"
                                    data-testid="gov-client-secret"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>X.509 certificate (PEM)</Label>
                                <Textarea
                                    value={form.certificate_pem}
                                    onChange={(e) => setForm({ ...form, certificate_pem: e.target.value })}
                                    placeholder={existingMY?.certificate_pem_set
                                        ? "•••• saved ••••"
                                        : "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
                                    className="mt-1.5 h-28 font-mono text-xs"
                                    data-testid="gov-cert-pem"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Private key (PEM)</Label>
                                <Textarea
                                    value={form.private_key_pem}
                                    onChange={(e) => setForm({ ...form, private_key_pem: e.target.value })}
                                    placeholder={existingMY?.private_key_pem_set
                                        ? "•••• saved ••••"
                                        : "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"}
                                    className="mt-1.5 h-28 font-mono text-xs"
                                    data-testid="gov-pk-pem"
                                />
                            </div>
                        </div>

                        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                            The certificate + private key are used to compute an RSA-SHA256 signature
                            over each submission. Keys never leave the tenant scope. Store production
                            credentials in a Vault before going live.
                        </div>
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <Landmark className="h-4 w-4" />
                            <div className="font-display text-lg font-semibold">Adapter state</div>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : existingMY ? (
                            <div className="space-y-2 text-sm">
                                <Row label="Environment" value={existingMY.environment} />
                                <Row label="Client ID" value={existingMY.client_id} mono />
                                <Row
                                    label="Secret"
                                    value={existingMY.client_secret_set ? "Configured" : "Missing"}
                                />
                                <Row
                                    label="Certificate"
                                    value={existingMY.certificate_pem_set ? "Configured" : "Missing"}
                                />
                                <Row
                                    label="Private key"
                                    value={existingMY.private_key_pem_set ? "Configured" : "Missing"}
                                />
                                <Row
                                    label="Verified"
                                    value={
                                        existingMY.last_verified_at
                                            ? fmtDate(existingMY.last_verified_at)
                                            : "Never"
                                    }
                                />
                                <div className="pt-2">
                                    {existingMY.last_verified_ok ? (
                                        <StatusChip status="active" />
                                    ) : existingMY.last_verified_ok === false ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                                            <AlertTriangle className="h-3 w-3" />
                                            Verification failed
                                        </span>
                                    ) : (
                                        <StatusChip status="pending" />
                                    )}
                                </div>
                                {existingMY.last_error && (
                                    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] font-mono text-destructive break-all">
                                        {existingMY.last_error}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                No credentials yet — running the <span className="font-mono">mock_lhdn</span> adapter.
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <div className="font-display text-lg font-semibold">How it works</div>
                        </div>
                        <ol className="ml-4 list-decimal space-y-1.5 text-xs text-muted-foreground">
                            <li>Save your <span className="font-mono">client_id</span> & <span className="font-mono">client_secret</span>.</li>
                            <li>Verify connection — the platform calls LHDN <span className="font-mono">/connect/token</span>.</li>
                            <li>Upload PEM certificate + private key to sign each submission (RSA-SHA256).</li>
                            <li>Adapter auto-switches from Mock to Real for this tenant.</li>
                            <li>Every gov submission still requires a QR step-up approval.</li>
                        </ol>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function Row({ label, value, mono }) {
    return (
        <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {label}
            </span>
            <span className={mono ? "font-mono text-xs" : "text-sm"}>{value || "—"}</span>
        </div>
    );
}
