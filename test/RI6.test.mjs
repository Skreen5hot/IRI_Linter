// RI6 (R1.1 FR-12 / FR-13): scheme rules apply ONLY to owl:Class subjects -- catalog
// NamedIndividuals (ex:PCF_<id>) are exempt. PINNED acceptance for the Module-3 R1.1 fix.
import { assert } from './_assert.mjs';
import { collect } from '../src/ri-collect.mjs';
import { resolve } from '../src/ri-resolve.mjs';

// FR-12: a catalog NamedIndividual using the correct ex:PCF_<id> scheme, bearing ex:pcfID, is NEVER a
// scheme_violation (this exempts the 1,921 catalog individuals that R1.0 false-flagged).
const catalog = { name: 'catalog.ttl', text: `@prefix ex: <http://example.org/apqc#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
ex:PCF_10101 a owl:NamedIndividual, skos:Concept ; ex:pcfID "10101" .` };
assert(!resolve(collect([catalog])).some(i => i.type === 'scheme_violation'),
  'FR-12: a NamedIndividual catalog node (ex:PCF_<id>) bearing ex:pcfID is NOT a scheme_violation (R1.1)');

// FR-13 (regression): an owl:Class capability-as-process IS still flagged -- class-flagging preserved.
const cls = { name: 'classes.ttl', text: `@prefix ex: <http://example.org/apqc#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix cco: <https://www.commoncoreontologies.org/> .
ex:P10734 a owl:Class ; ex:pcfID "10734" ; rdfs:subClassOf cco:ont00000568 .` };
assert(resolve(collect([cls])).some(i => i.type === 'scheme_violation'
        && i.rule === 'capability-as-process' && i.iri.endsWith('P10734')),
  'FR-13: an owl:Class capability-as-process is still flagged (R1.1 preserves class-flagging)');

// FR-13 (regression): the dangling_ref core is unchanged by the scheme edit.
const dang = { name: 'd.ttl', text: `@prefix ex: <http://example.org/apqc#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
ex:Thing a owl:Class ; ex:requiresCapability ex:NoSuchCap .` };
assert(resolve(collect([dang])).some(i => i.type === 'dangling_ref' && i.iri.endsWith('NoSuchCap')),
  'FR-13: dangling_ref core unchanged by the scheme edit');
