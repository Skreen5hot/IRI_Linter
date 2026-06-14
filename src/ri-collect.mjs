import { Parser } from '../vendor/n3.mjs';

const EX = 'http://example.org/apqc#';
const PERF = 'http://example.org/apqc/perf#';
const CCO_NS_LIST = [
  'https://www.commoncoreontologies.org/',
  'http://www.ontologyrepository.com/CommonCoreOntologies/',
];
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_SUBCLASSOF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const PCF_ID_PRED = 'http://example.org/apqc#pcfID';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';

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

function isCCO(iri) {
  return CCO_NS_LIST.some(ns => iri.startsWith(ns));
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
 * @returns {{ declared: Set<string>, references: Array<{iri:string,module:string,line:number,position:string}>, classInfo: Map }}
 */
export function collect(modules) {
  const declared = new Set();
  const references = [];
  const classInfo = new Map();

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
      const isRestriction = subject.termType === 'BlankNode';

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
        if (subject.value.startsWith(EX)) {
          if (!classInfo.has(subject.value)) {
            classInfo.set(subject.value, {
              isClass: false,
              pcfID: null,
              subClassOf: [],
              module: name,
              line: findLine(lines, prefixMap, subject.value),
            });
          }
          // FR-12: track owl:Class subjects specifically (NamedIndividual/Concept are exempt)
          if (object.value === OWL_CLASS) {
            classInfo.get(subject.value).isClass = true;
          }
        }
      }

      // Collect pcfID literal for classInfo
      if (
        predicate.termType === 'NamedNode' &&
        predicate.value === PCF_ID_PRED &&
        subject.termType === 'NamedNode' &&
        subject.value.startsWith(EX) &&
        object.termType === 'Literal'
      ) {
        if (!classInfo.has(subject.value)) {
          classInfo.set(subject.value, {
            isClass: false,
            pcfID: null,
            subClassOf: [],
            module: name,
            line: findLine(lines, prefixMap, subject.value),
          });
        }
        classInfo.get(subject.value).pcfID = object.value;
      }

      // Collect rdfs:subClassOf for classInfo
      if (
        predicate.termType === 'NamedNode' &&
        predicate.value === RDFS_SUBCLASSOF &&
        subject.termType === 'NamedNode' &&
        subject.value.startsWith(EX) &&
        object.termType === 'NamedNode'
      ) {
        if (!classInfo.has(subject.value)) {
          classInfo.set(subject.value, {
            isClass: false,
            pcfID: null,
            subClassOf: [],
            module: name,
            line: findLine(lines, prefixMap, subject.value),
          });
        }
        classInfo.get(subject.value).subClassOf.push(object.value);
      }

      // FR-6, FR-6b: reference collection — every local NamedNode in any position
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

      // Also collect CCO namespace references (for readable_label detection in resolve)
      if (predicate.termType === 'NamedNode' && isCCO(predicate.value)) {
        references.push({
          iri: predicate.value,
          module: name,
          line: findLine(lines, prefixMap, predicate.value),
          position: isRestriction ? 'restriction' : 'predicate',
        });
      }

      if (object.termType === 'NamedNode' && isCCO(object.value)) {
        references.push({
          iri: object.value,
          module: name,
          line: findLine(lines, prefixMap, object.value),
          position: isRestriction ? 'restriction' : 'object',
        });
      }
    }
  }

  return { declared, references, classInfo };
}
