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
import { Building2, Plus } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";

export default function Companies() {
    const qc = useQueryClient();
    const { refresh, current, switchCompany } = useCompany();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        tin: "",
        brn: "",
        sst_number: "",
        country: "MY",
        currency: "MYR",
        city: "",
        email: "",
        phone: "",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["companies"],
        queryFn: async () => (await api.get("/companies")).data,
    });
    const create = async () => {
        try {
            const { data } = await api.post("/companies", form);
            toast.success("Company created");
            setOpen(false);
            await refresh();
            switchCompany(data.id);
            qc.invalidateQueries({ queryKey: ["companies"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <PageHeader
                kicker="Tenant"
                title="Companies"
                subtitle="Register legal entities and branches under this organization."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-company-btn">
                                <Plus className="mr-2 h-4 w-4" /> New company
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>New company</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ["name", "Legal name", true],
                                    ["tin", "TIN"],
                                    ["brn", "BRN"],
                                    ["sst_number", "SST number"],
                                    ["city", "City"],
                                    ["email", "Email"],
                                    ["phone", "Phone"],
                                    ["currency", "Currency"],
                                ].map(([k, l, wide]) => (
                                    <div key={k} className={wide ? "col-span-2" : ""}>
                                        <Label>{l}</Label>
                                        <Input
                                            value={form[k] || ""}
                                            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                                            className="mt-1.5"
                                            data-testid={`comp-${k}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button onClick={create} data-testid="comp-save-btn">
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(data || []).map((c) => (
                        <div
                            key={c.id}
                            data-testid={`company-card-${c.id}`}
                            className={`rounded-xl border p-5 transition-colors ${
                                current?.id === c.id
                                    ? "border-foreground/40 bg-secondary/40"
                                    : "border-border bg-card"
                            }`}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-md border border-border p-2">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="font-display font-semibold">{c.name}</div>
                                        <div className="font-mono text-xs text-muted-foreground">
                                            {c.country} · {c.currency}
                                        </div>
                                    </div>
                                </div>
                                {current?.id !== c.id && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => switchCompany(c.id)}
                                        data-testid={`use-company-${c.id}`}
                                    >
                                        Use
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <div className="text-muted-foreground">TIN</div>
                                    <div className="font-mono">{c.tin}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">BRN</div>
                                    <div className="font-mono">{c.brn}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">SST</div>
                                    <div className="font-mono">{c.sst_number || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Branches</div>
                                    <div>{c.branches?.length || 0}</div>
                                </div>
                            </div>
                            {c.branches?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {c.branches.map((b) => (
                                        <span
                                            key={b.code}
                                            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
                                        >
                                            {b.code} · {b.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
