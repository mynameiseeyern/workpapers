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
Container Manager only checks Docker Hub for image updates, and "Add from URL" rejects ghcr.io addresses. So:
1. Push to `main`; wait for the Actions run to go green.
2. Container Manager → Project → workpapers → **Stop**, then Action → **Build** (Build is only available while the project is stopped). With `pull_policy: always` in the compose file, Build downloads the newest image and recreates the app. Data in `pb_data` and the Tailscale login in `ts_state` are untouched.
3. Reload the app and check the version at the bottom of the sidebar matches the commit.

If the project was created before `pull_policy: always` was added: Action → Stop → Clean, then Image → select `ghcr.io/mynameiseeyern/workpapers` → Delete, then Project → Action → Build (it downloads the image fresh).
To roll back, change `latest` to a previous commit's full SHA tag and Build.

## 5. Restore drill (do once at M1, then yearly)
1. Stop the project.
2. Restore `docker/workpapers/pb_data` from Hyper Backup into a scratch folder, e.g. `docker/workpapers-restore`.
3. Point a copy of the compose file at the scratch folder with `hostname: workpapers-restore`, start it, sign in, and spot-check three rows and one attachment.
4. Delete the scratch project and write the date in `docs/restore-log.md`.

## Troubleshooting
- **Machine never appears in Tailscale**: the auth key was used or expired; generate a new one and clear `ts_state`.
- **HTTPS error**: HTTPS Certificates is off in the Tailscale DNS page, or the first cert is still being issued (up to a minute).
- **Blank page**: check the `app` container log; a failed migration stops PocketBase from serving.

## 6. Feedback → GitHub → Claude
1. **Connect the NAS to GitHub (once).** On github.com: Settings → Developer settings → Fine-grained tokens → Generate:
   repository access *Only select repositories → workpapers*, permission **Issues: Read and write**, expiry 1 year.
   In the app's admin (`https://workpapers.tail74ef01.ts.net/_/`) → **app_secrets** → New record twice:
   `github_token` = the token, `github_repo` = `mynameiseeyern/workpapers`.
2. **Create the labels (once).** GitHub → Actions → **labels** → Run workflow.
3. **Connect Claude (once).** On your Mac run `claude setup-token` (uses Claude Max), then GitHub → workpapers → Settings →
   Secrets and variables → Actions → New repository secret `CLAUDE_CODE_OAUTH_TOKEN`. Install the Claude GitHub App
   (https://github.com/apps/claude) on the workpapers repo.
4. **Use it.** In the app: sidebar → **Give feedback** → pick Bug / UI / UX / Feature → click or drag on the page, write a note →
   **Send** (paper-plane in the toolbar). An issue appears on GitHub. Add the **claude** label to hand it to Claude, or comment
   `@claude …`. Bugs and UI come back as a branch with a pull request link; UX gets a plan first (reply `@claude go ahead`);
   features get a short spec. Merge the pull request, wait for the build, then Stop → Build on the NAS.
5. If GitHub isn't connected or rejects the token, feedback is still saved on the NAS (admin → **feedback**), with the error.
