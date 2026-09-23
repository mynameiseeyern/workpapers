// Shared helpers for hooks. PocketBase runs each handler in its own scope, so handlers load this with require().
module.exports = {
  AUDITED: ["rows", "year_settings", "abn_settings", "person_year", "bas_quarters", "returns"],
  write(app, e, action, before) {
    const col = app.findCollectionByNameOrId("audit");
    const a = new Record(col);
    a.set("collection_name", e.record.collection().name);
    a.set("record", e.record.id);
    a.set("action", action);
    if (before) a.set("before", before);
    if (action !== "delete") a.set("after", e.record.publicExport());
    a.set("by", e.auth ? e.auth.id : "");
    app.save(a);
  },
  stampRow(e, creating) {
    const uid = e.auth ? e.auth.id : "";
    if (creating) e.record.set("created_by", uid);
    e.record.set("updated_by", uid);
    const files = e.record.get("files");
    e.record.set("evidenced", (Array.isArray(files) ? files.length : 0) > 0 || e.record.getBool("evidence_tick"));
  },
};
