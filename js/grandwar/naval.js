// ─────────────────────────────────────────────
// 4.0 해상 전쟁 — 항구 · 함대(전투선·수송선·보급선) · 해역 이동 · 해전 · 봉쇄 · 상륙 · 해상 보급
//   함대는 해역(바다 구역) 그래프를 이동한다. 항구 지역에 정박하면 port 가 그 지역.
//   봉쇄: 전쟁 상대의 항구와 맞닿은 해역에 전투선 2척 이상 → 그 항구의 교역 수입 0, 해상 보급 차단
//   상륙: 수송선 1척당 5개 대대. 정박한 항구에서 승선 → 해역 이동 → 맞닿은 해안 지역에 상륙 (사기 하락)
//   보급선: 해안 지역의 아군 군단에게 해상 보급 (적지에서도 보급 감소를 막음)
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo, War = W4.War, A = W4.Army;
  W4.SHIPS = {
    war: { name: '전투선', icon: '⛵', cost: { gold: 80, wood: 40, iron: 10 }, atk: 3, upkeep: 0.8 },
    trans: { name: '수송선', icon: '🚢', cost: { gold: 40, wood: 30 }, atk: 0.3, upkeep: 0.3, cap: 5 },
    sup: { name: '보급선', icon: '📦', cost: { gold: 50, wood: 25 }, atk: 0.5, upkeep: 0.4 },
  };
  const SK = Object.keys(W4.SHIPS);
  const N = W4.Naval = {};
  N.size = (f) => SK.reduce((s, k) => s + (f.s[k] || 0), 0);
  N.list = (w, id) => w.fleets.filter(f => f.owner === id);
  N.inSea = (w, z) => w.fleets.filter(f => f.sea === z);
  N.power = (w, f) => { const M = w.nations[f.owner].mods || {}; return SK.reduce((s, k) => s + (f.s[k] || 0) * W4.SHIPS[k].atk, 0) * (1 + (M.naval || 0)) * (0.5 + 0.5 * f.morale); };
  N.carried = (w, f) => w.armies.filter(a => a.onFleet === f.id);
  N.capacity = (f) => (f.s.trans || 0) * W4.SHIPS.trans.cap;
  N.load = (w, f) => N.carried(w, f).reduce((s, a) => s + A.size(a), 0);
  const seaPath = (w, from, to) => {
    if (from === to) return [from];
    const prev = new Map([[from, -1]]), q = [from];
    for (let k = 0; k < q.length; k++) { const u = q[k]; for (const v of w.map.seas[u].nb) if (!prev.has(v)) { prev.set(v, u); if (v === to) { const out = [to]; while (out[0] !== from) out.unshift(prev.get(out[0])); return out; } q.push(v); } }
    return null;
  };
  N.seaPath = seaPath;

  // ── 건조 ──
  W4.Act = W4.Act || {};
  W4.Act.buildShip = (w, id, i, type, n = 1) => {
    const Nt = w.nations[id], s = w.state.regions[i], r = w.map.regions[i], S = W4.SHIPS[type];
    if (!S) return { ok: false, msg: '알 수 없는 함선' };
    if (s.owner !== id || s.occ) return { ok: false, msg: '자국 지역이 아닙니다' };
    if (!r.port && !(s.bld && s.bld.shipyard)) return { ok: false, msg: '항구나 조선소가 있는 지역에서만 건조' };
    if (!r.seas.length) return { ok: false, msg: '바다와 닿아 있지 않습니다' };
    const red = 1 - ((Nt.mods || {}).shipCost || 0), cost = {}; for (const k in S.cost) cost[k] = Math.round(S.cost[k] * n * red);
    for (const k in cost) if ((Nt.res[k] || 0) < cost[k]) return { ok: false, msg: `${W4.RES[k].name} 부족` };
    for (const k in cost) Nt.res[k] -= cost[k];
    let f = w.fleets.find(x => x.owner === id && x.port === i && x.mode !== 'move');
    if (!f) { f = { id: (w.fleetSeq = (w.fleetSeq || 0) + 1), owner: id, sea: r.seas[0], port: i, s: { war: 0, trans: 0, sup: 0 }, path: [], mode: 'idle', morale: 1, prog: 0 }; f.name = `제${N.list(w, id).length + 1}함대`; w.fleets.push(f); }
    f.s[type] += n;
    return { ok: true, fleet: f };
  };
  W4.Act.moveFleet = (w, id, fid, sea, dockAt = null) => {
    const f = w.fleets.find(x => x.id === fid && x.owner === id); if (!f) return { ok: false, msg: '함대 없음' };
    const p = seaPath(w, f.sea, sea); if (!p) return { ok: false, msg: '갈 수 없는 해역' };
    f.path = p.slice(1); f.mode = f.path.length ? 'move' : 'idle'; f.port = null; f.dock = dockAt; f.prog = 0;
    if (!f.path.length && dockAt !== null) f.port = dockAt;
    return { ok: true, path: p };
  };
  // 항구로 귀항 (해당 항구의 해역으로 이동 후 정박)
  W4.Act.dock = (w, id, fid, i) => {
    const r = w.map.regions[i], s = w.state.regions[i];
    if (!(r.port || (s.bld && s.bld.shipyard)) || (s.occ || s.owner) !== id && !D.has(w, 'access', s.owner, id) && !D.has(w, 'alliance', id, s.owner)) return { ok: false, msg: '정박할 수 없는 항구' };
    const f = w.fleets.find(x => x.id === fid && x.owner === id); if (!f) return { ok: false };
    const best = r.seas.slice().sort((a, b) => (seaPath(w, f.sea, a) || []).length - (seaPath(w, f.sea, b) || []).length)[0];
    return W4.Act.moveFleet(w, id, fid, best, i);
  };
  W4.Act.embark = (w, id, armyId, fid) => {
    const a = w.armies.find(x => x.id === armyId && x.owner === id), f = w.fleets.find(x => x.id === fid && x.owner === id);
    if (!a || !f) return { ok: false, msg: '군단·함대 없음' };
    if (a.onFleet) return { ok: false, msg: '이미 승선' };
    if (f.port !== a.loc) return { ok: false, msg: '군단이 있는 항구에 함대가 정박해 있어야 합니다' };
    if (N.load(w, f) + A.size(a) > N.capacity(f) + 1e-6) return { ok: false, msg: `수송 능력 부족 (${N.capacity(f)}개 대대까지)` };
    a.onFleet = f.id; a.path = []; a.mode = 'idle'; a.siege = 0;
    return { ok: true };
  };
  W4.Act.land = (w, id, fid, i) => {
    const f = w.fleets.find(x => x.id === fid && x.owner === id); if (!f) return { ok: false, msg: '함대 없음' };
    const r = w.map.regions[i];
    if (!r.seas.includes(f.sea)) return { ok: false, msg: '함대가 있는 해역과 맞닿은 해안이 아닙니다' };
    if (f.mode === 'move') return { ok: false, msg: '이동 중에는 상륙할 수 없습니다' };
    const list = N.carried(w, f); if (!list.length) return { ok: false, msg: '승선한 군단이 없습니다' };
    if (!A.canEnter(w, id, i)) return { ok: false, msg: '상륙할 수 없는 지역 (통행권·전쟁 필요)' };
    const pen = 0.3 * (1 - ((w.nations[id].mods || {}).landing || 0));
    for (const a of list) { a.onFleet = null; a.loc = i; a.morale = Math.max(0.2, a.morale - pen); a.landed = true; }
    w.event(`${w.def(id).name}: ${r.name} 상륙 (${list.reduce((s, a) => s + A.size(a), 0).toFixed(1)}k)`, 'war', id, { region: i });
    return { ok: true };
  };
  // 상륙 이동 편의: 수송선이 있는 함대로 군단을 목표 해안까지 (AI·UI 공용)
  N.planInvasion = (w, id, a, f, target) => {
    const r = w.map.regions[target]; const z = r.seas[0]; return W4.Act.moveFleet(w, id, f.id, z);
  };

  // 봉쇄된 항구인가 (economy 의 교역 수입 · 해상 보급)
  W4.isBlockaded = (w, i) => {
    const r = w.map.regions[i]; if (!r.coastal || !w.fleets) return false;
    const owner = w.controller(i);
    for (const z of r.seas) { const st = w.state.seas[z]; if (st && st.blockade && War.atWar(w, st.blockade, owner)) return true; }
    return false;
  };

  // ── 일 단위: 이동 → 해전 → 봉쇄 갱신 ──
  function day(w) {
    for (const f of w.fleets) {
      if (f.mode !== 'move' || !f.path.length) continue;
      f.prog += 1.5 + ((w.nations[f.owner].mods || {}).fleetMove || 0) * 0.5;
      while (f.prog >= 1 && f.path.length) { f.prog -= 1; f.sea = f.path.shift(); if (N.inSea(w, f.sea).some(o => o.owner !== f.owner && War.atWar(w, f.owner, o.owner))) { f.path = []; break; } }
      if (!f.path.length) { f.mode = 'idle'; f.prog = 0; if (f.dock !== null && f.dock !== undefined) { f.port = f.dock; f.dock = null; } }
    }
    // 해전
    const zones = new Set(w.fleets.map(f => f.sea));
    for (const z of zones) {
      const here = N.inSea(w, z); if (here.length < 2) continue;
      const owners = [...new Set(here.map(f => f.owner))];
      let pair = null; for (let x = 0; x < owners.length && !pair; x++) for (let y = x + 1; y < owners.length; y++) if (War.atWar(w, owners[x], owners[y])) { pair = [owners[x], owners[y]]; break; }
      if (!pair) continue;
      const war = War.of(w, pair[0], pair[1]), sideA = War.side(war, pair[0]);
      const S = [here.filter(f => War.side(war, f.owner) === sideA), here.filter(f => War.side(war, f.owner) && War.side(war, f.owner) !== sideA)];
      seaBattle(w, z, S[0], S[1]);
    }
    // 봉쇄 갱신
    const prev = w.state.seas.map(s => s.blockade);
    for (let z = 0; z < w.map.seas.length; z++) w.state.seas[z].blockade = null;
    for (const f of w.fleets) {
      if ((f.s.war || 0) < 2 || f.mode === 'move') continue;
      const enemyPorts = w.map.seas[f.sea].coast.filter(i => (w.map.regions[i].port || (w.state.regions[i].bld && w.state.regions[i].bld.shipyard)) && War.atWar(w, f.owner, w.controller(i)));
      if (enemyPorts.length) w.state.seas[f.sea].blockade = f.owner;
    }
    if (w.state.seas.some((s, z) => s.blockade !== prev[z])) w.seaDirty = true;
  }
  function seaBattle(w, z, A1, B1) {
    const P = (L) => L.reduce((s, f) => s + N.power(w, f), 0) * (0.85 + w.rand() * 0.3);
    let pa = P(A1), pb = P(B1);
    const s0 = [A1.reduce((s, f) => s + N.size(f), 0), B1.reduce((s, f) => s + N.size(f), 0)];
    const winA = pa >= pb, W = winA ? A1 : B1, L = winA ? B1 : A1;
    const lossW = Math.min(0.5, (winA ? pb / pa : pa / pb) * 0.25), lossL = Math.min(0.8, 0.3 + (winA ? pa / Math.max(1, pb) : pb / Math.max(1, pa)) * 0.15);
    const sink = (f, k) => {
      const before = f.s.trans || 0;
      for (const t of SK) f.s[t] = Math.max(0, Math.round(f.s[t] * (1 - k) * 100) / 100);
      // 수송선이 가라앉으면 승선한 병력도 같은 비율로 잃는다
      if (before > 0) { const kk = (f.s.trans || 0) / before; for (const a of N.carried(w, f)) for (const c in a.u) a.u[c] *= kk; }
    };
    for (const f of W) { sink(f, lossW); f.morale = Math.max(0.3, f.morale - 0.1); }
    for (const f of L) {
      sink(f, lossL); f.morale = Math.max(0.1, f.morale - 0.4);
      // 패배 함대: 가장 가까운 자국 항구 쪽 인접 해역으로 후퇴
      const nb = w.map.seas[z].nb; if (nb.length) { f.sea = nb[(w.rand() * nb.length) | 0]; f.path = []; f.mode = 'idle'; f.port = null; }
    }
    const wo = W[0].owner, lo = L[0].owner;
    w.event(`🌊 ${w.map.seas[z].name} 해전: ${w.def(wo).name} 승리 (${(winA ? s0[0] : s0[1]).toFixed(0)}척 vs ${(winA ? s0[1] : s0[0]).toFixed(0)}척)`, 'battle', wo, { other: lo, sea: z, naval: true });
    const war = War.of(w, wo, lo); if (war) { const sign = War.side(war, wo) === 'att' ? 1 : -1; war.battle = Math.max(-40, Math.min(40, war.battle + sign * 3)); }
    // 빈 함대 제거 (승선 군단은 함께 소멸)
    for (const f of w.fleets.slice()) if (N.size(f) < 0.5) { for (const a of N.carried(w, f)) w.armies.splice(w.armies.indexOf(a), 1); w.fleets.splice(w.fleets.indexOf(f), 1); }
    for (const a of w.armies.slice()) for (const c in a.u) if (!Number.isFinite(a.u[c])) a.u[c] = 0;
  }
  N.seaBattle = seaBattle;

  // ── 월 단위: 유지비 · 해상 보급 · 승선 군단 위치 ──
  function month(w) {
    for (const f of w.fleets) {
      const Nt = w.nations[f.owner], M = Nt.mods || {};
      let up = 0; for (const k of SK) up += (f.s[k] || 0) * W4.SHIPS[k].upkeep;
      Nt.spentNext.gold = (Nt.spentNext.gold || 0) + up * (1 - (M.navUpkeep || 0));
      if (f.port !== null && f.port !== undefined) f.morale = Math.min(1, f.morale + 0.2);
      // 보급선: 맞닿은 해안 지역의 아군 군단 보급 회복 (봉쇄되지 않은 해역)
      if ((f.s.sup || 0) >= 1 && !(w.state.seas[f.sea].blockade && War.atWar(w, w.state.seas[f.sea].blockade, f.owner)))
        for (const i of w.map.seas[f.sea].coast) for (const a of A.at(w, i)) if (a.owner === f.owner || D.has(w, 'alliance', a.owner, f.owner)) a.supply = Math.min(1, a.supply + 0.15 * Math.min(2, f.s.sup));
    }
    // 승선 중인 군단은 지도에서 함대와 함께 (loc 는 출발 항구로 유지하되 교전·공성 제외)
  }
  // 승선 군단은 육상 전투·공성·이동에서 빠진다
  const origAt = A.at; A.at = (w, i) => origAt(w, i).filter(a => !a.onFleet);
  W4.system({
    id: 'naval', order: 46,
    init(w) { w.fleets = []; w.fleetSeq = 0; for (const s of w.state.seas) s.blockade = null; },
    save(w, o) { o.fleets = w.fleets; o.fleetSeq = w.fleetSeq; },
    load(w, o) { w.fleets = o.fleets || []; w.fleetSeq = o.fleetSeq || 0; },
    day(w) { day(w); },
    month(w) { month(w); },
  });

  // ── 해군 AI (군사 AI 의 일부: 해군 건조·봉쇄·상륙) ──
  N.ai = (w, id) => {
    const Nt = w.nations[id], d = w.def(id), ports = w.ownedRegions(id).filter(i => !w.state.regions[i].occ && (w.map.regions[i].port || w.state.regions[i].bld.shipyard) && w.map.regions[i].seas.length);
    if (!ports.length) return;
    const enemies = War.enemies(w, id);
    const myCont = w.map.regions[w.map.nations[id].capital].cont;
    const overseas = enemies.filter(e => w.ownedRegions(e).length && !w.ownedRegions(e).some(i => w.map.regions[i].cont === myCont));
    const fleets = N.list(w, id), war = fleets.reduce((s, f) => s + f.s.war, 0), trans = fleets.reduce((s, f) => s + f.s.trans, 0);
    const wantWar = (d.traits.includes('seafarers') ? 6 : 2) + (enemies.length ? 2 : 0) + (overseas.length ? 3 : 0);
    const reserve = enemies.length ? 60 : 200;
    if (war < wantWar && Nt.res.gold > reserve + 80 && Nt.res.wood > 40) W4.Act.buildShip(w, id, ports[0], 'war', 1);
    // 해외 전쟁: 수송선 확보 → 가장 큰 군단을 항구에서 승선 → 적 해안에 상륙
    if (overseas.length) {
      const army = A.list(w, id).filter(a => !a.onFleet).sort((a, b) => A.size(b) - A.size(a))[0];
      const need = army ? Math.ceil(A.size(army) / W4.SHIPS.trans.cap) : 0;
      if (army && trans < need && Nt.res.gold > 60 && Nt.res.wood > 30) W4.Act.buildShip(w, id, ports[0], 'trans', 1);
      const tf = fleets.find(f => f.s.trans >= 1);
      if (army && tf) {
        const carried = N.carried(w, tf);
        if (!carried.length) {
          if (tf.port === army.loc) { if (N.capacity(tf) >= A.size(army)) W4.Act.embark(w, id, army.id, tf.id); }
          else if (ports.includes(army.loc)) { if (tf.mode !== 'move') W4.Act.dock(w, id, tf.id, army.loc); }
          else if (army.mode !== 'move') W4.Act.move(w, id, army.id, ports[0]);
        } else if (tf.mode !== 'move') {
          // 상륙 지점: 적 해안 지역 중 수비가 약한 곳
          const targets = []; for (const e of overseas) for (const i of w.ownedRegions(e)) if (w.map.regions[i].coastal) targets.push(i);
          targets.sort((a, b) => A.at(w, a).length - A.at(w, b).length || (w.state.regions[a].fort || 0) - (w.state.regions[b].fort || 0) || a - b);
          const t = targets[0];
          if (t !== undefined) { if (w.map.regions[t].seas.includes(tf.sea)) W4.Act.land(w, id, tf.id, t); else W4.Act.moveFleet(w, id, tf.id, w.map.regions[t].seas[0]); }
        }
      }
    }
    // 전투 함대: 적 항구 봉쇄 또는 약한 적 함대 공격
    for (const f of fleets.filter(f => f.s.war >= 2 && !N.carried(w, f).length)) {
      if (f.mode === 'move') continue;
      if (!enemies.length) { if (f.port === null && ports.length) W4.Act.dock(w, id, f.id, ports[0]); continue; }
      const ef = w.fleets.filter(o => enemies.includes(o.owner) && N.power(w, o) < N.power(w, f) * 0.9).sort((a, b) => (seaPath(w, f.sea, a.sea) || []).length - (seaPath(w, f.sea, b.sea) || []).length)[0];
      if (ef) { W4.Act.moveFleet(w, id, f.id, ef.sea); continue; }
      const ep = []; for (const e of enemies) for (const i of w.ownedRegions(e)) if (w.map.regions[i].port) ep.push(i);
      if (ep.length) { const z = w.map.regions[ep[0]].seas[0]; if (f.sea !== z) W4.Act.moveFleet(w, id, f.id, z); }
    }
  };
  W4.system({ id: 'navalAI', order: 48, month(w) { for (const n of W4.NATIONS) if (n.id !== w.player && w.nations[n.id].alive) N.ai(w, n.id); } });
})();
