import { Alert, Button, Card, Checkbox, Chip, Input, Label, Table, TextField, toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney, fyLabel, phaseOf, toCents, type Engine } from "@workpapers/core";
import { useState } from "react";
import type { LoadedLedger, LockEvent } from "../data/ledger";
import { lodgeBas, lodgeReturn, savePayg, type LockAction } from "../data/settingsApi";

const m = formatMoney;
const todayISO = () => new Date().toLocaleDateString("en-CA");
const shortDate = (d?: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";

type Mode = "lodged" | "reopened" | "relocked";

/** The confirm step for lodging, reopening or re-locking. Reopening asks for a reason, a tick and a typed word. */
function ConfirmPanel(p: {
  title: string; mode: Mode; confirmWord: string; figures: [string, number][]; changed: boolean; openItems?: string[];
  busy: boolean; onGo: (reason: string) => void; onCancel: () => void;
}) {
  const [ack, setAck] = useState(false), [reason, setReason] = useState(""), [typed, setTyped] = useState(""), [err, setErr] = useState("");
  const go = () => {
    if (p.mode === "reopened") {
      if (!reason.trim()) return setErr("Say why it's being reopened; the reason is kept in the history.");
      if (!ack) return setErr("Tick to confirm an amendment will be needed.");
      if (typed.trim().toUpperCase() !== p.confirmWord) return setErr(`Type ${p.confirmWord} to confirm.`);
    } else if (!ack && (p.mode === "lodged" || p.changed)) return setErr("Tick to confirm.");
    setErr(""); p.onGo(reason.trim());
  };
  return (
    <div className={`mt-3 flex flex-col gap-3 rounded-2xl p-4 ${p.mode === "reopened" ? "bg-danger-soft" : "bg-surface-secondary"}`}>
      <p className="font-semibold">{p.title}</p>
      {p.mode === "lodged" && <p className="text-sm">These figures are saved as the lodged record, and the records behind them become read-only. Check them against what was lodged.</p>}
      {p.mode === "reopened" && <p className="text-sm"><strong>This has been lodged.</strong> Any change from here means the workpapers no longer match what the ATO has, and an amendment will be needed. The reason is kept in the history.</p>}
      {p.mode === "relocked" && <p className="text-sm">{p.changed ? "Figures have moved since it was lodged. Re-lock once the amendment has gone to the ATO; these figures replace the lodged record." : "Nothing changed while it was open. Re-locking keeps the original lodged record."}</p>}
      {p.openItems && p.openItems.length > 0 && p.mode === "lodged" && (
        <p className="text-sm text-warning">Still open in the readiness list: {p.openItems.join("; ")}. You can still lock — just be sure these were dealt with.</p>
      )}
      {(p.mode === "lodged" || p.changed) && (
        <div className="max-w-sm text-sm">
          {p.figures.map(([l, v]) => <div key={l} className="flex justify-between py-0.5"><span>{l}</span><span className="tabular-nums">{m(v)}</span></div>)}
        </div>
      )}
      {p.mode === "reopened" && (
        <TextField className="max-w-lg" value={reason} onChange={setReason}>
          <Label>Why is it being reopened?</Label>
          <Input placeholder="e.g. missed a dividend statement" />
        </TextField>
      )}
      {(p.mode !== "relocked" || p.changed) && (
        <Checkbox isSelected={ack} onChange={setAck}>
          <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            {p.mode === "lodged" ? "These match what was lodged" : p.mode === "reopened" ? "I understand an amendment will be needed" : "The amendment has been lodged"}
          </Checkbox.Content>
        </Checkbox>
      )}
      {p.mode === "reopened" && (
        <TextField className="w-40" value={typed} onChange={setTyped} isInvalid={!!err && typed.trim().toUpperCase() !== p.confirmWord}>
          <Label>Type {p.confirmWord} to confirm</Label>
          <Input autoComplete="off" />
        </TextField>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button variant={p.mode === "reopened" ? "danger" : "primary"} isPending={p.busy} onPress={go}>
          {p.mode === "lodged" ? "Lock" : p.mode === "reopened" ? "Reopen" : "Re-lock"}
        </Button>
        <Button variant="tertiary" onPress={p.onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function History({ events, prefix }: { events: LockEvent[]; prefix: string }) {
  const es = events.filter((x) => x.target.startsWith(prefix));
  if (!es.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted">History ({es.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {es.map((x, i) => (
          <li key={i} className="flex flex-wrap gap-x-3"><span className="tabular-nums text-muted">{shortDate(x.at)}</span>
            <span>{x.kind === "bas" ? `Q${x.target.split(":q")[1]}` : `${x.target.split(":")[1]}'s return`} {x.action}</span>{x.by && <span className="text-muted">by {x.by}</span>}{x.reason && <span>— {x.reason}</span>}</li>
        ))}
      </ul>
    </details>
  );
}

const statusChip = (s: string | undefined, on?: string) =>
  s === "lodged" ? <Chip size="sm" color="accent">lodged {shortDate(on)} · locked</Chip>
    : s === "reopened" ? <Chip size="sm" color="warning">reopened</Chip>
    : <Chip size="sm">not lodged</Chip>;

/** Quarterly BAS for one ABN holder, with PAYG instalments and lodging. */
export function BasLodging({ e, L, o }: { e: Engine; L: LoadedLedger; o: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<{ i: number; mode: Mode } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [payg, setPayg] = useState<Record<number, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "ours"] });
  const today = todayISO();
  const qs = e.quarters.map((q, i) => ({ q, i, t: e.quarterBAS(q, o), rec: e.basRecord(o, i) }));
  const sum = (k: "gstOnSales" | "gstOnPurchases" | "net") => qs.reduce((a, x) => a + x.t[k], 0);

  const act = async (i: number, mode: Mode, reason: string) => {
    setBusy(true); setError("");
    try {
      const rec = e.basRecord(o, i), now = e.basFigures(o, i);
      const changed = !!rec?.figures && ["sales", "gstOnSales", "gstOnPurchases", "net"].some((k) => rec.figures![k] !== (now as Record<string, number>)[k]);
      await lodgeBas(L, e.fy, o, i + 1, mode as LockAction, mode === "reopened" || (mode === "relocked" && !changed) ? undefined : now, reason);
      await refresh();
      toast(mode === "lodged" ? `Q${i + 1} marked lodged` : mode === "reopened" ? `Q${i + 1} reopened` : `Q${i + 1} re-locked`, { variant: "success", timeout: 3000 });
      setOpen(null);
    } catch (x) { setError((x as Error).message); } finally { setBusy(false); }
  };
  const savePaygFor = async (i: number) => {
    const v = payg[i];
    if (v == null) return;
    const n = Number(v.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) return setError("PAYG instalment must be an amount");
    try { await savePayg(L, e.fy, o, i + 1, toCents(n)); await refresh(); setPayg((p) => { const x = { ...p }; delete x[i]; return x; }); }
    catch (x) { setError((x as Error).message); }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>{o} — BAS</Card.Title>
        <Card.Description>GST {e.ledger.settings.abn[o]?.gstBasis === "accrual" ? "on an accrual basis (invoice date)" : "on a cash basis (date paid)"} · lodging a quarter locks its business records</Card.Description>
      </Card.Header>
      <Card.Content>
        {error && <Alert status="danger" className="mb-3"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={`${o} BAS by quarter`} className="min-w-[720px]">
              <Table.Header>
                <Table.Column isRowHeader>Quarter</Table.Column>
                <Table.Column className="text-right">1A GST on sales</Table.Column>
                <Table.Column className="text-right">1B GST credits</Table.Column>
                <Table.Column className="text-right">Net GST</Table.Column>
                <Table.Column className="text-right">T7 PAYG</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column> </Table.Column>
              </Table.Header>
              <Table.Body>
                {qs.map(({ q, i, t, rec }) => {
                  const lf = rec?.figures, moved = lf ? t.net - (lf.net ?? 0) : 0;
                  return (
                    <Table.Row key={i} id={i}>
                      <Table.Cell>Q{i + 1} {q.label}<div className="text-xs text-muted">due {shortDate(q.due)}{!rec && today > q.end && q.due < today ? " · overdue" : ""}</div></Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{m(t.gstOnSales)}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{m(t.gstOnPurchases)}</Table.Cell>
                      <Table.Cell className="text-right font-medium tabular-nums">{m(t.net)}
                        {rec?.status === "reopened" && moved !== 0 && <div className="text-xs text-warning">{moved > 0 ? "+" : "−"}{m(Math.abs(moved))} since lodged</div>}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {L.editable && rec?.status !== "lodged" ? (
                          <TextField aria-label={`Q${i + 1} PAYG instalment`} className="ml-auto w-28" value={payg[i] ?? (e.paygFor(i, o) ? (e.paygFor(i, o) / 100).toFixed(2) : "")}
                            onChange={(v) => setPayg((p) => ({ ...p, [i]: v }))}>
                            <Input inputMode="decimal" placeholder="0.00" className="text-right" onBlur={() => savePaygFor(i)} />
                          </TextField>
                        ) : <span className="tabular-nums">{m(e.paygFor(i, o))}</span>}
                      </Table.Cell>
                      <Table.Cell>{statusChip(rec?.status, rec?.lodgedOn)}</Table.Cell>
                      <Table.Cell className="text-right whitespace-nowrap">
                        {L.editable && (!rec || rec.status === "open") && <Button size="sm" variant="primary" onPress={() => setOpen({ i, mode: "lodged" })}>Mark lodged…</Button>}
                        {L.editable && rec?.status === "lodged" && <Button size="sm" variant="secondary" onPress={() => setOpen({ i, mode: "reopened" })}>Reopen…</Button>}
                        {L.editable && rec?.status === "reopened" && <Button size="sm" variant="primary" onPress={() => setOpen({ i, mode: "relocked" })}>Re-lock…</Button>}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
                <Table.Row id="fy">
                  <Table.Cell className="font-semibold">Year</Table.Cell>
                  <Table.Cell className="text-right font-semibold tabular-nums">{m(sum("gstOnSales"))}</Table.Cell>
                  <Table.Cell className="text-right font-semibold tabular-nums">{m(sum("gstOnPurchases"))}</Table.Cell>
                  <Table.Cell className="text-right font-semibold tabular-nums">{m(sum("net"))}</Table.Cell>
                  <Table.Cell className="text-right font-semibold tabular-nums">{m(e.quarters.reduce((a, _q, i) => a + e.paygFor(i, o), 0))}</Table.Cell>
                  <Table.Cell> </Table.Cell><Table.Cell> </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        {open && (() => {
          const x = qs[open.i]!, now = e.basFigures(o, open.i), lf = x.rec?.figures;
          const changed = !!lf && (["sales", "gstOnSales", "gstOnPurchases", "net"] as const).some((k) => lf[k] !== now[k]);
          return (
            <ConfirmPanel key={`${open.i}-${open.mode}`} mode={open.mode} confirmWord={`Q${open.i + 1}`} busy={busy} changed={changed}
              title={`${open.mode === "lodged" ? "Mark" : open.mode === "reopened" ? "Reopen" : "Re-lock"} ${o}'s Q${open.i + 1} ${x.q.label} BAS${open.mode === "lodged" ? " as lodged" : ""}`}
              figures={[["G1 Total sales (incl. GST)", now.sales], ["1A GST on sales", now.gstOnSales], ["1B GST credits", now.gstOnPurchases], ["Net GST", now.net]]}
              onGo={(r) => act(open.i, open.mode, r)} onCancel={() => setOpen(null)} />
          );
        })()}
        <History events={L.events} prefix={`${e.fy}:${o}:`} />
      </Card.Content>
    </Card>
  );
}

/** Marking a tax return lodged (for a year that has ended), reopening it for an amendment, and re-locking. */
export function ReturnLodging({ e, L, scope, openItems }: { e: Engine; L: LoadedLedger; scope: string[]; openItems: (o: string) => string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<{ o: string; mode: Mode } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const today = todayISO(), ph = phaseOf(e.fy, today);
  if (ph === "during" || ph === "yearend") return null;
  const due = `${e.fy}-10-31`;
  const act = async (o: string, mode: Mode, reason: string) => {
    setBusy(true); setError("");
    try {
      const rec = e.returnRecord(o), now = e.returnFigures(o);
      const changed = !!rec?.figures && rec.figures.taxable !== now.taxable;
      await lodgeReturn(L, e.fy, o, mode as LockAction, mode === "reopened" || (mode === "relocked" && !changed) ? undefined : now, reason);
      await qc.invalidateQueries({ queryKey: ["ledger", "ours"] });
      toast(mode === "lodged" ? `${o}'s return marked lodged` : mode === "reopened" ? `${o}'s return reopened` : `${o}'s return re-locked`, { variant: "success", timeout: 3000 });
      setOpen(null);
    } catch (x) { setError((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <Card.Header>
        <Card.Title>{fyLabel(e.fy)} tax return{scope.length > 1 ? "s" : ""}</Card.Title>
        <Card.Description>
          {ph === "prep" ? `The year has ended. Self-lodged returns are due ${shortDate(due)}; a registered agent usually has longer. ` : ""}
          A lodged return locks every record that feeds it, including shared ones. Reopening is for amendments.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-2">
        {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
        {scope.map((o) => {
          const rec = e.returnRecord(o), now = e.returnFigures(o), lf = rec?.figures;
          const moved = lf ? now.taxable - (lf.taxable ?? 0) : 0;
          return (
            <div key={o}>
              <div className="flex flex-wrap items-center gap-3">
                <strong className="min-w-24">{o}</strong>
                {statusChip(rec?.status, rec?.lodgedOn)}
                {lf && <span className="text-sm text-muted">taxable income as lodged {m(lf.taxable ?? 0)}</span>}
                {lf && moved !== 0 && <Chip size="sm" color="warning">{moved > 0 ? "+" : "−"}{m(Math.abs(moved))} since lodged</Chip>}
                <span className="flex-1" />
                {L.editable && (!rec || rec.status === "open") && <Button size="sm" variant="primary" onPress={() => setOpen({ o, mode: "lodged" })}>Mark lodged…</Button>}
                {L.editable && rec?.status === "lodged" && <Button size="sm" variant="secondary" onPress={() => setOpen({ o, mode: "reopened" })}>Reopen…</Button>}
                {L.editable && rec?.status === "reopened" && <Button size="sm" variant="primary" onPress={() => setOpen({ o, mode: "relocked" })}>Re-lock…</Button>}
              </div>
              {open?.o === o && (
                <ConfirmPanel key={open.mode} mode={open.mode} confirmWord="AMEND" busy={busy} changed={!!lf && moved !== 0} openItems={openItems(o)}
                  title={`${open.mode === "lodged" ? "Mark" : open.mode === "reopened" ? "Reopen" : "Re-lock"} ${o}'s ${fyLabel(e.fy)} return${open.mode === "lodged" ? " as lodged" : ""}`}
                  figures={[["Assessable income", now.assessable], ["Deductions", now.deductions], ["Taxable income", now.taxable]]}
                  onGo={(r) => act(o, open.mode, r)} onCancel={() => setOpen(null)} />
              )}
            </div>
          );
        })}
        <History events={L.events.filter((x) => x.kind === "return")} prefix={`${e.fy}:`} />
      </Card.Content>
    </Card>
  );
}

