import type { Cents } from "../money";
import { toCents } from "../money";
import type { PersonId, Row, SectionId } from "../model";
import { rate } from "../rates/ratebook";
import { basDate, notYetDerived, rowFY, type AbnLookup } from "../rowyear";
import { quartersOf, type FY, type Quarter } from "../years";
import { abnOf, appliesKey, psiOf, type Ledger } from "./ledger";
import { SCHEDULES, type Schedule } from "./schedules";
import { lockOf, lockReason, type Lock, type LockContext } from "../locks/lockcore";
import type { Lodgment } from "./ledger";

/**
 * The calculation engine, ported from prototype v15. Pure: a ledger and a year in, figures out.
 * All money is integer cents; each person's share of a row is rounded to the cent where it is taken.
 *
 * `scope` is who is being looked at: one person, or everyone (the household view).
 */

export const PHONE_CAT = "D5 Other work-related — phone & internet";
export const ASSET_CAT = "Depreciating asset — instant asset write-off";
export const PSI_DENIED = ["Home occupancy — rent, mortgage interest, rates, land tax", "Payments to associates — non-principal work"];
export const TOOLS_CAT = "D5 Other work-related — tools & equipment";
export const WORK_CATS = [
  TOOLS_CAT, PHONE_CAT, "D5 Other work-related — subscriptions",
  "D5 Other work-related — union & professional fees", "D4 Work-related self-education", "D2 Work-related travel",
  "D9 Gifts or donations", "D10 Cost of managing tax affairs",
];
export const BIZ_CATS = [
  "All other expenses", "Cost of sales", "Contractors & subcontractors", "Superannuation", "Motor vehicle",
  "Repairs & maintenance", "Rent — business premises", ASSET_CAT, "Depreciation", "Interest", "Advertising",
  "Insurance", "Travel", ...PSI_DENIED,
];

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const pct = (v: number | undefined, dflt = 100): number => (v == null || Number.isNaN(Number(v)) ? dflt : Number(v));

export class Engine {
  readonly people: PersonId[];
  readonly quarters: Quarter[];
  private readonly abn: AbnLookup;

  constructor(readonly ledger: Ledger, readonly fy: FY) {
    this.people = [...ledger.people];
    this.quarters = quartersOf(fy);
    this.abn = (o) => abnOf(ledger.settings, o);
  }

  /** A new engine for another year over the same ledger. */
  year(fy: FY): Engine { return new Engine(this.ledger, fy); }

  // ---------- rates (dollars, as published) ----------
  wfhRate(): number { return this.ledger.settings.rateOverrides[this.fy]?.wfh ?? rate("wfh", this.fy); }
  carRate(): number { return this.ledger.settings.rateOverrides[this.fy]?.car ?? rate("car", this.fy); }
  mlsFamily(): number { return this.ledger.settings.rateOverrides[this.fy]?.mlsFamily ?? rate("mls", this.fy); }

  // ---------- people and shares ----------
  /** Share of a row that belongs to a person (0–1). Shared rows split by `sharePct` (first person's %). */
  shareOf(r: Row, o: PersonId): number {
    if (r.owner == null) {
      const p = Math.max(0, Math.min(100, pct(r.sharePct, 50)));
      return (o === this.people[0] ? p : 100 - p) / 100;
    }
    return r.owner === o ? 1 : 0;
  }
  private inScope(r: Row, scope: PersonId[]): boolean { return scope.some((o) => this.shareOf(r, o) > 0); }
  gstRegistered(o: PersonId): boolean { return this.abn(o).gstRegistered; }
  psi(o: PersonId) { return psiOf(this.ledger.settings, this.fy, o); }

