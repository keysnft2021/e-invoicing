import { Inbox } from "lucide-react";

export default function EmptyState({
    icon: Icon = Inbox,
    title = "Nothing here yet",
    description,
    action,
}) {
    return (
        <div className="grid place-items-center rounded-xl border border-dashed border-border p-12">
            <div className="mb-3 rounded-full border border-border bg-muted p-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="font-display text-lg font-semibold">{title}</div>
            {description && (
                <div className="mt-1 max-w-md text-center text-sm text-muted-foreground">
                    {description}
                </div>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
