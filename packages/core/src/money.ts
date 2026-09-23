/** Money is held in integer cents everywhere in core, so totals never drift. */
export type Cents = number;

export const toCents = (dollars: number | string | null | undefined): Cents => {
  const n = typeof dollars === "string" ? Number(dollars) : dollars ?? 0;
  // toFixed(6) first so values like 110.005 (stored as 110.00499…) round the way a person expects
  return Number.isFinite(n) ? Math.round(Number(((n as number) * 100).toFixed(6))) : 0;
};
export const toDollars = (c: Cents): number => c / 100;

/** en-AU currency, "-$1,234.50" for negatives (matches the prototype). */
export const formatMoney = (c: Cents): string =>
  (c < 0 ? "-" : "") +
  "$" +
  (Math.abs(c) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Split an amount by a percentage share, rounding half away from zero. */
export const shareOf = (c: Cents, pct: number): Cents => Math.round((c * pct) / 100);
