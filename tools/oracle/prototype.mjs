// Loads the frozen prototype (v15) in jsdom and exposes its calculation functions.
// The prototype is only a rules oracle: it is fed made-up data and never touches a database.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const body = readFileSync(new URL("../prototype/workpapers-v15.body.html", import.meta.url), "utf8");

const EXPORTS = `window.__P = { state, setFY, asPerson, withOwner, rowFY, notYetDerived, basDate, applies, abnHolders,
  businessTotals, quarterBAS, deductionTotals, wfhTotals, genTotals, genMain, taxFigures, sectionTotal, rate, wfhRate, carRate,
  GEN, quarters: function(){ return QUARTERS; } };`;

/**
 * Rule fixes made in the new engine on purpose. The same fixes are applied to the prototype here so the
 * golden comparison still checks everything else. Each one is also listed in docs/ENGINE-CHANGES.md.
 */
export const FIXES = [
  {
    id: "F1-300-assets-only",
    why: "The $300 immediate-deduction test is for depreciating assets. The prototype applied it to every work expense, so a $420 membership fee or a $540 phone bill went to decline in value. Only tools & equipment are tested now.",
    from: "depr:portion>DEPR_THRESHOLD,",
    to: 'depr:portion>DEPR_THRESHOLD && catLabel(r.cat)==="D5 Other work-related — tools & equipment",',
  },
  {
    id: "F2-overlap-employment-hours",
    why: "Phone & internet is only already covered when the person claims employment WFH hours at the fixed rate. Business-only hours don't cover an employment phone expense.",
    from: "rowsIn(\"s07a\").forEach(function(r){ by[ownerOf(r)]",
    to: "rowsIn(\"s07a\").forEach(function(r){ if(r.use===\"business\") return; by[ownerOf(r)]",
  },
];

export function loadPrototype(today) {
  let html = body;
  for (const f of FIXES) {
    if (!html.includes(f.from)) throw new Error("fix no longer applies: " + f.id);
    html = html.replace(f.from, f.to);
  }
  html = html
    .replace(/function todayISO\(\)\{[^}]*\}/, "function todayISO(){ return window.__TODAY; }")
    // expose internals just before the IIFE closes (last occurrence)
    .replace(/\}\)\(\);\s*<\/script>(?![\s\S]*<\/script>)/, EXPORTS + "\n})();</script>");
  if (!html.includes("window.__P")) throw new Error("could not inject exports into prototype");
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.__TODAY = today;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    },
  });
  const P = dom.window.__P;
  if (!P) throw new Error("prototype did not initialise");
  return P;
}
