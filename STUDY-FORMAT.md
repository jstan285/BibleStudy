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

Copy the top-level structure of `docs/studies/make-way-2026-10-11.json`: `schemaVersion`, `id`, `title`, `series`, `date`, `passage`, `cover`, and `steps`.

Each step needs a unique `id`, a navigation `title`, a display `section`, and a `kind`:

- `cover`: displays the study cover image.
- `text`: has a `paragraphs` array, an `items` array, or both. Suitable for introductions, application questions, prayer, and announcements.
- `discussion`: has `refs` (an array of passage references), `question`, and `guidance`. The optional `instruction` preserves the guide's reading instruction.

All material is available in one guide. Host Guidance is always optional and collapsed when entering a discussion. There is no host/participant role field.

## Scripture references

The converter exports references only. The app loads ESV passages through the private Cloudflare connection when the study opens. Do not bundle ESV text or API credentials into public files.

```json
{
  "id": "word-1",
  "kind": "discussion",
  "title": "First discussion",
  "section": "The Word",
  "refs": ["Genesis 3:1-8", "Romans 5:12"],
  "question": "The discussion question.",
  "guidance": "Optional host guidance."
}
```

Use full book names and single-chapter ranges, such as `Genesis 3:1-8`. Split a reference that spans chapters into separate entries. The backend supports up to 30 distinct ranges, up to 450 requested verses in one study, and fewer than half the verses of any one book. The conservative margin keeps studies below Crossway's published quotation limits. Unsupported or larger studies display an error and need review before publishing.

The first study demonstrates 11 ranges. Weekly additions require only reviewed metadata, guide text, references, and a cover image. Questions and guidance work offline after saving; loading ESV passages requires a connection.
