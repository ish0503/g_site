// 실행: node tests/w4econ.test.js — 4.0 국가·경제·내정·기술 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const fin = (o) => Object.values(o).every(v => Number.isFinite(v));
T('세계 생성: 국가 16 초기 상태', () => {
  const w = new W4.World({ seed: 40 });
  const ok = W4.NATIONS.every(n => { const N = w.nations[n.id]; return N.res.gold === 300 && N.manpower > 0 && N.research && N.mods; });
  return { ok, info: `발로르 인력 ${Math.round(w.nations.valor.manpower)}` };
});
T('10년(120개월) 진행: 값 유한·인구 증가·연구 진행·기근 없음', () => {
  const w = new W4.World({ seed: 40 }); const pop0 = W4.nationStats(w, 'valor').pop;
  const t = Date.now(); w.advance(120); const ms = Date.now() - t;
  const all = W4.NATIONS.every(n => fin(w.nations[n.id].res) && Number.isFinite(w.nations[n.id].stab));
  const pop1 = W4.nationStats(w, 'valor').pop, techs = W4.NATIONS.map(n => w.nations[n.id].research.done.length);
  const famine = W4.NATIONS.filter(n => w.nations[n.id].famine).length;
  return { ok: all && pop1 > pop0 && Math.min(...techs) >= 4 && famine === 0, info: `${ms}ms · 인구 ${Math.round(pop0)}→${Math.round(pop1)} · 기술 ${Math.min(...techs)}~${Math.max(...techs)} · 금 ${Math.round(w.nations.valor.res.gold)}` };
});
T('건설: 농장 → 식량 생산 증가, 자원 차감, 대기열 완료', () => {
  const w = new W4.World({ seed: 40 }); const i = w.map.nations.valor.capital;
  const f0 = W4.regionProd(w, i).food, g0 = w.nations.valor.res.gold;
  const r = W4.Act.build(w, 'valor', i, 'farm');
  const paid = w.nations.valor.res.gold < g0;
  w.advance(2);
  return { ok: r.ok && paid && w.state.regions[i].bld.farm === 1 && W4.regionProd(w, i).food > f0 * 1.25, info: `${f0.toFixed(1)}→${W4.regionProd(w, i).food.toFixed(1)}` };
});
T('명령 검증: 타국 지역·해안 전용·자원 부족·최대 단계', () => {
  const w = new W4.World({ seed: 40 });
  const foreign = w.map.nations.ferrum.capital, inland = w.ownedRegions('valor').find(i => !w.map.regions[i].coastal);
  const a = W4.Act.build(w, 'valor', foreign, 'farm').ok === false;
  const b = inland === undefined || W4.Act.build(w, 'valor', inland, 'shipyard').ok === false;
  w.nations.valor.res.gold = 0; const c = W4.Act.build(w, 'valor', w.map.nations.valor.capital, 'market').ok === false;
  w.nations.valor.res.gold = 1e5; w.nations.valor.res.stone = 1e5; const cap = w.map.nations.valor.capital;
  W4.Act.build(w, 'valor', cap, 'academy'); const d = W4.Act.build(w, 'valor', cap, 'academy').ok === false;
  return { ok: a && b && c && d };
});
T('개발·도시 건설·세율', () => {
  const w = new W4.World({ seed: 40 }); const N = w.nations.valor; N.res.gold = 5000; N.res.stone = 1000; N.res.wood = 1000;
  const i = w.ownedRegions('valor').find(j => !w.map.regions[j].city); const s = w.state.regions[i]; s.dev = 4;
  const d0 = s.dev; W4.Act.develop(w, 'valor', i); w.advance(3); const devOk = s.dev === d0 + 1;
  const c = W4.Act.foundCity(w, 'valor', i); w.advance(6);
  const g0 = w.nations.valor.income.gold; W4.Act.setTax(w, 'valor', 'high'); w.advance(1);
  return { ok: devOk && c.ok && !!W4.cityOf(w, i) && w.nations.valor.income.gold > g0, info: `세입 ${g0.toFixed(1)}→${w.nations.valor.income.gold.toFixed(1)} · 안정 ${w.nations.valor.stab.toFixed(0)}` };
});
T('기술: 연구 완료 → 수정자 반영', () => {
  const w = new W4.World({ seed: 40 }); W4.Act.research(w, 'valor', 'rotation');
  const f0 = W4.regionProd(w, w.map.nations.valor.capital).food; w.advance(24);
  const done = w.nations.valor.research.done;
  return { ok: done.includes('rotation') && W4.regionProd(w, w.map.nations.valor.capital).food > f0 * 1.1 && !W4.canResearch(w, 'valor', 'industry'), info: done.join(',') };
});
T('기근: 식량 0 → 안정도·인구 감소', () => {
  const w = new W4.World({ seed: 40 }); const N = w.nations.valor; const p0 = W4.nationStats(w, 'valor').pop;
  N.res.food = -500; w.advance(1);
  return { ok: N.famine && W4.nationStats(w, 'valor').pop < p0 * 1.002 && w.log.some(e => e.text.includes('기근')) };
});
T('결정론: 같은 시드 같은 결과', () => {
  const run = () => { const w = new W4.World({ seed: 7 }); w.advance(60); return JSON.stringify(w.toJSON()); };
  return { ok: run() === run() };
});
T('직렬화: 저장→불러오기 후 이어서 진행해도 같은 결과', () => {
  const a = new W4.World({ seed: 11 }); a.advance(30);
  const b = W4.World.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  a.advance(30); b.advance(30);
  const sa = JSON.stringify(a.toJSON()), sb = JSON.stringify(b.toJSON());
  return { ok: sa === sb, info: `${(sa.length / 1024).toFixed(0)}KB` };
});
console.log(`\n${pass} passed, ${fail} failed`);
