# First deploy (NAS)

1. File Station: copy `config/ts-serve.json` into `docker/workpapers/config/`.
2. Tailscale admin → Settings → Keys → Generate auth key: Reusable off, Ephemeral off, Pre-approved on, Tags → `tag:workpapers`. Copy it.
3. GitHub → your profile → Packages → workpapers → Package settings → Change visibility → Public
   (the image holds app code only, never your data; this saves setting up registry logins on the NAS).
4. Container Manager → Project → Create:
   - Project name: `workpapers`
   - Path: `docker/workpapers`
   - Source: Create docker-compose.yml → paste `docker-compose.yml`, replacing PASTE_AUTH_KEY_HERE with the key
   - Next → skip Web Station → Done. It downloads and starts both containers.
5. Tailscale admin → Machines: `workpapers` appears with tag `tag:workpapers`.
6. Open https://workpapers.tail74ef01.ts.net/_/ → create the PocketBase superuser (save in password manager).
7. Admin UI → users → create Ee and Darrelle → people → link each person to their user.
8. Admin UI → Settings → Backups → daily, keep 7.
9. Open https://workpapers.tail74ef01.ts.net on your phone → sign in → Share → Add to Home Screen.
