// 실행: node tests/w4map.test.js — 4.0 세계 지도 생성 (시드 고정)
const { load } = require('./harness');
const SW = load(); const W4 = SW.W4;
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const t0 = Date.now(); const M = W4.genMap(); const genMs = Date.now() - t0;
const connected = (ids, nbf) => { const set = new Set(ids), seen = new Set([ids[0]]), q = [ids[0]]; while (q.length) { const x = q.pop(); for (const y of nbf(x)) if (set.has(y) && !seen.has(y)) { seen.add(y); q.push(y); } } return seen.size === set.size; };
T('개수: 대륙 4 · 국가 16 · 지역 120 · 도시 40', () => {
  const cities = M.regions.filter(r => r.city).length, caps = M.regions.filter(r => r.city && r.city.capital).length;
  return { ok: W4.CONTINENTS.length === 4 && W4.NATIONS.length === 16 && M.regions.length === 120 && cities === 40 && caps === 16, info: `지역 ${M.regions.length} · 도시 ${cities}(수도 ${caps}) · 해역 ${M.seas.length} · 생성 ${genMs}ms` };
});
T('모든 지역이 칸을 가지고 하나로 연결된 모양', () => {
  const bad = [];
  for (const r of M.regions) {
    const cells = []; for (let i = 0; i < M.rid.length; i++) if (M.rid[i] === r.id) cells.push(i);
    const nb = (i) => { const o = [], x = i % M.gw; if (x > 0) o.push(i - 1); if (x < M.gw - 1) o.push(i + 1); o.push(i - M.gw, i + M.gw); return o; };
    if (!cells.length || !connected(cells, nb)) bad.push(r.id);
    if (W4.regionAt(M, r.x, r.y) !== r.id) bad.push('label' + r.id);
  }
  return { ok: !bad.length, info: bad.join(',') };
});
T('인접 관계 대칭 · 대륙별 지역 그래프 연결', () => {
  const sym = M.regions.every(r => r.nb.every(j => M.regions[j].nb.includes(r.id)));
  const conn = W4.CONTINENTS.every((K, ci) => connected(M.regions.filter(r => r.cont === ci).map(r => r.id), (x) => M.regions[x].nb));
  return { ok: sym && conn };
});
T('국가 영토: 국가당 6~7 지역, 연결, 수도 소유', () => {
  const info = [];
  const ok = W4.NATIONS.every(n => { const st = M.nations[n.id]; info.push(st.regions.length); return st.regions.length >= 6 && connected(st.regions, x => M.regions[x].nb) && M.regions[st.capital].owner === n.id && M.regions[st.capital].city.capital; });
  return { ok, info: `영토 ${info.join(',')} · 중립 ${M.regions.filter(r => r.owner === 'neutral').length}` };
});
T('해역: 모든 대륙에 항구 ≥3, 해역 그래프 연결, 대륙 간 해상 경로', () => {
  const ports = W4.CONTINENTS.map((K, ci) => M.regions.filter(r => r.cont === ci && r.port).length);
  const seaConn = connected(M.seas.map(z => z.id), x => M.seas[x].nb);
  const portSeas = M.regions.filter(r => r.port).every(r => r.seas.length > 0);
  return { ok: ports.every(n => n >= 3) && seaConn && portSeas, info: `항구 ${ports.join(',')}` };
});
T('지형·자원·인구 유효', () => {
  const ok = M.regions.every(r => W4.TERRAIN[r.terrain] && r.pop > 0 && Object.keys(r.prod).every(k => W4.RES[k]) && r.name);
  const names = new Set(M.regions.map(r => r.root)).size === 120;
  const terr = {}; M.regions.forEach(r => terr[r.terrain] = (terr[r.terrain] || 0) + 1);
  return { ok: ok && names, info: JSON.stringify(terr) };
});
T('같은 시드 → 같은 지도, 다른 시드 → 다른 지도', () => {
  const h = (m) => { let x = 0; for (let i = 0; i < m.rid.length; i++) x = (x * 31 + m.rid[i] + 2) | 0; return x + '|' + m.regions.map(r => r.owner + r.terrain + r.name).join(); };
  const a = h(M), b = h(W4.genMap()), c = h(W4.genMap(99));
  return { ok: a === b && a !== c };
});
T('경로 탐색: 같은 대륙 수도 사이 경로 존재', () => {
  let ok = true; for (const K of W4.CONTINENTS) { const ns = W4.NATIONS.filter(n => n.cont === K.id); const p = W4.path(M, M.nations[ns[0].id].capital, M.nations[ns[3].id].capital); if (!p || p.length < 2) ok = false; }
  return { ok };
});
T('다른 시드 10개도 조건 충족', () => {
  const bad = [];
  for (let s = 1; s <= 10; s++) { const m = W4.genMap(s); if (m.regions.length !== 120 || m.regions.filter(r => r.city).length !== 40 || W4.NATIONS.some(n => m.nations[n.id].regions.length < 6) || W4.CONTINENTS.some((K, ci) => m.regions.filter(r => r.cont === ci && r.port).length < 3)) bad.push(s); }
  return { ok: !bad.length, info: bad.length ? '실패 시드 ' + bad.join(',') : '' };
});
console.log(`\n${pass} passed, ${fail} failed`);
