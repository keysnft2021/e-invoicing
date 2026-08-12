import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { fmtDay, fmtMoney } from "@/lib/format";
import {
    Search, RotateCcw, CheckCircle2, XCircle, RefreshCw, Eye,
} from "lucide-react";

const CONFIRM_STATUS = {
    "0": { label: "Awaiting", cls: "bg-amber-500/20 text-amber-600" },
    "1": { label: "Accepted", cls: "bg-emerald-500/20 text-emerald-600" },
    "2": { label: "Rejected", cls: "bg-red-500/20 text-red-600" },
};
const REJECT_REASONS = [
    { v: "1", l: "1 — Wrong buyer details" },
    { v: "2", l: "2 — Wrong invoice details" },
    { v: "3", l: "3 — Other (reason required)" },
];

const EMPTY_FILTER = {
    supplier_name: "", supplier_tin: "", uuid: "", status: "all",
    confirm_status: "all",
};

export default function PurchaseInvoices() {
    const qc = useQueryClient();
    const [filter, setFilter] = useState({ ...EMPTY_FILTER });
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });

    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectRow, setRejectRow] = useState(null);
    const [rejectCode, setRejectCode] = useState("1");
    const [rejectReason, setRejectReason] = useState("");

    const [viewOpen, setViewOpen] = useState(false);
    const [viewRow, setViewRow] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ["purchase-invoices"],
        queryFn: async () => (await api.get("/purchase-invoices")).data,
    });

    const rows = useMemo(() => {
        let list = data || [];
        if (applied.supplier_name) list = list.filter((r) => (r.supplier_name || "").toLowerCase().includes(applied.supplier_name.toLowerCase()));
        if (applied.supplier_tin) list = list.filter((r) => (r.supplier_tin || "").toLowerCase().includes(applied.supplier_tin.toLowerCase()));
        if (applied.uuid) list = list.filter((r) => (r.uuid || "").toLowerCase().includes(applied.uuid.toLowerCase()));
        if (applied.confirm_status !== "all") list = list.filter((r) => (r.confirm_status_code || "0") === applied.confirm_status);
        return list;
    }, [data, applied]);

    const set = (k, v) => setFilter((f) => ({ ...f, [k]: v }));
    const onSearch = () => setApplied({ ...filter });
    const onReset = () => { setFilter({ ...EMPTY_FILTER }); setApplied({ ...EMPTY_FILTER }); };

    const openReject = (row) => {
        setRejectRow(row); setRejectCode("1"); setRejectReason("");
        setRejectOpen(true);
    };
    const submitReject = async () => {
        if (rejectCode === "3" && !rejectReason.trim()) {
            toast.error("Reason is required when code = 3");
            return;
        }
        try {
            await api.post(`/purchase-invoices/${rejectRow.id}/reject`, {
                confirmRejectCode: rejectCode, confirmRejectReason: rejectReason,
            });
            toast.success("Rejection submitted to LHDN");
            setRejectOpen(false);
            qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const confirm = async (row) => {
        try {
            await api.post(`/purchase-invoices/${row.id}/confirm`, {});
            toast.success("Purchase invoice accepted");
            qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const syncFromLhdn = async () => {
        try {
            await api.post("/purchase-invoices/seed", {});
            toast.success("Synced from LHDN inbox");
            qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="pb-16">
            <PageHeader kicker="EIS Console" title="Purchase Invoices"
                subtitle="Documents received from other suppliers via LHDN — accept or reject within 72 hours."
                actions={
                    <Button size="sm" variant="outline" onClick={syncFromLhdn} data-testid="sync-lhdn">
                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync from LHDN
                    </Button>
                } />

            {/* Filters */}
            <div className="mb-3 grid grid-cols-1 gap-x-8 gap-y-3 rounded-md border border-border bg-card px-6 py-5 md:grid-cols-2">
                <TF l="Supplier Name">
                    <Input value={filter.supplier_name} onChange={(e) => set("supplier_name", e.target.value)}
                           data-testid="f-supplier-name" placeholder="e.g. MediCare Wholesale" />
                </TF>
                <TF l="Supplier TIN">
                    <Input value={filter.supplier_tin} onChange={(e) => set("supplier_tin", e.target.value)}
                           data-testid="f-supplier-tin" placeholder="e.g. C1234567890" />
                </TF>
                <TF l="Invoice UUID">
                    <Input value={filter.uuid} onChange={(e) => set("uuid", e.target.value)}
                           data-testid="f-uuid" placeholder="LHDN UUID" />
                </TF>
                <TF l="Confirmation Status">
                    <Select value={filter.confirm_status} onValueChange={(v) => set("confirm_status", v)}>
                        <SelectTrigger data-testid="f-confirm-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="0">0 · Awaiting</SelectItem>
                            <SelectItem value="1">1 · Accepted</SelectItem>
                            <SelectItem value="2">2 · Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </TF>
            </div>

            <div className="mb-3 flex items-center justify-center gap-2 rounded-md bg-primary py-2">
                <Button size="sm" variant="secondary" onClick={onSearch} data-testid="btn-search">
                    <Search className="mr-2 h-3.5 w-3.5" /> Search
                </Button>
                <Button size="sm" variant="secondary" onClick={onReset} data-testid="btn-reset">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-card">
                    <table className="w-full min-w-[1400px] text-sm">
                        <thead className="sticky top-0 z-20 bg-primary text-primary-foreground">
                            <tr>
                                <th className="px-3 py-3 text-left">NO.</th>
                                <th className="px-3 py-3 text-left">Internal ID</th>
                                <th className="px-3 py-3 text-left">Supplier</th>
                                <th className="px-3 py-3 text-left">Supplier TIN</th>
                                <th className="px-3 py-3 text-left">Type</th>
                                <th className="px-3 py-3 text-left">Issued</th>
                                <th className="px-3 py-3 text-right">Total</th>
                                <th className="px-3 py-3 text-left">LHDN Status</th>
                                <th className="px-3 py-3 text-left">Confirmation</th>
                                <th className="px-3 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const cs = CONFIRM_STATUS[r.confirm_status_code || "0"];
                                const canAct = (r.confirm_status_code || "0") === "0";
                                return (
                                    <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40">
                                        <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.internal_id}</td>
                                        <td className="px-3 py-2 font-medium">{r.supplier_name}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{r.supplier_tin}</td>
                                        <td className="px-3 py-2 capitalize">{r.type_name || "invoice"}</td>
                                        <td className="px-3 py-2 text-xs">{fmtDay(r.date_time_issued)}</td>
                                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.total)}</td>
                                        <td className="px-3 py-2">
                                            <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase">
                                                {r.status || "validated"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${cs.cls}`}>
                                                {cs.label}
                                            </span>
                                            {r.confirm_reject_code && (
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    Code {r.confirm_reject_code}
                                                    {r.confirm_reject_reason ? ` · ${r.confirm_reject_reason}` : ""}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm"
                                                        onClick={() => { setViewRow(r); setViewOpen(true); }}
                                                        data-testid={`view-${r.id}`}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                {canAct && (
                                                    <>
                                                        <Button variant="ghost" size="sm"
                                                                onClick={() => confirm(r)}
                                                                data-testid={`accept-${r.id}`}
                                                                className="text-emerald-600 hover:text-emerald-700">
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm"
                                                                onClick={() => openReject(r)}
                                                                data-testid={`reject-${r.id}`}
                                                                className="text-destructive hover:text-destructive">
                                                            <XCircle className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr><td colSpan={10} className="py-16 text-center text-sm text-muted-foreground">
                                    No inbound documents. Click <b>Sync from LHDN</b> to pull recent inbox items.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Reject dialog with LHDN codes */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent data-testid="reject-dialog">
                    <DialogHeader>
                        <DialogTitle>Reject Purchase Invoice</DialogTitle>
                        <DialogDescription>
                            Per LHDN MyInvois — supply a reason code (1/2/3). Code 3 requires a written reason.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm">Rejection Code</Label>
                            <Select value={rejectCode} onValueChange={setRejectCode}>
                                <SelectTrigger data-testid="reject-code"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {REJECT_REASONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {rejectCode === "3" && (
                            <div>
                                <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
                                <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                          placeholder="Describe the reason for rejection" data-testid="reject-reason" />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitReject} data-testid="reject-submit">
                            Reject Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-2xl" data-testid="view-dialog">
                    <DialogHeader>
                        <DialogTitle>{viewRow?.internal_id}</DialogTitle>
                        <DialogDescription>LHDN UUID: {viewRow?.uuid}</DialogDescription>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <F l="Supplier" v={viewRow.supplier_name} />
                            <F l="Supplier TIN" v={viewRow.supplier_tin} />
                            <F l="Buyer" v={viewRow.buyer_name} />
                            <F l="Buyer TIN" v={viewRow.buyer_tin} />
                            <F l="Issued" v={fmtDay(viewRow.date_time_issued)} />
                            <F l="Received" v={fmtDay(viewRow.date_time_received)} />
                            <F l="Net Amount" v={fmtMoney(viewRow.net_amount)} />
                            <F l="Total" v={fmtMoney(viewRow.total)} />
                            <F l="Long ID" v={viewRow.long_id} />
                            <F l="Channel" v={viewRow.submission_channel} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function F({ l, v }) {
    return (
        <div>
            <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
            <div className="font-medium">{v || "—"}</div>
        </div>
    );
}
function TF({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
