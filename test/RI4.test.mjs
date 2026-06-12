// RI4 test suite — covers FR-12, FR-17
// FR-12: scheme_violation (capability-as-process, pcf-without-P-iri)
// FR-17: dirty fixture with inline Turtle
import { assert } from './_assert.mjs';
import { resolve } from '../src/ri-resolve.mjs';

const EX = 'http://example.org/apqc#';
const CCO = 'http://www.ontologyrepository.com/CommonCoreOntologies/';
const REG = [{ iri: CCO + 'ont00001986', alias: 'has-output', label: 'has output' }];

// ---------------------------------------------------------------------------
// FR-17: EXACTLY 4 issues from two-module inline fixture
//
// Context module (ri4-context.ttl):
//   @prefix ex: <http://example.org/apqc#> . @prefix owl: <...owl#> .
//   ex:RealCapability a owl:Class .
//
// Subject module (ri4-subject.ttl):
//   @prefix ex: ... @prefix owl: ... @prefix cco: ... @prefix rdfs: ...
//   # comment ex:NotARef cco:also-not -- must NOT produce references
//   ex:requiresCapability a owl:ObjectProperty .
//   ex:pcfID a owl:DatatypeProperty .
//   ex:SomeProcess a owl:Class ;
//       ex:requiresCapability ex:RealCapability ;
//       ex:requiresCapability ex:NoSuchCapability ;
//       owl:subClassOf [ owl:onProperty cco:ont00001777 ; owl:someValuesFrom ex:NoSuchProcess ] ;
//       cco:has_output ex:SomeProcess .
//   ex:P10734 a owl:Class ; ex:pcfID "10734" ; rdfs:subClassOf cco:ont00000568 .
//
// collected is manually constructed (equivalent to collect() output on the above Turtle)
// extended with classInfo for scheme_violation — same pattern as RI3 unit tests.
// ---------------------------------------------------------------------------
{
  // FR-17, FR-12
  const collected = {
    declared: new Set([
      EX + 'requiresCapability', EX + 'pcfID', EX + 'SomeProcess',
      EX + 'P10734', EX + 'RealCapability',
    ]),
    references: [
      { iri: EX + 'requiresCapability', module: 'ri4-subject.ttl', line: 6,  position: 'predicate'   },
      { iri: EX + 'requiresCapability', module: 'ri4-subject.ttl', line: 7,  position: 'predicate'   },
      { iri: EX + 'RealCapability',     module: 'ri4-subject.ttl', line: 6,  position: 'object'      },
      { iri: EX + 'NoSuchCapability',   module: 'ri4-subject.ttl', line: 7,  position: 'object'      },
      { iri: EX + 'NoSuchProcess',      module: 'ri4-subject.ttl', line: 9,  position: 'restriction' },
      { iri: CCO + 'has_output',        module: 'ri4-subject.ttl', line: 10, position: 'predicate'   },
      { iri: EX + 'SomeProcess',        module: 'ri4-subject.ttl', line: 5,  position: 'subject'     },
      { iri: EX + 'SomeProcess',        module: 'ri4-subject.ttl', line: 10, position: 'object'      },
      { iri: EX + 'P10734',             module: 'ri4-subject.ttl', line: 11, position: 'subject'     },
      { iri: EX + 'pcfID',              module: 'ri4-subject.ttl', line: 12, position: 'predicate'   },
      { iri: EX + 'RealCapability',     module: 'ri4-context.ttl', line: 3,  position: 'subject'     },
    ],
    classInfo: new Map([
      [EX + 'P10734', { pcfID: '10734', subClassOf: [CCO + 'ont00000568'], module: 'ri4-subject.ttl', line: 11 }],
    ]),
  };

  const issues = resolve(collected, REG);

  // FR-17: EXACTLY 4 issues
  assert(issues.length === 4,
    `FR-17: EXACTLY 4 issues (got ${issues.length}): ${issues.map(i=>i.type+':'+i.iri.split('#')[1]).join(', ')}`);

  // FR-17: ex:RealCapability NOT flagged
  assert(!issues.some(i => i.iri === EX + 'RealCapability'),
    'FR-17: ex:RealCapability (declared in context) NOT flagged');

  // FR-17: dangling_ref ex:NoSuchCapability
  assert(issues.some(i => i.type === 'dangling_ref' && i.iri === EX + 'NoSuchCapability'),
    'FR-17: dangling_ref ex:NoSuchCapability');

  // FR-17: dangling_ref ex:NoSuchProcess (restriction filler)
  assert(issues.some(i => i.type === 'dangling_ref' && i.iri === EX + 'NoSuchProcess'),
    'FR-17: dangling_ref ex:NoSuchProcess (restriction filler)');

  // FR-17: readable_label cco:has_output -> cco:ont00001986
  const labelIssues = issues.filter(i => i.type === 'readable_label' && i.iri === CCO + 'has_output');
  assert(labelIssues.length === 1, 'FR-17: readable_label cco:has_output (exactly one)');
  assert(labelIssues[0]?.suggestion === CCO + 'ont00001986',
    'FR-17: readable_label suggestion -> cco:ont00001986');

  // FR-17, FR-12: scheme_violation ex:P10734 (capability-as-process)
  const schemeIssues = issues.filter(i => i.type === 'scheme_violation');
  assert(schemeIssues.length === 1, 'FR-17: exactly one scheme_violation');
  assert(schemeIssues[0]?.iri === EX + 'P10734' && schemeIssues[0]?.rule === 'capability-as-process',
    'FR-12/FR-17: scheme_violation ex:P10734 (capability-as-process)');
}

