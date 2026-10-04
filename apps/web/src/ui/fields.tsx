import {
  Calendar, Checkbox, ComboBox, DateField, DatePicker, Description, FieldError, Fieldset, Input, InputGroup, Label, ListBox,
  Select, Slider, Switch, TextArea, TextField, ToggleButton, ToggleButtonGroup,
} from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { useId, type ReactNode } from "react";

/** What every field shares: a label above, help or an error below. */
interface Common { label: string; error?: string; description?: ReactNode; required?: boolean; className?: string }
interface Typed extends Common { value: string; onChange: (v: string) => void; placeholder?: string; onDone?: () => void }

function Below({ error, description }: Pick<Common, "error" | "description">) {
  if (error) return <FieldError>{error}</FieldError>;
  return description ? <Description>{description}</Description> : null;
}
const onEnter = (ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === "Enter") ev.currentTarget.blur(); };

/** A line of text. */
export function TextBox(p: Typed) {
  return (
    <TextField validationBehavior="aria" className={p.className ?? "w-full"} value={p.value} onChange={p.onChange} isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <Input placeholder={p.placeholder} onBlur={p.onDone} />
      <Below error={p.error} description={p.description} />
    </TextField>
  );
}

/** A dollar amount: "$" in front, digits lined up on the right. Kept as typed text so half-typed values don't jump. */
export function MoneyBox(p: Typed) {
  return (
    <TextField validationBehavior="aria" className={p.className ?? "w-full"} value={p.value} onChange={p.onChange} isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <InputGroup>
        <InputGroup.Prefix>$</InputGroup.Prefix>
        <InputGroup.Input className="figure text-right" inputMode="decimal" placeholder={p.placeholder ?? "0.00"} onBlur={p.onDone} onKeyDown={onEnter} />
      </InputGroup>
      <Below error={p.error} description={p.description} />
    </TextField>
  );
}

/** A plain number with its unit after it: %, km, hours. */
export function NumberBox(p: Typed & { unit?: string }) {
  return (
    <TextField validationBehavior="aria" className={p.className ?? "w-full"} value={p.value} onChange={p.onChange} isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <InputGroup>
        <InputGroup.Input className="figure text-right" inputMode="decimal" placeholder={p.placeholder} onBlur={p.onDone} onKeyDown={onEnter} />
        {p.unit && <InputGroup.Suffix>{p.unit}</InputGroup.Suffix>}
      </InputGroup>
      <Below error={p.error} description={p.description} />
    </TextField>
  );
}

/** Several lines of text. */
export function NoteBox(p: Typed & { rows?: number }) {
  return (
    <TextField validationBehavior="aria" className={p.className ?? "w-full"} value={p.value} onChange={p.onChange} isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <TextArea rows={p.rows ?? 4} placeholder={p.placeholder} />
      <Below error={p.error} description={p.description} />
    </TextField>
  );
}

const asDate = (s: string): CalendarDate | null => {
  try { return /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseDate(s) : null; } catch { return null; }
};

