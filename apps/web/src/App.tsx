import { fyOf } from "@workpapers/core";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./components/SignIn";
import { pb } from "./data/pb";
import { useUrlState } from "./data/useUrlState";
import { Placeholder } from "./routes/Placeholder";

const todayISO = () => new Date().toLocaleDateString("en-CA");

export function App() {
  const [signedIn, setSignedIn] = useState(pb.authStore.isValid);
  const currentFY = fyOf(todayISO());
  const defaults = useMemo(() => ({ view: "overview", fy: currentFY, person: "Household" }), [currentFY]);
  const [url, setUrl] = useUrlState(defaults);
  const [people, setPeople] = useState<string[]>(["Ee", "Darrelle"]);

  useEffect(() => pb.authStore.onChange(() => setSignedIn(pb.authStore.isValid)), []);
  useEffect(() => {
    if (!signedIn) return;
    pb.collection("people").getFullList({ sort: "sort" })
      .then((rs) => rs.length && setPeople(rs.map((r) => r["name"] as string)))
      .catch(() => { /* schema not migrated yet: keep defaults */ });
  }, [signedIn]);

  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;

  const years = Array.from({ length: 6 }, (_, i) => currentFY - i);
  return (
    <AppShell
      view={url.view} fy={url.fy} person={url.person} years={years} people={people}
      onNavigate={(view) => setUrl({ view })} onYear={(fy) => setUrl({ fy })} onPerson={(person) => setUrl({ person })}
      onSignOut={() => pb.authStore.clear()}
    >
      <Placeholder view={url.view} fy={url.fy} person={url.person} />
    </AppShell>
  );
}
