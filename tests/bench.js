// 실행: node tests/bench.js [유닛수...]   — 시드 고정 대규모 전투 벤치마크 (전투 시뮬레이션만, 렌더링 제외)
const { load } = require('./harness');
const os = require('os');
const SW = load();
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
console.log(`환경: ${os.cpus()[0].model} × ${os.cpus().length}, Node ${process.version}`);
for (const N of (sizes.length ? sizes : [1000, 2500, 5000])) {
  const W = N > 3000 ? 4000 : 3200, H = N > 3000 ? 2250 : 1800;
  const terrain = new SW.Terrain(W, H).generate('river', 9);
  const b = new SW.Battle({ W, H, terrain, weather: 'clear', morale: true, visual: true, quality: 'low', victory: { type: 'war' }, timeLimit: 900, seed: 42 });
  b.initSquads();
  const rng = SW.makeRng(N);
  for (let t = 0; t < 2; t++) {
    const A = SW.buildArmy({ team: t, budget: N * 1.04, pers: t ? 'defensive' : 'balanced', W, H, zone: t ? { x0: W * 0.62, x1: W - 20 } : { x0: 20, x1: W * 0.38 }, rnd: rng });
    const ids = A.squads.map(s => b.addSquad(t, s.name));
    for (const u of A.units) if (!terrain.blocked(u.x, u.y)) b.spawn(u.type, t, u.x, u.y, { sq: ids[u.sq] });
    b.addAI(t, A.pers);
  }
  b.enableFrontline(); SW.Recorder.attach(b);
  const n0 = b.units.length;
  const phases = { approach: [0, 0], brawl: [0, 0] };
  let steps = 0, worst = 0;
  const t0 = Date.now();
  while (!b.over && steps < 60 * 60) {
    const s = process.hrtime.bigint(); b.step(1 / 60); const ms = Number(process.hrtime.bigint() - s) / 1e6;
    worst = Math.max(worst, ms); steps++;
    const ph = b.time < 15 ? 'approach' : 'brawl'; phases[ph][0] += ms; phases[ph][1]++;
  }
  const avg = (Date.now() - t0) / steps;
  const f = (p) => p[1] ? (p[0] / p[1]).toFixed(2) : '-';
  console.log(`유닛 ${n0}: 평균 ${avg.toFixed(2)} ms/step (접근 ${f(phases.approach)} · 난전 ${f(phases.brawl)}) · 최악 ${worst.toFixed(0)} ms · 1배속 실시간 대비 ${(16.67 / avg).toFixed(2)}× · 60초 후 생존 ${b.units.length}`);
}
