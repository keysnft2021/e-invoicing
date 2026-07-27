import StatusChip from "./StatusChip";
import { fmtDate } from "@/lib/format";

export default function Timeline({ events = [] }) {
    if (!events?.length) {
        return (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No lifecycle events yet.
            </div>
        );
    }
    return (
        <ol className="relative ml-3 border-l-2 border-border/60 pl-6" data-testid="timeline">
            {events.map((ev, i) => (
                <li key={i} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-background bg-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-background" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={ev.status} />
                        <span className="text-xs text-muted-foreground">{fmtDate(ev.at)}</span>
                        {ev.actor && (
                            <span className="text-xs font-mono text-muted-foreground">
                                · {ev.actor}
                            </span>
                        )}
                    </div>
                    {ev.note && <div className="mt-1 text-sm">{ev.note}</div>}
                </li>
            ))}
        </ol>
    );
}