/** A date, typed or picked from a calendar. The value is "YYYY-MM-DD", or "" while it's incomplete. */
export function DateBox(p: Common & { value: string; onChange: (v: string) => void }) {
  return (
    <DatePicker validationBehavior="aria" className={p.className ?? "w-full"} value={asDate(p.value)} onChange={(d) => p.onChange(d ? d.toString() : "")}
      isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix><DatePicker.Trigger><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
      </DateField.Group>
      <Below error={p.error} description={p.description} />
      <DatePicker.Popover>
        <Calendar aria-label={p.label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger><Calendar.YearPickerTriggerHeading /><Calendar.YearPickerTriggerIndicator /></Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

type Option = string | [id: string, label: string];
const idOf = (o: Option) => (typeof o === "string" ? o : o[0]);
const labelOf = (o: Option) => (typeof o === "string" ? o : o[1]);

/** Pick one from a list. Use it for four or more options; two or three read better as a Segmented. */
export function Choice(p: Common & { value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select validationBehavior="aria" className={p.className ?? "w-full"} value={p.value || null} onChange={(v) => v != null && p.onChange(String(v))}
      isInvalid={!!p.error} isRequired={p.required} placeholder={p.placeholder ?? "Choose"}>
      <Label>{p.label}</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {p.options.map((o) => <ListBox.Item key={idOf(o)} id={idOf(o)} textValue={labelOf(o)}>{labelOf(o)}<ListBox.ItemIndicator /></ListBox.Item>)}
        </ListBox>
      </Select.Popover>
      <Below error={p.error} description={p.description} />
    </Select>
  );
}

/** A text box that offers what has been typed in it before. Anything new can still be typed. */
export function Suggest(p: Typed & { options: string[] }) {
  if (!p.options.length) return <TextBox {...p} />;
  return (
    <ComboBox allowsCustomValue menuTrigger="focus" validationBehavior="aria" className={p.className ?? "w-full"} inputValue={p.value} onInputChange={p.onChange}
      isInvalid={!!p.error} isRequired={p.required}>
      <Label>{p.label}</Label>
      <ComboBox.InputGroup><Input placeholder={p.placeholder} /><ComboBox.Trigger /></ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>{p.options.map((o) => <ListBox.Item key={o} id={o} textValue={o}>{o}</ListBox.Item>)}</ListBox>
      </ComboBox.Popover>
      <Below error={p.error} description={p.description} />
    </ComboBox>
  );
}

/** Two or three options shown side by side, one always chosen: Income / Expense, Applies / Not this year. */
export function Segmented(p: { label: string; hideLabel?: boolean; value: string; options: Option[]; onChange: (v: string) => void; size?: "sm" | "md"; className?: string; isDisabled?: boolean }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${p.className ?? ""}`}>
      <span id={id} className={p.hideLabel ? "sr-only" : "text-sm font-medium"}>{p.label}</span>
      <ToggleButtonGroup aria-labelledby={id} selectionMode="single" disallowEmptySelection size={p.size ?? "md"} isDisabled={p.isDisabled}
        selectedKeys={p.value ? [p.value] : []} onSelectionChange={(keys) => { const k = [...keys][0]; if (k != null) p.onChange(String(k)); }}>
        {p.options.map((o) => <ToggleButton key={idOf(o)} id={idOf(o)}>{labelOf(o)}</ToggleButton>)}
      </ToggleButtonGroup>
    </div>
  );
}

/**
 * How something shared is split between two people: slide towards whoever has more. Starts in the middle (50/50).
 * `value` is the first person's percentage; the second person gets the rest.
 */
export function SplitSlider(p: { label?: string; people: [string, string]; value: number; onChange: (v: number) => void; className?: string }) {
  const first = Number.isFinite(p.value) ? Math.max(0, Math.min(100, p.value)) : 50;
  const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
  return (
    <Slider className={p.className ?? "w-full"} minValue={0} maxValue={100} step={1} value={Math.round(first)}
      onChange={(v) => p.onChange(Array.isArray(v) ? v[0] ?? 50 : v)}>
      <Label>{p.label ?? "Split"}</Label>
      <Slider.Output>{() => `${p.people[0]} ${pct(first)} · ${p.people[1]} ${pct(100 - first)}`}</Slider.Output>
      <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
    </Slider>
  );
}

/** A tick box for something that is true or not. */
export function Tick(p: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; isDisabled?: boolean }) {
  return (
    <Checkbox isSelected={p.checked} onChange={p.onChange} isDisabled={p.isDisabled}>
      <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{p.label}</Checkbox.Content>
    </Checkbox>
  );
}

/** A switch for a setting that takes effect as soon as it's flipped. */
export function Toggle(p: { label: ReactNode; on: boolean; onChange: (v: boolean) => void; isDisabled?: boolean }) {
  return (
    <Switch isSelected={p.on} onChange={p.onChange} isDisabled={p.isDisabled}>
      <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control>{p.label}</Switch.Content>
    </Switch>
  );
}

/** Fields that belong together, under one heading, laid out on a grid that collapses to one column on a phone. */
export function FieldGroup(p: { title?: string; description?: ReactNode; columns?: 1 | 2 | 3; children: ReactNode; actions?: ReactNode }) {
  const cols = p.columns === 1 ? "" : p.columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <Fieldset className="gap-3">
      {p.title && <Fieldset.Legend>{p.title}</Fieldset.Legend>}
      {p.description && <Description>{p.description}</Description>}
      <div className={`grid items-start gap-x-4 gap-y-3 ${cols}`}>{p.children}</div>
      {p.actions && <Fieldset.Actions>{p.actions}</Fieldset.Actions>}
    </Fieldset>
  );
}
