import { Card } from "@heroui/react";
import { fyLabel } from "@workpapers/core";
import { sectionById } from "../data/sections";

const WHEN: Record<string, string> = {
  overview: "M3", return: "M3", bas: "M3", setup: "M3", compare: "M3", rates: "M3",
};

export function Placeholder({ view, fy, person }: { view: string; fy: number; person: string }) {
  const s = sectionById(view);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">
          {s?.name ?? "Not found"}
          {s?.code && <span className="ml-2 align-middle text-xs font-normal text-muted">{s.code}</span>}
          {person !== "Household" && <span className="font-normal text-muted"> — {person}</span>}
        </h2>
        <p className="text-sm text-muted">{fyLabel(fy)}</p>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Arrives in {WHEN[view] ?? "M2"}</Card.Title>
          <Card.Description>
            The calculation engine is in (M1). Entering and editing records arrives in M2; Setup, lodging and locks in M3.
            Try "Show the example year" to see how the figures flow.
          </Card.Description>
        </Card.Header>
      </Card>
    </div>
  );
}
