import { APP_VERSION } from "../version";
import { Alert, Button, Label, ListBox, Select, Separator, Tabs } from "@heroui/react";
import { formatMoney, fyLabel } from "@workpapers/core";
import { useState, type ReactNode } from "react";
import { SECTIONS, type Group } from "../data/sections";
import { pb } from "../data/pb";
import type { NavState } from "../data/navigation";

interface Props {
  view: string; fy: number; person: string; years: number[]; people: string[];
  onNavigate: (view: string) => void; onYear: (fy: number) => void; onPerson: (p: string) => void;
  onSignOut: () => void; children: ReactNode;
  example: boolean; onExample: (on: boolean) => void; nav?: NavState;
}
const GROUPS: Group[] = ["", "Income", "Business", "Deductions", "Other", "Tools"];

export function AppShell(p: Props) {
  const [navOpen, setNavOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const totals = p.nav?.totals ?? {};
  const shown = (id: string) => !p.nav || p.nav.visible.has(id);
  const more = p.nav?.more ?? [];
  const current = SECTIONS.find((s) => s.id === p.view);
  const go = (id: string) => { p.onNavigate(id); setNavOpen(false); };

  const navItem = (s: (typeof SECTIONS)[number], muted: boolean) => (
    <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={p.view === s.id ? "page" : undefined}
      className={`flex w-full items-center rounded-2xl px-2.5 py-1.5 text-left text-sm ${s.parent ? "pl-7 text-[13px]" : ""} ${muted ? "text-muted" : ""} ${p.view === s.id ? "bg-accent-soft font-semibold text-accent-soft-foreground" : "hover:bg-surface-secondary"}`}>
      <span className="flex-1">{s.name}</span>
      {!muted && totals[s.id] != null && <span className="ml-2 text-xs tabular-nums text-muted">{formatMoney(totals[s.id]!).replace(/\.\d\d$/, "")}</span>}
    </button>
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-separator bg-surface px-5 py-2.5">
        <h1 className="text-base font-semibold">Workpapers</h1>
        <span className="flex-1" />
        <Tabs selectedKey={p.person} onSelectionChange={(k) => p.onPerson(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Whose workpapers">
              {["Household", ...p.people].map((name) => (
                <Tabs.Tab key={name} id={name}>{name}<Tabs.Indicator /></Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="flex w-full shrink-0 flex-col border-b border-separator bg-surface p-3 md:sticky md:top-[53px] md:h-[calc(100vh-53px)] md:w-60 md:overflow-y-auto md:border-r md:border-b-0" aria-label="Sections">
          <Select value={p.fy} onChange={(v) => v != null && p.onYear(Number(v))} className="w-full">
            <Label>Financial year</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {p.years.map((y) => (
                  <ListBox.Item key={y} id={y} textValue={fyLabel(y)}>{fyLabel(y)}<ListBox.ItemIndicator /></ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Button className="mt-2" variant={p.example ? "primary" : "tertiary"} size="sm" fullWidth onPress={() => p.onExample(!p.example)}>
            {p.example ? "Back to our records" : "Show the example year"}
          </Button>

          <Button className="mt-2 md:hidden" variant="secondary" size="sm" fullWidth onPress={() => setNavOpen((o) => !o)} aria-expanded={navOpen}>
            {current?.name ?? "Sections"} ▾
          </Button>

          <div className={`${navOpen ? "flex" : "hidden"} mt-3 flex-1 flex-col md:flex`}>
            {GROUPS.map((g) => {
              const items = SECTIONS.filter((s) => s.group === g && !s.hidden && shown(s.id));
              const moreHere = g === "Tools" && more.length > 0;
              if (!items.length && !moreHere) return null;
              return (
                <div key={g || "top"} className="mb-2">
                  {moreHere && (
                    <div className="mb-2">
                      <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
                        className="w-full rounded-2xl px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-secondary">
                        {showMore ? "− Hide empty schedules" : `+ ${more.length} more schedule${more.length === 1 ? "" : "s"}`}
                      </button>
                      {showMore && SECTIONS.filter((s) => more.includes(s.id)).map((s) => navItem(s, true))}
                    </div>
                  )}
                  {g && items.length > 0 && <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wider text-muted uppercase">{g}</div>}
                  {items.map((s) => navItem(s, false))}
                </div>
              );
            })}
            <Separator className="my-2" />
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted">
              <span>Signed in as {pb.authStore.record?.["name"] || pb.authStore.record?.["email"]}</span>
              <Button size="sm" variant="ghost" onPress={p.onSignOut}>Sign out</Button>
            </div>
            <div className="px-1 pt-1 text-[11px] text-muted" title="The commit this build came from">Version {APP_VERSION}</div>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-4 pt-5 pb-20 md:px-6">
          {p.example && (
            <Alert status="accent" className="mb-4 max-w-4xl">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Example year</Alert.Title>
                <Alert.Description>Made-up figures for two people, showing how records flow into the BAS and the tax return. Nothing here is saved or mixed with your records.</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {p.children}
        </main>
      </div>
    </div>
  );
}
