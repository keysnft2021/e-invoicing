export default function PageHeader({ title, subtitle, actions, kicker }) {
    return (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
                {kicker && (
                    <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        {kicker}
                    </div>
                )}
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
