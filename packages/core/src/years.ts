/** Income years are keyed by the calendar year they end in: FY 2026–27 → 2027. */
export type FY = number;
export type ISODate = string; // YYYY-MM-DD

export const fyOf = (date: ISODate): FY => {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return m >= 7 ? y + 1 : y;
};

export const fyLabel = (fy: FY): string => `FY ${fy - 1}–${String(fy).slice(2)}`;

export interface Quarter {
  index: 0 | 1 | 2 | 3;
  start: ISODate;
  end: ISODate;
  label: string;
  /** Standard quarterly BAS due date (before any online/agent concession). */
  due: ISODate;
}

export const quartersOf = (fy: FY): Quarter[] => {
  const a = fy - 1, b = fy;
  return [
    { index: 0, start: `${a}-07-01`, end: `${a}-09-30`, label: `Jul–Sep ${a}`, due: `${a}-10-28` },
    { index: 1, start: `${a}-10-01`, end: `${a}-12-31`, label: `Oct–Dec ${a}`, due: `${b}-02-28` },
    { index: 2, start: `${b}-01-01`, end: `${b}-03-31`, label: `Jan–Mar ${b}`, due: `${b}-04-28` },
    { index: 3, start: `${b}-04-01`, end: `${b}-06-30`, label: `Apr–Jun ${b}`, due: `${b}-07-28` },
  ];
};

/** Which quarter of its own income year a date falls in. */
export const quarterOf = (date: ISODate): { fy: FY; index: 0 | 1 | 2 | 3 } => {
  const fy = fyOf(date);
  const q = quartersOf(fy).find((x) => date >= x.start && date <= x.end)!;
  return { fy, index: q.index };
};

/** Whole months between two dates (used for the 12-month CGT discount test). */
export const monthsBetween = (from: ISODate, to: ISODate): number => {
  const [y1, m1, d1] = from.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split("-").map(Number) as [number, number, number];
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};
