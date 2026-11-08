// 실행: node tests/perf.test.js [--update]
// 성능 회귀 테스트: 시드 고정 대규모 전투(전투 계산만)를 기준값(perf-baseline.json)과 비교.
// 평균이 기준의 1.3배를 넘으면 실패. --update 로 기준 갱신 (측정 환경이 바뀌었을 때만).
const { load } = require('./harness');
const fs = require('fs'), os = require('os'), path = require('path');
const SW = load();
const FILE = path.join(__dirname, 'perf-baseline.json');
const env = `${os.cpus()[0].model} × ${os.cpus().length}, Node ${process.version}`;
function run(N, sec) {
  const W = N > 3000 ? 4000 : 3200, H = N > 3000 ? 2250 : 1800;
  const terrain = new SW.Terrain(W, H).generate('river', 9);
  const b = new SW.Battle({ W, H, terrain, weather: 'clear', morale: true, visual: true, quality: 'low', victory: { type: 'war' }, timeLimit: 900, seed: 42 });
  b.initSquads(); const rng = SW.makeRng(N);
  for (let t = 0; t < 2; t++) {
    const A = SW.buildArmy({ team: t, budget: N * 1.04, pers: t ? 'defensive' : 'balanced', W, H, zone: t ? { x0: W * 0.62, x1: W - 20 } : { x0: 20, x1: W * 0.38 }, rnd: rng });
    const ids = A.squads.map(s => b.addSquad(t, s.name));
    for (const u of A.units) if (!terrain.blocked(u.x, u.y)) b.spawn(u.type, t, u.x, u.y, { sq: ids[u.sq] });
    b.addAI(t, A.pers);
  }
  b.enableFrontline();
  const n0 = b.units.length, ts = [];
  for (let i = 0; i < 60 * sec && !b.over; i++) { const s = process.hrtime.bigint(); b.step(1 / 60); ts.push(Number(process.hrtime.bigint() - s) / 1e6); }
  ts.sort((a, c) => a - c);
  return { units: n0, avg: +(ts.reduce((s, x) => s + x, 0) / ts.length).toFixed(2), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(1), worst: +ts[ts.length - 1].toFixed(0) };
}
const cur = { env, date: new Date().toISOString().slice(0, 10), runs: {} };
for (const N of [1000, 2500, 5000]) cur.runs[N] = run(N, 25);
const base = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
let fail = 0;
for (const [N, r] of Object.entries(cur.runs)) {
  const b = base && base.runs[N];
  const ratio = b ? r.avg / b.avg : 1, ok = ratio <= 1.3;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${N}기 (실제 ${r.units}): 평균 ${r.avg} ms · p99 ${r.p99} · 최악 ${r.worst} · 실시간 대비 ${(16.67 / r.avg).toFixed(2)}×${b ? ` · 기준 대비 ${ratio.toFixed(2)}` : ' (기준 없음)'}`);
}
console.log('환경:', env, base && base.env !== env ? `(기준 환경과 다름: ${base.env})` : '');
if (!base || process.argv.includes('--update')) { fs.writeFileSync(FILE, JSON.stringify(cur, null, 1)); console.log('기준 저장:', FILE); }
console.log(`\n${3 - fail} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
