import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import { Plus } from "lucide-react";

export default function Customers() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        tin: "",
        brn: "",
        email: "",
        phone: "",
        credit_limit: 0,
        billing_address: "",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => (await api.get("/customers")).data,
    });

    const create = async () => {
        try {
            await api.post("/customers", form);
            toast.success("Customer created");
            setOpen(false);
            setForm({
                name: "",
                tin: "",
                brn: "",
                email: "",
                phone: "",
                credit_limit: 0,
                billing_address: "",
            });
            qc.invalidateQueries({ queryKey: ["customers"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    return (
        <div>
            <PageHeader
                kicker="Master data"
                title="Customers"
                subtitle="Manage buyer master data, TIN/BRN, credit limits and payment terms."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-customer-btn">
                                <Plus className="mr-2 h-4 w-4" />
                                New customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>New customer</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="cust-name" />
                                <Field label="TIN" value={form.tin} onChange={(v) => setForm({ ...form, tin: v })} testid="cust-tin" />
                                <Field label="BRN" value={form.brn} onChange={(v) => setForm({ ...form, brn: v })} />
                                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                                <Field label="Credit limit" type="number" value={form.credit_limit} onChange={(v) => setForm({ ...form, credit_limit: Number(v) })} />
                                <div className="col-span-2">
                                    <Label>Billing address</Label>
                                    <Input value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} className="mt-1.5" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={create} data-testid="cust-save-btn">Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                }
            />

            {isLoading ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">TIN / BRN</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3 text-right">Credit limit</th>
                                <th className="px-4 py-3">Payment terms</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((c) => (
                                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {c.tin} / {c.brn}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {fmtMoney(c.credit_limit)}
                                    </td>
                                    <td className="px-4 py-3">{c.payment_terms || "NET30"}</td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                                        No customers yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Field({ label, value, onChange, type = "text", testid }) {
    return (
        <div>
            <Label>{label}</Label>
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1.5"
                data-testid={testid}
            />
        </div>
    );
}
