// RI1 test suite — covers FR-1, FR-2, FR-3, FR-6, FR-6a, FR-6b, FR-7
import { assert } from './_assert.mjs';
import { collect } from '../src/ri-collect.mjs';

const EX = 'http://example.org/apqc#';
const PERF = 'http://example.org/apqc/perf#';

// ---------------------------------------------------------------------------
// FR-2: in-memory API shape
// ---------------------------------------------------------------------------
{
  const { declared, references } = collect([{ name: 'empty.ttl', text: '@prefix ex: <http://example.org/apqc#> .' }]);
  assert(declared instanceof Set, 'FR-2: declared is a Set');
  assert(Array.isArray(references), 'FR-2: references is an Array');
}

// ---------------------------------------------------------------------------
// FR-1: collect is synchronous (no network, no async)
// ---------------------------------------------------------------------------
{
  let done = false;
  collect([{ name: 'sync.ttl', text: '@prefix ex: <http://example.org/apqc#> .' }]);
  done = true;
  assert(done, 'FR-1: collect completes synchronously, no network required');
}

// ---------------------------------------------------------------------------
// FR-3: vendored N3 parser handles multi-line declarations
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:MultiLine',
    '    a owl:Class .',
  ].join('\n');
  const { declared } = collect([{ name: 'ml.ttl', text }]);
  assert(declared.has(EX + 'MultiLine'), 'FR-3: multi-line declaration parsed by N3');
}

// ---------------------------------------------------------------------------
// FR-6a: all six defining types create declarations
// FR-6a — declaration recognition must include all six defining types
// ---------------------------------------------------------------------------
{
  // FR-6a: owl:Class, owl:NamedIndividual, owl:ObjectProperty, owl:AnnotationProperty,
  //        owl:DatatypeProperty, rdf:Property must all be recognised as defining types
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix perf: <http://example.org/apqc/perf#> .',
    'ex:C1 a owl:Class .',
    'ex:I1 a owl:NamedIndividual .',
    'ex:OP1 a owl:ObjectProperty .',
    'ex:AP1 a owl:AnnotationProperty .',
    'ex:DP1 a owl:DatatypeProperty .',
    'ex:P1 a rdf:Property .',
    'perf:PerfClass a owl:Class .',
  ].join('\n');
  const { declared } = collect([{ name: 'types.ttl', text }]);
  assert(declared.has(EX + 'C1'),         'FR-6a: owl:Class');
  assert(declared.has(EX + 'I1'),         'FR-6a: owl:NamedIndividual');
  assert(declared.has(EX + 'OP1'),        'FR-6a: owl:ObjectProperty');
  assert(declared.has(EX + 'AP1'),        'FR-6a: owl:AnnotationProperty');
  assert(declared.has(EX + 'DP1'),        'FR-6a: owl:DatatypeProperty');
  assert(declared.has(EX + 'P1'),         'FR-6a: rdf:Property');
  assert(declared.has(PERF + 'PerfClass'),'FR-6a: perf: namespace declared');
}

// ---------------------------------------------------------------------------
// FR-6a: object-only IRI must NOT be declared
// ---------------------------------------------------------------------------
{
  // FR-6a: an IRI used only as object and never typed is NOT declared
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:C1 a owl:Class .',
    'ex:C1 owl:disjointWith ex:ObjectOnly .',
  ].join('\n');
  const { declared } = collect([{ name: 'obj.ttl', text }]);
  assert(declared.has(EX + 'C1'),           'FR-6a: declared subject is in declared set');
  assert(!declared.has(EX + 'ObjectOnly'),  'FR-6a: object-only IRI NOT in declared set');
}

// ---------------------------------------------------------------------------
// FR-6: references includes all positions; module/line/position recorded
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:Foo a owl:Class .',
    'ex:Bar owl:subClassOf ex:Foo .',
  ].join('\n');
  const { references } = collect([{ name: 'refs.ttl', text }]);
  const fooRefs = references.filter(r => r.iri === EX + 'Foo');
  assert(fooRefs.length >= 2, 'FR-6: ex:Foo appears in multiple reference positions');
  assert(fooRefs.some(r => r.position === 'subject'), 'FR-6: subject position recorded');
  assert(fooRefs.some(r => r.position === 'object'),  'FR-6: object position recorded');
  assert(fooRefs.every(r => r.module === 'refs.ttl'), 'FR-6: module name correct');
  assert(fooRefs.every(r => typeof r.line === 'number' && r.line >= 1), 'FR-6: line is positive integer');
  const barRefs = references.filter(r => r.iri === EX + 'Bar');
  assert(barRefs.some(r => r.position === 'subject'), 'FR-6: subject position for ex:Bar');
}

// ---------------------------------------------------------------------------
// FR-6: cross-module — declared set and references span all modules
// ---------------------------------------------------------------------------
{
  const mod1 = {
    name: 'a.ttl',
    text: [
      '@prefix ex: <http://example.org/apqc#> .',
      '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
      'ex:ClassA a owl:Class .',
    ].join('\n'),
  };
  const mod2 = {
    name: 'b.ttl',
    text: [
      '@prefix ex: <http://example.org/apqc#> .',
      '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
      'ex:ClassB a owl:Class .',
      'ex:ClassA owl:disjointWith ex:ClassB .',
    ].join('\n'),
  };
  const { declared, references } = collect([mod1, mod2]);
  assert(declared.has(EX + 'ClassA'), 'FR-6: ClassA declared (mod1)');
  assert(declared.has(EX + 'ClassB'), 'FR-6: ClassB declared (mod2)');
  const mod2Refs = references.filter(r => r.module === 'b.ttl' && r.iri === EX + 'ClassA');
  assert(mod2Refs.length > 0, 'FR-6: ClassA reference in mod2 with correct module name');
}

