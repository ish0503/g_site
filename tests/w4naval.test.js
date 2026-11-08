// 실행: node tests/w4naval.test.js — 4.0 해상 전쟁 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, N = W4.Naval, A = W4.Army, D = W4.Diplo;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const NW = (o = {}) => new W4.World(Object.assign({ seed: 40, player: 'valor', flags: { noWar: true } }, o));
const portOf = (w, id) => w.ownedRegions(id).find(i => w.map.regions[i].port);
const rich = (w, id) => Object.assign(w.nations[id].res, { gold: 1e5, wood: 1e5, iron: 1e5 });
T('건조: 항구에서만, 자원 차감, 정박 함대', () => {
  const w = NW(); rich(w, 'valor'); const p = portOf(w, 'valor'), inland = w.ownedRegions('valor').find(i => !w.map.regions[i].coastal);
  const r = W4.Act.buildShip(w, 'valor', p, 'war', 3), bad = inland !== undefined ? W4.Act.buildShip(w, 'valor', inland, 'war', 1).ok : false;
  return { ok: r.ok && !bad && r.fleet.port === p && r.fleet.s.war === 3, info: `항구 ${w.map.regions[p].root}` };
});
T('해역 이동: 다른 대륙 해안까지 경로', () => {
  const w = NW(); rich(w, 'valor'); const p = portOf(w, 'valor'); const f = W4.Act.buildShip(w, 'valor', p, 'war', 1).fleet;
  const far = w.map.regions[portOf(w, 'oriens')].seas[0];
  const r = W4.Act.moveFleet(w, 'valor', f.id, far); for (let k = 0; k < 6 && f.sea !== far; k++) w.advance(1);
  return { ok: r.ok && f.sea === far, info: `${r.path.length - 1}개 해역` };
});
T('봉쇄: 적 항구 교역 수입 0', () => {
  const w = NW(); const e = 'marea'; W4.Act.declareWar(w, 'valor', e); rich(w, 'valor');
  const ep = portOf(w, e); w.advance(1); const before = w.nations[e].income.gold;
  const f = W4.Act.buildShip(w, 'valor', portOf(w, 'valor'), 'war', 4).fleet; f.sea = w.map.regions[ep].seas[0]; f.port = null;
  w.advance(1);
  return { ok: W4.isBlockaded(w, ep) && w.nations[e].income.gold < before, info: `${before.toFixed(1)} → ${w.nations[e].income.gold.toFixed(1)}` };
});
T('해전: 강한 함대 승리·패자 손실·수송선 침몰 시 병력 손실', () => {
  const w = NW(); const e = 'marea'; W4.Act.declareWar(w, 'valor', e); rich(w, 'valor'); rich(w, e);
  const z = w.map.regions[portOf(w, 'valor')].seas[0];
  const a = W4.Act.buildShip(w, 'valor', portOf(w, 'valor'), 'war', 8).fleet;
  const b = W4.Act.buildShip(w, e, portOf(w, e), 'trans', 3).fleet; W4.Act.buildShip(w, e, portOf(w, e), 'war', 1);
  const army = A.create(w, e, portOf(w, e), { inf: 10 }); W4.Act.embark(w, e, army.id, b.id);
  a.sea = z; a.port = null; b.sea = z; b.port = null; const s0 = A.size(army);
  w.advance(1);
  const lost = !w.armies.includes(army) || A.size(army) < s0;
  return { ok: w.log.some(e => e.text.includes('해전')) && lost && a.s.war > 0, info: `수송 병력 ${s0} → ${w.armies.includes(army) ? A.size(army).toFixed(1) : '전멸'}` };
});
T('상륙: 승선 → 해외 이동 → 상륙 → 점령', () => {
  const w = NW(); const e = 'oriens'; W4.Act.declareWar(w, 'valor', e); rich(w, 'valor');
  const p = portOf(w, 'valor'); const army = A.create(w, 'valor', p, { inf: 14, sie: 2 });
  const f = W4.Act.buildShip(w, 'valor', p, 'trans', 4).fleet;
  const em = W4.Act.embark(w, 'valor', army.id, f.id);
  const tgt = w.ownedRegions(e).find(i => w.map.regions[i].coastal && !(w.map.regions[i].city && w.map.regions[i].city.capital));
  for (const b of w.armies.slice()) if (b.owner === e) w.armies.splice(w.armies.indexOf(b), 1);
  W4.Act.moveFleet(w, 'valor', f.id, w.map.regions[tgt].seas[0]);
  for (let k = 0; k < 8 && f.mode === 'move'; k++) w.advance(1);
  const ld = W4.Act.land(w, 'valor', f.id, tgt); let m = 0;
  while (w.state.regions[tgt].occ !== 'valor' && m < 12) { w.advance(1); m++; }
  return { ok: em.ok && ld.ok && army.loc === tgt && w.state.regions[tgt].occ === 'valor', info: `${w.map.regions[tgt].name} 점령 ${m}개월` };
});
T('수송 능력 초과 승선 거절', () => {
  const w = NW(); rich(w, 'valor'); const p = portOf(w, 'valor'); const army = A.create(w, 'valor', p, { inf: 20 }); const f = W4.Act.buildShip(w, 'valor', p, 'trans', 2).fleet;
  return { ok: !W4.Act.embark(w, 'valor', army.id, f.id).ok };
});
T('AI 30년(해군 포함): 결정론·함대 건조·값 유한', () => {
  const run = () => { const w = new W4.World({ seed: 40 }); const t = Date.now(); w.advance(360); return { w, ms: Date.now() - t, s: JSON.stringify(w.toJSON()) }; };
  const a = run(), b = run(); const w = a.w;
  const ships = w.fleets.reduce((s, f) => s + N.size(f), 0), naval = w.log.filter(e => e.naval).length;
  return { ok: a.s === b.s && w.fleets.every(f => Object.values(f.s).every(Number.isFinite)) && ships > 0, info: `${a.ms}ms · 함대 ${w.fleets.length} (${ships.toFixed(0)}척) · 최근 기록 해전 ${naval} · 상륙 ${w.log.filter(e => e.text.includes('상륙')).length}` };
});
T('저장→불러오기 (함대·승선 군단 포함)', () => {
  const w = NW(); rich(w, 'valor'); const p = portOf(w, 'valor'); const army = A.create(w, 'valor', p, { inf: 5 }); const f = W4.Act.buildShip(w, 'valor', p, 'trans', 2).fleet; W4.Act.embark(w, 'valor', army.id, f.id); W4.Act.moveFleet(w, 'valor', f.id, w.map.seas[f.sea].nb[0]);
  const b = W4.World.fromJSON(JSON.parse(JSON.stringify(w.toJSON()))); w.advance(6); b.advance(6);
  return { ok: JSON.stringify(w.toJSON()) === JSON.stringify(b.toJSON()) && b.armies.find(a => a.id === army.id).onFleet === f.id };
});
console.log(`\n${pass} passed, ${fail} failed`);