  // ---------- rows and years ----------
  rowFY(r: Row): FY { return rowFY(r, this.abn); }
  notYetDerived(r: Row): boolean { return notYetDerived(r, this.abn); }
  basDate(r: Row): string | null { return basDate(r, this.abn); }
  /** Rows of a section that belong to this income year. */
  rowsIn(section: SectionId, fy: FY = this.fy): Row[] {
    return this.ledger.rows.filter((r) => r.section === section && this.rowFY(r) === fy);
  }
  /** Whether a section has rows this year — anyone's, or ones that belong at least partly to person `o`. */
  hasRows(section: SectionId, fy: FY = this.fy, o?: PersonId): boolean {
    return this.rowsIn(section, fy).some((r) => o == null || this.shareOf(r, o) > 0);
  }
  /** Rows that make a section count as in use: working from home rows count for work-related deductions. */
  private inUse(section: SectionId, fy: FY, o?: PersonId): boolean {
    return this.hasRows(section, fy, o) || (section === "s07" && this.hasRows("s07a", fy, o));
  }
  /** Whether a section has shared rows (owned by both people) this year or last. */
  hasSharedRows(section: SectionId): boolean {
    return [this.fy, this.fy - 1].some((fy) => this.rowsIn(section, fy).some((r) => r.owner == null));
  }

  // ---------- which schedules apply ----------
  // Each person answers for themselves. Without a person: the household view — it applies if it applies to anyone.
  /** The recorded answer: true, false, or null when not confirmed yet. */
  appliesRecorded(section: SectionId, fy: FY = this.fy, o?: PersonId): boolean | null {
    const a = this.ledger.settings.applies, get = (k: string) => (a[k] === true || a[k] === false ? a[k]! : null);
    if (o != null) return get(appliesKey(fy, section, o)) ?? get(appliesKey(fy, section));
    const each = this.people.map((p) => this.appliesRecorded(section, fy, p));
    if (each.some((v) => v === true)) return true;
    return each.length > 0 && each.every((v) => v === false) ? false : null;
  }
  /** Suggestion from rows and last year: true, false, or null when there's nothing to go on. */
  suggestApplies(section: SectionId, o?: PersonId): boolean | null {
    if (this.inUse(section, this.fy, o)) return true;
    const prev = this.appliesRecorded(section, this.fy - 1, o);
    if (prev === true || this.inUse(section, this.fy - 1, o)) return true;
    if (prev === false) return false;
    return null;
  }
  applies(section: SectionId, o?: PersonId): boolean {
    if (o == null) return this.people.length ? this.people.some((p) => this.applies(section, p)) : this.appliesTo(section);
    return this.appliesTo(section, o);
  }
  private appliesTo(section: SectionId, o?: PersonId): boolean {
    const a = this.appliesRecorded(section, this.fy, o);
    if (a !== null) return a;
    if (this.inUse(section, this.fy, o)) return true;
    return this.suggestApplies(section, o) !== false;
  }
  /** Whether a section applies to anyone in `scope`. */
  appliesFor(section: SectionId, scope: PersonId[]): boolean { return scope.some((o) => this.applies(section, o)); }

  /** People in scope who have business rows this year (and the business schedule applies). */
  abnHolders(scope: PersonId[] = this.people): PersonId[] {
    const seen = new Set(this.rowsIn("s05").map((r) => r.owner));
    return scope.filter((o) => seen.has(o) && this.applies("s05", o));
  }

  // ---------- working from home ----------
  private wfhUse(r: Row): "work" | "business" { return r.use === "business" ? "business" : "work"; }
  /** Employment WFH hours per person, used for the phone & internet overlap rule (F2: business hours don't count). */
  wfhHoursBy(): Record<PersonId, number> {
    const by: Record<PersonId, number> = Object.fromEntries(this.people.map((o) => [o, 0]));
    for (const r of this.rowsIn("s07a"))
      if (r.owner && this.applies("s07", r.owner) && this.wfhUse(r) !== "business") by[r.owner] = (by[r.owner] ?? 0) + n(r.hours);
    return by;
  }
  wfhTotals(scope: PersonId[] = this.people) {
    const rows = this.rowsIn("s07a").filter((r) => this.inScope(r, scope) && this.applies("s07", r.owner ?? undefined));
    const by: Record<PersonId, number> = {}, byBiz: Record<PersonId, number> = {};
    for (const o of this.people) { by[o] = 0; byBiz[o] = 0; }
    let hours = 0, bizHours = 0;
    for (const r of rows) {
      const h = n(r.hours), o = r.owner ?? this.people[0]!;
      if (this.wfhUse(r) === "business") { byBiz[o] = (byBiz[o] ?? 0) + h; bizHours += h; }
      else { by[o] = (by[o] ?? 0) + h; hours += h; }
    }
    const rate = this.wfhRate();
    return { hours, by, rate, claim: toCents(hours * rate), bizHours, byBiz, bizClaim: toCents(bizHours * rate), rows };
  }

