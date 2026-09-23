import { Alert, Button, Card, toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Engine, Row, SectionId } from "@workpapers/core";
import { useState } from "react";
import type { LoadedLedger, StoredRow } from "../data/ledger";
import { blankDraft, deleteRow, draftFrom, fileUrl, saveDraft, SHARED, type Draft } from "../data/rowsApi";
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

/** One schedule: totals, the entry form, and its records with edit and delete (with undo). */
export function SectionPage({ e, loaded, section, scope, person, years }: Props) {
  const qc = useQueryClient();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [formKey, setFormKey] = useState(0);
  const setDraft = (d: Draft | null) => { setDraftState(d); setFormKey((k) => k + 1); };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "ours"] });

  const defaultDate = () => {
    const t = todayISO(), fyOfT = Number(t.slice(5, 7)) >= 7 ? Number(t.slice(0, 4)) + 1 : Number(t.slice(0, 4));
    return fyOfT === e.fy ? t : `${e.fy}-06-30`;
  };
  const defaultOwner = person !== "Household" ? person : section === "i10" ? SHARED : e.people[0]!;

  const save = async (d: Draft, removed: string[]) => {
    setSaving(true); setError("");
    try {
      await saveDraft(d, loaded.peopleIds, removed);
      await refresh();
      toast(d.id ? "Changes saved" : "Record added", { variant: "success", timeout: 3000 });
      // keep the form open for the next entry when adding; close after an edit
      setDraft(d.id ? null : { ...blankDraft(section, d.owner, d.date), direction: d.direction, use: d.use, bizCategory: d.bizCategory, category: d.category });
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
        actionProps: { children: "Undo", variant: "tertiary", onPress: async () => { toast.close(id); await undo(); await refresh(); } },
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
            <div><Button variant="primary" onPress={() => setDraft(blankDraft(section, defaultOwner, defaultDate()))}>Add a record</Button></div>
          )}
          {!editable && <p className="text-sm text-muted">The example year is read-only. Switch back to your records to add or change anything.</p>}
        </Card.Content>
      </Card>
      {error && (
        <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>
      )}
      {draft && (
        <EntryForm key={formKey} draft={draft} people={e.people} years={years}
          gstRegistered={(o) => e.gstRegistered(o)} saving={saving} onSave={save} onCancel={() => { setDraft(null); setError(""); }} />
      )}
      <RecordsView e={e} section={section} scope={scope}
        onEdit={editable ? (r) => { setDraft(draftFrom(r as StoredRow)); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
        onDelete={editable ? remove : undefined}
        fileUrl={editable ? (r, n) => fileUrl(r as StoredRow, n) : undefined} />
    </>
  );
}
