# FNSR IRI Linter — Spec R1.2

A small, offline CLI that enforces **verify-before-assert** on CCO IRIs in your TTL modules:
every `cco:` term must be a verified opaque IRI present in the register, and readable-label
forms (`cco:has_output`) are flagged with the correct opaque IRI suggested. It would have caught
the two real bugs this discipline already surfaced by hand (the `cco:has_output` spec slip; an
unverified anchor).

This spec is the build-loop's live test target. It is deliberately bounded: **three modules**,
with one real cross-module dependency and one required edit, so the run exercises `inputs_from`,
snapshot-forward, and edit-tolerant `before_match` on a real model — while the tool itself is
low-stakes (reads local files only; no network), which makes it safe to run under an
`accept_unenforced` grant.

The key words **MUST**, **SHALL**, **MUST NOT** are per RFC 2119.

**R1.1 (from R1):** precision-only edits — opaque-form regex, register `label` role and case rule, core string-signatures, distinct systemic exit code, machine-checkable output line, and an explicit lexical-scanner constraints block (§9.6–§9.9). No new tool capability; the model's task is unchanged in difficulty. Coverage ids are partitioned across the three modules (§8).

**R1.2 (from R1.1, SME hardening):** precision-and-falsifiability edits — local-name token grammar (FR-6a), full-IRI boundaries (FR-6b), register schema validation as a systemic error (FR-5a), report-lexeme semantics (FR-15a), the core module API + data shapes (FR-2), the FR-8/§9.9 reconciliation, the "verified = in the register, not upstream CCO" clarification (FR-9), and expanded *in-scope* fixtures (FR-18/FR-19). No out-of-scope capability added; §9.6–§9.9 adversarial cases remain excluded from fixtures.

**Definitions.** *Opaque IRI form* = a CCO local name matching the regex `^ont\d+$` (case-sensitive; `cco:ONT001`, `cco:Ont001` do **not** match). A CCO reference whose local name does not match the opaque form is a *readable label*.

---

## §1 Scope & invariants

- **FR-1 (§1.1)** The linter **SHALL** run fully offline; it **MUST NOT** perform any network access.
- **FR-2 (§1.2)** The core logic (extraction, checking, labelling) **MUST** be dependency-free and runnable both as `node index.mjs …` and when imported as an ES module in a browser tab; node-only APIs (`fs`, `process`) are confined to the CLI wrapper, never the core. The core functions **MUST** accept input as in-memory values — TTL text as a string, the register as a parsed object or JSON string — and **MUST NOT** accept file paths; only the CLI wrapper touches the filesystem. The core **MUST** export this minimal stable contract:
  - `extract(ttlText) -> Reference[]`, where a `Reference` is `{ kind: "prefixed"|"full", lexeme, local, line }`;
  - `check(ttlText, register) -> Issue[]`, where an `Issue` is `{ type: "unverified"|"readable_label", lexeme, local, line, suggestion? }`.
- **FR-3 (§1.3)** The linter **MUST NOT** depend on a full RDF/Turtle parser. It performs **lexical** extraction of CCO references. (Rationale: keeps it browser-runnable and dependency-free; a full parser is out of scope, §9.1.)

## §2 Inputs

- **FR-4 (§2.1)** The CLI **SHALL** accept a target TTL file path and a verified-term register path: `node index.mjs --ttl <file> --register <file>`.
- **FR-5 (§2.2)** The register **MUST** be JSON: an array of entries, each with `iri` (opaque CCO IRI whose local name matches the opaque form), `alias` (the human-readable name used for label-matching per FR-13), and `label` (display-only: the name shown in report messages; it has **no** matching role). Example entry: `{ "iri": "https://www.commoncoreontologies.org/ont00001986", "alias": "has output", "label": "has output" }`.
- **FR-5a (§2.3)** Register validation (systemic). The CLI **MUST** exit `2` if the register is valid JSON but not an array of entries with string `iri`, `alias`, and `label`; if any `iri` is not under `https://www.commoncoreontologies.org/`; if any `iri`'s local name does not match the opaque form (§1); if two entries share the same opaque local name; or if two entries whose aliases normalize identically (FR-13) point to different opaque IRIs (which would make a suggestion ambiguous). A register-schema failure is a systemic error (exit `2`), distinct from a lint violation (exit `1`).

