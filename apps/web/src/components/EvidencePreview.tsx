import { Button, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";

/** A file to look at: one just picked in the form (not saved yet), or the address of a saved one. */
export interface PreviewFile { name: string; source: File | string }

type Kind = "pdf" | "image" | "other";
const kindOf = (f: PreviewFile): Kind => {
  const type = typeof f.source === "string" ? "" : f.source.type;
  if (type === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf";
  if (type.startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name)) return "image";
  return "other";
};
const WIDE = "(min-width: 80rem)";

/**
 * Shows a receipt or statement beside the page on a wide screen, and over the whole screen on a phone.
 * A saved PDF is fetched and shown from memory, so the browser's PDF viewer treats it the same as one just picked.
 */
export function EvidencePreview({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const kind = kindOf(file);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let made = "", stale = false;
    setUrl(""); setFailed(false);
    const src = file.source;
    if (typeof src !== "string") { made = URL.createObjectURL(src); setUrl(made); }
    else if (kind !== "pdf") setUrl(src);
    else {
      fetch(src).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
        .then((b) => { if (stale) return; made = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); setUrl(made); })
        .catch(() => { if (!stale) setFailed(true); });
    }
    return () => { stale = true; if (made) URL.revokeObjectURL(made); };
  }, [file, kind]);

  // The page makes room for the panel on a wide screen (see styles.css).
  useEffect(() => {
    document.documentElement.dataset.evidencePreview = "open";
    return () => { delete document.documentElement.dataset.evidencePreview; };
  }, []);

  // Escape closes it when it covers the screen; beside the page it stays put while you type.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape" && !window.matchMedia(WIDE).matches) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const href = typeof file.source === "string" ? file.source : url;
  return (
    <aside role="dialog" aria-label={`Preview of ${file.name}`}
      className="fixed inset-0 z-40 flex flex-col bg-surface xl:top-[53px] xl:left-auto xl:z-10 xl:w-[min(36vw,40rem)] xl:border-l xl:border-separator">
      <div className="flex items-center gap-3 border-b border-separator px-4 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>{file.name}</span>
        {href && <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-accent underline-offset-2 hover:underline">Open in a new tab ↗</a>}
        <Button size="sm" variant="tertiary" onPress={onClose}>Close</Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-secondary">
        {failed || kind === "other" ? (
          <p className="p-6 text-center text-sm text-muted">
            {failed ? "Couldn't show this file here." : "This kind of file can't be shown here."} Try opening it in a new tab.
          </p>
        ) : !url ? <Spinner />
          : kind === "pdf" ? <iframe title={file.name} src={`${url}#navpanes=0&view=FitH`} className="h-full w-full border-0" />
          : <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" onError={() => setFailed(true)} />}
      </div>
    </aside>
  );
}
