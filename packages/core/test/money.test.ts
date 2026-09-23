import { describe, expect, it } from "vitest";
import { toCents, formatMoney, shareOf } from "../src";
describe("money", () => {
  it("rounds to cents", () => { expect(toCents(0.1 + 0.2)).toBe(30); expect(toCents("110.005")).toBe(11001); });
  it("formats like the prototype", () => { expect(formatMoney(-400000)).toBe("-$4,000.00"); expect(formatMoney(12345)).toBe("$123.45"); });
  it("splits shares", () => { expect(shareOf(12000, 60)).toBe(7200); expect(shareOf(50000, 80)).toBe(40000); });
});
