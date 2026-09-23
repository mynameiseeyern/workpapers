import { useQuery } from "@tanstack/react-query";
import { emptySettings, exampleLedger, type Ledger, type Row, type SectionId } from "@workpapers/core";
import type { RecordModel } from "pocketbase";
import { pb } from "./pb";

export type DataMode = "ours" | "example";

const day = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : "");
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));

/** A PocketBase `rows` record → an engine row. People are referred to by name inside the engine. */
function toRow(r: RecordModel, nameOf: Map<string, string>): Row {
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
    apportion: num(r["apportion"]),
    category: (r["category"] as string) || undefined,
    bizCategory: (r["biz_category"] as string) || undefined,
    use: (r["use"] || undefined) as Row["use"],
    hours: num(r["hours"]),
    party: (r["party"] as string) || undefined,
    description: (r["description"] as string) || undefined,
    evidenced: !!r["evidenced"],
    details: (r["details"] as Record<string, unknown>) ?? undefined,
  };
}

async function loadOurs(fy: number): Promise<Ledger> {
  const people = await pb.collection("people").getFullList({ sort: "sort" });
  const nameOf = new Map(people.map((p) => [p.id, p["name"] as string]));
  const [rows, abn, years, personYears, quarters] = await Promise.all([
    pb.collection("rows").getFullList(),
    pb.collection("abn_settings").getFullList({ filter: `fy = ${fy}` }),
    pb.collection("year_settings").getFullList(),
    pb.collection("person_year").getFullList({ filter: `fy = ${fy}` }),
    pb.collection("bas_quarters").getFullList({ filter: `fy = ${fy}` }),
  ]);
  const settings = emptySettings();
  for (const a of abn) {
    const o = nameOf.get(a["person"] as string);
    if (!o) continue;
    settings.abn[o] = { gstRegistered: a["gst_registered"] !== false, gstBasis: a["gst_basis"] || "cash", incomeBasis: a["income_basis"] || "receipts" };
    if (a["psi"]) settings.psi[`${fy}:${o}`] = a["psi"];
  }
  for (const y of years) {
    const applies = (y["applies"] ?? {}) as Record<string, boolean>;
    for (const [sec, v] of Object.entries(applies)) settings.applies[`${y["fy"]}:${sec}`] = v;
    if (y["rate_overrides"]) settings.rateOverrides[y["fy"] as number] = y["rate_overrides"];
  }
  for (const p of personYears) {
    const o = nameOf.get(p["person"] as string);
    if (o && p["cc_carry_cents"]) settings.ccCarry[`${fy}:${o}`] = p["cc_carry_cents"];
  }
  for (const q of quarters) {
    const o = nameOf.get(q["person"] as string);
    if (o && q["payg_cents"]) settings.payg[`${fy}:${o}:q${q["q"]}`] = q["payg_cents"];
  }
  return { people: people.map((p) => p["name"] as string), rows: rows.map((r) => toRow(r, nameOf)), settings };
}

/** The ledger for a year: our records from PocketBase, or the made-up example year (never saved). */
export function useLedger(mode: DataMode, fy: number, people: string[], enabled = true) {
  return useQuery({
    queryKey: ["ledger", mode, fy, people.join("|")],
    queryFn: async () => (mode === "example" ? exampleLedger([people[0] ?? "Person A", people[1] ?? "Person B"], fy) : loadOurs(fy)),
    staleTime: mode === "example" ? Infinity : 10_000,
    enabled,
  });
}
