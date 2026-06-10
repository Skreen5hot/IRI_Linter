# FNSR Referential-Integrity Linter — Spec R1.0

A small, offline linter that closes the gap the IRI_Linter bake-off proved empirically: a dangling
`ex:NonexistentCapability` reference passes **both** the IRI_Linter (CCO-only) **and** Gate B
(`cco:`/`obo:`-only). This tool checks that every project-minted (`ex:`/`perf:`) IRI **referenced**
anywhere in the merged corpus **resolves** to a **declared** term somewhere in that corpus — the
corpus-wide generalization of the ad-hoc existence check `scripts/apply_judgment.py` already does by
hand. It also **ports** the IRI_Linter's readable-CCO-label diagnostic (better than Gate B's generic
"unresolved") and adds **D7 IRI-scheme conformance** (it flags the 39 capabilities-wearing-process-IRIs
the corpus index just surfaced).

It is the missing third leg of IRI integrity:

| Failure mode | Caught by |
|---|---|
| `cco:`/`obo:` IRI not in the closure (typo, readable form) | **Gate B** (existence) + this tool (readable-label *diagnostic*) |
| `ex:`/`perf:` reference to an undeclared class (dangling ref) | **this tool** — nothing else |
| `ex:P<pcfID>` IRI on a class that is actually a capability (`⊑568`) | **this tool** (scheme) |

This spec is a **build-loop test target** in the same spirit as `FNSR-IRI-Linter-Spec-R1.2.md`:
deliberately bounded — **three modules**, with **one real cross-module dependency** (`resolve` ←
`collect`) and **one required edit** (module 3 edits `resolve`) — so the run exercises `inputs_from`,
snapshot-forward, and edit-tolerant `before_match` on a real model, while the tool itself is low-stakes
(reads local files only; no network), safe under an `accept_unenforced` grant.

The key words **MUST**, **SHALL**, **MUST NOT**, **SHOULD**, **MAY** are per RFC 2119.

**Deliberate departure from R1.2.** The IRI_Linter is lexical-only, single-file, and browser-runnable
(R1.2 §1.3, §9.1). This tool operates over the **merged set** of corpus modules and **MAY** use an RDF
parser, because cross-module declaration resolution is **unsound lexically** — the corpus declares
classes both inline (`ex:X a owl:Class ;`) and across lines (`ex:X\n    a owl:Class`), and references
live inside blank-node `owl:Restriction` fillers. This tool runs as a CI/pipeline gate (**Gate F** in
`validate.py`, and in `corpus_check.sh`), not a browser authoring lint. Its reference implementation is
**Python + `rdflib`** (already a project dependency); a JS + `N3.js` implementation is acceptable if the
build loop prefers JS, provided it meets the language-neutral acceptance criteria in §7.

---

## Definitions

- **Local namespace** — the project-minted namespaces whose referential integrity Gates A–D do **not**
  guard: `ex:` (`http://example.org/apqc#`) and `perf:` (`http://example.org/apqc/perf#`).
- **Declared IRI** — a local-namespace IRI that is the subject of a *defining* triple: `rdf:type` of
  `owl:Class`, `owl:NamedIndividual`, `owl:ObjectProperty`, `owl:AnnotationProperty`,
  `owl:DatatypeProperty`, or `rdf:Property`.
- **Referenced IRI** — a local-namespace IRI appearing in **any** subject / predicate / object position,
  **including** inside blank-node `owl:Restriction` fillers and as the value of an annotation property
  (`ex:designatesProcessType`, `ex:enablesProcess`, `perf:definedByApqcElement`, …).
- **Dangling reference** — a referenced local IRI that is **not** a declared IRI anywhere in the supplied
  module set.
- **Opaque CCO form** / **readable label** — exactly as R1.2: opaque = a CCO local name matching
  `^ont\d+$` (case-sensitive); any other `cco:` local name is a readable label.
