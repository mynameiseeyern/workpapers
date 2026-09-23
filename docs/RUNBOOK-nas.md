# Runbook: Workpapers on the Synology

Target: DS1522+ (amd64) on DSM 7.4.1-90080, Container Manager, Tailscale in userspace mode.
The app is only reachable on your tailnet (`tail74ef01.ts.net`), at `https://workpapers.tail74ef01.ts.net`.

## 0. Before anything
1. Finish the DSM 7.4.1 update. Export the DSM config first (Control Panel → Update & Restore → Configuration Backup).
2. Package Center → confirm **Container Manager** is installed and updated for 7.4.1.
3. Create the shared folder layout (File Station): `docker/workpapers/{pb_data,ts_state,config}`.

## 1. Tailnet (one-off, about 10 minutes)
1. Sign up at tailscale.com with the account you want to own the household network (a shared Google account works well).
2. Admin console → **DNS**: turn on **MagicDNS**, then **HTTPS Certificates**. Note the tailnet name shown there (`something.ts.net`) and send it to Claude for HLD T2.
3. Admin console → **Access controls**: add a tag owner so the container can be tagged:
   `"tagOwners": { "tag:workpapers": ["autogroup:admin"] }`
4. Install Tailscale on each phone and laptop you'll use and sign in. Invite Darrelle (Users → Invite).
5. Settings → Keys → **Generate auth key**: not reusable, not ephemeral, tag `tag:workpapers`. Keep it for step 3.

## 2. Backups
Decision (24 Sep 2026): no separate backup copy for now. PocketBase keeps nightly backups inside `pb_data/backups` on the NAS (admin UI → Settings → Backups → daily, keep 7). Save each year's agent pack off the NAS. If this changes, the options are Snapshot Replication (hourly snapshots of `docker`) and Hyper Backup to an encrypted USB drive.

## 3. First deploy
1. Copy `infra/ts-serve.json` to `docker/workpapers/config/ts-serve.json`.
2. Copy `infra/.env.example` to `docker/workpapers/.env` and paste the auth key.
3. The image is private on GHCR: in Container Manager → Registry → Settings, add `ghcr.io` with user `mynameiseeyern` and a GitHub token with **read:packages** only.
4. Container Manager → **Project** → Create → path `docker/workpapers` → upload `infra/compose.yaml` → Build/Start.
5. In the Tailscale admin, the machine `workpapers` appears. Open `https://workpapers.tail74ef01.ts.net/_/` and create the PocketBase superuser (password manager!).
6. In the admin UI: create two users (Ee, Darrelle) in `users`, then link each to its `people` record.
7. Sign in at `https://workpapers.tail74ef01.ts.net` on a phone and use "Add to Home Screen".

## 4. Updates
Push to `main` → CI builds `ghcr.io/mynameiseeyern/workpapers:latest` and `:<sha>`.
On the NAS: Container Manager → Project → workpapers → Action → **Build** (pulls and recreates). To roll back, set `WORKPAPERS_TAG=<previous sha>` in `.env` and rebuild. Migrations only move forward, so take a PocketBase backup before any release that adds one.

## 5. Restore drill (do once at M1, then yearly)
1. Stop the project.
2. Restore `docker/workpapers/pb_data` from Hyper Backup into a scratch folder, e.g. `docker/workpapers-restore`.
3. Point a copy of the compose file at the scratch folder with `hostname: workpapers-restore`, start it, sign in, and spot-check three rows and one attachment.
4. Delete the scratch project and write the date in `docs/restore-log.md`.

## Troubleshooting
- **Machine never appears in Tailscale**: the auth key was used or expired; generate a new one and clear `ts_state`.
- **HTTPS error**: HTTPS Certificates is off in the Tailscale DNS page, or the first cert is still being issued (up to a minute).
- **Blank page**: check the `app` container log; a failed migration stops PocketBase from serving.
