import { Button, Card, Checkbox, Description, FieldError, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { BIZ_CATS, SCHEDULES, WORK_CATS, type Field, type SectionId } from "@workpapers/core";
import { useRef, useState, type ReactNode } from "react";
import { SHARED, validate, type Draft } from "../data/rowsApi";

interface Props {
  draft: Draft;
  people: string[];
  years: number[];
  gstRegistered: (o: string) => boolean;
  saving: boolean;
  onSave: (d: Draft, removedFiles: string[]) => void;
  onCancel: () => void;
}

/** Which owners a section allows: shared rows only where a split makes sense. */
function ownerOptions(section: SectionId, people: string[]): string[] {
  if (section === "s05" || section === "s07a") return people;
  const g = SCHEDULES[section];
  if (g && !g.shared) return people;
  return [...people, SHARED];
}

function Text(p: { label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; money?: boolean;
  placeholder?: string; description?: ReactNode; className?: string; required?: boolean; inputMode?: "decimal" | "numeric" }) {
  return (
    <TextField validationBehavior="aria" className={p.className ?? "w-full"} isInvalid={!!p.error} value={p.value} onChange={p.onChange} type={p.type ?? "text"} isRequired={p.required}>
      <Label>{p.label}</Label>
      <Input placeholder={p.placeholder ?? (p.money ? "0.00" : undefined)} inputMode={p.money ? "decimal" : p.inputMode} />
      {p.description && !p.error && <Description>{p.description}</Description>}
      {p.error && <FieldError>{p.error}</FieldError>}
    </TextField>
  );
}

function Choice(p: { label: string; value: string; options: string[]; onChange: (v: string) => void; className?: string; error?: string }) {
  return (
    <Select validationBehavior="aria" className={p.className ?? "w-full"} value={p.value || null} onChange={(v) => v != null && p.onChange(String(v))} isInvalid={!!p.error}>
      <Label>{p.label}</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {p.options.map((o) => <ListBox.Item key={o} id={o} textValue={o}>{o}<ListBox.ItemIndicator /></ListBox.Item>)}
        </ListBox>
      </Select.Popover>
      {p.error && <FieldError>{p.error}</FieldError>}
    </Select>
  );
}

function Tick(p: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Checkbox isSelected={p.checked} onChange={p.onChange}>
      <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{p.label}</Checkbox.Content>
    </Checkbox>
  );
}

