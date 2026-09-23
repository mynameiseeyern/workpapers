import { Button, toast } from "@heroui/react";
import { Agentation, type Annotation } from "agentation";
import { useState } from "react";
import { pb } from "../data/pb";

export type FeedbackKind = "bug" | "ui" | "ux" | "feature";
const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: "bug", label: "Bug", hint: "Something's wrong or broken" },
  { id: "ui", label: "UI", hint: "How it looks: layout, spacing, wording" },
  { id: "ux", label: "UX / flow", hint: "How it works: steps, order, behaviour" },
  { id: "feature", label: "Feature", hint: "Something new" },
];

/**
 * Feedback mode: Agentation's toolbar for clicking or dragging over the page and leaving notes, plus a picker
 * for what kind of feedback it is. "Send" goes to the NAS, which saves it and opens a GitHub issue.
 */
export function FeedbackMode({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>("ui");

  const send = async (_markdown: string, annotations: Annotation[]) => {
    const notes = annotations.filter((a) => (a.kind ?? "feedback") === "feedback");
    const res = await pb.send("/api/workpapers/feedback", {
      method: "POST",
      body: {
        kind, page: window.location.search.replace(/^\?/, ""),
        annotations: notes.map((a) => ({
          comment: a.comment, element: a.element, elementPath: a.elementPath, reactComponents: a.reactComponents,
          selectedText: a.selectedText, nearbyText: a.nearbyText, boundingBox: a.boundingBox,
        })),
      },
    });
    if (res.issue) {
      toast(`Sent as issue #${res.issue.number}`, {
        variant: "success", timeout: 6000,
        actionProps: { children: "Open", variant: "tertiary", onPress: () => window.open(res.issue.url, "_blank", "noopener") },
      });
    } else {
      toast("Feedback saved", { description: res.note, timeout: 8000 });
    }
  };

  return (
    <>
      <div role="region" aria-label="Feedback mode"
        className="fixed top-3 left-1/2 z-[60] flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-separator bg-surface px-3 py-2 shadow-lg">
        <span className="text-sm font-semibold">Feedback</span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Kind of feedback">
          {KINDS.map((k) => (
            <Button key={k.id} size="sm" variant={kind === k.id ? "primary" : "tertiary"} onPress={() => setKind(k.id)}
              aria-pressed={kind === k.id} aria-label={`${k.label}: ${k.hint}`}>{k.label}</Button>
          ))}
        </div>
        <span className="hidden text-xs text-muted sm:inline">{KINDS.find((k) => k.id === kind)!.hint} · use the toolbar bottom-right, then Send</span>
        <Button size="sm" variant="ghost" onPress={onClose}>Done</Button>
      </div>
      <Agentation appName="Workpapers" onSubmit={send} copyToClipboard={false} enableKeyboardShortcuts={false} />
    </>
  );
}
