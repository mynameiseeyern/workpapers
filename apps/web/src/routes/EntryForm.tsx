import { Alert, Button, Card, Checkbox, ComboBox, Description, FieldError, Input, Label, ListBox, Select, Spinner, TextArea, TextField } from "@heroui/react";
import { BIZ_CATS, formatMoney, readFigures, SCHEDULES, toCents, WORK_CATS, type Field, type SectionId } from "@workpapers/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SaveStatus } from "../components/SaveStatus";
import { useSwapClass } from "../ui/motion";
import { fileLabel, SHARED, validate, type Draft } from "../data/rowsApi";

interface Props {
  draft: Draft;
  people: string[];
  years: number[];
  gstRegistered: (o: string) => boolean;
  saving: boolean;
  onSave: (d: Draft, removedFiles: string[]) => void;
  onCancel: () => void;
  /** What's been typed before in a text box ("party", "description" or "details.<key>"), most used first. */
  usedBefore?: (field: string, direction?: "income" | "expense") => string[];
  /** Look at an attached file: one just picked (a File) or a saved one (its stored name). */
  onView?: (f: File | string) => void;
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

/** A text box that offers what has been typed in it before. Anything new can still be typed. */
function Suggest(p: { label: string; value: string; onChange: (v: string) => void; options: string[]; error?: string; required?: boolean; className?: string }) {
  if (!p.options.length) return <Text label={p.label} value={p.value} onChange={p.onChange} error={p.error} required={p.required} className={p.className} />;
  return (
    <ComboBox allowsCustomValue menuTrigger="focus" validationBehavior="aria" className={p.className ?? "w-full"} inputValue={p.value} onInputChange={p.onChange}
      isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <ComboBox.InputGroup><Input /><ComboBox.Trigger /></ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>{p.options.map((o) => <ListBox.Item key={o} id={o} textValue={o}>{o}</ListBox.Item>)}</ListBox>
      </ComboBox.Popover>
      {p.error && <FieldError>{p.error}</FieldError>}
    </ComboBox>
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
export function EntryForm({ draft, people, years, gstRegistered, saving, onSave, onCancel, onView, usedBefore }: Props) {
  const [d, setD] = useState<Draft>(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const gstTouched = useRef(!!draft.gst);
  const fileInput = useRef<HTMLInputElement>(null);
  const arrive = useSwapClass();   // boxes that appear after a choice fade in; nothing fades just because the form opened
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // ----- Reading the figures off an attached document (new records only). Fills empty boxes; never changes what's been typed. -----
  const [reading, setReading] = useState("");
  const [read, setRead] = useState<{ file: File; filled: string[]; how: "text" | "ocr"; trouble?: string } | null>(null);
  const latest = useRef(d);
  latest.current = d;
  const readFrom = async (file: File) => {
    setRead(null);
    try {
      const { canRead, documentText } = await import("../data/documentText");
      if (!canRead(file)) return setRead({ file, filled: [], how: "text", trouble: "This kind of file can't be read. A PDF, JPG or PNG can." });
      const doc = await documentText(file, setReading);
      const now = latest.current, sched = SCHEDULES[now.section];
      const r = readFigures(doc.text, { section: now.section, known: sched ? usedBefore?.("details.party") ?? [] : usedBefore?.("party", now.direction) ?? [] });
      const filled: string[] = [], next: Draft = { ...now, details: { ...now.details } };
      const dollars = (c: number) => (c / 100).toFixed(2);
      const fyOf = (x: string) => (Number(x.slice(5, 7)) >= 7 ? Number(x.slice(0, 4)) + 1 : Number(x.slice(0, 4)));
      const shown = (x: string) => new Date(`${x}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
      // the date box starts on a default, so the document's date replaces it unless it has been changed by hand
      if (r.date && now.date === draft.date && years.includes(fyOf(r.date))) {
        if (now.paid === now.date) next.paid = r.date;
        next.date = r.date; filled.push(`Date ${shown(r.date)}`);
      }
      if (sched) {
        for (const f of sched.fields) {
          const empty = !String(now.details[f.k] ?? "").trim();
          if (f.t === "money" && r.details[f.k] != null && empty) { next.details[f.k] = dollars(r.details[f.k]!); filled.push(`${f.l} ${formatMoney(r.details[f.k]!)}`); }
          if (f.k === "party" && r.party && empty) { next.details[f.k] = r.party; filled.push(`${f.l}: ${r.party}`); }
        }
      } else {
        if (r.amount != null && !now.amount.trim()) { next.amount = dollars(r.amount); filled.push(`Amount ${formatMoney(r.amount)}`); }
        if (r.gst != null && !now.gst.trim() && !now.noGst) { next.gst = dollars(r.gst); gstTouched.current = true; filled.push(`GST ${formatMoney(r.gst)}`); }
        if (r.party && !now.party.trim()) { next.party = r.party; filled.push(`${now.section === "s05" && now.direction === "income" ? "Client" : "Supplier"}: ${r.party}`); }
      }
      setD(next);
      setRead({ file, filled, how: doc.how });
      // beside the form on a wide screen, so each figure can be checked against the page
      if (filled.length && window.matchMedia("(min-width: 80rem)").matches) onView?.(file);
    } catch (err) {
      console.warn("Couldn't read the document", err);
      setRead({ file, filled: [], how: "text", trouble: "Couldn't read this file. The boxes can still be filled in by hand." });
    } finally { setReading(""); }
  };
  const attach = (files: File[]) => {
    if (!files.length) return;
    set("newFiles", [...d.newFiles, ...files]);
    if (!d.id) void readFrom(files[0]!);
  };
  // "Add from a document" opens the form with the file already attached
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (!draft.id && draft.newFiles[0]) void readFrom(draft.newFiles[0]);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const setDetail = (k: string, v: string | boolean) => setD((x) => ({ ...x, details: { ...x.details, [k]: v } }));
  const g = SCHEDULES[d.section];
  const owners = ownerOptions(d.section, people);
  const registered = d.owner !== SHARED && gstRegistered(d.owner);
  // an edit only offers Save once something differs from the saved record
  const dirty = removed.length > 0 || d.newFiles.length > 0 || JSON.stringify({ ...d, newFiles: 0 }) !== JSON.stringify({ ...draft, newFiles: 0 });

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

  // For a shared record, each amount shows who gets what as it's typed (rounded per person, as the engine does).
  const split = (typed: string): string | undefined => {
    if (d.owner !== SHARED || !typed.trim() || !d.sharePct.trim()) return undefined;
    const amount = Number(typed.replace(/[$,\s]/g, "")), p = Number(d.sharePct);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(p) || p < 0 || p > 100) return undefined;
    const cents = toCents(amount);
    return `${people[0]} ${formatMoney(Math.round(cents * (p / 100)))} · ${people[1]} ${formatMoney(Math.round(cents * ((100 - p) / 100)))}`;
  };

  const field = (f: Field) => {
    const k = `details.${f.k}`, v = d.details[f.k];
    if (f.t === "check") return <Tick key={f.k} label={f.l} checked={!!v} onChange={(x) => setDetail(f.k, x)} />;
    if (f.t === "sel") return <Choice key={f.k} label={f.l} value={String(v ?? "")} options={f.opts ?? []} onChange={(x) => setDetail(f.k, x)} error={errors[k]} />;
    if (f.t === "text") return <Suggest key={f.k} label={f.l} value={String(v ?? "")} onChange={(x) => setDetail(f.k, x)} error={errors[k]} required={f.req} options={usedBefore?.(k) ?? []} />;
    return (
      <Text key={f.k} label={f.l} value={String(v ?? "")} onChange={(x) => setDetail(f.k, x)} error={errors[k]} required={f.req}
        type={f.t === "date" ? "date" : "text"} money={f.t === "money"} inputMode={f.t === "num" ? "decimal" : undefined}
        description={f.t === "money" ? split(String(v ?? "")) : undefined} />
    );
  };

  return (
    <Card className="enter">
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
                inputMode="decimal" description={`${people[1]} gets the rest`} className={`w-full ${arrive}`} />
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
                <Suggest label={d.section === "s05" && d.direction === "income" ? "Client" : "Supplier"} value={d.party} onChange={(v) => set("party", v)} error={errors.party}
                  options={usedBefore?.("party", d.direction) ?? []} />
                <Suggest label="What for" value={d.description} onChange={(v) => set("description", v)} options={usedBefore?.("description", d.direction) ?? []} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Text label="Amount incl. GST" value={d.amount} onChange={setAmount} error={errors.amount} money required description={split(d.amount)} />
                {!d.noGst && (
                  <Text label="GST" value={d.gst} onChange={(v) => { gstTouched.current = true; set("gst", v); }} error={errors.gst} money
                    description={d.section === "s05" && !registered ? "Not GST-registered: GST is part of the cost" : "From the tax invoice"} className={`w-full ${arrive}`} />
                )}
                <div className="flex items-end pb-2"><Tick label="No GST on this" checked={d.noGst} onChange={(v) => set("noGst", v)} /></div>
              </div>
              {d.section === "s07" && (
                <Choice label="Category" value={d.category} options={WORK_CATS} onChange={(v) => set("category", v)} />
              )}
              {d.section === "s05" && d.direction === "expense" && (
                <div className={`grid gap-3 sm:grid-cols-3 ${arrive}`}>
                  <Choice label="Expense category" value={d.bizCategory} options={BIZ_CATS} onChange={(v) => set("bizCategory", v)} className="sm:col-span-2" />
                  <Text label="Business use %" value={d.apportion} onChange={(v) => set("apportion", v)} error={errors.apportion} inputMode="decimal" />
                </div>
              )}
              {d.section === "s05" && (
                <div className="grid items-end gap-3 sm:grid-cols-3">
                  {!d.unpaid && <Text label={d.direction === "income" ? "Date received" : "Date paid"} type="date" value={d.paid} onChange={(v) => set("paid", v)} error={errors.paid} className={`w-full ${arrive}`} />}
                  <div className="pb-2"><Tick label={d.direction === "income" ? "Not received yet" : "Not paid yet"} checked={d.unpaid} onChange={(v) => set("unpaid", v)} /></div>
                </div>
              )}
            </>
          )}

          {d.section !== "s07a" && d.section !== "s08" && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
              <span className="text-sm font-medium">Evidence{g?.doc ? ` (${g.doc})` : ""}</span>
              {d.keepFiles.length + d.newFiles.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {d.keepFiles.map((f) => (
                    <li key={f} className="flex items-center gap-1 rounded-2xl bg-surface py-1 pr-1 pl-3">
                      <span className="min-w-0 flex-1 truncate">{fileLabel(f)}</span>
                      {onView && <Button size="sm" variant="ghost" onPress={() => onView(f)} aria-label={`View ${fileLabel(f)}`}>View</Button>}
                      <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove ${fileLabel(f)}`}
                        onPress={() => { setRemoved((r) => [...r, f]); set("keepFiles", d.keepFiles.filter((x) => x !== f)); }}>Remove</Button>
                    </li>
                  ))}
                  {d.newFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-2xl bg-surface py-1 pr-1 pl-3">
                      <span className="min-w-0 flex-1 truncate">{f.name} <span className="text-muted">· not saved yet</span></span>
                      {onView && <Button size="sm" variant="ghost" onPress={() => onView(f)} aria-label={`View ${f.name}`}>View</Button>}
                      <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove ${f.name}`}
                        onPress={() => set("newFiles", d.newFiles.filter((x) => x !== f))}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
              {reading && <p className="flex items-center gap-2 text-sm text-muted" role="status"><Spinner size="sm" />{reading}</p>}
              {read && !reading && (
                <Alert status={read.trouble || !read.filled.length ? "warning" : "accent"} className="enter">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      {read.trouble ?? (read.filled.length ? `Filled in from ${read.file.name}` : `Couldn't find any figures in ${read.file.name}`)}
                    </Alert.Title>
                    <Alert.Description>
                      {read.filled.length > 0 && <span className="block">{read.filled.join(" · ")}</span>}
                      {read.filled.length > 0
                        ? (read.how === "ocr" ? "This was read from a picture, so check every digit against the document before adding." : "Check each one against the document before adding.")
                        : !read.trouble && "The boxes can still be filled in by hand."}
                      {read.filled.length > 0 && d.section === "i01" && " On a payslip the year-to-date column is used."}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileInput} type="file" multiple accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => { attach(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                <Button size="sm" variant="secondary" onPress={() => fileInput.current?.click()}>Attach receipt or statement</Button>
                <Tick label="I have it on paper / elsewhere" checked={d.evidenceTick} onChange={(v) => set("evidenceTick", v)} />
              </div>
            </div>
          )}

          {d.id ? (
            <SaveStatus dirty={dirty} busy={saving} saveLabel="Save changes" undoLabel="Cancel" onUndo={onCancel}
              idle={<Button size="sm" variant="tertiary" onPress={onCancel}>Close</Button>} />
          ) : (
            <div className="flex gap-2">
              <Button type="submit" variant="primary" isPending={saving}>Add</Button>
              <Button variant="tertiary" onPress={onCancel}>Cancel</Button>
            </div>
          )}
        </form>
      </Card.Content>
    </Card>
  );
}
