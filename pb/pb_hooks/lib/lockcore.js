// GENERATED from packages/core/src/locks/lockcore.ts — do not edit. Run: pnpm --filter @workpapers/core build:lockcore
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/locks/lockcore.ts
var lockcore_exports = {};
__export(lockcore_exports, {
  lockBasDate: () => lockBasDate,
  lockFyOf: () => lockFyOf,
  lockOf: () => lockOf,
  lockQuarterOf: () => lockQuarterOf,
  lockReason: () => lockReason,
  lockRowFY: () => lockRowFY
});
module.exports = __toCommonJS(lockcore_exports);
function lockFyOf(date) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  return m >= 7 ? y + 1 : y;
}
function lockRowFY(r, c) {
  if (r.section === "s05" && r.direction === "income" && c.incomeBasis(r.owner) === "receipts" && r.paid) return lockFyOf(r.paid);
  return lockFyOf(r.date);
}
function lockBasDate(r, c) {
  if (c.gstBasis(r.owner) !== "cash") return r.date || null;
  if (r.paid === void 0) return r.date || null;
  return r.paid || null;
}
function lockQuarterOf(date) {
  const m = Number(date.slice(5, 7));
  return m >= 7 && m <= 9 ? 1 : m >= 10 ? 2 : m <= 3 ? 3 : 4;
}
function lockOf(r, c) {
  if (r.section === "s08" || !r.date) return null;
  const fy = lockRowFY(r, c);
  const owners = r.owner == null ? c.people : [r.owner];
  for (const o of owners) if (c.returnStatus(o, fy) === "lodged") return { kind: "return", owner: o, fy };
  if (r.section === "s05" && r.owner != null) {
    const d = lockBasDate(r, c);
    if (d) {
      const bfy = lockFyOf(d), q = lockQuarterOf(d);
      if (c.basStatus(r.owner, bfy, q) === "lodged") return { kind: "bas", owner: r.owner, fy: bfy, q };
    }
  }
  return null;
}
function lockReason(l, name = (o) => o) {
  const fy = `FY ${l.fy - 1}\u2013${String(l.fy).slice(2)}`;
  return l.kind === "return" ? `${name(l.owner)}'s ${fy} tax return is lodged` : `${name(l.owner)}'s Q${l.q} ${fy} BAS is lodged`;
}
