import { Card, Chip, Table } from "@heroui/react";
import { formatMoney, fyLabel, SCHEDULES, type Engine, type Row, type SectionId } from "@workpapers/core";
import { sectionById, SECTIONS } from "../data/sections";

const m = (c: number) => formatMoney(c);
const shortDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";

function Line({ label, value, strong, indent, hint }: { label: string; value: number; strong?: boolean; indent?: boolean; hint?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 text-sm ${strong ? "border-t border-separator pt-2 font-semibold" : ""} ${indent ? "pl-4 text-muted" : ""}`}>
      <span>{label}{hint && <span className="ml-1 text-xs text-muted">{hint}</span>}</span>
      <span className="tabular-nums">{m(value)}</span>
    </div>
  );
}

/** One person's return estimate: how the schedules add up to taxable income. */
export function ReturnCard({ e, o }: { e: Engine; o: string }) {
  const f = e.taxFigures(o);
  return (
    <Card>
      <Card.Header>
        <Card.Title>{o} — return estimate</Card.Title>
        <Card.Description>{fyLabel(e.fy)} · tax itself isn't calculated</Card.Description>
      </Card.Header>
      <Card.Content>
        <Line label="Salary, interest, dividends and other income" value={f.income} indent />
        {f.business > 0 && <Line label="Business income (net)" value={f.business} indent />}
        {f.cgtNet > 0 && <Line label="Net capital gain" value={f.cgtNet} indent />}
        {f.rentIn > 0 && <Line label="Net rent" value={f.rentIn} indent />}
        <Line label="Assessable income" value={f.assessable} strong />
        <Line label="Work-related deductions (incl. WFH)" value={f.workDed} indent />
        <Line label="Other deductions (car, super, D15…)" value={f.otherDed} indent />
        <Line label="Deductions" value={f.deductions} strong />
        <Line label="Taxable income (estimate)" value={f.taxable} strong />
        <Line label="Tax already paid: withheld" value={f.withheld} indent />
        {f.payg > 0 && <Line label="Tax already paid: PAYG instalments" value={f.payg} indent />}
        {f.offsets > 0 && <Line label="Offsets (franking, foreign tax)" value={f.offsets} indent />}
        {f.businessLoss > 0 && (
          <p className="mt-2 text-xs text-muted">Business loss of {m(f.businessLoss)} is deferred unless a non-commercial loss test is met.</p>
        )}
        {f.ccRoom < 0 && <p className="mt-2 text-xs text-danger">Concessional super is {m(-f.ccRoom)} over the cap.</p>}
      </Card.Content>
    </Card>
  );
}

/** Quarterly BAS for one GST-registered ABN holder. */
export function BasCard({ e, o }: { e: Engine; o: string }) {
  const qs = e.quarters.map((q) => e.quarterBAS(q, o));
  const sum = (k: "gstOnSales" | "gstOnPurchases" | "net") => qs.reduce((a, t) => a + t[k], 0);
  return (
    <Card>
      <Card.Header>
        <Card.Title>{o} — BAS</Card.Title>
        <Card.Description>GST {e.ledger.settings.abn[o]?.gstBasis === "accrual" ? "on an accrual basis (invoice date)" : "on a cash basis (date paid)"}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={`${o} BAS by quarter`} className="min-w-[420px]">
              <Table.Header>
                <Table.Column isRowHeader>Quarter</Table.Column>
                <Table.Column className="text-right">GST on sales (1A)</Table.Column>
                <Table.Column className="text-right">GST credits (1B)</Table.Column>
                <Table.Column className="text-right">Net GST</Table.Column>
              </Table.Header>
              <Table.Body>
                {qs.map((t) => (
                  <Table.Row key={t.q.index} id={t.q.index}>
                    <Table.Cell>{t.q.label}<div className="text-xs text-muted">due {shortDate(t.q.due)}</div></Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{m(t.gstOnSales)}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{m(t.gstOnPurchases)}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums font-medium">{m(t.net)}</Table.Cell>
                  </Table.Row>
                ))}
                <Table.Row id="fy">
                  <Table.Cell className="font-semibold">Year</Table.Cell>
                  <Table.Cell className="text-right tabular-nums font-semibold">{m(sum("gstOnSales"))}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums font-semibold">{m(sum("gstOnPurchases"))}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums font-semibold">{m(sum("net"))}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
}

/** Every schedule's total for the people in view — the records side of the flow. */
export function FlowCard({ e, scope, onNavigate }: { e: Engine; scope: string[]; onNavigate: (id: string) => void }) {
  const items = SECTIONS.filter((s) => s.group && s.group !== "Tools" && s.id !== "s08")
    .map((s) => ({ s, v: e.sectionTotal(s.id as SectionId, scope) }))
    .filter((x) => x.v != null && x.v !== 0);
  return (
    <Card>
      <Card.Header>
        <Card.Title>Where the figures come from</Card.Title>
        <Card.Description>Each schedule's total for this year. Open one to see its records.</Card.Description>
      </Card.Header>
      <Card.Content>
        {items.length === 0 && <p className="text-sm text-muted">Nothing recorded for this year yet.</p>}
        {items.map(({ s, v }) => (
          <button key={s.id} type="button" onClick={() => onNavigate(s.id)}
            className="flex w-full items-baseline justify-between gap-4 rounded-lg px-1 py-1 text-left text-sm hover:bg-surface-secondary">
            <span>{s.parent && "↳ "}{s.name}<span className="ml-2 text-xs text-muted">{s.group}</span></span>
            <span className="tabular-nums">{m(v!)}</span>
          </button>
        ))}
      </Card.Content>
    </Card>
  );
}

// ---------- records of one section (read-only for now; editing arrives in M2) ----------
function figuresOf(r: Row): string {
  const g = SCHEDULES[r.section];
  if (g) {
    const d = (r.details ?? {}) as Record<string, unknown>;
    return g.fields.filter((f) => (f.t === "money" || f.t === "num") && Number(d[f.k]))
      .map((f) => `${f.l} ${f.t === "money" ? m(Number(d[f.k])) : Number(d[f.k])}`).join(" · ");
  }
  if (r.section === "s07a") return `${r.hours ?? 0} h · ${r.use === "business" ? "business" : "employment"}`;
  const parts = [(r.section === "s05" ? (r.direction === "income" ? "In " : "Out ") : "") + m(r.amount)];
  if (r.gst && !r.noGst) parts.push(`GST ${m(r.gst)}`);
  if (r.apportion != null && r.apportion !== 100) parts.push(`${r.apportion}% business`);
  return parts.join(" · ");
}
function describe(r: Row): string {
  const d = (r.details ?? {}) as Record<string, unknown>;
  return [r.party ?? (d.party as string | undefined), r.description, r.category ?? r.bizCategory].filter(Boolean).join(" — ");
}

export function RecordsView({ e, section, scope }: { e: Engine; section: string; scope: string[] }) {
  const s = sectionById(section);
  const rows = e.rowsIn(section as SectionId)
    .filter((r) => scope.some((o) => e.shareOf(r, o) > 0))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = e.sectionTotal(section as SectionId, scope);
  const who = (r: Row) => (r.owner ?? `Shared ${r.sharePct ?? 50}/${100 - (r.sharePct ?? 50)}`);
  return (
    <Card>
      <Card.Header>
        <Card.Title>{rows.length} {rows.length === 1 ? "record" : "records"}{total != null && <span className="ml-2 font-normal text-muted">· total {m(total)}</span>}</Card.Title>
        {SCHEDULES[section]?.sub && <Card.Description>{SCHEDULES[section]!.sub}</Card.Description>}
      </Card.Header>
      <Card.Content>
        {rows.length === 0 ? <p className="text-sm text-muted">No records for this year.</p> : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={`${s?.name} records`} className="min-w-[560px]">
                <Table.Header>
                  <Table.Column isRowHeader>Date</Table.Column>
                  <Table.Column>Who</Table.Column>
                  <Table.Column>Description</Table.Column>
                  <Table.Column>Figures</Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.id} id={r.id}>
                      <Table.Cell className="whitespace-nowrap">{shortDate(r.date)}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap">{who(r)}</Table.Cell>
                      <Table.Cell>
                        {describe(r) || "—"}
                        {r.section === "s05" && r.direction === "income" && r.paid === "" && <Chip size="sm" color="warning" className="ml-2">unpaid</Chip>}
                        {!r.evidenced && r.section !== "s07a" && <Chip size="sm" color="warning" className="ml-2">no evidence</Chip>}
                      </Table.Cell>
                      <Table.Cell className="tabular-nums">{figuresOf(r)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}
