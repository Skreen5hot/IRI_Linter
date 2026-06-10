// Spec coverage: FR-9, FR-10, FR-11, FR-4, FR-5, FR-5a, FR-15, FR-16, FR-19
// FR-9: IMPLEMENTED  FR-10: IMPLEMENTED  FR-11: IMPLEMENTED
// FR-4: IMPLEMENTED  FR-5: IMPLEMENTED   FR-5a: IMPLEMENTED
// FR-15: IMPLEMENTED FR-16: IMPLEMENTED  FR-19: IMPLEMENTED
import { assert } from './_assert.mjs';
import { check } from '../src/check.mjs';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CCO = 'https://www.commoncoreontologies.org/';

const sampleReg = [
  { iri: `${CCO}ont00000042`, alias: 'process', label: 'Process' },
  { iri: `${CCO}ont00001986`, alias: 'has output', label: 'Has Output' },
];

// FR-9, FR-11: in-register refs are not flagged
assert(check('ex:s cco:ont00000042 .', sampleReg).length === 0, 'FR-9/FR-11: prefixed verified not flagged');
assert(check(`<${CCO}ont00001986> a owl:Class .`, sampleReg).length === 0, 'FR-9/FR-11: full-IRI verified not flagged');

// FR-9: valid CCO opaque absent from register IS flagged
assert(check('ex:s cco:ont00000042 .', []).length === 1, 'FR-9: absent from register -> flagged');

// FR-10: opaque not in register -> unverified
{
  const issues = check('ex:s cco:ont99999999 .', sampleReg);
  assert(issues.length === 1, 'FR-10: one unverified issue');
  assert(issues[0].type === 'unverified', 'FR-10: type=unverified');
  assert(issues[0].lexeme === 'cco:ont99999999', 'FR-10: lexeme exact');
  assert(issues[0].local === 'ont99999999', 'FR-10: local');
  assert(issues[0].line === 1, 'FR-10: line number');
}

// FR-10: full-IRI opaque not in register -> unverified
{
  const issues = check(`<${CCO}ont99999999> a owl:Class .`, sampleReg);
  assert(issues.length === 1, 'FR-10: full-IRI unverified issue');
  assert(issues[0].type === 'unverified', 'FR-10: full-IRI type=unverified');
}

// FR-19: clean.ttl -> zero violations
{
  const cleanTtl = readFileSync(join(__dirname, 'fixtures/clean.ttl'), 'utf8');
  const reg = JSON.parse(readFileSync(join(__dirname, 'fixtures/register.json'), 'utf8'));
  assert(check(cleanTtl, reg).length === 0, 'FR-19: clean.ttl zero violations');
}

// FR-4, FR-16: CLI accepts --ttl/--register; exits 0 on clean
{
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/clean.ttl'),
    '--register', join(__dirname, 'fixtures/register.json')
  ]);
  assert(r.status === 0, 'FR-4/FR-16: CLI exits 0 on clean');
}

// FR-15, FR-16: CLI prints violation line and exits 1
{
  const tmp = join(__dirname, 'fixtures/_tmp_c.ttl');
  writeFileSync(tmp, 'ex:s cco:ont99999999 .\n', 'utf8');
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', tmp,
    '--register', join(__dirname, 'fixtures/register.json')
  ]);
  const out = r.stdout.toString();
  assert(r.status === 1, 'FR-16: exits 1 on violations');
  assert(out.includes('unverified') && out.includes('cco:ont99999999'), 'FR-15: output has TYPE and lexeme');
  unlinkSync(tmp);
}

// FR-16: missing TTL exits 2
{
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/no_such_file.ttl'),
    '--register', join(__dirname, 'fixtures/register.json')
  ]);
  assert(r.status === 2, 'FR-16: missing TTL exits 2');
}

// FR-5: non-JSON register exits 2
{
  const tmp = join(__dirname, 'fixtures/_tmp_badreg.json');
  writeFileSync(tmp, 'not json', 'utf8');
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/clean.ttl'),
    '--register', tmp
  ]);
  assert(r.status === 2, 'FR-5: non-JSON register exits 2');
  unlinkSync(tmp);
}

// FR-5a: IRI not under CCO base exits 2
{
  const tmp = join(__dirname, 'fixtures/_tmp_badreg2.json');
  writeFileSync(tmp, JSON.stringify([{ iri: 'https://example.com/ont00000001', alias: 'foo', label: 'Foo' }]), 'utf8');
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/clean.ttl'),
    '--register', tmp
  ]);
  assert(r.status === 2, 'FR-5a: non-CCO IRI exits 2');
  unlinkSync(tmp);
}

// FR-5a: duplicate opaque local exits 2
{
  const tmp = join(__dirname, 'fixtures/_tmp_badreg3.json');
  const dup = [
    { iri: `${CCO}ont00000001`, alias: 'foo', label: 'Foo' },
    { iri: `${CCO}ont00000001`, alias: 'bar', label: 'Bar' }
  ];
  writeFileSync(tmp, JSON.stringify(dup), 'utf8');
  const r = spawnSync(process.execPath, [
    join(__dirname, '../index.mjs'),
    '--ttl', join(__dirname, 'fixtures/clean.ttl'),
    '--register', tmp
  ]);
  assert(r.status === 2, 'FR-5a: duplicate local exits 2');
  unlinkSync(tmp);
}
