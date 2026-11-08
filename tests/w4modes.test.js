// 실행: node tests/w4modes.test.js — 4.0 게임 모드·승패·커스텀 시나리오 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, D = W4.Diplo, War = W4.War;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const fin = (w) => W4.NATIONS.every(n => Object.values(w.nations[n.id].res).every(Number.isFinite));
for (const k of Object.keys(W4.SCENARIOS)) T(`모드 시작·24개월 진행: ${W4.SCENARIOS[k].name}`, () => {
  const w = W4.newScenario(k, { player: 'valor' }); const t = Date.now(); w.advance(24);
  return { ok: fin(w) && w.scenario === k, info: `${Date.now() - t}ms · 전쟁 ${w.wars.length} · 생존 ${w.alive().length}` };
});
T('세계 대전: 두 진영 동맹 + 동시 전쟁 8개로 1년 진행 (결정적 승리 시 종전 허용)', () => {
  const w = W4.newScenario('worldwar', { player: 'valor' }); const w0 = w.wars.length;
  const B = w.flags.blocs, allyOk = B.every(b => b.every(x => b.every(y => x === y || D.has(w, 'alliance', x, y))));
  const ts = []; for (let m = 0; m < 12; m++) { const s = process.hrtime.bigint(); w.advance(1); ts.push(Number(process.hrtime.bigint() - s) / 1e6); }
  return { ok: allyOk && B[0].length === 8 && w0 === 8 && Math.max(...ts) < 500 && (w.wars.length + w.warHistory.length) >= 8, info: `시작 직후 전쟁 ${w0} · 1년 뒤 ${w.wars.length} · 월 평균 ${(ts.reduce((a, b) => a + b, 0) / 12).toFixed(1)}ms 최악 ${Math.max(...ts).toFixed(1)}ms` };
});
T('세계 대전 시작 시 전쟁 수 = 8', () => { const w = W4.newScenario('worldwar', { player: 'valor' }); return { ok: w.wars.length === 8, info: `${w.wars.length}` }; });
T('국가 전쟁: 숙적과 전쟁 상태로 시작', () => { const w = W4.newScenario('nationwar', { player: 'valor' }); return { ok: War.atWar(w, 'valor', w.flags.rival), info: w.flags.rival }; });
T('대륙 전쟁: 다른 대륙 국가는 선전포고하지 않음', () => {
  const w = W4.newScenario('continental', { player: 'valor' }); w.advance(120);
  const other = (w.warHistory || []).concat(w.wars).filter(x => x.att.some(id => w.def(id).cont !== w.flags.activeCont) && !x.att.concat(x.def).some(id => w.def(id).cont === w.flags.activeCont));
  return { ok: other.length === 0, info: `전쟁 기록 ${(w.warHistory || []).length + w.wars.length}` };
});
T('승리 판정: 세계 정복 72곳', () => {
  const w = W4.newScenario('conquest', { player: 'valor' }); w.flags.noWar = true;
  let n = 0; for (const s of w.state.regions) if (n < 72 && s.owner !== 'valor') { s.owner = 'valor'; n++; } else if (s.owner === 'valor') n++;
  w.advance(1); return { ok: w.result && w.result.win, info: w.result && w.result.text };
});
T('패배 판정: 플레이어 국가 멸망', () => {
  const w = W4.newScenario('conquest', { player: 'valor' }); for (const i of w.ownedRegions('valor')) w.state.regions[i].owner = 'ferrum';
  w.advance(1); return { ok: w.result && !w.result.win };
});
T('커스텀 시나리오: 소유권·자원·체제·동맹·전쟁 적용, JSON 왕복', () => {
  const W0 = W4.genMap(40); const owners = {}; for (const i of W0.nations.sylva.regions) owners[i] = 'valor';
  const sc = { name: '시험', seed: 40, player: 'valor', owners, nations: { valor: { gold: 9999, gov: 'empire' } }, alliances: [['valor', 'aurum']], wars: [['valor', 'ferrum']] };
  const w = W4.customWorld(JSON.parse(JSON.stringify(sc))); w.advance(1);
  return { ok: !w.nations.sylva.alive && w.ownedRegions('valor').length >= 13 && w.nations.valor.gov === 'empire' && D.has(w, 'alliance', 'valor', 'aurum') && War.atWar(w, 'valor', 'ferrum'), info: `발로르 ${w.ownedRegions('valor').length}곳` };
});
T('샌드박스 도구: 소유권·선전포고·평화·군단', () => {
  const w = W4.newScenario('sandbox'); const i = w.map.nations.ferrum.capital;
  W4.Act.sandbox.setOwner(w, w.ownedRegions('aurum')[1], 'ferrum');
  const r = W4.Act.sandbox.war(w, 'kryos', 'oriens'); const a = W4.Act.sandbox.army(w, 'ferrum', i);
  const p = W4.Act.sandbox.peace(w, r.war.id);
  return { ok: r.ok && a.ok && p.ok && !War.atWar(w, 'kryos', 'oriens') };
});
T('모드 저장→불러오기: 시나리오·결과·플래그 유지', () => {
  const a = W4.newScenario('worldwar', { player: 'valor' }); a.advance(6); const b = W4.World.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  a.advance(12); b.advance(12);
  return { ok: b.scenario === 'worldwar' && JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()) };
});
console.log(`\n${pass} passed, ${fail} failed`);
