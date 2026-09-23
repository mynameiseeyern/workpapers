import { Engine, fyOf, type SectionId } from "@workpapers/core";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./components/SignIn";
import { pb } from "./data/pb";
import { useUrlState } from "./data/useUrlState";
import { useLedger } from "./data/ledger";
import { SECTIONS } from "./data/sections";
import { Workspace } from "./routes/Workspace";

const todayISO = () => new Date().toLocaleDateString("en-CA");

export function App() {
  const [signedIn, setSignedIn] = useState(pb.authStore.isValid);
  const currentFY = fyOf(todayISO());
  const defaults = useMemo(() => ({ view: "overview", fy: currentFY, person: "Household", data: "ours" as const }), [currentFY]);
  const [url, setUrl] = useUrlState(defaults);
  const [people, setPeople] = useState<string[]>(["Ee", "Darrelle"]);

  useEffect(() => pb.authStore.onChange(() => setSignedIn(pb.authStore.isValid)), []);
  useEffect(() => {
    if (!signedIn) return;
    pb.collection("people").getFullList({ sort: "sort" })
      .then((rs) => rs.length && setPeople(rs.map((r) => r["name"] as string)))
      .catch(() => { /* schema not migrated yet: keep defaults */ });
  }, [signedIn]);

  const ledger = useLedger(url.data, url.fy, people, signedIn);
  const totals = useMemo(() => {
    if (!ledger.data) return {};
    const e = new Engine(ledger.data, url.fy);
    const scope = url.person === "Household" ? e.people : [url.person];
    return Object.fromEntries(SECTIONS.map((s) => [s.id, s.group && s.group !== "Tools" ? e.sectionTotal(s.id as SectionId, scope) : null]));
  }, [ledger.data, url.fy, url.person]);

  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;

  const years = Array.from({ length: 6 }, (_, i) => currentFY - i);
  return (
    <AppShell
      view={url.view} fy={url.fy} person={url.person} years={years} people={people}
      onNavigate={(view) => setUrl({ view })} onYear={(fy) => setUrl({ fy })} onPerson={(person) => setUrl({ person })}
      onSignOut={() => pb.authStore.clear()}
      example={url.data === "example"} onExample={(on) => setUrl({ data: on ? "example" : "ours" })} totals={totals}
    >
      <Workspace view={url.view} fy={url.fy} person={url.person} example={url.data === "example"}
        ledger={ledger.data} loading={ledger.isLoading} error={ledger.error} onNavigate={(view) => setUrl({ view })} />
    </AppShell>
  );
}