  // ---------- work-related deductions (D2–D10) ----------
  deductionEntries(scope: PersonId[] = this.people) {
    if (!this.applies("s07")) return [];
    const hrs = this.wfhHoursBy(), threshold = toCents(rate("imm300", this.fy));
    const out: { r: Row; o: PersonId; share: number; portion: Cents; gst: Cents; depr: boolean; overlap: boolean }[] = [];
    for (const r of this.rowsIn("s07")) for (const o of scope) {
      const share = this.shareOf(r, o);
      if (share <= 0 || !this.applies("s07", o)) continue;
      const portion = Math.round(r.amount * share);
      out.push({ r, o, share, portion, gst: r.noGst ? 0 : Math.round(r.gst * share), depr: r.category === TOOLS_CAT && portion > threshold,   // F1: the $300 test is for assets only
        overlap: r.category === PHONE_CAT && (hrs[o] ?? 0) > 0 });
    }
    return out;
  }
  deductionTotals(scope: PersonId[] = this.people) {
    const zero = () => Object.fromEntries(this.people.map((o) => [o, 0])) as Record<PersonId, Cents>;
    const t = { outright: zero(), deprBy: zero(), overlapBy: zero(), total: 0, deprTotal: 0, missing: 0,
      depr: [] as ReturnType<Engine["deductionEntries"]>, entries: [] as ReturnType<Engine["deductionEntries"]>,
      overlap: [] as ReturnType<Engine["deductionEntries"]> };
    const seenMissing = new Set<string>();
    for (const e of this.deductionEntries(scope)) {
      if (e.depr) { t.depr.push(e); t.deprBy[e.o]! += e.portion; t.deprTotal += e.portion; continue; }
      t.entries.push(e);
      if (e.overlap) { t.overlap.push(e); t.overlapBy[e.o]! += e.portion; continue; }   // already inside the fixed rate
      t.outright[e.o]! += e.portion; t.total += e.portion;
      if (!e.r.evidenced && !seenMissing.has(e.r.id)) { seenMissing.add(e.r.id); t.missing++; }
    }
    return t;
  }

  // ---------- business (item 15 / P8) ----------
  private assetCost(r: Row): Cents { return r.amount - (r.noGst || !this.gstRegistered(r.owner ?? "") ? 0 : r.gst); }
  businessTotals(scope: PersonId[] = this.people) {
    const rows = this.rowsIn("s05").filter((r) => r.owner != null && scope.includes(r.owner));
    const t = { sales: 0, gstOnSales: 0, gstOnPurchases: 0, expenses: 0, unpaidIncome: 0, rows,
      pool: [] as Row[], poolTotal: 0, psiDenied: [] as Row[], psiDeniedTotal: 0, homeOffice: 0, homeHours: 0 };
    const wfh = this.wfhRate();
    for (const r of this.rowsIn("s07a")) {
      if (this.wfhUse(r) !== "business" || r.owner == null || !scope.includes(r.owner) || !this.applies("s07", r.owner)) continue;
      t.homeHours += n(r.hours); t.homeOffice += toCents(n(r.hours) * wfh);
    }
    t.expenses += t.homeOffice;   // fixed-rate running costs: no GST credit, still deductible under the PSI rules
    const iawo = toCents(rate("iawo", this.fy));
    for (const r of rows) {
      const gst = r.noGst ? 0 : r.gst;
      if (r.direction === "income") {
        if (this.notYetDerived(r)) { t.unpaidIncome += r.amount - gst; continue; }
        t.sales += r.amount - gst;   // income tax figures exclude GST; the BAS picks the GST up
        t.gstOnSales += gst;
        continue;
      }
      const p = pct(r.apportion) / 100, reg = this.gstRegistered(r.owner!);
      const exp = Math.round((reg ? r.amount - gst : r.amount) * p);   // not registered: GST is part of the cost
      if (reg) t.gstOnPurchases += Math.round(gst * p);
      if (r.bizCategory === ASSET_CAT && this.assetCost(r) >= iawo) { t.pool.push(r); t.poolTotal += exp; continue; }
      if (r.bizCategory && PSI_DENIED.includes(r.bizCategory) && this.psi(r.owner!) === "applies") {
        t.psiDenied.push(r); t.psiDeniedTotal += exp; continue;
      }
      t.expenses += exp;
    }
    return t;
  }

