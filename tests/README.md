# Core product verification

Run `npm run verify` from the project directory with Node 24+ and installed dependencies (`npm ci` on a fresh checkout). It generates Next route types, type-checks the app, and runs the deterministic regression suite. No running server, API keys, Supabase access, or customer data is needed. `npm run test:regression` runs only the behavioral checks.

Failures exit nonzero. The console identifies the failed group; `test-results/verification.json` records assertion details. The clock is fixed to September 20, 2026 UTC inside the test process only.

## Coverage

- All 14 existing test routes: automotive, HVAC/home services, construction, restaurant, ecommerce, appointments, subscriptions, professional services, field mapping, data quality, classification, industry pipeline, intelligence and ownership. Nested assertion failures fail verification even when a route reports `success: true`.
- Nine existing generated batch suites, including the 120-detector deep expansion. Sixty mixed-industry master specs run independent positive, paid, and missing-amount checks. Example generator specs are templates, not registered production detectors.
- Twelve checked-in CSV fixtures: payment balances in six industries, plus automotive recommended service, HVAC estimate, construction milestone, restaurant catering, ecommerce abandoned cart and retail inventory shrinkage. Expected losses are manually specified in `fixtures/csv/manifest.json`. Each fixture includes a clean control that must not leak.
- Actual multipart `Request` objects go through the production CSV handler, parser, mapper, quality validator, classifier, readiness calculation and detector runner. Checks cover exact detector IDs and dollars, row counts, trusted aliases, industry override, readiness, no detector errors, and correct evidence indexes.
- Empty/missing/wrong-type/oversize uploads, duplicate/blank headers, row-width mismatches, malformed quotes, BOM, CRLF, escaped quotes, quoted commas/newlines, currency, negative/invalid money, invalid dates, all-blocked and mixed files.

These CSVs are synthetic examples of business exports, not independently validated customer datasets. The suite is a core regression gate, not certification of every possible export, financial outcome, browser flow, production build or deployment. Anonymized versions of the four supplied CSV files are now covered as described in `fixtures/supplied/README.md`. The spreadsheet torture files remain outside this CSV suite.

## Existing count checks

Several legacy routes assumed 35 detectors regardless of available columns. Their expected counts now respect the supported catalog and required fields. Named detector checks, known losses, paid/invalid controls, ownership and legacy parity remain intact. The automotive bridge fixture now explicitly expects its 25 universal plus 10 automotive detectors.

Readiness means required column names are available, not that every row contains meaningful values; detectors still perform per-row validation. Detectors with no declared required fields remain runnable by design.

## Adding a regression

Add an anonymized CSV and its independently calculated expectations to the manifest. Avoid copying observed losses into expected values without checking the underlying business calculation. For a new malformed-input case, add an explicit expected rejection to `scripts/verify.mjs`. Add negatives as well as positives.

The small loader uses the installed TypeScript compiler and Node's module hooks to execute real route modules without introducing another test dependency. Type checking is separate and mandatory in `verify`.

## Supplied-file import regressions

`verify-supplied-csv.mjs` extends the same command with 120 rows from four supplied CSVs and targeted alias/normalization cases. Customer aliases prefer Customer Name when available, while callers that request only Record keep their old behavior. Partial-name matching requires whole words; Rep cannot match Replacement Item.

The CSV importer includes explicit metadata fields and performs conservative row normalization before data-quality checks. Deal Value uses Record Type to choose Quote Amount, Invoice Amount, or Job Amount. Explicit target values win. Unknown types produce a normalization issue instead of assigning the amount to an arbitrary detector field. Explicit unpaid labels in Status can supply a missing Payment Status only when an invoice amount exists. The API exposes derivations and issues under `normalization`; The dashboard review displays these normalization issues before approval.

Readiness uses the canonical fields present in accepted rows, including these documented derivations. Invalid values still go through the existing data-quality blocker before any detector runs.

## Dashboard import flow

The primary upload now uses `CsvImportFlow`: choose CSV/Excel, request a detector-free preview, select industry and column mappings, review data-quality exclusions, and explicitly analyze. Changed selections invalidate review. Duplicate mappings, empty/all-blocked imports and failed requests cannot proceed to saving. Excel conversion keeps the existing Business Data/first-sheet convention.

The API accepts `mode=preview` and a JSON `mappingOverrides` form field (source-to-target map; empty target skips a column). It validates source names, canonical targets and duplicate targets. Preview builds mapping, quality and readiness results without running detectors or saving data. Analysis still uses the same verified pipeline. User-selected mappings never bypass row validation.

Both normal uploads and approved AI mappings now use the CSV API instead of the older `analyzeCSV` browser path. AI-approved uploads fail if rows are blocked, rather than claiming every source row was analyzed. Modular detector names, amounts, recovery estimates and original row references feed into dashboard findings. New save attempts preassign finding IDs for immediate recovery actions and attempt to delete their own empty analysis record if the bulk finding insert fails. A failed save keeps results in memory and offers retry without rerunning detectors.

`verify-dashboard-flow.mjs` adds in-process client-to-handler tests, invalid-mapping tests, adapter checks and a server-rendered component smoke check. These do not simulate user interactions in a real browser or authenticate against Supabase. On September 22, 2026, manual browser checks passed against an isolated local mock account backend: preview performs no writes, mapping changes reset approval, HVAC results save and reload with six findings ($6,575 loss, $3,805 estimated recovery), invalid-only data cannot be approved, a failed finding save cleans up its incomplete analysis, retry saves the retained results, immediate contact tracking updates a saved finding, and an Excel Business Data worksheet produces the same six findings as its CSV source. A separate production build (`next build --webpack`) also passed. These checks do not validate live Supabase schema/RLS, real authentication expiry, AI services or mobile layout; those remain release checks.
