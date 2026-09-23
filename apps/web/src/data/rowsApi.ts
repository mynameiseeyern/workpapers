import { SCHEDULES, toCents, type SectionId } from "@workpapers/core";
import type { RecordModel } from "pocketbase";
import type { StoredRow } from "./ledger";
import { pb } from "./pb";

/** What the entry form edits. Money is typed in dollars as text so half-typed values don't jump around. */
export interface Draft {
  id?: string;
  section: SectionId;
  owner: string;            // a person's name, or "Shared"
  sharePct: string;         // first person's %, when shared
  date: string;
  unpaid: boolean;          // business only
  paid: string;             // business only
  party: string;
  description: string;
  amount: string;
  gst: string;
  noGst: boolean;
  direction: "income" | "expense";
  apportion: string;
  category: string;
  bizCategory: string;
  use: "work" | "business";
  hours: string;
  details: Record<string, string | boolean>;
  evidenceTick: boolean;
  keepFiles: string[];
  newFiles: File[];
}
export const SHARED = "Shared";

const dollars = (c: unknown) => (typeof c === "number" && c ? (c / 100).toFixed(2) : "");

export function blankDraft(section: SectionId, owner: string, date: string): Draft {
  return {
    section, owner, sharePct: "50", date, unpaid: false, paid: date, party: "", description: "", amount: "", gst: "", noGst: false,
    direction: "expense", apportion: "100", category: "", bizCategory: "All other expenses", use: "work", hours: "",
    details: {}, evidenceTick: false, keepFiles: [], newFiles: [],
  };
}

export function draftFrom(r: StoredRow): Draft {
  const g = SCHEDULES[r.section];
  const details: Record<string, string | boolean> = {};
  for (const f of g?.fields ?? []) {
    const v = r.details?.[f.k];
    details[f.k] = f.t === "money" ? dollars(v) : f.t === "check" ? !!v : v == null ? "" : String(v);
  }
  return {
    id: r.id, section: r.section, owner: r.owner ?? SHARED, sharePct: String(r.sharePct ?? 50), date: r.date,
    unpaid: r.paid === "", paid: r.paid || r.date, party: r.party ?? "", description: r.description ?? "",
    amount: dollars(r.amount), gst: dollars(r.gst), noGst: r.noGst, direction: r.direction ?? "expense",
    apportion: String(r.apportion ?? 100), category: r.category ?? "", bizCategory: r.bizCategory ?? "All other expenses",
    use: r.use ?? "work", hours: r.hours != null ? String(r.hours) : "", details, evidenceTick: r.evidenceTick,
    keepFiles: [...r.files], newFiles: [],
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[$,\s]/g, "")));