  // ---------- BAS (always one ABN holder) ----------
  quarterBAS(q: Quarter, o: PersonId) {
    const t = { q, sales: 0, gstOnSales: 0, gstOnPurchases: 0, net: 0, count: 0, unsubstantiated: 0 };
    if (!this.gstRegistered(o)) return t;
    const taxInv = toCents(rate("taxInv", this.fy));
    for (const r of this.ledger.rows) {
      if (r.section !== "s05" || r.owner !== o) continue;
      const bd = this.basDate(r);
      if (!bd || bd < q.start || bd > q.end) continue;
      t.count++;
      const gst = r.noGst ? 0 : r.gst;
      if (r.direction === "income") { t.sales += r.amount; t.gstOnSales += gst; continue; }
      const p = pct(r.apportion) / 100, credit = Math.round(gst * p);
      t.gstOnPurchases += credit;
      if (r.amount > taxInv && !r.evidenced && gst > 0) t.unsubstantiated += credit;
    }
    t.net = t.gstOnSales - t.gstOnPurchases;
    return t;
  }

  // ---------- data-driven schedules ----------
  scheduleEntries(id: SectionId, scope: PersonId[] = this.people) {
    const out: { r: Row; o: PersonId; share: number }[] = [];
    for (const r of this.rowsIn(id)) for (const o of scope) {
      if (!this.applies(id, o)) continue;
      const share = this.shareOf(r, o);
      if (share > 0) out.push({ r, o, share });
    }
    return out;
  }
  scheduleTotals(id: SectionId, scope: PersonId[] = this.people) {
    const g = SCHEDULES[id] as Schedule, es = this.scheduleEntries(id, scope), ctx = { carRate: this.carRate() };
    const moneyKeys = g.fields.filter((f) => f.t === "money").map((f) => f.k);
    const numKeys = g.fields.filter((f) => f.t === "num").map((f) => f.k);
    const calcKeys = (g.cols ?? []).map((c) => c.k);
    const sums: Record<string, number> = {};
    const by: Record<PersonId, Record<string, number>> = Object.fromEntries(this.people.map((o) => [o, {}]));
    for (const k of [...moneyKeys, ...numKeys, ...calcKeys]) { sums[k] = 0; for (const o of this.people) by[o]![k] = 0; }
    const add = (k: string, o: PersonId, v: number) => { sums[k]! += v; by[o]![k]! += v; };
    let count = 0, ok = 0, missing = 0, net = 0;
    const seen = new Set<string>();
    for (const e of es) {
      const d = (e.r.details ?? {}) as Record<string, unknown>;
      const c = g.calc ? g.calc(d, e.r.date, ctx) : {};
      if (!seen.has(e.r.id)) { seen.add(e.r.id); count++; if (g.doc && !e.r.evidenced) missing++; }
      const counts = !g.rowOk || g.rowOk(d);
      if (counts) ok++;
      if (!g.tax.onlyOk || counts) {
        for (const k of moneyKeys) add(k, e.o, Math.round(n(d[k]) * e.share));
        for (const k of numKeys) add(k, e.o, n(d[k]) * e.share);
      }
      for (const k of calcKeys) add(k, e.o, Math.round(n(c[k]) * e.share));
      if (g.net) { const v = Math.round(n(d[g.net.k]) * e.share); net += g.net.plus(d) ? v : -v; }
    }
    const extra = g.total ? g.total(es.map((e) => ({ d: (e.r.details ?? {}) as Record<string, unknown>, share: e.share })), ctx) : {};
    // `net` is rent's signed net; for capital gains it is the after-discount column of the same name
    if (!g.net) net = n(sums.net);
    return { values: { ...sums, ...extra } as Record<string, number | boolean>, by, count, ok, missing, net, entries: es };
  }
  /** The one number a schedule contributes (to the nav and the return). */
  scheduleMain(id: SectionId, scope: PersonId[] = this.people): Cents {
    const g = SCHEDULES[id] as Schedule, t = this.scheduleTotals(id, scope), v = t.values;
    if (g.tax.cgt) return n(v[g.tax.cgt]);
    if (g.tax.rentNet) return t.net;
    if (g.tax.ded) return n(v[g.tax.ded]);
    if (g.tax.phi) return n(v.premiums);
    if (g.tax.income) return g.tax.income.reduce((a, k) => a + n(v[k]), 0);
    return 0;
  }

