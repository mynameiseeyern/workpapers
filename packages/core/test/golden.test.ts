import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Engine, SCHEDULES, type Ledger, type SectionId } from "../src";

/**
 * Golden tests: the prototype (v15) was run over made-up ledgers (tools/oracle) and its answers recorded.
 * The engine must give the same figures. Money is compared to the cent (±1c for float noise in the prototype).
 */
interface Case { name: string; ledger: Ledger; fy: number; expected: any }
const { cases } = JSON.parse(readFileSync(new URL("./golden/cases.json", import.meta.url), "utf8")) as { cases: Case[] };

function actual(l: Ledger, fy: number, expected: any) {
  const e = new Engine(l, fy), people = l.people;
  const out: any = { fy, applies: {}, scopes: {}, tax: {}, bas: {} };
  for (const id of Object.keys(expected.applies)) out.applies[id] = e.applies(id as SectionId);
  const scopes: Record<string, string[]> = { household: people, [people[0]!]: [people[0]!], [people[1]!]: [people[1]!] };
  for (const [name, scope] of Object.entries(scopes)) {
    const b = e.businessTotals(scope), d = e.deductionTotals(scope), w = e.wfhTotals(scope);
    const sections: Record<string, number | null> = {};
    for (const id of Object.keys(expected.scopes[name].sections)) sections[id] = e.sectionTotal(id as SectionId, scope);
    const schedules: Record<string, any> = {};
    for (const id of Object.keys(SCHEDULES)) {
      const t = e.scheduleTotals(id as SectionId, scope);
      const values: Record<string, unknown> = {};
      for (const k of Object.keys(expected.scopes[name].schedules[id].values)) values[k] = t.values[k] ?? null;
      schedules[id] = { values, count: t.count, ok: t.ok, missing: t.missing, net: t.net };
    }
    const pick = (m: Record<string, number>) => Object.fromEntries(people.map((o) => [o, m[o] ?? 0]));
    out.scopes[name] = {
      sections, schedules,
      business: { sales: b.sales, gstOnSales: b.gstOnSales, gstOnPurchases: b.gstOnPurchases, expenses: b.expenses,
        poolTotal: b.poolTotal, psiDeniedTotal: b.psiDeniedTotal, homeOffice: b.homeOffice, homeHours: b.homeHours,
        unpaidIncome: b.unpaidIncome, pool: b.pool.length, psiDenied: b.psiDenied.length },
      deductions: { total: d.total, deprTotal: d.deprTotal, missing: d.missing, outright: pick(d.outright), deprBy: pick(d.deprBy),
        overlapBy: pick(d.overlapBy), depr: d.depr.length, overlap: d.overlap.length },
      wfh: { hours: w.hours, bizHours: w.bizHours, claim: w.claim, bizClaim: w.bizClaim, by: pick(w.by) },
      abnHolders: e.abnHolders(scope),
    };
  }
  for (const o of people) {
    const f = e.taxFigures(o) as any, x: any = {};
    for (const k of Object.keys(expected.tax[o])) x[k] = f[k];
    out.tax[o] = x;
    out.bas[o] = e.quarters.map((q) => {
      const t = e.quarterBAS(q, o) as any;
      return Object.fromEntries(Object.keys(expected.bas[o][0]).map((k) => [k, t[k]]));
    });
  }
  return out;
}

/** Walk both trees; numbers may differ by 1 (cent / float noise), everything else must match. */
function diffs(a: unknown, b: unknown, path = "", out: string[] = []): string[] {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1 + 1e-9) out.push(`${path}: engine ${a} vs prototype ${b}`);
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffs((a as any)[k], (b as any)[k], `${path}.${k}`, out);
  } else if (a !== b) out.push(`${path}: engine ${JSON.stringify(a)} vs prototype ${JSON.stringify(b)}`);
  return out;
}

describe("golden: engine matches prototype v15", () => {
  it("has cases", () => expect(cases.length).toBeGreaterThan(50));
  for (const c of cases) {
    it(c.name, () => {
      const d = diffs(actual(c.ledger, c.fy, c.expected), c.expected);
      expect(d.slice(0, 15)).toEqual([]);
    });
  }
});