## §3 Extraction — module `extract`

- **FR-6 (§3.1)** `extract` **SHALL** collect every CCO reference in the TTL in both forms: prefixed `cco:<localname>` and full-IRI `<https://www.commoncoreontologies.org/<localname>>`.
- **FR-6a (§3.1.1)** Prefixed token boundary. A prefixed reference's local name begins immediately after the literal `cco:` and consists of characters in `[A-Za-z0-9_-]`, ending at the first character outside that set (whitespace, `;`, `,`, `.`, `]`, `)`, `>`, `"`, etc.). A `cco:` with an empty local name (including the `@prefix cco:` declaration) is **not** a reference and **MUST** be ignored.
- **FR-6b (§3.1.2)** Full-IRI boundary. For a full IRI `<https://www.commoncoreontologies.org/{local}>`, the local name is the final path segment — the substring after the last `/` and before `>`. R1 does not support alternate CCO base IRIs, query strings, or fragment (`#`) identifiers (§9.7).
- **FR-7 (§3.2)** Each collected reference **MUST** record its `kind`, source `lexeme`, `local` name, and the 1-based `line` number where it appears.
- **FR-8 (§3.3)** For R1-conforming input — where `#` does not occur inside a string literal (§9.9) — `extract` **MUST** ignore text after a `#` (line comment) and **MUST** ignore CCO-looking text inside simple single-line quoted literals. The scanner is line-oriented; multi-line and adversarial literals are bounded out in §9.6–§9.9, and R1 fixtures respect those bounds.

## §4 Verification check — module `check` (depends on `extract`)

- **FR-9 (§4.1)** `check` **SHALL** load the register and build the set of verified opaque local names (those matching the opaque form, §1). "Verified" means **present in the supplied register**, not merely present in upstream CCO; a valid CCO term absent from the project register is intentionally flagged `unverified`.
- **FR-10 (§4.2)** `check` **MUST** flag any extracted reference whose local name matches the opaque form (§1) but is **not** present in the register, as issue type `unverified`.
- **FR-11 (§4.3)** A reference whose local name is a verified register entry **MUST NOT** be flagged.

## §5 Readable-label detection — module `flag_labels` (edits `check`)

- **FR-12 (§5.1)** `flag_labels` **SHALL** flag any CCO reference whose local name is **not** of the opaque form (§1) — e.g. `cco:has_output`, `cco:Plan`, and non-canonical casings like `cco:ONT001` — as issue type `readable_label`.
- **FR-13 (§5.2)** For a `readable_label` whose name — with `_`/`-` normalized to spaces and compared **case-insensitively** — matches a register `alias` (normalized the same way), the report **MUST** include the suggested opaque IRI from that entry. So `cco:has_output`, `cco:Has_Output`, and `cco:has-output` all match alias `"has output"` → `cco:ont00001986`.
- **FR-14 (§5.3)** The label rule **MUST** be added by **editing** the module-`check` logic and the report formatting — not by replacing them. The `unverified` detection (FR-10/FR-11) **MUST** continue to pass after this edit (regression).

## §6 Report & exit

- **FR-15 (§6.1)** The CLI **SHALL** print one line per violation in the form `<file>:<line> <ISSUE_TYPE> <lexeme>`, followed — for a `readable_label` with a known alias — by ` -> <suggested-opaque-iri>`. The format **MUST** be stable (exactly one violation per line) so the output is machine-checkable.
- **FR-15a (§6.1.1)** The third field is the **source lexeme exactly as found** (e.g. `cco:has_output`, `<https://www.commoncoreontologies.org/ont99999999>`), which for a `readable_label` is by definition not a valid IRI. Suggestions are emitted in compact `cco:ont<digits>` form. Example line: `test/fixtures/dirty.ttl:12 readable_label cco:has_output -> cco:ont00001986`.
- **FR-16 (§6.2)** The process **MUST** exit `0` when no violations are found, `1` when one or more violations are found, and `2` for a systemic error (target TTL missing or unreadable, or register missing or not valid JSON). `1` and `2` are distinct so CI can separate lint failures from operational failures.

