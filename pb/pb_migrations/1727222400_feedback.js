/// <reference path="../pb_data/types.d.ts" />
// Feedback from the app (Agentation annotations) and the secrets needed to forward it to GitHub.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const SIGNED_IN = "@request.auth.id != ''";
  app.save(new Collection({
    type: "base", name: "feedback",
    listRule: SIGNED_IN, viewRule: SIGNED_IN, createRule: null, updateRule: null, deleteRule: null,   // written only by the /api/workpapers/feedback route
    fields: [
      { type: "select", name: "kind", values: ["bug", "ui", "ux", "feature"], maxSelect: 1, required: true },
      { type: "text", name: "title", max: 200 },
      { type: "text", name: "body", max: 60000 },
      { type: "text", name: "page", max: 300 },
      { type: "json", name: "annotations", maxSize: 500000 },
      { type: "select", name: "status", values: ["saved", "sent", "failed"], maxSelect: 1 },
      { type: "text", name: "issue_url", max: 300 },
      { type: "number", name: "issue_number", onlyInt: true },
      { type: "text", name: "error", max: 2000 },
      { type: "relation", name: "by", collectionId: users.id, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  }));
  // Superuser-only key/value store (e.g. github_token, github_repo). Set in the admin UI at /_/.
  app.save(new Collection({
    type: "base", name: "app_secrets",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "key", required: true, max: 100 },
      { type: "text", name: "value", max: 2000 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_app_secrets_key ON app_secrets (key)"],
  }));
}, (app) => {
  for (const n of ["feedback", "app_secrets"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
});
