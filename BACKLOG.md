# IRI_Linter & Validation Ecosystem — Phased Backlog & Roadmap

**Last Updated:** 2026-06-11  
**Status:** Roadmap (R1.2 in production, R1.0 under build, R2.0 planned)

---

## Executive Summary

This backlog articulates the evolution of the IRI/Reference validation ecosystem across three major versions:

- **R1.2 (Current):** Verify-before-assert on CCO IRIs; lexical extraction; single-file linting.
- **R1.0 (In Build):** Cross-module referential integrity; dangling-reference detection; scheme conformance.
- **R2.0 (Planned):** Schema validation; domain/range enforcement; axiom consistency checking.

The backlog is organized by **value delivery** (what developers and semantic engineers need) and **fit for purpose** (the right tool at each stage of the validation pipeline). Each phase includes acceptance criteria, estimated scope, and integration points.

---

## Value Proposition

### For Developers

- **R1.2/R1.0:** Catch IRIs, references, and scheme errors in CI before merge. Fail fast on local issues (typos, dangling refs).
- **R2.0:** Validate semantic constraints early; prevent schema violations from corrupting downstream reasoning and ABox conformance.

### For Semantic Engineers

- **R1.2/R1.0:** Maintain corpus-wide referential integrity; prove that overlays, catalogs, and cross-module wiring resolve correctly.
- **R2.0:** Enforce domain/range rules, class hierarchy consistency, and APQC business logic; catch data quality issues before ontology export.

### For CI/Pipeline

- All gates run offline, deterministically, in parallel; distinct exit codes (0 = clean, 1 = lint failures, 2 = systemic error).
- Composable: R1.2 → R1.0 → [Gates B–E] → R2.0 → SHACL/Reasoner (Gates C–E).

---

## Validation Pipeline Architecture

```
Input: TTL modules + register (optional)
  ↓
[Gate A] IRI_Linter (R1.2) — CCO IRI verify-before-assert
  ↓ (fail → exit 1)
[Gate B] External CCO/OBO existence validator
  ↓
[Gate F] Ref-Integrity Linter (R1.0) — dangling refs, scheme
  ↓ (fail → exit 1)
[Gate G] Schema Validator (R2.0) — domain/range, axioms
  ↓ (fail → exit 1)
[Gates C/D/E] SHACL, ELK reasoning, profile conformance
  ↓ (fail → exit 1)
Output: Validated, merged ontology
```

---

# ROADMAP: By Phase

## PHASE 1: Developer Workflow Enablement (R1.2 Enhancement)

**Goals:**  
- Unblock multi-file linting without shell loops.  
- Enable IDE/LSP integration for real-time feedback.  
- Add human-readable output modes for CLI development.

**Duration:** 2–3 weeks  
**Priority:** HIGH (immediate developer productivity gains)

---

### 1.1 Multi-File Batch Mode

**Issue Title:** `feat: add `--modules` batch mode to replace shell loops`

**Value:** Developers with 13+ TTL slices can now:
```bash
# Before (shell loop required)
for f in ontology/slices/*.ttl; do node index.mjs --ttl "$f" --register reg.json; done

# After (single invocation)
node index.mjs --modules ontology/slices/*.ttl --register reg.json
```

**Spec Link:** R1.0 FR-4 (already anticipated in Ref-Integrity Linter spec)

**Acceptance Criteria:**
- [ ] CLI accepts `--modules <glob-or-paths…>` (mutually exclusive with `--ttl`).
- [ ] Both `--ttl` and `--modules` are supported; at least one is required.
- [ ] Exit codes remain unchanged (0/1/2).
- [ ] Output format unchanged; violations report file name from glob expansion.
- [ ] Pre-commit / CI scripts work without `find` / loop wrapper.
- [ ] Test: `npm test -- --modules` passes on 13-file fixture set.

**Implementation Notes:**
- Use Node's built-in `glob` module or yargs `builder` for cross-platform expansion.
- Document: glob expansion is shell-dependent; recommend quoting: `--modules 'ontology/slices/*.ttl'`.
- Batch reporting: one line per violation (same as single-file).

**Effort:** 1–2 days (mostly CLI arg parsing + glob handling).

---

### 1.2 Structured Output (JSON)

**Issue Title:** `feat: add `--output json` for machine-readable validation results`

**Value:** Unblock CI/dashboard integration, deduplication, and cross-run analysis.

