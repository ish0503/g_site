// 실행: node tests/w4diplo.test.js — 4.0 외교·국가 AI (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, D = W4.Diplo;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const NW = (o = {}) => new W4.World(Object.assign({ seed: 40, player: 'valor' }, o));
T('초기 관계: 대칭 키, 범위 -100~100', () => { const w = NW(); const v = Object.values(w.diplo.rel); return { ok: v.length === 120 && v.every(x => x >= -100 && x <= 100) && D.rel(w, 'valor', 'ferrum') === D.rel(w, 'ferrum', 'valor') }; });
T('제안: 관계 좋으면 무역 수락, 나쁘면 동맹 거절', () => {
  const w = NW(); D.addRel(w, 'valor', 'marea', 200); const a = W4.Act.propose(w, 'valor', 'marea', 'trade');
  w.turn++; D.addRel(w, 'valor', 'ferrum', -200); const b = W4.Act.propose(w, 'valor', 'ferrum', 'alliance');
  return { ok: a.accepted && D.has(w, 'trade', 'marea', 'valor') && !b.accepted, info: b.msg };
});
T('한 달에 외교 행동 1회', () => { const w = NW(); W4.Act.propose(w, 'valor', 'marea', 'trade'); const r = W4.Act.propose(w, 'valor', 'kryos', 'trade'); return { ok: !r.ok }; });
T('무역 협정 → 양국 금 수입 증가', () => {
  const a = NW(), b = NW(); D.addTreaty(b, 'trade', 'valor', 'marea'); a.advance(2); b.advance(2);
  return { ok: b.nations.valor.income.gold > a.nations.valor.income.gold, info: `${a.nations.valor.income.gold.toFixed(1)} → ${b.nations.valor.income.gold.toFixed(1)}` };
});
T('조약 파기: 관계 하락·안정도·침략 평판', () => {
  const w = NW(); D.addTreaty(w, 'nap', 'valor', 'ferrum'); const r0 = D.rel(w, 'valor', 'ferrum'), s0 = w.nations.valor.stab;
  W4.Act.cancel(w, 'valor', 'nap', 'ferrum');
  return { ok: !D.has(w, 'nap', 'valor', 'ferrum') && D.rel(w, 'valor', 'ferrum') < r0 - 40 && w.nations.valor.stab < s0 && w.nations.valor.ae > 0 };
});
T('불가침 조약 5년 뒤 만료', () => { const w = NW(); D.addTreaty(w, 'nap', 'valor', 'ferrum'); w.advance(59); const a = D.has(w, 'nap', 'valor', 'ferrum'); w.advance(2); return { ok: a && !D.has(w, 'nap', 'valor', 'ferrum') }; });
T('종속: 약소국만 수락, 공물 25%', () => {
  const w = NW({ player: null }); const big = 'valor', small = 'sylva';
  const r1 = W4.Act.propose(w, big, small, 'vassal');
  w.nations[big].res.gold = 1e5; for (const i of w.ownedRegions(small).slice(1)) w.state.regions[i].owner = big;
  w.advance(1); w.turn++; D.addRel(w, big, small, 100);
  const r2 = W4.Act.propose(w, big, small, 'vassal'); const g0 = w.nations[big].income.gold; w.advance(2);
  return { ok: !r1.accepted && r2.accepted && D.overlord(w, small) === big && w.nations[small].spent.gold > 0, info: r1.msg };
});
T('영유권 날조 6개월 → 전쟁 명분', () => {
  const w = NW(); const nb = D.neighbors(w, 'valor')[0]; const r = W4.Act.fabricate(w, 'valor', nb); w.advance(7);
  return { ok: r.ok && D.cbs(w, 'valor', nb).some(c => c.kind === 'claim'), info: nb };
});
T('핵심 영토 명분 자동 생성', () => {
  const w = NW(); const i = w.ownedRegions('ferrum').find(j => j !== w.map.nations.ferrum.capital); w.state.regions[i].owner = 'valor'; w.advance(1);
  return { ok: D.cbs(w, 'ferrum', 'valor').some(c => c.kind === 'core' && c.region === i) };
});
T('플레이어 받은편지함: AI 제안 대기 → 수락', () => {
  const w = NW(); const r = W4.Act.propose(w, 'aurum', 'valor', 'trade'); const n = w.diplo.inbox.length; W4.Act.answer(w, 0, true);
  return { ok: r.pending && n === 1 && D.has(w, 'trade', 'valor', 'aurum') };
});
T('국가 AI 20년: 오류 없음·조약 형성·건설·결정론', () => {
  const run = () => { const w = new W4.World({ seed: 40 }); const t = Date.now(); w.advance(240); return { w, ms: Date.now() - t, s: JSON.stringify(w.toJSON()) }; };
  const a = run(), b = run(); const w = a.w;
  const types = {}; for (const t of w.diplo.treaties) types[t.type] = (types[t.type] || 0) + 1;
  const blds = w.state.regions.reduce((s, r) => s + Object.values(r.bld).reduce((x, y) => x + y, 0), 0);
  const fin = W4.NATIONS.every(n => Object.values(w.nations[n.id].res).every(Number.isFinite));
  return { ok: a.s === b.s && fin && w.diplo.treaties.length > 5 && blds > 50, info: `${a.ms}ms · 조약 ${JSON.stringify(types)} · 건물 ${blds}` };
});
T('저장→불러오기: 외교 상태 보존·이어서 동일 진행', () => {
  const a = new W4.World({ seed: 5 }); a.advance(40);
  const b = W4.World.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  const same0 = JSON.stringify(a.diplo) === JSON.stringify(b.diplo);
  a.advance(40); b.advance(40);
  return { ok: same0 && JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()), info: `조약 ${b.diplo.treaties.length}` };
});
console.log(`\n${pass} passed, ${fail} failed`);
