// 실행: node tests/path.test.js — 경로 탐색 시나리오 (경로 탐색 켬/끔 비교, 시드 고정)
const { load } = require('./harness');
const SW = load();
const out = [];
function scenario(name, build, measure, sec = 40) {
  const res = [];
  for (const navOn of [true, false]) {
    const b = new SW.Battle({ visual: false, seed: 3, timeLimit: 600, ...build.opts() });
    build.setup(b);
    if (!navOn) { const o = b.start.bind(b); b.start = () => { o(); b.nav = null; }; }
    b.start(); if (!navOn) b.nav = null;
    let n = 0; while (!b.over && n < 60 * sec) { b.step(1 / 60); n++; }
    res.push(measure(b));
  }
  console.log(name.padEnd(22), '경로탐색 ON:', res[0], '| OFF:', res[1]);
  out.push(res);
}
// 1) 산맥 + 틈
// 위 시나리오는 명령을 시작 후 내려야 하므로 별도 실행
{
  const run = (navOn) => {
    const t = new SW.Terrain(1600, 900); for (let y = 0; y < 900; y += 20) if (y < 650 || y > 760) t.paint(800, y, 30, 'mountain');
    const b = new SW.Battle({ visual: false, seed: 3, terrain: t, timeLimit: 600 });
    b.initSquads(); const id = b.addSquad(0, 'A');
    for (let i = 0; i < 30; i++) b.spawn('soldier', 0, 300 + (i % 6) * 22, 200 + Math.floor(i / 6) * 22, { sq: id });
    b.spawn('guardian', 1, 1550, 50);
    b.start(); if (!navOn) b.nav = null; b.perceive(); b.setOrder(id, 'rally', { x: 1200, y: 250 });
    let n = 0; while (n < 60 * 40) { b.step(1 / 60); n++; }
    const us = b.units.filter(u => u.team === 0);
    return `40초 후 목표 근처(<150px) ${us.filter(u => Math.hypot(u.x - 1200, u.y - 250) < 150).length}/${us.length}`;
  };
  console.log('산맥 우회 (집결 명령)'.padEnd(22), '경로탐색 ON:', run(true), '| OFF:', run(false));
}
// 2) 강 + 여울: 왼쪽 군대가 오른쪽 적을 공격 → 물 위를 지나는 유닛 비율
{
  const run = (navOn) => {
    const t = new SW.Terrain(1600, 900); for (let y = 0; y < 900; y += 10) t.paint(800, y, 70, y > 380 && y < 520 ? 'ford' : 'water');
    const b = new SW.Battle({ visual: false, seed: 5, terrain: t, timeLimit: 600 });
    for (let i = 0; i < 30; i++) b.spawn('soldier', 0, 300 + (i % 5) * 22, 150 + Math.floor(i / 5) * 22);
    for (let i = 0; i < 10; i++) b.spawn('archer', 1, 1400, 150 + i * 20);
    b.start(); if (!navOn) b.nav = null;
    let water = 0, ford = 0, n = 0;
    while (!b.over && n < 60 * 60) { b.step(1 / 60); n++; if (n % 30 === 0) for (const u of b.units) if (u.team === 0) { const tt = t.at(u.x, u.y).id; if (tt === 'water') water++; if (tt === 'ford') ford++; } }
    return `물 체류 ${water} · 여울 ${ford} · 승자 ${b.winner} · ${b.time.toFixed(0)}초`;
  };
  console.log('강 건너기'.padEnd(22), '경로탐색 ON:', run(true), '| OFF:', run(false));
}
// 3) 성벽 틈: 성벽 한 칸을 부순 뒤 안쪽 목표까지 도달
{
  const run = (navOn) => {
    const b = new SW.Battle({ visual: false, seed: 7, timeLimit: 600 });
    const segs = [];
    for (let y = 100; y <= 800; y += 26) segs.push(b.spawn('wall', 1, 900, y));
    b.initSquads(); const id = b.addSquad(0, 'A');
    for (let i = 0; i < 20; i++) b.spawn('scout', 0, 300 + (i % 5) * 20, 150 + Math.floor(i / 5) * 20, { sq: id });
    b.spawn('keep', 1, 1400, 450);
    b.start(); if (!navOn) b.nav = null;
    b.kill(segs[Math.floor(segs.length * 0.8)], null);        // 아래쪽 성벽 한 칸 파괴
    b.perceive(); b.setOrder(id, 'rally', { x: 1200, y: 300 });
    let n = 0; while (n < 60 * 40) { b.step(1 / 60); n++; }
    const us = b.units.filter(u => u.team === 0 && u.type === 'scout');
    return `성벽 안쪽 진입 ${us.filter(u => u.x > 920).length}/${us.length}`;
  };
  console.log('성벽 틈 통과'.padEnd(22), '경로탐색 ON:', run(true), '| OFF:', run(false));
}
