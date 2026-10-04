import { Alert, Button, Card, toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { SCHEDULES, type Engine, type Row, type SectionId } from "@workpapers/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentText } from "../data/documentText";
import type { LoadedLedger, StoredRow } from "../data/ledger";
import { EvidencePreview, type PreviewFile } from "../components/EvidencePreview";
import { blankDraft, deleteRow, draftFrom, fileLabel, fileUrl, saveDraft, SHARED, type Draft } from "../data/rowsApi";
import { sectionById } from "../data/sections";
import { usedBefore } from "../data/suggestions";
import { EntryForm } from "./EntryForm";
import { RecordsView, SectionTotals } from "./Figures";

interface Props { e: Engine; loaded: LoadedLedger; section: SectionId; scope: string[]; person: string; years: number[] }

const todayISO = () => new Date().toLocaleDateString("en-CA");

const FIELD_NAMES: Record<string, string> = { files: "Attached file", date: "Date", paid: "Date paid", amount_cents: "Amount", owner: "Whose" };
/** Turn a PocketBase error into a sentence that says which field was the problem. */
function explain(x: unknown, fallback: string): string {
  const data = (x as { response?: { data?: Record<string, { message?: string }> } }).response?.data ?? {};
  const parts = Object.entries(data).map(([k, v]) => `${FIELD_NAMES[k] ?? k}: ${v?.message ?? "invalid"}`);
  if (parts.length) return `${fallback}. ${parts.join("; ")}`;
  return (x as Error)?.message || fallback;
}

/** A kind word after each new record. They take turns, so the same one never comes twice in a row. */
const CHEERS = [
  "Nice one, that's in.",
  "Added. One less thing for tax time.",
  "Done. Future you says thanks.",
  "Got it. The books are looking good.",
  "Recorded. Keep them coming.",
  "Sorted. That's another one down.",
];
let turn = 0;
const cheer = () => CHEERS[turn++ % CHEERS.length]!;

/** Several documents picked at once: each becomes its own record, one after the other. */
interface Queue { files: File[]; at: number; added: number }
const WIDE = "(min-width: 80rem)";
const docs = (n: number) => `${n} document${n === 1 ? "" : "s"}`;

/** One schedule: totals, the entry form, and its records with edit and delete (with undo). */
export function SectionPage({ e, loaded, section, scope, person, years }: Props) {
  const qc = useQueryClient();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [formKey, setFormKey] = useState(0);
  const rows = e.ledger.rows;
  const used = useMemo(() => usedBefore(rows, section), [rows, section]);
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  // a new or closed form drops the preview of a file that was only picked, never saved
  const setDraft = (d: Draft | null) => { setDraftState(d); setFormKey((k) => k + 1); setPreview((p) => (p && typeof p.source !== "string" ? null : p)); };
  const viewSaved = (r: Row, name: string) => setPreview({ name: fileLabel(name), source: fileUrl(r as StoredRow, name) });
  const viewFromForm = (f: File | string) => {
    // the same document again (the form asks once it has read it): leave the one on screen alone
    if (typeof f !== "string") return setPreview((p) => (p?.source === f ? p : { name: f.name, source: f }));
    const row = e.rowsIn(section).find((r) => r.id === draft?.id);
    if (row) viewSaved(row, f);
  };
  const [saving, setSaving] = useState(false);
  // "Add from a document": pick a statement, invoice or payslip and the form opens with it attached and its figures read
  const picker = useRef<HTMLInputElement>(null);
  const canAttach = section !== "s07a" && section !== "s08";
  // the record just added or changed is marked in the list for a moment, so you can see where it landed
  const [justSaved, setJustSaved] = useState("");
  const settle = useRef<number | undefined>(undefined);
  const mark = (id: string) => { setJustSaved(id); window.clearTimeout(settle.current); settle.current = window.setTimeout(() => setJustSaved(""), 1600); };
  useEffect(() => () => window.clearTimeout(settle.current), []);
  const [error, setError] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "ours"] });

  // ----- Several documents at once: the form opens on the first, and each Add brings up the next. -----
  const [queue, setQueue] = useState<Queue | null>(null);
  // Each document is read once. While one is being checked the next is read behind it, so it's ready when its turn comes.
  const texts = useRef(new Map<File, Promise<DocumentText>>());
  const says = useRef(new Map<File, (status: string) => void>());
  const textOf = useCallback((file: File, say?: (status: string) => void): Promise<DocumentText> => {
    if (say) says.current.set(file, say);
    let t = texts.current.get(file);
    if (!t) {
      t = import("../data/documentText").then((m) => m.documentText(file, (status) => says.current.get(file)?.(status)));
      t.catch(() => {});   // a document that can't be read is reported by the form when its turn comes
      texts.current.set(file, t);
    }
    return t;
  }, []);
  const forget = () => { texts.current.clear(); says.current.clear(); };
  const readAhead = (q: Queue) => {
    const now = q.files[q.at], next = q.files[q.at + 1];
    if (!now || !next) return;
    void import("../data/documentText").then(async ({ canRead }) => {
      if (canRead(now)) await textOf(now).catch(() => {});
      if (canRead(next)) void textOf(next);
    });
  };

  const defaultDate = () => {
    const t = todayISO(), fyOfT = Number(t.slice(5, 7)) >= 7 ? Number(t.slice(0, 4)) + 1 : Number(t.slice(0, 4));
    return fyOfT === e.fy ? t : `${e.fy}-06-30`;
  };
  // On the Household tab a new record in a schedule that can be shared starts as shared, split evenly; on a person's tab it's theirs.
  const defaultOwner = person !== "Household" ? person : SCHEDULES[section]?.shared ? SHARED : e.people[0]!;

  // "3 records in Interest this year", counting the one just added. Left out when the new record's date falls in another year.
  const tally = (d: Draft): string | undefined => {
    const name = sectionById(section)?.name ?? "this schedule";
    const fyOfDate = Number(d.date.slice(5, 7)) >= 7 ? Number(d.date.slice(0, 4)) + 1 : Number(d.date.slice(0, 4));
    if (section === "s05" || fyOfDate !== e.fy) return undefined;
    const n = e.rowsIn(section).length + 1;
    return n === 1 ? `First one in ${name} this year.` : `${n} records in ${name} this year.`;
  };

  /** Open the form on one document of the queue. The owner and categories carry over from the record before it. */
  const openAt = (q: Queue, from?: Draft) => {
    const file = q.files[q.at]!;
    const blank = blankDraft(section, from?.owner ?? defaultOwner, defaultDate());
    setQueue(q);
    setDraft({ ...blank, ...(from ? { direction: from.direction, use: from.use, bizCategory: from.bizCategory, category: from.category } : {}), newFiles: [file] });
    // beside the form on a wide screen, so the figures can be checked against the page as soon as it opens
    if (window.matchMedia(WIDE).matches) setPreview({ name: file.name, source: file });
    readAhead(q);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /** The queue is over: say how it went. */
  const endQueue = (q: Queue, added: number, stopped = false) => {
    const total = q.files.length, left = total - added;
    setQueue(null); forget(); setDraft(null); setError("");
    if (added === total) toast(`All ${docs(total)} added.`, { description: "One record each. Nicely done.", variant: "success", timeout: 4500 });
    else if (added > 0) toast(`${added} of ${docs(total)} added.`, { description: `${left} ${stopped ? "not added" : "skipped"}. Pick ${left === 1 ? "it" : "them"} again when you're ready.`, variant: "success", timeout: 5500 });
    else toast("No records added.", { description: `${docs(total)} ${stopped ? "not added" : "skipped"}.`, timeout: 4500 });
  };
  const pick = (files: File[]) => {
    if (!files.length) return;
    forget();
    if (files.length === 1) { setQueue(null); setDraft({ ...blankDraft(section, defaultOwner, defaultDate()), newFiles: files }); }
    else openAt({ files, at: 0, added: 0 });
  };
  const skip = () => {
    if (!queue) return;
    setError("");
    if (queue.at + 1 < queue.files.length) openAt({ ...queue, at: queue.at + 1 }, draft ?? undefined);
    else endQueue(queue, queue.added);
  };
  const cancel = () => {
    // closing an edit made part-way through a queue goes back to the document that was waiting
    if (queue && draft?.id) return openAt(queue);
    if (queue) return endQueue(queue, queue.added, true);
    setDraft(null); setError("");
  };

  const save = async (d: Draft, removed: string[]) => {
    setSaving(true); setError("");
    try {
      const saved = await saveDraft(d, loaded.peopleIds, removed);
      await refresh();
      mark(saved.id);
      if (d.id) {
        toast("Changes saved", { variant: "success", timeout: 3000 });
        if (queue) openAt(queue); else setDraft(null);   // close after an edit, or carry on with the queue
      } else if (queue) {
        const added = queue.added + 1;
        if (queue.at + 1 < queue.files.length) {
          toast(cheer(), { description: tally(d), variant: "success", timeout: 3500 });
          openAt({ ...queue, at: queue.at + 1, added }, d);
        } else endQueue(queue, added);
      } else {
        toast(cheer(), { description: tally(d), variant: "success", timeout: 3500 });
        // keep the form open for the next entry
        setDraft({ ...blankDraft(section, d.owner, d.date), direction: d.direction, use: d.use, bizCategory: d.bizCategory, category: d.category });
      }
    } catch (x) {
      setError(explain(x, "Couldn't save"));
    } finally { setSaving(false); }
  };

  const remove = async (r: Row) => {
    try {
      const undo = await deleteRow(r as StoredRow);
      await refresh();
      const hadFiles = ((r as StoredRow).files ?? []).length > 0;
      const id = toast("Record deleted", {
        description: hadFiles ? "Undo brings the record back; its attached files are gone." : undefined,
        timeout: 8000,
        actionProps: { children: "Undo", variant: "tertiary", onPress: async () => { toast.close(id); await undo(); await refresh(); mark(r.id); } },
      });
    } catch (x) {
      setError(explain(x, "Couldn't delete"));
    }
  };

  const editable = loaded.editable;
  return (
    <>
      <Card>
        <Card.Content className="flex flex-col gap-4">
          <SectionTotals e={e} section={section} scope={scope} />
          {editable && !draft && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onPress={() => setDraft(blankDraft(section, defaultOwner, defaultDate()))}>Add a record</Button>
              {canAttach && (
                <>
                  <input ref={picker} type="file" multiple accept="application/pdf,image/*" className="hidden"
                    onChange={(ev) => { const files = Array.from(ev.target.files ?? []); ev.target.value = ""; pick(files); }} />
                  <Button variant="secondary" onPress={() => picker.current?.click()}>Add from documents</Button>
                </>
              )}
            </div>
          )}
        </Card.Content>
      </Card>
      {error && (
        <Alert status="danger" className="enter"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>
      )}
      {draft && (
        <EntryForm key={formKey} draft={draft} people={e.people} years={years}
          gstRegistered={(o) => e.gstRegistered(o)} saving={saving} onSave={save} onCancel={cancel} onView={viewFromForm} usedBefore={used} textOf={textOf}
          queue={queue && !draft.id ? { at: queue.at, of: queue.files.length, onSkip: skip } : undefined} />
      )}
      <RecordsView e={e} section={section} scope={scope}
        onEdit={editable ? (r) => { setDraft(draftFrom(r as StoredRow)); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
        onDelete={editable ? remove : undefined}
        onViewFile={editable ? viewSaved : undefined} highlightId={justSaved} />
      {preview && <EvidencePreview file={preview} onClose={closePreview} />}
    </>
  );
}
