import { Alert, Chip } from "@heroui/react";
import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";
const COLOR = { neutral: "default", good: "success", warn: "warning", bad: "danger", info: "accent" } as const;

/** A short status word on a record or a setting. Colour means state, never decoration. */
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <Chip size="sm" variant="soft" color={COLOR[tone]}>{children}</Chip>;
}

/** A message that stays on the page until it's dealt with. */
export function Notice({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral">; title?: string; children: ReactNode }) {
  return (
    <Alert status={COLOR[tone]}>
      <Alert.Indicator />
      <Alert.Content>
        {title && <Alert.Title>{title}</Alert.Title>}
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
