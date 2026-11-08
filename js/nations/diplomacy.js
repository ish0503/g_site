// ─────────────────────────────────────────────
// 4.0 외교 — 관계도 · 조약 · 전쟁 명분 · 침략 평판
//   조약: alliance(동맹) · defense(방위 조약) · nap(불가침, 5년) · trade(무역) · access(통행권, 한 방향)
//         vassal(종속: a=종주국, b=종속국) · guarantee(독립 보장: a 가 b 를 보장)
//   전쟁 명분(cb): core(핵심 영토 회복) · claim(영유권 날조) · guarantee(보장 발동) · ally(동맹 지원) · liberation(종속 해방)
//   평화 협상은 grandwar/war.js 에서 처리한다.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, clamp = W4.clamp;
  W4.TREATIES = {
    alliance: { name: '동맹', icon: '🤝', sym: true, desc: '서로의 전쟁에 참전' },
    defense: { name: '방위 조약', icon: '🛡️', sym: true, desc: '침공당하면 참전' },
    nap: { name: '불가침 조약', icon: '🕊️', sym: true, dur: 60, desc: '5년간 서로 선전포고 불가' },
    trade: { name: '무역 협정', icon: '💱', sym: true, desc: '양국 금 수입 증가' },
    access: { name: '통행권', icon: '🚶', sym: false, desc: '상대 군단이 우리 영토를 지나갈 수 있음' },
    vassal: { name: '종속', icon: '👑', sym: false, desc: '종속국은 금 수입 25%를 바치고 종주국 전쟁에 참전' },
    guarantee: { name: '독립 보장', icon: '🛡', sym: false, desc: '보장국은 피보장국이 침공당하면 참전' },
  };
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const D = W4.Diplo = {
    key,
    rel: (w, a, b) => (a === b ? 100 : w.diplo.rel[key(a, b)] || 0),
    addRel: (w, a, b, v) => { if (a === b) return; const k = key(a, b); w.diplo.rel[k] = clamp((w.diplo.rel[k] || 0) + v, -100, 100); },
    has: (w, type, a, b) => w.diplo.treaties.some(t => t.type === type && ((t.a === a && t.b === b) || (W4.TREATIES[type].sym && t.a === b && t.b === a))),
    list: (w, id) => w.diplo.treaties.filter(t => t.a === id || t.b === id),
    allies: (w, id) => w.diplo.treaties.filter(t => t.type === 'alliance' && (t.a === id || t.b === id)).map(t => (t.a === id ? t.b : t.a)),
    overlord: (w, id) => { const t = w.diplo.treaties.find(t => t.type === 'vassal' && t.b === id); return t ? t.a : null; },
    vassals: (w, id) => w.diplo.treaties.filter(t => t.type === 'vassal' && t.a === id).map(t => t.b),
    atWar: (w, a, b) => (W4.War ? W4.War.atWar(w, a, b) : false),
    borders: (w, a, b) => { for (const i of w.ownedRegions(a)) for (const j of w.map.regions[i].nb) if (w.state.regions[j].owner === b) return true; return false; },
    neighbors: (w, a) => { const s = new Set(); for (const i of w.ownedRegions(a)) for (const j of w.map.regions[i].nb) { const o = w.state.regions[j].owner; if (o !== a && o !== 'neutral') s.add(o); } return [...s]; },
    cbs: (w, by, vs) => w.diplo.cb.filter(c => c.by === by && c.vs === vs && (!c.until || c.until > w.turn)),
  };
  // 국력: 경제(월 수입 가치) + 군사(군단 전투력 또는 인력)
  W4.power = (w, id) => {
    const N = w.nations[id]; if (!N.alive) return 0;
    let econ = 0; for (const k in N.income) econ += (N.income[k] || 0) * W4.RES_VALUE[k];
    const mil = W4.milPower ? W4.milPower(w, id) : N.manpower;
    return econ + mil;
  };

  // ── 자동 전쟁 명분: 상대가 우리 핵심 영토를 가지고 있으면 core ──
  function refreshCB(w) {
    w.diplo.cb = w.diplo.cb.filter(c => c.kind !== 'core' && (!c.until || c.until > w.turn));
    for (let i = 0; i < w.state.regions.length; i++) {
      const s = w.state.regions[i];
      if (s.core && s.core !== 'neutral' && s.owner !== s.core && s.owner !== 'neutral' && w.nations[s.core].alive)
        if (!w.diplo.cb.some(c => c.kind === 'core' && c.by === s.core && c.vs === s.owner)) w.diplo.cb.push({ by: s.core, vs: s.owner, kind: 'core', region: i });
    }
  }

  // ── 제안 평가 (AI 가 받을 때): 양수면 수락 ──
  D.evaluate = (w, from, to, type) => {
    const r = D.rel(w, from, to), pf = W4.power(w, from), pt = W4.power(w, to), ratio = pf / Math.max(1, pt);
    const T = w.def(to), share = D.borders(w, from, to);
    let s = r * 0.6;
    const why = [];
    if (D.atWar(w, from, to)) return { score: -999, why: ['전쟁 중'] };
    if (D.overlord(w, to) && type !== 'vassal') return { score: -999, why: ['종속국은 독자 외교 불가'] };
    switch (type) {
      case 'alliance': {
        // 공동의 위협이 있으면 동맹을 원한다
        const threat = W4.NATIONS.filter(n => n.id !== from && n.id !== to && w.nations[n.id].alive && D.rel(w, to, n.id) < -20 && D.rel(w, from, n.id) < 0).length;
        s += threat * 15 - 25 + Math.min(20, ratio * 10); if (!threat) why.push('공동의 적 없음'); if (r < 20) why.push('관계 부족');
        if (D.allies(w, to).length >= 3) { s -= 40; why.push('동맹이 이미 많음'); }
        break;
      }
      case 'defense': s += (pt < pf ? 15 : 0) + (share ? 5 : -10) - 10; break;
      case 'nap': s += 20 + (ratio > 1.5 ? 25 : 0) - (T.ai === 'conqueror' && ratio < 0.7 ? 40 : 0); if (ratio > 1.5) why.push('상대가 강함'); break;
      case 'trade': s += 25 + (T.ai === 'trader' ? 20 : 0) - (r < -30 ? 50 : 0); break;
      case 'access': s += (D.allies(w, to).includes(from) ? 40 : -10) + 5; break;
      case 'guarantee': s += 40; break;                             // 보장받는 쪽은 대체로 환영
      case 'vassal': {                                              // from 이 to 를 종속국으로 요구
        s = (ratio > 3 ? 30 : ratio > 2 ? 0 : -80) + r * 0.4 - (T.ai === 'conqueror' ? 30 : 0) - D.allies(w, to).length * 25;
        if (ratio <= 2) why.push('국력 차이 부족');
        break;
      }
    }
    if (w.nations[from].ae > 30) { s -= (w.nations[from].ae - 30) * 0.8; why.push('침략 평판'); }
    return { score: s, why };
  };

  // ── 외교 명령 ──
  W4.Act = W4.Act || {};
  const can = (w, a, b) => a !== b && w.nations[a].alive && w.nations[b].alive;
  function addTreaty(w, type, a, b) {
    if (D.has(w, type, a, b)) return;
    const T = W4.TREATIES[type];
    w.diplo.treaties.push({ type, a, b, since: w.turn, until: T.dur ? w.turn + T.dur : null });
    D.addRel(w, a, b, type === 'alliance' ? 20 : type === 'vassal' ? -10 : 8);
    w.event(`${T.icon} ${w.def(a).name} ↔ ${w.def(b).name}: ${T.name}`, 'diplo', a, { other: b });
  }
  D.addTreaty = addTreaty;
  W4.Act.propose = (w, from, to, type) => {
    if (!can(w, from, to) || !W4.TREATIES[type]) return { ok: false, msg: '불가' };
    if (D.has(w, type, from, to)) return { ok: false, msg: '이미 맺은 조약' };
    if (D.overlord(w, from) && D.overlord(w, from) !== to) return { ok: false, msg: '종속국은 독자 외교를 할 수 없습니다' };
    if (D.atWar(w, from, to)) return { ok: false, msg: '전쟁 중' };
    if ((w.nations[from].dipCd || 0) > w.turn) return { ok: false, msg: '이번 달 외교 행동을 이미 했습니다' };
    w.nations[from].dipCd = w.turn + 1;
    // 플레이어가 받는 제안은 받은편지함으로
    if (to === w.player) {
      // 같은 국가의 대기 중 제안은 1건, 같은 종류는 1년에 1번
      const ak = from + ':' + type; w.diplo.asked = w.diplo.asked || {};
      if (w.diplo.inbox.some(q => q.from === from) || (w.diplo.asked[ak] || -99) > w.turn - 12) return { ok: false, msg: '이미 제안함' };
      w.diplo.asked[ak] = w.turn; w.diplo.inbox.push({ from, type, t: w.turn }); return { ok: true, pending: true };
    }
    const ev = D.evaluate(w, from, to, type);
    if (ev.score > 0) {
      if (type === 'vassal') addTreaty(w, 'vassal', from, to);
      else if (type === 'guarantee') addTreaty(w, 'guarantee', from, to);
      else if (type === 'access') addTreaty(w, 'access', to, from);           // to 가 from 에게 통행권을 준다
      else addTreaty(w, type, from, to);
      return { ok: true, accepted: true };
    }
    D.addRel(w, from, to, -3);
    return { ok: true, accepted: false, msg: '거절: ' + (ev.why.join(', ') || '이득이 없음') };
  };
  // 플레이어가 받은 제안 응답
  W4.Act.answer = (w, idx, yes) => {
    const p = w.diplo.inbox[idx]; if (!p) return { ok: false };
    w.diplo.inbox.splice(idx, 1);
    if (!yes) { D.addRel(w, p.from, w.player, -5); return { ok: true }; }
    if (!can(w, p.from, w.player) || D.atWar(w, p.from, w.player)) return { ok: false, msg: '더 이상 유효하지 않음' };
    if (p.type === 'access') addTreaty(w, 'access', w.player, p.from);
    else if (p.type === 'vassal') addTreaty(w, 'vassal', p.from, w.player);
    else if (p.type === 'guarantee') addTreaty(w, 'guarantee', p.from, w.player);
    else addTreaty(w, p.type, p.from, w.player);
    return { ok: true };
  };
  W4.Act.cancel = (w, id, type, other) => {
    const t = w.diplo.treaties.find(t => t.type === type && ((t.a === id && t.b === other) || (t.a === other && t.b === id)));
    if (!t) return { ok: false, msg: '조약 없음' };
    if (type === 'vassal' && t.b === id) return { ok: false, msg: '종속국은 독립 전쟁으로만 벗어날 수 있습니다' };
    w.diplo.treaties.splice(w.diplo.treaties.indexOf(t), 1);
    const pen = { alliance: 40, nap: 50, defense: 30, guarantee: 25, trade: 10, access: 10, vassal: 10 }[type];
    D.addRel(w, id, other, -pen);
    if (type === 'nap' || type === 'alliance') { w.nations[id].stab -= 5; w.nations[id].ae = (w.nations[id].ae || 0) + 8; }
    w.event(`${w.def(id).name}: ${w.def(other).name} 와(과)의 ${W4.TREATIES[type].name} 파기`, 'diplo', id, { other });
    return { ok: true };
  };
  W4.Act.improve = (w, id, other) => {
    const n = w.nations[id]; if (n.res.gold < 40) return { ok: false, msg: '금 40 필요' };
    if ((n.dipCd || 0) > w.turn) return { ok: false, msg: '이번 달 외교 행동을 이미 했습니다' };
    n.res.gold -= 40; n.dipCd = w.turn + 1; D.addRel(w, id, other, 12); return { ok: true };
  };
  W4.Act.gift = (w, id, other, amt = 100) => {
    const n = w.nations[id]; if (n.res.gold < amt) return { ok: false, msg: '금 부족' };
    n.res.gold -= amt; w.nations[other].res.gold += amt; D.addRel(w, id, other, Math.round(amt / 8)); return { ok: true };
  };
  W4.Act.insult = (w, id, other) => { D.addRel(w, id, other, -40); w.diplo.cb.push({ by: other, vs: id, kind: 'insult', until: w.turn + 24 }); return { ok: true }; };
  // 영유권 날조: 6개월 뒤 접경 지역에 대한 전쟁 명분
  W4.Act.fabricate = (w, id, other) => {
    const n = w.nations[id]; if (n.res.gold < 100) return { ok: false, msg: '금 100 필요' };
    if (!D.borders(w, id, other)) return { ok: false, msg: '국경을 맞댄 국가만 가능' };
    if (w.diplo.pending.some(p => p.by === id && p.vs === other)) return { ok: false, msg: '이미 진행 중' };
    n.res.gold -= 100; w.diplo.pending.push({ by: id, vs: other, at: w.turn + 6 });
    return { ok: true };
  };

  // 무역 수입 (economy 가 호출)
  W4.tradeIncome = (w, id) => {
    let g = 0;
    for (const t of w.diplo.treaties) {
      if (t.type !== 'trade' || (t.a !== id && t.b !== id)) continue;
      const o = t.a === id ? t.b : t.a, M = w.nations[id].mods || {};
      g += (2 + Math.min(w.nations[o].income.gold || 0, w.nations[id].income.gold || 0) * 0.06) * (1 + (M.trade || 0));
    }
    // 종속국 공물
    const lord = D.overlord(w, id); if (lord) w.nations[id].spentNext.gold = (w.nations[id].spentNext.gold || 0) + (w.nations[id].income.gold || 0) * 0.25;
    for (const v of D.vassals(w, id)) g += (w.nations[v].income.gold || 0) * 0.25;
    return g;
  };

  W4.system({
    id: 'diplomacy', order: 30,
    init(w) {
      w.diplo = { rel: {}, treaties: [], cb: [], pending: [], inbox: [] };
      // 초기 관계: 같은 대륙 이웃은 긴장, 같은 정치 체제·특성은 호감
      for (const a of W4.NATIONS) for (const b of W4.NATIONS) {
        if (a.id >= b.id) continue;
        let r = 0;
        if (a.cont === b.cont) r -= 10;
        if (D.borders(w, a.id, b.id)) r -= 10;
        if (a.gov === b.gov) r += 15;
        if (a.traits.some(t => b.traits.includes(t))) r += 10;
        r += Math.round((w.rand() - 0.5) * 30);
        w.diplo.rel[key(a.id, b.id)] = r;
      }
    },
    month(w) {
      const Dp = w.diplo;
      refreshCB(w);
      // 조약 만료
      Dp.treaties = Dp.treaties.filter(t => { if (t.until && t.until <= w.turn) { w.event(`${W4.TREATIES[t.type].name} 만료: ${w.def(t.a).name} · ${w.def(t.b).name}`, 'diplo', t.a, { other: t.b }); return false; } return w.nations[t.a].alive && w.nations[t.b].alive; });
      // 날조 완료
      for (const p of Dp.pending.filter(p => p.at <= w.turn)) { Dp.cb.push({ by: p.by, vs: p.vs, kind: 'claim', until: w.turn + 60 }); w.event(`${w.def(p.by).name}: ${w.def(p.vs).name} 에 대한 영유권 주장 확보`, 'diplo', p.by, { other: p.vs }); }
      Dp.pending = Dp.pending.filter(p => p.at > w.turn);
      // 관계 변화: 조약·전쟁·국경
      for (const a of W4.NATIONS) for (const b of W4.NATIONS) {
        if (a.id >= b.id || !w.nations[a.id].alive || !w.nations[b.id].alive) continue;
        let d = 0;
        if (D.has(w, 'alliance', a.id, b.id)) d += 1;
        if (D.has(w, 'trade', a.id, b.id)) d += 0.5;
        if (D.atWar(w, a.id, b.id)) d -= 2;
        else d -= D.rel(w, a.id, b.id) * 0.01;                     // 평시에는 0 쪽으로 천천히
        D.addRel(w, a.id, b.id, d);
      }
      // 침략 평판 감소, 오래된 받은 제안 정리
      for (const n of W4.NATIONS) { const N = w.nations[n.id]; N.ae = Math.max(0, (N.ae || 0) - 0.5); }
      Dp.inbox = Dp.inbox.filter(p => w.turn - p.t < 6);
    },
  });
})();
