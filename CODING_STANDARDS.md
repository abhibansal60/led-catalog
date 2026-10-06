# Coding standards: led-catalog

## Tests and checks

- Put logic worth testing in a `src/lib` module and test it with `node:test` plus hand-rolled fakes for File System Access handles; `App.tsx` has no tests.
- `npm test` esbuild-bundles each tested `src/lib` module into a `.tmp-*.mjs` file that `test/*.test.mjs` imports; a test for a new module needs its bundle and cleanup added to the `test` script in `package.json`. esbuild arrives through vite, not as a direct dependency.
- `npm run build` is `vite build`, which transpiles without typechecking, and `npx tsc --noEmit` currently stops at a tsconfig error (TS5110). Type errors therefore surface only in the editor.

## Where data lives

- Program records and the catalog folder handle live in IndexedDB (`src/lib/storage.ts`, database `led-catalog`). A schema change bumps `DB_VERSION` and extends `onupgradeneeded`.
- Old records lack newer fields, so new `StoredProgram` fields are optional and get defaults on read (`program.controller ?? DEFAULT_CONTROLLER`).
- `.led` bytes live in the user-picked catalog folder; photos are data URLs (max 2 MB) inside the record.
- Every export also POSTs the `ExportedProgramRecord` list, photos included, to `/api/sync`, which keeps one KV key (`latest-catalog`) and serves it on an unauthenticated GET. Treat every field you add to that record as public.

## File System Access

- Feature-detect with `"showDirectoryPicker" in window` and show the bilingual "use Chrome or Edge" message when it is missing. Reach the catalog folder through `ensureDirectoryAccess` in `App.tsx`, which handles permission prompts and persistent storage.
- A cancelled picker throws `DOMException` `AbortError`; return quietly.
- Write files with `writeFileToHandle` (it aborts the stream on failure), then remove the partial file in the caller's `catch`.
- The API's types are hand-declared in `src/types/file-system-access.d.ts`; add any new method you call there.

## Controller and SD card

- Copy-to-SD wipes the card with `clearDirectoryContents`, writes `COPIED_LED_FILENAME` (`00_program.led`), then hash-verifies with `filesMatch`. The controller picks up stale `.led` files, so the wipe stays on every copy.
- `parseLedHeader` asserts only bytes confirmed against the samples in `test-files/`; record new format findings in `docs/led-format-research.md` first.

## UI and logs

- Every user-facing string is bilingual: English, then Hindi in Devanagari (`"English\nहिंदी"` in alerts and confirms, `"English. हिंदी."` in feedback). The main user reads Hindi.
- Build UI from the shadcn primitives in `src/components/ui`, merging classes with `cn` from `@/lib/utils`; import through the `@/` alias.
- Prefix console messages with a status emoji (✅ success, ⚠️ recoverable, ❌ failure); debugging relies on scanning for them.

## Version stamp

`src/lib/version.ts` builds the footer version from `VITE_APP_VERSION` (`ddmmyy-NN`), falling back to `appVersion` in `package.json`. `VITE_BUILD_TIMESTAMP`, `VITE_COMMIT_REF` and `VITE_DEPLOYMENT_ID` come from `define` in `vite.config.ts`, which overrides env vars of the same name; change them there.
