# Workpapers — notes for Claude

Household tax workpapers for two people (Ee and Darrelle), self-hosted on a Synology NAS over Tailscale.
The people using it are not developers. Feedback arrives as GitHub issues, mostly from the app's feedback mode.

## Repo map

- `packages/core` — the tax engine (pure TypeScript). Money is **integer cents** everywhere. Rates live in `src/rates/ratebook.ts`.
- `packages/core/src/locks/lockcore.ts` — which lodged BAS quarter or return locks a record. Bundled into
  `pb/pb_hooks/lib/lockcore.js` with `pnpm --filter @workpapers/core build:lockcore`; CI fails if the bundle is stale.
- `apps/web` — React 19 + HeroUI v3 + Tailwind v4. Screens in `src/routes`, shell in `src/components`, data access in `src/data`.
- `pb/pb_migrations`, `pb/pb_hooks` — PocketBase schema and server rules (JSVM: handlers can't see top-level variables; shared code goes in `pb_hooks/lib` and is `require`d inside handlers).
- `docs/ENGINE-CHANGES.md` — deliberate differences from the prototype. `tools/prototype` is frozen; never edit it.

## How to handle an issue, by label

- **bug** — Reproduce it from the issue. Fix the cause, add or extend a test that fails without the fix
  (engine bugs: `packages/core/test`), run the checks below, push a branch and give the pull request link.
- **ui** — Visual changes only: layout, spacing, wording, colour, phone layout. Use HeroUI v3 components and
  Tailwind classes already in use; don't add new UI libraries. Don't touch `packages/core` or `pb/`. Check it at
  390 px wide as well as desktop. Push a branch and give the pull request link.
- **ux** — Don't write code yet. Reply with a short plan: what changes for the person using it, which screens,
  risks, and anything that affects figures or locks. Wait for a comment saying `@claude go ahead` before coding.
- **feature** — Don't write code. Reply with a mini-spec: the problem, who it's for, how it would work (steps and
  screens), what it changes in the data or tax figures, open questions, and a rough size (small / medium / large).
- If the issue is too vague to act on, add the `needs-info` label and ask one clear question instead of guessing.

## Rules that must not be broken

- Money stays in integer cents; round a person's share of a row where it's taken, as the engine does.
- Never loosen or bypass a lock. Records behind a lodged BAS quarter or tax return must stay read-only on the
  server (`pb/pb_hooks/locks.pb.js`) and in the app.
- Don't change tax rules, rates or thresholds from a UI or UX issue. If a fix seems to need that, stop and ask.
- Don't edit the golden fixtures (`packages/core/test/golden/cases.json`) to make a test pass.
- Never put real figures, names or personal details in tests, fixtures or commit messages. The example year
  (`packages/core/src/example/exampleYear.ts`) is made-up data.
- Plain, friendly English in the UI. No jargon unless it's the ATO's own label (for example "1A GST on sales").

## Checks before pushing

```
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm build
```

All must pass. If you changed `lockcore.ts`, also run `pnpm --filter @workpapers/core build:lockcore` and commit the bundle.

## Deploying (for context — not something to do from an issue)

A merged pull request builds `ghcr.io/mynameiseeyern/workpapers:latest`. Ee updates the NAS by hand
(Container Manager → Stop → Build). Nothing deploys automatically.
