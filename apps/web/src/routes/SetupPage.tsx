import { Alert, Button, Card, Checkbox, Chip, Description, Input, Label, ListBox, Select, TextField, toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { carriedRates, fyLabel, rate, RATEBOOK, rateStatus, rateYear, toCents, unconfirmed, type Engine, type RateKey, type SectionId } from "@workpapers/core";
import { useState, type ReactNode } from "react";
import { AutoSaveStatus } from "../components/SaveStatus";
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
function Money(p: { label: string; value: string; onChange: (v: string) => void; onDone?: () => void; description?: ReactNode; placeholder?: string }) {
  return (
    <TextField className="w-full" value={p.value} onChange={p.onChange}>
      <Label>{p.label}</Label>
      <Input inputMode="decimal" placeholder={p.placeholder ?? "0.00"} onBlur={p.onDone}
        onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} />
      {p.description && <Description>{p.description}</Description>}
    </TextField>
  );
}
/** A link to the ATO page a rate comes from. */
function AtoLink({ href }: { href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">ATO page ↗</a>;
}
const fmtRate = (key: RateKey, v: number) => {
  const f = RATEBOOK[key].format;
  if (f === "cents") return `${Math.round(v * 100)}c`;
  if (f === "km") return `${v.toLocaleString("en-AU")} km`;
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: v % 1 ? 2 : 0 });
};
const toNum = (s: string) => { const n = Number(s.replace(/[$,\s]/g, "")); return s.trim() && Number.isFinite(n) ? n : undefined; };
const dollars = (c?: number) => (c ? (c / 100).toFixed(2) : "");
/** Two typed amounts mean the same money ("12" and "12.00"), so a form isn't "changed" by formatting alone. */
const sameMoney = (a: string, b: string) => toCents(toNum(a) ?? 0) === toCents(toNum(b) ?? 0);
/** Something typed that isn't an amount: don't save it as zero, say so instead. */
const notAmount = (s: string) => s.trim() !== "" && !((toNum(s) ?? -1) >= 0);
const drop = <T,>(key: string) => (x: Record<string, T>) => { const y = { ...x }; delete y[key]; return y; };
/** After a save: forget the edits that are now on the server, keep anything typed since. */
const settle = <T extends object>(sent: T) => (edits: Partial<T> | undefined): Partial<T> => {
  const left: Partial<T> = { ...edits };
  for (const k of Object.keys(left) as (keyof T)[]) if (left[k] === sent[k]) delete left[k];
  return left;
};
type Abn = { gstRegistered: boolean; gstBasis: string; incomeBasis: string; psi: string };
type Year = { help: string; carry: string };
type Rates = { wfh: string; car: string; mls: string };

