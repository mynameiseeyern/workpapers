import { Alert, Button, Card, Checkbox, Chip, Description, Input, Label, ListBox, Select, TextField, toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { carriedRates, fyLabel, rate, RATEBOOK, toCents, unconfirmed, type Engine, type SectionId } from "@workpapers/core";
import { useState, type ReactNode } from "react";
import type { LoadedLedger } from "../data/ledger";
import { SECTIONS } from "../data/sections";
import { saveAbn, savePersonYear, saveRates, setApplies } from "../data/settingsApi";

const DATA_SECTIONS = SECTIONS.filter((s) => s.group && s.group !== "Tools" && !s.parent && s.id !== "s08");
const PSI: [string, string][] = [["", "Not assessed yet"], ["notpsi", "Not personal services income"], ["psb", "PSI, but a personal services business"], ["applies", "PSI rules apply"]];

function Pick(p: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; description?: ReactNode }) {
  return (
    <Select className="w-full" value={p.value || "__"} onChange={(v) => v != null && p.onChange(v === "__" ? "" : String(v))}>
      <Label>{p.label}</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover><ListBox>
        {p.options.map(([id, l]) => <ListBox.Item key={id || "__"} id={id || "__"} textValue={l}>{l}<ListBox.ItemIndicator /></ListBox.Item>)}
      </ListBox></Select.Popover>
      {p.description && <Description>{p.description}</Description>}
    </Select>
  );
}
function Money(p: { label: string; value: string; onChange: (v: string) => void; description?: ReactNode; placeholder?: string }) {
  return (
    <TextField className="w-full" value={p.value} onChange={p.onChange}>
      <Label>{p.label}</Label>
      <Input inputMode="decimal" placeholder={p.placeholder ?? "0.00"} />
      {p.description && <Description>{p.description}</Description>}
    </TextField>
  );
}
const toNum = (s: string) => { const n = Number(s.replace(/[$,\s]/g, "")); return s.trim() && Number.isFinite(n) ? n : undefined; };
const dollars = (c?: number) => (c ? (c / 100).toFixed(2) : "");

