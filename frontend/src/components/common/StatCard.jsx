import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export default function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    trend,
    className,
    accent,
}) {
    return (
        <div
            className={cn(
                "group relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20",
                className,
            )}
        >
            <div className="flex items-start justify-between">
                <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    {label}
                </div>
                {Icon && (
                    <div className={cn("rounded-md border border-border p-1.5", accent)}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
                <div className="font-display text-3xl font-semibold tracking-tight">{value}</div>
                {trend != null && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-success">
                        <ArrowUpRight className="h-3 w-3" />
                        {trend}
                    </span>
                )}
            </div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}
