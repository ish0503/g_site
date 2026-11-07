// 실행: node tests/ai.test.js — 3.1 전술 AI vs 3.0 AI (같은 군대 거울 대칭, 시드 고정, 진영 교대)
const { load } = require('./harness');
const SW = load();
const W = 2400, H = 1350;
function match(seed, pers, newOnTeam, terrainPreset) {
  const terrain = terrainPreset ? new SW.Terrain(W, H).generate(terrainPreset, seed) : null;
  const b = new SW.Battle({ W, H, terrain, visual: false, seed, morale: true, timeLimit: 300 });
  b.initSquads();
  const rng = SW.makeRng(seed * 7 + 1);
  const A = SW.buildArmy({ team: 0, budget: 260, pers, W, H, zone: { x0: 20, x1: W * 0.38 }, rnd: rng });
  for (let t = 0; t < 2; t++) {
    const ids = A.squads.map(s => b.addSquad(t, s.name));
    for (const u of A.units) { const x = t ? W - u.x : u.x; if (terrain && terrain.blocked(x, u.y)) continue; b.spawn(u.type, t, x, u.y, { sq: ids[u.sq] }); }
    b.addAI(t, pers);
  }
  b.ai[1 - newOnTeam].legacy = true;
  b.enableFrontline();
  let n = 0; while (!b.over && n < 60 * 300) { b.step(1 / 60); n++; }
  return b.winner === newOnTeam ? 1 : b.winner === -1 ? 0.5 : 0;
}
// 편성 상성 시험: 원거리 편중 군대 vs 근접 군대 등
function counter(seed, newOnTeam) {
  const b = new SW.Battle({ W, H, visual: false, seed, morale: true, timeLimit: 300 });
  b.initSquads();
  const mk = (t, groups) => groups.forEach(([type, n, x, y]) => { const id = b.addSquad(t, type); for (let i = 0; i < n; i++) b.spawn(type, t, t ? W - x - (i % 6) * 22 : x - (i % 6) * 22, y + Math.floor(i / 6) * 22, { sq: id }); });
  mk(0, [['soldier', 36, 700, 520], ['archer', 30, 450, 520], ['cavalry', 12, 600, 200], ['healer', 6, 380, 600]]);
  mk(1, [['soldier', 36, 700, 520], ['archer', 30, 450, 520], ['cavalry', 12, 600, 200], ['healer', 6, 380, 600]]);
  b.addAI(0, 'balanced'); b.addAI(1, 'balanced'); b.ai[1 - newOnTeam].legacy = true;
  b.enableFrontline();
  let n = 0; while (!b.over && n < 60 * 300) { b.step(1 / 60); n++; }
  return b.winner === newOnTeam ? 1 : b.winner === -1 ? 0.5 : 0;
}
let total = 0, games = 0;
for (const [pers, terr] of [['balanced', null], ['aggressive', null], ['defensive', 'plain'], ['flanker', 'forest'], ['artillery', 'river']]) {
  let w = 0; const N = 8;
  for (let s = 0; s < N; s++) w += match(100 + s, pers, s % 2, terr);
  console.log(`${pers.padEnd(11)} ${(terr || '지형 없음').padEnd(6)} 3.1 AI 승률 ${(w / N * 100).toFixed(0)}% (${w}/${N})`);
  total += w; games += N;
}
let cw = 0; for (let s = 0; s < 8; s++) cw += counter(200 + s, s % 2);
console.log(`혼성 군대 거울전            3.1 AI 승률 ${(cw / 8 * 100).toFixed(0)}% (${cw}/8)`);
total += cw; games += 8;
console.log(`\n종합: 3.1 AI ${total}/${games} 승 (${(total / games * 100).toFixed(0)}%) — 50% 이상이면 3.0 대비 개선`);