/** Checks a draft. Returns field → message for anything that needs fixing. */
export function validate(d: Draft, years: number[]): Record<string, string> {
  const e: Record<string, string> = {};
  const fyOfDate = (x: string) => (Number(x.slice(5, 7)) >= 7 ? Number(x.slice(0, 4)) + 1 : Number(x.slice(0, 4)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = "Pick a date";
  else if (!years.includes(fyOfDate(d.date))) e.date = "Date is outside the years kept here";
  const money = (k: "amount" | "gst", required: boolean) => {
    const v = num(d[k]);
    if (Number.isNaN(v)) { if (required) e[k] = "Enter an amount"; return; }
    if (v < 0) e[k] = "Can't be negative";
  };
  if (d.owner === SHARED) {
    const p = num(d.sharePct);
    if (Number.isNaN(p) || p < 0 || p > 100) e.sharePct = "0 to 100";
  }
  const g = SCHEDULES[d.section];
  if (g) {
    for (const f of g.fields) {
      const v = d.details[f.k];
      if (f.t === "money" || f.t === "num") {
        const n = num(String(v ?? ""));
        if (Number.isNaN(n)) { if (f.req) e[`details.${f.k}`] = "Required"; }
        else if (n < 0) e[`details.${f.k}`] = "Can't be negative";
      } else if (f.req && f.t !== "check" && !String(v ?? "").trim()) e[`details.${f.k}`] = "Required";
    }
    return e;
  }
  if (d.section === "s07a") {
    const h = num(d.hours);
    if (Number.isNaN(h) || h <= 0) e.hours = "Hours worked from home";
    return e;
  }
  if (d.section === "s08") { if (!d.description.trim()) e.description = "Write the note"; return e; }
  money("amount", true);
  if (!d.noGst) money("gst", false);
  if (!Number.isNaN(num(d.gst)) && !Number.isNaN(num(d.amount)) && num(d.gst) > num(d.amount)) e.gst = "GST can't be more than the amount";
  if (d.section === "s05") {
    const a = num(d.apportion);
    if (d.direction === "expense" && (Number.isNaN(a) || a < 0 || a > 100)) e.apportion = "0 to 100";
    if (!d.unpaid && !/^\d{4}-\d{2}-\d{2}$/.test(d.paid)) e.paid = "When was it paid?";
  }
  if (!d.party.trim() && !d.description.trim()) e.party = "Who was it with, or what was it for?";
  return e;
}

/** Draft → the PocketBase record body (multipart when files are attached). */
function body(d: Draft, peopleIds: Record<string, string>): FormData {
  const f = new FormData();
  const set = (k: string, v: unknown) => f.append(k, v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const shared = d.owner === SHARED;
  set("section", d.section);
  set("date", d.date);
  set("shared", shared);
  set("owner", shared ? "" : peopleIds[d.owner] ?? "");
  set("share_pct", shared ? num(d.sharePct) : "");
  set("party", d.party.trim());
  set("description", d.description.trim());
  set("evidence_tick", d.evidenceTick);
  const g = SCHEDULES[d.section];
  if (g) {
    const details: Record<string, unknown> = {};
    for (const fl of g.fields) {
      const v = d.details[fl.k];
      if (fl.t === "money") details[fl.k] = Number.isNaN(num(String(v ?? ""))) ? 0 : toCents(num(String(v)));
      else if (fl.t === "num") details[fl.k] = Number.isNaN(num(String(v ?? ""))) ? 0 : num(String(v));
      else if (fl.t === "check") details[fl.k] = !!v;
      else details[fl.k] = String(v ?? "").trim();
    }
    set("details", details);
    set("party", String(details.party ?? ""));
    set("amount_cents", 0); set("gst_cents", 0);
  } else if (d.section === "s07a") {
    set("hours", num(d.hours)); set("use", d.use); set("amount_cents", 0); set("gst_cents", 0);
  } else if (d.section !== "s08") {
    set("amount_cents", toCents(num(d.amount)));
    set("gst_cents", d.noGst || Number.isNaN(num(d.gst)) ? 0 : toCents(num(d.gst)));
    set("no_gst", d.noGst);
    if (d.section === "s07") set("category", d.category);
    if (d.section === "s05") {
      set("direction", d.direction);
      set("paid", d.unpaid ? "" : d.paid);
      if (d.direction === "expense") { set("biz_category", d.bizCategory); set("apportion", num(d.apportion)); }
      else { set("biz_category", ""); set("apportion", ""); }
    }
  }
  for (const file of d.newFiles) f.append("files+", file);
  return f;
}

export async function saveDraft(d: Draft, peopleIds: Record<string, string>, removed: string[]): Promise<RecordModel> {
  const f = body(d, peopleIds);
  for (const name of removed) f.append("files-", name);
  return d.id ? pb.collection("rows").update(d.id, f) : pb.collection("rows").create(f);
}

/** Delete, returning a function that puts the row back (same id; attached files can't be restored). */
export async function deleteRow(r: StoredRow): Promise<() => Promise<void>> {
  const snapshot = { ...r.record };
  await pb.collection("rows").delete(r.id);
  return async () => {
    const keep = ["id", "section", "date", "paid", "owner", "shared", "share_pct", "party", "description", "amount_cents", "gst_cents",
      "no_gst", "direction", "apportion", "category", "biz_category", "use", "hours", "details", "evidence_tick"];
    const data = Object.fromEntries(keep.map((k) => [k, snapshot[k]]));
    await pb.collection("rows").create(data);
  };
}

export const fileUrl = (r: StoredRow, name: string, thumb?: string) =>
  pb.files.getURL(r.record, name, thumb ? { thumb } : undefined);
