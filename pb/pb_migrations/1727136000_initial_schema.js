/// <reference path="../pb_data/types.d.ts" />
// Initial schema — see docs/HLD-001 §4. Money is stored in integer cents.
const SIGNED_IN = "@request.auth.id != ''";
const rules = { listRule: SIGNED_IN, viewRule: SIGNED_IN, createRule: SIGNED_IN, updateRule: SIGNED_IN, deleteRule: SIGNED_IN };
const APPEND_ONLY = { listRule: SIGNED_IN, viewRule: SIGNED_IN, createRule: SIGNED_IN, updateRule: null, deleteRule: null };
const SECTIONS = ["i01","i10","i11","i12","i18","i20","i21","s05","d01","d03","s07","s07a","d07","d12","d15","h01","s08"];

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  // Household accounts are created by the admin only.
  users.createRule = null;
  app.save(users);

  const people = new Collection({ type: "base", name: "people", ...rules, fields: [
    { type: "text", name: "name", required: true, max: 60 },
    { type: "relation", name: "user", collectionId: users.id, maxSelect: 1 },
    { type: "number", name: "sort", onlyInt: true },
  ]});
  app.save(people);

  const rel = (name, extra = {}) => ({ type: "relation", name, collectionId: people.id, maxSelect: 1, ...extra });
  const who = (name) => ({ type: "relation", name, collectionId: users.id, maxSelect: 1 });
  const stamps = [{ type: "autodate", name: "created", onCreate: true }, { type: "autodate", name: "updated", onCreate: true, onUpdate: true }];

  app.save(new Collection({ type: "base", name: "rows", ...rules, fields: [
    { type: "select", name: "section", values: SECTIONS, maxSelect: 1, required: true },
    { type: "date", name: "date", required: true },
    { type: "text", name: "paid", max: 10 },          // "" = unpaid; missing (null) = legacy row, paid on `date`
    rel("owner"),                                        // empty when shared
    { type: "bool", name: "shared" },
    { type: "number", name: "share_pct", min: 0, max: 100 },
    { type: "text", name: "party", max: 200 },
    { type: "text", name: "description", max: 500 },
    { type: "number", name: "amount_cents", onlyInt: true },
    { type: "number", name: "gst_cents", onlyInt: true },
    { type: "bool", name: "no_gst" },
    { type: "select", name: "direction", values: ["income", "expense"], maxSelect: 1 },
    { type: "number", name: "apportion", min: 0, max: 100 },
    { type: "text", name: "category", max: 120 },
    { type: "text", name: "biz_category", max: 120 },
    { type: "select", name: "use", values: ["work", "business"], maxSelect: 1 },
    { type: "number", name: "hours", min: 0 },
    { type: "json", name: "details", maxSize: 20000 },
    { type: "file", name: "files", maxSelect: 20, maxSize: 20 * 1024 * 1024,
      mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"], thumbs: ["120x120", "480x0"] },
    { type: "bool", name: "evidence_tick" },          // legacy tick from the prototype
    { type: "bool", name: "evidenced" },              // derived by hook: files or legacy tick
    who("created_by"), who("updated_by"), ...stamps,
  ], indexes: [
    "CREATE INDEX idx_rows_section_date ON rows (section, date)",
    "CREATE INDEX idx_rows_owner ON rows (owner)",
    "CREATE INDEX idx_rows_paid ON rows (paid)",
  ]}));

  app.save(new Collection({ type: "base", name: "year_settings", ...rules, fields: [
    { type: "number", name: "fy", onlyInt: true, required: true },
    { type: "json", name: "applies" }, { type: "json", name: "rate_overrides" },
    { type: "number", name: "mls_override" }, { type: "json", name: "checks" }, ...stamps,
  ], indexes: ["CREATE UNIQUE INDEX idx_year_settings_fy ON year_settings (fy)"] }));

  app.save(new Collection({ type: "base", name: "abn_settings", ...rules, fields: [
    rel("person", { required: true }), { type: "number", name: "fy", onlyInt: true, required: true },
    { type: "bool", name: "gst_registered" },
    { type: "select", name: "gst_basis", values: ["cash", "accrual"], maxSelect: 1 },
    { type: "select", name: "income_basis", values: ["receipts", "earnings"], maxSelect: 1 },
    { type: "select", name: "psi", values: ["notpsi", "psb", "applies"], maxSelect: 1 }, ...stamps,
  ], indexes: ["CREATE UNIQUE INDEX idx_abn_person_fy ON abn_settings (person, fy)"] }));

  app.save(new Collection({ type: "base", name: "person_year", ...rules, fields: [
    rel("person", { required: true }), { type: "number", name: "fy", onlyInt: true, required: true },
    { type: "number", name: "help_balance_cents", onlyInt: true },
    { type: "number", name: "cc_carry_cents", onlyInt: true }, ...stamps,
  ], indexes: ["CREATE UNIQUE INDEX idx_person_year ON person_year (person, fy)"] }));

  const lockStatus = { type: "select", name: "status", values: ["open", "lodged", "reopened"], maxSelect: 1, required: true };
  app.save(new Collection({ type: "base", name: "bas_quarters", ...rules, deleteRule: null, fields: [
    rel("person", { required: true }), { type: "number", name: "fy", onlyInt: true, required: true },
    { type: "number", name: "q", onlyInt: true, min: 1, max: 4, required: true },
    lockStatus, { type: "json", name: "figures" }, { type: "number", name: "payg_cents", onlyInt: true },
    { type: "date", name: "lodged_on" }, ...stamps,
  ], indexes: ["CREATE UNIQUE INDEX idx_bas_q ON bas_quarters (person, fy, q)"] }));

  app.save(new Collection({ type: "base", name: "returns", ...rules, deleteRule: null, fields: [
    rel("person", { required: true }), { type: "number", name: "fy", onlyInt: true, required: true },
    lockStatus, { type: "json", name: "figures" }, { type: "date", name: "lodged_on" }, ...stamps,
  ], indexes: ["CREATE UNIQUE INDEX idx_returns ON returns (person, fy)"] }));

  app.save(new Collection({ type: "base", name: "lock_events", ...APPEND_ONLY, fields: [
    { type: "select", name: "kind", values: ["bas", "return"], maxSelect: 1, required: true },
    { type: "text", name: "target", required: true },
    { type: "select", name: "action", values: ["lodged", "reopened", "relocked"], maxSelect: 1, required: true },
    { type: "text", name: "reason", max: 500 }, who("by"), ...stamps,
  ]}));

  app.save(new Collection({ type: "base", name: "audit", ...APPEND_ONLY, createRule: null, fields: [
    { type: "text", name: "collection_name" }, { type: "text", name: "record" },
    { type: "select", name: "action", values: ["create", "update", "delete"], maxSelect: 1 },
    { type: "json", name: "before", maxSize: 200000 }, { type: "json", name: "after", maxSize: 200000 },
    who("by"), ...stamps,
  ], indexes: ["CREATE INDEX idx_audit_record ON audit (record)"] }));

  // Seed the two people (accounts are linked by the admin after creating the users).
  const pc = app.findCollectionByNameOrId("people");
  [["Ee", 1], ["Darrelle", 2]].forEach(([name, sort]) => {
    const r = new Record(pc); r.set("name", name); r.set("sort", sort); app.save(r);
  });
}, (app) => {
  ["audit", "lock_events", "returns", "bas_quarters", "person_year", "abn_settings", "year_settings", "rows", "people"]
    .forEach((n) => { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} });
});
