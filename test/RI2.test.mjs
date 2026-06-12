// RI2 test suite — covers FR-4, FR-5, FR-8, FR-9, FR-10, FR-14, FR-15, FR-16
import { assert } from './_assert.mjs';
import { collect } from '../src/ri-collect.mjs';
import { resolve } from '../src/ri-resolve.mjs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const CLI = join(__dirname, '..', 'src', 'ri-cli.mjs');
const EX = 'http://example.org/apqc#';

const contextMod = {
  name: 'ri-context.ttl',
  text: readFileSync(join(FIXTURES, 'ri-context.ttl'), 'utf8'),
};
const subjectMod = {
  name: 'ri-subject.ttl',
  text: readFileSync(join(FIXTURES, 'ri-subject.ttl'), 'utf8'),
};

const collected = collect([contextMod, subjectMod]);
const issues = resolve(collected);

// ---------------------------------------------------------------------------
// FR-9, FR-10: declared IRI from cross-module context MUST NOT be flagged
// ---------------------------------------------------------------------------
{
  // FR-9: ex:RealCapability declared in ri-context.ttl; referenced in ri-subject.ttl
  assert(
    collected.declared.has(EX + 'RealCapability'),
    'FR-9: ex:RealCapability is in the merged declared set'
  );
  const rc = issues.filter(i => i.iri === EX + 'RealCapability');
  assert(rc.length === 0, 'FR-9/FR-10: ex:RealCapability (declared in context) NOT flagged');
}

// ---------------------------------------------------------------------------
// FR-8: dangling_ref for undeclared local IRI per referencing site
// ---------------------------------------------------------------------------
{
  const nsc = issues.filter(i => i.iri === EX + 'NoSuchCapability' && i.type === 'dangling_ref');
  assert(nsc.length > 0, 'FR-8: ex:NoSuchCapability (undeclared) flagged as dangling_ref');
  assert(
    nsc.every(i => i.module === 'ri-subject.ttl'),
    'FR-8: dangling_ref for ex:NoSuchCapability carries module ri-subject.ttl'
  );
  assert(
    nsc.every(i => typeof i.line === 'number' && i.line >= 1),
    'FR-8: dangling_ref for ex:NoSuchCapability has a positive integer line'
  );
}

// ---------------------------------------------------------------------------
// FR-8: dangling_ref for IRI inside blank-node owl:Restriction filler
// ---------------------------------------------------------------------------
{
  const nsp = issues.filter(i => i.iri === EX + 'NoSuchProcess' && i.type === 'dangling_ref');
  assert(nsp.length > 0, 'FR-8: ex:NoSuchProcess (in owl:Restriction filler) flagged as dangling_ref');
}

// ---------------------------------------------------------------------------
// FR-10: no declared IRI is ever flagged as dangling_ref
// ---------------------------------------------------------------------------
{
  const flaggedDeclared = issues.filter(
    i => collected.declared.has(i.iri) && i.type === 'dangling_ref'
  );
  assert(flaggedDeclared.length === 0, 'FR-10: no declared IRI is flagged as dangling_ref');
}

// ---------------------------------------------------------------------------
// FR-14, FR-15: CLI prints stable lines and exits 1 on violations
// ---------------------------------------------------------------------------
{
  const ctxPath = join(FIXTURES, 'ri-context.ttl');
  const subPath = join(FIXTURES, 'ri-subject.ttl');
  let exitCode = -1;
  let stdout = '';
  try {
    stdout = execSync(`node "${CLI}" --modules "${ctxPath}" "${subPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
    stdout = e.stdout || '';
  }
  assert(exitCode === 1, `FR-15: CLI exits 1 on violations (got ${exitCode})`);
  const lines = stdout.trim().split('\n').filter(Boolean);
  assert(lines.length > 0, 'FR-14: CLI prints at least one violation line');
  assert(
    lines.some(l => /^.+:\d+ dangling_ref .+/.test(l)),
    'FR-14: at least one line matches format <module>:<line> dangling_ref <iri>'
  );
}

// ---------------------------------------------------------------------------
// FR-15: CLI exits 0 when no violations
// ---------------------------------------------------------------------------
{
  const ctxPath = join(FIXTURES, 'ri-context.ttl');
  let exitCode = -1;
  try {
    execSync(`node "${CLI}" --modules "${ctxPath}"`, { encoding: 'utf8', stdio: 'pipe' });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
  }
  assert(exitCode === 0, `FR-15: CLI exits 0 with no violations (got ${exitCode})`);
}

// ---------------------------------------------------------------------------
// FR-4, FR-15: no --modules argument exits 2
// ---------------------------------------------------------------------------
{
  let exitCode = -1;
  try {
    execSync(`node "${CLI}"`, { encoding: 'utf8', stdio: 'pipe' });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
  }
  assert(exitCode === 2, `FR-4: no --modules exits 2 (got ${exitCode})`);
}

// ---------------------------------------------------------------------------
// FR-4, FR-15: unreadable module path exits 2
// ---------------------------------------------------------------------------
{
  let exitCode = -1;
  try {
    execSync(`node "${CLI}" --modules "/no-such-file-ri2test.ttl"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
  }
  assert(exitCode === 2, `FR-4/FR-15: unreadable module exits 2 (got ${exitCode})`);
}

// ---------------------------------------------------------------------------
// FR-5, FR-15: missing register file exits 2
// ---------------------------------------------------------------------------
{
  const ctxPath = join(FIXTURES, 'ri-context.ttl');
  let exitCode = -1;
  try {
    execSync(
      `node "${CLI}" --modules "${ctxPath}" --register "/no-such-register-ri2.json"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
  }
  assert(exitCode === 2, `FR-5/FR-15: missing register exits 2 (got ${exitCode})`);
}

// ---------------------------------------------------------------------------
// FR-5: valid register is accepted (no exit 2)
// ---------------------------------------------------------------------------
{
  const ctxPath = join(FIXTURES, 'ri-context.ttl');
  const regPath = join(FIXTURES, 'ri-register.json');
  let exitCode = -1;
  try {
    execSync(`node "${CLI}" --modules "${ctxPath}" --register "${regPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status != null ? e.status : -1;
  }
  assert(exitCode !== 2, `FR-5: valid register does not exit 2 (got ${exitCode})`);
}

// FR-16: this file is the dependency-light RI2 test suite; test/run.mjs auto-discovers it
