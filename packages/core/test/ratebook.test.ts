import { describe, expect, it } from "vitest";
import { rate, rateStatus, carriedRates, rateYear } from "../src";

// Values checked on ato.gov.au (Sep 2026); these are the prototype's Rates & thresholds page.
describe("rate book", () => {
  it("MLS family threshold by year", () => {
    expect(rate("mls", 2026)).toBe(202000);
    expect(rate("mls", 2027)).toBe(210000);
  });
  it("concessional cap rises to $32,500 for FY 2026–27", () => expect(rate("ccCap", 2027)).toBe(32500));
  it("carries WFH and car rates forward for FY 2026–27 and flags them", () => {
    expect(rateYear("wfh", 2027)).toEqual({ value: 0.7, year: 2026, carried: true });
    expect(carriedRates(2027).sort()).toEqual(["car", "wfh"]);
  });
  it("fixed values are always checked", () => {
    expect(rateStatus("taxInv", 2031)).toBe("checked");
    expect(rate("gstReg", 2031)).toBe(75000);
  });
  it("penalty unit changed on 1 July 2026", () => expect([rate("pu", 2026), rate("pu", 2027)]).toEqual([330, 364]));
});
