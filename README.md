# atproto-car-exporter

A self-contained browser tool that converts an ATproto `.car` export file into a ZIP archive of JSON records — no server, no install, no data leaves your machine.

**Live tool:** https://dracoblue.github.io/atproto-car-exporter/

## What it does

1. You drop (or select) a `.car` file exported from your ATproto PDS
2. The tool traverses the repo's Merkle Search Tree (MST) in the browser
3. Every record is decoded from DAG-CBOR and written as pretty-printed JSON into a ZIP
4. The ZIP is downloaded automatically — named `<original-file>_export.zip`

### ZIP structure

```
app.bsky.feed.post/
  3jwhatever.json
  3janother.json
app.bsky.actor.profile/
  self.json
app.bsky.graph.follow/
  ...
```

Records are grouped by collection. The filename is `{rkey}.json`. Each file's modification time is set to the record's `createdAt` (or `updatedAt`) timestamp, so the date is visible in any file manager after extracting.

## How to get a `.car` file

In the Bluesky app or any ATproto client: **Settings → Privacy → Export my data** — this downloads a `.car` file containing your full repo.

Alternatively, fetch it directly from your PDS:
```
GET https://<your-pds>/xrpc/com.atproto.sync.getRepo?did=<your-did>
```

## Development

```bash
npm install
node build.mjs   # → writes index.html (self-contained, ~57 KB)
```

The build script bundles `src/main.js` with esbuild and inlines the result into `src/template.html` → `index.html`. No framework, no runtime dependencies in the output.

### Dependencies (build-time only)

| Package | Purpose |
|---------|---------|
| `@ipld/car` | CAR file reader |
| `@ipld/dag-cbor` | DAG-CBOR decoder |
| `fflate` | ZIP generation in the browser |
| `esbuild` | Bundler |

## License

Copyright 2026 DracoBlue <https://dracoblue.net>
MIT License
