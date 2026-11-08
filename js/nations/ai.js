// ─────────────────────────────────────────────
// 4.0 국가 AI — 경제·내정·외교·전쟁 판단 (군사 AI·전술 AI 와 분리)
//   성향(def.ai): conqueror(정복) · builder(건설) · trader(교역) · zealot(신정) · opportunist(기회주의)
//   매달: 세율 → 건설/개발 → 연구 선호 → 외교 행동 1회 → 전쟁 판단(W4.NationAI.war, 전쟁 모듈이 채움)
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo;
  const PROFILE = {
    conqueror: { build: ['barracks', 'mine', 'farm', 'market', 'fortress'], alliance: 0.4, trade: 0.3, war: 1.4, fabricate: 0.35 },
    builder: { build: ['farm', 'market', 'academy', 'fortress', 'mine', 'lumber'], alliance: 0.6, trade: 0.6, war: 0.6, fabricate: 0.05 },
    trader: { build: ['market', 'shipyard', 'farm', 'lumber', 'academy'], alliance: 0.5, trade: 1, war: 0.7, fabricate: 0.05 },
    zealot: { build: ['farm', 'barracks', 'academy', 'market', 'fortress'], alliance: 0.5, trade: 0.4, war: 1.1, fabricate: 0.15 },
    opportunist: { build: ['stable', 'barracks', 'farm', 'mine', 'market'], alliance: 0.4, trade: 0.5, war: 1.1, fabricate: 0.2 },
  };
  W4.AI_PROFILE = PROFILE;
  const NationAI = W4.NationAI = { war: null, military: null };

  function economy(w, id) {
    const N = w.nations[id], P = PROFILE[w.def(id).ai];
    // 세율
    N.tax = N.stab < 35 ? 'low' : N.res.gold < 80 && N.stab > 55 ? 'high' : N.stab > 70 && N.atWar ? 'high' : 'normal';
    // 식량 부족이면 농장 우선
    const foodNet = (N.income.food || 0) - (N.spent.food || 0);
    const order = foodNet < 2 ? ['farm', ...P.build] : P.build;
    const reserve = N.atWar ? 250 : 120;                  // 전쟁 대비 금 비축
    const slots = N.res.gold > 1500 ? 6 : 3;          // 부유하면 동시 공사 확대
    for (let pass = 0; pass < (N.res.gold > 1500 ? 2 : 1); pass++)
    if (N.queue.length < slots && N.res.gold > reserve) {
      const regs = w.ownedRegions(id).filter(i => !w.state.regions[i].occ);
      let done = false;
      for (const b of order) {
        if (done) break;
        const B = W4.BUILDINGS[b];
        // 가장 효과가 큰 지역: 해당 자원 기본 생산이 큰 곳 / 요새는 접경 / 학술원·시장은 인구 많은 곳
        const score = (i) => {
          const r = w.map.regions[i], s = w.state.regions[i];
          if (b === 'fortress') return r.nb.some(j => w.state.regions[j].owner !== id) ? 10 + (r.city ? 5 : 0) : -1;
          if (b === 'academy' || b === 'market' || b === 'barracks') return s.pop / 10 + s.dev;
          let v = 0; for (const k in B.fx) v += (r.prod[k] || 0); return v;
        };
        const cand = regs.filter(i => (w.state.regions[i].bld[b] || 0) < B.max && (!B.coastal || w.map.regions[i].coastal) && !N.queue.some(q => q.r === i && q.key === b)).sort((a, c) => score(c) - score(a) || a - c);
        if (cand.length && score(cand[0]) > 0 && W4.Act.build(w, id, cand[0], b).ok) done = true;
      }
      if (!done && N.res.gold > reserve + 150) { const cap = w.map.nations[id] && w.map.nations[id].capital; const c = regs.sort((a, b) => w.state.regions[b].pop - w.state.regions[a].pop)[0]; if (c !== undefined) W4.Act.develop(w, id, c); }
    }
    // 부유하면 시장에서 식량·철·목재를 사서 군대 유지
    if (N.res.gold > 800) { if (N.res.food < 400) W4.Act.buyRes(w, id, 'food', 200); else if (N.res.iron < 150) W4.Act.buyRes(w, id, 'iron', 100); else if (N.res.wood < 150) W4.Act.buyRes(w, id, 'wood', 100); }
    // 연구 선호: 전쟁 중이면 군사
    N.research.pref = N.atWar ? 'mil' : null;
  }

  function diplomacy(w, id) {
    const N = w.nations[id], d = w.def(id), P = PROFILE[d.ai];
    if (D.overlord(w, id)) return;                     // 종속국은 독자 외교 없음
    const others = w.alive().filter(o => o !== id);
    const myPow = W4.power(w, id);
    const r = w.rand();
    // 1) 위협 평가: 국경을 맞댄, 관계 나쁜, 더 강한 국가
    const threats = D.neighbors(w, id).filter(o => D.rel(w, id, o) < -10 && W4.power(w, o) > myPow * 0.8);
    // 2) 동맹: 위협이 있으면 같은 위협을 가진 국가와
    if (threats.length && r < P.alliance && D.allies(w, id).length < 2) {
      const cand = others.filter(o => !threats.includes(o) && !D.has(w, 'alliance', id, o) && D.rel(w, id, o) > 10 && threats.some(t => D.rel(w, o, t) < 0)).sort((a, b) => D.rel(w, id, b) - D.rel(w, id, a));
      if (cand.length && W4.Act.propose(w, id, cand[0], 'alliance').ok) return;
    }
    // 3) 강한 이웃과 불가침
    if (threats.length && r < 0.5) { const t = threats.find(o => !D.has(w, 'nap', id, o)); if (t && W4.Act.propose(w, id, t, 'nap').ok) return; }
    // 4) 무역
    if (r < P.trade) {
      const cand = others.filter(o => !D.has(w, 'trade', id, o) && D.rel(w, id, o) > -10).sort((a, b) => D.rel(w, id, b) - D.rel(w, id, a));
      if (cand.length && D.list(w, id).filter(t => t.type === 'trade').length < 4 && W4.Act.propose(w, id, cand[0], 'trade').ok) return;
    }
    // 5) 동맹에게 통행권
    for (const a of D.allies(w, id)) if (!D.has(w, 'access', a, id) && W4.Act.propose(w, id, a, 'access').ok) return;
    // 6) 약한 이웃: 정복형은 종속 요구·영유권 날조, 건설형은 독립 보장
    const weak = D.neighbors(w, id).filter(o => W4.power(w, o) < myPow * 0.4 && !D.overlord(w, o));
    if (weak.length) {
      if (d.ai === 'conqueror' && r < 0.3) { if (W4.Act.propose(w, id, weak[0], 'vassal').ok) return; }
      if ((d.ai === 'builder' || d.ai === 'zealot') && r < 0.2) { const o = weak.find(x => D.rel(w, id, x) > 0 && !D.has(w, 'guarantee', id, x)); if (o && W4.Act.propose(w, id, o, 'guarantee').ok) return; }
    }
    if (r < P.fabricate && N.res.gold > 200) {
      const tgt = D.neighbors(w, id).filter(o => D.rel(w, id, o) < 10 && !D.cbs(w, id, o).length && W4.power(w, o) < myPow).sort((a, b) => W4.power(w, a) - W4.power(w, b))[0];
      if (tgt && W4.Act.fabricate(w, id, tgt).ok) return;
    }
    // 7) 관계 개선: 위협 국가 중 가장 강한 국가
    if (threats.length && N.res.gold > 300 && r < 0.2) W4.Act.improve(w, id, threats[0]);
  }

  W4.system({
    id: 'nationAI', order: 40,
    month(w) {
      for (const n of W4.NATIONS) {
        if (n.id === w.player || !w.nations[n.id].alive) continue;
        economy(w, n.id);
        diplomacy(w, n.id);
        if (NationAI.war) NationAI.war(w, n.id);
      }
      // 관전 모드가 아니면 플레이어 받은편지함은 플레이어가 처리. 관전(player=null)이면 해당 없음.
    },
  });
  NationAI.economy = economy; NationAI.diplomacy = diplomacy;
})();
