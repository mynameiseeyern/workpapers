// Adapts PocketBase records to lockcore and rejects writes into a locked period.
const core = require(`${__hooks}/lib/lockcore.js`);

function day(v) { return v ? String(v).slice(0, 10) : ""; }

function context(app) {
  const people = app.findRecordsByFilter("people", "id != ''", "sort", 0, 0).map((p) => p.id);
  const abn = {};
  const basisOf = (owner, key, dflt) => {
    if (!owner) return dflt;
    if (!(owner in abn)) {
      const rs = app.findRecordsByFilter("abn_settings", "person = {:p}", "-fy", 1, 0, { p: owner });
      abn[owner] = rs.length ? rs[0] : null;
    }
    const r = abn[owner];
    return (r && r.getString(key)) || dflt;
  };
  const status = (collection, filter, params) => {
    const rs = app.findRecordsByFilter(collection, filter, "", 1, 0, params);
    return rs.length ? rs[0].getString("status") : null;
  };
  return {
    people,
    incomeBasis: (o) => basisOf(o, "income_basis", "receipts"),
    gstBasis: (o) => basisOf(o, "gst_basis", "cash"),
    basStatus: (o, fy, q) => status("bas_quarters", "person = {:o} && fy = {:fy} && q = {:q}", { o, fy, q }),
    returnStatus: (o, fy) => status("returns", "person = {:o} && fy = {:fy}", { o, fy }),
  };
}

function lockRow(r) {
  const section = r.getString("section");
  return {
    section,
    date: day(r.getString("date")),
    paid: section === "s05" ? day(r.getString("paid")) : undefined,
    owner: r.getBool("shared") ? null : r.getString("owner") || null,
    direction: r.getString("direction"),
  };
}

module.exports = {
  /** Throws a 400 if either the new or the old version of the row sits in a locked period. */
  guard(app, next, prev) {
    const c = context(app);
    const name = (id) => { try { return app.findRecordById("people", id).getString("name"); } catch (_) { return "Someone"; } };
    for (const r of [next, prev]) {
      if (!r) continue;
      const lock = core.lockOf(lockRow(r), c);
      if (lock) throw new BadRequestError(`Locked: ${core.lockReason(lock, name)}. Reopen it to make changes.`);
    }
  },
};
