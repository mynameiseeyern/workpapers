import { SCHEDULES } from "../engine/schedules";
import type { SectionId } from "../model";
import type { Cents } from "../money";

/**
 * Reads the figures off a statement, invoice, receipt or payslip once its text has been pulled out.
 *
 * No AI: it looks for the words printed beside each figure ("Franked amount", "Total", "GST", "Tax withheld")
 * and takes the amount next to them. What it can't find it leaves alone, and nothing here is ever saved without
 * a person checking it against the document. These are reading rules, not tax rules.
 */
export interface ReadFigures {
  /** "YYYY-MM-DD" */
  date?: string;
  /** Who it is from: a name used before that appears in the document, or a company-looking line. */
  party?: string;
  /** The total, for invoices and receipts (business and work-related records). */
  amount?: Cents;
  gst?: Cents;
  /** For the return schedules: field key → cents. */
  details: Record<string, Cents>;
  /** What was read and the line it came from, so it can be shown back. */
  found: { field: string; cents?: Cents; text?: string; line: string }[];
}
export interface ReadOptions {
  section: SectionId;
  /** Names already used in this schedule; one of these appearing in the document is taken as who it's from. */
  known?: string[];
}

// ---------- amounts ----------

// "$1,234.50", "1234.50", "(45.00)", "$50". Needs cents or a $ so years, quantities and ABNs aren't mistaken for money.
const MONEY = /(?<![\w.,])\(?-?\s?\$?\s?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d|\.\d|\s?%)\)?|(?<![\w.,])\$\s?((?:\d{1,3}(?:,\d{3})+|\d+))(?![\d.,]\d|\s?%)/g;

interface Hit { cents: Cents; at: number }
function amountsIn(line: string): Hit[] {
  const out: Hit[] = [];
  for (const m of line.matchAll(MONEY)) {
    const digits = (m[1] ?? m[2] ?? "").replace(/,/g, "");
    const cents = Math.round(Number(digits) * 100);
    if (Number.isFinite(cents)) out.push({ cents, at: m.index ?? 0 });
  }
  return out;
}

// ---------- dates ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number): string | undefined => {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
/** The first date in a piece of text, and where it ends. Day comes first, the Australian way. */
function firstDate(text: string): { date: string; end: number } | undefined {
  const tries: [RegExp, (m: RegExpMatchArray) => string | undefined][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => iso(+m[1]!, +m[2]!, +m[3]!)],
    [/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/, (m) => iso(+m[3]!, +m[2]!, +m[1]!)],
    [/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})\b/, (m) => iso(+m[3]!, MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, +m[1]!)],
    [/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/, (m) => iso(+m[3]!, MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1, +m[2]!)],
  ];
  let best: { at: number; date: string; end: number } | undefined;
  for (const [re, make] of tries) {
    const m = text.match(re);
    if (!m) continue;
    const date = make(m);
    if (date && (!best || (m.index ?? 0) < best.at)) best = { at: m.index ?? 0, date, end: (m.index ?? 0) + m[0].length };
  }
  return best && { date: best.date, end: best.end };
}
const dateIn = (text: string): string | undefined => firstDate(text)?.date;
/** Every date on a line, left to right. */
function datesIn(text: string): string[] {
  const out: string[] = [];
  for (let rest = text, d = firstDate(rest); d; rest = rest.slice(d.end), d = firstDate(rest)) out.push(d.date);
  return out;
}
const DATE_LABELS = [
  /payment date|date paid|paid on|date of payment/i,
  /(tax )?invoice date|date of issue|issue date|date issued|issued/i,
  /statement date|pay date|date of pay|pay(ment)? period end(ing)?|period end(ing)?/i,
  /\bdate\b/i,
];

// ---------- labels ----------

