import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { checksFor, Engine, exampleLedger, lockOf, phaseOf, todoList, type LockContext, type LockRow } from "../src";

const require = createRequire(import.meta.url);
const bundlePath = new URL("../../../pb/pb_hooks/lib/lockcore.js", import.meta.url);
const server = require(bundlePath.pathname) as { lockOf: typeof lockOf };

function ctx(over: Partial<LockContext> = {}, locks: Record<string, string> = {}): LockContext {
  return {
    people: ["A", "B"],
    incomeBasis: () => "receipts",
    gstBasis: () => "cash",
    basStatus: (o, fy, q) => locks[`bas:${fy}:${o}:q${q}`] ?? null,
    returnStatus: (o, fy) => locks[`ret:${fy}:${o}`] ?? null,
    ...over,
  };
}

describe("locks", () => {
  const biz: LockRow = { section: "s05", date: "2026-09-28", paid: "2026-10-03", owner: "B", direction: "income" };

  it("a lodged return locks its rows, including shared ones", () => {
    const c = ctx({}, { "ret:2027:A": "lodged" });
    expect(lockOf({ section: "s07", date: "2026-08-01", owner: "A" }, c)).toEqual({ kind: "return", owner: "A", fy: 2027 });
    expect(lockOf({ section: "i10", date: "2027-06-30", owner: null }, c)?.kind).toBe("return");
    expect(lockOf({ section: "s07", date: "2026-08-01", owner: "B" }, c)).toBeNull();
    expect(lockOf({ section: "s08", date: "2026-08-01", owner: "A" }, c)).toBeNull();   // notes stay editable
  });

  it("a reopened return is unlocked", () => {
    expect(lockOf({ section: "s07", date: "2026-08-01", owner: "A" }, ctx({}, { "ret:2027:A": "reopened" }))).toBeNull();
  });

  it("cash basis: the BAS lock follows the date paid", () => {
    expect(lockOf(biz, ctx({}, { "bas:2027:B:q1": "lodged" }))).toBeNull();                 // invoiced Q1, paid Q2
    expect(lockOf(biz, ctx({}, { "bas:2027:B:q2": "lodged" }))).toEqual({ kind: "bas", owner: "B", fy: 2027, q: 2 });
    expect(lockOf({ ...biz, paid: "" }, ctx({}, { "bas:2027:B:q1": "lodged", "bas:2027:B:q2": "lodged" }))).toBeNull();
  });

  it("accrual basis: the BAS lock follows the invoice date", () => {
    expect(lockOf(biz, ctx({ gstBasis: () => "accrual" }, { "bas:2027:B:q1": "lodged" }))?.kind).toBe("bas");
  });

  it("receipts basis: income paid after 30 June belongs to the next return", () => {
    const r: LockRow = { ...biz, date: "2027-06-20", paid: "2027-07-05" };
    expect(lockOf(r, ctx({}, { "ret:2027:B": "lodged" }))).toBeNull();
    expect(lockOf(r, ctx({}, { "ret:2028:B": "lodged" }))?.fy).toBe(2028);
    expect(lockOf(r, ctx({ incomeBasis: () => "earnings" }, { "ret:2027:B": "lodged" }))?.fy).toBe(2027);
  });

  it("the server bundle is the same code and gives the same answers", () => {
    const src = readFileSync(bundlePath, "utf8");
    expect(src).toContain("GENERATED from packages/core/src/locks/lockcore.ts");
    const sections = ["s05", "s07", "i10", "s08", "d12"], owners = ["A", "B", null];
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const pick = <T,>(a: T[]) => a[(i * 7 + a.length * 3 + n++) % a.length]!;
      const date = `20${26 + (i % 2)}-${String(1 + (i % 12)).padStart(2, "0")}-15`;
      const r: LockRow = { section: pick(sections), date, paid: pick([undefined, "", date, "2027-07-02"]), owner: pick(owners), direction: pick(["income", "expense"]) };
      const locks: Record<string, string> = {};
      for (const o of ["A", "B"]) for (const fy of [2026, 2027, 2028]) {
        if ((i + fy) % 3 === 0) locks[`ret:${fy}:${o}`] = pick(["lodged", "reopened"]);
        for (let q = 1; q <= 4; q++) if ((i + q + fy) % 4 === 0) locks[`bas:${fy}:${o}:q${q}`] = pick(["lodged", "reopened", "open"]);
      }
      const c = ctx({ gstBasis: () => (i % 5 ? "cash" : "accrual"), incomeBasis: () => (i % 7 ? "receipts" : "earnings") }, locks);
      expect(server.lockOf(r, c)).toEqual(lockOf(r, c));
    }
  });

  it("the engine reads locks from the ledger", () => {
    const L = exampleLedger(["A", "B"], 2027);
    L.settings.bas["2027:B:q1"] = { status: "lodged" };
    const e = new Engine(L, 2027);
    const aug = L.rows.find((r) => r.section === "s05" && r.date === "2026-08-22")!;   // laptop, paid 22 Aug
    expect(e.lockReason(aug)).toBe("B's Q1 FY 2026–27 BAS is lodged");
    const nov = L.rows.find((r) => r.section === "s05" && r.date === "2026-11-03")!;
    expect(e.lockOf(nov)).toBeNull();
  });
});

describe("readiness", () => {
  it("phases", () => {
    expect(phaseOf(2027, "2026-09-24")).toBe("during");
    expect(phaseOf(2027, "2027-05-02")).toBe("yearend");
    expect(phaseOf(2026, "2026-09-24")).toBe("prep");
    expect(phaseOf(2024, "2026-09-24")).toBe("past");
  });

  it("example year: checks for the sole trader", () => {
    const e = new Engine(exampleLedger(["A", "B"], 2027), 2027);
    const c = checksFor(e, "B", "2027-03-15");
    expect(c.hasBas).toBe(true);
    expect(c.basOpen).toBe(2);        // Q1 and Q2 ended, nothing lodged
    expect(c.needInv).toBe(1);        // phone plan without a tax invoice
    expect(c.unpaid).toBe(1);
    expect(c.psiUnset).toBe(0);
    expect(c.next?.i).toBe(0);         // Q1 is the oldest quarter not yet lodged
    expect(checksFor(e, "A", "2027-03-15").hasAbn).toBe(false);
  });

  it("lodging clears the BAS check; the to-do list counts", () => {
    const L = exampleLedger(["A", "B"], 2027);
    L.settings.bas["2027:B:q1"] = { status: "lodged" };
    L.settings.bas["2027:B:q2"] = { status: "reopened" };
    const e = new Engine(L, 2027);
    const c = checksFor(e, "B", "2027-03-15");
    expect(c.basOpen).toBe(0);
    expect(c.basReopened).toBe(1);
    const t = todoList(e, ["A", "B"], "2027-03-15");
    expect(t.items.some((x) => x.who === "B" && x.text.includes("reopened"))).toBe(true);
    expect(t.total).toBeGreaterThan(t.clear);
  });
});
