import { Table } from "@heroui/react";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  /** Figures go on the right ("end") so their digits line up. */
  align?: "start" | "end";
  /** A Tailwind width class, e.g. "w-28". */
  width?: string;
  render: (row: T) => ReactNode;
  /** The column that names the row (read out first by screen readers). */
  rowHeader?: boolean;
  /** Shown under the column in the footer row, e.g. a total. */
  foot?: ReactNode;
}

/**
 * Records as a table: one column per thing, figures right-aligned in their own columns.
 * Scrolls sideways on a phone rather than squeezing.
 */
export function DataTable<T>(p: { label: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; minWidth?: string; empty?: ReactNode;
  /** The row to mark for a moment, e.g. the record just saved. */
  highlightKey?: string }) {
  if (!p.rows.length && p.empty) return <>{p.empty}</>;
  const side = (c: Column<T>) => (c.align === "end" ? "text-right" : "");
  const hasFoot = p.columns.some((c) => c.foot != null);
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label={p.label} className={p.minWidth ?? "min-w-[640px]"}>
          <Table.Header>
            {p.columns.map((c) => (
              <Table.Column key={c.key} id={c.key} isRowHeader={c.rowHeader} className={`${side(c)} ${c.width ?? ""}`}>{c.label}</Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {p.rows.map((r) => (
              <Table.Row key={p.rowKey(r)} id={p.rowKey(r)} className={p.rowKey(r) === p.highlightKey ? "row-flash" : undefined}>
                {p.columns.map((c) => <Table.Cell key={c.key} className={`align-top ${side(c)}`}>{c.render(r)}</Table.Cell>)}
              </Table.Row>
            ))}
            {hasFoot && (
              <Table.Row id="__foot" className="font-semibold">
                {p.columns.map((c) => <Table.Cell key={c.key} className={side(c)}>{c.foot ?? ""}</Table.Cell>)}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