/** Words printed beside each figure, most specific first. Anything not listed falls back to the box's own label. */
const LABELS: Partial<Record<SectionId, Record<string, RegExp[]>>> = {
  i01: {
    // A payslip that prints a taxable figure has already taken salary sacrifice off, as the income statement does.
    gross: [/taxable (gross|earnings|income|wages|salary|pay)\b/i, /gross payments?/i, /total gross/i, /gross (pay|earnings|income|wages|salary)/i, /\bgross\b/i],
    withheld: [/total tax withheld/i, /tax withheld/i, /payg( tax| withholding)?/i, /income tax/i, /\btax\b(?! invoice| file|able)/i],
    allow: [/allowances?/i],
    rfb: [/reportable fringe benefits?( amount)?/i],
    // Salary-sacrificed super is reportable employer super: on a payslip it's the "salary sacrifice" line.
    resc: [/reportable employer super(annuation)?( contributions?)?/i, /\bresc\b/i,
      /salary sacrific\w*[^\d$]*super\w*/i, /super\w*[^\d$]*salary sacrific\w*/i, /sal\.? sac\w*[^\d$]*super\w*/i,
      /pre[- ]?tax super\w*( contributions?)?/i, /super\w*[^\d$]*pre[- ]?tax/i, /salary sacrific\w*/i, /\bsal\.? sac\b\.?/i],
    sg: [/super(annuation)? guarantee/i, /employer super(annuation)?/i, /\bsgc?\b/i, /super(annuation)?/i],
  },
  i10: {
    gross: [/gross interest/i, /total interest( paid| earned| credited)?/i, /interest (paid|earned|credited)/i, /credit interest/i, /\binterest\b/i],
    withheld: [/tfn (amounts? )?withh[eo]ld(ing)?( tax)?/i, /withholding tax/i, /tax withheld/i],
  },
  i11: {
    unfranked: [/unfranked( amount)?/i],
    franked: [/(?<!un)franked( amount)?/i],
    credit: [/franking credits?/i, /imputation credits?/i],
    withheld: [/tfn (amounts? )?withh[eo]ld(ing)?( tax)?/i, /withholding tax/i],
  },
  i12: { discount: [/discount( amount)?/i] },
  i18: { cost: [/cost base/i, /total cost/i, /purchase (price|cost)/i], proceeds: [/(net |gross |sale )?proceeds/i, /consideration/i, /sale price/i] },
  i20: { gross: [/gross( amount| income| payment)?/i], ftax: [/foreign tax( paid)?/i, /withholding tax/i] },
  h01: { premiums: [/premiums? (eligible|paid)/i, /your premiums?/i, /total premiums?/i], rebate: [/rebate received/i, /government rebate/i, /\brebate\b/i] },
};
/**
 * Lines a box must not read from: where one label sits inside another ("employer super" inside "reportable employer
 * super"), or where the words mean something else (a salary-sacrificed car isn't super).
 */
const NOT_FROM: Partial<Record<SectionId, Record<string, RegExp>>> = {
  i01: {
    withheld: /(pre|post|before|after)[- ]?tax/i,
    resc: /novated|\blease|vehicle|\bcar\b|laptop|phone|device|meal|\bfbt\b|fringe|(post|after)[- ]?tax/i,
    sg: /reportable|\bresc\b|salary sacrific|\bsal\.? sac|(pre|post|before|after)[- ]?tax|personal|voluntary|additional/i,
  },
};
/** Other money headings that show up as table columns, so a row of figures can be lined up with its headings. */
const OTHER_COLUMNS = [/gross payment/i, /net payment/i, /total payment/i, /net (pay|income)/i, /(pre|post|before|after)[- ]?tax (earnings|deductions?)/i,
  /\bdeductions?\b/i, /\bnet\b/i, /\bamount\b/i, /\btotal\b/i, /\bbalance\b/i];
/** A running total for the year. A payslip is read for the pay it covers, so each payslip can be its own record and they add up. */
const YTD = /\b(ytd|y\.t\.d\.?|year[- ]to[- ]date)\b/i;
/** A heading row whose last column is the year to date ("Description  This pay  Year to date"). */
const YTD_LAST_COLUMN = /\S.*\b(ytd|y\.t\.d\.?|year[- ]to[- ]date)\s*$/i;

