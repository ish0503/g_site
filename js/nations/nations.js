// ─────────────────────────────────────────────
// 4.0 국가 · 경제 · 내정
//   자원 8종(식량·목재·철·석재·금·석탄·말·마력 결정) — 금은 국고.
//   지역 생산 × 개발도 × 건물 × 국가 수정자(정치 체제·특성·기술) × 불안 → 소유국 (점령 중이면 점령국이 절반)
//   세금(인구·개발도·세율), 항구 교역, 식량 소비, 인구 증가, 인력, 안정도, 건설·개발·도시 건설 대기열.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, clamp = W4.clamp;
  const RES = W4.RES_KEYS;
  W4.RES_VALUE = { gold: 1, food: 0.5, wood: 0.6, stone: 0.6, iron: 1, coal: 0.8, horses: 1.2, mana: 1.5 };

  W4.BUILDINGS = {
    farm: { name: '농장', icon: '🌾', cost: { gold: 60, wood: 20 }, time: 2, max: 3, fx: { food: 0.3 } },
    lumber: { name: '제재소', icon: '🪚', cost: { gold: 50, stone: 10 }, time: 2, max: 2, fx: { wood: 0.35 } },
    mine: { name: '광산', icon: '⛏️', cost: { gold: 80, wood: 30 }, time: 3, max: 3, fx: { iron: 0.3, coal: 0.3, stone: 0.3 } },
    market: { name: '시장', icon: '🏪', cost: { gold: 100, wood: 20, stone: 20 }, time: 3, max: 2, fx: { gold: 0.25, tax: 0.15 } },
    barracks: { name: '병영', icon: '⚔️', cost: { gold: 90, wood: 20, iron: 15 }, time: 3, max: 2, fx: { manpower: 0.4 } },
    fortress: { name: '요새', icon: '🏰', cost: { gold: 150, stone: 60 }, time: 4, max: 2, fx: { fort: 1 } },
    shipyard: { name: '조선소', icon: '⚓', cost: { gold: 120, wood: 50 }, time: 4, max: 2, coastal: true, fx: { trade: 0.15, naval: 1 } },
    academy: { name: '학술원', icon: '📜', cost: { gold: 140, stone: 30 }, time: 4, max: 1, fx: { research: 1.5 } },
    manawell: { name: '마력 샘', icon: '🔮', cost: { gold: 110, stone: 20 }, time: 3, max: 2, fx: { mana: 0.5 } },
    stable: { name: '마구간', icon: '🐎', cost: { gold: 70, wood: 30 }, time: 2, max: 2, fx: { horses: 0.5 } },
  };
  W4.TAX = { low: { name: '낮음', mul: 0.7, stab: 8 }, normal: { name: '보통', mul: 1, stab: 0 }, high: { name: '높음', mul: 1.35, stab: -12 } };

  // ── 국가 수정자 (정치 체제 + 특성 + 기술 + 시나리오 보정) ──
  W4.calcMods = (w, id) => {
    const d = w.def(id), n = w.nations[id], m = {};
    const add = (fx) => { for (const k in fx) m[k] = (m[k] || 0) + fx[k]; };
    const G = W4.GOVERNMENTS[n.gov || d.gov];
    add({ stab: G.stab || 0, tax: G.tax || 0, trade: G.trade || 0, research: G.research || 0, mil: G.mil || 0, mana: G.mana || 0, upkeep: G.upkeep || 0 });
    for (const t of d.traits) add(W4.TRAITS[t].fx);
    if (W4.techMods) add(W4.techMods(w, id));
    if (n.bonus) add(n.bonus);                 // 난이도·시나리오 보정
    n.mods = m;
    return m;
  };
  const mods = (w, id) => w.nations[id].mods || W4.calcMods(w, id);

  // ── 지역 생산 (월) ──
  W4.regionProd = (w, i, forId) => {
    const r = w.map.regions[i], s = w.state.regions[i];
    const who = forId || s.owner; if (who === 'neutral') return Object.assign({}, r.prod);
    const M = mods(w, who), B = s.bld || {};
    const out = {};
    const devK = 1 + 0.12 * (s.dev - 1), unrestK = 1 - (s.unrest || 0) / 200;
    for (const k in r.prod) {
      let bm = 0; for (const b in B) { const fx = W4.BUILDINGS[b].fx; if (fx[k]) bm += fx[k] * B[b]; }
      out[k] = r.prod[k] * devK * (1 + bm) * (1 + (M[k] || 0)) * unrestK;
    }
    return out;
  };
  W4.regionValue = (w, i) => { const p = W4.regionProd(w, i); let v = 0; for (const k in p) v += p[k] * W4.RES_VALUE[k]; return v + w.state.regions[i].pop / 100; };

  // ── 초기화 ──
  function initNation(w, id) {
    const n = w.nations[id], d = w.def(id);
    Object.assign(n, {
      gov: d.gov, res: { gold: 300, food: 150, wood: 80, iron: 40, stone: 60, coal: 20, horses: 20, mana: 20 },
      stab: 60, tax: 'normal', manpower: 0, manpowerMax: 0, exhaustion: 0, queue: [], income: {}, spent: {},
      score: { battlesWon: 0, battlesLost: 0, regionsTaken: 0, regionsLost: 0, casualties: 0, kills: 0 },
    });
    if (w.diff !== undefined && id !== w.player) n.bonus = { gold: 0.1 * (w.diff - 1), mil: 0.08 * (w.diff - 1) };
    for (const i of w.ownedRegions(id)) { const s = w.state.regions[i]; s.bld = s.bld || {}; }
    W4.calcMods(w, id);
    const st = W4.nationStats(w, id); n.manpowerMax = st.manpowerMax; n.manpower = n.manpowerMax * 0.6;
  }
  // 국가 통계 (UI·AI 공용)
  W4.nationStats = (w, id) => {
    const M = mods(w, id); let pop = 0, dev = 0, mpMax = 0, research = 2, naval = 0, regions = 0;
    for (const i of w.ownedRegions(id)) {
      const s = w.state.regions[i], B = s.bld || {}; regions++;
      pop += s.pop; dev += s.dev;
      mpMax += s.pop * 0.05 * (1 + (M.manpower || 0) + (B.barracks || 0) * 0.4) * (s.occ ? 0 : 1);
      research += (B.academy || 0) * 1.5; naval += (B.shipyard || 0);
    }
    research = (research + pop / 400) * (1 + (M.research || 0));
    return { pop, dev, regions, manpowerMax: mpMax, research, naval };
  };

  // ── 월간 경제 ──
  function monthNation(w, id) {
    const n = w.nations[id]; if (!n.alive) return;
    const M = W4.calcMods(w, id), T = W4.TAX[n.tax];
    const inc = {}; for (const k of RES) inc[k] = 0;
    let popTotal = 0, unrestSum = 0, regs = 0;
    for (let i = 0; i < w.state.regions.length; i++) {
      const s = w.state.regions[i], r = w.map.regions[i];
      const ownerGets = s.owner === id && !s.occ, occGets = s.occ === id && s.owner !== id;
      if (!ownerGets && !occGets) continue;
      const p = W4.regionProd(w, i, id), k = occGets ? 0.5 : 1;
      for (const x in p) inc[x] += p[x] * k;
      if (ownerGets) {
        regs++; popTotal += s.pop; unrestSum += s.unrest || 0;
        const B = s.bld || {};
        // 세금
        inc.gold += s.pop / 100 * (0.6 + 0.12 * s.dev) * T.mul * (1 + (M.tax || 0) + (B.market || 0) * 0.15) * (n.stab < 30 ? 0.8 : 1);
        // 항구 교역 (봉쇄되면 0)
        if (r.port && !(W4.isBlockaded && W4.isBlockaded(w, i))) inc.gold += 3 * (1 + (M.trade || 0) + (B.shipyard || 0) * 0.15);
        // 인구 증가 (식량이 있으면)
        const cap = r.pop * (1 + 0.25 * s.dev) * 1.6;
        if (n.res.food > 0 && s.pop < cap) s.pop += s.pop * 0.003 * (1 + (M.pop || 0));
      }
    }
    if (W4.tradeIncome) inc.gold += W4.tradeIncome(w, id);
    // 소비: 식량(인구) · 군대 유지비는 군사 모듈이 spend 로 기록
    const spend = n.spentNext || {}; n.spentNext = {};
    spend.food = (spend.food || 0) + popTotal / 60;
    for (const k of RES) n.res[k] += inc[k] - (spend[k] || 0);
    n.income = inc; n.spent = spend;
    // 기근
    if (n.res.food < 0) {
      n.res.food = 0; n.stab -= 3;
      for (const i of w.ownedRegions(id)) w.state.regions[i].pop *= 0.99;
      if (!n.famine) w.event(`${w.def(id).name}: 기근 발생`, 'econ', id);
      n.famine = true;
    } else n.famine = false;
    // 국고 부채: 금이 음수면 안정도 하락 (군대 유지비 미지급)
    if (n.res.gold < 0) { n.stab -= 2; n.debt = true; } else n.debt = false;
    // 인력
    const st = W4.nationStats(w, id); n.manpowerMax = st.manpowerMax;
    n.manpower = Math.min(n.manpowerMax, n.manpower + n.manpowerMax / 24);
    // 안정도: 목표값으로 10%씩 이동
    const target = 50 + (M.stab || 0) + T.stab - n.exhaustion * 0.5 - (regs ? unrestSum / regs : 0) * 0.2 - (n.debt ? 10 : 0);
    n.stab = clamp(n.stab + (target - n.stab) * 0.1, 0, 100);
    n.exhaustion = Math.max(0, n.exhaustion - (n.atWar ? 0 : 1.5));
    // 건설 대기열
    for (const q of n.queue) q.left--;
    for (const q of n.queue.filter(q => q.left <= 0)) finishJob(w, id, q);
    n.queue = n.queue.filter(q => q.left > 0);
  }
  function finishJob(w, id, q) {
    const s = w.state.regions[q.r], r = w.map.regions[q.r];
    if (s.owner !== id || s.occ) { w.event(`${r.name}: 공사 중단 (영토 상실)`, 'econ', id); return; }
    if (q.kind === 'b') { s.bld[q.key] = (s.bld[q.key] || 0) + 1; if (q.key === 'fortress') s.fort = (s.fort || 0) + 1; w.event(`${r.name}: ${W4.BUILDINGS[q.key].name} 완공`, 'build', id); }
    else if (q.kind === 'dev') { s.dev++; w.event(`${r.name}: 개발도 ${s.dev}`, 'build', id); }
    else if (q.kind === 'city') { s.city = { name: r.root, capital: false }; s.fort = Math.max(s.fort, 1); s.dev++; w.event(`${r.root} 도시 건설`, 'build', id); }
  }

  // ── 플레이어·AI 공용 내정 명령 ──
  const pay = (n, cost) => { for (const k in cost) if ((n.res[k] || 0) < cost[k]) return false; for (const k in cost) n.res[k] -= cost[k]; return true; };
  W4.costOf = (w, id, kind, i, key) => {
    const s = w.state.regions[i], M = mods(w, id), red = 1 - (M.build || 0);
    let c;
    if (kind === 'b') { const B = W4.BUILDINGS[key]; const lv = (s.bld[key] || 0); c = {}; for (const k in B.cost) c[k] = Math.round(B.cost[k] * (1 + lv * 0.6) * red); }
    else if (kind === 'dev') c = { gold: Math.round(70 * s.dev * red), stone: Math.round(15 * s.dev * red) };
    else c = { gold: Math.round(300 * red), stone: Math.round(100 * red), wood: Math.round(60 * red) };
    return c;
  };
  W4.Act = W4.Act || {};
  W4.Act.build = (w, id, i, key) => {
    const n = w.nations[id], s = w.state.regions[i], r = w.map.regions[i], B = W4.BUILDINGS[key];
    if (!B) return { ok: false, msg: '알 수 없는 건물' };
    if (s.owner !== id || s.occ) return { ok: false, msg: '자국이 통제하는 지역이 아닙니다' };
    if (B.coastal && !r.coastal) return { ok: false, msg: '해안 지역에만 지을 수 있습니다' };
    const pending = n.queue.filter(q => q.r === i && q.key === key).length;
    if ((s.bld[key] || 0) + pending >= B.max) return { ok: false, msg: '최대 단계' };
    if (n.queue.length >= 6) return { ok: false, msg: '건설 대기열이 가득 찼습니다 (6)' };
    const cost = W4.costOf(w, id, 'b', i, key);
    if (!pay(n, cost)) return { ok: false, msg: '자원 부족' };
    n.queue.push({ kind: 'b', r: i, key, left: B.time });
    return { ok: true };
  };
  W4.Act.develop = (w, id, i) => {
    const n = w.nations[id], s = w.state.regions[i];
    if (s.owner !== id || s.occ) return { ok: false, msg: '자국 지역이 아닙니다' };
    if (s.dev >= 8) return { ok: false, msg: '최대 개발도' };
    if (n.queue.some(q => q.r === i && q.kind === 'dev')) return { ok: false, msg: '이미 개발 중' };
    if (n.queue.length >= 6) return { ok: false, msg: '건설 대기열이 가득 찼습니다 (6)' };
    if (!pay(n, W4.costOf(w, id, 'dev', i))) return { ok: false, msg: '자원 부족' };
    n.queue.push({ kind: 'dev', r: i, left: 3 });
    return { ok: true };
  };
  W4.Act.foundCity = (w, id, i) => {
    const n = w.nations[id], s = w.state.regions[i], r = w.map.regions[i];
    if (s.owner !== id || s.occ) return { ok: false, msg: '자국 지역이 아닙니다' };
    if (r.city || s.city) return { ok: false, msg: '이미 도시가 있습니다' };
    if (s.dev < 4) return { ok: false, msg: '개발도 4 이상 필요' };
    if (n.queue.some(q => q.r === i && q.kind === 'city')) return { ok: false, msg: '이미 건설 중' };
    if (!pay(n, W4.costOf(w, id, 'city', i))) return { ok: false, msg: '자원 부족' };
    n.queue.push({ kind: 'city', r: i, left: 6 });
    return { ok: true };
  };
  W4.Act.setTax = (w, id, p) => { if (!W4.TAX[p]) return { ok: false }; w.nations[id].tax = p; return { ok: true }; };
  W4.cityOf = (w, i) => w.map.regions[i].city || w.state.regions[i].city || null;

  W4.system({
    id: 'economy', order: 10,
    init(w) { for (const n of W4.NATIONS) initNation(w, n.id); },
    month(w) { for (const n of W4.NATIONS) monthNation(w, n.id); },
    load(w) { for (const n of W4.NATIONS) W4.calcMods(w, n.id); },
  });
})();
