import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";

export default function AuditLog() {
    const { data, isLoading } = useQuery({
        queryKey: ["audit"],
        queryFn: async () => (await api.get("/audit")).data,
        refetchInterval: 10000,
    });
    return (
        <div>
            <PageHeader
                kicker="Compliance"
                title="Audit trail"
                subtitle="Every action taken by users, workflows and government adapters."
            />
            {isLoading ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Actor</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Entity</th>
                                <th className="px-4 py-3">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data || []).map((l) => (
                                <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/40">
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                        {fmtDate(l.created_at)}
                                    </td>
                                    <td className="px-4 py-3">{l.actor_email || "—"}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono">
                                            {l.entity}
                                        </span>
                                        {l.entity_id && (
                                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                                {l.entity_id.slice(-6)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                        {l.ip || "—"}
                                    </td>
                                </tr>
                            ))}
                            {(data || []).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                                        Audit trail is empty.
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
