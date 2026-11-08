// 실행: node tests/all.js [--perf]  — 모든 자동 테스트 실행 (AI 대전 비교는 오래 걸려 제외, --perf 로 성능 회귀 포함)
const { spawnSync } = require('child_process');
const path = require('path');
const suites = ['run.js', 'save.test.js', 'classes.test.js', 'path.test.js'];
for (const f of require('fs').readdirSync(__dirname)) if (/^w4.*\.test\.js$/.test(f)) suites.push(f);
if (process.argv.includes('--perf')) suites.push('perf.test.js');
let bad = 0;
for (const s of suites) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8', timeout: 1800000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const sum = out.trim().split('\n').filter(l => /passed|FAIL|ON:/.test(l));
  const failed = r.status !== 0 || /FAIL/.test(out) || / [1-9]\d* failed/.test(out);
  if (failed) bad++;
  console.log(`${failed ? '✗' : '✓'} ${s} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
  for (const l of sum.filter(l => failed || /passed/.test(l))) console.log('   ' + l);
}
console.log(bad ? `\n${bad}개 묶음 실패` : '\n모든 묶음 통과');
process.exitCode = bad ? 1 : 0;
