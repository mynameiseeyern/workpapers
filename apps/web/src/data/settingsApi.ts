import type { SectionId } from "@workpapers/core";
import type { RecordModel } from "pocketbase";
import type { LoadedLedger } from "./ledger";
import { pb } from "./pb";

const todayISO = () => new Date().toLocaleDateString("en-CA");

/**
 * Settings saves run one at a time, in the order they were asked for, and each one looks at the record as it is
 * on the server right now rather than as this screen last loaded it. Otherwise a second change made before the
 * first has come back is built on old data and silently undoes the first.
 */
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(f: () => Promise<T>): Promise<T> {
  const next = queue.then(f, f);
  queue = next.catch(() => undefined);
  return next;
}

async function onServer(collection: string, filter: string): Promise<RecordModel | undefined> {
  try { return await pb.collection(collection).getFirstListItem(filter); }
  catch (x) { if ((x as { status?: number }).status === 404) return undefined; throw x; }
}
const yearIs = (fy: number) => pb.filter("fy = {:fy}", { fy });
const personYearIs = (person: string | undefined, fy: number) => pb.filter("person = {:person} && fy = {:fy}", { person: person ?? "", fy });

/** Update the record that matches, or create it if there isn't one yet. `create` holds what only a new record needs. */
function upsert(collection: string, filter: string, data: Record<string, unknown>, create: Record<string, unknown> = {}) {
  return inTurn(async () => {
    const r = await onServer(collection, filter);
    return r ? pb.collection(collection).update(r.id, data) : pb.collection(collection).create({ ...create, ...data });
  });
}

/**
 * Say whether a schedule applies to some people in a year (true / false), or clear the answer (null).
 * Answers are stored per person as "personId:section". An older household-wide answer ("section") is
 * copied onto each person the first time anyone changes that section, so the other person's answer stays put.
 */
export function setApplies(L: LoadedLedger, fy: number, people: string[], updates: Partial<Record<SectionId, boolean | null>>) {
  return inTurn(async () => {
    const idOf = L.peopleIds, everyone = Object.keys(idOf);
    const record = await onServer("year_settings", yearIs(fy));
    const answers = { ...((record?.["applies"] ?? {}) as Record<string, boolean>) };
    for (const [sec, v] of Object.entries(updates)) {
      if (sec in answers) {   // split an older household answer into per-person answers
        for (const o of everyone) if (!(`${idOf[o]}:${sec}` in answers)) answers[`${idOf[o]}:${sec}`] = answers[sec]!;
        delete answers[sec];
      }
      for (const o of people) { const k = `${idOf[o]}:${sec}`; if (v == null) delete answers[k]; else answers[k] = v; }
    }
    return record ? pb.collection("year_settings").update(record.id, { applies: answers })
      : pb.collection("year_settings").create({ fy, applies: answers });
  });
}

export function saveRates(_L: LoadedLedger, fy: number, rates: { wfh?: number; car?: number }, mlsOverride?: number) {
  return upsert("year_settings", yearIs(fy), { fy, rate_overrides: rates, mls_override: mlsOverride ?? null });
}

export function saveChecks(_L: LoadedLedger, fy: number, checks: Record<string, boolean>) {
  return upsert("year_settings", yearIs(fy), { fy, checks });
}

export function saveAbn(L: LoadedLedger, fy: number, person: string,
  v: { gstRegistered: boolean; gstBasis: string; incomeBasis: string; psi: string }) {
  return upsert("abn_settings", personYearIs(L.peopleIds[person], fy), {
    person: L.peopleIds[person], fy, gst_registered: v.gstRegistered, gst_basis: v.gstBasis, income_basis: v.incomeBasis, psi: v.psi,
  });
}

export function savePersonYear(L: LoadedLedger, fy: number, person: string, v: { helpCents: number; ccCarryCents: number }) {
  return upsert("person_year", personYearIs(L.peopleIds[person], fy), {
    person: L.peopleIds[person], fy, help_balance_cents: v.helpCents, cc_carry_cents: v.ccCarryCents,
  });
}

export function savePayg(L: LoadedLedger, fy: number, person: string, q: number, cents: number) {
  const who = L.peopleIds[person];
  return upsert("bas_quarters", pb.filter("person = {:who} && fy = {:fy} && q = {:q}", { who: who ?? "", fy, q }),
    { payg_cents: cents }, { person: who, fy, q, status: "open" });
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
