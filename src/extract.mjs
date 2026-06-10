// FR-1, FR-2, FR-3: dependency-free, offline, lexical-only ES module (browser + Node)

/**
 * FR-2: Minimal stable export.
 * extract(ttlText: string) -> Reference[]
 * Reference: { kind: 'prefixed'|'full', lexeme: string, local: string, line: number }
 */
export function extract(ttlText) {
  const refs = [];
  const lines = ttlText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let line = lines[i];

    // FR-8: strip line comment; §9.9 guarantees # does not appear inside literals in R1 input
    const hashIdx = line.indexOf('#');
    if (hashIdx !== -1) {
      line = line.slice(0, hashIdx);
    }

    // FR-8: mask single-line quoted literal content to suppress false positives
    line = line.replace(/"[^"]*"/g, '""').replace(/\'[^\']*\'/g, "''");

    // FR-6, FR-6a: prefixed form cco:<local>; empty local is not captured by [A-Za-z0-9_-]+
    const prefRe = /cco:([A-Za-z0-9_-]+)/g;
    let m;
    while ((m = prefRe.exec(line)) !== null) {
      const local = m[1];
      refs.push({ kind: 'prefixed', lexeme: `cco:${local}`, local, line: lineNum });
    }

    // FR-6, FR-6b: full-IRI form; local = final path segment (no /, ?, # in capture)
    const fullRe = /<https:\/\/www\.commoncoreontologies\.org\/([^>/?#]+)>/g;
    while ((m = fullRe.exec(line)) !== null) {
      const local = m[1];
      refs.push({
        kind: 'full',
        lexeme: `<https://www.commoncoreontologies.org/${local}>`,
        local,
        line: lineNum,
      });
    }
  }

  return refs;
}