const TOTAL_LABELS = [
  /amount due|balance due|total due|amount payable|total payable|amount owing|please pay/i,
  /total\s*\(?\s*(inc|incl|including)\b[^$\d]*/i,
  /grand total|invoice total|total aud|total amount/i,
  /total paid|amount paid|payment received|eftpos|\bpaid\b/i,
  /\btotal\b/i,
];
const NOT_A_TOTAL = /sub\s*-?\s*total|excl|ex\.?\s*gst|before gst|total gst|gst total|total (savings?|discount|items?|qty|quantity|points)/i;
const GST_LABELS = [/includes? gst( of)?/i, /gst included( in (the )?total)?/i, /total gst|gst total/i, /gst amount/i, /gst\s*\(?\s*10(\.0+)?\s*%\s*\)?/i, /\bgst\b/i];
const NOT_GST = /gst[\s-]*free|ex\.?\s*gst|excl|gst (reg|registration|number|no\b)|abn/i;
const TOTAL_WITH_GST_WORD = /total[^$\d]*\b(inc|incl|including)\b[^$\d]*gst/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fromLabel = (l: string) => new RegExp(escape(l.replace(/\s*\(.*?\)\s*/g, " ").trim()).replace(/\s+/g, "\\s+"), "i");

/** How a payslip is read: for this pay, never the year to date. */
interface Payslip { ytdLastColumn: boolean }

/**
 * The amount printed beside a label: after it on the same line (the right-most one), else alone on the next line.
 * On a payslip the year-to-date figure is passed over: a label that says "YTD", anything after "YTD" on the line,
 * and the last figure on a line when the last column is the year to date.
 */
function beside(lines: string[], i: number, label: RegExp, payslip?: Payslip): Hit | undefined {
  const line = lines[i]!, m = line.match(label);
  if (!m) return undefined;
  const start = m.index ?? 0, end = start + m[0].length;
  let after = amountsIn(line).filter((a) => a.at >= end);
  if (payslip) {
    if (YTD.test(line.slice(0, start)) || YTD.test(m[0])) return undefined;
    const cut = line.slice(end).search(YTD);
    if (cut >= 0) { after = after.filter((a) => a.at < end + cut); if (!after.length) return undefined; }
    else if (payslip.ytdLastColumn && after.length >= 2) after = after.slice(0, -1);
  }
  if (after.length) return after[after.length - 1];
  // On the line below, only when it holds that one figure: a row of several belongs to a row of headings, read as a table.
  const next = lines[i + 1];
  if (next && !/[A-Za-z]{3,}/.test(next.replace(/aud|nzd|usd/gi, ""))) { const a = amountsIn(next); if (a.length === 1) return a[0]; }
  return undefined;
}

export function readFigures(text: string, opts: ReadOptions): ReadFigures {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean);
  const out: ReadFigures = { details: {}, found: [] };
  const g = SCHEDULES[opts.section];
  const isInvoice = opts.section === "s05" || opts.section === "s07";

  // ----- figures for the return schedules -----
  if (g) {
    const money = g.fields.filter((f) => f.t === "money");
    const payslip: Payslip | undefined = opts.section === "i01"
      ? { ytdLastColumn: lines.some((l) => YTD_LAST_COLUMN.test(l) && !amountsIn(l).length) } : undefined;
    const labelsOf = (k: string, l: string) => [...(LABELS[opts.section]?.[k] ?? []), fromLabel(l)];
    const take = (k: string, cents: Cents, line: string) => { if (!(k in out.details)) { out.details[k] = cents; out.found.push({ field: k, cents, line }); } };

    // A row of headings with the figures on the row below: line them up in order.
    for (let i = 0; i < lines.length - 1; i++) {
      const head = lines[i]!;
      if (amountsIn(head).length) continue;
      // Every wording that could be a column, for the boxes and for columns that aren't boxes.
      interface Col { at: number; len: number; k?: string; rank: number }
      const found: Col[] = [];
      const offer = (re: RegExp, k?: string, rank = 0) => {
        for (const m of head.matchAll(new RegExp(re.source, "gi"))) {
          const at = m.index ?? 0;
          if (!m[0].length) continue;
          // on a payslip a "YTD ..." column is still a column, but never one of the boxes
          const running = !!payslip && (YTD.test(head.slice(Math.max(0, at - 16), at)) || YTD.test(m[0]));
          found.push({ at, len: m[0].length, k: running ? undefined : k, rank });
        }
      };
      for (const f of money) labelsOf(f.k, f.l).forEach((re, rank) => offer(re, f.k, rank));
      for (const re of OTHER_COLUMNS) offer(re);
      // The longest wording wins its stretch of the heading: "Post tax earnings" is one column, not a "Tax" column.
      found.sort((a, b) => b.len - a.len || a.rank - b.rank || (a.k ? 0 : 1) - (b.k ? 0 : 1));
      const cols: Col[] = [];
      for (const c of found) if (!cols.some((x) => c.at < x.at + x.len && x.at < c.at + c.len)) cols.push(c);
      // One column per box, the one with its most exact wording: "Taxable income" is gross payments, a plain "Gross" beside it is not.
      for (const f of money) cols.filter((c) => c.k === f.k).sort((a, b) => a.rank - b.rank).slice(1).forEach((c) => { c.k = undefined; });
      if (cols.filter((c) => c.k).length < 2) continue;
      cols.sort((a, b) => a.at - b.at);
      for (const j of [i + 1, i + 2]) {
        const row = lines[j];
        if (!row) continue;
        const nums = amountsIn(row);
        if (nums.length !== cols.length) continue;
        cols.forEach((c, n) => { if (c.k) take(c.k, nums[n]!.cents, row); });
        break;
      }
    }

    // A label with its figure beside it.
    for (const f of money) {
      if (f.k in out.details) continue;
      if (f.k === "amount") continue;   // a bare "Amount" box takes the document's total, below
      const skip = NOT_FROM[opts.section]?.[f.k];
      search: for (const label of labelsOf(f.k, f.l)) {
        for (let i = 0; i < lines.length; i++) {
          if (skip?.test(lines[i]!)) continue;
          const hit = beside(lines, i, label, payslip);
          if (hit) { take(f.k, hit.cents, lines[i]!); break search; }
        }
      }
    }
  }

  // Tax taken out of a pay is always less than the pay. Anything else is a misreading, and an empty box is better than a wrong one.
  if (opts.section === "i01" && out.details["withheld"] != null && out.details["gross"] != null && out.details["withheld"] >= out.details["gross"]) {
    delete out.details["withheld"];
    out.found = out.found.filter((f) => f.field !== "withheld");
  }

  // ----- the total and the GST, for invoices and receipts -----
  const wantsTotal = isInvoice || !!g?.fields.some((f) => f.k === "amount" && f.t === "money");
  if (wantsTotal) {
    let total: { cents: Cents; line: string } | undefined;
    for (const label of TOTAL_LABELS) {
      for (let i = 0; i < lines.length; i++) {
        if (NOT_A_TOTAL.test(lines[i]!)) continue;
        const hit = beside(lines, i, label);
        if (hit && hit.cents > 0) total = { cents: hit.cents, line: lines[i]! };   // keep going: the last one on the page is the one that counts
      }
      if (total) break;
    }
    if (total) {
      if (isInvoice) out.amount = total.cents; else out.details["amount"] = total.cents;
      out.found.push({ field: "amount", cents: total.cents, line: total.line });
    }
    if (isInvoice) {
      search: for (const label of GST_LABELS) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const explicit = /includes? gst( of)?|gst included/i.test(line);
          if (!explicit && (NOT_GST.test(line) || TOTAL_WITH_GST_WORD.test(line))) continue;
          const hit = beside(lines, i, label);
          if (hit && hit.cents > 0 && (out.amount == null || hit.cents < out.amount)) {
            out.gst = hit.cents; out.found.push({ field: "gst", cents: hit.cents, line });
            break search;
          }
        }
      }
    }
  }

  // ----- the date: one beside a date label, else the first date on the page -----
  search: for (const label of DATE_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(label);
      if (!m) continue;
      let date = dateIn(lines[i]!.slice((m.index ?? 0) + m[0].length));
      if (!date && lines[i + 1]) {
        // A row of headings with the dates on the row below: count along to this heading's date. A "period" before it holds two.
        const before = lines[i]!.slice(0, m.index ?? 0), below = datesIn(lines[i + 1]!);
        const along = (before.match(/\bperiod\b/gi)?.length ?? 0) * 2 + (before.match(/\b(date|from|start(s|ing)?|end(s|ing)?)\b/gi)?.length ?? 0);
        date = below[Math.min(along, below.length - 1)];
      }
      if (date) { out.date = date; out.found.push({ field: "date", text: date, line: lines[i]! }); break search; }
    }
  }
  if (!out.date) {
    for (const line of lines) { const date = dateIn(line); if (date) { out.date = date; out.found.push({ field: "date", text: date, line }); break; } }
  }

  // ----- who it's from: a name used before, else a line that looks like a company -----
  const lower = text.toLowerCase();
  const known = [...(opts.known ?? [])].filter((n) => n.trim().length >= 3).sort((a, b) => b.length - a.length).find((n) => lower.includes(n.trim().toLowerCase()));
  if (known) { out.party = known.trim(); out.found.push({ field: "party", text: out.party, line: "a name you've used before" }); }
  else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!/\b(pty\.?\s*ltd\.?|limited|ltd\.?|incorporated|inc\.?)(\s|$|,)/i.test(line)) continue;
      if (/bill(ed)? to|invoice to|ship to|sold to|customer|attention|attn/i.test(line) || /bill(ed)? to|invoice to|ship to|sold to|customer/i.test(lines[i - 1] ?? "")) continue;
      const name = line.replace(/\babn\b.*$/i, "").replace(/[|•·].*$/, "").replace(/\s+\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\s*$/, "").trim();
      if (name.length >= 3 && name.length <= 70 && !amountsIn(name).length) { out.party = name; out.found.push({ field: "party", text: name, line }); break; }
    }
  }
  return out;
}