**Acceptance Criteria:**
- [ ] CLI accepts `--output json` (default: `--output text`).
- [ ] JSON schema is versioned and stable (`"format_version": "1.0"`).
- [ ] Output includes: violations array, statistics (counts by type), metadata (runner, timestamp).
- [ ] Each violation includes: `file`, `line`, `type`, `lexeme`, `suggestion` (if applicable), `rule` (if applicable).
- [ ] Test: Existing acceptance fixtures produce valid JSON; JSON parses and validates against schema.
- [ ] Example output documented in README.

**JSON Schema:**
```json
{
  "format_version": "1.0",
  "metadata": {
    "runner": "iri-linter@1.0.0",
    "timestamp": "2026-06-11T12:34:56Z",
    "input": { "modules": ["file1.ttl", "file2.ttl"], "register": "reg.json" }
  },
  "statistics": {
    "total_violations": 3,
    "by_type": {
      "unverified": 1,
      "readable_label": 2
    }
  },
  "violations": [
    {
      "file": "ontology/slices/apqc_1_0.ttl",
      "line": 42,
      "type": "readable_label",
      "lexeme": "cco:has_output",
      "suggestion": "cco:ont00001986"
    }
  ]
}
```

**Effort:** 2–3 days (JSON marshalling, schema definition, documentation).

---

### 1.3 Optional Register for Partial Checks

**Issue Title:** `feat: make `--register` optional to enable opaque-form-only validation`

**Value:** Developers who only care about detecting typos in CCO opaque form (e.g., `cco:ont00000042` vs. `cco:ont9999999`) can run the linter without a register.

**Acceptance Criteria:**
- [ ] CLI accepts invocation without `--register`.
- [ ] When register is absent: `unverified` checks run; `readable_label` suggestions skipped.
- [ ] Exit codes unchanged.
- [ ] Test: Single-file and multi-file modes work without register.
- [ ] Documentation: clarify what checks are skipped.

**Effort:** 1 day (minimal code change; mostly documentation).

---

### 1.4 Summary / Verbose Modes

**Issue Title:** `feat: add `--summary` and `--verbose` flags for human-readable output`

**Value:** Developers running manual checks or in development receive feedback even when exit code is 0 (clean).

**Acceptance Criteria:**
- [ ] `--summary` appends "Clean: 0 violations found" or "Found N violations" to stdout.
- [ ] `--verbose` prints extra metadata (files processed, validation stages, timing).
- [ ] Both flags work with `--output json` and `--output text`.
- [ ] Test: Manual invocation shows summary; CI script usage is unaffected.

**Effort:** 1 day.

---

### 1.5 Pre-Commit Hook Template

**Issue Title:** `docs: add pre-commit hook integration guide and template`

**Value:** Developers can add IRI_Linter to `.pre-commit-config.yaml` for automatic lint on commit.

**Acceptance Criteria:**
- [ ] `hooks/pre-commit-iri-linter.sh` template in repo.
- [ ] `.pre-commit-hooks.yaml` configured (if using pre-commit framework).
- [ ] README includes example `.pre-commit-config.yaml`.
- [ ] Guide covers: single-file, multi-file, passing `--register` path.
- [ ] Test: local `pre-commit run iri-linter --all-files` passes on clean fixture.

**Effort:** 1 day (templates + documentation).

---

### 1.6 IDE/LSP Stubs

**Issue Title:** `docs: outline IDE adapter architecture for VS Code / Emacs / LSP`

**Value:** Developers get real-time inline diagnostics in their editor.

**Acceptance Criteria:**
- [ ] Design doc: `docs/ide-integration-architecture.md` (not a full implementation yet, just the blueprint).
- [ ] Outline for VS Code extension (`adapters/vscode-iri-linter/`).
- [ ] Outline for LSP server (`adapters/lsp-server/`).
- [ ] Recommend: spawn linter as child process, parse JSON output, feed into editor diagnostics API.
- [ ] Link to example LSP implementations (e.g., Pylance, Rust Analyzer).

**Effort:** 1–2 days (design doc + architecture examples, no implementation yet).

---

## PHASE 2: Reference Integrity Baseline (R1.0 Implementation)

**Goals:**  
- Ship R1.0 Referential-Integrity Linter (spec-complete).  
- Validate dangling references, cross-module wiring, scheme conformance.  
- Gate F in production pipeline.

