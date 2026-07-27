import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

export default function Products() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        sku: "",
        name: "",
        type: "goods",
        unit_price: 0,
        tax_code: "SST-6",
        tax_rate: 6,
        hs_code: "",
        classification_code: "022",
        unit: "PCS",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["products"],
        queryFn: async () => (await api.get("/products")).data,
    });
    const create = async () => {
        try {
            await api.post("/products", form);
            toast.success("Product created");
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["products"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <PageHeader
                kicker="Master data"
                title="Products & services"
                subtitle="Catalog with HS codes, tax codes and MyInvois classification codes."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-product-btn">
                                <Plus className="mr-2 h-4 w-4" /> New item
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>New product / service</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <F l="SKU" v={form.sku} on={(v) => setForm({ ...form, sku: v })} tid="prod-sku" />
                                <div>
                                    <Label>Type</Label>
                                    <Select
                                        value={form.type}
                                        onValueChange={(v) => setForm({ ...form, type: v })}
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="goods">Goods</SelectItem>
                                            <SelectItem value="service">Service</SelectItem>
                                            <SelectItem value="bundle">Bundle</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <F l="Name" v={form.name} on={(v) => setForm({ ...form, name: v })} tid="prod-name" />
                                </div>
                                <F l="Unit price" type="number" v={form.unit_price} on={(v) => setForm({ ...form, unit_price: Number(v) })} />
                                <F l="Tax rate %" type="number" v={form.tax_rate} on={(v) => setForm({ ...form, tax_rate: Number(v) })} />
                                <F l="HS code" v={form.hs_code} on={(v) => setForm({ ...form, hs_code: v })} />
                                <F l="Classification code" v={form.classification_code} on={(v) => setForm({ ...form, classification_code: v })} />
                                <F l="Tax code" v={form.tax_code} on={(v) => setForm({ ...form, tax_code: v })} />
                                <F l="Unit" v={form.unit} on={(v) => setForm({ ...form, unit: v })} />
                            </div>
                            <DialogFooter>
                                <Button onClick={create} data-testid="prod-save-btn">
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
                                <th className="px-4 py-3">SKU</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">HS / Class</th>
                                <th className="px-4 py-3 text-right">Unit price</th>
                                <th className="px-4 py-3 text-right">Tax</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((p) => (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                                    <td className="px-4 py-3 font-medium">{p.name}</td>
                                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.type}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                        {p.hs_code} / {p.classification_code}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {fmtMoney(p.unit_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                        {p.tax_rate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function F({ l, v, on, type = "text", tid }) {
    return (
        <div>
            <Label>{l}</Label>
            <Input
                type={type}
                value={v}
                onChange={(e) => on(e.target.value)}
                className="mt-1.5"
                data-testid={tid}
            />
        </div>
    );
}
