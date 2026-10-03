import { Card, EmptyState, Separator, Typography } from "@heroui/react";
import { formatMoney } from "@workpapers/core";
import type { ReactNode } from "react";

/** The top of a screen: what it is, whose it is, which year, and the one or two things you can do here. */
export function PageHeader(p: { title: string; code?: string; who?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Typography.Heading level={3}>
          {p.title}
          {p.who && <span className="font-normal text-muted">, {p.who}</span>}
          {p.code && <span className="ml-2 align-middle text-xs font-normal tracking-normal text-muted">{p.code}</span>}
        </Typography.Heading>
        {p.subtitle && <p className="mt-0.5 text-sm text-muted">{p.subtitle}</p>}
      </div>
      {p.actions && <div className="flex flex-wrap items-center gap-2">{p.actions}</div>}
    </header>
  );
}

/** One block of a screen. `plain` drops the card so content sits straight on the page, divided by a hairline. */
export function Section(p: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; plain?: boolean; className?: string }) {
  const head = (p.title || p.actions) && (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {p.title && <Typography.Heading level={6}>{p.title}</Typography.Heading>}
        {p.description && <p className="mt-0.5 max-w-[65ch] text-sm text-muted">{p.description}</p>}
      </div>
      {p.actions && <div className="flex flex-wrap items-center gap-2">{p.actions}</div>}
    </div>
  );
  if (p.plain) return <section className={`flex flex-col gap-3 ${p.className ?? ""}`}>{head}{p.children}</section>;
  return <Card className={p.className}><Card.Content className="flex flex-col gap-4">{head}{p.children}</Card.Content></Card>;
}

/** An amount of money, digits lined up. Zero is shown quietly; a minus is spelled as a minus. */
export function Money({ cents, strong, quietZero = true, className }: { cents: number; strong?: boolean; quietZero?: boolean; className?: string }) {
  return <span className={`figure whitespace-nowrap ${strong ? "font-semibold" : ""} ${quietZero && cents === 0 ? "text-muted" : ""} ${className ?? ""}`}>{formatMoney(cents)}</span>;
}

/** One headline figure with its label. `lead` is the figure a screen is about; the rest are supporting. */
export function Stat(p: { label: string; value: ReactNode; note?: ReactNode; lead?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted">{p.label}</span>
      <span className={`font-semibold tracking-tight tabular-nums ${p.lead ? "text-3xl" : "text-xl"}`}>{p.value}</span>
      {p.note && <span className="text-xs text-muted">{p.note}</span>}
    </div>
  );
}

/** Stats side by side, separated by hairlines rather than boxes. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-x-10 gap-y-4">{children}</div>;
}

export interface FigureLine { label: ReactNode; cents: number; level?: 0 | 1 | 2; total?: boolean; note?: ReactNode }

/** A worked list of figures, like a return estimate: detail lines indented and quiet, totals bold above a rule. */
export function FigureList({ lines, label }: { lines: FigureLine[]; label: string }) {
  return (
    <dl aria-label={label} className="flex flex-col text-sm">
      {lines.map((l, i) => (
        <div key={i} className={`flex items-baseline justify-between gap-4 py-1.5 ${l.total ? "mt-1 border-t border-separator pt-2.5 font-semibold" : ""}`}>
          <dt className={`min-w-0 ${l.total ? "" : "text-muted"} ${l.level === 2 ? "pl-8 text-xs" : l.level === 1 ? "pl-4" : ""}`}>
            {l.label}{l.note && <span className="ml-2 text-xs font-normal text-muted">{l.note}</span>}
          </dt>
          <dd><Money cents={l.cents} strong={l.total} className={l.level === 2 ? "text-xs" : ""} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** What a screen says when there is nothing yet, and how to start. */
export function Empty(p: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <EmptyState className="flex flex-col items-start gap-2 px-0 py-6">
      <span className="text-sm font-medium text-foreground">{p.title}</span>
      {p.children && <span className="max-w-[60ch]">{p.children}</span>}
      {p.action}
    </EmptyState>
  );
}

/** A hairline between groups. */
export function Rule() { return <Separator />; }
