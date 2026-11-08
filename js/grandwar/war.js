// ─────────────────────────────────────────────
// 4.0 국가 전쟁 — 선전포고 · 참전 · 전쟁 점수 · 평화 협상 · 휴전 · 멸망 · 전선
//   전쟁 점수(공격측 기준 -100~100) = 점령 지역 가치 차이 + 전투 승패 + 목표(명분 지역) 장악 + 봉쇄
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo, clamp = W4.clamp;
  const War = W4.War = {};
  War.of = (w, a, b) => w.wars.find(x => (x.att.includes(a) && x.def.includes(b)) || (x.att.includes(b) && x.def.includes(a)));
  War.atWar = (w, a, b) => !!(w.wars && War.of(w, a, b));
  War.side = (war, id) => (war.att.includes(id) ? 'att' : war.def.includes(id) ? 'def' : null);
  War.enemies = (w, id) => { const s = new Set(); for (const x of w.wars || []) { if (x.att.includes(id)) x.def.forEach(e => s.add(e)); if (x.def.includes(id)) x.att.forEach(e => s.add(e)); } return [...s]; };
  War.inWar = (w, id) => (w.wars || []).some(x => x.att.includes(id) || x.def.includes(id));
  War.truce = (w, a, b) => (w.truces || []).some(t => ((t.a === a && t.b === b) || (t.a === b && t.b === a)) && t.until > w.turn);
  // 지역 가치 (전쟁 점수·평화 비용)
  War.regionCost = (w, i) => { const s = w.state.regions[i], r = w.map.regions[i]; return 2 + s.dev * 1.5 + (W4.cityOf(w, i) ? 4 : 0) + (r.city && r.city.capital ? 8 : 0); };
  War.nationValue = (w, id) => w.ownedRegions(id).reduce((a, i) => a + War.regionCost(w, i), 0);

  War.canDeclare = (w, att, def) => {
    if (att === def || !w.nations[att].alive || !w.nations[def].alive) return { ok: false, msg: '불가' };
    if (War.atWar(w, att, def)) return { ok: false, msg: '이미 전쟁 중' };
    if (D.overlord(w, att) && D.overlord(w, att) !== def) return { ok: false, msg: '종속국은 선전포고할 수 없습니다 (종주국에 대한 독립 전쟁만 가능)' };
    if (War.truce(w, att, def)) return { ok: false, msg: '휴전 기간입니다' };
    if (D.has(w, 'alliance', att, def)) return { ok: false, msg: '동맹국입니다 (먼저 동맹을 파기하세요)' };
    if (D.has(w, 'nap', att, def)) return { ok: false, msg: '불가침 조약 중입니다 (먼저 파기하세요)' };
    return { ok: true };
  };
  // 선전포고
  W4.Act = W4.Act || {};
  W4.Act.declareWar = (w, att, def, opts = {}) => {
    const c = War.canDeclare(w, att, def); if (!c.ok) return c;
    const cb = D.cbs(w, att, def)[0] || (D.overlord(w, att) === def ? { kind: 'liberation' } : null);
    const war = { id: (w.warSeq = (w.warSeq || 0) + 1), att: [att], def: [def], lead: [att, def], cb: cb ? cb.kind : null, goal: cb && cb.region !== undefined ? cb.region : null, start: w.turn, score: 0, battle: 0, battles: [], name: '' };
    war.name = `${w.def(att).name.split(' ')[0]}-${w.def(def).name.split(' ')[0]} 전쟁`;
    w.wars.push(war);
    if (!cb) {           // 명분 없는 전쟁: 안정도·평판·관계 하락
      w.nations[att].stab -= 10; w.nations[att].ae = (w.nations[att].ae || 0) + 15;
      for (const n of W4.NATIONS) if (n.id !== att) D.addRel(w, att, n.id, -8);
    }
    D.addRel(w, att, def, -40);
    // 종주국 독립 전쟁이면 종속 해제
    if (D.overlord(w, att) === def) w.diplo.treaties = w.diplo.treaties.filter(t => !(t.type === 'vassal' && t.a === def && t.b === att));
    w.event(`⚔️ ${w.def(att).name} 이(가) ${w.def(def).name} 에 선전포고${cb ? '' : ' (명분 없음)'}`, 'war', att, { other: def, war: war.id });
    // 참전 요청
    const join = (id, side, why) => {
      if (war.att.includes(id) || war.def.includes(id) || !w.nations[id].alive) return;
      const enemySide = side === 'att' ? war.def : war.att;
      if (enemySide.some(e => D.has(w, 'alliance', id, e) || D.overlord(w, id) === e)) return;      // 양쪽과 동맹이면 중립
      if (enemySide.some(e => D.has(w, 'nap', id, e)) && why !== 'vassal') return;
      war[side].push(id);
      w.event(`${w.def(id).name} 참전 (${side === 'att' ? '공격측' : '방어측'} · ${why})`, 'war', id, { war: war.id });
    };
    for (const v of D.vassals(w, def)) join(v, 'def', '종속국');
    const lordD = D.overlord(w, def); if (lordD && lordD !== att) join(lordD, 'def', '종주국');
    for (const a of D.allies(w, def)) if (opts.noCall !== a) join(a, 'def', '동맹');
    for (const t of w.diplo.treaties) {
      if (t.type === 'defense' && (t.a === def || t.b === def)) join(t.a === def ? t.b : t.a, 'def', '방위 조약');
      if (t.type === 'guarantee' && t.b === def) join(t.a, 'def', '독립 보장');
    }
    for (const v of D.vassals(w, att)) join(v, 'att', '종속국');
    for (const a of D.allies(w, att)) { if (a === w.player || D.rel(w, a, def) < 10) join(a, 'att', '동맹'); }
    for (const id of [...war.att, ...war.def]) w.nations[id].atWar = true;
    return { ok: true, war };
  };

  // ── 전쟁 점수 (월간) ──
  function updateScore(w, war) {
    let a = 0, d = 0;
    for (let i = 0; i < w.state.regions.length; i++) {
      const s = w.state.regions[i]; if (!s.occ || s.occ === s.owner) continue;
      if (war.att.includes(s.occ) && war.def.includes(s.owner)) a += War.regionCost(w, i);
      if (war.def.includes(s.occ) && war.att.includes(s.owner)) d += War.regionCost(w, i);
    }
    const va = war.def.reduce((x, id) => x + War.nationValue(w, id), 0) || 1, vd = war.att.reduce((x, id) => x + War.nationValue(w, id), 0) || 1;
    let sc = a / va * 100 - d / vd * 100 + war.battle;
    if (war.goal !== null && war.goal !== undefined) { const s = w.state.regions[war.goal]; if (s && war.att.includes(s.occ || s.owner)) war.goalHeld = (war.goalHeld || 0) + 1; sc += Math.min(25, (war.goalHeld || 0) * 2); }
    war.score = clamp(sc, -100, 100);
  }
  // 전투 결과 반영 (armies.js 가 호출)
  War.onBattle = (w, rec) => {
    const war = War.of(w, rec.att, rec.def); if (!war) return;
    const sign = War.side(war, rec.winner) === 'att' ? 1 : -1;
    war.battle = clamp(war.battle + sign * Math.min(8, 1 + rec.lostL / 4), -40, 40);
    war.battles.push(rec); if (war.battles.length > 60) war.battles.shift();
    for (const id of [rec.att, rec.def]) w.nations[id].exhaustion = Math.min(100, w.nations[id].exhaustion + (id === rec.winner ? rec.lostW : rec.lostL) * 0.4);
  };

  // ── 평화 ──
  // terms: { cede: [regionIds], gold, vassal, white }  from = 제안국(승자 쪽), to = 상대 지도국
  War.termsCost = (w, war, terms) => {
    let c = 0;
    for (const i of terms.cede || []) c += War.regionCost(w, i) / Math.max(1, War.nationValue(w, w.state.regions[i].owner)) * 100;
    c += (terms.gold || 0) / 20;
    if (terms.vassal) c += 60;
    return c;
  };
  War.acceptPeace = (w, war, from, terms) => {
    const fromSide = War.side(war, from), sc = fromSide === 'att' ? war.score : -war.score;
    const loser = fromSide === 'att' ? war.lead[1] : war.lead[0];
    if (terms.white) return sc < 15 || w.nations[loser].exhaustion > 50 || w.turn - war.start > 36;
    const cost = War.termsCost(w, war, terms);
    const desperation = w.nations[loser].exhaustion * 0.3 + (w.turn - war.start > 48 ? 15 : 0);
    return cost <= sc + desperation;
  };
  W4.Act.peace = (w, warId, from, terms = { white: true }) => {
    const war = w.wars.find(x => x.id === warId); if (!war) return { ok: false, msg: '전쟁 없음' };
    const side = War.side(war, from); if (!side) return { ok: false, msg: '참전국이 아닙니다' };
    const other = side === 'att' ? war.lead[1] : war.lead[0];
    // 지도국이 아닌 참전국: 단독 강화 (전쟁에서 이탈, 조건 없음)
    if (from !== war.lead[0] && from !== war.lead[1]) { leave(w, war, from); w.event(`${w.def(from).name} 단독 강화로 전쟁 이탈`, 'peace', from, { war: war.id }); return { ok: true, accepted: true }; }
    // 영토 조건 검증: 상대측 소유이고 우리 쪽이 점령 중인 지역만
    const enemy = side === 'att' ? war.def : war.att, ours = side === 'att' ? war.att : war.def;
    terms.cede = (terms.cede || []).filter(i => enemy.includes(w.state.regions[i].owner) && (ours.includes(w.state.regions[i].occ) || terms.anyRegion) && !(w.map.regions[i].city && w.map.regions[i].city.capital && War.nationValue(w, w.state.regions[i].owner) > War.regionCost(w, i) * 1.01 && !terms.anyRegion));
    const human = other === w.player && from !== w.player;
    if (!human && !War.acceptPeace(w, war, from, terms)) return { ok: true, accepted: false, msg: '상대가 조건을 거절했습니다' };
    if (human) { w.diplo.peaceOffers = w.diplo.peaceOffers || []; if (!w.diplo.peaceOffers.some(o => o.war === warId)) w.diplo.peaceOffers.push({ war: warId, from, terms, t: w.turn }); return { ok: true, pending: true }; }
    applyPeace(w, war, from, terms);
    return { ok: true, accepted: true };
  };
  W4.Act.answerPeace = (w, idx, yes) => {
    const o = (w.diplo.peaceOffers || [])[idx]; if (!o) return { ok: false };
    w.diplo.peaceOffers.splice(idx, 1);
    const war = w.wars.find(x => x.id === o.war); if (!war) return { ok: false, msg: '전쟁이 이미 끝났습니다' };
    if (yes) applyPeace(w, war, o.from, o.terms);
    return { ok: true };
  };
  function leave(w, war, id) {
    war.att = war.att.filter(x => x !== id); war.def = war.def.filter(x => x !== id);
    for (const s of w.state.regions) if (s.occ === id && (war.att.includes(s.owner) || war.def.includes(s.owner)) && !War.enemies(w, id).includes(s.owner)) s.occ = null;
    for (const s of w.state.regions) if (s.occ && w.state.regions && [...war.att, ...war.def].includes(s.occ) && s.owner === id) s.occ = null;
    for (const e of [...war.att, ...war.def]) addTruce(w, id, e);
    if (W4.Army) W4.Army.sendHome(w, id);
    w.nations[id].atWar = War.inWar(w, id);
  }
  const addTruce = (w, a, b) => { w.truces = (w.truces || []).filter(t => t.until > w.turn); w.truces.push({ a, b, until: w.turn + 24 }); };
  function applyPeace(w, war, from, terms) {
    const side = War.side(war, from), winners = side === 'att' ? war.att : war.def, losers = side === 'att' ? war.def : war.att;
    const lead = from, loserLead = side === 'att' ? war.lead[1] : war.lead[0];
    let text = '';
    if (terms.white) text = '백지 평화';
    else {
      for (const i of terms.cede || []) {
        const s = w.state.regions[i], prev = s.owner;
        // 점령한 국가에게 (동맹이 점령했으면 그 동맹에게)
        const to = winners.includes(s.occ) ? s.occ : lead;
        s.owner = to; s.occ = null; s.unrest = Math.max(s.unrest || 0, 40);
        w.nations[to].ae = (w.nations[to].ae || 0) + 4;
        w.nations[to].score.regionsTaken++; w.nations[prev].score.regionsLost++;
      }
      if (terms.gold) { const g = Math.min(terms.gold, Math.max(0, w.nations[loserLead].res.gold)); w.nations[loserLead].res.gold -= g; w.nations[lead].res.gold += g; }
      if (terms.vassal) D.addTreaty(w, 'vassal', lead, loserLead);
      text = [terms.cede && terms.cede.length ? `지역 ${terms.cede.length}곳 할양` : '', terms.gold ? `배상금 ${terms.gold}` : '', terms.vassal ? '종속' : ''].filter(Boolean).join(' · ');
    }
    // 남은 점령 해제
    for (const s of w.state.regions) if (s.occ && ((winners.includes(s.occ) && losers.includes(s.owner)) || (losers.includes(s.occ) && winners.includes(s.owner)))) s.occ = null;
    for (const a of war.att) for (const d of war.def) addTruce(w, a, d);
    w.wars.splice(w.wars.indexOf(war), 1);
    for (const id of [...war.att, ...war.def]) { w.nations[id].atWar = War.inWar(w, id); if (W4.Army) W4.Army.sendHome(w, id); }
    w.event(terms.white ? `🕊 ${war.name} 종전 — 백지 평화` : `🕊 ${war.name} 종전: ${w.def(lead).name} 측 승리 — ${text}`, 'peace', lead, { other: loserLead, war: war.id, terms });
    (w.warHistory = w.warHistory || []).push({ id: war.id, name: war.name, att: war.att.slice(), def: war.def.slice(), start: war.start, end: w.turn, winner: terms.white ? null : lead, score: war.score, terms: text, battles: war.battles.length, contrib: war.contrib || {} });
    checkDeaths(w);
  }
  War.applyPeace = applyPeace;
  // 멸망: 소유 지역이 없으면
  function checkDeaths(w) {
    for (const n of W4.NATIONS) {
      const N = w.nations[n.id]; if (!N.alive) continue;
      if (w.ownedRegions(n.id).length === 0) {
        N.alive = false; N.atWar = false;
        w.diplo.treaties = w.diplo.treaties.filter(t => t.a !== n.id && t.b !== n.id);
        for (const war of w.wars.slice()) { if (war.att.includes(n.id) || war.def.includes(n.id)) { war.att = war.att.filter(x => x !== n.id); war.def = war.def.filter(x => x !== n.id); if (war.lead.includes(n.id) || !war.att.length || !war.def.length) endWar(w, war); } }
        if (W4.Army) w.armies = w.armies.filter(a => a.owner !== n.id);
        if (w.fleets) w.fleets = w.fleets.filter(f => f.owner !== n.id);
        w.event(`☠ ${n.name} 멸망`, 'war', n.id);
      }
    }
  }
  War.checkDeaths = checkDeaths;
  function endWar(w, war) {
    const i = w.wars.indexOf(war); if (i < 0) return;
    for (const s of w.state.regions) if (s.occ && w.nations[s.owner].alive && ([...war.att, ...war.def].includes(s.occ))) s.occ = null;
    w.wars.splice(i, 1);
    for (const id of [...war.att, ...war.def]) { w.nations[id].atWar = War.inWar(w, id); if (W4.Army) W4.Army.sendHome(w, id); }
  }
  // 지도국이 수도까지 모두 점령당하면 강제 항복(전 지역 점령 상태면 점령지 할양)
  function capitulation(w, war) {
    for (const [k, lead] of war.lead.entries()) {
      const mine = w.ownedRegions(lead); if (!mine.length) continue;
      if (mine.every(i => w.state.regions[i].occ)) {
        const winner = war.lead[1 - k];
        applyPeace(w, war, winner, { cede: mine.filter(i => (k === 0 ? war.def : war.att).includes(w.state.regions[i].occ)), anyRegion: true });
        return true;
      }
    }
    return false;
  }
  // 전선: 전쟁 중인 두 세력이 통제하는 인접 지역 쌍
  War.fronts = (w) => {
    const out = [];
    for (const r of w.map.regions) for (const j of r.nb) { if (j < r.id) continue; const a = w.controller(r.id), b = w.controller(j); if (a !== b && a !== 'neutral' && b !== 'neutral' && War.atWar(w, a, b)) out.push([r.id, j]); }
    return out;
  };

  W4.system({
    id: 'war', order: 50,
    init(w) { w.wars = []; w.truces = []; w.warHistory = []; w.warSeq = 0; },
    save(w, o) { o.wars = w.wars; o.truces = w.truces; o.warHistory = w.warHistory; o.warSeq = w.warSeq; },
    load(w, o) { w.wars = o.wars || []; w.truces = o.truces || []; w.warHistory = o.warHistory || []; w.warSeq = o.warSeq || 0; },
    month(w) {
      for (const war of w.wars.slice()) {
        if (!war.att.length || !war.def.length) { endWar(w, war); continue; }
        updateScore(w, war);
        if (capitulation(w, war)) continue;
        for (const id of [...war.att, ...war.def]) w.nations[id].exhaustion = Math.min(100, w.nations[id].exhaustion + 0.6);
      }
      w.truces = w.truces.filter(t => t.until > w.turn);
      if (w.diplo.peaceOffers) w.diplo.peaceOffers = w.diplo.peaceOffers.filter(o => w.turn - o.t < 3 && w.wars.some(x => x.id === o.war));
      checkDeaths(w);
    },
  });
})();