// ---------------------------------------------------------------------------
// FR-12: capability-as-process — P<N> + pcfID + subClassOf org capability
// ---------------------------------------------------------------------------
{
  // FR-12
  const collected = {
    declared: new Set([EX + 'P99999']),
    references: [{ iri: EX + 'P99999', module: 't.ttl', line: 3, position: 'subject' }],
    classInfo: new Map([[EX + 'P99999', { pcfID: '99999', subClassOf: [CCO + 'ont00000568'], module: 't.ttl', line: 3 }]]),
  };
  const issues = resolve(collected);
  assert(issues.some(i => i.type === 'scheme_violation' && i.iri === EX + 'P99999' && i.rule === 'capability-as-process'),
    'FR-12: P99999 (P<N> + pcfID + org-capability) -> capability-as-process');
}

// ---------------------------------------------------------------------------
// FR-12: pcf-without-P-iri — pcfID present but local name != P<pcfID>, not capability
// ---------------------------------------------------------------------------
{
  // FR-12
  const collected = {
    declared: new Set([EX + 'ManageIT']),
    references: [{ iri: EX + 'ManageIT', module: 't.ttl', line: 5, position: 'subject' }],
    classInfo: new Map([[EX + 'ManageIT', { pcfID: '10734', subClassOf: [], module: 't.ttl', line: 5 }]]),
  };
  const issues = resolve(collected);
  assert(issues.some(i => i.type === 'scheme_violation' && i.iri === EX + 'ManageIT' && i.rule === 'pcf-without-P-iri'),
    'FR-12: ManageIT with pcfID "10734" but not P10734 and not capability -> pcf-without-P-iri');
}

// ---------------------------------------------------------------------------
// FR-12: P<N> with correct pcfID, no org-capability -> no scheme_violation
// ---------------------------------------------------------------------------
{
  // FR-12
  const collected = {
    declared: new Set([EX + 'P10734']),
    references: [{ iri: EX + 'P10734', module: 't.ttl', line: 2, position: 'subject' }],
    classInfo: new Map([[EX + 'P10734', { pcfID: '10734', subClassOf: [], module: 't.ttl', line: 2 }]]),
  };
  const issues = resolve(collected);
  assert(!issues.some(i => i.type === 'scheme_violation'),
    'FR-12: P10734 with matching pcfID and no org-capability -> no scheme_violation');
}

// ---------------------------------------------------------------------------
// FR-12: human-name capability (has pcfID, subClassOf org-cap) -> no scheme_violation
// ---------------------------------------------------------------------------
{
  // FR-12
  const collected = {
    declared: new Set([EX + 'ManageIT']),
    references: [{ iri: EX + 'ManageIT', module: 't.ttl', line: 4, position: 'subject' }],
    classInfo: new Map([[EX + 'ManageIT', { pcfID: '10734', subClassOf: [CCO + 'ont00000568'], module: 't.ttl', line: 4 }]]),
  };
  const issues = resolve(collected);
  assert(!issues.some(i => i.type === 'scheme_violation'),
    'FR-12: ManageIT with pcfID and org-capability subClass -> no scheme_violation (intentional name)');
}

// ---------------------------------------------------------------------------
// FR-12: no classInfo -> no scheme_violation (graceful degradation)
// ---------------------------------------------------------------------------
{
  // FR-12
  const collected = {
    declared: new Set([EX + 'P10734']),
    references: [{ iri: EX + 'P10734', module: 't.ttl', line: 1, position: 'subject' }],
  };
  assert(!resolve(collected).some(i => i.type === 'scheme_violation'),
    'FR-12: no classInfo -> no scheme_violation');
}

// ---------------------------------------------------------------------------
// FR-13: dangling_ref regression after RI4 edit
// ---------------------------------------------------------------------------
{
  // FR-13
  const collected = {
    declared: new Set([EX + 'DeclaredClass']),
    references: [
      { iri: EX + 'DeclaredClass',   module: 't.ttl', line: 1, position: 'subject' },
      { iri: EX + 'UndeclaredClass', module: 't.ttl', line: 2, position: 'object'  },
    ],
  };
  const issues = resolve(collected);
  assert(issues.some(i => i.type === 'dangling_ref' && i.iri === EX + 'UndeclaredClass'),
    'FR-13: dangling_ref regression — undeclared IRI still flagged after RI4 edit');
  assert(!issues.some(i => i.type === 'dangling_ref' && i.iri === EX + 'DeclaredClass'),
    'FR-13: dangling_ref regression — declared IRI NOT flagged after RI4 edit');
}
