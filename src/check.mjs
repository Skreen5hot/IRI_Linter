import { extract } from './extract.mjs';

const OPAQUE = /^ont\d+$/;
const CCO_BASE = 'https://www.commoncoreontologies.org/';

export function check(ttlText, register) {
  const reg = typeof register === 'string' ? JSON.parse(register) : register;
  const verifiedLocals = new Set(
    reg.map(e => e.iri.split('/').pop()).filter(local => OPAQUE.test(local))
  );
  const aliasMap = new Map();
  for (const e of reg) {
    const norm = e.alias.replace(/[_-]/g, ' ').toLowerCase();
    aliasMap.set(norm, e.iri);
  }
  const issues = [];
  for (const ref of extract(ttlText)) {
    if (!OPAQUE.test(ref.local)) {
      const norm = ref.local.replace(/[_-]/g, ' ').toLowerCase();
      const matchedIri = aliasMap.get(norm);
      const issue = { type: 'readable_label', lexeme: ref.lexeme, local: ref.local, line: ref.line };
      if (matchedIri) {
        issue.suggestion = `cco:${matchedIri.slice(CCO_BASE.length)}`;
      }
      issues.push(issue);
    } else if (!verifiedLocals.has(ref.local)) {
      issues.push({ type: 'unverified', lexeme: ref.lexeme, local: ref.local, line: ref.line });
    }
  }
  return issues;
}