**Duration:** 3–4 weeks  
**Priority:** HIGH (blocks R2.0; unblocks deployment overlays, catalogs)

**Note:** This phase is largely orthogonal to Phase 1 and can proceed in parallel.

---

### 2.1 Collection Module (`collect`)

**Issue Title:** `feat(R1.0): implement `collect` module for declaration and reference extraction`

**Spec Link:** R1.0 §3, FR-6–FR-7

**Value:** Cross-module foundation; identifies declared IRIs and all references (including in restrictions/fillers).

**Acceptance Criteria:**
- [ ] `collect(modules: { name, text }[]) -> { declared: Set<iri>, references: Reference[] }`
- [ ] Handles RDF parser (Python `rdflib` or JS `N3.js`).
- [ ] Correctly extracts references inside `owl:Restriction` fillers (FR-6b).
- [ ] Correctly extracts references in annotation property objects (FR-6b).
- [ ] Ignores comment text, `@prefix`, and string literals (FR-7).
- [ ] Test: FR-17 (dirty fixture) collects expected declared set and reference list.

**Effort:** 3–4 days (RDF parsing, triple iteration, reference collection).

---

### 2.2 Resolution Module + CLI (`resolve` + `index.py`)

**Issue Title:** `feat(R1.0): implement referential integrity resolver and CLI`

**Spec Link:** R1.0 §4–§6, FR-8–FR-10, FR-14–FR-15

**Value:** Flags dangling references; exit codes; machine-checkable output.

**Acceptance Criteria:**
- [ ] `resolve(collected, register?) -> Issue[]` detects dangling `ex:`/`perf:` IRIs (FR-8).
- [ ] No false positives on declared IRIs (FR-9).
- [ ] CLI: `iri_ref_lint --modules <paths…> [--register <reg.json>]`
- [ ] Exit codes: 0 (clean), 1 (violations), 2 (systemic error).
- [ ] Output: `<module>:<line> dangling_ref <iri>` (one line per violation).
- [ ] Test: FR-18 (corpus baseline) reports exactly 0 dangling refs + pass.
- [ ] Test: FR-17 (dirty fixture) reports expected violations + exit 1.

**Effort:** 3–4 days (resolution logic, CLI wrapper, file I/O).

---

### 2.3 Scheme Conformance Module (`flag_extra`)

**Issue Title:** `feat(R1.0): add scheme conformance checks (D7: capability-as-process, pcf-without-P-iri)`

**Spec Link:** R1.0 §5, FR-11–FR-13

**Value:** Flag processes wearing capability IRIs; catch D7 scheme slips.

**Acceptance Criteria:**
- [ ] Port readable-label check from R1.2 (FR-11).
- [ ] Flag `ex:P<pcfID>` declared as `rdfs:subClassOf cco:ont00000568` (capability) (FR-12a).
- [ ] Flag `ex:P<anything>` bearing `ex:pcfID` but local name does not match (FR-12b).
- [ ] Output: `<module>:<line> scheme_violation <iri> (<rule>)` (one rule per type).
- [ ] Test: FR-17 extended with 39-item baseline (current corpus findings).
- [ ] Test: Regression—FR-8/FR-9 still pass after this edit.

**Effort:** 2–3 days (axiom inspection, rule logic).

---

### 2.4 Integration into Pipeline

**Issue Title:** `docs(R1.0): integrate Gate F into validate.py and corpus_check.sh`

**Value:** R1.0 runs in CI after Gate B; blocks merge if dangling refs detected.

**Acceptance Criteria:**
- [ ] `src/apqc_transform/validate.py` imports and runs R1.0 as Gate F.
- [ ] `scripts/corpus_check.sh` includes R1.0 invocation.
- [ ] Exit code handling: 1 → lint failure, 2 → systemic error (both halt pipeline).
- [ ] Documentation: gate order and dependencies (which gates before/after R1.0).

**Effort:** 1–2 days (thin wrapper, mostly configuration).

---

## PHASE 3: Schema Validation Foundation (R2.0 — First Sprint)

**Goals:**  
- Establish domain/range validation as the semantic baseline.  
- Catch data quality issues (type mismatches, range violations).  
- Lay groundwork for axiom consistency checks.

