import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { emptySettings, exampleLedger, type Ledger, type Row, type SectionId } from "@workpapers/core";
import type { RecordModel } from "pocketbase";
import { pb } from "./pb";

export type DataMode = "ours" | "example";

const day = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : "");
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));

/** What the app keeps about a stored row beyond what the engine needs. */
export interface StoredRow extends Row {
  files: string[];
  evidenceTick: boolean;
  record: RecordModel;
}

/** A PocketBase `rows` record → an engine row. People are referred to by name inside the engine. */
function toRow(r: RecordModel, nameOf: Map<string, string>): StoredRow {
  const owner = r["shared"] ? null : nameOf.get(r["owner"] as string) ?? null;
  return {
    id: r.id,
    section: r["section"] as SectionId,
    date: day(r["date"]),
    paid: r["section"] === "s05" ? day(r["paid"]) : undefined,
    owner,
    sharePct: owner == null ? num(r["share_pct"]) ?? 50 : undefined,
    amount: Number(r["amount_cents"]) || 0,
    gst: Number(r["gst_cents"]) || 0,
    noGst: !!r["no_gst"],
    direction: (r["direction"] || undefined) as Row["direction"],
    apportion: r["direction"] === "expense" ? num(r["apportion"]) : undefined,
    category: (r["category"] as string) || undefined,
    bizCategory: (r["biz_category"] as string) || undefined,
    use: (r["use"] || undefined) as Row["use"],
    hours: num(r["hours"]),
    party: (r["party"] as string) || undefined,
    description: (r["description"] as string) || undefined,
    evidenced: ((r["files"] as string[]) ?? []).length > 0 || !!r["evidence_tick"],
    details: (r["details"] as Record<string, unknown>) ?? undefined,
    files: (r["files"] as string[]) ?? [],
    evidenceTick: !!r["evidence_tick"],
    record: r,
  };
}

/** PocketBase ids of the settings records, so Setup, BAS and the return can update them in place. */
export interface RecordIds {
  year?: string;                          // year_settings for the viewed year
  abn: Record<string, string>;            // person name → abn_settings id for the viewed year
  personYear: Record<string, string>;     // person name → person_year id for the viewed year
  bas: Record<string, string>;            // "fy:person:qN" → bas_quarters id
  returns: Record<string, string>;        // "fy:person" → returns id
}
export interface LockEvent { kind: "bas" | "return"; target: string; action: string; reason: string; by: string; at: string }

export interface LoadedLedger {
  ledger: Ledger;
  peopleIds: Record<string, string>;
  editable: boolean;
  ids: RecordIds;
  events: LockEvent[];
  yearSettings: { mlsOverride?: number; checks: Record<string, boolean> };
}

