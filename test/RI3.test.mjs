// RI3 test suite — covers FR-11, FR-13
// FR-11: flag cco:<readable-local> as readable_label; suggestion when register alias matches
// FR-13: dangling_ref (FR-8/FR-9) must keep passing after this edit (regression guard)
import { assert } from './_assert.mjs';
import { collect } from '../src/ri-collect.mjs';
import { resolve } from '../src/ri-resolve.mjs';

const CCO_NS = 'http://www.ontologyrepository.com/CommonCoreOntologies/';
const EX = 'http://example.org/apqc#';

// Inline register: alias 'has output' (normalized from 'has-output') -> ont00001986
const REGISTER = [
  {
    iri: CCO_NS + 'ont00001986',
    alias: 'has-output',
    label: 'has output',
  },
];

// ---------------------------------------------------------------------------
// FR-11: cco:has_output (readable local) yields readable_label issue with suggestion
// collect() only tracks local-namespace IRIs (ex:/perf:) per spec FR-6, so CCO
// references are injected directly into collected to unit-test resolve's FR-11 logic.
// ---------------------------------------------------------------------------
{
  // FR-11
  const collected = {
    declared: new Set(),
    references: [
      { iri: CCO_NS + 'has_output', module: 'ri3-inline.ttl', line: 6, position: 'predicate' },
    ],
  };
  const issues = resolve(collected, REGISTER);
  const hasOutputIssues = issues.filter(
    i => i.type === 'readable_label' && i.iri === CCO_NS + 'has_output'
  );

  assert(
    hasOutputIssues.length > 0,
    'FR-11: cco:has_output (readable local) flagged as readable_label'
  );
  assert(
    hasOutputIssues.every(i => i.suggestion === CCO_NS + 'ont00001986'),
    'FR-11: readable_label for cco:has_output has suggestion cco:ont00001986'
  );
  assert(
    hasOutputIssues.every(i => i.module === 'ri3-inline.ttl'),
    'FR-11: readable_label carries correct module name'
  );
  assert(
    hasOutputIssues.every(i => typeof i.line === 'number' && i.line >= 1),
    'FR-11: readable_label carries positive integer line'
  );
}

// ---------------------------------------------------------------------------
// FR-11: cco:ont00001234 (opaque form ^ont\d+$) must NOT yield readable_label
// ---------------------------------------------------------------------------
{
  // FR-11
  const collected = {
    declared: new Set(),
    references: [
      { iri: CCO_NS + 'ont00001234', module: 'ri3-inline.ttl', line: 7, position: 'predicate' },
    ],
  };
  const issues = resolve(collected, REGISTER);
  const opaqueIssues = issues.filter(
    i => i.type === 'readable_label' && i.iri === CCO_NS + 'ont00001234'
  );
  assert(
    opaqueIssues.length === 0,
    'FR-11: cco:ont00001234 (opaque) does NOT yield readable_label'
  );
}

// ---------------------------------------------------------------------------
// FR-11: a #-comment line and an @prefix line with cco: text are NOT counted
// Verified via collect: the N3 parser produces no quads from comments or prefix
// directives, so no CCO references reach resolve, hence no readable_label issues.
// ---------------------------------------------------------------------------
{
  // FR-11
  const commentOnlyMod = {
    name: 'ri3-comment.ttl',
    text: [
      '@prefix ex: <http://example.org/apqc#> .',
      '@prefix cco: <http://www.ontologyrepository.com/CommonCoreOntologies/> .',
      '# cco:has_output cco:ont00001234 cco:readable_label_here',
      'ex:EmptyClass a <http://www.w3.org/2002/07/owl#Class> .',
    ].join('\n'),
  };
  const collected = collect([commentOnlyMod]);
  const issues = resolve(collected, REGISTER);
  const labelIssues = issues.filter(i => i.type === 'readable_label');
  assert(
    labelIssues.length === 0,
    'FR-11: comment-only cco: text does NOT produce readable_label issues'
  );
}

// ---------------------------------------------------------------------------
// FR-13: dangling_ref detection still works after RI3 edit (regression guard)
// ---------------------------------------------------------------------------
{
  // FR-13
  const danglingMod = {
    name: 'ri3-dangling.ttl',
    text: [
      '@prefix ex: <http://example.org/apqc#> .',
      '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
      'ex:DeclaredClass a owl:Class ;',
      '    owl:disjointWith ex:UndeclaredClass .',
    ].join('\n'),
  };
  const collected = collect([danglingMod]);
  const issues = resolve(collected, REGISTER);

  const danglingIssues = issues.filter(
    i => i.type === 'dangling_ref' && i.iri === EX + 'UndeclaredClass'
  );
  assert(
    danglingIssues.length > 0,
    'FR-13: dangling_ref still emitted for undeclared ex: IRI after RI3 edit'
  );

  const declaredFlagged = issues.filter(
    i => i.type === 'dangling_ref' && i.iri === EX + 'DeclaredClass'
  );
  assert(
    declaredFlagged.length === 0,
    'FR-13: declared IRI NOT flagged as dangling_ref (FR-9 regression)'
  );
}

// ---------------------------------------------------------------------------
// FR-11: readable_label still emitted when no register supplied (no suggestion field)
// ---------------------------------------------------------------------------
{
  // FR-11
  const collected = {
    declared: new Set(),
    references: [
      { iri: CCO_NS + 'has_output', module: 'ri3-inline.ttl', line: 6, position: 'predicate' },
    ],
  };
  const issues = resolve(collected); // no register

  const hasOutputIssues = issues.filter(
    i => i.type === 'readable_label' && i.iri === CCO_NS + 'has_output'
  );
  assert(
    hasOutputIssues.length > 0,
    'FR-11: readable_label still emitted when no register supplied'
  );
  assert(
    hasOutputIssues.every(i => !('suggestion' in i)),
    'FR-11: no suggestion field when register is absent'
  );
}