/** Setup: which schedules apply, ABN settings, household details and this year's rates. */
export function SetupPage({ e, L }: { e: Engine; L: LoadedLedger }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Record<string, number>>({});   // saves in flight, by form or button
  const working = (key: string, by: 1 | -1) => setBusy((b) => ({ ...b, [key]: (b[key] ?? 0) + by }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "ours"] });
  // a checklist answer: saved straight away, confirmed with a toast
  const run = async (key: string, f: () => Promise<unknown>, done: string) => {
    working(key, 1); setError("");
    try { await f(); await refresh(); toast(done, { variant: "success", timeout: 2500 }); }
    catch (x) { setError((x as Error).message); } finally { working(key, -1); }
  };
  const fy = e.fy, ro = e.ledger.settings.rateOverrides[fy] ?? {};
  const editable = L.editable;

  // What's saved, straight from the records. Each form holds only what has been changed since, so "No changes" is always true to the records.
  const savedAbn = (o: string): Abn => {
    const a = e.ledger.settings.abn[o];
    return { gstRegistered: a?.gstRegistered ?? true, gstBasis: a?.gstBasis ?? "cash", incomeBasis: a?.incomeBasis ?? "receipts", psi: e.psi(o) };
  };
  const savedYear = (o: string): Year => ({ help: dollars(e.ledger.settings.help[`${fy}:${o}`]), carry: dollars(e.ledger.settings.ccCarry[`${fy}:${o}`]) });
  const savedRates: Rates = { wfh: ro.wfh != null ? String(ro.wfh) : "", car: ro.car != null ? String(ro.car) : "", mls: ro.mlsFamily != null ? String(ro.mlsFamily) : "" };
  const [abnEdits, setAbnEdits] = useState<Record<string, Partial<Abn>>>({});
  const [yearEdits, setYearEdits] = useState<Record<string, Partial<Year>>>({});
  const [rateEdits, setRateEdits] = useState<Partial<Rates>>({});
  const rates = { ...savedRates, ...rateEdits };
  const ratesDirty = (["wfh", "car", "mls"] as const).some((k) => toNum(rates[k]) !== toNum(savedRates[k]));
  const ratesBad = notAmount(rates.wfh) || notAmount(rates.car) || notAmount(rates.mls);
  // These forms save by themselves: ticks and lists at once, typed amounts when you click away. Each shows what happened.
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const touched = (key: string) => setJustSaved((s) => (s[key] ? { ...s, [key]: false } : s));
  const autosave = async (key: string, f: () => Promise<unknown>, done: () => void) => {
    working(key, 1); setFailed(drop(key)); touched(key);
    try { await f(); await refresh(); done(); setJustSaved((s) => ({ ...s, [key]: true })); }
    catch (x) { setFailed((s) => ({ ...s, [key]: (x as Error).message || "Check the connection and try again." })); }
    finally { working(key, -1); }
  };
  const setRate = (k: keyof Rates, v: string) => { touched("rates"); setRateEdits((x) => ({ ...x, [k]: v })); };
  const saveRatesNow = () => {
    if (!editable || ratesBad || !(ratesDirty || failed["rates"])) return;
    const sent = rates;
    void autosave("rates", () => saveRates(L, fy,
      Object.fromEntries(Object.entries({ wfh: toNum(sent.wfh), car: toNum(sent.car) }).filter(([, v]) => v != null)), toNum(sent.mls)),
      () => setRateEdits(settle(sent)));
  };

  // Records of a person in a section (working from home counts towards work-related deductions).
  const hasOwn = (id: SectionId, o: string) => e.hasRows(id, fy, o) || (id === "s07" && e.hasRows("s07a", fy, o));
  const appliesLabel = (id: SectionId, o: string) => {
    const rec = e.appliesRecorded(id, fy, o);
    if (rec === true) return <Chip size="sm" color="accent">applies</Chip>;
    if (rec === false) return <Chip size="sm">not this year</Chip>;
    if (hasOwn(id, o)) return <Chip size="sm" color="accent">has records</Chip>;
    const sg = e.suggestApplies(id, o);
    return <Chip size="sm" color="warning">{sg === true ? "not confirmed · applied last year" : sg === false ? "not confirmed · not last year" : "not confirmed"}</Chip>;
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
      {!editable && <p className="text-sm text-muted">The example year is read-only.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {e.people.map((o) => {
          const u = unconfirmed(e, o);
          return (
            <Card key={o}>
              <Card.Header>
                <Card.Title>Tax checklist — {o}</Card.Title>
                <Card.Description>
                  What applies to {o} in {fyLabel(fy)}. "Not this year" moves it out of the way and out of {o}'s totals; it can always come back.
                  Items with shared records apply to both of you, so answering one answers both.
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-1">
                {editable && u.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="text-sm">{u.length} not confirmed.</span>
                    <Button size="sm" variant="primary" isPending={!!busy[`accept-${o}`]} onPress={() => run(`accept-${o}`, () => setApplies(L, fy, [o],
                      Object.fromEntries(u.map((id) => [id, e.suggestApplies(id, o) !== false]))), `${o}'s checklist confirmed`)}>
                      {u.some((id) => e.suggestApplies(id, o) !== null) ? "Accept the suggestions" : "Mark all as applying"}
                    </Button>
                  </div>
                )}
                {DATA_SECTIONS.map((s) => {
                  const id = s.id as SectionId, rec = e.appliesRecorded(id, fy, o), shared = e.hasSharedRows(id);
                  const who = shared ? e.people : [o];
                  return (
                    <div key={s.id} className="flex items-center gap-2 border-b border-separator py-2 last:border-0">
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                        <span className="text-sm">{s.name}{s.code && <span className="ml-2 text-xs text-muted">{s.code}</span>}</span>
                        <div className="flex flex-wrap gap-1">{appliesLabel(id, o)}{shared && <Chip size="sm" variant="soft">shared</Chip>}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {editable && rec !== true && <Button size="sm" variant="tertiary" isPending={!!busy[`a-${o}-${id}`]}
                        onPress={() => run(`a-${o}-${id}`, () => setApplies(L, fy, who, { [id]: true }), `${s.name}: applies${shared ? " to both" : ` to ${o}`}`)}>Applies</Button>}
                      {editable && rec !== false && !who.some((p) => hasOwn(id, p)) && <Button size="sm" variant="tertiary" isPending={!!busy[`n-${o}-${id}`]}
                        onPress={() => run(`n-${o}-${id}`, () => setApplies(L, fy, who, { [id]: false }), `${s.name}: not this year${shared ? " for both" : ` for ${o}`}`)}>Not this year</Button>}
                      </div>
                    </div>
                  );
                })}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {e.people.map((o) => {
          const was = savedAbn(o), a = { ...was, ...abnEdits[o] }, key = `abn-${o}`;
          const saveNow = (sent: Abn) => void autosave(key, () => saveAbn(L, fy, o, sent), () => setAbnEdits((x) => ({ ...x, [o]: settle(sent)(x[o]) })));
          const set = (k: keyof Abn, v: string | boolean) => {
            if (!editable) return;
            setAbnEdits((x) => ({ ...x, [o]: { ...x[o], [k]: v } }));
            saveNow({ ...a, [k]: v });
          };
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
                {editable && <AutoSaveStatus saving={!!busy[key]} saved={justSaved[key]} error={failed[key]} onRetry={() => saveNow(a)} />}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {e.people.map((o) => {
          const was = savedYear(o), h = { ...was, ...yearEdits[o] }, key = `hh-${o}`;
          const set = (k: keyof Year, v: string) => { touched(key); setYearEdits((x) => ({ ...x, [o]: { ...x[o], [k]: v } })); };
          const dirty = !sameMoney(h.help, was.help) || !sameMoney(h.carry, was.carry);
          const bad = notAmount(h.help) || notAmount(h.carry);
          const saveNow = () => {
            if (!editable || bad || !(dirty || failed[key])) return;
            const sent = h;
            void autosave(key, () => savePersonYear(L, fy, o, { helpCents: toCents(toNum(sent.help) ?? 0), ccCarryCents: toCents(toNum(sent.carry) ?? 0) }),
              () => setYearEdits((x) => ({ ...x, [o]: settle(sent)(x[o]) })));
          };
          return (
            <Card key={o}>
              <Card.Header><Card.Title>{o} — {fyLabel(fy)}</Card.Title></Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <Money label="HELP / study loan balance" value={h.help} onChange={(v) => set("help", v)} onDone={saveNow} />
                <Money label="Unused concessional cap carried forward" value={h.carry} onChange={(v) => set("carry", v)} onDone={saveNow}
                  description="From myGov. Only usable if the total super balance was under $500,000 on 30 June last year." />
                {editable && <AutoSaveStatus saving={!!busy[key]} saved={justSaved[key]} waiting={dirty} error={failed[key]} onRetry={saveNow}
                  invalid={bad ? "Amounts only, like 1234.50" : undefined} />}
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
          <Money label="Working from home, $ per hour" value={rates.wfh} onChange={(v) => setRate("wfh", v)} onDone={saveRatesNow} placeholder={String(rate("wfh", fy))}
            description={<>Fixed rate method · <AtoLink href={RATEBOOK.wfh.source} /></>} />
          <Money label="Car, $ per km" value={rates.car} onChange={(v) => setRate("car", v)} onDone={saveRatesNow} placeholder={String(rate("car", fy))}
            description={<>Cents per kilometre method · <AtoLink href={RATEBOOK.car.source} /></>} />
          <Money label="Medicare levy surcharge — family threshold" value={rates.mls} onChange={(v) => setRate("mls", v)} onDone={saveRatesNow}
            placeholder={String(rate("mls", fy))} description={<>Plus $1,500 per dependent child after the first · <AtoLink href={RATEBOOK.mls.source} /></>} />
          {editable && <div className="sm:col-span-3"><AutoSaveStatus saving={!!busy["rates"]} saved={justSaved["rates"]} waiting={ratesDirty}
            error={failed["rates"]} onRetry={saveRatesNow} invalid={ratesBad ? "Amounts only, like 0.70" : undefined} /></div>}
        </Card.Content>
        <Card.Content className="flex flex-col">
          <p className="mb-1 text-sm font-medium">All rates and thresholds used this year</p>
          {(Object.keys(RATEBOOK) as RateKey[]).map((k) => {
            const r = RATEBOOK[k], y = rateYear(k, fy);
            return (
              <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-separator py-1.5 text-sm last:border-0">
                <span className="min-w-56 flex-1">{r.label}</span>
                <span className="tabular-nums font-medium">{fmtRate(k, y.value)}</span>
                {rateStatus(k, fy) === "carried" && <Chip size="sm" color="warning">using {fyLabel(y.year)} — not yet published</Chip>}
                <AtoLink href={r.source} />
              </div>
            );
          })}
        </Card.Content>
      </Card>
    </div>
  );
}
