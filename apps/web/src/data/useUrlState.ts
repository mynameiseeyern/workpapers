import { useCallback, useEffect, useState } from "react";

/** View, year, person and data source (our records or the example year) live in the URL so every screen is linkable and survives reloads. */
export interface UrlState { view: string; fy: number; person: string; data: "ours" | "example" }

const read = (defaults: UrlState): UrlState => {
  const p = new URLSearchParams(window.location.search);
  return {
    view: p.get("view") ?? defaults.view,
    fy: Number(p.get("fy")) || defaults.fy,
    person: p.get("person") ?? defaults.person,
    data: p.get("data") === "example" ? "example" : "ours",
  };
};

export function useUrlState(defaults: UrlState) {
  const [state, setState] = useState<UrlState>(() => read(defaults));
  useEffect(() => {
    const on = () => setState(read(defaults));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, [defaults]);
  const update = useCallback((patch: Partial<UrlState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const q = new URLSearchParams({ view: next.view, fy: String(next.fy), person: next.person });
      if (next.data === "example") q.set("data", "example");
      window.history.pushState(null, "", `?${q.toString()}`);
      return next;
    });
  }, []);
  return [state, update] as const;
}
