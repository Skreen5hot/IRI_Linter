// src/ri-cli.mjs — RI2/RI3: CLI entry; all filesystem I/O lives here
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collect } from './ri-collect.mjs';
import { resolve } from './ri-resolve.mjs';

export async function runCLI(argv) {
  const args = argv.slice(2);
  const modulePaths = [];
  let registerPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--modules') {
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        modulePaths.push(args[i++]);
      }
      i--;
    } else if (args[i] === '--register') {
      i++;
      if (i >= args.length) {
        process.stderr.write('Error: --register requires a path\n');
        process.exit(2);
      }
      registerPath = args[i];
    }
  }

  if (modulePaths.length === 0) {
    process.stderr.write('Error: --modules <paths...> is required\n');
    process.exit(2);
  }

  const modules = [];
  for (const p of modulePaths) {
    let text;
    try {
      text = readFileSync(p, 'utf8');
    } catch (e) {
      process.stderr.write(`Error: cannot read module "${p}": ${e.message}\n`);
      process.exit(2);
    }
    modules.push({ name: p, text });
  }

  let register;
  if (registerPath !== null) {
    let raw;
    try {
      raw = readFileSync(registerPath, 'utf8');
    } catch (e) {
      process.stderr.write(`Error: cannot read register "${registerPath}": ${e.message}\n`);
      process.exit(2);
    }
    try {
      register = JSON.parse(raw);
      if (!Array.isArray(register)) throw new Error('must be a JSON array');
      for (const entry of register) {
        if (
          typeof entry !== 'object' || entry === null ||
          typeof entry.iri !== 'string' ||
          typeof entry.alias !== 'string' ||
          typeof entry.label !== 'string'
        ) {
          throw new Error('each entry must have string fields: iri, alias, label');
        }
      }
    } catch (e) {
      process.stderr.write(`Error: malformed register "${registerPath}": ${e.message}\n`);
      process.exit(2);
    }
  }

  const collected = collect(modules);
  const issues = resolve(collected, register);

  for (const issue of issues) {
    let line = `${issue.module}:${issue.line} ${issue.type} ${issue.iri}`;
    // FR-14: readable_label with known alias appends ' -> <opaque-iri>'
    if (issue.suggestion) line += ` -> ${issue.suggestion}`;
    if (issue.rule) line += ` (${issue.rule})`;
    process.stdout.write(line + '\n');
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCLI(process.argv).catch(e => {
    process.stderr.write(`Fatal: ${e.message}\n`);
    process.exit(2);
  });
}