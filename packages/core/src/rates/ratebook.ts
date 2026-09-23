import type { FY } from "../years";

/**
 * Rates, thresholds and dates by income year (key = year ending 30 June).
 * `checked`: years confirmed on ato.gov.au. Missing years carry the latest earlier value forward
 * and are flagged. Update once a year (see docs/RATE-REVIEW.md).
 */
export const CHECKED_ON = "2026-09-24";

export type RateFormat = "cents" | "money" | "km";
export interface RateEntry {
  label: string;
  format: RateFormat;
  values: Record<number, number>;
  checked: (number | "all")[];
  source: string;
  note?: string;
}

export const RATEBOOK = {
  wfh: {
    label: "Working from home — fixed rate per hour", format: "cents",
    values: { 2021: 0.52, 2022: 0.52, 2023: 0.67, 2024: 0.67, 2025: 0.7, 2026: 0.7 },
    checked: [2021, 2022, 2023, 2024, 2025, 2026],
    source: "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method",
    note: "Covers home and mobile phone, internet and data, electricity and gas, stationery and computer consumables. Actual hours must be recorded for the whole year.",
  },
  car: {
    label: "Car expenses — cents per kilometre", format: "cents",
    values: { 2023: 0.78, 2024: 0.85, 2025: 0.88, 2026: 0.88 }, checked: [2025, 2026],
    source: "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2026-instructions/deduction-questions-d1-d10-individual-tax-return-2026/d1-work-related-car-expenses-2026",
    note: "Capped at 5,000 work kilometres per car per year.",
  },
  carCap: {
    label: "Car expenses — kilometre cap", format: "km", values: { 2020: 5000 }, checked: ["all"],
    source: "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2026-instructions/deduction-questions-d1-d10-individual-tax-return-2026/d1-work-related-car-expenses-2026",
  },
  imm300: {
    label: "Immediate deduction — employee (non-business) assets", format: "money", values: { 2020: 300 }, checked: ["all"],
    source: "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/tools-computers-and-items-you-use-for-work/depreciating-assets-you-use-for-work/assets-costing-300-dollars-or-less",
    note: "Tested on your share of the cost for jointly owned assets; sets and identical items bought in the same year are added together. Does not apply to business assets.",
  },
  iawo: {
    label: "Instant asset write-off — small business, per asset", format: "money",
    values: { 2025: 20000, 2026: 20000, 2027: 20000 }, checked: [2027],
    source: "https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/20000-instant-asset-writeoff-iawo-here-to-stay",
    note: "Assets costing less than this (GST-exclusive if registered) are written off in full. Permanent from 1 July 2026 for aggregated turnover under $10 million.",
  },
  taxInv: {
    label: "Tax invoice needed to claim a GST credit — above", format: "money", values: { 2020: 82.5 }, checked: ["all"],
    source: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/when-you-can-claim-a-gst-credit",
  },
  gstReg: {
    label: "GST registration threshold (current or projected GST turnover)", format: "money", values: { 2020: 75000 }, checked: ["all"],
    source: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst",
    note: "Current GST turnover = this month plus the previous 11, excluding GST.",
  },
  mls: {
    label: "Medicare levy surcharge — family base threshold", format: "money",
    values: { 2025: 194000, 2026: 202000, 2027: 210000 }, checked: [2026, 2027],
    source: "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates",
    note: "Plus $1,500 for each MLS dependent child after the first.",
  },
  mlsSingle: {
    label: "Medicare levy surcharge — single base threshold", format: "money",
    values: { 2025: 97000, 2026: 101000, 2027: 105000 }, checked: [2026, 2027],
    source: "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates",
  },
  ccCap: {
    label: "Concessional super contributions cap", format: "money",
    values: { 2024: 27500, 2025: 30000, 2026: 30000, 2027: 32500 }, checked: [2024, 2025, 2026, 2027],
    source: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps",
    note: "Employer super (including salary sacrifice) plus personal contributions you claim a deduction for. Unused cap from the previous five years can be carried forward if your total super balance was under $500,000 on 30 June last year.",
  },
  pu: {
    label: "Penalty unit", format: "money", values: { 2024: 313, 2025: 330, 2026: 330, 2027: 364 }, checked: [2026, 2027],
    source: "https://www.ato.gov.au/individuals-and-families/paying-the-ato/interest-and-penalties/penalties/penalty-units",
    note: "$330 applied from 7 Nov 2024 to 30 Jun 2026; $364 from 1 Jul 2026. Failure to lodge: one unit per 28 days late, up to five for individuals and small businesses.",
  },
} as const satisfies Record<string, RateEntry>;

export type RateKey = keyof typeof RATEBOOK;

export interface RateLookup { value: number; year: number; carried: boolean }

/** Value for a year, carrying the latest earlier year forward when the ATO hasn't published one. */
export const rateYear = (key: RateKey, fy: FY): RateLookup => {
  const values = RATEBOOK[key].values as Record<number, number>;
  if (values[fy] != null) return { value: values[fy]!, year: fy, carried: false };
  const years = Object.keys(values).map(Number).sort((a, b) => a - b);
  let best: number | undefined;
  for (const y of years) if (y <= fy) best = y;
  const year = best ?? years[0]!;
  return { value: values[year]!, year, carried: true };
};

export const rate = (key: RateKey, fy: FY): number => rateYear(key, fy).value;

export type RateStatus = "checked" | "carried" | "not-rechecked";
export const rateStatus = (key: RateKey, fy: FY): RateStatus => {
  const r = RATEBOOK[key] as RateEntry;
  if (r.checked.includes("all")) return "checked";
  if (rateYear(key, fy).carried) return "carried";
  return r.checked.includes(fy) ? "checked" : "not-rechecked";
};

export const carriedRates = (fy: FY): RateKey[] =>
  (Object.keys(RATEBOOK) as RateKey[]).filter((k) => rateStatus(k, fy) === "carried");
