// RI5 test suite — covers FR-11, FR-12
// FR-11: readable_label fires end-to-end via real collect() -> resolve() pipeline
// FR-12: scheme_violation fires end-to-end via real collect() -> resolve() pipeline
import { assert } from './_assert.mjs';
import { collect } from '../src/ri-collect.mjs';
import { resolve } from '../src/ri-resolve.mjs';

const EX = 'http://example.org/apqc#';
const CCO = 'https://www.commoncoreontologies.org/';

const REGISTER = [
  { iri: CCO + 'ont00001986', alias: 'has-output', label: 'has output' },
];

// ---------------------------------------------------------------------------
// FR-11, FR-12: real integration — collect() then resolve() on inline Turtle
// cco: bound to https://www.commoncoreontologies.org/ (canonical CCO URL)
// Module references cco:has_output (readable_label) and declares ex:P10734
// with ex:pcfID "10734" and rdfs:subClassOf cco:ont00000568 (scheme_violation)
// ---------------------------------------------------------------------------
{
  // FR-11, FR-12
  const mod = {
    name: 'ri5-inline.ttl',
    text: [
      `@prefix ex: <${EX}> .`,
      `@prefix cco: <${CCO}> .`,
      '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
      '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
      'ex:P10734 a owl:Class ;',
      '    ex:pcfID "10734" ;',
      '    rdfs:subClassOf cco:ont00000568 .',
      'ex:SomeProcess a owl:Class ;',
      '    cco:has_output ex:SomeProcess .',
    ].join('\n'),
  };

  const collected = collect([mod]);
  const issues = resolve(collected, REGISTER);

  // FR-11: readable_label for cco:has_output with correct suggestion
  const labelIssues = issues.filter(
    i => i.type === 'readable_label' && i.iri === CCO + 'has_output'
  );
  assert(
    labelIssues.length > 0,
    'FR-11: readable_label issue for cco:has_output emitted from real collect() pipeline'
  );
  assert(
    labelIssues.some(i => i.suggestion === CCO + 'ont00001986'),
    'FR-11: readable_label suggestion is cco:ont00001986'
  );

  // FR-12: scheme_violation for ex:P10734 (capability-as-process)
  const schemeIssues = issues.filter(
    i => i.type === 'scheme_violation' && i.iri === EX + 'P10734'
  );
  assert(
    schemeIssues.length > 0,
    'FR-12: scheme_violation for ex:P10734 emitted from real collect() pipeline'
  );
  assert(
    schemeIssues.some(i => i.rule === 'capability-as-process'),
    'FR-12: scheme_violation rule is capability-as-process'
  );

  // CCO references must NOT be flagged dangling_ref
  assert(
    !issues.some(i => i.type === 'dangling_ref' && i.iri.startsWith(CCO)),
    'FR-11: CCO references NOT flagged as dangling_ref'
  );
}
