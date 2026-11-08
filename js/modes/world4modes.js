// ─────────────────────────────────────────────
// 4.0 게임 모드 · 승리/패배 · 커스텀 시나리오
//   conquest(세계 정복) · nationwar(국가 전쟁) · continental(대륙 전쟁) · worldwar(세계 대전)
//   aivsai(AI 대전 관전) · custom(커스텀 국가 시나리오) · sandbox(세계 샌드박스)
//   기존 모드(챌린지·샌드박스·3.0 캠페인 등)는 그대로 두고 4.0 세계 저장 슬롯만 사용한다.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo, War = W4.War;
  const contOf = (w, id) => w.def(id).cont;
  W4.SCENARIOS = {
    conquest: { name: '세계 정복', icon: '👑', desc: '한 국가를 골라 세계 지역의 60%(72곳)를 차지하면 승리. 국가가 멸망하면 패배.', pick: true },
    nationwar: { name: '국가 전쟁', icon: '⚔️', desc: '이웃 숙적과 전쟁 상태로 시작. 숙적을 멸망시키거나 평화 협상으로 3곳 이상 얻으면 승리 (10년).', pick: true },
    continental: { name: '대륙 전쟁', icon: '🗺', desc: '한 대륙에서만 전쟁이 벌어진다. 대륙 30곳 중 23곳(75%)을 차지하면 승리.', pick: true },
    worldwar: { name: '세계 대전', icon: '🌍', desc: '대륙을 가로지르는 두 진영(8 대 8)이 동맹을 맺고 8개 전쟁이 동시에 시작된다. 적 진영 수도 6곳을 점령하거나 차지하면 승리.', pick: true },
    aivsai: { name: 'AI 대전 (관전)', icon: '🤖', desc: '16개국 AI 가 스스로 경제·외교·전쟁을 운영한다. 자동 진행으로 관전.', pick: false },
    sandbox: { name: '세계 샌드박스', icon: '🛠', desc: '관전 + 샌드박스 도구: 지역 소유권 변경, 선전포고·평화, 자원 지급, 군단 생성.', pick: false },
  };
  // 시나리오별 초기 설정
  W4.newScenario = (kind, o = {}) => {
    const flags = {}, player = W4.SCENARIOS[kind] && W4.SCENARIOS[kind].pick ? o.player : null;
    let after = null;
    if (kind === 'continental') flags.activeCont = contOf({ def: (id) => W4.NATIONS[W4.NATION_INDEX[id]] }, o.player || W4.NATIONS[0].id);
    if (kind === 'nationwar') after = (w) => {
      const rival = o.rival || D.neighbors(w, player).sort((a, b) => D.rel(w, player, a) - D.rel(w, player, b))[0];
      w.flags.rival = rival; w.diplo.cb.push({ by: player, vs: rival, kind: 'claim', until: w.turn + 120 }); w.diplo.cb.push({ by: rival, vs: player, kind: 'claim', until: w.turn + 120 });
      W4.Act.declareWar(w, rival, player);
      w.flags.startRegions = w.ownedRegions(player).length;
    };
    if (kind === 'worldwar') after = (w) => {
      const blocs = [[], []];
      for (const K of W4.CONTINENTS) { const ns = W4.NATIONS.filter(n => n.cont === K.id).map(n => n.id); blocs[0].push(ns[0], ns[3]); blocs[1].push(ns[1], ns[2]); }
      w.flags.blocs = blocs;
      w.diplo.treaties = w.diplo.treaties.filter(t => !['nap', 'alliance'].includes(t.type));
      for (const b of blocs) for (const x of b) for (const y of b) if (x < y) D.addTreaty(w, 'alliance', x, y);
      // 대륙마다 두 쌍의 전쟁 → 8개 전쟁 (동맹이 서로 참전)
      for (const K of W4.CONTINENTS) { const ns = W4.NATIONS.filter(n => n.cont === K.id).map(n => n.id); for (const [a, d] of [[ns[0], ns[1]], [ns[3], ns[2]]]) if (!War.atWar(w, a, d)) W4.Act.declareWar(w, a, d, { noCallAllies: true }); }
    };
    if (kind === 'aivsai' || kind === 'sandbox') flags.autoBattles = true;
    const w = new W4.World({ seed: o.seed ?? W4.DEFAULT_SEED, player, diff: o.diff ?? 1, scenario: kind, flags, after, setup: o.setup });
    return w;
  };
  // 세계 대전: 동맹 자동 참전 대신 '대륙별 8개 전쟁'을 유지하기 위해 동맹 호출을 막는 옵션
  const origDeclare = W4.Act.declareWar;
  W4.Act.declareWar = (w, a, d, opts = {}) => {
    if (!opts.noCallAllies) return origDeclare(w, a, d, opts);
    const saved = w.diplo.treaties; w.diplo.treaties = saved.filter(t => t.type !== 'alliance' && t.type !== 'defense' && t.type !== 'guarantee');
    const r = origDeclare(w, a, d, opts); w.diplo.treaties = saved; return r;
  };

  // ── 승리·패배 판정 (월간) ──
  W4.checkObjective = (w) => {
    if (w.result) return w.result;
    const p = w.player;
    if (p && !w.nations[p].alive) return (w.result = { win: false, t: w.turn, text: `${w.def(p).name} 멸망` });
    const total = w.map.regions.length, own = (id) => w.ownedRegions(id).length;
    switch (w.scenario) {
      case 'conquest': if (p && own(p) >= Math.ceil(total * 0.6)) w.result = { win: true, t: w.turn, text: `세계 지역 ${own(p)}/${total} 차지 — 세계 정복!` }; break;
      case 'nationwar': {
        const r = w.flags.rival;
        if (r && !w.nations[r].alive) w.result = { win: true, t: w.turn, text: `숙적 ${w.def(r).name} 멸망` };
        else if (r && !War.atWar(w, p, r) && own(p) >= (w.flags.startRegions || 0) + 3) w.result = { win: true, t: w.turn, text: '평화 협상으로 영토 확장' };
        else if (w.turn >= 120) w.result = { win: false, t: w.turn, text: '10년 안에 목표를 이루지 못함' };
        break;
      }
      case 'continental': {
        const c = W4.CONTINENTS.findIndex(K => K.id === w.flags.activeCont);
        const mine = w.ownedRegions(p).filter(i => w.map.regions[i].cont === c).length;
        if (mine >= 23) w.result = { win: true, t: w.turn, text: `${W4.CONTINENTS[c].name} ${mine}/30 지배 — 대륙 통일!` };
        break;
      }
      case 'worldwar': {
        const blocs = w.flags.blocs; if (!blocs || !p) break;
        const mine = blocs[0].includes(p) ? 0 : 1, enemy = blocs[1 - mine];
        const held = enemy.filter(e => { const cap = w.map.nations[e].capital, s = w.state.regions[cap]; return blocs[mine].includes(s.occ || s.owner); }).length;
        if (held >= 6) w.result = { win: true, t: w.turn, text: `적 진영 수도 ${held}/8 장악 — 세계 대전 승리!` };
        break;
      }
    }
    if (w.result) w.event(w.result.win ? `🏆 승리: ${w.result.text}` : `💀 패배: ${w.result.text}`, 'war', p);
    return w.result;
  };
  W4.system({ id: 'objective', order: 95, month(w) { if (!w.resultSeen) W4.checkObjective(w); }, save(w, o) { o.result = w.result || null; o.resultSeen = !!w.resultSeen; }, load(w, o) { w.result = o.result; w.resultSeen = o.resultSeen; } });

  // ── 커스텀 시나리오 (편집기 데이터) ──
  // { name, seed, owners: {regionId: nationId|'neutral'}, nations: {id: {gold, gov}}, alliances: [[a,b]], wars: [[a,b]], player }
  W4.customWorld = (sc) => new W4.World({
    seed: sc.seed ?? W4.DEFAULT_SEED, player: sc.player || null, scenario: 'custom', flags: sc.player ? {} : { autoBattles: true },
    setup(w) { for (const [i, o] of Object.entries(sc.owners || {})) { const s = w.state.regions[+i]; if (!s) continue; s.owner = o; s.core = o; } },
    after(w) {
      for (const [id, v] of Object.entries(sc.nations || {})) { const N = w.nations[id]; if (!N) continue; if (v.gold != null) N.res.gold = v.gold; if (v.gov && W4.GOVERNMENTS[v.gov]) { N.gov = v.gov; W4.calcMods(w, id); } }
      for (const [a, b] of sc.alliances || []) if (w.nations[a] && w.nations[b]) D.addTreaty(w, 'alliance', a, b);
      // 지역이 없는 국가는 멸망, 수도를 잃은 국가의 군단은 남은 영토로
      War.checkDeaths(w);
      for (const n of W4.NATIONS) if (w.nations[n.id].alive) W4.Army.sendHome(w, n.id);
      for (const [a, b] of sc.wars || []) if (w.nations[a] && w.nations[b] && w.nations[a].alive && w.nations[b].alive) W4.Act.declareWar(w, a, b);
    },
  });
  W4.Act.sandbox = {
    setOwner: (w, i, id) => { const s = w.state.regions[i]; s.owner = id; s.occ = null; s.core = s.core || id; War.checkDeaths(w); return { ok: true }; },
    give: (w, id, res) => { for (const k in res) w.nations[id].res[k] = (w.nations[id].res[k] || 0) + res[k]; return { ok: true }; },
    army: (w, id, i) => { if (w.controller(i) !== id) return { ok: false, msg: '그 국가가 통제하는 지역이어야 합니다' }; return { ok: true, army: W4.Army.create(w, id, i, { inf: 10, arc: 4, cav: 3 }) }; },
    war: (w, a, b) => W4.Act.declareWar(w, a, b),
    peace: (w, warId) => { const war = w.wars.find(x => x.id === warId); if (!war) return { ok: false }; W4.War.applyPeace(w, war, war.lead[0], { white: true }); return { ok: true }; },
  };
})();
