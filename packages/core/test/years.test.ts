import { describe, expect, it } from "vitest";
import { fyOf, fyLabel, quartersOf, quarterOf, monthsBetween } from "../src";

describe("income years", () => {
  it("assigns dates to the year ending 30 June", () => {
    expect(fyOf("2026-06-30")).toBe(2026);
    expect(fyOf("2026-07-01")).toBe(2027);
    expect(fyOf("2027-01-15")).toBe(2027);
  });
  it("labels like the prototype", () => expect(fyLabel(2027)).toBe("FY 2026–27"));
  it("builds BAS quarters with standard due dates", () => {
    const q = quartersOf(2027);
    expect(q.map((x) => x.due)).toEqual(["2026-10-28", "2027-02-28", "2027-04-28", "2027-07-28"]);
    expect(q[1]!.label).toBe("Oct–Dec 2026");
  });
  it("finds the quarter of a date", () => {
    expect(quarterOf("2026-09-30")).toEqual({ fy: 2027, index: 0 });
    expect(quarterOf("2026-10-01")).toEqual({ fy: 2027, index: 1 });
    expect(quarterOf("2027-06-30")).toEqual({ fy: 2027, index: 3 });
  });
  it("counts whole months for the CGT 12-month test", () => {
    expect(monthsBetween("2024-01-01", "2026-12-01")).toBe(35);
    expect(monthsBetween("2026-08-01", "2026-12-05")).toBe(4);
    expect(monthsBetween("2025-12-02", "2026-12-01")).toBe(11);
  });
});
