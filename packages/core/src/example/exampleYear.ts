import type { PersonId, Row, SectionId } from "../model";
import type { FY } from "../years";
import { emptySettings, type Ledger } from "../engine/ledger";
import { ASSET_CAT, PHONE_CAT } from "../engine/engine";

/**
 * A made-up household year, used to show how records flow into the BAS and the tax return.
 * Every figure here is invented. It is never saved to the database and never mixed with real rows.
 *
 * Person A: an employee who works from home two days a week.
 * Person B: a GST-registered sole trader (cash basis) who also works from home.
 * Together: a joint savings account, some shares, and a share sale.
 */
export function exampleLedger(people: [PersonId, PersonId], fy: FY): Ledger {
  const [A, B] = people;
  /** Date in the example year: months 7–12 fall in the first calendar year, 1–6 in the second. */
  const d = (m: number, day: number) => `${m >= 7 ? fy - 1 : fy}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  let seq = 0;
  const rows: Row[] = [];
  const add = (section: SectionId, date: string, owner: PersonId | null, fields: Partial<Row> = {}) =>
    rows.push({ id: `ex${++seq}`, section, date, owner, amount: 0, gst: 0, noGst: false, evidenced: true, ...fields });
  const $ = (dollars: number) => Math.round(dollars * 100);

  // ---- income ----
  add("i01", d(6, 30), A, { party: "Example Employer Pty Ltd",
    details: { party: "Example Employer Pty Ltd", gross: $(92000), withheld: $(20480), allow: 0, rfb: 0, resc: $(2000), sg: $(11040) } });
  add("i10", d(6, 30), null, { sharePct: 50, party: "Joint savings",
    details: { party: "Joint savings account", gross: $(1240), withheld: 0 } });
  add("i11", d(9, 20), null, { sharePct: 50, details: { party: "Example ETF", unfranked: $(120), franked: $(700), credit: $(300), withheld: 0 } });
  add("i11", d(3, 22), null, { sharePct: 50, details: { party: "Example ETF", unfranked: $(110), franked: $(680), credit: $(290), withheld: 0 } });
  add("i18", d(2, 14), null, { sharePct: 50, details: { party: "Example shares (parcel 1)", acq: `${fy - 4}-05-10`, cost: $(8000), proceeds: $(11600) } });

  // ---- Person B's business (GST-registered, cash basis) ----
  const invoices: [number, number, string | ""][] = [
    [7, 31, d(8, 12)], [8, 31, d(9, 9)], [9, 30, d(10, 14)], [10, 31, d(11, 20)], [11, 30, d(12, 18)],
    [12, 15, d(1, 20)], [1, 31, d(2, 17)], [2, 28, d(3, 21)], [3, 31, d(4, 16)], [4, 30, d(5, 19)], [5, 31, d(6, 18)], [6, 30, ""],
  ];
  invoices.forEach(([m, day, paid], i) =>
    add("s05", d(m, day), B, { direction: "income", party: `Client ${i % 3 === 0 ? "North" : i % 3 === 1 ? "South" : "West"}`,
      description: `Invoice ${1001 + i}`, amount: $(4400), gst: $(400), paid }));
  for (let m = 1; m <= 12; m++) {
    add("s05", d(m, 5), B, { direction: "expense", party: "Design software", description: "Monthly subscription",
      amount: $(66), gst: $(6), bizCategory: "All other expenses", paid: d(m, 5) });
  }
  add("s05", d(8, 22), B, { direction: "expense", party: "Computer shop", description: "Laptop", amount: $(2750), gst: $(250),
    bizCategory: ASSET_CAT, paid: d(8, 22) });
  add("s05", d(11, 3), B, { direction: "expense", party: "Mobile carrier", description: "Phone plan (80% business)", amount: $(660), gst: $(60),
    apportion: 80, bizCategory: "All other expenses", paid: d(11, 3), evidenced: false });
  add("s05", d(3, 9), B, { direction: "expense", party: "Accountant", description: "Tax agent fee", amount: $(990), gst: $(90),
    bizCategory: "All other expenses", paid: d(3, 9) });
  add("s05", d(5, 2), B, { direction: "expense", party: "Insurer", description: "Professional indemnity", amount: $(880), gst: $(80),
    bizCategory: "Insurance", paid: d(5, 2) });

  // ---- working from home (weekly logs) ----
  for (let w = 0; w < 44; w++) {
    const date = new Date(Date.UTC(fy - 1, 6, 7 + w * 7)).toISOString().slice(0, 10);
    add("s07a", date, A, { hours: 16, use: "work" });
    add("s07a", date, B, { hours: 20, use: "business" });
  }

  // ---- Person A's work-related deductions ----
  add("s07", d(8, 3), A, { party: "Professional body", category: "D5 Other work-related — union & professional fees", amount: $(420), gst: 0, noGst: true });
  add("s07", d(10, 18), A, { party: "Bookshop", category: "D4 Work-related self-education", amount: $(189), gst: $(17.18) });
  add("s07", d(12, 2), A, { party: "Mobile carrier", category: PHONE_CAT, amount: $(540), gst: $(49.09) });   // already inside the WFH fixed rate
  add("s07", d(2, 11), A, { party: "Computer shop", category: "D5 Other work-related — tools & equipment", amount: $(1899), gst: $(172.64) }); // over $300: decline in value
  add("s07", d(4, 7), A, { party: "Charity", category: "D9 Gifts or donations", amount: $(250), gst: 0, noGst: true, evidenced: false });

  // ---- other deductions ----
  add("d01", d(9, 12), A, { details: { party: "Client site visits (Sep)", km: 180 } });
  add("d01", d(3, 3), A, { details: { party: "Training days (Mar)", km: 240 } });
  add("d12", d(6, 10), A, { details: { party: "Example Super Fund", amount: $(5000), noi: true, ack: true } });
  add("d15", d(6, 1), B, { details: { party: "Income protection", kind: "Income protection insurance", amount: $(1320) } });

  // ---- private health ----
  add("h01", d(6, 30), A, { details: { party: "Example Health", policy: "EX-1001", premiums: $(1650), rebate: $(380), days: 365, code: "30" } });
  add("h01", d(6, 30), B, { details: { party: "Example Health", policy: "EX-1001", premiums: $(1650), rebate: $(380), days: 365, code: "30" } });

  const settings = emptySettings();
  settings.abn[B] = { gstRegistered: true, gstBasis: "cash", incomeBasis: "receipts" };
  settings.psi[`${fy}:${B}`] = "notpsi";
  for (let q = 1; q <= 4; q++) settings.payg[`${fy}:${B}:q${q}`] = $(1800);
  return { people: [A, B], rows, settings };
}
