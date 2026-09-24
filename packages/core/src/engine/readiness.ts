import type { PersonId, SectionId } from "../model";
import { carriedRates, rate } from "../rates/ratebook";
import { fyOf, type FY, type ISODate, type Quarter } from "../years";
import { toCents } from "../money";
import type { Engine } from "./engine";
import { SCHEDULES } from "./schedules";

/**
 * Readiness checks and the Overview to-do list, ported from prototype v15 (personFigures / todoCard).
 * A count of 0 means the check is clear; null means it doesn't apply to that person this year.
 */
export interface Checks {
  missing: number;             // deduction rows without written evidence
  needInv: number | null;      // business expenses over $82.50 without a tax invoice
  basOpen: number | null;      // BAS quarters ended but not marked lodged
  basReopened: number | null;  // BAS quarters reopened, not re-locked
  superPending: number;        // D12 rows without notice of intent + acknowledgement
  ccOver: number;              // concessional super over the cap (0/1)
  overlap: number;             // phone & internet rows inside the WFH fixed rate
  psiUnset: number | null;     // PSI status not assessed
  pool: number | null;         // business assets over the write-off threshold
  unpaid: number | null;       // invoices not yet paid or received
  deprN: number;               // depreciating assets for the agent
  weeks: number;               // WFH weeks logged
  hasAbn: boolean;
  hasBas: boolean;
  next: null | { i: number; q: Quarter; net: number; days: number; ended: boolean };
}

export type Phase = "during" | "yearend" | "prep" | "past";

/** Where today sits relative to the year being viewed: decides what the Overview leads with. */
export function phaseOf(fy: FY, today: ISODate): Phase {
  const cur = fyOf(today), m = Number(today.slice(5, 7));
  if (fy === cur) return m === 5 || m === 6 ? "yearend" : "during";
  if (fy === cur - 1) return "prep";
  return fy > cur ? "during" : "past";
}

const daysBetween = (from: ISODate, to: ISODate) =>
  Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function checksFor(e: Engine, o: PersonId, today: ISODate): Checks {
  const scope = [o];
  const d = e.deductionTotals(scope), w = e.wfhTotals(scope), b = e.businessTotals(scope), f = e.taxFigures(o);
  const hasAbn = e.abnHolders(scope).length > 0;
  const hasBas = hasAbn && e.gstRegistered(o);
  const taxInv = toCents(rate("taxInv", e.fy));
  const c: Checks = {
    missing: d.missing,
    needInv: hasBas ? b.rows.filter((r) => r.direction === "expense" && r.amount > taxInv && !r.evidenced).length : null,
    basOpen: null, basReopened: null,
    superPending: f.superPending,
    ccOver: f.ccRoom < 0 ? 1 : 0,
    overlap: d.overlap.length,
    psiUnset: hasAbn ? (e.psi(o) ? 0 : 1) : null,
    pool: hasAbn ? b.pool.length : null,
    unpaid: hasAbn ? e.ledger.rows.filter((r) => r.section === "s05" && r.owner === o && r.paid === "" && e.rowFY(r) === e.fy).length : null,
    deprN: d.depr.length,
    weeks: w.rows.length,
    hasAbn, hasBas, next: null,
  };
  if (hasBas) {
    c.basOpen = 0; c.basReopened = 0;
    e.quarters.forEach((q, i) => {
      const rec = e.basRecord(o, i);
      if (rec?.status === "reopened") c.basReopened!++;
      if (!rec || rec.status === "open") {
        if (today > q.end) c.basOpen!++;
        if (!c.next && today >= q.start) c.next = { i, q, net: e.quarterBAS(q, o).net, days: daysBetween(today, q.due), ended: today > q.end };
      }
    });
  }
  return c;
}

export interface Todo { who?: PersonId; text: string; go: string; soft?: boolean }

const TODO: [keyof Checks, string, string][] = [
  ["missing", "deduction row{s} without written evidence", "s07"],
  ["needInv", "business expense{s} over $82.50 without a tax invoice", "s05"],
  ["basOpen", "BAS quarter{s} ended but not marked lodged", "bas"],
  ["basReopened", "BAS quarter{s} reopened, not re-locked", "bas"],
  ["superPending", "super contribution{s} missing a notice of intent or acknowledgement", "d12"],
  ["ccOver", "Concessional super over the cap", "return"],
  ["overlap", "phone & internet row{s} already covered by the WFH fixed rate", "s07"],
  ["psiUnset", "Personal services income status not assessed", "setup"],
  ["pool", "business asset{s} over the write-off threshold — for your agent", "s05"],
  ["unpaid", "invoice{s} not yet paid or received", "s05"],
];

/** Schedules a person hasn't said yes or no to this year and that have none of their rows. */
export function unconfirmed(e: Engine, o: PersonId): SectionId[] {
  return (["s05", "s07", ...Object.keys(SCHEDULES)] as SectionId[])
    .filter((id) => e.appliesRecorded(id, e.fy, o) === null && !e.hasRows(id, e.fy, o) && !(id === "s07" && e.hasRows("s07a", e.fy, o)));
}

/** The Overview to-do list for the people in view, and how many checks are clear. */
export function todoList(e: Engine, scope: PersonId[], today: ISODate): { items: Todo[]; clear: number; total: number } {
  const items: Todo[] = [];
  let clear = 0, total = 0;
  const checks = scope.map((o) => ({ o, c: checksFor(e, o, today) }));
  for (const [k, text, go] of TODO) {
    for (const { o, c } of checks) {
      const v = c[k] as number | null;
      if (v == null) continue;
      total++;
      if (!(v > 0)) { clear++; continue; }
      const t = k === "ccOver" || k === "psiUnset" ? text : `${v} ${text.replace("{s}", v === 1 ? "" : "s")}`;
      items.push({ who: o, text: t, go });
    }
  }
  const allLodged = scope.every((o) => e.returnRecord(o)?.status === "lodged");
  if (!allLodged) for (const o of scope) {
    const u = unconfirmed(e, o);
    if (u.length) items.push({ who: o, text: `${u.length} tax checklist item${u.length === 1 ? "" : "s"} not confirmed for this year`, go: "setup" });
  }
  const car = carriedRates(e.fy);
  if (car.length) items.push({ text: `${car.length} rate${car.length === 1 ? "" : "s"} for this year not yet published by the ATO — using last year's`, go: "rates", soft: true });
  const ph = phaseOf(e.fy, today);
  if (ph === "prep" || ph === "past")
    for (const o of scope) if (!e.returnRecord(o) || e.returnRecord(o)!.status === "open") items.push({ who: o, text: "Tax return not marked lodged", go: "return" });
  return { items, clear, total };
}
