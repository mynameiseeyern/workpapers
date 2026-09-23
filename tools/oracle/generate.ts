/**
 * Golden fixtures: run made-up ledgers through the frozen prototype (v15) and record what it calculates.
 * packages/core/test/golden.test.ts then checks the new engine gives the same answers.
 *
 * No real household data is used: the inputs are the example year plus randomly generated ledgers.
 * Run:  pnpm --filter @workpapers/oracle golden
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { exampleLedger, SCHEDULES, type Ledger, type Row, type SectionId } from "@workpapers/core";
// @ts-expect-error plain JS module
import { loadPrototype, FIXES } from "./prototype.mjs";

const PEOPLE: [string, string] = ["Ee", "Darrelle"];
const TODAY = "2027-03-15";
const P = loadPrototype(TODAY);

// ---------- core ledger → prototype state ----------
const moneyFields = (sec: string) => (SCHEDULES[sec]?.fields ?? []).filter((f) => f.t === "money").map((f) => f.k);
function protoRow(r: Row): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: r.id, section: r.section, date: r.date, owner: r.owner ?? "Shared", amount: r.amount / 100, gst: r.gst / 100,
    noGst: r.noGst, doc: r.evidenced,
  };
  if (r.owner == null) o.share = r.sharePct ?? 50;
  if (r.paid !== undefined) o.paid = r.paid;
  if (r.direction) o.direction = r.direction;
  if (r.apportion != null) o.apportion = r.apportion;
  if (r.category) o.cat = r.category;
  if (r.bizCategory) o.bcat = r.bizCategory;
  if (r.use) o.use = r.use;
  if (r.hours != null) o.hours = r.hours;
  const mk = moneyFields(r.section);
  for (const [k, v] of Object.entries(r.details ?? {})) o[k] = mk.includes(k) ? (v as number) / 100 : v;
  return o;
}
function protoPrefs(l: Ledger) {
  const s = l.settings, p: Record<string, any> = { applies: { ...s.applies }, gstReg: {}, basisBy: {}, incomeBy: {}, psi: { ...s.psi },
    wfhRates: {}, carRates: {}, mlsFamilyBy: {}, misc: {}, payg: {} };
  for (const [o, a] of Object.entries(s.abn)) {
    if (a.gstRegistered === false) p.gstReg[o] = false;
    if (a.gstBasis) p.basisBy[o] = a.gstBasis;
    if (a.incomeBasis) p.incomeBy[o] = a.incomeBasis;
  }
  for (const [fy, r] of Object.entries(s.rateOverrides)) {
    if (r.wfh != null) p.wfhRates[fy] = r.wfh;
    if (r.car != null) p.carRates[fy] = r.car;
  }
  for (const [k, v] of Object.entries(s.ccCarry)) p.misc["ccCarry:" + k] = v / 100;
  for (const [k, v] of Object.entries(s.payg)) p.payg[k] = v / 100;
  return p;
}

// ---------- what to record ----------
const NOT_MONEY = new Set(["hours", "bizHours", "homeHours", "km", "capped", "days", "n", "ok", "missing", "count", "superOk", "superPending", "held", "over", "rate"]);
const c = (x: number) => Math.round(x * 100);
function cents(obj: Record<string, unknown>, keys: string[]) {
  const out: Record<string, number | boolean | null> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] = typeof v === "number" ? (NOT_MONEY.has(k) ? v : c(v)) : (v as boolean | null) ?? null;
  }
  return out;
}
const byPerson = (m: Record<string, number>, money = true) =>
  Object.fromEntries(PEOPLE.map((o) => [o, money ? c(m[o] ?? 0) : m[o] ?? 0]));

function run(l: Ledger, fy: number) {
  P.state.rows = l.rows.map(protoRow);
  P.state.prefs = protoPrefs(l);
  P.state.person = "Household";
  P.setFY(fy);
  const scopes: Record<string, string> = { household: "Household", [PEOPLE[0]]: PEOPLE[0], [PEOPLE[1]]: PEOPLE[1] };
  const out: Record<string, any> = { fy, applies: {}, scopes: {}, tax: {}, bas: {} };
  for (const id of ["s05", "s07", ...Object.keys(SCHEDULES)]) out.applies[id] = P.applies(id);
  for (const [name, who] of Object.entries(scopes)) {
    out.scopes[name] = P.asPerson(who, () => {
      const owners = who === "Household" ? PEOPLE : [who];
      const b = P.businessTotals(owners), d = P.deductionTotals(), w = P.wfhTotals();
      const sections: Record<string, number | null> = {};
      for (const id of ["s05", "s07", "s07a", "s07b", ...Object.keys(SCHEDULES)]) {
        const v = P.sectionTotal(id); sections[id] = v == null ? null : c(v);
      }
      const schedules: Record<string, any> = {};
      for (const id of Object.keys(SCHEDULES)) {
        const t = P.genTotals(id), g = SCHEDULES[id]!;
        const keys = [...g.fields.filter((f) => f.t === "money" || f.t === "num").map((f) => f.k), ...(g.cols ?? []).map((x) => x.k)];
        if (id === "d01") keys.push("capped", "over");
        schedules[id] = { values: cents(t, keys), count: t.n, ok: t.ok, missing: t.missing, net: c(t.net) };
      }
      return {
        sections, schedules,
        business: { ...cents(b, ["sales", "gstOnSales", "gstOnPurchases", "expenses", "poolTotal", "psiDeniedTotal", "homeOffice", "homeHours"]),
          unpaidIncome: c(b.unpaidIncome ?? 0), pool: b.pool.length, psiDenied: b.psiDenied.length },
        deductions: { total: c(d.total), deprTotal: c(d.deprTotal), missing: d.missing, outright: byPerson(d.outright),
          deprBy: byPerson(d.deprBy), overlapBy: byPerson(d.overlapBy), depr: d.depr.length, overlap: d.overlap.length },
        wfh: { hours: w.hours, bizHours: w.bizHours, claim: c(w.claim), bizClaim: c(w.bizClaim), by: byPerson(w.by, false) },
        abnHolders: [...P.abnHolders()],
      };
    });
  }
  for (const o of PEOPLE) {
    const f = P.taxFigures(o);
    out.tax[o] = { ...cents(f, ["income", "withheld", "offsets", "rfb", "resc", "sg", "superClaim", "cgt", "rentNet", "otherDed",
      "superOk", "superPending", "workDed", "business", "businessLoss", "cgtNet", "rentIn", "assessable", "deductions", "taxable",
      "investLoss", "testIncome", "concessional", "ccCap", "ccCarry", "ccRoom", "payg"]),
      phi: f.phi ? { premiums: c(f.phi.premiums), rebate: c(f.phi.rebate), days: f.phi.days } : null };
    out.bas[o] = P.quarters().map((q: string[]) => cents(P.quarterBAS(q, o), ["sales", "gstOnSales", "gstOnPurchases", "net", "count", "unsubstantiated"]));
  }
  return out;
}

// ---------- random ledgers ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function randomLedger(seed: number): { ledger: Ledger; fy: number } {
  const R = rng(seed), pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)]!, int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const fy = pick([2026, 2027]);
  const date = (y: number) => { const t = Date.UTC(y - 1, 6, 1) + Math.floor(R() * 364) * 86400000; return new Date(t).toISOString().slice(0, 10); };
  const anyDate = () => date(R() < 0.8 ? fy : pick([fy - 1, fy + 1]));
  const owner = (canShare: boolean) => (canShare && R() < 0.3 ? null : pick(PEOPLE));
  const $ = (a: number, b: number) => int(a, b) * 100;        // whole dollars
  const gstOf = (amt: number) => Math.floor(amt / 11 / 10) * 10; // multiple of 10c so percentage splits stay exact
  const rows: Row[] = [];
  let id = 0;
  const base = (section: SectionId, canShare: boolean): Row => {
    const o = owner(canShare);
    const r: Row = { id: `r${++id}`, section, date: anyDate(), owner: o, amount: 0, gst: 0, noGst: false, evidenced: R() < 0.7 };
    if (o == null) r.sharePct = int(0, 10) * 10;
    return r;
  };
  const n = int(15, 70);
  for (let i = 0; i < n; i++) {
    const kind = pick(["s05", "s05", "s05", "s07", "s07", "s07a", "s07a", ...Object.keys(SCHEDULES)]) as SectionId;
    if (kind === "s05") {
      const r = base("s05", false), amt = $(20, 30000), income = R() < 0.4;
      r.direction = income ? "income" : "expense"; r.amount = amt; r.gst = gstOf(amt); r.noGst = R() < 0.1;
      const pr = R(); r.paid = pr < 0.15 ? "" : pr < 0.25 ? undefined : (() => { const t = new Date(r.date + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + int(0, 60)); return t.toISOString().slice(0, 10); })();
      if (!income) {
        if (R() < 0.3) r.apportion = int(0, 10) * 10;
        r.bizCategory = pick(["All other expenses", "Insurance", "Depreciating asset — instant asset write-off", "Home occupancy — rent, mortgage interest, rates, land tax", "Payments to associates — non-principal work", "Travel"]);
      }
      rows.push(r);
    } else if (kind === "s07") {
      const r = base("s07", true), amt = $(10, 2500);
      r.amount = amt; r.gst = gstOf(amt); r.noGst = R() < 0.2;
      r.category = pick(["D5 Other work-related — tools & equipment", "D5 Other work-related — phone & internet", "D5 Other work-related — subscriptions", "D4 Work-related self-education", "D9 Gifts or donations"]);
      rows.push(r);
    } else if (kind === "s07a") {
      const r = base("s07a", false); r.hours = int(1, 40); r.use = R() < 0.4 ? "business" : "work"; rows.push(r);
    } else {
      const g = SCHEDULES[kind]!, r = base(kind, g.shared), det: Record<string, unknown> = {};
      for (const f of g.fields) {
        if (f.t === "money") det[f.k] = R() < 0.85 ? $(0, 40000) : 0;
        else if (f.t === "num") det[f.k] = int(0, 3000);
        else if (f.t === "check") det[f.k] = R() < 0.6;
        else if (f.t === "sel") det[f.k] = pick(f.opts!);
        else if (f.t === "date") det[f.k] = date(fy - int(0, 3));
        else det[f.k] = "x";
      }
      r.details = det; rows.push(r);
    }
  }
  const settings: Ledger["settings"] = { applies: {}, abn: {}, psi: {}, rateOverrides: {}, ccCarry: {}, payg: {} };
  for (const o of PEOPLE) {
    settings.abn[o] = { gstRegistered: R() < 0.8, gstBasis: R() < 0.7 ? "cash" : "accrual", incomeBasis: R() < 0.7 ? "receipts" : "earnings" };
    settings.psi[`${fy}:${o}`] = pick(["", "notpsi", "psb", "applies"]);
    if (R() < 0.3) settings.ccCarry[`${fy}:${o}`] = $(0, 20000);
    for (let q = 1; q <= 4; q++) if (R() < 0.4) settings.payg[`${fy}:${o}:q${q}`] = $(0, 3000);
  }
  for (const id of ["s05", "s07", ...Object.keys(SCHEDULES)]) {
    const x = R();
    if (x < 0.1) settings.applies[`${fy}:${id}`] = false;
    else if (x < 0.2) settings.applies[`${fy - 1}:${id}`] = false;
    else if (x < 0.3) settings.applies[`${fy}:${id}`] = true;
  }
  if (R() < 0.3) settings.rateOverrides[fy] = { wfh: pick([0.67, 0.7, 0.72]), car: pick([0.85, 0.88, 0.9]) };
  return { ledger: { people: [...PEOPLE], rows, settings }, fy };
}

// ---------- write ----------
const cases: { name: string; ledger: Ledger; fy: number; expected: unknown }[] = [];
for (const fy of [2026, 2027]) {
  const ledger = exampleLedger(PEOPLE, fy);
  cases.push({ name: `example-${fy}`, ledger, fy, expected: run(ledger, fy) });
}
for (let s = 1; s <= 60; s++) {
  const { ledger, fy } = randomLedger(s * 7919);
  cases.push({ name: `random-${s}`, ledger, fy, expected: run(ledger, fy) });
}
const dir = new URL("../../packages/core/test/golden/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("cases.json", dir), JSON.stringify({ prototype: "v15", fixes: FIXES.map((f: any) => f.id), today: TODAY, cases }, null, 1));
console.log(`wrote ${cases.length} golden cases`);