async function loadOurs(fy: number): Promise<LoadedLedger> {
  const people = await pb.collection("people").getFullList({ sort: "sort" });
  const nameOf = new Map(people.map((p) => [p.id, p["name"] as string]));
  const [rows, abn, years, personYears, quarters, returns, events, users] = await Promise.all([
    pb.collection("rows").getFullList(),
    pb.collection("abn_settings").getFullList({ sort: "fy" }),
    pb.collection("year_settings").getFullList(),
    pb.collection("person_year").getFullList(),
    pb.collection("bas_quarters").getFullList(),
    pb.collection("returns").getFullList(),
    pb.collection("lock_events").getFullList({ sort: "-created" }),
    pb.collection("users").getFullList().catch(() => [] as RecordModel[]),
  ]);
  const settings = emptySettings();
  const ids: RecordIds = { abn: {}, personYear: {}, bas: {}, returns: {} };
  // ABN settings carry forward: this year's record, else the latest earlier one.
  for (const a of abn) {
    const o = nameOf.get(a["person"] as string), afy = a["fy"] as number;
    if (!o || afy > fy) continue;
    settings.abn[o] = { gstRegistered: a["gst_registered"] !== false, gstBasis: a["gst_basis"] || "cash", incomeBasis: a["income_basis"] || "receipts" };
    if (a["psi"]) settings.psi[`${afy}:${o}`] = a["psi"];
    if (afy === fy) ids.abn[o] = a.id;
  }
  let yearSettings: LoadedLedger["yearSettings"] = { checks: {} };
  for (const y of years) {
    // Stored as "personId:section" per person; a bare "section" is an older answer for the whole household.
    const applies = (y["applies"] ?? {}) as Record<string, boolean>;
    for (const [k, v] of Object.entries(applies)) {
      const [pid, sec] = k.includes(":") ? k.split(":") : [null, k];
      if (pid == null) settings.applies[`${y["fy"]}:${sec}`] = v;
      else if (nameOf.has(pid)) settings.applies[`${y["fy"]}:${nameOf.get(pid)}:${sec}`] = v;
    }
    const ro = (y["rate_overrides"] ?? {}) as Record<string, number>;
    if (Object.keys(ro).length || y["mls_override"]) settings.rateOverrides[y["fy"] as number] = { ...ro, ...(y["mls_override"] ? { mlsFamily: y["mls_override"] as number } : {}) };
    if (y["fy"] === fy) { ids.year = y.id; yearSettings = { mlsOverride: (y["mls_override"] as number) || undefined, checks: (y["checks"] as Record<string, boolean>) ?? {} }; }
  }
  for (const p of personYears) {
    const o = nameOf.get(p["person"] as string), pfy = p["fy"] as number;
    if (!o) continue;
    if (p["cc_carry_cents"]) settings.ccCarry[`${pfy}:${o}`] = p["cc_carry_cents"];
    if (p["help_balance_cents"]) settings.help[`${pfy}:${o}`] = p["help_balance_cents"];
    if (pfy === fy) ids.personYear[o] = p.id;
  }
  for (const q of quarters) {
    const o = nameOf.get(q["person"] as string);
    if (!o) continue;
    const k = `${q["fy"]}:${o}:q${q["q"]}`;
    ids.bas[k] = q.id;
    if (q["payg_cents"]) settings.payg[k] = q["payg_cents"];
    settings.bas[k] = { status: q["status"], figures: q["figures"] ?? null, lodgedOn: day(q["lodged_on"]) || undefined };
  }
  for (const r of returns) {
    const o = nameOf.get(r["person"] as string);
    if (!o) continue;
    const k = `${r["fy"]}:${o}`;
    ids.returns[k] = r.id;
    settings.returns[k] = { status: r["status"], figures: r["figures"] ?? null, lodgedOn: day(r["lodged_on"]) || undefined };
  }
  const userName = new Map(users.map((u) => [u.id, (u["name"] as string) || (u["email"] as string)]));
  return {
    ledger: { people: people.map((p) => p["name"] as string), rows: rows.map((r) => toRow(r, nameOf)), settings },
    peopleIds: Object.fromEntries(people.map((p) => [p["name"] as string, p.id])),
    editable: true,
    ids,
    events: events.map((ev) => ({ kind: ev["kind"], target: ev["target"], action: ev["action"], reason: ev["reason"] ?? "",
      by: userName.get(ev["by"] as string) ?? "", at: ev["created"] ? new Date(String(ev["created"]).replace(" ", "T")).toLocaleDateString("en-CA") : "" })),
    yearSettings,
  };
}

/** The ledger for a year: our records from PocketBase, or the made-up example year (never saved). */
export function useLedger(mode: DataMode, fy: number, people: string[], enabled = true) {
  return useQuery({
    queryKey: ["ledger", mode, fy, people.join("|")],
    queryFn: async (): Promise<LoadedLedger> =>
      mode === "example"
        ? { ledger: exampleLedger([people[0] ?? "Person A", people[1] ?? "Person B"], fy), peopleIds: {}, editable: false,
            ids: { abn: {}, personYear: {}, bas: {}, returns: {} }, events: [], yearSettings: { checks: {} } }
        : loadOurs(fy),
    staleTime: mode === "example" ? Infinity : 10_000,
    enabled,
  });
}

/** Refresh when anyone changes a row or a setting (the other person, another device). */
export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => void qc.invalidateQueries({ queryKey: ["ledger", "ours"] });
    const names = ["rows", "abn_settings", "year_settings", "person_year", "bas_quarters", "returns", "lock_events"];
    const subs = names.map((n) => pb.collection(n).subscribe("*", refresh).catch(() => () => Promise.resolve()));
    return () => { subs.forEach((s) => s.then((unsub) => unsub()).catch(() => {})); };
  }, [enabled, qc]);
}
