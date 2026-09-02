export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-textSecondary">{subtitle}</p> : null}
      </div>
      <div className="shrink-0">{action}</div>
    </header>
  );
}
