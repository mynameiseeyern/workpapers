/// <reference path="../pb_data/types.d.ts" />
// Server-enforced locks: a row feeding a lodged tax return or a lodged BAS quarter can't be added, changed or
// deleted until that return or quarter is reopened. The rule itself lives in lib/lockcore.js, generated from
// packages/core/src/locks/lockcore.ts, so the app and the server always agree.

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/locks.js`).guard($app, e.record, null);
  e.next();
}, "rows");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/locks.js`).guard($app, e.record, e.record.original());
  e.next();
}, "rows");

onRecordDeleteRequest((e) => {
  require(`${__hooks}/lib/locks.js`).guard($app, null, e.record);
  e.next();
}, "rows");
