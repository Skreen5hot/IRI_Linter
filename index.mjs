import { readFileSync } from 'fs';
import { check } from './src/check.mjs';

const args = process.argv.slice(2);
const ttlIdx = args.indexOf('--ttl');
const regIdx = args.indexOf('--register');
const ttlFile = ttlIdx !== -1 ? args[ttlIdx + 1] : undefined;
const regFile = regIdx !== -1 ? args[regIdx + 1] : undefined;

if (!ttlFile || !regFile) {
  console.error('Usage: node index.mjs --ttl <file> --register <file>');
  process.exit(2);
}

let ttlText;
try { ttlText = readFileSync(ttlFile, 'utf8'); }
catch { console.error(`Cannot read TTL: ${ttlFile}`); process.exit(2); }

let regText;
try { regText = readFileSync(regFile, 'utf8'); }
catch { console.error(`Cannot read register: ${regFile}`); process.exit(2); }

let register;
try { register = JSON.parse(regText); }
catch { console.error('Register is not valid JSON'); process.exit(2); }

const CCO_BASE = 'https://www.commoncoreontologies.org/';
const OPAQUE = /^ont\d+$/;

if (!Array.isArray(register)) {
  console.error('Register must be a JSON array'); process.exit(2);
}

const seenLocals = new Set();
const aliasMap = new Map();

for (const e of register) {
  if (typeof e.iri !== 'string' || typeof e.alias !== 'string' || typeof e.label !== 'string') {
    console.error('Register entries must have string iri, alias, label'); process.exit(2);
  }
  if (!e.iri.startsWith(CCO_BASE)) {
    console.error(`IRI not under CCO base: ${e.iri}`); process.exit(2);
  }
  const local = e.iri.slice(CCO_BASE.length);
  if (!OPAQUE.test(local)) {
    console.error(`IRI local name not opaque form: ${local}`); process.exit(2);
  }
  if (seenLocals.has(local)) {
    console.error(`Duplicate opaque local: ${local}`); process.exit(2);
  }
  seenLocals.add(local);
  const normAlias = e.alias.replace(/[_-]/g, ' ').toLowerCase();
  if (aliasMap.has(normAlias) && aliasMap.get(normAlias) !== e.iri) {
    console.error(`Ambiguous alias: ${normAlias}`); process.exit(2);
  }
  aliasMap.set(normAlias, e.iri);
}

const issues = check(ttlText, register);

for (const issue of issues) {
  let line = `${ttlFile}:${issue.line} ${issue.type} ${issue.lexeme}`;
  if (issue.suggestion) line += ` -> ${issue.suggestion}`;
  console.log(line);
}

process.exit(issues.length > 0 ? 1 : 0);