/** Add or edit one record. The fields follow the section; shared rows carry a split. */
export function EntryForm({ draft, people, years, gstRegistered, saving, onSave, onCancel }: Props) {
  const [d, setD] = useState<Draft>(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const gstTouched = useRef(!!draft.gst);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setDetail = (k: string, v: string | boolean) => setD((x) => ({ ...x, details: { ...x.details, [k]: v } }));
  const g = SCHEDULES[d.section];
  const owners = ownerOptions(d.section, people);
  const registered = d.owner !== SHARED && gstRegistered(d.owner);

  const setAmount = (v: string) => {
    setD((x) => {
      const next = { ...x, amount: v };
      // suggest the GST in a GST-inclusive price (1/11) until the GST is typed by hand
      if (!gstTouched.current && !x.noGst && (x.section === "s05" ? registered : true)) {
        const n = Number(v.replace(/[$,\s]/g, ""));
        next.gst = v.trim() && Number.isFinite(n) ? (Math.round((n / 11) * 100) / 100).toFixed(2) : "";
      }
      return next;
    });
  };

  const submit = () => {
    const e = validate(d, years);
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(d, removed);
  };

  const field = (f: Field) => {
    const k = `details.${f.k}`, v = d.details[f.k];
    if (f.t === "check") return <Tick key={f.k} label={f.l} checked={!!v} onChange={(x) => setDetail(f.k, x)} />;
    if (f.t === "sel") return <Choice key={f.k} label={f.l} value={String(v ?? "")} options={f.opts ?? []} onChange={(x) => setDetail(f.k, x)} error={errors[k]} />;
    return (
      <Text key={f.k} label={f.l} value={String(v ?? "")} onChange={(x) => setDetail(f.k, x)} error={errors[k]} required={f.req}
        type={f.t === "date" ? "date" : "text"} money={f.t === "money"} inputMode={f.t === "num" ? "decimal" : undefined} />
    );
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>{d.id ? "Edit record" : "Add a record"}</Card.Title>
        {g && <Card.Description>{g.sub}</Card.Description>}
      </Card.Header>
      <Card.Content>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice label={d.section === "s05" ? "ABN holder" : "Whose"} value={d.owner} options={owners} onChange={(v) => set("owner", v)} />
            {d.owner === SHARED && (
              <Text label={`${people[0]}'s share %`} value={d.sharePct} onChange={(v) => set("sharePct", v)} error={errors.sharePct}
                inputMode="decimal" description={`${people[1]} gets the rest`} />
            )}
            <Text label={g?.dateLabel ?? (d.section === "s05" ? "Invoice date" : d.section === "s07a" ? "Week starting" : "Date")}
              type="date" value={d.date} onChange={(v) => { if (!d.id && d.paid === d.date) set("paid", v); set("date", v); }} error={errors.date} required />
          </div>

          {g && <div className="grid gap-3 sm:grid-cols-3">{g.fields.map(field)}</div>}

          {d.section === "s07a" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Hours worked from home" value={d.hours} onChange={(v) => set("hours", v)} error={errors.hours} inputMode="decimal" required />
              <Choice label="For" value={d.use === "business" ? "Business (ABN)" : "Employment"} options={["Employment", "Business (ABN)"]}
                onChange={(v) => set("use", v === "Employment" ? "work" : "business")} />
            </div>
          )}

          {d.section === "s08" && (
            <TextField className="w-full" value={d.description} onChange={(v) => set("description", v)} isInvalid={!!errors.description}>
              <Label>Note for the agent</Label>
              <TextArea rows={4} />
              {errors.description && <FieldError>{errors.description}</FieldError>}
            </TextField>
          )}

          {(d.section === "s05" || d.section === "s07") && (
            <>
              {d.section === "s05" && (
                <Choice label="Money" value={d.direction === "income" ? "Income (a sale)" : "Expense (a purchase)"}
                  options={["Income (a sale)", "Expense (a purchase)"]} onChange={(v) => set("direction", v.startsWith("Income") ? "income" : "expense")}
                  className="w-full sm:w-1/3" />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Text label={d.section === "s05" && d.direction === "income" ? "Client" : "Supplier"} value={d.party} onChange={(v) => set("party", v)} error={errors.party} />
                <Text label="What for" value={d.description} onChange={(v) => set("description", v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Text label="Amount incl. GST" value={d.amount} onChange={setAmount} error={errors.amount} money required />
                {!d.noGst && (
                  <Text label="GST" value={d.gst} onChange={(v) => { gstTouched.current = true; set("gst", v); }} error={errors.gst} money
                    description={d.section === "s05" && !registered ? "Not GST-registered: GST is part of the cost" : "From the tax invoice"} />
                )}
                <div className="flex items-end pb-2"><Tick label="No GST on this" checked={d.noGst} onChange={(v) => set("noGst", v)} /></div>
              </div>
              {d.section === "s07" && (
                <Choice label="Category" value={d.category} options={WORK_CATS} onChange={(v) => set("category", v)} />
              )}
              {d.section === "s05" && d.direction === "expense" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Choice label="Expense category" value={d.bizCategory} options={BIZ_CATS} onChange={(v) => set("bizCategory", v)} className="sm:col-span-2" />
                  <Text label="Business use %" value={d.apportion} onChange={(v) => set("apportion", v)} error={errors.apportion} inputMode="decimal" />
                </div>
              )}
              {d.section === "s05" && (
                <div className="grid items-end gap-3 sm:grid-cols-3">
                  {!d.unpaid && <Text label={d.direction === "income" ? "Date received" : "Date paid"} type="date" value={d.paid} onChange={(v) => set("paid", v)} error={errors.paid} />}
                  <div className="pb-2"><Tick label={d.direction === "income" ? "Not received yet" : "Not paid yet"} checked={d.unpaid} onChange={(v) => set("unpaid", v)} /></div>
                </div>
              )}
            </>
          )}

          {d.section !== "s07a" && d.section !== "s08" && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
              <span className="text-sm font-medium">Evidence{g?.doc ? ` (${g.doc})` : ""}</span>
              {d.keepFiles.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {d.keepFiles.map((f) => (
                    <li key={f} className="flex items-center gap-1 rounded-full bg-surface px-3 py-1">
                      {f.replace(/_[a-z0-9]{10}(\.[a-z0-9]+)$/i, "$1")}
                      <button type="button" aria-label={`Remove ${f}`} className="text-muted hover:text-danger"
                        onClick={() => { setRemoved((r) => [...r, f]); set("keepFiles", d.keepFiles.filter((x) => x !== f)); }}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              {d.newFiles.length > 0 && <p className="text-sm">Adding: {d.newFiles.map((f) => f.name).join(", ")}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileInput} type="file" multiple accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => set("newFiles", [...d.newFiles, ...Array.from(e.target.files ?? [])])} />
                <Button size="sm" variant="secondary" onPress={() => fileInput.current?.click()}>Attach receipt or statement</Button>
                <Tick label="I have it on paper / elsewhere" checked={d.evidenceTick} onChange={(v) => set("evidenceTick", v)} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" isPending={saving}>{d.id ? "Save changes" : "Add"}</Button>
            <Button variant="tertiary" onPress={onCancel}>Cancel</Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}
