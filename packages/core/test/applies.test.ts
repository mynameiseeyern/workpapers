import { describe, expect, it } from "vitest";
import { emptySettings, Engine, unconfirmed, type Ledger, type Row } from "../src";

// Made-up people and amounts. Each person answers the tax checklist for themselves.
const FY = 2027;
const row = (over: Partial<Row>): Row => ({
  id: Math.random().toString(36).slice(2), section: "i10", date: "2026-09-01", owner: "A",
  amount: 10000, gst: 0, noGst: true, evidenced: true, ...over,
});
function ledger(applies: Record<string, boolean>, rows: Row[] = []): Ledger {
  return { people: ["A", "B"], rows, settings: { ...emptySettings(), applies } };
}

describe("tax checklist is per person", () => {
  it("an answer for one person doesn't answer for the other", () => {
    const e = new Engine(ledger({ [`${FY}:A:i21`]: true }), FY);
    expect(e.appliesRecorded("i21", FY, "A")).toBe(true);
    expect(e.appliesRecorded("i21", FY, "B")).toBeNull();
    expect(unconfirmed(e, "A")).not.toContain("i21");
    expect(unconfirmed(e, "B")).toContain("i21");
  });

  it("'not this year' for one person leaves the other applying", () => {
    const e = new Engine(ledger({ [`${FY}:A:d15`]: false, [`${FY}:B:d15`]: true }), FY);
    expect(e.applies("d15", "A")).toBe(false);
    expect(e.applies("d15", "B")).toBe(true);
    expect(e.applies("d15")).toBe(true);               // household view: applies to someone
    expect(e.appliesFor("d15", ["A"])).toBe(false);
  });

  it("an older household-wide answer still counts for both until someone changes it", () => {
    const e = new Engine(ledger({ [`${FY}:i11`]: false, [`${FY}:B:i11`]: true }), FY);
    expect(e.appliesRecorded("i11", FY, "A")).toBe(false);
    expect(e.appliesRecorded("i11", FY, "B")).toBe(true);
  });

  it("a person's own rows keep a section applying for them only", () => {
    const e = new Engine(ledger({}, [row({ section: "i10", owner: "A" })]), FY);
    expect(unconfirmed(e, "A")).not.toContain("i10");
    expect(unconfirmed(e, "B")).toContain("i10");
    expect(e.hasSharedRows("i10")).toBe(false);
  });

  it("a person marked 'not this year' drops out of that schedule's totals; the other keeps theirs", () => {
    const rows = [row({ section: "i21", owner: null, sharePct: 50, details: {} })];
    const e = new Engine(ledger({ [`${FY}:A:i21`]: false, [`${FY}:B:i21`]: true }, rows), FY);
    expect(e.hasSharedRows("i21")).toBe(true);
    const people = e.scheduleEntries("i21").map((x) => x.o);
    expect(people).toEqual(["B"]);
  });

  it("working from home rows count as using work-related deductions", () => {
    const e = new Engine(ledger({}, [row({ section: "s07a", owner: "B", hours: 10, amount: 0 })]), FY);
    expect(unconfirmed(e, "B")).not.toContain("s07");
    expect(e.applies("s07", "B")).toBe(true);
  });
});

describe("return subtotals by category", () => {
  it("add up to the return lines for each person in the example year", async () => {
    const { exampleLedger } = await import("../src");
    for (const fy of [2026, 2027]) {
      const e = new Engine(exampleLedger(["A", "B"], fy), fy);
      for (const o of e.people) {
        const f = e.taxFigures(o), b = e.taxBreakdown(o);
        const sum = (xs: { cents: number }[]) => xs.reduce((a, x) => a + x.cents, 0);
        expect(sum(b.income)).toBe(f.income);
        expect(sum(b.work)).toBe(f.workDed);
        expect(sum(b.other)).toBe(f.otherDed);
      }
    }
  });
});

describe("return subtotals over the golden ledgers", () => {
  it("always add up to the return lines", async () => {
    const { readFileSync } = await import("node:fs");
    const { cases } = JSON.parse(readFileSync(new URL("./golden/cases.json", import.meta.url), "utf8")) as { cases: { ledger: Ledger; fy: number }[] };
    for (const c of cases) {
      const e = new Engine(c.ledger, c.fy);
      for (const o of e.people) {
        const f = e.taxFigures(o), b = e.taxBreakdown(o);
        const sum = (xs: { cents: number }[]) => xs.reduce((a, x) => a + x.cents, 0);
        expect([sum(b.income), sum(b.work), sum(b.other)]).toEqual([f.income, f.workDed, f.otherDed]);
      }
    }
  });
});
