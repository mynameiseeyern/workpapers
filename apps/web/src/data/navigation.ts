import { SCHEDULES, type Engine, type SectionId } from "@workpapers/core";
import { SECTIONS } from "./sections";

export interface NavState {
  totals: Record<string, number | null>;
  /** Sections shown in the sidebar. */
  visible: Set<string>;
  /** Schedules that apply but are empty, behind "+ N more". */
  more: string[];
}

const isData = (id: string) => id === "s05" || id === "s07" || id in SCHEDULES;

/**
 * Prototype v15 rule: a schedule earns a place in the sidebar once it has rows this year or has been
 * marked as applying. Empty ones that may apply sit behind "+ N more"; "not this year" ones are hidden.
 */
export function navState(e: Engine, scope: string[], view: string): NavState {
  const totals: Record<string, number | null> = {};
  const visible = new Set<string>(), more: string[] = [];
  const shows = (id: string): boolean => {
    const s = SECTIONS.find((x) => x.id === id)!;
    const top = s.parent ?? id;
    if (!isData(top)) return true;
    if (!e.appliesFor(top as SectionId, scope)) return false;
    if (s.parent) return e.hasRows(id as SectionId) || view === id || shows(top);
    const kids = SECTIONS.filter((k) => k.parent === id);
    return e.hasRows(id as SectionId) || kids.some((k) => e.hasRows(k.id as SectionId) || view === k.id)
      || scope.some((o) => e.appliesRecorded(id as SectionId, e.fy, o) === true) || view === id;
  };
  const basHolders = e.abnHolders(scope).filter((o) => e.gstRegistered(o));
  for (const s of SECTIONS) {
    if (s.hidden) continue;
    totals[s.id] = s.group && s.group !== "Tools" ? e.sectionTotal(s.id as SectionId, scope) : null;
    if (s.id === "bas") { if (basHolders.length || view === "bas") visible.add(s.id); continue; }
    const top = s.parent ?? s.id;
    if (shows(s.id)) visible.add(s.id);
    else if (!s.parent && isData(top) && e.appliesFor(top as SectionId, scope)) more.push(s.id);
  }
  return { totals, visible, more };
}
