// Seeded test harness (do not edit). Each module's test/RI<n>.test.mjs imports { assert } and runs
// its checks on import; test/ri-run.mjs imports every RI*.test.mjs then reports. Dependency-free.
export const results = { passed: 0, failed: 0, failures: [] };

export function assert(cond, msg) {
  if (cond) { results.passed++; }
  else { results.failed++; results.failures.push(String(msg || "assertion failed")); }
}

export function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  assert(a === e, `${msg || "assertEqual"}: got ${a}, want ${e}`);
}

export function report() {
  for (const f of results.failures.slice(0, 50)) console.log("FAIL:", f);
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  return results.failed === 0;
}
