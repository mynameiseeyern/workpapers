import { monthsBetween } from "../years";
import type { SectionId } from "../model";

/**
 * The data-driven return schedules (everything except business, work-related deductions and WFH).
 * Ported from prototype v15's GEN table. Field values live in `row.details`:
 * money fields in cents, num fields as plain numbers, checks as booleans, the rest as strings.
 */
export type FieldType = "text" | "money" | "num" | "sel" | "check" | "date";
export interface Field { k: string; l: string; t: FieldType; req?: boolean; opts?: string[] }

export interface CalcCtx { carRate: number }
type Details = Record<string, unknown>;

export interface Schedule {
  id: SectionId;
  /** Can a row be Shared between the two people? */
  shared: boolean;
  dateLabel: string;
  /** What counts as written evidence, or undefined if none is expected. */
  doc?: string;
  sub: string;
  fields: Field[];
  /** Derived columns per row (values in the same units as money: cents). */
  calc?: (d: Details, date: string, c: CalcCtx) => Record<string, number>;
  cols?: { k: string; l: string }[];
  /** Replaces totals after summing (car: the 5,000 km cap). */
  total?: (entries: { d: Details; share: number }[], c: CalcCtx) => Record<string, number | boolean>;
  /** Signed net of one field (rent: income minus expenses). */
  net?: { plus: (d: Details) => boolean; k: string };
  /** A row only counts when this is true (personal super: notice of intent acknowledged). */
  rowOk?: (d: Details) => boolean;
  okText?: string;
  tax: {
    income?: string[]; withheld?: string[]; offsets?: string[];
    rfb?: string[]; resc?: string[]; sg?: string[];
    cgt?: string; rentNet?: boolean; ded?: string; nil?: boolean; onlyOk?: boolean; phi?: boolean;
  };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const CAR_CAP_KM = 5000;

export const SCHEDULES: Record<string, Schedule> = {
  i01: {
    id: "i01", shared: false, dateLabel: "Statement date", doc: "income statement",
    sub: "One line per employer, copied from the income statement in myGov. The ATO pre-fills these; the job here is to check them and keep the figures the income tests need.",
    fields: [
      { k: "party", l: "Employer", t: "text", req: true }, { k: "gross", l: "Gross payments", t: "money", req: true },
      { k: "withheld", l: "Tax withheld", t: "money" }, { k: "allow", l: "Allowances (item 2)", t: "money" },
      { k: "rfb", l: "Reportable fringe benefits", t: "money" }, { k: "resc", l: "Reportable employer super", t: "money" },
      { k: "sg", l: "Employer super (SG)", t: "money" },
    ],
    tax: { income: ["gross", "allow"], withheld: ["withheld"], rfb: ["rfb"], resc: ["resc"], sg: ["sg"] },
  },
  i10: {
    id: "i10", shared: true, dateLabel: "Statement date", doc: "statement",
    sub: "One line per account. Joint accounts go in once as Shared with the split — the ATO splits joint interest the same way.",
    fields: [
      { k: "party", l: "Bank / account", t: "text", req: true }, { k: "gross", l: "Gross interest", t: "money", req: true },
      { k: "withheld", l: "TFN amounts withheld", t: "money" },
    ],
    tax: { income: ["gross"], withheld: ["withheld"] },
  },
  i11: {
    id: "i11", shared: true, dateLabel: "Payment date", doc: "statement",
    sub: "One line per dividend. Franking credits count as income and come back as a refundable offset.",
    fields: [
      { k: "party", l: "Company / fund", t: "text", req: true }, { k: "unfranked", l: "Unfranked", t: "money" },
      { k: "franked", l: "Franked", t: "money" }, { k: "credit", l: "Franking credit", t: "money" },
      { k: "withheld", l: "TFN withheld", t: "money" },
    ],
    tax: { income: ["unfranked", "franked", "credit"], withheld: ["withheld"], offsets: ["credit"] },
  },
  i12: {
    id: "i12", shared: false, dateLabel: "Taxing point", doc: "ESS statement",
    sub: "Only if either of you holds shares or rights in an employer. The discount is income in the year of the taxing point — a common misread on the ESS statement.",
    fields: [
      { k: "party", l: "Employer / plan", t: "text", req: true },
      { k: "kind", l: "Plan type", t: "sel", opts: ["Taxed-upfront", "Deferral scheme", "Start-up concession"] },
      { k: "discount", l: "Discount amount", t: "money", req: true },
    ],
    tax: { income: ["discount"] },
  },
  i18: {
    id: "i18", shared: true, dateLabel: "Date sold", doc: "contract / statement",
    sub: "Shares, ETFs, crypto and property. Enter the cost base and proceeds; the gain, the 12-month discount and the net position are worked out. Losses only ever offset gains.",
    fields: [
      { k: "party", l: "Asset", t: "text", req: true }, { k: "acq", l: "Date acquired", t: "date" },
      { k: "cost", l: "Cost base", t: "money", req: true }, { k: "proceeds", l: "Proceeds", t: "money", req: true },
    ],
    calc: (d, date) => {
      const g = num(d.proceeds) - num(d.cost);
      const acq = typeof d.acq === "string" ? d.acq : "";
      const held = !!acq && !!date && monthsBetween(acq, date) >= 12;
      return { gain: g, disc: g > 0 && held ? g / 2 : 0, net: g > 0 && held ? g / 2 : g, held: held ? 1 : 0 };
    },
    cols: [{ k: "gain", l: "Gain / loss" }, { k: "net", l: "After discount" }],
    tax: { cgt: "net" },
  },
  i20: {
    id: "i20", shared: false, dateLabel: "Date", doc: "statement",
    sub: "Overseas accounts, shares or work. Foreign tax already paid may come back as an offset.",
    fields: [
      { k: "party", l: "Source", t: "text", req: true }, { k: "country", l: "Country", t: "text" },
      { k: "gross", l: "Gross (AUD)", t: "money", req: true }, { k: "ftax", l: "Foreign tax paid", t: "money" },
    ],
    tax: { income: ["gross"], offsets: ["ftax"] },
  },
  i21: {
    id: "i21", shared: true, dateLabel: "Date", doc: "invoice / statement",
    sub: "Rent received and every expense on the property. Co-owned property goes in as Shared with the ownership split. A net loss here counts as a net investment loss for the income tests.",
    fields: [
      { k: "party", l: "Property", t: "text", req: true },
      { k: "direction", l: "Direction", t: "sel", opts: ["Income", "Expense"] },
      { k: "cat", l: "Category", t: "sel", opts: ["Rent received", "Other rental income", "Interest on loan", "Council & water rates", "Body corporate", "Insurance", "Repairs & maintenance", "Agent fees", "Depreciation (capital works)", "Other expense"] },
      { k: "amount", l: "Amount", t: "money", req: true },
    ],
    net: { plus: (d) => d.direction === "Income", k: "amount" },
    tax: { rentNet: true },
  },
  d01: {
    id: "d01", shared: false, dateLabel: "Date", doc: "diary entry",
    sub: `Cents per kilometre method: work trips only, never home to work. Capped at ${CAR_CAP_KM} km per car per year. Keep a diary of trips.`,
    fields: [{ k: "party", l: "Trip / purpose", t: "text", req: true }, { k: "km", l: "Kilometres", t: "num", req: true }],
    calc: (d, _date, c) => ({ claim: num(d.km) * c.carRate * 100 }),
    cols: [{ k: "claim", l: "Claim" }],
    total: (es, c) => {
      const km = es.reduce((a, e) => a + num(e.d.km) * e.share, 0);
      const capped = Math.min(km, CAR_CAP_KM);
      return { km, capped, claim: Math.round(capped * c.carRate * 100), over: km > CAR_CAP_KM };
    },
    tax: { ded: "claim" },
  },
  d03: {
    id: "d03", shared: false, dateLabel: "Date", doc: "receipt",
    sub: "Only occupation-specific, protective or registered uniform clothing counts — ordinary clothes never do, even for work. Laundry is claimable per load without receipts up to a small limit.",
    fields: [
      { k: "party", l: "Item / supplier", t: "text", req: true },
      { k: "kind", l: "Type", t: "sel", opts: ["Protective", "Occupation-specific", "Registered uniform", "Laundry"] },
      { k: "amount", l: "Amount", t: "money", req: true },
    ],
    tax: { ded: "amount" },
  },
  d07: {
    id: "d07", shared: false, dateLabel: "Date", doc: "statement",
    sub: "Costs of earning interest or dividends — a margin loan, investment advice, brokerage that isn't part of a cost base. Not the shares themselves.",
    fields: [
      { k: "party", l: "Description", t: "text", req: true },
      { k: "kind", l: "Label", t: "sel", opts: ["D7 Interest deductions", "D8 Dividend deductions"] },
      { k: "amount", l: "Amount", t: "money", req: true },
    ],
    tax: { ded: "amount", nil: true },
  },
  d12: {
    id: "d12", shared: false, dateLabel: "Contribution date", doc: "fund confirmation",
    sub: "After-tax contributions you want to claim. The claim fails unless the fund has acknowledged a notice of intent before the return is lodged — both boxes must be ticked to count it.",
    fields: [
      { k: "party", l: "Fund", t: "text", req: true }, { k: "amount", l: "Amount", t: "money", req: true },
      { k: "noi", l: "Notice of intent sent", t: "check" }, { k: "ack", l: "Fund acknowledged", t: "check" },
    ],
    rowOk: (d) => !!(d.noi && d.ack), okText: "counted only when both are ticked",
    tax: { ded: "amount", onlyOk: true },
  },
  d15: {
    id: "d15", shared: false, dateLabel: "Date", doc: "receipt",
    sub: "Mainly income protection premiums paid outside super. Anything else that doesn't fit a D-label goes here with a clear description.",
    fields: [
      { k: "party", l: "Description", t: "text", req: true },
      { k: "kind", l: "Type", t: "sel", opts: ["Income protection insurance", "Election expenses", "Other"] },
      { k: "amount", l: "Amount", t: "money", req: true },
    ],
    tax: { ded: "amount" },
  },
  h01: {
    id: "h01", shared: false, dateLabel: "Statement date", doc: "policy statement",
    sub: "From the private health statement. Together with the income tests this decides the rebate tier and whether the Medicare levy surcharge applies. A couple on one policy: enter one line each with that person's share.",
    fields: [
      { k: "party", l: "Insurer", t: "text", req: true }, { k: "policy", l: "Policy no.", t: "text" },
      { k: "premiums", l: "Premiums paid", t: "money", req: true }, { k: "rebate", l: "Rebate received", t: "money" },
      { k: "days", l: "Days covered", t: "num" }, { k: "code", l: "Benefit code", t: "text" },
    ],
    tax: { phi: true },
  },
};

export const SCHEDULE_IDS = Object.keys(SCHEDULES) as SectionId[];
export const isSchedule = (id: string): boolean => id in SCHEDULES;