- **Process IRI** — a declared `ex:` class bearing `ex:pcfID` whose local name matches `^P\d+$`.
- **Module set** — the ordered list of TTL files that, merged, constitute the corpus closure within
  which references must resolve (the 13 slices + `apqc-ext` + `apqc-catalog` + the capability/role layer
  + the performance layer).

---

## §1 Scope & invariants

- **FR-1 (§1.1)** The linter **SHALL** run fully offline; it **MUST NOT** perform any network access.
- **FR-2 (§1.2)** The core logic (collection, resolution, labelling) **MUST** accept **in-memory values**
  — module contents (text or parsed graphs) and the register as a parsed object — and **MUST NOT** accept
  file paths; only the CLI wrapper touches the filesystem. The core **MUST** export this minimal stable
  contract:
  - `collect(modules) -> { declared: Set<iri>, references: Reference[] }`, where each `module` is
    `{ name, text }` and a `Reference` is `{ iri, module, line, position: "subject"|"predicate"|"object"|"restriction" }`;
  - `resolve(collected, register?) -> Issue[]`, where an `Issue` is
    `{ type: "dangling_ref"|"readable_label"|"scheme_violation", iri, module, line, suggestion?, rule? }`.
- **FR-3 (§1.3)** The linter **MAY** depend on an RDF parser for `collect` (the deliberate departure
  above). If implemented lexically instead, declaration recognition **MUST** handle multi-line
  `subject … a owl:Class` and reference collection **MUST** reach IRIs inside `owl:Restriction` fillers;
  a line-oriented scanner that misses either is non-conforming (it would emit spurious `dangling_ref`s).

## §2 Inputs

- **FR-4 (§2.1)** The CLI **SHALL** accept the module set and an optional register:
  `iri_ref_lint --modules <glob-or-paths…> [--register <register.json>]`. The merged module set defines
  the resolution closure; a reference resolves iff it is declared in **some** module in the set.
- **FR-5 (§2.2)** When supplied, the register **MUST** conform to R1.2 FR-5/FR-5a (a JSON array of
  `{iri, alias, label}` with opaque CCO IRIs, unique locals, unambiguous normalized aliases); a malformed
  register is a **systemic** error (exit `2`). The register is **OPTIONAL**: absent, `readable_label`
  suggestions are omitted, but `dangling_ref` (§4) and `scheme_violation` (§5) checks **MUST** still run.

## §3 Collection — module `collect`

- **FR-6 (§3.1)** `collect` **SHALL** produce, over **all** supplied modules, (a) the **declared** set —
  every local-namespace IRI that is the subject of a defining-type triple (per Definitions) — and (b) the
  **references** list — every local-namespace IRI in any position — each reference recording its `iri`,
  `module`, `line`, and `position`.
- **FR-6a (§3.1.1)** Declaration recognition **MUST** include all six defining types (`owl:Class`,
  `owl:NamedIndividual`, `owl:ObjectProperty`, `owl:AnnotationProperty`, `owl:DatatypeProperty`,
  `rdf:Property`). A local IRI used only as an object/filler and never typed is **not** declared.
- **FR-6b (§3.1.2)** Reference collection **MUST** include IRIs that appear (i) inside blank-node
  `owl:Restriction` objects (`owl:onProperty`, `owl:someValuesFrom`, `owl:onClass`, …), and (ii) as the
  **object of an annotation property** (e.g. `ex:designatesProcessType`, `ex:enablesProcess`,
  `perf:definedByApqcElement`). These are exactly where dangling references hide.
- **FR-7 (§3.2)** Comment text (after `#`) and `@prefix`/`@base` directives **MUST NOT** contribute
  declarations or references; CCO/`ex:`-looking text inside string literals **MUST NOT** contribute
  references (R1.2 FR-8 semantics).

## §4 Resolution — module `resolve` (depends on `collect`)

