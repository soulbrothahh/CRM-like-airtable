import { Brand } from "./Nav";

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
    <div className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="hidden md:block">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-2 md:hidden">
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
