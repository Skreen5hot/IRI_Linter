// Spec coverage: FR-12, FR-13, FR-14, FR-18
// FR-12: IMPLEMENTED  FR-13: IMPLEMENTED  FR-14: IMPLEMENTED  FR-18: IMPLEMENTED
import { assert } from './_assert.mjs';
import { check } from '../src/check.mjs';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CCO = 'https://www.commoncoreontologies.org/';

const sampleReg = [
  { iri: `${CCO}ont00000042`, alias: 'process', label: 'Process' },
  { iri: `${CCO}ont00001986`, alias: 'has output', label: 'Has Output' },
];

// FR-12: non-opaque local name flagged as readable_label
{
  const issues = check('ex:s cco:has_output ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-12: readable_label issue raised for cco:has_output');
  assert(issues[0].type === 'readable_label', 'FR-12: type=readable_label');
  assert(issues[0].lexeme === 'cco:has_output', 'FR-12: lexeme preserved exactly');
  assert(issues[0].local === 'has_output', 'FR-12: local preserved');
}

// FR-12: cco:ONT001 fails ^ont\d+$ case-sensitive check -> readable_label
{
  const issues = check('ex:s cco:ONT001 ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-12: cco:ONT001 flagged as readable_label');
  assert(issues[0].type === 'readable_label', 'FR-12: ONT001 type=readable_label');
}

// FR-12: cco:Plan (simple readable name) flagged
{
  const issues = check('ex:s cco:Plan ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-12: cco:Plan flagged as readable_label');
  assert(issues[0].type === 'readable_label', 'FR-12: Plan type=readable_label');
}

// FR-13: cco:has_output matches alias 'has output' via underscore normalization
{
  const issues = check('ex:s cco:has_output ex:o .', sampleReg);
  assert(issues[0].suggestion === 'cco:ont00001986', 'FR-13: has_output suggestion correct');
}

// FR-13: cco:Has_Output (mixed case + underscore) matches same alias
{
  const issues = check('ex:s cco:Has_Output ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-13: Has_Output flagged');
  assert(issues[0].suggestion === 'cco:ont00001986', 'FR-13: Has_Output suggestion (case-insensitive)');
}

// FR-13: cco:has-output (hyphen) matches alias 'has output' via hyphen normalization
{
  const issues = check('ex:s cco:has-output ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-13: has-output flagged');
  assert(issues[0].suggestion === 'cco:ont00001986', 'FR-13: has-output suggestion (hyphen normalized)');
}

// FR-13: cco:ONT001 does not match any alias -> no suggestion
{
  const issues = check('ex:s cco:ONT001 ex:o .', sampleReg);
  assert(!issues[0].suggestion, 'FR-13: ONT001 has no suggestion');
}

// FR-14: unverified opaque detection preserved after edit (regression FR-10)
{
  const issues = check('ex:s cco:ont99999999 ex:o .', sampleReg);
  assert(issues.length === 1, 'FR-14: unverified still detected (regression)');
  assert(issues[0].type === 'unverified', 'FR-14: type=unverified preserved');
  assert(issues[0].lexeme === 'cco:ont99999999', 'FR-14: unverified lexeme correct');
}

// FR-14: verified ref still not flagged after edit (regression FR-11)
{
  const issues = check('ex:s cco:ont00001986 ex:o .', sampleReg);
  assert(issues.length === 0, 'FR-14: verified ref not flagged (regression)');
}

// FR-14: readable_label and unverified coexist correctly
{
  const issues = check('ex:s cco:has_output cco:ont99999999 .', sampleReg);
  assert(issues.length === 2, 'FR-14: both types coexist');
  assert(issues.some(i => i.type === 'readable_label'), 'FR-14: readable_label present');
  assert(issues.some(i => i.type === 'unverified'), 'FR-14: unverified present');
}

// FR-18: dirty.ttl check produces exactly 4 violations
{
  const dirtyTtl = readFileSync(join(__dirname, 'fixtures/dirty.ttl'), 'utf8');
  const register = JSON.parse(readFileSync(join(__dirname, 'fixtures/register.json'), 'utf8'));
  const issues = check(dirtyTtl, register);
  assert(issues.length === 4, 'FR-18: dirty.ttl exactly 4 violations');
  const unverified = issues.filter(i => i.type === 'unverified');
  assert(unverified.length === 2, 'FR-18: 2 unverified (prefixed + full-IRI)');
  assert(unverified.some(i => i.lexeme === 'cco:ont99999999'), 'FR-18: prefixed unverified present');
  assert(unverified.some(i => i.lexeme === '<https://www.commoncoreontologies.org/ont99999999>'), 'FR-18: full-IRI unverified present');
  const readable = issues.filter(i => i.type === 'readable_label');
  assert(readable.length === 2, 'FR-18: 2 readable_label');
  const hasOut = readable.find(i => i.lexeme === 'cco:has_output');
  assert(hasOut !== undefined, 'FR-18: has_output readable_label found');
  assert(hasOut && hasOut.suggestion === 'cco:ont00001986', 'FR-18: has_output suggestion cco:ont00001986');
  const ont001 = readable.find(i => i.lexeme === 'cco:ONT001');
  assert(ont001 !== undefined, 'FR-18: ONT001 readable_label found');
  assert(ont001 && !ont001.suggestion, 'FR-18: ONT001 no suggestion');
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
  assert(out.includes('readable_label'), 'FR-18: output contains readable_label');
  assert(out.includes('cco:has_output'), 'FR-18: output contains cco:has_output');
  assert(out.includes('-> cco:ont00001986'), 'FR-18: output includes suggestion');
  assert(out.includes('cco:ONT001'), 'FR-18: output contains cco:ONT001');
}