- **FR-8 (§4.1)** `resolve` **SHALL** flag every referenced local IRI that is **not** in the declared set
  as issue type `dangling_ref`, emitting one issue per **referencing site** (`module`, `line`) so each is
  individually actionable.
- **FR-9 (§4.2)** A referenced IRI that **is** declared in **any** module of the set **MUST NOT** be
  flagged. This is the cross-module guarantee: a wiring-overlay reference to `ex:P19945` resolves because
  slice 1 declares it; a `perf:definedByApqcElement` to `ex:PCF_19238` resolves because the catalog
  declares it.
- **FR-10 (§4.3)** Declared local properties (the predicates themselves) and any IRI declared in the set
  **MUST NOT** be flagged. No bespoke allowlist beyond "declared somewhere in the set" is permitted —
  declaration is the sole resolution criterion (keeps the rule falsifiable).

## §5 Ported readable-label + scheme conformance — module `flag_extra` (edits `resolve`)

- **FR-11 (§5.1) — readable CCO label (ported from IRI_Linter).** `flag_extra` **SHALL** flag any
  `cco:<local>` reference whose local name is not the opaque form as `readable_label`, and — when the
  register holds a matching normalized alias (R1.2 FR-13) — **MUST** append the suggested opaque IRI
  (`cco:has_output -> cco:ont00001986`). CCO/OBO **existence** remains Gate B's responsibility; this is a
  superior *diagnostic*, not a replacement (the two compose).
- **FR-12 (§5.2) — D7 scheme conformance.** `flag_extra` **MUST** flag as `scheme_violation`, with a
  `rule` field:
  - **`capability-as-process`** — a declared `ex:` **Process IRI** (`^P\d+$` + `ex:pcfID`) that is also
    `rdfs:subClassOf cco:ont00000568` (Organization Capability): a capability wearing a process IRI (the
    39 cases the index found);
  - **`pcf-without-P-iri`** — a declared `ex:` class that bears `ex:pcfID` but whose local name is **not**
    `P<pcfID>` and which is **not** a capability/supporting class (the inverse D7 slip
    `scripts/normalize_iris.py` repairs).
- **FR-13 (§5.3)** The label/scheme rules **MUST** be added by **editing** `resolve` and the report
  formatting — not replacing them. The `dangling_ref` detection (FR-8/FR-9) **MUST** continue to pass
  after this edit (regression).

## §6 Report & exit

- **FR-14 (§6.1)** The CLI **SHALL** print one stable line per violation:
  `<module>:<line> <ISSUE_TYPE> <iri>`, followed by ` -> <suggested-opaque-iri>` for a `readable_label`
  with a known alias, and by ` (<rule>)` for a `scheme_violation`. Exactly one violation per line
  (machine-checkable). Example lines:
  - `ontology/capabilities_wiring.ttl:54 dangling_ref ex:NoSuchCapability`
  - `ontology/apqc-performance.ttl:88 readable_label cco:has_output -> cco:ont00001986`
  - `ontology/slices/apqc_9_0.ttl:412 scheme_violation ex:P10734 (capability-as-process)`
- **FR-15 (§6.2)** The process **MUST** exit `0` when no violations are found, `1` when one or more are
  found, and `2` for a systemic error (a module path missing/unreadable, or a malformed register). `1`
  and `2` are distinct so CI separates lint failures from operational failures.

## §7 Test & acceptance

- **FR-16 (§7.1)** A dependency-light test command **SHALL** run all assertions and exit non-zero on any
  failure. Assertions grow per shipped module.
