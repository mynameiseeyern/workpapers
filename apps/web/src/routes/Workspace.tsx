import { Alert, Card, Spinner } from "@heroui/react";
import { Engine, fyLabel, type Ledger } from "@workpapers/core";
import { sectionById } from "../data/sections";
import { BasCard, FlowCard, RecordsView, ReturnCard } from "./Figures";
import { Placeholder } from "./Placeholder";

interface Props {
  view: string; fy: number; person: string; example: boolean;
  ledger: Ledger | undefined; loading: boolean; error: unknown;
  onNavigate: (id: string) => void;
}

/** The main area: overview, return, BAS or one section's records, worked out by the engine. */
export function Workspace(p: Props) {
  const s = sectionById(p.view);
  const title = (
    <div>
      <h2 className="text-xl font-semibold">
        {s?.name ?? "Not found"}
        {s?.code && <span className="ml-2 align-middle text-xs font-normal text-muted">{s.code}</span>}
        {p.person !== "Household" && <span className="font-normal text-muted"> — {p.person}</span>}
      </h2>
      <p className="text-sm text-muted">{fyLabel(p.fy)}{p.example && " · example year"}</p>
    </div>
  );
  if (p.loading) return <div className="flex max-w-4xl flex-col gap-4">{title}<Spinner /></div>;
  if (p.error || !p.ledger) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">{title}
        <Alert status="danger"><Alert.Indicator /><Alert.Content>
          <Alert.Description>Couldn't load the records. {String((p.error as Error)?.message ?? "")}</Alert.Description>
        </Alert.Content></Alert>
      </div>
    );
  }
  const e = new Engine(p.ledger, p.fy);
  const scope = p.person === "Household" ? e.people : [p.person];
  const basPeople = e.abnHolders(scope).filter((o) => e.gstRegistered(o));

  let body;
  if (p.view === "overview") {
    body = (
      <>
        <div className="grid gap-4 lg:grid-cols-2">{scope.map((o) => <ReturnCard key={o} e={e} o={o} />)}</div>
        {basPeople.map((o) => <BasCard key={o} e={e} o={o} />)}
        <FlowCard e={e} scope={scope} onNavigate={p.onNavigate} />
      </>
    );
  } else if (p.view === "return") {
    body = <div className="grid gap-4 lg:grid-cols-2">{scope.map((o) => <ReturnCard key={o} e={e} o={o} />)}</div>;
  } else if (p.view === "bas") {
    body = basPeople.length ? basPeople.map((o) => <BasCard key={o} e={e} o={o} />) : (
      <Card><Card.Header><Card.Title>No BAS this year</Card.Title>
        <Card.Description>A BAS appears here for anyone with GST-registered business income in {fyLabel(p.fy)}.</Card.Description></Card.Header></Card>
    );
  } else if (s && s.group && s.group !== "Tools" && s.id !== "s08") {
    body = <RecordsView e={e} section={p.view} scope={scope} />;
  } else {
    return <Placeholder view={p.view} fy={p.fy} person={p.person} />;
  }
  return <div className="flex max-w-4xl flex-col gap-4">{title}{body}</div>;
}
