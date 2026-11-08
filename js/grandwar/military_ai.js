// ─────────────────────────────────────────────
// 4.0 군사 AI (전선·군단 운용) + 국가 AI 의 전쟁·평화 판단
//   국가 AI(nations/ai.js) → 무엇과 싸울지 / 군사 AI(이 파일) → 군단을 어디로 / 전술 AI(war/tactics.js) → 실제 전투
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo, War = W4.War, A = W4.Army;
  const CLS = Object.keys(W4.UNIT_CLASSES);

  // ── 모집 ──
  function mix(w, id) {
    const d = w.def(id), m = { inf: 0.45, arc: 0.25, cav: 0.15, sie: 0.05, mag: 0.1 };
    if (d.traits.includes('horselords')) { m.cav = 0.3; m.inf = 0.35; }
    if (d.fam.includes('pentagon') || d.fam.includes('hexagon')) { m.mag = 0.2; m.arc = 0.2; }
    if (!d.fam.includes('pentagon') && !d.fam.includes('hexagon')) m.mag = 0.03;
    if (War.inWar(w, id)) m.sie += 0.08;
    return m;
  }
  function recruit(w, id) {
    const N = w.nations[id], P = W4.AI_PROFILE[w.def(id).ai];
    const army = A.list(w, id).reduce((s, a) => s + A.size(a), 0);
    const atWar = War.inWar(w, id);
    const target = N.manpowerMax * (atWar ? 0.7 : 0.3) * P.war + 6;
    // 식량: 기근이면 군대를 줄이고, 식량 순수입이 부족하면 모집하지 않는다
    const foodNet = (N.income.food || 0) - (N.spent.food || 0);
    if (N.famine || N.res.food < 30) { const big = A.list(w, id).sort((a, b) => A.size(b) - A.size(a))[0]; if (big && A.size(big) > 3) { for (const c of CLS) big.u[c] *= 0.85; N.manpower += A.size(big) * 0.15 * 0.5; } return; }
    if (army >= target || foodNet < 1.5) return;
    // 모집 장소: 전쟁 중이면 전선에 가까운 도시, 아니면 수도
    const cand = w.ownedRegions(id).filter(i => !w.state.regions[i].occ && (W4.cityOf(w, i) || w.state.regions[i].bld.barracks));
    if (!cand.length) return;
    const enemies = War.enemies(w, id);
    const near = (i) => enemies.length ? Math.min(...w.map.regions[i].nb.map(j => (enemies.includes(w.controller(j)) ? 0 : 1))) : 1;
    cand.sort((a, b) => near(a) - near(b) || a - b);
    const where = cand[0], m = mix(w, id);
    const reserve = atWar ? 40 : 150;
    for (let k = 0; k < 8 && army < target; k++) {
      // 가장 부족한 병과
      const cur = A.at(w, where).filter(a => a.owner === id).reduce((o, a) => { for (const c of CLS) o[c] += a.u[c]; return o; }, { inf: 0, arc: 0, cav: 0, sie: 0, mag: 0 });
      const tot = CLS.reduce((s, c) => s + cur[c], 0) + 1;
      const cls = CLS.slice().sort((a, b) => (cur[a] / tot - m[a]) - (cur[b] / tot - m[b]))[0];
      const cost = A.recruitCost(w, id, cls, 1);
      if (N.res.gold - cost.gold < reserve) break;
      if (!W4.Act.recruit(w, id, where, cls, 1).ok) { if (!W4.Act.recruit(w, id, where, 'inf', 1).ok) break; }
    }
  }

  // ── 군단 운용 ──
  function enemyPowerNear(w, id, i, range = 1) {
    let p = 0; const regs = range ? [i, ...w.map.regions[i].nb] : [i];
    for (const j of regs) for (const b of A.at(w, j)) if (War.atWar(w, id, b.owner)) p += A.power(w, b);
    return p;
  }
  function orders(w, id) {
    const armies = A.list(w, id).filter(a => a.train <= 0 && !a.onFleet);
    if (!armies.length) return;
    // 같은 지역 군단 합치기
    for (const a of armies) for (const b of armies) if (a !== b && a.loc === b.loc && w.armies.includes(a) && w.armies.includes(b) && a.mode !== 'move' && b.mode !== 'move') W4.Act.merge(w, id, a.id, b.id);
    const mine = A.list(w, id).filter(a => a.train <= 0 && !a.onFleet);
    const enemies = War.enemies(w, id);
    const cap = w.map.nations[id].capital;
    if (!enemies.length) {
      // 평시: 중립 영지 병합 (건설형 제외 · 확률), 아니면 수도·접경 대기
      const P = W4.AI_PROFILE[w.def(id).ai];
      for (const a of mine) {
        if (a.mode === 'move' || a.mode === 'siege') continue;
        const neutral = new Set(); for (const i of w.ownedRegions(id)) for (const j of w.map.regions[i].nb) if (w.state.regions[j].owner === 'neutral') neutral.add(j);
        if (neutral.size && A.size(a) >= 6 && w.rand() < 0.35 * P.war) { const t = [...neutral].sort((x, y) => w.state.regions[x].fort - w.state.regions[y].fort || x - y)[0]; W4.Act.move(w, id, a.id, t); continue; }
        if (a.loc !== cap && w.rand() < 0.3 && !hostileHere(w, a)) W4.Act.move(w, id, a.id, cap);
      }
      return;
    }
    // 전시: 목표 지역 점수
    const goals = new Set(w.wars.filter(x => War.side(x, id)).map(x => x.goal).filter(g => g !== null && g !== undefined));
    const targets = [];
    for (let i = 0; i < w.state.regions.length; i++) {
      const s = w.state.regions[i], c = s.occ || s.owner;
      if (enemies.includes(c) && A.canEnter(w, id, i)) targets.push({ i, v: War.regionCost(w, i) + (goals.has(i) ? 12 : 0) + (w.map.regions[i].city && w.map.regions[i].city.capital ? 6 : 0) });
      else if (s.owner === id && s.occ && enemies.includes(s.occ)) targets.push({ i, v: War.regionCost(w, i) + 10 });
    }
    // 수도 방어: 적 군단이 수도 근처면 가장 가까운 군단 귀환
    const capThreat = enemyPowerNear(w, id, cap, 1);
    const taken = new Map();
    const sorted = mine.slice().sort((a, b) => A.power(w, b) - A.power(w, a));
    for (const a of sorted) {
      const myP = A.power(w, a);
      const hop = W4.hops(w.map, a.loc, (i) => A.canEnter(w, id, i));
      if (a.morale < 0.35 || A.size(a) < 1.5) { if (a.loc !== cap) W4.Act.move(w, id, a.id, nearestSafe(w, id, a.loc)); continue; }       // 회복
      if (capThreat > 0 && !A.at(w, cap).some(b => b.owner === id) && a === sorted[0] && myP > capThreat * 0.7) { W4.Act.move(w, id, a.id, cap); continue; }
      // 근처 적 군단: 약하면 공격, 강하면 후퇴
      const here = enemyPowerNear(w, id, a.loc, 1);
      if (here > myP * 1.6) { W4.Act.move(w, id, a.id, nearestSafe(w, id, a.loc)); continue; }
      if (a.mode === 'siege' && enemyPowerNear(w, id, a.loc, 0) === 0) continue;   // 공성 계속
      let best = null, bs = -1e9;
      for (const t of targets) {
        const d = hop[t.i]; if (d >= 99) continue;
        const ep = enemyPowerNear(w, id, t.i, 0);
        if (ep > myP * 1.3) continue;
        const sc = t.v - d * 2.2 - ep / Math.max(1, myP) * 6 - (taken.get(t.i) || 0) * 8;
        if (sc > bs) { bs = sc; best = t.i; }
      }
      if (best !== null) { taken.set(best, (taken.get(best) || 0) + 1); if (a.loc !== best && (!a.path.length || a.path[a.path.length - 1] !== best)) W4.Act.move(w, id, a.id, best); }
    }
  }
  const hostileHere = (w, a) => A.hostile(w, a.owner, a.loc);
  function nearestSafe(w, id, from) {
    const mine = w.ownedRegions(id).filter(i => !w.state.regions[i].occ);
    let best = w.map.nations[id].capital, bd = 99;
    const hop = W4.hops(w.map, from, (i) => A.canEnter(w, id, i));
    for (const i of mine) { const d = hop[i]; if (d < bd || (d === bd && (w.state.regions[i].fort || 0) > (w.state.regions[best].fort || 0))) { bd = d; best = i; } }
    return best;
  }

  // ── 전쟁 판단 (국가 AI 훅) ──
  const sidePower = (w, id, vs) => {
    let p = W4.power(w, id);
    for (const a of D.allies(w, id)) if (!D.has(w, 'alliance', a, vs)) p += W4.power(w, a) * 0.6;
    for (const v of D.vassals(w, id)) p += W4.power(w, v) * 0.8;
    for (const t of w.diplo.treaties) { if (t.type === 'defense' && (t.a === id || t.b === id)) p += W4.power(w, t.a === id ? t.b : t.a) * 0.5; if (t.type === 'guarantee' && t.b === id) p += W4.power(w, t.a) * 0.5; }
    return p;
  };
  W4.NationAI.war = (w, id) => {
    const N = w.nations[id], d = w.def(id), P = W4.AI_PROFILE[d.ai];
    if (w.flags.noWar) return;                // 시나리오·시험용: AI 선전포고 없음
    // 평화 판단
    for (const war of w.wars.slice()) if (war.lead.includes(id)) peaceAI(w, war, id);
    if (War.inWar(w, id) && P.war < 1.3) return;
    if (N.stab < 40 || N.exhaustion > 25 || (N.ae || 0) > 45 || N.res.gold < 100) return;
    if (D.overlord(w, id)) {            // 종속국: 독립 전쟁 (종주국이 약해졌을 때)
      const lord = D.overlord(w, id);
      if (sidePower(w, id, lord) > W4.power(w, lord) * 1.2 && w.rand() < 0.05) W4.Act.declareWar(w, id, lord);
      return;
    }
    const myP = W4.power(w, id);
    const cands = D.neighbors(w, id).filter(o => War.canDeclare(w, id, o).ok);
    let best = null, bs = 0;
    for (const o of cands) {
      const ratio = myP / Math.max(1, sidePower(w, o, id));
      const cb = D.cbs(w, id, o).length > 0;
      const s = ratio * P.war * (cb ? 1.3 : 0.7) - D.rel(w, id, o) * 0.01;
      if (ratio > 1.35 && s > bs) { bs = s; best = o; }
    }
    if (!best) return;
    const cb = D.cbs(w, id, best).length > 0;
    const chance = cb ? 0.06 * P.war : d.ai === 'conqueror' ? 0.012 : 0;
    if (w.rand() < chance) W4.Act.declareWar(w, id, best);
  };
  function peaceAI(w, war, id) {
    const side = War.side(war, id), sc = side === 'att' ? war.score : -war.score, months = w.turn - war.start;
    const other = side === 'att' ? war.lead[1] : war.lead[0];
    const N = w.nations[id];
    if (sc >= 25 && (months >= 10 || sc >= 55)) {
      // 점령지 중 가치 높은 순서로, 수용 가능 범위까지
      const ours = side === 'att' ? war.att : war.def, theirs = side === 'att' ? war.def : war.att;
      const occ = []; w.state.regions.forEach((s, i) => { if (ours.includes(s.occ) && theirs.includes(s.owner)) occ.push(i); });
      occ.sort((a, b) => War.regionCost(w, b) - War.regionCost(w, a) || a - b);
      const terms = { cede: [], gold: 0 };
      for (const i of occ) { terms.cede.push(i); if (!War.acceptPeace(w, war, id, terms)) { terms.cede.pop(); } }
      if (!terms.cede.length) terms.gold = Math.min(300, Math.round(sc * 4));
      if (terms.cede.length || terms.gold) { const r = W4.Act.peace(w, war.id, id, terms); if (r.accepted || r.pending) return; }
    }
    if ((sc <= -45 || N.exhaustion > 75 || (months > 48 && Math.abs(sc) < 15)) && other !== w.player) {
      if (W4.Act.peace(w, war.id, id, { white: true }).accepted) return;
    }
    if ((sc <= -45 || N.exhaustion > 75) && other === w.player) W4.Act.peace(w, war.id, id, { white: true });   // 플레이어에게 백지 평화 제안
  }

  W4.system({
    id: 'militaryAI', order: 47,
    month(w) {
      for (const n of W4.NATIONS) { if (n.id === w.player || !w.nations[n.id].alive) continue; recruit(w, n.id); orders(w, n.id); }
    },
    day(w, d) {
      // 둘째 단계마다 전시 국가는 목표 재검토 (이동 중 상황 변화 대응)
      if (d !== 2) return;
      for (const n of W4.NATIONS) if (n.id !== w.player && w.nations[n.id].alive && War.inWar(w, n.id)) orders(w, n.id);
    },
  });
  W4.MilitaryAI = { recruit, orders };
})();
