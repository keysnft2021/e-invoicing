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
import { Plus } from "lucide-react";

export default function Suppliers() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", tin: "", brn: "", email: "", phone: "" });
    const { data, isLoading } = useQuery({
        queryKey: ["suppliers"],
        queryFn: async () => (await api.get("/suppliers")).data,
    });
    const create = async () => {
        try {
            await api.post("/suppliers", form);
            toast.success("Supplier created");
            setOpen(false);
            setForm({ name: "", tin: "", brn: "", email: "", phone: "" });
            qc.invalidateQueries({ queryKey: ["suppliers"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <PageHeader
                kicker="Master data"
                title="Suppliers"
                subtitle="Vendor master for AP and self-billed e-invoices."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-supplier-btn">
                                <Plus className="mr-2 h-4 w-4" /> New supplier
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New supplier</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                {["name", "tin", "brn", "email", "phone"].map((f) => (
                                    <div key={f} className={f === "name" ? "col-span-2" : ""}>
                                        <Label className="capitalize">{f}</Label>
                                        <Input
                                            value={form[f]}
                                            onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                                            className="mt-1.5"
                                            data-testid={`sup-${f}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button onClick={create} data-testid="sup-save-btn">
                                    Create
                                </Button>
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
                                <th className="px-4 py-3">Currency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((s) => (
                                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-medium">{s.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {s.tin} / {s.brn}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{s.email || "—"}</td>
                                    <td className="px-4 py-3 font-mono">{s.currency}</td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                                        No suppliers yet.
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
