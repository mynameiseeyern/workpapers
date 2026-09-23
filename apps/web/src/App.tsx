import { Engine, fyOf } from "@workpapers/core";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./components/SignIn";
import { pb } from "./data/pb";
import { useUrlState } from "./data/useUrlState";
import { useLedger, useLiveUpdates } from "./data/ledger";
import { navState } from "./data/navigation";
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
  useLiveUpdates(signedIn && url.data === "ours");
  const nav = useMemo(() => {
    if (!ledger.data) return undefined;
    const e = new Engine(ledger.data.ledger, url.fy);
    return navState(e, url.person === "Household" ? e.people : [url.person], url.view);
  }, [ledger.data, url.fy, url.person, url.view]);

  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;

  const years = Array.from({ length: 6 }, (_, i) => currentFY - i);
  return (
    <AppShell
      view={url.view} fy={url.fy} person={url.person} years={years} people={people}
      onNavigate={(view) => setUrl({ view })} onYear={(fy) => setUrl({ fy })} onPerson={(person) => setUrl({ person })}
      onSignOut={() => pb.authStore.clear()}
      example={url.data === "example"} onExample={(on) => setUrl({ data: on ? "example" : "ours" })} nav={nav}
    >
      <Workspace view={url.view} fy={url.fy} person={url.person} example={url.data === "example"}
        loaded={ledger.data} loading={ledger.isLoading} error={ledger.error} years={years} onNavigate={(view) => setUrl({ view })} />
    </AppShell>
  );
}
