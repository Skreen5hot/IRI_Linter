// src/ri-resolve.mjs — RI3: resolver + readable_label diagnostic (ported from IRI_Linter)
export { collect } from './ri-collect.mjs';

const LOCAL_NS = [
  'http://example.org/apqc#',
  'http://example.org/apqc/perf#',
];

const CCO_NS = 'http://www.ontologyrepository.com/CommonCoreOntologies/';
const OPAQUE_RE = /^ont\d+$/;

function isLocal(iri) {
  return LOCAL_NS.some(ns => iri.startsWith(ns));
}

function normalizeForLookup(s) {
  return s.replace(/[_-]/g, ' ').toLowerCase();
}

function lookupSuggestion(local, register) {
  if (!register) return undefined;
  const norm = normalizeForLookup(local);
  const entry = register.find(
    e => normalizeForLookup(e.alias) === norm || normalizeForLookup(e.label) === norm
  );
  return entry ? entry.iri : undefined;
}

export function resolve(collected, register) {
  const { declared, references } = collected;
  const issues = [];
  const seenDangling = new Set();
  const seenLabel = new Set();

  for (const ref of references) {
    if (isLocal(ref.iri)) {
      if (!declared.has(ref.iri)) {
        const key = `${ref.iri}\0${ref.module}\0${ref.line}`;
        if (!seenDangling.has(key)) {
          seenDangling.add(key);
          issues.push({ type: 'dangling_ref', iri: ref.iri, module: ref.module, line: ref.line });
        }
      }
    } else if (ref.iri.startsWith(CCO_NS)) {
      const local = ref.iri.slice(CCO_NS.length);
      if (!OPAQUE_RE.test(local)) {
        const key = `${ref.iri}\0${ref.module}\0${ref.line}`;
        if (!seenLabel.has(key)) {
          seenLabel.add(key);
          const suggestion = lookupSuggestion(local, register);
          const issue = { type: 'readable_label', iri: ref.iri, module: ref.module, line: ref.line };
          if (suggestion !== undefined) issue.suggestion = suggestion;
          issues.push(issue);
        }
      }
    }
  }

  return issues;
}