// ---------------------------------------------------------------------------
// FR-6b: blank-node owl:Restriction — predicate and object get restriction position
// FR-6b — reference collection must include IRIs inside blank-node owl:Restriction objects
// ---------------------------------------------------------------------------
{
  // FR-6b: quads whose subject is a BlankNode must produce position:'restriction'
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:Capability a owl:Class .',
    'ex:Process a owl:Class ;',
    '    owl:subClassOf [',
    '        owl:onProperty ex:requires ;',
    '        owl:someValuesFrom ex:Capability',
    '    ] .',
  ].join('\n');
  const { references } = collect([{ name: 'restriction.ttl', text }]);
  const requiresRefs = references.filter(r => r.iri === EX + 'requires');
  const capabilityRefs = references.filter(r => r.iri === EX + 'Capability');
  // FR-6b: ex:requires is the predicate of a blank-node quad → restriction position
  assert(requiresRefs.some(r => r.position === 'restriction'),   'FR-6b: ex:requires in blank-node restriction → restriction position');
  // FR-6b: ex:Capability is the object of a blank-node quad → restriction position
  assert(capabilityRefs.some(r => r.position === 'restriction'), 'FR-6b: ex:Capability in blank-node restriction → restriction position');
}

// ---------------------------------------------------------------------------
// FR-6b: annotation property object included as reference
// FR-6b — object of annotation property must appear in references list
// ---------------------------------------------------------------------------
{
  // FR-6b: local-namespace IRI used as object of an annotation property must be collected
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:designatesProcessType a owl:AnnotationProperty .',
    'ex:Process a owl:Class .',
    'ex:DesignatedProcess a owl:Class ;',
    '    ex:designatesProcessType ex:Process .',
  ].join('\n');
  const { references } = collect([{ name: 'anno.ttl', text }]);
  const processObjRefs = references.filter(r => r.iri === EX + 'Process' && r.position === 'object');
  // FR-6b: ex:Process as object of annotation property ex:designatesProcessType
  assert(processObjRefs.length > 0, 'FR-6b: annotation property object ex:Process included in references');
}

// ---------------------------------------------------------------------------
// FR-7: comments (# ...) do not contribute declarations or references
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    '# ex:CommentClass a owl:Class .',
    'ex:Real a owl:Class . # ex:InlineComment not declared',
  ].join('\n');
  const { declared, references } = collect([{ name: 'comment.ttl', text }]);
  assert(!declared.has(EX + 'CommentClass'),  'FR-7: IRI in comment not declared');
  assert(!declared.has(EX + 'InlineComment'), 'FR-7: IRI in inline comment not declared');
  assert(references.filter(r => r.iri === EX + 'CommentClass').length === 0,  'FR-7: no reference from comment IRI');
  assert(references.filter(r => r.iri === EX + 'InlineComment').length === 0, 'FR-7: no reference from inline comment IRI');
  assert(declared.has(EX + 'Real'), 'FR-7: real declaration still present');
}

// ---------------------------------------------------------------------------
// FR-7: @prefix directive lines do not contribute declarations or references
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    'ex:OnlyReal a owl:Class .',
  ].join('\n');
  const { declared } = collect([{ name: 'prefix.ttl', text }]);
  // The namespace IRI http://example.org/apqc# is used in @prefix but never as a quad subject
  assert(declared.size === 1 && declared.has(EX + 'OnlyReal'), 'FR-7: @prefix line does not contribute declarations');
}

// ---------------------------------------------------------------------------
// FR-7: string literals do not contribute references
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    'ex:Real a owl:Class ;',
    '    rdfs:label "mentions ex:NotARef and http://example.org/apqc#AlsoNot" .',
  ].join('\n');
  const { references } = collect([{ name: 'literal.ttl', text }]);
  assert(references.filter(r => r.iri === EX + 'NotARef').length === 0,  'FR-7: prefixed IRI inside string literal not a reference');
  assert(references.filter(r => r.iri === EX + 'AlsoNot').length === 0,  'FR-7: full IRI inside string literal not a reference');
}

// ---------------------------------------------------------------------------
// FR-6: line numbers are assigned and reflect real line positions
// ---------------------------------------------------------------------------
{
  const text = [
    '@prefix ex: <http://example.org/apqc#> .',  // line 1
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .', // line 2
    'ex:LineClass a owl:Class .',                 // line 3
  ].join('\n');
  const { references } = collect([{ name: 'lines.ttl', text }]);
  const lineClassRefs = references.filter(r => r.iri === EX + 'LineClass' && r.position === 'subject');
  assert(lineClassRefs.length > 0, 'FR-6: subject reference recorded for ex:LineClass');
  assert(lineClassRefs[0].line === 3, 'FR-6: line number matches actual source line');
}
