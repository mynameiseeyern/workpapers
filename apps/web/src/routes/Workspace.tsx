import { Alert, Button, Card, Spinner } from "@heroui/react";
import { checksFor, Engine, formatMoney, fyLabel, phaseOf, todoList, type SectionId } from "@workpapers/core";
import type { LoadedLedger } from "../data/ledger";
import { sectionById } from "../data/sections";
import { BasCard, FlowCard, ReturnCard } from "./Figures";
import { SectionPage } from "./SectionPage";
import { Placeholder } from "./Placeholder";
import { BasLodging, ReturnLodging } from "./Lodging";
import { SetupPage } from "./SetupPage";

const todayISO = () => new Date().toLocaleDateString("en-CA");
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** What still needs doing before the return, and the next BAS. */
function TodoCard({ e, scope, onNavigate }: { e: Engine; scope: string[]; onNavigate: (id: string) => void }) {
  const today = todayISO(), t = todoList(e, scope, today), multi = scope.length > 1;
  const nexts = scope.map((o) => ({ o, n: checksFor(e, o, today).next })).filter((x) => x.n);
  const ph = phaseOf(e.fy, today);
  return (
    <Card>
      <Card.Header>
        <div className="flex items-baseline justify-between gap-3">
          <Card.Title>{t.items.length ? "To do" : "All clear"}</Card.Title>
          <span className="text-xs text-muted">{t.clear} of {t.total} checks clear</span>
        </div>
        <Card.Description>{ph === "during" ? "Year to date — worth keeping clear as you go." : ph === "yearend" ? "The year ends 30 June — clear these first." : ph === "prep" ? "The year has ended: what stands between these records and the return." : "A closed year, shown for reference."}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-1">
        {nexts.map(({ o, n }) => (
          <div key={o} className="mb-1 flex flex-wrap items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2 text-sm">
            {multi && <strong>{o}</strong>}<span>Next BAS: <strong>Q{n!.i + 1} {n!.q.label}</strong> · due {shortDate(n!.q.due)} · {n!.days < 0 ? `${-n!.days} days overdue` : `${n!.days} days`}{n!.ended ? "" : " · quarter still running"} · GST so far {formatMoney(Math.abs(n!.net))} {n!.net >= 0 ? "payable" : "refund"}</span>
            <span className="flex-1" /><Button size="sm" variant="ghost" onPress={() => onNavigate("bas")}>Open</Button>
          </div>
        ))}
        {t.items.length === 0 && <p className="text-sm text-muted">Nothing needs attention right now.</p>}
        {t.items.map((i, k) => (
          <div key={k} className={`flex items-center gap-2 border-b border-separator py-1 text-sm last:border-0 ${i.soft ? "text-muted" : ""}`}>
            <span className="flex-1">{multi && i.who && <strong>{i.who} · </strong>}{i.text}</span>
            {i.go !== "rates" && <Button size="sm" variant="ghost" onPress={() => onNavigate(i.go)}>Open</Button>}
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

interface Props {
  view: string; fy: number; person: string; example: boolean;
  loaded: LoadedLedger | undefined; loading: boolean; error: unknown; years: number[];
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
  if (p.error || !p.loaded) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">{title}
        <Alert status="danger"><Alert.Indicator /><Alert.Content>
          <Alert.Description>Couldn't load the records. {String((p.error as Error)?.message ?? "")}</Alert.Description>
        </Alert.Content></Alert>
      </div>
    );
  }
  const e = new Engine(p.loaded.ledger, p.fy);
  const scope = p.person === "Household" ? e.people : [p.person];
  const basPeople = e.abnHolders(scope).filter((o) => e.gstRegistered(o));

  let body;
  if (p.view === "overview") {
    body = (
      <>
        <TodoCard e={e} scope={scope} onNavigate={p.onNavigate} />
        <div className="grid gap-4 lg:grid-cols-2">{scope.map((o) => <ReturnCard key={o} e={e} o={o} />)}</div>
        {basPeople.map((o) => <BasCard key={o} e={e} o={o} />)}
        <FlowCard e={e} scope={scope} onNavigate={p.onNavigate} />
      </>
    );
  } else if (p.view === "return") {
    const openItems = (o: string) => {
      const c = checksFor(e, o, todayISO());
      return ([["missing", "deduction rows without evidence"], ["needInv", "expenses missing a tax invoice"], ["basOpen", "BAS quarters not marked lodged"],
        ["superPending", "super contributions without notice of intent"], ["psiUnset", "PSI status not assessed"], ["pool", "assets over the write-off threshold"],
        ["unpaid", "invoices not yet paid"], ["ccOver", "super over the cap"]] as const)
        .filter(([k]) => ((c[k] as number | null) ?? 0) > 0).map(([k, l]) => `${c[k]} ${l}`);
    };
    body = (
      <>
        <ReturnLodging e={e} L={p.loaded} scope={scope} openItems={openItems} />
        <div className="grid gap-4 lg:grid-cols-2">{scope.map((o) => <ReturnCard key={o} e={e} o={o} />)}</div>
      </>
    );
  } else if (p.view === "bas") {
    body = basPeople.length ? basPeople.map((o) => <BasLodging key={`${o}-${p.fy}`} e={e} L={p.loaded!} o={o} />) : (
      <Card><Card.Header><Card.Title>No BAS this year</Card.Title>
        <Card.Description>A BAS appears here for anyone with GST-registered business income in {fyLabel(p.fy)}.</Card.Description></Card.Header></Card>
    );
  } else if (p.view === "setup") {
    body = <SetupPage key={`setup-${p.fy}-${p.example}`} e={e} L={p.loaded} />;
  } else if (s && s.group && s.group !== "Tools") {
    body = <SectionPage key={`${p.view}-${p.fy}`} e={e} loaded={p.loaded} section={p.view as SectionId} scope={scope} person={p.person} years={p.years} />;
  } else {
    return <Placeholder view={p.view} fy={p.fy} person={p.person} />;
  }
  return <div className="flex max-w-4xl flex-col gap-4">{title}{body}</div>;
}
