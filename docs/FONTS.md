# Fonts

The app is set in the **Timeless** family from timeless.co (Timeless Free Font License 1.2).

- **Timeless Sans** for everything that is read, pressed or typed. Numbers in columns use its tabular figures.
- **Timeless Serif** only for what a page is about: its title, its headline figures, and the name of the app.
  In code that is the `.display` class in `apps/web/src/ui/theme.css`.

## The font files are not in this repository

The licence lets the fonts be embedded in the app. It does not allow them to be put in a public repository or
passed on to anyone else, and this repository and its app image are public. So the files are kept out of both:

- `apps/web/public/fonts/timeless/` is ignored by git.
- The app asks for three files at `/fonts/timeless/`:
  `TimelessSansVF.woff2`, `TimelessSerifVF.woff2`, `TimelessSerifItalicVF.woff2`.
- Where they are missing the app falls back to Geist, which ships with the app. Nothing breaks; it only looks plainer.

## Where the files go

- **On a working copy:** download the family from timeless.co and copy the three files (and its `LICENSE.pdf`) into
  `apps/web/public/fonts/timeless/`.
- **On the NAS:** see "Fonts" in `deploy/nas/README.md`. The files sit in a NAS folder that is mounted into the app.

Do not commit the font files, and do not add them to the Docker image.
