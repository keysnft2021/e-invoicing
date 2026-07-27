import { cn } from "@/lib/utils";

const MAP = {
    draft: { label: "Draft", cls: "bg-muted text-foreground" },
    submitting: { label: "Submitting", cls: "bg-warning/15 text-warning" },
    validated: { label: "Validated", cls: "bg-success/15 text-success" },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
    submitted: { label: "Submitted", cls: "bg-accent/15 text-accent" },
    accepted: { label: "Accepted", cls: "bg-success/15 text-success" },
    active: { label: "Active", cls: "bg-success/15 text-success" },
    blocked: { label: "Blocked", cls: "bg-destructive/15 text-destructive" },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
    pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
    new: { label: "New", cls: "bg-accent/15 text-accent" },
    inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground" },
};

export default function StatusChip({ status, className }) {
    const s = MAP[status] || { label: status, cls: "bg-muted text-muted-foreground" };
    return (
        <span
            data-testid={`status-${status}`}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                s.cls,
                className,
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {s.label}
        </span>
    );
}
