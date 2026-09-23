/// <reference path="../pb_data/types.d.ts" />
// Stamp who changed a row, derive `evidenced`, and keep an append-only audit trail.
// Lock enforcement (HLD-001 §5) lands in M3 as locks.pb.js, parity-tested against @workpapers/core.

onRecordCreateRequest((e) => {
  const uid = e.auth ? e.auth.id : "";
  e.record.set("created_by", uid);
  e.record.set("updated_by", uid);
  e.record.set("evidenced", e.record.getStringSlice("files").length > 0 || e.record.getBool("evidence_tick"));
  e.next();
}, "rows");

onRecordUpdateRequest((e) => {
  e.record.set("updated_by", e.auth ? e.auth.id : "");
  e.record.set("evidenced", e.record.getStringSlice("files").length > 0 || e.record.getBool("evidence_tick"));
  e.next();
}, "rows");

const AUDITED = ["rows", "year_settings", "abn_settings", "person_year", "bas_quarters", "returns"];
function writeAudit(e, action) {
  const col = $app.findCollectionByNameOrId("audit");
  const a = new Record(col);
  a.set("collection_name", e.record.collection().name);
  a.set("record", e.record.id);
  a.set("action", action);
  if (action !== "create") a.set("before", e.record.original().publicExport());
  if (action !== "delete") a.set("after", e.record.publicExport());
  a.set("by", e.auth ? e.auth.id : "");
  $app.save(a);
}
onRecordCreateRequest((e) => { e.next(); writeAudit(e, "create"); }, ...AUDITED);
onRecordUpdateRequest((e) => { e.next(); writeAudit(e, "update"); }, ...AUDITED);
onRecordDeleteRequest((e) => { e.next(); writeAudit(e, "delete"); }, ...AUDITED);
