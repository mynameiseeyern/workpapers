import { describe, expect, it } from "vitest";
import { basDate, notYetDerived, rowFY, type Row, type AbnSettings } from "../src";

const row = (p: Partial<Row>): Row => ({
  id: "r", section: "s05", date: "2026-06-20", owner: "ee", amount: 220000, gst: 20000, noGst: false,
  direction: "income", evidenced: false, ...p,
});
const abn = (o: Partial<AbnSettings> = {}) => () => ({ gstRegistered: true, gstBasis: "cash" as const, incomeBasis: "receipts" as const, psi: "" as const, ...o });

// Scenarios taken from the prototype tests (t11, t10).
describe("income year (receipts basis)", () => {
  it("June invoice received in July counts in the next year", () =>
    expect(rowFY(row({ paid: "2026-07-05" }), abn())).toBe(2027));
  it("unpaid income stays in its invoice year and isn't counted", () => {
    const r = row({ paid: "" });
    expect(rowFY(r, abn())).toBe(2026);
    expect(notYetDerived(r, abn())).toBe(true);
  });
  it("earnings basis follows the invoice date", () =>
    expect(rowFY(row({ paid: "2026-07-05" }), abn({ incomeBasis: "earnings" }))).toBe(2026));
  it("expenses always follow their date", () =>
    expect(rowFY(row({ direction: "expense", paid: "2026-07-05" }), abn())).toBe(2026));
  it("legacy rows with no paid field count on their date", () =>
    expect(rowFY(row({ paid: undefined }), abn())).toBe(2026));
});

describe("BAS date", () => {
  it("cash basis uses the date paid", () => expect(basDate(row({ date: "2026-09-25", paid: "2026-10-03" }), abn())).toBe("2026-10-03"));
  it("cash basis: unpaid is on no BAS", () => expect(basDate(row({ paid: "" }), abn())).toBeNull());
  it("accrual uses the invoice date", () => expect(basDate(row({ date: "2026-09-25", paid: "2026-10-03" }), abn({ gstBasis: "accrual" }))).toBe("2026-09-25"));
  it("legacy rows use their date", () => expect(basDate(row({ date: "2026-08-10", paid: undefined }), abn())).toBe("2026-08-10"));
});
