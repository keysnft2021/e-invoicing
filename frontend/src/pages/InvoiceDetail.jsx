import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusChip from "@/components/common/StatusChip";
import Timeline from "@/components/common/Timeline";
import SigningGate from "@/components/common/SigningGate";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ArrowLeft, Send, XCircle, QrCode } from "lucide-react";

export default function InvoiceDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const qc = useQueryClient();
    const { data: inv, isLoading } = useQuery({
        queryKey: ["invoice", id],
        queryFn: async () => (await api.get(`/invoices/${id}`)).data,
        refetchInterval: (q) => {
            const s = q.state.data?.status;
            return s === "submitting" ? 1500 : false;
        },
    });
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [gateOpen, setGateOpen] = useState(false);
    const [gateAction, setGateAction] = useState(null); // 'submit' | 'cancel'

    if (isLoading || !inv) return <Skeleton className="h-64 w-full" />;

    const openSubmitGate = () => {
        setGateAction("submit");
        setGateOpen(true);
    };
    const openCancelGate = () => {
        if (!reason.trim()) return toast.error("Reason is required");
        setGateAction("cancel");
        setGateOpen(true);
    };

    const runSubmit = async (sessionId) => {
        setBusy(true);
        try {
            await api.post(`/invoices/${id}/submit`, { signing_session_id: sessionId });
            toast.info("Signed & submitted to LHDN — validating…");
            qc.invalidateQueries({ queryKey: ["invoice", id] });
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
            setGateOpen(false);
        }
    };
    const runCancel = async (sessionId) => {
        setBusy(true);
        try {
            await api.post(`/invoices/${id}/cancel`, {
                reason, signing_session_id: sessionId,
            });
            toast.success("Invoice cancelled");
            qc.invalidateQueries({ queryKey: ["invoice", id] });
            setCancelOpen(false);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
            setGateOpen(false);
        }
    };

    const canSubmit = ["draft", "rejected"].includes(inv.status);
    const canCancel = ["validated", "submitted"].includes(inv.status);

    return (
        <div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => nav("/invoices")}
                data-testid="back-to-invoices"
                className="mb-2"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to invoices
            </Button>

            <PageHeader
                kicker={`Invoice · ${inv.invoice_type || "invoice"}`}
                title={inv.invoice_number}
                subtitle={
                    <span className="inline-flex items-center gap-3">
                        <StatusChip status={inv.status} />
                        <span className="text-xs text-muted-foreground">
                            Created {fmtDate(inv.created_at)}
                        </span>
                    </span>
                }
                actions={
                    <>
                        {canSubmit && (
                            <Button onClick={openSubmitGate} disabled={busy} data-testid="detail-submit-btn">
                                <Send className="mr-2 h-4 w-4" />
                                Submit to LHDN
                            </Button>
                        )}
                        {canCancel && (
                            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" data-testid="detail-cancel-btn">
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancel invoice
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Cancel invoice</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                        <div className="text-sm text-muted-foreground">
                                            Provide a reason for cancellation. This will be sent to
                                            LHDN MyInvois after step-up approval.
                                        </div>
                                        <Textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="e.g. Buyer error, wrong TIN"
                                            data-testid="cancel-reason-input"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="destructive"
                                            onClick={openCancelGate}
                                            disabled={busy}
                                            data-testid="confirm-cancel-btn"
                                        >
                                            Continue to approval
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </>
                }
            />

            <SigningGate
                open={gateOpen}
                onOpenChange={setGateOpen}
                action={gateAction === "submit" ? "invoice.submit" : "invoice.cancel"}
                entity="invoice"
                entityId={id}
                title={gateAction === "submit" ? "Approve LHDN submission" : "Approve cancellation"}
                description={
                    gateAction === "submit"
                        ? `You are about to sign & submit invoice ${inv.invoice_number} to LHDN MyInvois.`
                        : `You are about to cancel invoice ${inv.invoice_number} on LHDN MyInvois.`
                }
                onApproved={(sid) => (gateAction === "submit" ? runSubmit(sid) : runCancel(sid))}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <section className="rounded-xl border border-border bg-card p-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                    Customer
                                </div>
                                <div className="mt-1 font-medium">
                                    {inv.customer_snapshot?.name}
                                </div>
                                <div className="font-mono text-xs text-muted-foreground">
                                    TIN {inv.customer_snapshot?.tin || "—"}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                    Amount
                                </div>
                                <div className="mt-1 font-mono text-2xl font-semibold">
                                    {fmtMoney(inv.total, inv.currency)}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-border bg-card">
                        <div className="border-b border-border px-5 py-4 font-display text-lg font-semibold">
                            Line items
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                    <th className="px-5 py-3">Description</th>
                                    <th className="px-5 py-3 text-right">Qty</th>
                                    <th className="px-5 py-3 text-right">Unit</th>
                                    <th className="px-5 py-3 text-right">Tax</th>
                                    <th className="px-5 py-3 text-right">Line total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(inv.lines || []).map((l, i) => {
                                    const net = l.quantity * l.unit_price - (l.discount || 0);
                                    const tax = net * (l.tax_rate / 100);
                                    return (
                                        <tr key={i} className="border-b border-border/50">
                                            <td className="px-5 py-3">{l.description}</td>
                                            <td className="px-5 py-3 text-right font-mono">
                                                {l.quantity}
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono">
                                                {fmtMoney(l.unit_price, inv.currency)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono text-muted-foreground">
                                                {l.tax_rate}% · {fmtMoney(tax, inv.currency)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono">
                                                {fmtMoney(net + tax, inv.currency)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-border">
                                    <td className="px-5 py-3 text-right text-xs text-muted-foreground" colSpan={4}>
                                        Subtotal
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono">
                                        {fmtMoney(inv.subtotal, inv.currency)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-5 py-2 text-right text-xs text-muted-foreground" colSpan={4}>
                                        Tax total
                                    </td>
                                    <td className="px-5 py-2 text-right font-mono">
                                        {fmtMoney(inv.tax_total, inv.currency)}
                                    </td>
                                </tr>
                                <tr className="border-t border-border">
                                    <td className="px-5 py-3 text-right font-semibold" colSpan={4}>
                                        Grand total
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-lg font-semibold">
                                        {fmtMoney(inv.total, inv.currency)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-4 font-display text-lg font-semibold">
                            LHDN MyInvois
                        </div>
                        {inv.government?.uuid ? (
                            <div className="space-y-2 text-sm">
                                <Field label="UUID" value={inv.government.uuid} mono />
                                <Field label="Long ID" value={inv.government.long_id} mono />
                                <Field
                                    label="Validation ID"
                                    value={inv.government.validation_id}
                                    mono
                                />
                                <Field label="Signed at" value={fmtDate(inv.government.signed_at)} />
                                {inv.government.qr && (
                                    <a
                                        href={inv.government.qr}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex items-center gap-2 text-xs text-accent hover:underline"
                                    >
                                        <QrCode className="h-3.5 w-3.5" />
                                        View QR link
                                    </a>
                                )}
                            </div>
                        ) : inv.government?.errors ? (
                            <div className="space-y-2">
                                <div className="text-sm text-destructive">Rejection details</div>
                                {inv.government.errors.map((e, i) => (
                                    <div
                                        key={i}
                                        className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs"
                                    >
                                        <div className="font-mono font-semibold">{e.code}</div>
                                        <div className="mt-1">{e.message}</div>
                                        {e.path && (
                                            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                                {e.path}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                Not submitted to LHDN yet.
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-4 font-display text-lg font-semibold">Lifecycle</div>
                        <Timeline events={inv.timeline} />
                    </div>
                </aside>
            </div>
        </div>
    );
}

function Field({ label, value, mono }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
            </div>
            <div className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value || "—"}</div>
        </div>
    );
}
