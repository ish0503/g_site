// 실행: node tests/w4unrest.test.js — 4.0 점령지·불안·반란·통합·연대기 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, A = W4.Army, D = W4.Diplo;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const NW = () => new W4.World({ seed: 40, player: 'valor', flags: { noWar: true } });
const grab = (w, from, to) => { const i = w.ownedRegions(from).find(j => !(w.map.regions[j].city && w.map.regions[j].city.capital) && w.map.regions[j].nb.some(k => w.state.regions[k].owner === to)); w.state.regions[i].owner = to; return i; };
T('비핵심 영토: 불안 상승, 주둔군이 있으면 억제', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; const i = grab(w, def, 'valor'), j = grab(w, def, 'valor');
  A.create(w, 'valor', j, { inf: 6 });
  w.advance(10);
  return { ok: w.state.regions[i].unrest > 5 && w.state.regions[j].unrest < w.state.regions[i].unrest, info: `무주둔 ${w.state.regions[i].unrest.toFixed(0)} · 주둔 ${w.state.regions[j].unrest.toFixed(0)}` };
});
T('회유·진압·자치 정책', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; const i = grab(w, def, 'valor'); const s = w.state.regions[i]; s.unrest = 60; w.nations.valor.res.gold = 1000;
  const a = W4.Act.pacify(w, 'valor', i); const u1 = s.unrest;
  const bad = W4.Act.suppress(w, 'valor', i).ok; A.create(w, 'valor', i, { inf: 3 }); const b = W4.Act.suppress(w, 'valor', i); const u2 = s.unrest;
  const p0 = W4.regionProd(w, i).food; W4.Act.autonomy(w, 'valor', i, true); const p1 = W4.regionProd(w, i).food;
  return { ok: a.ok && u1 === 40 && !bad && b.ok && u2 === 5 && Math.abs(p1 - p0 * 0.5) < 1e-9 };
});
T('반란: 주둔군 없으면 원래 주인에게 귀속, 강한 주둔군은 진압', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; const i = grab(w, def, 'valor'), j = grab(w, def, 'valor');
  w.state.regions[i].unrest = 100; W4.revolt(w, i);
  A.create(w, 'valor', j, { inf: 30 }); w.state.regions[j].unrest = 100; W4.revolt(w, j);
  return { ok: w.state.regions[i].owner === def && w.state.regions[j].owner === 'valor' && w.state.regions[j].unrest === 35 && w.chron.revolts.length === 2 };
});
T('점령지 봉기: 점령군 축출', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; W4.Act.declareWar(w, 'valor', def);
  const i = w.ownedRegions(def).find(j => !(w.map.regions[j].city && w.map.regions[j].city.capital)); w.state.regions[i].occ = 'valor'; w.state.regions[i].unrest = 100;
  for (const a of w.armies.slice()) if (a.loc === i) w.armies.splice(w.armies.indexOf(a), 1);
  W4.revolt(w, i); return { ok: w.state.regions[i].occ === null && w.state.regions[i].owner === def };
});
T('통합: 120개월 보유 → 핵심 영토, 핵심 명분 소멸', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; const i = grab(w, def, 'valor'); A.create(w, 'valor', i, { inf: 40 });
  w.advance(2); const cb0 = D.cbs(w, def, 'valor').some(c => c.kind === 'core');
  w.state.regions[i].held = 119; w.state.regions[i].unrest = 0; w.advance(2);
  return { ok: cb0 && w.state.regions[i].core === 'valor' && !D.cbs(w, def, 'valor').some(c => c.kind === 'core' && c.region === i) };
});
T('연대기: 전쟁·전투·점령·기여도·연간 스냅숏 (AI 20년)', () => {
  const w = new W4.World({ seed: 40 }); w.advance(240);
  const C = w.chron, wars = W4.Chronicle.wars(w);
  const withContrib = wars.filter(x => Object.keys(x.contrib).length).length;
  return { ok: C.snaps.length === 21 && C.battles.length > 10 && C.occupations.length > 5 && C.timeline.some(e => e.kind === 'war') && withContrib > 0, info: `연표 ${C.timeline.length} · 전투 ${C.battles.length} · 점령 ${C.occupations.length} · 반란 ${C.revolts.length} · 전쟁 ${wars.length}(기여도 ${withContrib})` };
});
T('리플레이 연결', () => {
  const w = NW(); const def = D.neighbors(w, 'valor')[0]; W4.Act.declareWar(w, 'valor', def);
  const i = w.ownedRegions(def)[1]; for (const a of w.armies.slice()) if (a.owner === def) w.armies.splice(w.armies.indexOf(a), 1);
  const a = A.create(w, 'valor', i, { inf: 10 }), d = A.create(w, def, i, { inf: 4 }); const rec = A.resolve(w, i, [a], [d]);
  W4.Chronicle.linkReplay(w, rec, 'r123');
  return { ok: w.chron.battles[w.chron.battles.length - 1].replay === 'r123' };
});
T('저장→불러오기 (연대기·불안 포함) 이어서 동일', () => {
  const a = new W4.World({ seed: 9 }); a.advance(100); const b = W4.World.fromJSON(JSON.parse(JSON.stringify(a.toJSON()))); a.advance(40); b.advance(40);
  return { ok: JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()), info: `${(JSON.stringify(a.toJSON()).length / 1024).toFixed(0)}KB` };
});
console.log(`\n${pass} passed, ${fail} failed`);
