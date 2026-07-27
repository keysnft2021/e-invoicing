import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * Public-ish approval page. Requires login. Reads {sessionId} from path
 * and {c} (code) from query. Shows the pending government action bound
 * to the session, and lets the operator Approve or Reject.
 */
export default function SignApprove() {
    const { sessionId } = useParams();
    const [sp] = useSearchParams();
    const code = sp.get("c") || "";
    const nav = useNavigate();
    const { user, ready } = useAuth();

    const [session, setSession] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);

    useEffect(() => {
        if (!ready) return;
        if (!user) {
            nav(`/login`, { state: { from: { pathname: `/sign/${sessionId}?c=${code}` } } });
            return;
        }
        (async () => {
            try {
                const { data } = await api.get(`/signing/${sessionId}`);
                setSession(data);
                if (data.status !== "pending") setDone(data.status);
            } catch (e) {
                setError(formatApiError(e));
            }
        })();
    }, [ready, user, sessionId, code, nav]);

    const approve = async () => {
        setBusy(true);
        try {
            await api.post(`/signing/${sessionId}/approve`, { code });
            toast.success("Approved");
            setDone("approved");
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const reject = async () => {
        setBusy(true);
        try {
            await api.post(`/signing/${sessionId}/reject`);
            toast.success("Rejected");
            setDone("rejected");
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen aurora">
            <div className="mx-auto max-w-lg px-6 py-24">
                <Card>
                    <CardContent className="p-8">
                        <div className="mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-accent" />
                            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                Signing session
                            </div>
                        </div>
                        <h1 className="font-display text-2xl font-semibold">Approve action?</h1>

                        {error && (
                            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {session && (
                            <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
                                <Row label="Action" value={session.action} mono />
                                <Row label="Entity" value={`${session.entity} · ${session.entity_id || "—"}`} mono />
                                <Row label="Initiator" value={session.initiator_email} />
                                <Row label="Expires" value={session.expires_at} mono />
                                <Row label="Status" value={session.status} />
                            </div>
                        )}

                        {done === "approved" && (
                            <div className="mt-6 grid place-items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-6 text-center">
                                <CheckCircle2 className="h-6 w-6 text-success" />
                                <div className="text-sm font-medium">Session approved</div>
                                <div className="text-xs text-muted-foreground">
                                    You can close this tab — the originating device will continue.
                                </div>
                            </div>
                        )}
                        {done === "rejected" && (
                            <div className="mt-6 grid place-items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
                                <XCircle className="h-6 w-6 text-destructive" />
                                <div className="text-sm font-medium">Session rejected</div>
                            </div>
                        )}

                        {session?.status === "pending" && !done && (
                            <div className="mt-6 flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={reject}
                                    disabled={busy}
                                    data-testid="sign-reject-btn"
                                    className="flex-1"
                                >
                                    Reject
                                </Button>
                                <Button
                                    onClick={approve}
                                    disabled={busy}
                                    data-testid="sign-approve-btn"
                                    className="flex-1"
                                >
                                    Approve <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        <div className="mt-6 text-center text-[11px] text-muted-foreground">
                            Code · <span className="font-mono">{code}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Row({ label, value, mono }) {
    return (
        <div className="flex items-baseline justify-between border-b border-border/60 py-1.5 last:border-0">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {label}
            </span>
            <span className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value || "—"}</span>
        </div>
    );
}
