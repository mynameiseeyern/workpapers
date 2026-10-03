import type { Row, SectionId } from "@workpapers/core";

/** Schedules whose "who" box holds the same kind of name, so a bank typed under interest is offered under dividends too. */
const SAME_NAMES: SectionId[][] = [["i10", "i11"]];

/**
 * What has been typed before in a text box of this schedule (any year, either person), most used first, so a
 * repeated name like a bank, a fund or a supplier is picked from a list rather than retyped. The spelling
 * follows the latest use. `field` is "party", "description" or "details.<key>".
 */
export function usedBefore(rows: Row[], section: SectionId) {
  const cache = new Map<string, string[]>();
  const valueOf = (r: Row, field: string): string => {
    const raw = field.startsWith("details.") ? (r.details as Record<string, unknown> | undefined)?.[field.slice(8)]
      : field === "party" ? r.party : r.description;
    return typeof raw === "string" ? raw.trim() : "";
  };
  const collect = (from: SectionId, field: string, direction?: Row["direction"]): string[] => {
    const seen = new Map<string, { text: string; n: number; last: string }>();
    for (const r of rows) {
      if (r.section !== from) continue;
      if (direction && from === "s05" && (r.direction ?? "expense") !== direction) continue;
      const text = valueOf(r, field);
      if (!text) continue;
      const was = seen.get(text.toLowerCase());
      if (!was) seen.set(text.toLowerCase(), { text, n: 1, last: r.date });
      else { was.n++; if (r.date >= was.last) { was.last = r.date; was.text = text; } }
    }
    return [...seen.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last) || a.text.localeCompare(b.text)).map((x) => x.text);
  };
  return (field: string, direction?: Row["direction"]): string[] => {
    const key = `${field}|${direction ?? ""}`;
    let out = cache.get(key);
    if (!out) {
      const all = collect(section, field, direction);
      // the same kind of name from a sister schedule comes after this schedule's own
      if (field === "details.party") {
        for (const other of SAME_NAMES.find((g) => g.includes(section)) ?? []) if (other !== section) all.push(...collect(other, field));
      }
      const once = new Set<string>();
      out = all.filter((t) => !once.has(t.toLowerCase()) && once.add(t.toLowerCase())).slice(0, 50);
      cache.set(key, out);
    }
    return out;
  };
}