  /** The figure shown against a section in the nav, or null when it has nothing to show. */
  sectionTotal(section: SectionId | "s07b", scope: PersonId[] = this.people): Cents | null {
    if (section === "s07") return this.deductionTotals(scope).total + this.wfhTotals(scope).claim;
    if (section === "s07a") { const w = this.wfhTotals(scope); return w.claim + w.bizClaim; }
    if (section === "s07b") return this.deductionTotals(scope).deprTotal;
    if (section === "s05") { const b = this.businessTotals(scope); return b.sales - b.expenses; }
    if (section in SCHEDULES) return this.rowsIn(section).length ? this.scheduleMain(section, scope) : null;
    return null;
  }

  // ---------- lodgment and locks ----------
  basRecord(o: PersonId, i: number, fy: FY = this.fy): Lodgment | null { return this.ledger.settings.bas?.[`${fy}:${o}:q${i + 1}`] ?? null; }
  returnRecord(o: PersonId, fy: FY = this.fy): Lodgment | null { return this.ledger.settings.returns?.[`${fy}:${o}`] ?? null; }
  lockContext(): LockContext {
    const s = this.ledger.settings;
    return {
      people: this.people,
      incomeBasis: (o) => abnOf(s, o).incomeBasis,
      gstBasis: (o) => abnOf(s, o).gstBasis,
      basStatus: (o, fy, q) => s.bas?.[`${fy}:${o}:q${q}`]?.status ?? null,
      returnStatus: (o, fy) => s.returns?.[`${fy}:${o}`]?.status ?? null,
    };
  }
  /** The lodged BAS quarter or return that makes a row read-only, if any. */
  lockOf(r: Pick<Row, "section" | "date" | "paid" | "owner" | "direction">): Lock | null {
    return lockOf({ section: r.section, date: r.date, paid: r.paid, owner: r.owner, direction: r.direction }, this.lockContext());
  }
  lockReason(r: Pick<Row, "section" | "date" | "paid" | "owner" | "direction">): string | null {
    const l = this.lockOf(r);
    return l ? lockReason(l) : null;
  }
  /** Figures saved when a BAS quarter is marked lodged. */
  basFigures(o: PersonId, i: number) {
    const t = this.quarterBAS(this.quarters[i]!, o);
    return { sales: t.sales, gstOnSales: t.gstOnSales, gstOnPurchases: t.gstOnPurchases, net: t.net };
  }
  /** Figures saved when a return is marked lodged. */
  returnFigures(o: PersonId) {
    const f = this.taxFigures(o);
    return { assessable: f.assessable, deductions: f.deductions, taxable: f.taxable, paid: f.withheld + f.payg };
  }

  // ---------- one person's return ----------
  paygFor(i: number, o: PersonId): Cents { return this.ledger.settings.payg[`${this.fy}:${o}:q${i + 1}`] ?? 0; }

