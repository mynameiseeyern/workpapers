import type { SectionId } from "@workpapers/core";
import type { LoadedLedger } from "./ledger";
import { pb } from "./pb";

const todayISO = () => new Date().toLocaleDateString("en-CA");

async function upsert(collection: string, id: string | undefined, data: Record<string, unknown>) {
  return id ? pb.collection(collection).update(id, data) : pb.collection(collection).create(data);
}

/**
 * Say whether a schedule applies to some people in a year (true / false), or clear the answer (null).
 * Answers are stored per person as "personId:section". An older household-wide answer ("section") is
 * copied onto each person the first time anyone changes that section, so the other person's answer stays put.
 */
export async function setApplies(L: LoadedLedger, fy: number, people: string[], updates: Partial<Record<SectionId, boolean | null>>) {
  const idOf = L.peopleIds, current: Record<string, boolean> = {};
  const everyone = Object.keys(idOf);
  for (const [k, v] of Object.entries(L.ledger.settings.applies)) {
    const parts = k.split(":");
    if (parts[0] !== String(fy)) continue;
    if (parts.length === 2) current[parts[1]!] = v;
    else if (idOf[parts[1]!]) current[`${idOf[parts[1]!]}:${parts[2]}`] = v;
  }
  for (const [sec, v] of Object.entries(updates)) {
    if (sec in current) {   // split an older household answer into per-person answers
      for (const o of everyone) if (!(`${idOf[o]}:${sec}` in current)) current[`${idOf[o]}:${sec}`] = current[sec]!;
      delete current[sec];
    }
    for (const o of people) { const k = `${idOf[o]}:${sec}`; if (v == null) delete current[k]; else current[k] = v; }
  }
  return upsert("year_settings", L.ids.year, { fy, applies: current });
}

export async function saveRates(L: LoadedLedger, fy: number, rates: { wfh?: number; car?: number }, mlsOverride?: number) {
  return upsert("year_settings", L.ids.year, { fy, rate_overrides: rates, mls_override: mlsOverride ?? null });
}

export async function saveChecks(L: LoadedLedger, fy: number, checks: Record<string, boolean>) {
  return upsert("year_settings", L.ids.year, { fy, checks });
}

export async function saveAbn(L: LoadedLedger, fy: number, person: string,
  v: { gstRegistered: boolean; gstBasis: string; incomeBasis: string; psi: string }) {
  return upsert("abn_settings", L.ids.abn[person], {
    person: L.peopleIds[person], fy, gst_registered: v.gstRegistered, gst_basis: v.gstBasis, income_basis: v.incomeBasis, psi: v.psi,
  });
}

export async function savePersonYear(L: LoadedLedger, fy: number, person: string, v: { helpCents: number; ccCarryCents: number }) {
  return upsert("person_year", L.ids.personYear[person], {
    person: L.peopleIds[person], fy, help_balance_cents: v.helpCents, cc_carry_cents: v.ccCarryCents,
  });
}

export async function savePayg(L: LoadedLedger, fy: number, person: string, q: number, cents: number) {
  const k = `${fy}:${person}:q${q}`, id = L.ids.bas[k];
  return id ? pb.collection("bas_quarters").update(id, { payg_cents: cents })
    : pb.collection("bas_quarters").create({ person: L.peopleIds[person], fy, q, status: "open", payg_cents: cents });
}

export type LockAction = "lodged" | "reopened" | "relocked";

/**
 * Mark a BAS quarter lodged, reopen it (reason required) or re-lock it. The figures are saved as the lodged record;
 * re-locking with `figures` undefined keeps the original record (nothing changed while it was open).
 */
export async function lodgeBas(L: LoadedLedger, fy: number, person: string, q: number, action: LockAction,
  figures: Record<string, number> | undefined, reason = "") {
  const k = `${fy}:${person}:q${q}`, id = L.ids.bas[k];
  const status = action === "reopened" ? "reopened" : "lodged";
  const data: Record<string, unknown> = { status };
  if (figures) data.figures = figures;
  if (action === "lodged" || (action === "relocked" && figures)) data.lodged_on = todayISO();
  if (id) await pb.collection("bas_quarters").update(id, data);
  else await pb.collection("bas_quarters").create({ person: L.peopleIds[person], fy, q, ...data });
  await pb.collection("lock_events").create({ kind: "bas", target: k, action, reason, by: pb.authStore.record?.id ?? "" });
}

export async function lodgeReturn(L: LoadedLedger, fy: number, person: string, action: LockAction,
  figures: Record<string, number> | undefined, reason = "") {
  const k = `${fy}:${person}`, id = L.ids.returns[k];
  const status = action === "reopened" ? "reopened" : "lodged";
  const data: Record<string, unknown> = { status };
  if (figures) data.figures = figures;
  if (action === "lodged" || (action === "relocked" && figures)) data.lodged_on = todayISO();
  if (id) await pb.collection("returns").update(id, data);
  else await pb.collection("returns").create({ person: L.peopleIds[person], fy, ...data });
  await pb.collection("lock_events").create({ kind: "return", target: k, action, reason, by: pb.authStore.record?.id ?? "" });
}
