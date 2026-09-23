/// <reference path="../pb_data/types.d.ts" />
// Stamp who changed a row, derive `evidenced`, and keep an append-only audit trail of every change.
// Handlers run in isolated scopes, so shared code lives in lib/audit.js and is loaded inside each handler.

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/audit.js`).stampRow(e, true);
  e.next();
}, "rows");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/audit.js`).stampRow(e, false);
  e.next();
}, "rows");

onRecordCreateRequest((e) => {
  e.next();
  require(`${__hooks}/lib/audit.js`).write($app, e, "create", null);
}, "rows", "year_settings", "abn_settings", "person_year", "bas_quarters", "returns");

onRecordUpdateRequest((e) => {
  const before = e.record.original().publicExport();
  e.next();
  require(`${__hooks}/lib/audit.js`).write($app, e, "update", before);
}, "rows", "year_settings", "abn_settings", "person_year", "bas_quarters", "returns");

onRecordDeleteRequest((e) => {
  const before = e.record.publicExport();
  e.next();
  require(`${__hooks}/lib/audit.js`).write($app, e, "delete", before);
}, "rows", "year_settings", "abn_settings", "person_year", "bas_quarters", "returns");
