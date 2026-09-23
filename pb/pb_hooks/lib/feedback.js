// Turns an Agentation send into a stored feedback record and a GitHub issue.
const KINDS = {
  bug: { label: "bug", title: "Bug", intro: "Something is wrong or broken." },
  ui: { label: "ui", title: "UI", intro: "How something looks: layout, spacing, wording, colour, mobile." },
  ux: { label: "ux", title: "UX", intro: "How something works: steps, order, behaviour." },
  feature: { label: "feature", title: "Feature", intro: "Something new." },
};

// Amounts and long numbers in captured page text could be real tax figures: mask them before they leave the NAS.
function mask(s) {
  if (!s) return "";
  return String(s).replace(/-?\$\s?\d[\d,]*(\.\d+)?/g, "$#").replace(/\b\d{1,3}(,\d{3})+(\.\d+)?\b/g, "#").replace(/\b\d{4,}(\.\d+)?\b/g, "#");
}
function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function secret(app, key) {
  try { return app.findFirstRecordByData("app_secrets", "key", key).getString("value"); } catch (_) { return ""; }
}

function buildIssue(kind, title, page, notes, who) {
  const k = KINDS[kind];
  const lines = [`**${k.title}** — ${k.intro}`, "", `From: ${who} · Page: \`${page || "?"}\``, ""];
  notes.forEach((a, i) => {
    lines.push(`### ${i + 1}. ${clip(a.comment || "(no comment)", 300)}`);
    if (a.element) lines.push(`- Element: \`${clip(a.element, 120)}\``);
    if (a.elementPath) lines.push(`- Path: \`${clip(a.elementPath, 300)}\``);
    if (a.reactComponents) lines.push(`- Components: \`${clip(a.reactComponents, 200)}\``);
    if (a.selectedText) lines.push(`- Selected text: "${clip(mask(a.selectedText), 200)}"`);
    if (a.nearbyText) lines.push(`- Nearby text: "${clip(mask(a.nearbyText), 200)}"`);
    if (a.boundingBox) lines.push(`- Box: ${Math.round(a.boundingBox.x)},${Math.round(a.boundingBox.y)} ${Math.round(a.boundingBox.width)}×${Math.round(a.boundingBox.height)}`);
    lines.push("");
  });
  lines.push("<sub>Sent from Workpapers feedback mode. Dollar amounts and long numbers in captured page text are masked.</sub>");
  return { title: `[${k.title}] ${clip(title, 90)}`, body: lines.join("\n"), labels: [k.label, "feedback"] };
}

module.exports = {
  handle(app, auth, data) {
    const kind = String(data.kind || "");
    if (!KINDS[kind]) return { ok: false, error: "Pick bug, ui, ux or feature" };
    const notes = (Array.isArray(data.annotations) ? data.annotations : []).slice(0, 30).map((a) => ({
      comment: clip(a.comment, 2000), element: clip(a.element, 200), elementPath: clip(a.elementPath, 500),
      reactComponents: clip(a.reactComponents, 300), selectedText: clip(a.selectedText, 500), nearbyText: clip(a.nearbyText, 500),
      boundingBox: a.boundingBox || null,
    }));
    if (!notes.length) return { ok: false, error: "Add at least one note" };
    const title = clip(String(data.title || notes[0].comment || "Feedback").split("\n")[0], 150);
    const page = clip(data.page, 300);
    const who = auth ? (auth.getString("name") || auth.getString("email")) : "someone";
    const issue = buildIssue(kind, title, page, notes, who);

    const col = app.findCollectionByNameOrId("feedback");
    const rec = new Record(col);
    rec.set("kind", kind); rec.set("title", title); rec.set("body", issue.body); rec.set("page", page);
    rec.set("annotations", notes); rec.set("status", "saved"); rec.set("by", auth ? auth.id : "");
    app.save(rec);

    const token = secret(app, "github_token"), repo = secret(app, "github_repo");
    if (!token || !repo) return { ok: true, id: rec.id, issue: null, note: "Saved. GitHub isn't connected yet (set github_token and github_repo in app_secrets)." };
    try {
      const res = $http.send({
        url: `https://api.github.com/repos/${repo}/issues`, method: "POST", timeout: 20,
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "workpapers" },
        body: JSON.stringify(issue),
      });
      if (res.statusCode >= 300) throw new Error(`GitHub said ${res.statusCode}: ${clip(res.raw, 300)}`);
      rec.set("status", "sent"); rec.set("issue_url", res.json.html_url); rec.set("issue_number", res.json.number);
      app.save(rec);
      return { ok: true, id: rec.id, issue: { url: res.json.html_url, number: res.json.number } };
    } catch (err) {
      rec.set("status", "failed"); rec.set("error", clip(String(err), 1900)); app.save(rec);
      return { ok: true, id: rec.id, issue: null, note: "Saved on the NAS, but GitHub didn't accept it: " + clip(String(err), 200) };
    }
  },
  _mask: mask,
};
