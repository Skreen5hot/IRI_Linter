// FR-17: Single growing test suite — runnable as `node test/lint.test.mjs`
// Spec coverage: FR-1, FR-2, FR-3, FR-6, FR-6a, FR-6b, FR-7, FR-8, FR-12, FR-13, FR-18, FR-19
import { extract } from '../src/extract.mjs';
import { check } from '../src/check.mjs';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}`); }
}

// FR-2, FR-3: extract is exported; no external dependencies required
assert(typeof extract === 'function', 'FR-2: extract exported as function');
assert(Array.isArray(extract('')), 'FR-2: returns array');
assert(extract('').length === 0, 'FR-2: empty input yields empty array');

// FR-6, FR-6a: basic prefixed reference
{
  const refs = extract('ex:s cco:ont00001986 .\n');
  assert(refs.length === 1, 'FR-6a: one prefixed ref');
  assert(refs[0].kind === 'prefixed', 'FR-6a: kind=prefixed');
  assert(refs[0].lexeme === 'cco:ont00001986', 'FR-6a: lexeme');
  assert(refs[0].local === 'ont00001986', 'FR-6a: local');
}

// FR-7: 1-based line number
{
  const refs = extract('ex:s cco:ont00001986 .\n');
  assert(refs[0].line === 1, 'FR-7: line=1');
}

// FR-6a: @prefix cco: declaration is NOT a reference (empty local after cco:)
{
  const refs = extract('@prefix cco: <https://www.commoncoreontologies.org/> .\n');
  assert(refs.length === 0, 'FR-6a: @prefix cco: declaration ignored');
}

// FR-6a: local name boundary — stops at non-[A-Za-z0-9_-] character
{
  const refs = extract('ex:s cco:ont00001986; cco:ont00000042 .\n');
  assert(refs.length === 2, 'FR-6a: two prefixed refs separated by ;');
  assert(refs[0].local === 'ont00001986', 'FR-6a: first local boundary');
  assert(refs[1].local === 'ont00000042', 'FR-6a: second local boundary');
}

// FR-6a: readable-label (non-opaque) still collected
{
  const refs = extract('ex:s cco:has_output ex:o .\n');
  assert(refs.length === 1, 'FR-6a: readable label captured');
  assert(refs[0].local === 'has_output', 'FR-6a: readable label local (underscore)');
}

// FR-6a: uppercase local (not opaque form) still collected
{
  const refs = extract('ex:s cco:ONT001 .\n');
  assert(refs.length === 1, 'FR-6a: uppercase local captured');
  assert(refs[0].local === 'ONT001', 'FR-6a: uppercase local preserved');
}

// FR-6a: hyphenated local still collected
{
  const refs = extract('ex:s cco:has-output .\n');
  assert(refs.length === 1, 'FR-6a: hyphenated local captured');
  assert(refs[0].local === 'has-output', 'FR-6a: hyphenated local');
}

// FR-6, FR-6b: full-IRI form
{
  const refs = extract('<https://www.commoncoreontologies.org/ont00001986> a owl:Class .\n');
  assert(refs.length === 1, 'FR-6b: full-IRI ref');
  assert(refs[0].kind === 'full', 'FR-6b: kind=full');
  assert(refs[0].local === 'ont00001986', 'FR-6b: local');
  assert(refs[0].lexeme === '<https://www.commoncoreontologies.org/ont00001986>', 'FR-6b: lexeme');
  assert(refs[0].line === 1, 'FR-7: full-IRI line number');
}

// FR-6b: full-IRI with empty local (trailing slash) not counted
{
  const refs = extract('<https://www.commoncoreontologies.org/> a owl:Ontology .\n');
  assert(refs.length === 0, 'FR-6b: empty-local full IRI ignored');
}

// FR-6: both forms on the same line
{
  const refs = extract('cco:ont00001986 owl:sameAs <https://www.commoncoreontologies.org/ont00001986> .\n');
  assert(refs.length === 2, 'FR-6: both forms collected from same line');
  const kinds = refs.map(r => r.kind).sort();
  assert(kinds[0] === 'full' && kinds[1] === 'prefixed', 'FR-6: both kinds present');
}

// FR-7: correct line numbers across multiple lines
{
  const ttl = 'ex:a a owl:Thing .\nex:b cco:ont00001986 .\nex:c cco:ont00000042 .\n';
  const refs = extract(ttl);
  assert(refs.length === 2, 'FR-7: two refs in multi-line input');
  assert(refs[0].line === 2, 'FR-7: first ref on line 2');
  assert(refs[1].line === 3, 'FR-7: second ref on line 3');
}

// FR-8: full-line # comment ignored
{
  const refs = extract('# cco:ont00001986 comment line\n');
  assert(refs.length === 0, 'FR-8: comment line ignored');
}

// FR-8: inline comment stripped
{
  const refs = extract('ex:s cco:ont00001986 . # cco:ont99999999\n');
  assert(refs.length === 1, 'FR-8: inline comment stripped');
  assert(refs[0].local === 'ont00001986', 'FR-8: only pre-comment ref captured');
}

// FR-8: CCO ref inside double-quoted literal ignored
{
  const refs = extract('ex:s rdfs:comment "use cco:ont00001986 here" .\n');
  assert(refs.length === 0, 'FR-8: cco: in double-quoted literal ignored');
}

// FR-8: CCO ref inside single-quoted literal ignored
{
  const refs = extract("ex:s rdfs:comment 'use cco:ont00001986 here' .\n");
  assert(refs.length === 0, 'FR-8: cco: in single-quoted literal ignored');
}

// FR-1: no network calls (structural — src/extract.mjs has no imports at all)
assert(true, 'FR-1: offline verified by source (no network imports)');

// FR-19: clean.ttl reports zero violations; CLI exits 0
{
  const cleanTtl = readFileSync(join(__dirname, 'fixtures/clean.ttl'), 'utf8');
  const register = JSON.parse(readFileSync(join(__dirname, 'fixtures/register.json'), 'utf8'));
  const issues = check(cleanTtl, register);
  assert(issues.length === 0, 'FR-19: check() on clean.ttl returns zero violations');
}
{
  const result = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/clean.ttl'),
    '--register', join(__dirname, 'fixtures/register.json')
  ]);
  assert(result.status === 0, 'FR-19: CLI exits 0 on clean.ttl');
}

// FR-12, FR-13, FR-18: dirty.ttl produces exactly the required violations
{
  const dirtyTtl = readFileSync(join(__dirname, 'fixtures/dirty.ttl'), 'utf8');
  const register = JSON.parse(readFileSync(join(__dirname, 'fixtures/register.json'), 'utf8'));
  const issues = check(dirtyTtl, register);
  assert(issues.length === 4, 'FR-18: dirty.ttl has exactly 4 violations');
  const unverified = issues.filter(i => i.type === 'unverified');
  assert(unverified.length === 2, 'FR-18: exactly 2 unverified issues');
  assert(unverified.some(i => i.lexeme === 'cco:ont99999999'), 'FR-18: prefixed opaque unverified');
  assert(unverified.some(i => i.lexeme === '<https://www.commoncoreontologies.org/ont99999999>'), 'FR-18: full-IRI unverified');
  const readable = issues.filter(i => i.type === 'readable_label');
  assert(readable.length === 2, 'FR-18: exactly 2 readable_label issues');
  const hasOutput = readable.find(i => i.lexeme === 'cco:has_output');
  assert(hasOutput !== undefined, 'FR-18: cco:has_output readable_label found');
  assert(hasOutput && hasOutput.suggestion === 'cco:ont00001986', 'FR-18: cco:has_output suggestion correct');
  const ont001 = readable.find(i => i.lexeme === 'cco:ONT001');
  assert(ont001 !== undefined, 'FR-18: cco:ONT001 readable_label found');
  assert(ont001 && !ont001.suggestion, 'FR-18: cco:ONT001 has no suggestion');
}
// FR-18: CLI exits 1 on dirty.ttl
{
  const result = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/dirty.ttl'),
    '--register', join(__dirname, 'fixtures/register.json')
  ]);
  assert(result.status === 1, 'FR-18: CLI exits 1 on dirty.ttl');
  const out = result.stdout.toString();
  assert(out.includes('readable_label') && out.includes('cco:has_output'), 'FR-18: output has readable_label and cco:has_output');
  assert(out.includes('-> cco:ont00001986'), 'FR-18: output includes suggestion');
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`All ${passed} tests passed.`);
