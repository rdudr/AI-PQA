# Instrument models: adding or changing one

The analyser models live in one place, this repository, and are copied into the KISEM
field apps that read logger files. Keep it that way: never edit a model inside an app.

## Where things are

| What | Where |
| --- | --- |
| The model mappings (source of truth) | `backend/config/mappings/<MODEL>.json` |
| The analyzer's own extra columns (not copied) | `backend/config/mappings/<MODEL>_custom_columns.json` |
| Which apps get the models, and display names | `tools/pq-sync/targets.json` |
| The shared browser reader the apps use | `tools/pq-sync/pq-read.ts` |
| The copy script | `tools/pq-sync/sync.mjs` |

Apps that receive the models today:

- **MLA**: `lib/pq-mappings/` (long-term motor monitoring, read by `lib/pq-import.ts`).
- **A-CMP**: `lib/pq-mappings/` and `lib/pq-read.ts` (Excel based load / unload of
  compressors, read by `lib/load-unload.ts`).

Each app gets one JSON file per model and a generated `lib/pq-mappings/index.ts` that lists
them. The app builds its "Instrument model" list from that index, so a new model shows in
the app with no change to the app's code.

## Adding a new analyser or clamp meter

1. Put its mapping in `backend/config/mappings/<MODEL>.json`, the same shape as the others:
   the vendor's column header on the left, the standard column on the right (`kw`, `kva`,
   `pf`, `voltage_phase_a`, `current_phase_a`, `date`, `time`, `timestamp` …), or `"NA"`
   for a header that must be ignored.
2. Optional: give it a display name in `tools/pq-sync/targets.json` under `models`
   (`id`, `label`, `slug`, and `"kind": "Clamp"` for a clamp meter). Without an entry the
   name comes from the file name, and any file with "clamp" in its name counts as a clamp
   meter.
3. Run the sync from this repository:

   ```bash
   node tools/pq-sync/sync.mjs
   ```

   `node tools/pq-sync/sync.mjs --check` only lists the apps that are out of date.
4. Commit and push each app that changed (`git push kisem oracle`). The server builds the
   new web app and APK.

Changing a model works the same way: edit its JSON here, run the sync, and push the apps.
Changing the shared reader means editing `tools/pq-sync/pq-read.ts`, then running the sync.

## Adding another app

Add a line to `targets` in `tools/pq-sync/targets.json`. `dir` is the app's `lib` folder
relative to this repository. Set `"reader": true` if the app should also get `pq-read.ts`.
Then run the sync.

## Other instruments, not from this repository

- **Thermo-X** reads KANE flue-gas analyser exports (KANE958, KANE988) in
  `thermo-X/lib/instrument-parser.ts`. Its columns are matched by name, so a new KANE model
  usually works as it is. Any other flue-gas analyser is added there, not here.
