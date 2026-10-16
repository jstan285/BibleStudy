# Bible Studies

A growing library of interactive Bible studies. No sign-in required.

**Open the app:** https://jstan285.github.io/BibleStudy/

**First study:** https://jstan285.github.io/BibleStudy/#study=make-way-2026-10-11

The first study is **Make Way — What We Were Made For**, October 11, 2026. All 15 sections and all 11 Scripture passage ranges are included.

## Use on iPhone

Open the app in Safari, choose **Share → Add to Home Screen**, enable **Open as Web App** if offered, and tap **Add**. Open it while connected before using saved study questions offline.

## Reading experience

- One shared guide with large text.
- Each discussion starts with Scripture expanded; Discussion and Host Guidance are optional.
- Next and Back move between study sections.
- This browser remembers your place in each study.
- Direct links open an individual study or section.
- Home Screen support and offline access to study questions and guidance after the app saves its files.

Bible passages use the **English Standard Version (ESV)**, loaded from Crossway's official API when a study opens. An internet connection is required to load passages. Once loaded, they remain available as you move through that study during the current session. Scripture is not saved in browser storage or the public repository. The desktop PDF converter will be a separate future tool.

## ESV connection

`backend/esv-worker.mjs` runs on Cloudflare Workers. Its `ESV_API_KEY` binding must be a **Secret** in Cloudflare. Never put the key in GitHub, study JSON, browser code, or `docs/config.js`; that file contains only the public Worker URL. The site's Content Security Policy also allows that specific Worker origin.

The Worker accepts only studies listed in this site's published catalog, validates passage limits, and includes Crossway's copyright notice supplied by the API. It allows browser requests from `https://jstan285.github.io`, applies a small per-instance request limit, and keeps only one study's passages in memory for up to one minute to reduce repeated requests. Crossway's account-wide limits still apply. It does not provide an unrestricted Bible lookup service.

Review [Crossway's API conditions](https://api.esv.org/) when changing the scope or distribution of the app. The current conservative guard permits up to 450 requested verses per study and less than half of any book. Large guides need review. Backend edits are deployed separately through Cloudflare's code editor; ordinary weekly study additions only require a GitHub update.

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