## §7 Test & acceptance

- **FR-17 (§7.1)** A dependency-free test command **`node test/lint.test.mjs`** **SHALL** run all assertions shipped to date and exit non-zero on any failure. (This is the execution tier's `test_command`.) Assertions grow per shipped module.
- **FR-18 (§7.2)** On `test/fixtures/dirty.ttl`, which contains — alongside at least two valid verified references — the items below, the linter **MUST** report exactly these violations and exit `1`:
  - `cco:ont99999999` (prefixed, opaque, not in register) → `unverified`;
  - `<https://www.commoncoreontologies.org/ont99999999>` (full IRI, opaque, not in register) → `unverified`;
  - `cco:has_output` (readable label, alias known) → `readable_label`, suggestion `cco:ont00001986`;
  - `cco:ONT001` (uppercase — not opaque form) → `readable_label`, no suggestion (this case catches the `/^ont\d+$/i` mistake);
  - a `#`-comment line and an `@prefix cco:` declaration line, each containing CCO-looking text → **not** counted.
- **FR-19 (§7.3)** On `test/fixtures/clean.ttl` — containing only verified references in both prefixed and full-IRI form, plus a comment line and an `@prefix cco:` declaration that **MUST** be ignored — the linter **MUST** report zero violations and exit `0`.

## §8 Delivery plan (structural backbone)

Build in three modules in dependency order; the test harness and fixtures ship with module 2 so modules 2 and 3 each gate green.

- **Module 1 — `extract`** — creates `src/extract.mjs`. No dependencies. Covers FR-1, FR-2, FR-3, FR-6, FR-6a, FR-6b, FR-7, FR-8.
- **Module 2 — `check` + CLI** — creates `src/check.mjs` (imports `extract`) and `index.mjs` (CLI entry, report, exit code; the CLI wrapper owns all file I/O and passes string content to the core, FR-2), plus `test/lint.test.mjs` and the two fixtures. **Depends on Module 1.** Covers FR-4, FR-5, FR-5a, FR-9, FR-10, FR-11, FR-15, FR-15a, FR-16, FR-17, FR-19.
- **Module 3 — `flag_labels`** — **edits** `src/check.mjs` (add the readable-label rule) and `index.mjs` (report the new issue type + suggestion); extends the fixtures with the `readable_label` cases and adds the FR-18 assertions. **Depends on Module 2 and edits its files.** Covers FR-12, FR-13, FR-14, FR-18.

## §9 NOT in scope (defer explicitly)

- **§9.1** Full RDF/Turtle parsing or SHACL validation — the linter is lexical.
- **§9.2** Autofix / rewriting the TTL — report only.
- **§9.3** BFO/OBO or any non-CCO namespace — CCO only in R1.
- **§9.4** Network fetch of the live CCO ontology — the register is the offline source of truth.
- **§9.5** Multi-file or directory crawl — one TTL per invocation.
- **§9.6** Multi-line (triple-quoted `"""`/`'''`) string literals — the scanner is line-oriented and does not track literals across lines.
- **§9.7** `@prefix` resolution — the linter assumes the literal prefix token `cco:` and the full CCO IRI form; it does not parse `@prefix` declarations, alternate prefixes, or the empty/default prefix.
- **§9.8** Escaped quotes and other complex literal-boundary cases within a line — not handled; literals in fixtures are simple.
- **§9.9** `#` inside a string literal — not disambiguated; R1 fixtures do not place `#` inside literals, so the line-level comment rule (FR-8) is sufficient.

The R1 test fixtures (FR-18 / FR-19) **MUST** respect §9.6–§9.9 — no multi-line literals, only the `cco:` prefix, simple single-line literals, and no `#` inside literals — so the bounded scanner is correct on them and no spurious violation arises from an out-of-scope construct.
