import { AlertDialog, Button, Dropdown, Label, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

/** The less common things you can do to one row, tucked behind a single button. */
export function RowMenu(p: { label: string; items: { id: string; label: string; danger?: boolean }[]; onAction: (id: string) => void }) {
  return (
    <Dropdown>
      <Button size="sm" variant="ghost" aria-label={p.label}>More</Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(k) => p.onAction(String(k))}>
          {p.items.map((i) => (
            <Dropdown.Item key={i.id} id={i.id} textValue={i.label} variant={i.danger ? "danger" : undefined}><Label>{i.label}</Label></Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** A few words of explanation that appear when you rest on, or tab to, a button. The child must be a Button. */
export function Hint({ text, children }: { text: ReactNode; children: ReactNode }) {
  return (
    <Tooltip delay={300}>
      {children}
      <Tooltip.Content className="max-w-xs">{text}</Tooltip.Content>
    </Tooltip>
  );
}

/** Asks "are you sure?" before something that can't be taken back. */
export function Confirm(p: { trigger: ReactNode; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      {p.trigger}
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header><AlertDialog.Heading>{p.title}</AlertDialog.Heading></AlertDialog.Header>
            <AlertDialog.Body>{p.children}</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">Cancel</Button>
              <Button slot="close" variant={p.danger ? "danger" : "primary"} onPress={p.onConfirm}>{p.confirmLabel}</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
