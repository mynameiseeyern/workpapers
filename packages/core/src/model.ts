import type { Cents } from "./money";
import type { ISODate } from "./years";

export type PersonId = string;
export type SectionId =
  | "i01" | "i10" | "i11" | "i12" | "i18" | "i20" | "i21"
  | "s05" | "d01" | "d03" | "s07" | "s07a" | "d07" | "d12" | "d15" | "h01" | "s08";

export type GstBasis = "cash" | "accrual";
export type IncomeBasis = "receipts" | "earnings";
export type PsiStatus = "" | "notpsi" | "psb" | "applies";

export interface Row {
  id: string;
  section: SectionId;
  date: ISODate;
  /**
   * Business rows only. `undefined` = saved before paid dates existed (treated as paid on `date`);
   * `""` = not yet paid; otherwise the payment date.
   */
  paid?: ISODate | "";
  /** Single taxpayer, or null when shared. */
  owner: PersonId | null;
  /** First person's percentage when shared. */
  sharePct?: number;
  amount: Cents;
  gst: Cents;
  noGst: boolean;
  direction?: "income" | "expense";
  apportion?: number;
  category?: string;
  bizCategory?: string;
  use?: "work" | "business";
  hours?: number;
  party?: string;
  description?: string;
  evidenced: boolean;
  details?: Record<string, unknown>;
}

export interface AbnSettings {
  gstRegistered: boolean;
  gstBasis: GstBasis;
  incomeBasis: IncomeBasis;
  psi: PsiStatus;
}

export const DEFAULT_ABN: AbnSettings = { gstRegistered: true, gstBasis: "cash", incomeBasis: "receipts", psi: "" };
