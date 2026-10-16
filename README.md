# Bible Studies

A growing library of interactive Bible studies. No sign-in required.

**Open the app:** https://jstan285.github.io/BibleStudy/

**First study:** https://jstan285.github.io/BibleStudy/#study=make-way-2026-10-11

The first study is **Make Way — What We Were Made For**, October 11, 2026. All 15 sections and all 11 Scripture passage ranges are included.

## Use on iPhone

Open the app in Safari, choose **Share → Add to Home Screen**, enable **Open as Web App** if offered, and tap **Add**. Open it while connected before using saved studies offline.

## Reading experience

- One shared guide with large text.
- Each discussion starts with Scripture expanded; Discussion and Host Guidance are optional.
- Next and Back move between study sections.
- This browser remembers your place in each study.
- Direct links open an individual study or section.
- Home Screen support and offline access after the app saves its files.

Currently, Bible passages use the bundled **World English Bible (WEB)**. YouVersion and additional translations are not connected yet. The desktop PDF converter will be a separate future tool.

## Publishing

GitHub Pages publishes **main /docs**. Update the files in `docs` and commit them to publish changes. No build step or custom domain is needed.

## Add a week

1. Add the reviewed study JSON under `docs/studies`.
2. Add its cover under `docs/assets`.
3. Add the new entry to `docs/studies/index.json`.
4. Commit the changes. Readers can open the new week without reinstalling the app.

See [STUDY-FORMAT.md](STUDY-FORMAT.md) for the export format. Keep study IDs stable so shared links and saved progress remain valid.

For application-shell changes, increment `VERSION` in `docs/sw.js`. Content-only additions do not need a new application version.

## Local preview

With Node.js installed, run `node tools/serve.cjs` and open http://127.0.0.1:4173/bible-study-tool/ . The hosted app itself requires no software installation.

The site and study content are public. Preferences stay in the reader's browser and do not sync between devices. Offline copies may be cleared by browser storage management.
