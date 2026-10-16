# Weekly study format — version 1

The Windows converter should export content into this format. Its review step should preserve the source wording and let the approver correct extracted text before export. The web app is independent of PDF parsing.

## Library entry

Add an entry to `docs/studies/index.json`, whose outer shape is `{ "schemaVersion": 1, "studies": [...] }`. Order the entries as you want them shown, usually newest first.

```json
{
  "id": "series-2026-10-18",
  "title": "Study title",
  "series": "Series name",
  "date": "2026-10-18",
  "passage": "Genesis 3:1–10",
  "file": "studies/series-2026-10-18.json",
  "cover": "assets/series-2026-10-18.jpg"
}
```

Use a unique, permanent lowercase ID. File and image paths are relative to the web-app root, including when GitHub hosts it under a repository subfolder. The library contains reviewed, published studies only.

## Study file

Copy the top-level structure of `docs/studies/make-way-2026-10-11.json`: `schemaVersion`, `id`, `title`, `series`, `date`, `passage`, `cover`, `steps`, and `readings`.

Each step needs a unique `id`, a navigation `title`, a display `section`, and a `kind`:

- `cover`: displays the study cover image.
- `text`: has a `paragraphs` array, an `items` array, or both. Suitable for introductions, application questions, prayer, and announcements.
- `discussion`: has `refs` (an array of passage references), `question`, and `guidance`. The optional `instruction` preserves the guide's reading instruction.

All material is available in one guide. Host Guidance is always optional and collapsed when entering a discussion. There is no host/participant role field.

## Bundled Scripture

For the current WEB reader, every reference must have an entry under `readings`. Convert en dashes in reference keys to plain hyphens, for example `Genesis 3:1-8`. Each entry contains:

```json
{
  "reference": "Genesis 3:1-8",
  "translation_id": "web",
  "translation_name": "World English Bible",
  "translation_note": "Public Domain",
  "verses": [
    {"book_id": "GEN", "book_name": "Genesis", "chapter": 3, "verse": 1, "text": "The exact verse text."}
  ]
}
```

Include each verse in the requested range, with its actual number and complete wording. The supplied first study demonstrates all 11 passage ranges. Bundled readings currently provide immediate and offline access. A later YouVersion adapter can use the same passage references to request the selected translation; no YouVersion credentials belong in these public files.
