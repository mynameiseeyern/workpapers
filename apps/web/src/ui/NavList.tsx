import { Header, ListBox } from "@heroui/react";
import type { ReactNode } from "react";

export interface NavItem { id: string; label: string; trailing?: ReactNode; indent?: boolean; quiet?: boolean }
export interface NavGroup { title?: string; items: NavItem[] }

/** The list of screens down the side. One is always current; picking another goes there. */
export function NavList({ label, groups, current, onNavigate }: { label: string; groups: NavGroup[]; current: string; onNavigate: (id: string) => void }) {
  return (
    <ListBox aria-label={label} selectionMode="single" disallowEmptySelection selectedKeys={[current]}
      onSelectionChange={(keys) => { const k = keys === "all" ? undefined : [...keys][0]; if (k != null) onNavigate(String(k)); }}>
      {groups.map((g, i) => (
        <ListBox.Section key={g.title ?? `g${i}`}>
          {g.title && <Header>{g.title}</Header>}
          {g.items.map((it) => (
            <ListBox.Item key={it.id} id={it.id} textValue={it.label} className={`data-[selected=true]:bg-accent-soft data-[selected=true]:font-medium data-[selected=true]:text-accent-soft-foreground ${it.indent ? "pl-5" : ""} ${it.quiet ? "text-muted" : ""}`}>
              <span className="flex-1 truncate">{it.label}</span>
              {it.trailing != null && <span className="figure text-xs text-muted">{it.trailing}</span>}
            </ListBox.Item>
          ))}
        </ListBox.Section>
      ))}
    </ListBox>
  );
}