/** Setup: which schedules apply, ABN settings, household details and this year's rates. */
export function SetupPage({ e, L }: { e: Engine; L: LoadedLedger }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "ours"] });
  const run = async (key: string, f: () => Promise<unknown>, done: string) => {
    setBusy(key); setError("");
    try { await f(); await refresh(); toast(done, { variant: "success", timeout: 2500 }); }
    catch (x) { setError((x as Error).message); } finally { setBusy(""); }
  };
  const fy = e.fy, ro = e.ledger.settings.rateOverrides[fy] ?? {};
  const u = unconfirmed(e);
  const editable = L.editable;

  // ABN and household forms keep local edits until saved
  const [abn, setAbn] = useState(() => Object.fromEntries(e.people.map((o) => {
    const a = e.ledger.settings.abn[o];
    return [o, { gstRegistered: a?.gstRegistered ?? true, gstBasis: a?.gstBasis ?? "cash", incomeBasis: a?.incomeBasis ?? "receipts", psi: e.psi(o) }];
  })));
  const [hh, setHh] = useState(() => Object.fromEntries(e.people.map((o) => [o, {
    help: dollars(e.ledger.settings.help[`${fy}:${o}`]), carry: dollars(e.ledger.settings.ccCarry[`${fy}:${o}`]),
  }])));
  const [rates, setRates] = useState({ wfh: ro.wfh != null ? String(ro.wfh) : "", car: ro.car != null ? String(ro.car) : "", mls: ro.mlsFamily != null ? String(ro.mlsFamily) : "" });

  const appliesLabel = (id: SectionId) => {
    const rec = e.appliesRecorded(id);
    if (rec === true) return <Chip size="sm" color="accent">applies</Chip>;
    if (rec === false) return <Chip size="sm">not this year</Chip>;
    if (e.hasRows(id)) return <Chip size="sm" color="accent">has records</Chip>;
    const sg = e.suggestApplies(id);
    return <Chip size="sm" color="warning">{sg === true ? "not confirmed · applied last year" : sg === false ? "not confirmed · not last year" : "not confirmed"}</Chip>;
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
      {!editable && <p className="text-sm text-muted">The example year is read-only.</p>}

      <Card>
        <Card.Header>
          <Card.Title>Schedules in {fyLabel(fy)}</Card.Title>
          <Card.Description>Say which parts of the return apply this year. "Not this year" moves a schedule out of the way and out of the totals; it can always come back.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-1">
          {editable && u.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="text-sm">{u.length} not confirmed.</span>
              <Button size="sm" variant="primary" isPending={busy === "accept"} onPress={() => run("accept", () => setApplies(L, fy,
                Object.fromEntries(u.map((id) => [id, e.suggestApplies(id) !== false]))), "Schedules confirmed")}>
                {u.some((id) => e.suggestApplies(id) !== null) ? "Accept the suggestions" : "Mark all as applying"}
              </Button>
            </div>
          )}
          {DATA_SECTIONS.map((s) => {
            const id = s.id as SectionId, rec = e.appliesRecorded(id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-separator py-1.5 last:border-0">
                <span className="min-w-56 flex-1 text-sm">{s.name}{s.code && <span className="ml-2 text-xs text-muted">{s.code}</span>}</span>
                {appliesLabel(id)}
                {editable && rec !== true && <Button size="sm" variant="tertiary" onPress={() => run(`a-${id}`, () => setApplies(L, fy, { [id]: true }), `${s.name}: applies`)}>Applies</Button>}
                {editable && rec !== false && !e.hasRows(id) && <Button size="sm" variant="tertiary" onPress={() => run(`a-${id}`, () => setApplies(L, fy, { [id]: false }), `${s.name}: not this year`)}>Not this year</Button>}
              </div>
            );
          })}
        </Card.Content>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {e.people.map((o) => {
          const a = abn[o]!;
          const set = (k: keyof typeof a, v: string | boolean) => setAbn((x) => ({ ...x, [o]: { ...x[o]!, [k]: v } }));
          return (
            <Card key={o}>
              <Card.Header>
                <Card.Title>{o} — ABN</Card.Title>
                <Card.Description>Only matters if {o} has business income. Carries forward to later years until changed.</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <Checkbox isSelected={a.gstRegistered} onChange={(v) => set("gstRegistered", v)}>
                  <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Registered for GST</Checkbox.Content>
                </Checkbox>
                {a.gstRegistered && <Pick label="GST accounting" value={a.gstBasis} onChange={(v) => set("gstBasis", v)}
                  options={[["cash", "Cash — BAS by the date paid"], ["accrual", "Accrual — BAS by the invoice date"]]} />}
                <Pick label="Business income counts" value={a.incomeBasis} onChange={(v) => set("incomeBasis", v)}
                  options={[["receipts", "When it's received"], ["earnings", "When it's invoiced"]]} />
                <Pick label={`Personal services income, ${fyLabel(fy)}`} value={a.psi} onChange={(v) => set("psi", v)} options={PSI}
                  description="When the PSI rules apply, home occupancy costs and payments to associates aren't deductible." />
                {editable && <div><Button size="sm" variant="primary" isPending={busy === `abn-${o}`}
                  onPress={() => run(`abn-${o}`, () => saveAbn(L, fy, o, a), `${o}'s ABN settings saved`)}>Save</Button></div>}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {e.people.map((o) => {
          const h = hh[o]!;
          return (
            <Card key={o}>
              <Card.Header><Card.Title>{o} — {fyLabel(fy)}</Card.Title></Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <Money label="HELP / study loan balance" value={h.help} onChange={(v) => setHh((x) => ({ ...x, [o]: { ...h, help: v } }))} />
                <Money label="Unused concessional cap carried forward" value={h.carry} onChange={(v) => setHh((x) => ({ ...x, [o]: { ...h, carry: v } }))}
                  description="From myGov. Only usable if the total super balance was under $500,000 on 30 June last year." />
                {editable && <div><Button size="sm" variant="primary" isPending={busy === `hh-${o}`}
                  onPress={() => run(`hh-${o}`, () => savePersonYear(L, fy, o, { helpCents: toCents(toNum(h.help) ?? 0), ccCarryCents: toCents(toNum(h.carry) ?? 0) }), "Saved")}>Save</Button></div>}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Rates for {fyLabel(fy)}</Card.Title>
          <Card.Description>
            Leave blank to use the rate book. {carriedRates(fy).length > 0 && `${carriedRates(fy).length} rate${carriedRates(fy).length === 1 ? "" : "s"} for this year aren't published by the ATO yet, so last year's are used.`}
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 sm:grid-cols-3">
          <Money label="Working from home, $ per hour" value={rates.wfh} onChange={(v) => setRates((r) => ({ ...r, wfh: v }))} placeholder={String(rate("wfh", fy))}
            description={RATEBOOK.wfh.label} />
          <Money label="Car, $ per km" value={rates.car} onChange={(v) => setRates((r) => ({ ...r, car: v }))} placeholder={String(rate("car", fy))}
            description="Cents per kilometre method" />
          <Money label="Medicare levy surcharge — family threshold" value={rates.mls} onChange={(v) => setRates((r) => ({ ...r, mls: v }))}
            placeholder={String(rate("mls", fy))} description="Plus $1,500 per dependent child after the first" />
          {editable && <div><Button size="sm" variant="primary" isPending={busy === "rates"} onPress={() => run("rates", () => saveRates(L, fy,
            Object.fromEntries(Object.entries({ wfh: toNum(rates.wfh), car: toNum(rates.car) }).filter(([, v]) => v != null)), toNum(rates.mls)), "Rates saved")}>Save</Button></div>}
        </Card.Content>
      </Card>
    </div>
  );
}
