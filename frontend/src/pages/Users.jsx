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
import StatusChip from "@/components/common/StatusChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

export default function Users() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ email: "", name: "", role: "finance_executive", password: "" });
    const { data: users, isLoading } = useQuery({
        queryKey: ["users"],
        queryFn: async () => (await api.get("/users")).data,
    });
    const { data: rolesData } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => (await api.get("/roles")).data,
    });
    const create = async () => {
        try {
            const { data } = await api.post("/users", form);
            toast.success(`User created${data.temp_password ? ` · pw ${data.temp_password}` : ""}`);
            setOpen(false);
            setForm({ email: "", name: "", role: "finance_executive", password: "" });
            qc.invalidateQueries({ queryKey: ["users"] });
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };
    return (
        <div>
            <PageHeader
                kicker="Access"
                title="Users"
                subtitle="Invite teammates, assign roles and manage account status."
                actions={
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="new-user-btn">
                                <Plus className="mr-2 h-4 w-4" /> New user
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New user</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <Label>Full name</Label>
                                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="user-name" />
                                </div>
                                <div className="col-span-2">
                                    <Label>Email</Label>
                                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" data-testid="user-email" />
                                </div>
                                <div>
                                    <Label>Role</Label>
                                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                        <SelectTrigger className="mt-1.5" data-testid="user-role">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(rolesData?.roles || []).map((r) => (
                                                <SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Temp password (optional)</Label>
                                    <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1.5" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={create} data-testid="user-save-btn">Create</Button>
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
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(users || []).map((u) => (
                                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-medium">{u.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                                    <td className="px-4 py-3 capitalize">{u.role?.replaceAll("_", " ")}</td>
                                    <td className="px-4 py-3">
                                        <StatusChip status={u.status} />
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
