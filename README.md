# Workpapers

Household tax workpapers for Ee and Darrelle. Private, self-hosted on a Synology over Tailscale.

- `packages/core`: the tax engine (integer cents, income-year and BAS rules, rate book). `pnpm test`.
- `apps/web`: React 19 + HeroUI v3 PWA.
- `pb`: PocketBase migrations and hooks.
- `infra`: Dockerfile, compose file, Tailscale serve config.
- `docs`: NAS runbook, rate review log. PRD and HLD live in the Claude project "Side Quests".

Local dev: `pnpm install`, run PocketBase on :8090 with `--migrationsDir pb/pb_migrations --hooksDir pb/pb_hooks`, then `pnpm dev`.