**Duration:** 4–6 weeks  
**Priority:** HIGH (semantic engineers' top pain point; blocks axiom reasoning)

**Note:** R2.0 assumes R1.0 is complete (depends on merged corpus, module set).

---

### 3.1 Schema Extraction Module (`extract_schema`)

**Issue Title:** `feat(R2.0): implement schema extraction (domain/range/cardinality axioms, class hierarchy)`

**Spec Link:** R2.0 FR-1 (proposed)

**Value:** Collect all domain/range/cardinality/hierarchy axioms from merged corpus for validation.

**Acceptance Criteria:**
- [ ] `extract_schema(modules) -> { axioms: Axiom[], hierarchy: Graph }`
- [ ] Axiom types: domain, range, functional, cardinality (min/max), disjoint, inverse.
- [ ] Class hierarchy as DAG (directed acyclic graph) of `rdfs:subClassOf` edges.
- [ ] Supports both explicit axioms (`rdfs:domain`, `owl:Restriction`) and inferred (usage patterns).
- [ ] Schema for `ex:` and `perf:` properties; CCO/OBO trusted (Gate B validates).
- [ ] Test: Fixture with known domain/range axioms extracts correctly.

**Effort:** 3–4 days (axiom parsing, hierarchy construction).

---

### 3.2 Domain/Range Validator

**Issue Title:** `feat(R2.0): enforce domain/range constraints on property usage`

**Spec Link:** R2.0 FR-2 (proposed)

**Value:** Flag every property use that violates declared or inferred domain/range.

**Acceptance Criteria:**
- [ ] For each `subject predicate object` triple:
  - Check: `subject` type is in `predicate.domain`.
  - Check: `object` type is in `predicate.range`.
- [ ] Issue type: `domain_violation` and `range_violation`.
- [ ] Output: `<module>:<line> domain_violation <iri> (expected: <type>, got: <type>)`
- [ ] Inference mode: infer domain/range from usage if not explicit (flag: `--trust-explicit` to skip).
- [ ] Test: Fixture with deliberate type mismatches; linter flags all.
- [ ] Acceptance: Clean corpus (live APQC) produces zero domain/range violations.

**Effort:** 4–5 days (type checking, inference logic, inference-mode toggle).

---

### 3.3 Class Hierarchy Consistency Checker

**Issue Title:** `feat(R2.0): detect cycles and disjointness violations in class hierarchy`

**Spec Link:** R2.0 FR-3 (proposed)

**Value:** Catch logical inconsistencies before reasoner (fail-fast).

**Acceptance Criteria:**
- [ ] Detect cycles: `A rdfs:subClassOf B rdfs:subClassOf A`.
- [ ] Detect disjointness violations: `A rdfs:subClassOf B` and `A rdfs:subClassOf C` where `B owl:disjointWith C`.
- [ ] Issue types: `hierarchy_cycle`, `disjointness_violation`.
- [ ] Output: `<module>:<line> hierarchy_cycle <iri> -> <iri> -> … -> <iri>` (path in cycle).
- [ ] Test: Fixtures with known cycles and disjoint-class violations.
- [ ] Acceptance: Live corpus has zero cycles (true acyclic hierarchy).

**Effort:** 3–4 days (cycle detection via DFS, disjointness checking).

---

### 3.4 Integration & Reporting (R2.0 Gate G)

**Issue Title:** `feat(R2.0): integrate schema validator as Gate G into pipeline`

**Value:** Schema checks run as a distinct gate after R1.0, before SHACL/reasoner.

**Acceptance Criteria:**
- [ ] CLI: `schema_validate --modules <paths…> [--trust-explicit]`
- [ ] Exit codes: 0/1/2 (aligned with R1.0).
- [ ] Output format: `<module>:<line> <type> <iri> [details]` (machine-checkable).
- [ ] Integrate into `validate.py` as Gate G (after Gate F).
- [ ] Documentation: which checks run, what violations look like.

**Effort:** 2–3 days (CLI wrapper, pipeline integration).

---

## PHASE 4: Developer Ergonomics & IDE Integration (R1.2/R1.0 Enhancement)

**Goals:**  
- Ship IDE extensions for real-time linting.  
- Add pre-commit hooks and CI templates.  
- Comprehensive documentation for all workflows.

**Duration:** 3–4 weeks  
**Priority:** MEDIUM (valuable, but Phase 1–3 are blockers)

**Note:** Can overlap with Phase 3.

---

### 4.1 VS Code Extension

**Issue Title:** `feat: implement VS Code extension for IRI_Linter diagnostics`

**Value:** Developers see violations inline; hover for suggestions.

**Repository:** Separate repo (`vscode-iri-linter`) or npm package.

**Acceptance Criteria:**
- [ ] Extension spawns linter CLI, parses JSON output, feeds into VS Code diagnostics.
- [ ] Inline squiggles for violations; hover shows type and suggestion.
- [ ] Status bar: "Linter: 3 violations" (clickable to show panel).
- [ ] Settings: custom linter path, register path, modules glob.
- [ ] On-save and on-command triggers.
- [ ] Test: Manual test on fixture; diagnostics display correctly.

**Effort:** 2–3 weeks (extension scaffolding, API integration, testing, release to VS Code Marketplace).

---

### 4.2 Emacs / LSP Server Adapter

**Issue Title:** `feat: implement lightweight LSP server wrapper for IRI_Linter`

**Value:** Emacs + `lsp-mode` users get IDE-quality linting.

**Repository:** Separate repo (`iri-linter-lsp-server`).

**Acceptance Criteria:**
- [ ] LSP server wraps CLI; implements `initialize`, `textDocument/didOpen`, `textDocument/didChange`, `textDocument/publishDiagnostics`.
- [ ] Configurable module glob, register path.
- [ ] Test: Manual Emacs + lsp-mode integration.

**Effort:** 1–2 weeks (LSP scaffolding, CLI wrapping).

---

### 4.3 Pre-Commit Hook Integration

**Issue Title:** `feat: provide pre-commit hook for automatic on-commit linting`

**Value:** Developers catch violations before pushing.

**Acceptance Criteria:**
- [ ] `.pre-commit-hooks.yaml` defines a `iri-linter` hook.
- [ ] Hook runs linter on changed `.ttl` files; blocks commit on violations.
- [ ] Supports `--modules` glob and `--register` path configuration.
- [ ] Example `.pre-commit-config.yaml` in README.
- [ ] Test: Manual pre-commit run passes on clean fixture, fails on dirty.

**Effort:** 1–2 days (hook template, documentation).

---

### 4.4 CI/CD Template (GitHub Actions)

**Issue Title:** `docs: provide GitHub Actions workflow template for linting in CI`

**Value:** One-click linting setup for projects using GitHub Actions.

**Acceptance Criteria:**
- [ ] `.github/workflows/iri-linter.yml` template.
- [ ] Runs on PR, uploads JSON results as artifact.
- [ ] Fails job if violations found.
- [ ] Configurable modules, register paths.
- [ ] Example in README.

**Effort:** 1 day (workflow template, documentation).

---

### 4.5 Comprehensive Documentation & Examples

**Issue Title:** `docs: expand README with workflows, examples, architecture guide`

**Value:** Developers and semantic engineers can self-serve to integrate linters into their workflows.

**Acceptance Criteria:**
- [ ] **README.md:** Expand with:
  - Quickstart (single file, multi-file, batch mode).
  - Register format mini-spec with example.
  - Output format: text vs. JSON.
  - Integration: pre-commit, GitHub Actions, IDE, manual.
- [ ] **docs/architecture.md:** High-level design of R1.2/R1.0/R2.0 gates.
- [ ] **docs/register-format.md:** Detailed register schema.
- [ ] **docs/ide-integration.md:** VSCode + Emacs setup guides.
- [ ] **docs/CONTRIBUTING.md:** Spec-first workflow, FR-N traceability, testing.
- [ ] **examples/:** Sample workflows, fixtures, register files.

**Effort:** 2–3 days (documentation writing, review, publication).

---

## PHASE 5: Semantic Axiom Enforcement (R2.0 — Second Sprint)

**Goals:**  
- Enforce OWL axiom constraints (functional, cardinality, inverse).  
- Validate APQC-specific business rules.  
- Establish semantic consistency baseline.

**Duration:** 4–6 weeks  
**Priority:** MEDIUM (high semantic value, medium developer visibility)

**Note:** Depends on Phase 3 completion.

---

### 5.1 Functional Property Validator

**Issue Title:** `feat(R2.0): enforce owl:FunctionalProperty uniqueness`

**Spec Link:** R2.0 FR-4 (proposed)

**Value:** Flag properties declared as functional (e.g., `ex:pcfID`) when an IRI has multiple values.

**Acceptance Criteria:**
- [ ] For each `subject` with multiple `subject predicate object1` and `subject predicate object2`:
  - Check: `predicate owl:isFunctionalProperty true`.
  - If true: issue `functional_property_violation`.
- [ ] Output: `<module>:<line> functional_property_violation <iri> <predicate> (values: <obj1>, <obj2>)`
- [ ] Test: Fixture with `ex:Process ex:pcfID "123" ; ex:pcfID "456"` → flagged.

**Effort:** 2–3 days.

---

### 5.2 Cardinality Constraint Validator

**Issue Title:** `feat(R2.0): validate owl:minCardinality and owl:maxCardinality on classes`

**Spec Link:** R2.0 FR-5 (proposed)

**Value:** Enforce restrictions like "every process must have ≥1 `ex:pcfID`".

**Acceptance Criteria:**
- [ ] Parse `owl:Restriction` with `owl:minCardinality`, `owl:maxCardinality`.
- [ ] For each class that has restrictions:
  - Check instances; count property values.
  - Issue if cardinality is violated.
- [ ] Output: `<module>:<line> cardinality_violation <iri> <predicate> (expected: min=1, got: 0)`
- [ ] Test: Fixture with missing/excess property values.

**Effort:** 3–4 days.

---

### 5.3 Inverse Property Consistency Checker

**Issue Title:** `feat(R2.0): validate owl:inverseOf consistency across corpus`

**Spec Link:** R2.0 FR-6 (proposed)

**Value:** Catch bidirectional property inconsistencies (e.g., `ex:hasCapability` ↔ `ex:usedBy`).

**Acceptance Criteria:**
- [ ] For each property declared with `owl:inverseOf`:
  - For each `s p o` triple: check that `o inverseOf(p) s` exists.
  - Issue if missing.
- [ ] Output: `<module>:<line> inverse_property_violation <iri> <predicate> (missing inverse: <obj> <inverse_prop> <subj>)`
- [ ] Test: Fixture with missing inverse triple.

**Effort:** 3–4 days.

---

### 5.4 APQC Business Rules Enforcement

**Issue Title:** `feat(R2.0): enforce APQC-specific axiom rules (mandatory properties, process taxonomy)`

**Spec Link:** R2.0 FR-7 (proposed)

**Value:** Codify APQC domain constraints as linter rules.

**Examples:**
- Every `ex:Process` must have exactly one `ex:pcfID` (mandatory).
- Every `ex:Capability` must have `rdfs:label` (mandatory).
- If `ex:Process ex:designatesProcessType ex:Type1`, then `ex:Type1 ex:enablesProcess ex:Process` must exist (interdependency).
- No process can have both `ex:category` and `ex:subcategory` (mutual exclusion).

**Acceptance Criteria:**
- [ ] Business rules defined in JSON/YAML config file (e.g., `rules/apqc-rules.json`).
- [ ] Validator loads rules; checks each against corpus.
- [ ] Output: `<module>:<line> business_rule_violation <iri> <rule_name>` (with description).
- [ ] Test: Fixtures with known business-rule violations.
- [ ] Integration: flag `--rules apqc-rules.json` (optional; default to empty).

**Effort:** 4–5 days (rule engine, config schema, testing).

---

### 5.5 Schema Drift Detection (Semantic Versioning)

**Issue Title:** `feat(R2.0): detect and report schema axiom drift across versions`

**Value:** Semantic engineers track changes to domain/range/cardinality between corpus versions; catch silent regressions.

**Acceptance Criteria:**
- [ ] CLI: `schema_drift --old-modules <paths…> --new-modules <paths…>`
- [ ] Report types of axiom changes: `domain_changed`, `range_changed`, `cardinality_loosened`, `cardinality_tightened`.
- [ ] Output: `<property> domain_changed (was: <type1>, now: <type2>)`
- [ ] Test: Two fixture versions with known axiom differences; drift detection reports all.

**Effort:** 2–3 days.

---

## PHASE 6: Ecosystem & Downstream Integration (R2.0 — Third Sprint)

**Goals:**  
- Generate SHACL shapes from inferred constraints.  
- Export findings to Protégé, SHACL validators.  
- Integrate with OWL reasoner for full validation pipeline.

**Duration:** 3–4 weeks  
**Priority:** LOW-MEDIUM (valuable for deployment, not blocking R2.0 core)

---

### 6.1 SHACL Shape Generation

**Issue Title:** `feat(R2.0): generate SHACL shapes from domain/range and cardinality axioms`

**Value:** Downstream SHACL validators inherit R2.0's rules; reusable constraint definitions.

**Acceptance Criteria:**
- [ ] CLI: `schema_to_shacl --modules <paths…> --output shacl.ttl`
- [ ] Generated SHACL shapes cover: domain/range, cardinality, functional, disjoint.
- [ ] Output is valid SHACL (TTL syntax).
- [ ] Test: SHACL validator validates same fixtures as R2.0; violations align.

**Effort:** 3–4 days.

---

### 6.2 Protégé Integration (Documentation)

**Issue Title:** `docs: guide for exporting R2.0 findings to Protégé OWL syntax`

**Value:** Semantic engineers can load violations into Protégé for interactive review.

**Acceptance Criteria:**
- [ ] Export violations as OWL annotation properties (e.g., `ex:hasLinterViolation`).
- [ ] Guide: format, how to import into Protégé, usage workflow.
- [ ] Test: Manual import of exported violations into Protégé.

**Effort:** 1–2 days (documentation + example export script).

---

### 6.3 Metrics & Observability

**Issue Title:** `feat(R2.0): export metrics (violation counts, axiom counts, performance) for monitoring`

**Value:** Track semantic health over time; identify corpus quality trends.

**Acceptance Criteria:**
- [ ] `--metrics` flag outputs CSV/JSON: violations by type, axiom counts, parse time, file sizes.
- [ ] Example dashboard integration (e.g., link to Grafana snippet).
- [ ] Test: Metrics output is valid JSON/CSV; values are reasonable.

**Effort:** 1–2 days.

---

## Backlog Prioritization Matrix

| Phase | Item | Value | Effort | Dependency | Go/No-Go |
|---|---|---|---|---|---|
| **1** | 1.1 Multi-file batch | HIGH | 2d | None | ✅ GO |
| **1** | 1.2 JSON output | HIGH | 3d | None | ✅ GO |
| **1** | 1.3 Optional register | MED | 1d | None | ✅ GO |
| **1** | 1.4 Summary/verbose | MED | 1d | None | ✅ GO |
| **1** | 1.5 Pre-commit template | MED | 1d | None | ✅ GO |
| **1** | 1.6 IDE/LSP stubs | MED | 2d | None | ✅ GO |
| **2** | 2.1 Collect module | HIGH | 4d | None | ✅ GO |
| **2** | 2.2 Resolve + CLI | HIGH | 4d | 2.1 | ✅ GO |
| **2** | 2.3 Scheme conformance | HIGH | 3d | 2.2 | ✅ GO |
| **2** | 2.4 Pipeline integration | HIGH | 2d | 2.3 | ✅ GO |
| **3** | 3.1 Schema extraction | HIGH | 4d | 2.2 | ✅ GO |
| **3** | 3.2 Domain/range validator | HIGH | 5d | 3.1 | ✅ GO |
| **3** | 3.3 Hierarchy checker | HIGH | 4d | 3.1 | ✅ GO |
| **3** | 3.4 Integration Gate G | HIGH | 3d | 3.2, 3.3 | ✅ GO |
| **4** | 4.1 VS Code extension | MED | 2w | 1.2, 2.4 | ✅ GO |
| **4** | 4.2 LSP adapter | MED | 1w | 1.2, 2.4 | ⏸ DEFER |
| **4** | 4.3 Pre-commit integration | MED | 1d | 1.5 | ✅ GO |
| **4** | 4.4 GitHub Actions template | MED | 1d | 1.2 | ✅ GO |
| **4** | 4.5 Documentation | MED | 3d | All Phase 1–3 | ✅ GO |
| **5** | 5.1 Functional properties | MED | 3d | 3.4 | ✅ GO |
| **5** | 5.2 Cardinality validator | MED | 4d | 3.4 | ✅ GO |
| **5** | 5.3 Inverse properties | MED | 4d | 3.4 | ✅ GO |
| **5** | 5.4 APQC business rules | HIGH | 5d | 3.4 | ✅ GO |
| **5** | 5.5 Schema drift detection | LOW | 3d | 3.4 | ⏸ DEFER |
| **6** | 6.1 SHACL generation | LOW | 4d | 3.4 | ⏸ DEFER |
| **6** | 6.2 Protégé integration | LOW | 2d | 3.4 | ⏸ DEFER |
| **6** | 6.3 Metrics & observability | LOW | 2d | Any | ⏸ DEFER |

**Legend:**
- ✅ **GO:** Ship in the next phase or concurrent phase.
- ⏸ **DEFER:** Ship in a future phase or only if capacity allows.

---

## Execution Timeline

### **Q3 2026 (8 weeks)**

- **Weeks 1–3:** Phase 1 (Developer Workflow) — Items 1.1–1.6.
  - Milestone: `v1.2.1` released with batch mode, JSON output, pre-commit hook.
- **Weeks 1–4:** Phase 2 (R1.0 Implementation) — Items 2.1–2.4 (parallel).
  - Milestone: `v1.0.0` (Referential-Integrity Linter) released; Gate F integrated into pipeline.
- **Weeks 5–8:** Phase 3 (Schema Validation) — Items 3.1–3.4 (critical path).
  - Milestone: `v2.0.0-alpha` (Schema Validator) released; Gate G in pre-production testing.

### **Q4 2026 (8 weeks)**

- **Weeks 1–4:** Phase 4 (Ergonomics) — Items 4.1–4.5.
  - Milestone: VS Code extension published; comprehensive documentation shipped.
- **Weeks 5–8:** Phase 5 (Semantic Axioms) — Items 5.1–5.4 (critical path: 5.4 APQC rules).
  - Milestone: `v2.0.0` (Schema Validator GA) released with business rules engine.

### **Q1 2027 (8 weeks)**

- **Weeks 1–4:** Phase 6 (Ecosystem) — Items 6.1–6.3 (if capacity).
  - Milestone: SHACL integration, Protégé export, metrics dashboard (optional).

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| **R1.0 delays Phase 2–3** | HIGH | Run Phase 1 & 2 in parallel; Phase 3 waits for Phase 2. Allocate separate team for Phase 1. |
| **Schema inference produces false positives** | MEDIUM | Add `--trust-explicit` flag; default to inferred mode; document confidence levels. Extensive testing on live corpus. |
| **APQC business rules churn** | MEDIUM | Version rules in `apqc-rules.json`; maintain backward compatibility. Solicit semantic engineer feedback early. |
| **IDE integration complexity** | LOW | Start with VS Code (most popular); Emacs LSP adapter is optional. Use established extension scaffolding. |
| **Ecosystem divergence (SHACL, Protégé)** | LOW | SHACL generation is read-only export; Protégé export is documentation-only. No production blocker. |

---

## Success Criteria

### By End of Q3 2026
- [ ] Phase 1 complete: 100% of developers using batch mode + one IDE integration (VS Code in beta).
- [ ] Phase 2 complete: R1.0 in production; Gate F blocking 0 merges; 100% corpus passes dangling-ref check.
- [ ] Phase 3 Alpha: Domain/range validator passes on live corpus (zero false positives); schema extraction stable.

### By End of Q4 2026
- [ ] Phase 3 GA: R2.0 production-ready; schema validation integrated into CI pipeline.
- [ ] Phase 4 complete: Pre-commit hook adoption 70%+; VS Code extension 100+ downloads.
- [ ] Phase 5 complete: APQC business rules codified; corpus passes all rule checks.

### By End of Q1 2027 (Optional)
- [ ] Phase 6 optional items shipped (SHACL, Protégé, metrics).
- [ ] Full validation pipeline (Gates A–G + SHACL) operational; semantic health metrics visible.

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **Gate** | A validation checkpoint in the CI/CD pipeline (A = IRI_Linter, F = Ref-Integrity, G = Schema Validator). |
| **TTL** | Turtle (RDF text syntax). |
| **Opaque IRI** | CCO local name matching `^ont\d+$` (e.g., `cco:ont00001986`). |
| **Readable label** | CCO reference in human form (e.g., `cco:has_output`); not opaque. |
| **Dangling ref** | A local-namespace IRI (`ex:` / `perf:`) that is referenced but never declared. |
| **Scheme violation** | An IRI whose structure violates domain rules (e.g., `ex:P<pcfID>` on a capability). |
| **Domain/Range** | RDF/OWL axioms constraining which types can be subjects/objects of a property. |
| **Axiom** | An RDF triple asserting a fact, rule, or constraint (e.g., `ex:Property rdfs:domain ex:Type`). |
| **Merged corpus** | All TTL modules combined (13 slices + catalogs + overlays + performance layer). |

---

## Document History

| Date | Author | Change |
|---|---|---|
| 2026-06-11 | @Skreen5hot | Initial draft: Phases 1–6, prioritization matrix, timeline. |