  taxFigures(o: PersonId) {
    const scope = [o];
    const f = { o, income: 0, withheld: 0, offsets: 0, rfb: 0, resc: 0, sg: 0, superClaim: 0, cgt: 0, rentNet: 0, otherDed: 0,
      phi: null as null | { premiums: Cents; rebate: Cents; days: number }, superOk: 0, superPending: 0,
      workDed: 0, business: 0, businessLoss: 0, cgtNet: 0, rentIn: 0, assessable: 0, deductions: 0, taxable: 0,
      investLoss: 0, testIncome: 0, concessional: 0, ccCap: 0, ccCarry: 0, ccRoom: 0, payg: 0 };
    for (const id of Object.keys(SCHEDULES) as SectionId[]) {
      const g = SCHEDULES[id] as Schedule, t = this.scheduleTotals(id, scope), v = t.values;
      const sum = (ks?: string[]) => (ks ?? []).reduce((a, k) => a + n(v[k]), 0);
      f.income += sum(g.tax.income); f.withheld += sum(g.tax.withheld); f.offsets += sum(g.tax.offsets);
      f.rfb += sum(g.tax.rfb); f.resc += sum(g.tax.resc); f.sg += sum(g.tax.sg);
      if (g.tax.cgt) f.cgt += n(v[g.tax.cgt]);
      if (g.tax.rentNet) f.rentNet += t.net;
      if (g.tax.ded) f.otherDed += n(v[g.tax.ded]);
      if (g.tax.phi && t.count) f.phi = { premiums: n(v.premiums), rebate: n(v.rebate), days: n(v.days) };
      if (id === "d12") { f.superClaim = n(v.amount); f.superOk = t.ok; f.superPending = t.count - t.ok; }
    }
    const d = this.deductionTotals(scope), w = this.wfhTotals(scope), b = this.businessTotals(scope);
    f.workDed = d.total + w.claim;
    const bn = this.abnHolders(scope).length ? b.sales - b.expenses : 0;
    f.business = Math.max(0, bn); f.businessLoss = Math.max(0, -bn);   // a loss is deferred unless a non-commercial loss test is passed
    f.cgtNet = Math.max(0, f.cgt);
    f.rentIn = Math.max(0, f.rentNet);
    f.assessable = f.income + f.business + f.cgtNet + f.rentIn;
    f.deductions = f.workDed + f.otherDed;
    f.taxable = Math.max(0, f.assessable - f.deductions);
    f.investLoss = Math.max(0, -f.rentNet);
    f.testIncome = f.taxable + f.rfb + f.resc + f.investLoss;   // income for surcharge / rebate purposes
    f.concessional = f.sg + f.resc + f.superClaim;
    f.ccCap = toCents(rate("ccCap", this.fy));
    f.ccCarry = this.ledger.settings.ccCarry[`${this.fy}:${o}`] ?? 0;
    f.ccRoom = f.ccCap + f.ccCarry - f.concessional;
    f.payg = this.quarters.reduce((a, _q, i) => a + this.paygFor(i, o), 0);
    return f;
  }

  /**
   * The subtotals behind a person's return lines, by schedule and by deduction category. Presentation only:
   * `income` adds up to taxFigures().income, `work` to .workDed and `other` to .otherDed.
   */
  taxBreakdown(o: PersonId) {
    const scope = [o];
    const income: { id: SectionId; cents: Cents }[] = [], other: { id: SectionId; cents: Cents }[] = [];
    for (const id of Object.keys(SCHEDULES) as SectionId[]) {
      const g = SCHEDULES[id] as Schedule, v = this.scheduleTotals(id, scope).values;
      const inc = (g.tax.income ?? []).reduce((a, k) => a + n(v[k]), 0);
      if (inc) income.push({ id, cents: inc });
      const ded = g.tax.ded ? n(v[g.tax.ded]) : 0;
      if (ded) other.push({ id, cents: ded });
    }
    const byCat = new Map<string, Cents>();
    for (const e of this.deductionTotals(scope).entries) {
      if (e.overlap) continue;   // already inside the working-from-home fixed rate
      const c = e.r.category || "Other work-related";
      byCat.set(c, (byCat.get(c) ?? 0) + e.portion);
    }
    const w = this.wfhTotals(scope);
    if (w.claim) byCat.set("Working from home — fixed rate", (byCat.get("Working from home — fixed rate") ?? 0) + w.claim);
    const work = [...byCat].map(([category, cents]) => ({ category, cents })).sort((a, b) => a.category.localeCompare(b.category));
    return { income, work, other };
  }
}
