import { describe, expect, it } from "vitest";
import { Engine, exampleLedger } from "../src";

// Hand-checked figures for the made-up example year, so a change to the engine that moves them is noticed.
describe("example year (FY 2026–27)", () => {
  const L = exampleLedger(["A", "B"], 2027);
  const e = new Engine(L, 2027);

  it("person A: employee with WFH, deductions, super and half the joint investments", () => {
    const f = e.taxFigures("A");
    // salary 92,000 + half of interest 1,240 + half of dividends 2,200 + half of the discounted gain 1,800
    expect(f.assessable).toBe(94_620_00);
    // D4–D10 outright 859 (fees 420, book 189, donation 250) + WFH 704 h × 70c + car 420 km × 88c + super 5,000
    expect(e.deductionTotals(["A"]).total).toBe(859_00);
    expect(e.wfhTotals(["A"]).claim).toBe(492_80);
    expect(f.deductions).toBe(6_721_40);
    expect(f.taxable).toBe(87_898_60);
    // the phone bill is already inside the fixed rate; the $1,899 laptop is decline in value
    const d = e.deductionTotals(["A"]);
    expect(d.overlap.length).toBe(1);
    expect(d.deprTotal).toBe(1_899_00);
    expect(f.ccRoom).toBe(32_500_00 - (11_040_00 + 2_000_00 + 5_000_00));
  });

  it("person B: sole trader, GST on a cash basis, income counted when received", () => {
    const b = e.businessTotals(["B"]);
    expect(b.sales).toBe(44_000_00);            // 11 invoices paid; June's is unpaid
    expect(b.unpaidIncome).toBe(4_000_00);
    // home office 880 h × 70c + software 720 + laptop 2,500 (instant write-off) + phone 80% of 600 + accountant 900 + insurance 800
    expect(b.expenses).toBe(6_016_00);
    expect(b.pool.length).toBe(0);
    expect(e.taxFigures("B").business).toBe(37_984_00);
    expect(e.taxFigures("B").payg).toBe(7_200_00);
  });

  it("person B's BAS follows the date paid", () => {
    const nets = e.quarters.map((q) => e.quarterBAS(q, "B").net);
    expect(nets).toEqual([532_00, 1_134_00, 1_092_00, 1_102_00]);
    expect(e.quarterBAS(e.quarters[1]!, "B").unsubstantiated).toBe(48_00);   // phone plan credit, no tax invoice yet
  });

  it("person A has no BAS", () => {
    expect(e.abnHolders(["A"])).toEqual([]);
  });

  it("works for any year", () => {
    const e26 = new Engine(exampleLedger(["A", "B"], 2026), 2026);
    expect(e26.businessTotals(["B"]).sales).toBe(44_000_00);
    expect(e26.wfhRate()).toBe(0.7);
  });
});