- **FR-17 (§7.2) — dirty fixture.** Given a two-file fixture set — a *context* module declaring
  `ex:RealCapability a owl:Class` and a *subject* module containing the items below — the linter **MUST**
  report exactly these and exit `1`:
  - `ex:RealCapability` referenced (e.g. as a `requiresCapability` object) → **not** flagged (declared in
    context);
  - `ex:NoSuchCapability` as a `requiresCapability` object → `dangling_ref` at its line;
  - `[ owl:onProperty cco:ont00001777 ; owl:someValuesFrom ex:NoSuchProcess ]` → `dangling_ref ex:NoSuchProcess`;
  - `cco:has_output` (register alias known) → `readable_label -> cco:ont00001986`;
  - a declared `ex:P10734 … ex:pcfID "10734" ; rdfs:subClassOf cco:ont00000568` → `scheme_violation … (capability-as-process)`;
  - a `#`-comment line and an `@prefix` line containing `ex:`/`cco:` text → **not** counted.
- **FR-18 (§7.3) — clean / corpus baseline.** Run over the **live merged corpus** (the current module
  set), the linter **MUST** report **zero `dangling_ref`** (referential integrity holds — the overlays'
  `ex:P…`/capability/role references all resolve) and **zero `readable_label`** (proven by the bake-off).
  `scheme_violation` over the live corpus **MUST** equal the known baseline of **39**
  (`capability-as-process`); the test asserts that exact count so a regression (a new mis-IRI'd class, or
  a silent fix) is visible. Exit `1` while the 39 stand (they are real findings); exit `0` once they are
  resolved or explicitly waived.

## §8 Delivery plan (structural backbone)

Build in three modules in dependency order; the harness + fixtures ship with module 2 so modules 2 and 3
each gate green.

- **Module 1 — `collect`** — creates the collection core. No project dependency beyond the chosen RDF
  parser. Covers FR-1, FR-2, FR-3, FR-6, FR-6a, FR-6b, FR-7.
- **Module 2 — `resolve` + CLI** — creates the resolver (imports `collect`) and the CLI entry (I/O,
  report, exit codes), plus the test harness, the FR-17 two-file dirty fixture, and the FR-18 corpus
  baseline test. **Depends on Module 1.** Covers FR-4, FR-5, FR-8, FR-9, FR-10, FR-14, FR-15, FR-16, FR-18.
- **Module 3 — `flag_extra`** — **edits** `resolve` + the report to add `readable_label` (ported) and
  `scheme_violation`; extends the fixtures with those cases and the FR-17 assertions. **Depends on Module
  2 and edits its files.** Covers FR-11, FR-12, FR-13, FR-17.

**Integration (post-build, thin wrapper, not a module):** wire the CLI into `src/apqc_transform/validate.py`
as **Gate F** (referential integrity), run after Gate B, over the merged module set; and add it to
`scripts/corpus_check.sh`. Regenerate `ontology/index/corpus_index.tsv` is **not** its job (that is
`build_index.py`); this gate only reports.

## §9 NOT in scope (defer explicitly)

- **§9.1** SHACL or ELK reasoning — those are Gates C/D/E; this tool is referential + scheme only.
- **§9.2** Autofix / rewriting the TTL — report only. (D7 scheme *repair* is `normalize_iris.py`'s job;
  this tool only *flags* scheme violations, including the ones the normalizer does not repair.)
- **§9.3** `cco:`/`obo:` **existence** — Gate B owns it; this tool adds only the readable-CCO-label
  *diagnostic* (FR-11) and otherwise treats `cco:`/`obo:` IRIs as opaque, unchecked for existence.
- **§9.4** Network fetch of any ontology — the module set + optional register are the offline sources.
- **§9.5** ABox / instance graphs (the performance-layer deployment data, D18) — this gate validates the
  TBox corpus modules; instance referential integrity is the deployment's SHACL.
- **§9.6** Non-`ex:`/`perf:` minted namespaces and alternate prefixes — R1.0 fixes the two project
  namespaces and the literal `cco:` prefix; `@prefix` resolution of arbitrary prefixes is out of scope.
- **§9.7** Multi-line triple-quoted literals and escaped-quote edge cases **if** implemented lexically
  (as R1.2 §9.6, §9.8); the reference RDF-parser implementation is immune to these, and fixtures avoid
  them either way.
