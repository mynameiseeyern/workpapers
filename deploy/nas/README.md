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

# Fonts (once)

The app's typeface (Timeless) is not in the app image, because its licence doesn't allow it to be published.
The NAS holds the files and hands them to the app. Until this is done the app works and shows a plainer fallback font.

Do these in order. The folder has to exist before the app is rebuilt, or the app won't start.

1. File Station: in `docker/workpapers/` create a folder called `fonts`.
2. Upload these three files into it (from the Timeless download, or from `apps/web/public/fonts/timeless/` on the Mac):
   `TimelessSansVF.woff2`, `TimelessSerifVF.woff2`, `TimelessSerifItalicVF.woff2`.
3. Container Manager → Project → workpapers → YAML Configuration. Under `app:` → `volumes:` add this line below the `pb_data` one, lined up with it:
   `      - /volume1/docker/workpapers/fonts:/pb/pb_public/fonts/timeless:ro`
4. Save and let it rebuild. Open the app: page titles should now be in a serif.
