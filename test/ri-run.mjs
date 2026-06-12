// Seeded dynamic runner (do not edit): import every test/RI<n>.test.mjs (each runs its assertions on
// import), then report. Runs ONLY the RefIntegrity tool's tests, not the existing IRI_Linter tests.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { report } from "./_assert.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => /^RI\d+\.test\.mjs$/.test(f)).sort();
for (const f of files) { await import("./" + f); }
process.exit(report() ? 0 : 1);
