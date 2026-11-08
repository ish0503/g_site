// ─────────────────────────────────────────────
// 4.0 세계 지도 생성기 (시드 고정, 결정론적)
//   대륙 4 (별 모양 윤곽 → 항상 연결) · 지역 120 (대륙당 30, 보로노이 + 로이드 완화)
//   해역(바다 구역) · 해안·항구 · 지형·자원·인구 · 국가 16 영토(국가당 7) · 도시 40 (수도 16 + 24)
//   지도는 시드로 다시 만들 수 있으므로 저장할 때는 시드와 변하는 상태만 저장한다.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4;

  W4.genMap = function (seed = W4.DEFAULT_SEED) {
    const rng = SW.makeRng(seed * 7919 + 13);
    const R = () => rng();
    const pickW = (tbl) => { let tot = 0; for (const k in tbl) tot += tbl[k]; let r = R() * tot; for (const k in tbl) { if ((r -= tbl[k]) <= 0) return k; } return Object.keys(tbl)[0]; };
    const C = W4.CELL, GW = (W4.MAP_W / C) | 0, GH = (W4.MAP_H / C) | 0, NC = GW * GH;
    const cont = new Int8Array(NC).fill(-1);
    const cx = (i) => (i % GW + 0.5) * C, cy = (i) => (((i / GW) | 0) + 0.5) * C;

    // ── 1. 대륙 윤곽 (각도별 반지름 = 조화 함수 합 → 별 모양이라 항상 하나로 연결) ──
    W4.CONTINENTS.forEach((K, ci) => {
      const harm = []; for (let h = 2; h <= 9; h++) harm.push([h, (R() * 0.5 + 0.2) * 0.16 / Math.sqrt(h), R() * Math.PI * 2]);
      for (let i = 0; i < NC; i++) {
        const dx = (cx(i) - K.cx) / K.rx, dy = (cy(i) - K.cy) / K.ry, th = Math.atan2(dy, dx);
        let k = 1; for (const [h, a, p] of harm) k += a * Math.sin(h * th + p);
        if (dx * dx + dy * dy < k * k * 0.92 && cont[i] < 0) cont[i] = ci;
      }
    });

    // ── 2. 지역: 대륙마다 포아송 표본 → 로이드 완화 → 연결 성분 정리 ──
    const rid = new Int16Array(NC).fill(-1);
    const regions = [];
    W4.CONTINENTS.forEach((K, ci) => {
      const cells = []; for (let i = 0; i < NC; i++) if (cont[i] === ci) cells.push(i);
      let minD = Math.sqrt(cells.length * C * C / K.regions) * 0.8;
      let sites = [];
      while (sites.length < K.regions) {
        for (let t = 0; t < 4000 && sites.length < K.regions; t++) {
          const c = cells[(R() * cells.length) | 0], x = cx(c), y = cy(c);
          if (sites.every(s => (s.x - x) ** 2 + (s.y - y) ** 2 >= minD * minD)) sites.push({ x, y });
        }
        minD *= 0.9;
      }
      const assign = () => {
        for (const c of cells) { const x = cx(c), y = cy(c); let b = 0, bd = Infinity; for (let s = 0; s < sites.length; s++) { const d = (sites[s].x - x) ** 2 + (sites[s].y - y) ** 2; if (d < bd) { bd = d; b = s; } } rid[c] = b; }
      };
      for (let it = 0; it < 3; it++) {
        assign();
        const sx = new Float64Array(sites.length), sy = new Float64Array(sites.length), n = new Float64Array(sites.length);
        for (const c of cells) { sx[rid[c]] += cx(c); sy[rid[c]] += cy(c); n[rid[c]]++; }
        sites = sites.map((s, k) => n[k] ? { x: sx[k] / n[k], y: sy[k] / n[k] } : s);
      }
      assign();
      const base = regions.length;
      for (let s = 0; s < sites.length; s++) regions.push({ id: base + s, cont: ci });
      for (const c of cells) rid[c] += base;
    });
    // 각 지역에서 가장 큰 연결 성분만 남기고 떨어진 조각은 인접 지역에 붙인다
    const nb4 = (i, f) => { const x = i % GW; if (x > 0) f(i - 1); if (x < GW - 1) f(i + 1); if (i >= GW) f(i - GW); if (i < NC - GW) f(i + GW); };
    for (let pass = 0; pass < 3; pass++) {
      const seen = new Uint8Array(NC);
      const comps = regions.map(() => []);
      for (let i = 0; i < NC; i++) {
        if (rid[i] < 0 || seen[i]) continue;
        const r = rid[i], comp = [i]; seen[i] = 1;
        for (let q = 0; q < comp.length; q++) nb4(comp[q], (j) => { if (!seen[j] && rid[j] === r) { seen[j] = 1; comp.push(j); } });
        comps[r].push(comp);
      }
      let moved = 0;
      comps.forEach((list) => {
        if (list.length < 2) return;
        list.sort((a, b) => b.length - a.length);
        for (const comp of list.slice(1)) for (const c of comp) { let to = -1; nb4(c, (j) => { if (rid[j] >= 0 && rid[j] !== rid[c] && to < 0) to = rid[j]; }); if (to >= 0) { rid[c] = to; moved++; } }
      });
      if (!moved) break;
    }

    // ── 3. 해역: 바다 칸을 14개 구역으로 (최원점 표본) ──
    const sea = new Int8Array(NC).fill(-1);
    const seaCells = []; for (let i = 0; i < NC; i++) if (cont[i] < 0) seaCells.push(i);
    const seaSites = [seaCells[(R() * seaCells.length) | 0]];
    const dmin = new Float64Array(seaCells.length).fill(Infinity);
    while (seaSites.length < 14) {
      const s = seaSites[seaSites.length - 1]; let bi = 0, bd = -1;
      for (let k = 0; k < seaCells.length; k++) { const c = seaCells[k]; const d = (cx(c) - cx(s)) ** 2 + (cy(c) - cy(s)) ** 2; if (d < dmin[k]) dmin[k] = d; if (dmin[k] > bd) { bd = dmin[k]; bi = k; } }
      seaSites.push(seaCells[bi]);
    }
    for (const c of seaCells) { let b = 0, bd = Infinity; seaSites.forEach((s, k) => { const d = (cx(c) - cx(s)) ** 2 + (cy(c) - cy(s)) ** 2; if (d < bd) { bd = d; b = k; } }); sea[c] = b; }
    const seas = seaSites.map((s, k) => ({ id: k, name: '', x: 0, y: 0, n: 0, nb: new Set(), coast: new Set() }));

    // ── 4. 인접 관계·중심점·해안 ──
    for (const r of regions) Object.assign(r, { sx: 0, sy: 0, area: 0, nbS: new Set(), seaS: new Set() });
    for (let i = 0; i < NC; i++) {
      const r = rid[i];
      if (r >= 0) { const g = regions[r]; g.sx += cx(i); g.sy += cy(i); g.area++; nb4(i, (j) => { if (rid[j] >= 0 && rid[j] !== r) g.nbS.add(rid[j]); else if (sea[j] >= 0) { g.seaS.add(sea[j]); seas[sea[j]].coast.add(r); } }); }
      else if (sea[i] >= 0) { const z = seas[sea[i]]; z.x += cx(i); z.y += cy(i); z.n++; nb4(i, (j) => { if (sea[j] >= 0 && sea[j] !== sea[i]) z.nb.add(sea[j]); }); }
    }
    for (const r of regions) {
      const mx = r.sx / r.area, my = r.sy / r.area;
      // 라벨 위치: 중심에 가장 가까운 자기 칸 (오목한 모양에서도 영역 안)
      let best = -1, bd = Infinity; for (let i = 0; i < NC; i++) if (rid[i] === r.id) { const d = (cx(i) - mx) ** 2 + (cy(i) - my) ** 2; if (d < bd) { bd = d; best = i; } }
      r.x = cx(best); r.y = cy(best);
      r.nb = [...r.nbS].sort((a, b) => a - b); r.seas = [...r.seaS].sort((a, b) => a - b); r.coastal = r.seas.length > 0;
      delete r.sx; delete r.sy; delete r.nbS; delete r.seaS;
    }
    for (const z of seas) { z.x = z.n ? z.x / z.n : 0; z.y = z.n ? z.y / z.n : 0; z.nb = [...z.nb].sort((a, b) => a - b); z.coast = [...z.coast].sort((a, b) => a - b); delete z.n; }

    // ── 5. 지형·자원·인구 ──
    const TERR_W = {
      occ: { plains: 4, forest: 3, hills: 2, mountains: 1.5, swamp: 1 },
      bor: { tundra: 3, forest: 3, mountains: 2, hills: 2, plains: 2 },
      aus: { plains: 3, desert: 3, hills: 2, swamp: 1.5, forest: 1 },
      ori: { plains: 3, forest: 2, hills: 2, mountains: 2, swamp: 2, desert: 1 },
    };
    const SPECIAL = ['gold', 'iron', 'coal', 'horses', 'mana', 'stone', 'wood', 'food'];
    const usedNames = new Set();
    const S = W4.SYL;
    const nameRoot = () => { for (;;) { const n = S.a[(R() * S.a.length) | 0] + S.b[(R() * S.b.length) | 0] + (R() < 0.55 ? S.c[(R() * S.c.length) | 0] : ''); if (!usedNames.has(n)) { usedNames.add(n); return n; } } };
    for (const r of regions) {
      const K = W4.CONTINENTS[r.cont];
      let t = pickW(TERR_W[K.id]);
      if (r.coastal && t !== 'mountains' && R() < 0.35) t = 'coast';
      r.terrain = t;
      const T = W4.TERRAIN[t];
      r.prod = Object.assign({}, T.prod);
      if (R() < 0.35) { const sp = SPECIAL[(R() * SPECIAL.length) | 0]; r.prod[sp] = (r.prod[sp] || 0) + 3; r.special = sp; }
      r.pop = Math.round((({ plains: 90, coast: 100, forest: 55, hills: 50, mountains: 30, desert: 30, swamp: 35, tundra: 25 })[t] * (0.7 + R() * 0.6)) * (r.area / 50));
      r.dev = 1 + ((R() * 3) | 0);
      r.fort = t === 'mountains' ? 1 : 0;
      r.root = nameRoot();
      r.name = r.root + ' ' + ({ plains: '평원', coast: '해안', forest: '숲', hills: '구릉', mountains: '산맥', desert: '사막', swamp: '늪지', tundra: '설원' })[t];
      r.owner = 'neutral'; r.city = null; r.port = false;
    }
    seas.forEach((z) => { z.name = nameRoot() + ' 해'; });

    // ── 6. 국가 영토: 대륙별 4개 수도(최원점) → 차례로 확장 (국가당 7) ──
    const nations = {};
    W4.CONTINENTS.forEach((K, ci) => {
      const rs = regions.filter(r => r.cont === ci), NS = W4.NATIONS.filter(n => n.cont === K.id);
      const caps = [rs[(R() * rs.length) | 0]];
      while (caps.length < NS.length) {
        let best = null, bd = -1;
        for (const r of rs) { const d = Math.min(...caps.map(c => (c.x - r.x) ** 2 + (c.y - r.y) ** 2)); if (d > bd) { bd = d; best = r; } }
        caps.push(best);
      }
      // 첫 수도도 다른 수도들과 최대한 떨어지도록 다시 고른다
      { let best = null, bd = -1; for (const r of rs) { const d = Math.min(...caps.slice(1).map(c => (c.x - r.x) ** 2 + (c.y - r.y) ** 2)); if (d > bd) { bd = d; best = r; } } caps[0] = best; }
      NS.forEach((n, k) => { const cap = caps[k]; cap.owner = n.id; nations[n.id] = { capital: cap.id, regions: [cap.id] }; });
      let grew = true;
      while (grew) {
        grew = false;
        for (let k = 0; k < NS.length; k++) {
          const n = NS[k], st = nations[n.id]; if (st.regions.length >= 7) continue;
          const cap = regions[st.capital];
          let best = null, bd = Infinity;
          for (const id of st.regions) for (const j of regions[id].nb) { const r = regions[j]; if (r.owner !== 'neutral' || r.cont !== ci) continue; const d = (r.x - cap.x) ** 2 + (r.y - cap.y) ** 2; if (d < bd) { bd = d; best = r; } }
          if (best) { best.owner = n.id; st.regions.push(best.id); grew = true; }
        }
      }
      // 균형: 갇혀서 6개 미만인 국가는 이웃 국가의 접경 지역을 넘겨받는다 (이웃의 연결·수도 유지)
      const linked = (ids) => { if (!ids.length) return true; const set = new Set(ids), seen = new Set([ids[0]]), q = [ids[0]]; while (q.length) { const x = q.pop(); for (const y of regions[x].nb) if (set.has(y) && !seen.has(y)) { seen.add(y); q.push(y); } } return seen.size === set.size; };
      for (let guard = 0; guard < 40; guard++) {
        const poor = NS.find(n => nations[n.id].regions.length < 7 && NS.some(m => m !== n && nations[m.id].regions.length > 6));
        if (!poor) break;
        const st = nations[poor.id]; let moved = false;
        for (const id of st.regions) {
          for (const j of regions[id].nb) {
            const r = regions[j], owner = r.owner; if (owner === poor.id || owner === 'neutral' || r.cont !== ci) continue;
            const ost = nations[owner]; if (ost.regions.length <= 6 || ost.capital === j) continue;
            const rest = ost.regions.filter(x => x !== j); if (!linked(rest)) continue;
            r.owner = poor.id; ost.regions = rest; st.regions.push(j); moved = true; break;
          }
          if (moved) break;
        }
        if (!moved) break;
      }
    });
    for (const r of regions) r.core = r.owner;          // 본토(핵심 영토) 소유자

    // ── 7. 도시 40 (수도 16 + 대륙별 6) · 요새 · 항구 ──
    for (const [nid, st] of Object.entries(nations)) { const r = regions[st.capital]; r.city = { name: r.root, capital: true }; r.fort = 3; r.dev = 5; r.pop = Math.round(r.pop * 1.8); }
    W4.CONTINENTS.forEach((K, ci) => {
      const cand = regions.filter(r => r.cont === ci && !r.city).sort((a, b) => (b.pop + b.dev * 30) - (a.pop + a.dev * 30));
      let n = 0;
      for (const r of cand) {
        if (n >= 6) break;
        if (r.nb.some(j => regions[j].city)) continue;
        r.city = { name: r.root, capital: false }; r.fort = Math.max(r.fort, 2); r.dev = Math.max(r.dev, 3); r.pop = Math.round(r.pop * 1.3); n++;
      }
      for (const r of cand) { if (n >= 6) break; if (!r.city) { r.city = { name: r.root, capital: false }; r.fort = Math.max(r.fort, 2); r.dev = Math.max(r.dev, 3); n++; } }
    });
    for (const r of regions) if (r.coastal && r.city) r.port = true;
    for (const st of Object.values(nations)) {
      const coast = st.regions.map(id => regions[id]).filter(r => r.coastal);
      if (coast.length && !coast.some(r => r.port)) coast.sort((a, b) => b.pop - a.pop)[0].port = true;
    }
    W4.CONTINENTS.forEach((K, ci) => {
      const ports = regions.filter(r => r.cont === ci && r.port);
      const extra = regions.filter(r => r.cont === ci && r.coastal && !r.port).sort((a, b) => b.pop - a.pop);
      while (ports.length < 3 && extra.length) { const r = extra.shift(); r.port = true; ports.push(r); }
    });

    return { seed, gw: GW, gh: GH, cell: C, rid, sea, regions, seas, nations };
  };

  // 지도에서 초기 동적 상태 (Phase 3 의 세계 모델이 확장)
  W4.baseState = (map) => ({ regions: map.regions.map(r => ({ owner: r.owner, occ: null, fort: r.fort, dev: r.dev, pop: r.pop })), seas: map.seas.map(() => ({ blockade: null })) });

  // 지도 좌표 → 지역 id (-1: 바다)
  W4.regionAt = (map, x, y) => { const c = (x / map.cell) | 0, r = (y / map.cell) | 0; if (c < 0 || r < 0 || c >= map.gw || r >= map.gh) return -1; return map.rid[c + r * map.gw]; };
  W4.seaAt = (map, x, y) => { const c = (x / map.cell) | 0, r = (y / map.cell) | 0; if (c < 0 || r < 0 || c >= map.gw || r >= map.gh) return -1; return map.sea[c + r * map.gw]; };

  // 지역 그래프 최단 경로 (이동 비용 = 지형 이동 비용, 통행 가능 여부 함수)
  W4.path = (map, from, to, can = () => true) => {
    if (from === to) return [from];
    const n = map.regions.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1, bd = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = 1;
      for (const v of map.regions[u].nb) { if (done[v] || (v !== to && !can(v))) continue; const d = bd + W4.TERRAIN[map.regions[v].terrain].move; if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
    }
    if (dist[to] === Infinity) return null;
    const out = [to]; while (out[0] !== from) out.unshift(prev[out[0]]);
    return out;
  };
})();
