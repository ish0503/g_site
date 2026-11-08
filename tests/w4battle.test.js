// 실행: node tests/w4battle.test.js — 4.0 세계 전투 ↔ 실시간 전투 엔진 연결 · 탄약 · 협공 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, A = W4.Army, D = W4.Diplo;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const setup = (fortLevel = 0) => {
  const w = new W4.World({ seed: 40, player: 'valor', flags: { noWar: true } });
  const def = D.neighbors(w, 'valor')[0]; W4.Act.declareWar(w, 'valor', def);
  const i = w.ownedRegions(def).find(x => w.map.regions[x].nb.some(j => w.state.regions[j].owner === 'valor') && !(w.map.regions[x].city && w.map.regions[x].city.capital));
  w.state.regions[i].fort = fortLevel;
  for (const b of w.armies.slice()) if (b.owner === def) w.armies.splice(w.armies.indexOf(b), 1);
  const a = A.create(w, 'valor', i, { inf: 12, arc: 6, cav: 4, sie: 1, mag: 1 }), d = A.create(w, def, i, { inf: 8, arc: 4, cav: 1 });
  return { w, i, a, d, def };
};
T('시나리오 변환: 병과 비율 유지·지휘관·지형·플레이어 team 0', () => {
  const { w, i, a, d } = setup(); const { sc, link } = W4.toBattle(w, i, [a], [d]);
  const n0 = sc.units.filter(u => u.team === 0 && u.type !== 'commander').length, n1 = sc.units.filter(u => u.team === 1 && u.type !== 'commander').length;
  const ratio = n0 / n1, want = A.size(a) / A.size(d);
  return { ok: Math.abs(ratio - want) / want < 0.15 && sc.units.some(u => u.type === 'commander') && link.playerTeam === 0 && sc.ai[0] === null && sc.terrain, info: `${n0} vs ${n1} (기대 비 ${want.toFixed(2)}) · ${sc.sub}` };
});
T('요새 2 이상: 성벽·성채가 있는 공성전', () => {
  const { w, i, a, d } = setup(2); const { sc } = W4.toBattle(w, i, [a], [d]);
  const st = sc.units.filter(u => SW.UNITS[u.type].structure).length;
  return { ok: st > 10 && sc.victory.type === 'keep' && sc.victory.defender === 1, info: `구조물 ${st}` };
});
T('기술 → 전투 능력치 (강철 무기: 공격 +8%)', () => {
  const { w, i, a, d } = setup(); w.nations.valor.research.done.push('steel'); W4.calcMods(w, 'valor');
  const { sc } = W4.toBattle(w, i, [a], [d]);
  const dm = SW.resolveDef('soldier', sc.mods[0]).dmg, base = SW.resolveDef('soldier', SW.save.mods()).dmg;
  return { ok: dm > base * 1.07, info: `${base.toFixed(2)} → ${dm.toFixed(2)}` };
});
T('실제 엔진 전투 → 세계 반영 (손실·승패·전투 기록·전쟁 점수)', () => {
  const { w, i, a, d } = setup(); const { sc, link } = W4.toBattle(w, i, [a], [d]);
  const s0 = [A.size(a), A.size(d)];
  const t = Date.now(); const b = W4.runBattle(sc, link, { maxSec: 240 }); const ms = Date.now() - t;
  const rec = W4.applyBattle(w, link, b);
  const war = W4.War.of(w, 'valor', d.owner);
  return { ok: b.over && rec && rec.real && war.battles.length === 1 && A.size(a) < s0[0] && (w.armies.includes(d) ? A.size(d) < s0[1] : true) && rec.winner === (b.winner === 0 ? 'valor' : d.owner), info: `${b.units.length}기 · ${b.time.toFixed(0)}초 (${ms}ms) · 승자 ${rec && rec.winner} · 손실 ${rec && rec.attLost}k/${rec && rec.defLost}k` };
});
T('같은 시드 → 같은 전투 결과', () => {
  const run = () => { const { w, i, a, d } = setup(); const { sc, link } = W4.toBattle(w, i, [a], [d]); const b = W4.runBattle(sc, link, { maxSec: 120 }); return b.units.filter(u => u.alive).length + ':' + b.winner + ':' + b.time.toFixed(2); };
  const x = run(), y = run(); return { ok: x === y, info: x };
});
T('탄약: 소모·고갈 시 원거리 피해 40%', () => {
  const b = new SW.Battle({ visual: false, seed: 3, endless: true });
  for (let k = 0; k < 20; k++) b.spawn('archer', 0, 300, 200 + k * 25);
  const tgt = b.spawn('golem', 1, 480, 450);
  b.enableAmmo({ start: [5, 100] });
  const max0 = b.ammoMax[0];
  b.start(); for (let k = 0; k < 60 * 20; k++) b.step(1 / 60);
  return { ok: b.ammo[0] < 1 && max0 === 700 && b.events.some(e => (e.text || '').includes('탄약 고갈')), info: `탄약 ${b.ammo[0].toFixed(1)}/${max0}` };
});
T('탄약 고갈 후 피해 감소 (같은 시드 비교)', () => {
  const dealt = (start) => { const b = new SW.Battle({ visual: false, seed: 4, endless: true }); for (let k = 0; k < 10; k++) b.spawn('archer', 0, 300, 300 + k * 25); const g = b.spawn('golem', 1, 470, 420); b.enableAmmo({ start: [start, 100] }); b.start(); for (let k = 0; k < 60 * 6; k++) b.step(1 / 60); return g.maxHp - g.hp; };
  const full = dealt(100), empty = dealt(0);
  return { ok: empty < full * 0.6, info: `${full.toFixed(0)} vs ${empty.toFixed(0)}` };
});
T('협공: 기동 부대 둘이 양 측면으로', () => {
  const { w, i, d } = setup(); const a = A.create(w, 'valor', i, { inf: 10, cav: 8, arc: 3 });
  const { sc, link } = W4.toBattle(w, i, [a], [d]);
  // 기병대를 두 부대로 나눔
  const cavSq = sc.squads.findIndex(q => q.team === 0 && q.name.includes('기병')); const extra = sc.squads.length; sc.squads.push({ team: 0, name: '기병대2', order: 'free' });
  let k = 0; for (const u of sc.units) if (u.sq === cavSq && k++ % 2) u.sq = extra;
  sc.ai = ['flanker', 'balanced'];
  const b = W4.runBattle(sc, link, { maxSec: 90 });
  const ev = b.events.find(e => (e.text || '').includes('협공'));
  return { ok: !!ev, info: ev ? ev.text : '협공 없음' };
});
console.log(`\n${pass} passed, ${fail} failed`);
