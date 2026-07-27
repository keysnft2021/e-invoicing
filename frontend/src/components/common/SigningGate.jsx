import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldCheck, RefreshCcw, CheckCircle2, Copy, ExternalLink } from "lucide-react";

/**
 * SigningGate — Step-up MFA modal.
 * Props:
 *   open, onOpenChange   Dialog visibility.
 *   action               Backend action key ("invoice.submit"|"invoice.cancel"|...)
 *   entity               Entity type string.
 *   entityId             Entity id being acted on (bound to session).
 *   title, description   Human-readable prompt.
 *   onApproved(sessionId) Called once the session is approved.
 */
export default function SigningGate({
    open, onOpenChange, action, entity = "invoice", entityId,
    title = "Confirm government action", description,
    onApproved,
}) {
    const [session, setSession] = useState(null);
    const [otp, setOtp] = useState("");
    const [busy, setBusy] = useState(false);
    const [approved, setApproved] = useState(false);
    const [error, setError] = useState(null);
    const pollRef = useRef(null);

    useEffect(() => {
        if (open && !session) initSession();
        if (!open) {
            setSession(null);
            setOtp("");
            setApproved(false);
            setError(null);
            if (pollRef.current) clearInterval(pollRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!session || approved) return;
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await api.get(`/signing/${session.session_id}`);
                if (data.status === "approved") {
                    setApproved(true);
                    clearInterval(pollRef.current);
                    onApproved?.(session.session_id);
                } else if (data.status === "expired" || data.status === "rejected") {
                    setError(`Session ${data.status}`);
                    clearInterval(pollRef.current);
                }
            } catch {
                /* ignore */
            }
        }, 1500);
        return () => pollRef.current && clearInterval(pollRef.current);
    }, [session, approved, onApproved]);

    const initSession = async () => {
        setBusy(true);
        setError(null);
        try {
            const { data } = await api.post("/signing/sessions", {
                action, entity, entity_id: entityId,
            });
            setSession(data);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const approveHere = async () => {
        if (otp.length !== 6) return toast.error("Enter the 6-digit code");
        setBusy(true);
        try {
            await api.post(`/signing/${session.session_id}/approve`, { code: otp });
            setApproved(true);
            toast.success("Approved");
            onApproved?.(session.session_id);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const copyCode = () => {
        if (!session?.code) return;
        navigator.clipboard.writeText(session.code);
        toast.success("Code copied");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg" data-testid="signing-gate">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-accent" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description ||
                            "This privileged government action requires step-up approval. Scan the QR on another device or enter the 6-digit code below."}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {error}
                    </div>
                )}

                {approved ? (
                    <div className="grid place-items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-8 text-center">
                        <div className="rounded-full border border-success/40 bg-success/10 p-2.5">
                            <CheckCircle2 className="h-6 w-6 text-success" />
                        </div>
                        <div className="font-display text-lg font-semibold">Approved</div>
                        <div className="text-xs text-muted-foreground">
                            Proceeding with the government call…
                        </div>
                    </div>
                ) : session ? (
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                Scan on your phone
                            </div>
                            {session.qr_data_url ? (
                                <img
                                    src={session.qr_data_url}
                                    alt="Approval QR"
                                    className="h-40 w-40 rounded-md border border-border bg-white p-2"
                                    data-testid="signing-qr"
                                />
                            ) : (
                                <div className="h-40 w-40 animate-pulse rounded-md bg-muted" />
                            )}
                            <a
                                href={session.approve_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                                data-testid="signing-approve-link"
                            >
                                <ExternalLink className="h-3 w-3" /> Open approval link
                            </a>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                                    Or enter the 6-digit code
                                </div>
                                <InputOTP
                                    maxLength={6}
                                    value={otp}
                                    onChange={setOtp}
                                    data-testid="signing-otp"
                                >
                                    <InputOTPGroup>
                                        {[0, 1, 2, 3, 4, 5].map((i) => (
                                            <InputOTPSlot key={i} index={i} />
                                        ))}
                                    </InputOTPGroup>
                                </InputOTP>
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Displayed code
                                    </div>
                                    <div
                                        className="font-mono text-lg font-semibold tracking-widest"
                                        data-testid="signing-code-display"
                                    >
                                        {session.code}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={copyCode}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Button
                                className="w-full"
                                disabled={busy || otp.length !== 6}
                                onClick={approveHere}
                                data-testid="signing-approve-btn"
                            >
                                Approve here
                            </Button>
                            <div className="text-[11px] text-muted-foreground">
                                Expires in 5 minutes · one-shot · action bound
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid place-items-center gap-3 py-10">
                        <div className="animate-pulse text-sm text-muted-foreground">
                            Generating signing session…
                        </div>
                        {busy || (
                            <Button variant="outline" size="sm" onClick={initSession}>
                                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                            </Button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
