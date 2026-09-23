import type { AbnSettings, Row } from "./model";
import { DEFAULT_ABN } from "./model";
import { fyOf, type FY, type ISODate } from "./years";

export type AbnLookup = (owner: string | null) => AbnSettings;
const defaults: AbnLookup = () => DEFAULT_ABN;

/** Business income on a receipts basis that hasn't been received yet: shown, not counted. */
export const notYetDerived = (r: Row, abn: AbnLookup = defaults): boolean =>
  r.section === "s05" && r.direction === "income" && abn(r.owner).incomeBasis === "receipts" && r.paid === "";

/**
 * The income year a row belongs to. Business income on a receipts basis counts when received;
 * unpaid income stays in its invoice year until paid. Everything else follows its date.
 */
export const rowFY = (r: Row, abn: AbnLookup = defaults): FY => {
  if (r.section === "s05" && r.direction === "income" && abn(r.owner).incomeBasis === "receipts" && r.paid)
    return fyOf(r.paid);
  return fyOf(r.date);
};

/**
 * The date that puts a business row on a BAS: date paid on a cash basis, invoice date on accrual.
 * Returns null when a cash-basis row is unpaid (it isn't on any BAS yet).
 */
export const basDate = (r: Row, abn: AbnLookup = defaults): ISODate | null => {
  if (abn(r.owner).gstBasis !== "cash") return r.date || null;
  if (r.paid === undefined) return r.date || null;
  return r.paid || null;
};
