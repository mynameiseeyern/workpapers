import type { SectionId } from "@workpapers/core";

/** IA v2 from the prototype. Codes appear as quiet tags in page titles, never in the nav. */
export type Group = "" | "Income" | "Business" | "Deductions" | "Other" | "Tools";
export interface Section { id: SectionId | "overview" | "return" | "bas" | "compare" | "setup" | "rates"; name: string; code?: string; group: Group; parent?: string; hidden?: boolean }

export const SECTIONS: Section[] = [
  { id: "overview", name: "Overview", group: "" },
  { id: "return", name: "Tax return", group: "" },
  { id: "bas", name: "BAS", group: "" },
  { id: "i01", name: "Salary & wages", code: "item 1", group: "Income" },
  { id: "i10", name: "Interest", code: "item 10", group: "Income" },
  { id: "i11", name: "Dividends", code: "item 11", group: "Income" },
  { id: "i12", name: "Employee share schemes", code: "item 12", group: "Income" },
  { id: "i18", name: "Capital gains", code: "item 18", group: "Income" },
  { id: "i20", name: "Foreign income", code: "item 20", group: "Income" },
  { id: "i21", name: "Rent", code: "item 21", group: "Income" },
  { id: "s05", name: "Business income & expenses", code: "item 15 · P8", group: "Business" },
  { id: "d01", name: "Car expenses", code: "D1", group: "Deductions" },
  { id: "d03", name: "Clothing & laundry", code: "D3", group: "Deductions" },
  { id: "s07", name: "Work-related & other", code: "D4–D10", group: "Deductions" },
  { id: "s07a", name: "Working from home", group: "Deductions", parent: "s07" },
  { id: "d07", name: "Interest & dividend deductions", code: "D7–D8", group: "Deductions" },
  { id: "d12", name: "Personal super contributions", code: "D12", group: "Deductions" },
  { id: "d15", name: "Other deductions", code: "D15", group: "Deductions" },
  { id: "h01", name: "Private health insurance", group: "Other" },
  { id: "s08", name: "Notes for the agent", group: "Other" },
  { id: "compare", name: "Compare & find", group: "Tools" },
  { id: "setup", name: "Setup", group: "Tools" },
  { id: "rates", name: "Rates & thresholds", group: "Tools", hidden: true },
];
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);
