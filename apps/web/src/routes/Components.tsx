import { Button, Typography } from "@heroui/react";
import { useState, type ReactNode } from "react";
import {
  AutoSaveStatus, Choice, Confirm, DataTable, DateBox, Empty, FieldGroup, FigureList, Hint, Money, MoneyBox, NavList, NoteBox, Notice,
  NumberBox, PageHeader, Pill, RowMenu, SaveStatus, Section, Segmented, Stat, StatRow, Suggest, TextBox, Tick, Toggle, type Column,
} from "../ui";

/** One made-up dividend, for showing the table. None of this is real data. */
interface Sample { id: string; date: string; fund: string; who: string; unfranked: number; franked: number; credit: number; evidence: boolean }
const SAMPLE: Sample[] = [
  { id: "a", date: "14 Sep 2026", fund: "Tasman Index Fund", who: "Shared 50/50", unfranked: 18240, franked: 41310, credit: 17704, evidence: true },
  { id: "b", date: "02 Aug 2026", fund: "Harbourline Property Trust", who: "Person A", unfranked: 9675, franked: 0, credit: 0, evidence: false },
  { id: "c", date: "21 Jul 2026", fund: "Coastal Mutual", who: "Person B", unfranked: 0, franked: 26880, credit: 11520, evidence: true },
];
const sum = (k: "unfranked" | "franked" | "credit") => SAMPLE.reduce((a, r) => a + r[k], 0);

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-separator pt-6">
      <div>
        <Typography.Heading level={5}>{title}</Typography.Heading>
        {note && <p className="mt-0.5 max-w-[70ch] text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}
function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-12 w-full rounded-lg border border-border ${className}`} />
      <span className="text-xs text-muted">{name}</span>
    </div>
  );
}

/** Every building block in one place, with made-up data. Open it at ?view=components. */
export function Components() {
  const [text, setText] = useState("Harbourline Savings");
  const [money, setMoney] = useState("1250.00");
  const [pct, setPct] = useState("50");
  const [date, setDate] = useState("2026-09-14");
  const [cat, setCat] = useState("Tools and equipment");
  const [fund, setFund] = useState("");
  const [note, setNote] = useState("");
  const [dir, setDir] = useState("income");
  const [applies, setApplies] = useState("yes");
  const [tick, setTick] = useState(true);
  const [on, setOn] = useState(true);
  const [nav, setNav] = useState("i11");
  const [dirty, setDirty] = useState(true);
  const [formShown, setFormShown] = useState(0);
  const [flash, setFlash] = useState("");

  const columns: Column<Sample>[] = [
    { key: "date", label: "Date", width: "w-28", render: (r) => <span className="whitespace-nowrap">{r.date}</span> },
    { key: "fund", label: "Company or fund", rowHeader: true, render: (r) => (
      <div className="flex flex-col gap-1"><span className="font-medium">{r.fund}</span>{!r.evidence && <span><Pill tone="warn">No statement yet</Pill></span>}</div>
    ), foot: "Total" },
    { key: "who", label: "Whose", render: (r) => <span className="whitespace-nowrap text-muted">{r.who}</span> },
    { key: "unfranked", label: "Unfranked", align: "end", render: (r) => <Money cents={r.unfranked} />, foot: <Money cents={sum("unfranked")} strong /> },
    { key: "franked", label: "Franked", align: "end", render: (r) => <Money cents={r.franked} />, foot: <Money cents={sum("franked")} strong /> },
    { key: "credit", label: "Franking credit", align: "end", render: (r) => <Money cents={r.credit} />, foot: <Money cents={sum("credit")} strong /> },
    { key: "do", label: "", align: "end", width: "w-32", render: (r) => (
      <span className="inline-flex items-center gap-1">
        <Button size="sm" variant="ghost">Edit</Button>
        <RowMenu label={`More for ${r.fund}`} items={[{ id: "view", label: "View statement" }, { id: "delete", label: "Delete", danger: true }]} onAction={() => {}} />
      </span>
    ) },
  ];

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <PageHeader title="Components" subtitle="The building blocks every screen is made from. All figures and names on this page are made up." />

      <Block title="Colour, type and shape" note="Neutral greys with a faint green cast and one accent. Status colours are only for status. Controls are 8px, containers 12px, status chips are pills.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          <Swatch name="Page" className="bg-background" /><Swatch name="Surface" className="bg-surface" /><Swatch name="Quiet surface" className="bg-surface-secondary" />
          <Swatch name="Hairline" className="bg-border" /><Swatch name="Text" className="bg-foreground" /><Swatch name="Accent" className="bg-accent" />
          <Swatch name="Good" className="bg-success" /><Swatch name="Needs attention" className="bg-warning" /><Swatch name="Problem" className="bg-danger" />
        </div>
        <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Typography.Heading level={3}>Page title</Typography.Heading>
            <Typography.Heading level={5}>Block title</Typography.Heading>
            <Typography.Heading level={6}>Section title</Typography.Heading>
            <p className="text-sm">Body text for explanations and table cells.</p>
            <p className="text-xs text-muted">Caption for help and secondary detail.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">$84,310.00</span>
            <span className="text-xl font-semibold tabular-nums">$12,450.75</span>
            <span className="text-sm"><span className="figure">$1,250.00</span> <span className="text-muted">in tables and lists, a monospaced face keeps columns lined up</span></span>
          </div>
        </div>
      </Block>

      <Block title="Buttons" note="One primary button per screen: the thing you came to do. Everything else is quieter.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Add a record</Button><Button variant="secondary">Mark as lodged</Button><Button variant="tertiary">Cancel</Button>
          <Button variant="ghost">Edit</Button><Button variant="danger">Reopen</Button><Button variant="primary" isPending>Saving</Button><Button variant="primary" isDisabled>Add</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary">Small</Button><Button size="sm" variant="secondary">Small</Button><Button size="sm" variant="tertiary">Small</Button><Button size="sm" variant="ghost">Small</Button>
        </div>
      </Block>

      <Block title="Fields" note="Label above, help or an error below. Money has its own box; dates can be typed or picked.">
        <FieldGroup>
          <TextBox label="Bank or account" value={text} onChange={setText} required />
          <MoneyBox label="Gross interest" value={money} onChange={setMoney} description="Person A $625.00, Person B $625.00" required />
          <NumberBox label="Person A's share" value={pct} onChange={setPct} unit="%" description="Person B gets the rest" />
          <DateBox label="Statement date" value={date} onChange={setDate} required />
          <Choice label="Category" value={cat} onChange={setCat} options={["Tools and equipment", "Phone and internet", "Subscriptions", "Self-education", "Other"]} />
          <Suggest label="Company or fund" value={fund} onChange={setFund} options={["Tasman Index Fund", "Harbourline Property Trust", "Coastal Mutual"]} placeholder="Type or pick" />
          <MoneyBox label="GST" value="45.5.0" onChange={() => {}} error="Enter an amount like 45.50" />
          <TextBox label="Policy number" value="" onChange={() => {}} placeholder="Optional" />
        </FieldGroup>
        <NoteBox label="Note for the agent" value={note} onChange={setNote} rows={3} className="max-w-xl" />
      </Block>

      <Block title="Choices" note="Two or three options sit side by side. A tick is for a fact; a switch is for a setting that takes effect straight away.">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <Segmented label="Money" value={dir} onChange={setDir} options={[["income", "Income"], ["expense", "Expense"]]} />
          <Segmented label="Dividends this year" value={applies} onChange={setApplies} size="sm" options={[["yes", "Applies"], ["no", "Not this year"]]} />
          <Tick label="I have it on paper or elsewhere" checked={tick} onChange={setTick} />
          <Toggle label="Registered for GST" on={on} onChange={setOn} />
        </div>
      </Block>

      <Block title="Figures" note="One figure leads; the rest support it. Worked lists keep detail quiet and totals bold.">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Section>
            <StatRow>
              <Stat lead label="Taxable income, estimate" value="$84,310.00" note="Person A, FY 2026-27" />
              <Stat label="Assessable income" value="$91,760.75" />
              <Stat label="Deductions" value="$7,450.75" />
            </StatRow>
          </Section>
          <Section title="Return estimate, Person A">
            <FigureList label="Return estimate" lines={[
              { label: "Salary and wages", cents: 8650000, level: 1 },
              { label: "Interest", cents: 125000, level: 1, note: "item 10" },
              { label: "Dividends", cents: 401075, level: 1, note: "item 11" },
              { label: "Assessable income", cents: 9176075, total: true },
              { label: "Work-related", cents: 512075, level: 1 },
              { label: "Working from home", cents: 233000, level: 2 },
              { label: "Deductions", cents: 745075, total: true },
              { label: "Taxable income, estimate", cents: 8431000, total: true },
            ]} />
          </Section>
        </div>
      </Block>

      <Block title="Table" note="One column per thing. Figures sit on the right in their own columns with a total underneath. It scrolls sideways on a phone.">
        <DataTable label="Dividends" columns={columns} rows={SAMPLE} rowKey={(r) => r.id} minWidth="min-w-[820px]" />
      </Block>

      <Block title="Status and feedback">
        <div className="flex flex-wrap items-center gap-2">
          <Pill>Not this year</Pill><Pill tone="info">Applies</Pill><Pill tone="good">Lodged</Pill><Pill tone="warn">No evidence</Pill><Pill tone="bad">Over the cap</Pill>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Notice tone="warn" title="Q1 is lodged">Records dated in this quarter are locked. Reopen the quarter to change them.</Notice>
          <Notice tone="bad">Couldn't save. Check the connection and try again.</Notice>
        </div>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
          <SaveStatus dirty={dirty} onSave={() => setDirty(false)} onUndo={() => setDirty(false)} idle={<Button size="sm" variant="ghost" onPress={() => setDirty(true)}>Make a change</Button>} />
          <AutoSaveStatus saving /><AutoSaveStatus saved /><AutoSaveStatus error="Check the connection." onRetry={() => {}} />
        </div>
        <Empty title="No dividends recorded for this year" action={<Button size="sm" variant="primary">Add a record</Button>}>
          Add one line per dividend statement. Shared holdings go in once and are split between you.
        </Empty>
      </Block>

      <Block title="Menus, hints and confirmations">
        <div className="flex flex-wrap items-center gap-3">
          <RowMenu label="More actions" items={[{ id: "view", label: "View statement" }, { id: "dup", label: "Duplicate" }, { id: "delete", label: "Delete", danger: true }]} onAction={() => {}} />
          <Hint text="Only usable if the total super balance was under $500,000 on 30 June last year."><Button size="sm" variant="tertiary">What counts?</Button></Hint>
          <Confirm trigger={<Button size="sm" variant="secondary">Reopen Q1</Button>} title="Reopen Q1?" confirmLabel="Reopen" danger onConfirm={() => {}}>
            The books for a lodged quarter will change. You'll need to revise the BAS with the ATO to match.
          </Confirm>
        </div>
      </Block>

      <Block title="Motion" note="Crisp and fast. Only things you asked for animate in: a form, a menu, a dialog, the receipt preview. Moving between screens is instant, because it happens too often to wait for.">
        <div className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
          <p><span className="font-medium">Press</span> <span className="text-muted">140ms. Buttons dip slightly under the finger.</span></p>
          <p><span className="font-medium">Menus and pickers</span> <span className="text-muted">160ms in, 100ms out, growing from what opened them.</span></p>
          <p><span className="font-medium">Dialogs</span> <span className="text-muted">200ms, from the centre.</span></p>
          <p><span className="font-medium">Forms and messages</span> <span className="text-muted">rise in over 200ms and leave at once.</span></p>
          <p><span className="font-medium">A saved record</span> <span className="text-muted">is marked for a moment so you can see where it landed.</span></p>
          <p><span className="font-medium">Reduced motion</span> <span className="text-muted">keeps the fades, drops the movement.</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={() => setFormShown((n) => n + 1)}>Show a form arriving</Button>
          <Button size="sm" variant="secondary" onPress={() => { setFlash(""); window.setTimeout(() => setFlash("b"), 30); }}>Mark a saved record</Button>
        </div>
        {formShown > 0 && (
          <Section key={formShown} className="enter max-w-xl" title="Add a record">
            <FieldGroup columns={2}>
              <TextBox label="Bank or account" value="" onChange={() => {}} />
              <MoneyBox label="Gross interest" value="" onChange={() => {}} />
            </FieldGroup>
          </Section>
        )}
        <DataTable label="Dividends, to show a saved record" columns={columns.slice(0, 5)} rows={SAMPLE} rowKey={(r) => r.id} highlightKey={flash} />
      </Block>

      <Block title="Navigation" note="The list of screens down the side, with each schedule's total.">
        <div className="w-64 rounded-xl border border-border bg-surface p-2">
          <NavList label="Sections" current={nav} onNavigate={setNav} groups={[
            { items: [{ id: "overview", label: "Overview" }, { id: "return", label: "Tax return" }] },
            { title: "Income", items: [{ id: "i10", label: "Interest", trailing: "$1,250" }, { id: "i11", label: "Dividends", trailing: "$4,011" }, { id: "i21", label: "Rent", trailing: "$18,400" }] },
            { title: "Deductions", items: [{ id: "s07", label: "Work-related", trailing: "$5,121" }, { id: "s07a", label: "Working from home", trailing: "$2,330", indent: true }] },
          ]} />
        </div>
      </Block>

      <Block title="Put together: a schedule page" note="How the blocks compose. Title and the one action at the top, the figures that matter, then the records.">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-background p-5">
          <PageHeader title="Dividends" code="item 11" who="Household" subtitle="FY 2026-27" actions={<Button variant="primary">Add a record</Button>} />
          <StatRow>
            <Stat lead label="Total dividends" value="$1,138.09" />
            <Stat label="Franking credits" value="$292.24" />
            <Stat label="Without a statement" value="1" />
          </StatRow>
          <Section><DataTable label="Dividends" columns={columns} rows={SAMPLE} rowKey={(r) => r.id} minWidth="min-w-[820px]" /></Section>
        </div>
      </Block>
    </div>
  );
}
