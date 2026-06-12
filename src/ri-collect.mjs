import { Parser } from '../vendor/n3.mjs';

const EX = 'http://example.org/apqc#';
const PERF = 'http://example.org/apqc/perf#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const DEFINING_TYPES = new Set([
  'http://www.w3.org/2002/07/owl#Class',
  'http://www.w3.org/2002/07/owl#NamedIndividual',
  'http://www.w3.org/2002/07/owl#ObjectProperty',
  'http://www.w3.org/2002/07/owl#AnnotationProperty',
  'http://www.w3.org/2002/07/owl#DatatypeProperty',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
]);

function isLocal(iri) {
  return iri.startsWith(EX) || iri.startsWith(PERF);
}

function safeContent(line) {
  let result = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === '\\') i++;
        i++;
      }
      if (i < line.length) i++;
      result += ' ';
    } else if (ch === '#') {
      break;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

function buildPrefixMap(text) {
  const map = {};
  const re = /(?:@prefix|PREFIX)\s+(\w*)\s*:\s*<([^>]+)>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

function findLine(lines, prefixMap, iri) {
  const reprs = [`<${iri}>`];
  for (const [prefix, base] of Object.entries(prefixMap)) {
    if (iri.startsWith(base)) {
      const local = iri.slice(base.length);
      if (local) reprs.push(`${prefix}:${local}`);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    // Skip @prefix, @base, PREFIX, BASE lines (FR-7)
    if (/^@?(?:prefix|base)\b/i.test(trimmed)) continue;
    const safe = safeContent(lines[i]);
    for (const repr of reprs) {
      if (safe.includes(repr)) return i + 1;
    }
  }
  return 1;
}

/**
 * @param {Array<{name: string, text: string}>} modules
 * @returns {{ declared: Set<string>, references: Array<{iri:string,module:string,line:number,position:string}> }}
 */
export function collect(modules) {
  const declared = new Set();
  const references = [];

  for (const mod of modules) {
    const { name, text } = mod;
    let quads;
    try {
      quads = new Parser().parse(text);
    } catch {
      continue;
    }

    const lines = text.split('\n');
    const prefixMap = buildPrefixMap(text);

    for (const quad of quads) {
      const { subject, predicate, object } = quad;

      // FR-6a: declaration recognition — subject of a defining-type triple
      if (
        predicate.termType === 'NamedNode' &&
        predicate.value === RDF_TYPE &&
        object.termType === 'NamedNode' &&
        DEFINING_TYPES.has(object.value) &&
        subject.termType === 'NamedNode' &&
        isLocal(subject.value)
      ) {
        declared.add(subject.value);
      }

      // FR-6, FR-6b: reference collection — every local NamedNode in any position
      // position='restriction' when subject is a BlankNode (owl:Restriction filler quad)
      const isRestriction = subject.termType === 'BlankNode';

      if (subject.termType === 'NamedNode' && isLocal(subject.value)) {
        references.push({
          iri: subject.value,
          module: name,
          line: findLine(lines, prefixMap, subject.value),
          position: 'subject',
        });
      }

      if (predicate.termType === 'NamedNode' && isLocal(predicate.value)) {
        references.push({
          iri: predicate.value,
          module: name,
          line: findLine(lines, prefixMap, predicate.value),
          position: isRestriction ? 'restriction' : 'predicate',
        });
      }

      if (object.termType === 'NamedNode' && isLocal(object.value)) {
        references.push({
          iri: object.value,
          module: name,
          line: findLine(lines, prefixMap, object.value),
          position: isRestriction ? 'restriction' : 'object',
        });
      }
    }
  }

  return { declared, references };
}
