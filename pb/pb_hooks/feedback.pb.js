/// <reference path="../pb_data/types.d.ts" />
// POST /api/workpapers/feedback — saves feedback from the app and opens a GitHub issue for it.
// The GitHub token lives in the superuser-only app_secrets collection, never in the browser.
routerAdd("POST", "/api/workpapers/feedback", (e) => {
  const lib = require(`${__hooks}/lib/feedback.js`);
  const data = e.requestInfo().body || {};
  const result = lib.handle($app, e.auth, data);
  return e.json(result.ok ? 200 : 400, result);
}, $apis.requireAuth("users"));
