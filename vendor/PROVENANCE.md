# Vendored dependencies — provenance (ADR-008)

## n3.mjs — N3.js (RDF/Turtle parser)

- **Package:** `n3@1.17.4` (JS RDF parser; the analogue of the spec's reference `rdflib`).
- **Source:** esm.sh self-contained node bundle — `https://esm.sh/n3@1.17.4/node/n3.bundle.mjs`.
- **SHA-256:** `61287bef71b5598eda5b86ce2f0d25d34aec5e148376da5dcc43e0431e355eae`
- **Self-contained:** no `/npm` or `http(s)` imports; only `node:` builtins (provided by the runtime).
- **Verified:** parses Turtle including blank-node `owl:Restriction` fillers and reaches
  `owl:someValuesFrom` objects — on the host AND inside the contained sandbox
  (`docker run --network=none --read-only --cap-drop=ALL node:20-alpine`).
- **Why vendored:** FNSR-RefIntegrity-Linter-Spec-R1.0 §FR-3 — cross-module declaration resolution is
  unsound lexically (multi-line `subject … a owl:Class` declarations + IRIs inside `owl:Restriction`
  fillers). The spec's reference impl is `rdflib`; "a JS + N3.js implementation is acceptable." A
  hand-rolled lexical tokenizer failed the in-loop judge (it dropped semicolons, breaking FR-6b), so
  the parser is delegated to N3.js. Authorized 2026-06-11.
- **Used by:** `src/ri-collect.mjs` (`import { Parser } from "../vendor/n3.mjs"`).
