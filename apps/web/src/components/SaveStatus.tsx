import { Button, Chip } from "@heroui/react";
import { useEffect, useRef, type ReactNode } from "react";

/** "enter-fade" from the second state on, so a page doesn't fade its status in when it opens. */
function useSwapClass() {
  const opened = useRef(false);
  useEffect(() => { opened.current = true; }, []);
  return opened.current ? "enter-fade" : "";
}

interface Props {
  dirty: boolean;             // something differs from what's saved
  saved?: boolean;            // the last thing that happened here was a save
  busy?: boolean;
  onSave?: () => void;        // leave out inside a <form>: Save then submits it
  onUndo: () => void;
  saveLabel?: string;
  undoLabel?: string;
  idle?: ReactNode;           // shown beside "No changes", e.g. a Close button
}

/** Stands in for an always-there Save button: says "No changes", offers Save once something changes, then "Changes saved". */
export function SaveStatus(p: Props) {
  const swap = useSwapClass(), state = p.dirty ? "dirty" : p.saved ? "saved" : "idle";
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <span role="status">
        <span key={state} className={`inline-flex ${swap}`}>
          {p.dirty ? <Chip size="sm" color="warning">Unsaved changes</Chip>
            : p.saved ? <Chip size="sm" color="success">Changes saved</Chip>
            : <span className="text-sm text-muted">No changes</span>}
        </span>
      </span>
      {p.dirty ? (
        <>
          {p.onSave
            ? <Button size="sm" variant="primary" isPending={p.busy} onPress={p.onSave}>{p.saveLabel ?? "Save"}</Button>
            : <Button size="sm" variant="primary" isPending={p.busy} type="submit">{p.saveLabel ?? "Save"}</Button>}
          <Button size="sm" variant="tertiary" isDisabled={p.busy} onPress={p.onUndo}>{p.undoLabel ?? "Undo"}</Button>
        </>
      ) : p.idle}
    </div>
  );
}

/** For a form that saves by itself: says what just happened, and offers another go if a save didn't go through. */
export function AutoSaveStatus(p: { saving?: boolean; saved?: boolean; waiting?: boolean; invalid?: string; error?: string; onRetry?: () => void }) {
  const swap = useSwapClass();
  const state = p.invalid ? "invalid" : p.error ? "error" : p.saving ? "saving" : p.waiting ? "waiting" : p.saved ? "saved" : "idle";
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2 text-sm">
      <span role="status" key={state} className={`flex flex-wrap items-center gap-2 ${swap}`}>
        {p.invalid ? <Chip size="sm" color="danger">{p.invalid}</Chip>
          : p.error ? <><Chip size="sm" color="danger">Not saved</Chip><span className="text-muted">{p.error}</span></>
          : p.saving ? <span className="text-muted">Saving…</span>
          : p.waiting ? <span className="text-muted">Saves when you click away</span>
          : p.saved ? <Chip size="sm" color="success">Changes saved</Chip>
          : <span className="text-muted">No changes</span>}
      </span>
      {!p.invalid && p.error && p.onRetry && <Button size="sm" variant="secondary" onPress={p.onRetry}>Try again</Button>}
    </div>
  );
}
