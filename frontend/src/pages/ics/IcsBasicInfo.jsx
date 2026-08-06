import PageHeader from "@/components/common/PageHeader";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";

export default function IcsBasicInfo() {
    const { user } = useAuth();
    const { current } = useCompany();
    const { data: ref } = useQuery({
        queryKey: ["ics-ref"],
        queryFn: async () => (await api.get("/ics/reference")).data,
    });
    return (
        <div>
            <PageHeader
                kicker="EIW"
                title="Basic Info"
                subtitle="Company registration, LHDN identifiers, and reference dropdowns used across the console."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                        Company
                    </div>
                    {current ? (
                        <div className="space-y-2 text-sm">
                            <Row l="Name" v={current.name} />
                            <Row l="TIN" v={current.tin} mono />
                            <Row l="BRN" v={current.brn} mono />
                            <Row l="SST" v={current.sst_number} mono />
                            <Row l="Country" v={current.country} />
                            <Row l="Currency" v={current.currency} />
                            <Row l="Timezone" v={current.timezone} />
                        </div>
                    ) : (
                        <Skeleton className="h-40 w-full" />
                    )}
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                        Signed-in user
                    </div>
                    <div className="space-y-2 text-sm">
                        <Row l="Name" v={user?.name} />
                        <Row l="Email" v={user?.email} mono />
                        <Row l="Role" v={user?.role?.replaceAll("_", " ")} />
                    </div>
                </div>
                {ref && (
                    <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
                        <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                            Reference dropdowns
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <RefList l="Document types" xs={ref.document_types} />
                            <RefList l="Sources" xs={ref.sources} />
                            <RefList l="Currencies" xs={ref.currencies} />
                            <RefList l="Validation results" xs={ref.validation_results} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
function Row({ l, v, mono }) {
    return (
        <div className="flex items-baseline justify-between border-b border-border/40 py-1.5 last:border-0">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</span>
            <span className={mono ? "font-mono text-xs" : "text-sm"}>{v || "—"}</span>
        </div>
    );
}
function RefList({ l, xs = [] }) {
    return (
        <div>
            <div className="mb-1 text-xs font-medium">{l}</div>
            <div className="flex flex-wrap gap-1">
                {xs.map((x) => (
                    <span key={x} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono">
                        {x}
                    </span>
                ))}
            </div>
        </div>
    );
}
