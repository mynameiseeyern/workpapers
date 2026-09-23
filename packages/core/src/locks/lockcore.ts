/**
 * Which lodged BAS quarter or tax return locks a row. Ported from prototype v15 (yearLockOf / lockOfDate).
 *
 * This file is self-contained on purpose (no imports): it is bundled as-is into
 * pb/pb_hooks/lib/lockcore.js so the server enforces exactly the same rule the app shows.
 * Regenerate with `pnpm --filter @workpapers/core build:lockcore`; a test fails if the two drift.
 */

export interface LockRow {
  section: string;
  date: string;
  /** Business rows: date paid; "" = not paid yet; undefined = saved before paid dates existed. */
  paid?: string;
  /** A person, or null when shared. */
  owner: string | null;
  direction?: string;
}

export interface LockContext {
  /** Household members in order (a shared row belongs to all of them). */
  people: string[];
  /** "receipts" (business income counts when received) or "earnings". */
  incomeBasis(owner: string | null): string;
  /** "cash" (BAS by date paid) or "accrual" (by invoice date). */
  gstBasis(owner: string | null): string;
  /** Status of a BAS quarter (q = 1–4): "lodged", "reopened", "open" or null. */
  basStatus(owner: string, fy: number, q: number): string | null;
  /** Status of a tax return: "lodged", "reopened", "open" or null. */
  returnStatus(owner: string, fy: number): string | null;
}

export type Lock =
  | { kind: "return"; owner: string; fy: number }
  | { kind: "bas"; owner: string; fy: number; q: number };

export function lockFyOf(date: string): number {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  return m >= 7 ? y + 1 : y;
}

/** Income year of a row: received date for business income on a receipts basis, otherwise its date. */
export function lockRowFY(r: LockRow, c: LockContext): number {
  if (r.section === "s05" && r.direction === "income" && c.incomeBasis(r.owner) === "receipts" && r.paid) return lockFyOf(r.paid);
  return lockFyOf(r.date);
}

/** The date that puts a business row on a BAS, or null when it isn't on one (cash basis, unpaid). */
export function lockBasDate(r: LockRow, c: LockContext): string | null {
  if (c.gstBasis(r.owner) !== "cash") return r.date || null;
  if (r.paid === undefined) return r.date || null;
  return r.paid || null;
}

/** Quarter 1–4 of the income year a date falls in. */
export function lockQuarterOf(date: string): number {
  const m = Number(date.slice(5, 7));
  return m >= 7 && m <= 9 ? 1 : m >= 10 ? 2 : m <= 3 ? 3 : 4;
}

/**
 * The lock holding a row, or null. A lodged return locks every row feeding it (shared rows feed both
 * returns, so either lock holds them). A lodged BAS quarter locks business rows on that BAS.
 * Notes for the agent are never locked. "reopened" means unlocked for an amendment.
 */
export function lockOf(r: LockRow, c: LockContext): Lock | null {
  if (r.section === "s08" || !r.date) return null;
  const fy = lockRowFY(r, c);
  const owners = r.owner == null ? c.people : [r.owner];
  for (const o of owners) if (c.returnStatus(o, fy) === "lodged") return { kind: "return", owner: o, fy };
  if (r.section === "s05" && r.owner != null) {
    const d = lockBasDate(r, c);
    if (d) {
      const bfy = lockFyOf(d), q = lockQuarterOf(d);
      if (c.basStatus(r.owner, bfy, q) === "lodged") return { kind: "bas", owner: r.owner, fy: bfy, q };
    }
  }
  return null;
}

/** Plain-English reason, e.g. "Darrelle's Q1 FY 2026–27 BAS is lodged". */
export function lockReason(l: Lock, name: (owner: string) => string = (o) => o): string {
  const fy = `FY ${l.fy - 1}–${String(l.fy).slice(2)}`;
  return l.kind === "return" ? `${name(l.owner)}'s ${fy} tax return is lodged` : `${name(l.owner)}'s Q${l.q} ${fy} BAS is lodged`;
}
