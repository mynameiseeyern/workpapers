import type { Cents } from "../money";
import type { AbnSettings, PersonId, PsiStatus, Row, SectionId } from "../model";
import { DEFAULT_ABN } from "../model";
import type { FY } from "../years";

/**
 * Everything the engine needs to work out a year: who the household is, every row, and the settings.
 * Plain data, so the same ledger can come from PocketBase, a test fixture or the example year.
 */
export interface Ledger {
  /** Household members in a fixed order. A shared row's `sharePct` belongs to the first person. */
  people: [PersonId, PersonId] | PersonId[];
  rows: Row[];
  settings: Settings;
}

export interface Settings {
  /**
   * "fy:person:section" → true (applies) / false (not this year) for one person. Missing = not confirmed yet.
   * An older household-wide "fy:section" answer still counts for anyone without their own answer.
   */
  applies: Record<string, boolean>;
  /** ABN set-up per person (GST registration, cash/accrual, when income counts). */
  abn: Record<PersonId, Partial<AbnSettings>>;
  /** "fy:person" → personal services income status. */
  psi: Record<string, PsiStatus>;
  /** Per-year overrides of the rate book (dollars). */
  rateOverrides: Record<number, { wfh?: number; car?: number; mlsFamily?: number }>;
  /** "fy:person" → unused concessional cap carried forward. */
  ccCarry: Record<string, Cents>;
  /** "fy:person:q1..q4" → PAYG instalment paid (T7). */
  payg: Record<string, Cents>;
  /** "fy:person:q1..q4" → a BAS quarter's lodgment record. */
  bas: Record<string, Lodgment>;
  /** "fy:person" → a tax return's lodgment record. */
  returns: Record<string, Lodgment>;
  /** Per-person details by "fy:person": HELP balance. */
  help: Record<string, Cents>;
}

export type LodgmentStatus = "open" | "lodged" | "reopened";
export interface Lodgment {
  status: LodgmentStatus;
  /** Figures as lodged (BAS: sales, gstOnSales, gstOnPurchases, net; return: assessable, deductions, taxable, paid). */
  figures?: Record<string, number> | null;
  lodgedOn?: string;
}

export const emptySettings = (): Settings => ({ applies: {}, abn: {}, psi: {}, rateOverrides: {}, ccCarry: {}, payg: {}, bas: {}, returns: {}, help: {} });

/** A person's ABN settings with defaults filled in (GST-registered, cash basis, income counts when received). */
export const abnOf = (s: Settings, person: PersonId | null): AbnSettings => ({
  ...DEFAULT_ABN,
  ...(person ? s.abn[person] : undefined),
  psi: DEFAULT_ABN.psi,
});

export const psiOf = (s: Settings, fy: FY, person: PersonId): PsiStatus => s.psi[`${fy}:${person}`] ?? "";

export const appliesKey = (fy: FY, section: SectionId, o?: PersonId): string => (o == null ? `${fy}:${section}` : `${fy}:${o}:${section}`);
