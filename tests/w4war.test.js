// 실행: node tests/w4war.test.js — 4.0 국가 전쟁·군단·점령·평화 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4, D = W4.Diplo, War = W4.War, A = W4.Army;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
// 플레이어 국가로 만들면 AI 가 그 국가를 움직이지 않는다 → 시험 대상 고정
const NW = (player = 'valor') => new W4.World({ seed: 40, player });
const nb = (w, a) => D.neighbors(w, a).filter(o => o !== 'neutral');
T('선전포고: 동맹 참전·불가침 차단·명분 없음 불이익', () => {
  const w = NW(); const def = nb(w, 'valor')[0], third = W4.NATIONS.find(n => n.id !== 'valor' && n.id !== def && !D.has(w, 'alliance', n.id, 'valor')).id;
  D.addTreaty(w, 'alliance', def, third); D.addTreaty(w, 'nap', 'valor', 'marea');
  const s0 = w.nations.valor.stab;
  const r = W4.Act.declareWar(w, 'valor', def), blocked = W4.Act.declareWar(w, 'valor', 'marea');
  return { ok: r.ok && r.war.def.includes(third) && !blocked.ok && w.nations.valor.stab < s0 && War.atWar(w, 'valor', third), info: `방어측 ${r.war.def.join(',')}` };
});
T('이동: 경로 따라 이동, 통행권 없는 타국 진입 불가', () => {
  const w = NW(); const a = A.list(w, 'valor')[0];
  const foreign = w.ownedRegions(nb(w, 'valor')[0])[0];
  const no = W4.Act.move(w, 'valor', a.id, foreign);
  const own = w.ownedRegions('valor').filter(i => i !== a.loc).sort((x, y) => (W4.path(w.map, a.loc, y) || []).length - (W4.path(w.map, a.loc, x) || []).length)[0];
  const r = W4.Act.move(w, 'valor', a.id, own); w.advance(3);
  return { ok: !no.ok && r.ok && a.loc === own, info: `${r.path.length - 1}칸` };
});
T('공성·점령 후 방어국 탈환', () => {
  const w = NW(); const def = nb(w, 'valor')[0]; W4.Act.declareWar(w, 'valor', def);
  for (const b of A.list(w, def)) w.armies.splice(w.armies.indexOf(b), 1);           // 방어군 제거
  const a = A.list(w, 'valor')[0]; a.u.sie = 4; a.u.inf = 20;
  const tgt = w.ownedRegions(def).find(i => w.map.regions[i].nb.some(j => w.state.regions[j].owner === 'valor'));
  a.loc = tgt; a.mode = 'idle'; let days = 0;
  while (w.state.regions[tgt].occ !== 'valor' && days < 40) { w.advance(1); days += W4.DAYS; }
  // 탈환: 방어국 군단이 와서 되찾기
  const b = A.create(w, def, tgt, { inf: 30, arc: 10 }); a.loc = w.map.nations.valor.capital;
  let d2 = 0; while (w.state.regions[tgt].occ && d2 < 40) { w.advance(1); d2 += W4.DAYS; }
  return { ok: days < 40 && !w.state.regions[tgt].occ, info: `점령 ${days}일 · 탈환 ${d2}일` };
});
T('전투: 큰 군단 승리, 패자 후퇴·손실, 전쟁 점수 반영', () => {
  const w = NW(); const def = nb(w, 'valor')[0]; const r = W4.Act.declareWar(w, 'valor', def);
  const i = w.ownedRegions(def).find(x => w.map.regions[x].nb.some(j => w.state.regions[j].owner === 'valor'));
  for (const b of w.armies.slice()) if (b.owner === def) w.armies.splice(w.armies.indexOf(b), 1);
  const big = A.create(w, 'valor', i, { inf: 30, arc: 10, cav: 5 }), small = A.create(w, def, i, { inf: 8, arc: 2 });
  w.advance(1);
  const war = r.war, rec = war.battles[0];
  return { ok: rec && rec.winner === 'valor' && small.loc !== i && war.score > 0 && rec.defLost > rec.attLost * 0.5, info: rec ? `손실 ${rec.attLost}k / ${rec.defLost}k · 점수 ${war.score.toFixed(1)}` : '전투 없음' };
});
T('보급: 적지에서 연결이 끊기면 보급·병력 감소', () => {
  const w = NW(); const far = w.ownedRegions('drakmar')[0]; W4.Act.declareWar(w, 'valor', 'drakmar');
  const a = A.create(w, 'valor', far, { inf: 10 }); for (const b of w.armies.slice()) if (b.owner === 'drakmar') w.armies.splice(w.armies.indexOf(b), 1);
  const s0 = A.size(a); a.siege = -999; w.advance(4);
  return { ok: a.supply < 0.5 && A.size(a) < s0, info: `보급 ${a.supply.toFixed(2)} · ${s0}→${A.size(a).toFixed(1)}k` };
});
T('평화: 점령지 할양·휴전·군단 귀환·재선포 불가', () => {
  const w = NW(); const def = nb(w, 'valor')[0]; const { war } = W4.Act.declareWar(w, 'valor', def);
  const occ = w.ownedRegions(def).filter(i => !(w.map.regions[i].city && w.map.regions[i].city.capital)).slice(0, 2);
  for (const i of occ) w.state.regions[i].occ = 'valor';
  const a = A.list(w, 'valor')[0]; a.loc = occ[0];
  w.advance(1); war.score = 80; w.nations[def].exhaustion = 50;
  const r = W4.Act.peace(w, war.id, 'valor', { cede: occ });
  return { ok: r.accepted && occ.every(i => w.state.regions[i].owner === 'valor' && !w.state.regions[i].occ) && !War.atWar(w, 'valor', def) && !W4.Act.declareWar(w, 'valor', def).ok, info: r.msg || '' };
});
T('과한 요구는 거절', () => {
  const w = NW(); const def = nb(w, 'valor')[0]; const { war } = W4.Act.declareWar(w, 'valor', def);
  const all = w.ownedRegions(def); for (const i of all) w.state.regions[i].occ = 'valor';
  war.score = 10; const r = W4.Act.peace(w, war.id, 'valor', { cede: all.slice(0, 4) });
  return { ok: r.ok && !r.accepted };
});
T('멸망: 모든 지역을 잃으면 국가 소멸·조약 정리', () => {
  const w = NW(); const def = nb(w, 'valor')[0]; const { war } = W4.Act.declareWar(w, 'valor', def);
  for (const i of w.ownedRegions(def)) w.state.regions[i].occ = 'valor';
  w.advance(1);
  return { ok: !w.nations[def].alive && !w.wars.includes(war) && !w.diplo.treaties.some(t => t.a === def || t.b === def), info: def };
});
T('AI 30년: 전쟁 발생·종전·결정론·값 유한', () => {
  const run = () => { const w = new W4.World({ seed: 40 }); const t = Date.now(); let maxW = 0, maxMs = 0; for (let m = 0; m < 360; m++) { const s = Date.now(); w.advance(1); maxMs = Math.max(maxMs, Date.now() - s); maxW = Math.max(maxW, w.wars.length); } return { w, ms: Date.now() - t, maxW, maxMs, s: JSON.stringify(w.toJSON()) }; };
  const a = run(), b = run(); const w = a.w;
  const fin = W4.NATIONS.every(n => Object.values(w.nations[n.id].res).every(Number.isFinite)) && w.armies.every(x => Object.values(x.u).every(Number.isFinite));
  const battles = w.log.filter(e => e.kind === 'battle').length;
  return { ok: a.s === b.s && fin && w.warHistory.length >= 3, info: `${a.ms}ms (최악 월 ${a.maxMs}ms) · 종전 ${w.warHistory.length} · 최대 동시 전쟁 ${a.maxW} · 생존 ${w.alive().length}` };
});
T('저장→불러오기 (전쟁 중): 이어서 동일 진행', () => {
  const a = new W4.World({ seed: 40 }); a.advance(150);
  const b = W4.World.fromJSON(JSON.parse(JSON.stringify(a.toJSON()))); a.advance(30); b.advance(30);
  return { ok: JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()), info: `전쟁 ${a.wars.length} · 군단 ${a.armies.length}` };
});
T('동시 전쟁 8개 이상 부하: 월 처리 시간', () => {
  const w = new W4.World({ seed: 40 });
  const pairs = []; for (const K of W4.CONTINENTS) { const ns = W4.NATIONS.filter(n => n.cont === K.id).map(n => n.id); pairs.push([ns[0], ns[1]], [ns[2], ns[3]]); }
  for (const [x, y] of pairs) { for (const t of w.diplo.treaties.filter(t => [x, y].includes(t.a) && [x, y].includes(t.b))) w.diplo.treaties.splice(w.diplo.treaties.indexOf(t), 1); W4.Act.declareWar(w, x, y); }
  const n0 = w.wars.length; const ts = [];
  for (let m = 0; m < 24; m++) { const s = process.hrtime.bigint(); w.advance(1); ts.push(Number(process.hrtime.bigint() - s) / 1e6); }
  ts.sort((x, y) => x - y);
  return { ok: n0 >= 8 && ts[ts.length - 1] < 500, info: `시작 전쟁 ${n0} · 월 평균 ${(ts.reduce((s, x) => s + x, 0) / ts.length).toFixed(1)}ms · 최악 ${ts[ts.length - 1].toFixed(1)}ms · 2년 뒤 전쟁 ${w.wars.length}` };
});
console.log(`\n${pass} passed, ${fail} failed`);
