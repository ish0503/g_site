// ─────────────────────────────────────────────
// 4.0 군단 — 편성(국가 → 군단 → 병과) · 모집 · 이동 · 보급/소모 · 유지비 · 전투 · 공성 · 점령
//   병력 단위: 대대(1,000명). 병과 5종: 보병·궁병·기병·공성·마법
//   군사 계층은 한 달을 W4.DAYS 단계로 나눠 진행한다 (이동·전투·공성).
//   교전: 같은 지역에 적대 군단 → 자동 계산(같은 상성·사기·지형 규칙) 또는 플레이어 교전이면
//         W4.Army.onPlayerBattle 훅(Phase 6: 실제 전투 엔진)으로 넘긴다.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, D = W4.Diplo, clamp = W4.clamp;
  W4.UNIT_CLASSES = {
    inf: { name: '보병', icon: '🛡', cost: { gold: 20, iron: 3 }, mp: 1, atk: 1.0, def: 1.25, upkeep: 0.4, food: 0.3, speed: 1 },
    arc: { name: '궁병', icon: '🏹', cost: { gold: 24, wood: 5 }, mp: 1, atk: 1.25, def: 0.8, upkeep: 0.45, food: 0.3, speed: 1 },
    cav: { name: '기병', icon: '🐎', cost: { gold: 40, horses: 5, iron: 2 }, mp: 1, atk: 1.5, def: 1.0, upkeep: 0.8, food: 0.5, speed: 1.6 },
    sie: { name: '공성', icon: '🪨', cost: { gold: 50, wood: 10, iron: 5 }, mp: 0.5, atk: 0.6, def: 0.5, upkeep: 0.9, food: 0.2, speed: 0.7, siege: 3 },
    mag: { name: '마법', icon: '🔮', cost: { gold: 45, mana: 6 }, mp: 0.5, atk: 1.7, def: 0.7, upkeep: 0.9, food: 0.2, speed: 1 },
  };
  const CLS = Object.keys(W4.UNIT_CLASSES);
  const GEN_NAMES = ['알도', '베른', '카시아', '도렌', '엘마', '페릭', '그라임', '헬라', '이도르', '자렌', '켈', '루나', '마로스', '니벨', '오린', '프레야', '퀸트', '레아', '시온', '타라', '울릭', '베일', '윈', '제노'];
  const GEN_TRAITS = { 0: '없음', attacker: '공격 지휘 (+10% 공격)', defender: '방어 지휘 (+15% 방어)', logistician: '병참 (소모 절반)', sieger: '공성 전문 (+50% 공성)', swift: '신속 (+30% 이동)' };
  W4.GEN_TRAITS = GEN_TRAITS;
  const A = W4.Army = {};

  A.size = (a) => CLS.reduce((s, k) => s + (a.u[k] || 0), 0);
  A.list = (w, id) => w.armies.filter(a => a.owner === id);
  A.at = (w, i) => w.armies.filter(a => a.loc === i);
  // 전투력: 병과 공격·방어 × 국가 군사 수정자 × 사기 × 보급 × 장군
  A.power = (w, a, defending = false) => {
    const M = w.nations[a.owner].mods || {};
    let atk = 0, def = 0;
    for (const k of CLS) { const C = W4.UNIT_CLASSES[k], n = a.u[k] || 0; atk += n * C.atk * (k === 'cav' ? 1 + (M.cav || 0) : 1); def += n * C.def; }
    const g = a.gen || { skill: 1 }, gk = 1 + (g.skill - 1) * 0.06 + (g.trait === 'attacker' && !defending ? 0.1 : 0) + (g.trait === 'defender' && defending ? 0.15 : 0);
    return (atk * 0.55 + def * 0.45) * (1 + (M.mil || 0)) * (0.4 + 0.6 * a.morale) * (0.5 + 0.5 * a.supply) * gk;
  };
  W4.milPower = (w, id) => A.list(w, id).reduce((s, a) => s + A.power(w, a), 0) * 4 + w.nations[id].manpower * 0.5;

  // 통행 가능: 자국·동맹·종주/종속국·통행권·전쟁 상대·중립(정복 대상)
  A.canEnter = (w, id, i) => {
    const s = w.state.regions[i], ctrl = s.occ || s.owner;
    if (ctrl === id || s.owner === id) return true;
    if (ctrl === 'neutral') return true;
    if (W4.War.atWar(w, id, ctrl) || W4.War.atWar(w, id, s.owner)) return true;
    if (D.has(w, 'alliance', id, ctrl) && W4.War.inWar(w, id)) return true;
    if (D.overlord(w, ctrl) === id || D.overlord(w, id) === ctrl) return true;
    if (D.has(w, 'access', ctrl, id)) return true;
    return false;
  };
  const hostile = (w, id, i) => { const s = w.state.regions[i], c = s.occ || s.owner; return c === 'neutral' || W4.War.atWar(w, id, c); };
  A.hostile = hostile;

  // ── 모집 ──
  W4.Act = W4.Act || {};
  A.recruitCost = (w, id, cls, n) => { const C = W4.UNIT_CLASSES[cls], c = {}; for (const k in C.cost) c[k] = C.cost[k] * n; c.manpower = C.mp * n; return c; };
  W4.Act.recruit = (w, id, i, cls, n = 1, armyId = null) => {
    const N = w.nations[id], s = w.state.regions[i], r = w.map.regions[i], C = W4.UNIT_CLASSES[cls];
    if (!C || n < 1) return { ok: false, msg: '잘못된 병과' };
    if (s.owner !== id || s.occ) return { ok: false, msg: '자국이 통제하는 지역에서만 모집' };
    if (!W4.cityOf(w, i) && !(s.bld && s.bld.barracks)) return { ok: false, msg: '도시나 병영이 있는 지역에서만 모집' };
    const cost = A.recruitCost(w, id, cls, n);
    if (N.manpower < cost.manpower) return { ok: false, msg: '인력 부족' };
    for (const k in C.cost) if ((N.res[k] || 0) < cost[k]) return { ok: false, msg: `${W4.RES[k].name} 부족` };
    for (const k in C.cost) N.res[k] -= cost[k];
    N.manpower -= cost.manpower;
    let a = armyId != null ? w.armies.find(x => x.id === armyId && x.owner === id && x.loc === i) : A.at(w, i).find(x => x.owner === id && x.mode !== 'move');
    if (!a) a = A.create(w, id, i);
    a.u[cls] = (a.u[cls] || 0) + n; a.train = Math.max(a.train || 0, 1);
    return { ok: true, army: a };
  };
  A.create = (w, id, i, u = {}) => {
    const a = { id: (w.armySeq = (w.armySeq || 0) + 1), owner: id, loc: i, u: Object.assign({ inf: 0, arc: 0, cav: 0, sie: 0, mag: 0 }, u), morale: 1, supply: 1, path: [], prog: 0, mode: 'idle', siege: 0, train: 0, xp: 0,
      gen: { name: w.pick(GEN_NAMES), skill: 1 + Math.floor(w.rand() * 3), trait: w.pick(Object.keys(GEN_TRAITS).filter(k => k !== '0')) } };
    a.name = `제${A.list(w, id).length + 1}군단`;
    w.armies.push(a);
    return a;
  };
  W4.Act.disband = (w, id, armyId) => { const a = w.armies.find(x => x.id === armyId && x.owner === id); if (!a) return { ok: false }; w.nations[id].manpower += A.size(a) * 0.5; w.armies.splice(w.armies.indexOf(a), 1); return { ok: true }; };
  W4.Act.merge = (w, id, aId, bId) => {
    const a = w.armies.find(x => x.id === aId && x.owner === id), b = w.armies.find(x => x.id === bId && x.owner === id);
    if (!a || !b || a.loc !== b.loc) return { ok: false, msg: '같은 지역의 자국 군단만 합칠 수 있습니다' };
    for (const k of CLS) a.u[k] += b.u[k];
    a.morale = Math.min(a.morale, b.morale); a.supply = Math.min(a.supply, b.supply); if (b.gen.skill > a.gen.skill) a.gen = b.gen;
    w.armies.splice(w.armies.indexOf(b), 1); return { ok: true };
  };
  W4.Act.move = (w, id, armyId, dest) => {
    const a = w.armies.find(x => x.id === armyId && x.owner === id); if (!a) return { ok: false, msg: '군단 없음' };
    if (a.loc === dest) { a.path = []; a.mode = 'idle'; return { ok: true }; }
    const p = W4.path(w.map, a.loc, dest, (i) => A.canEnter(w, id, i));
    if (!p) return { ok: false, msg: W4.Naval ? '육로가 없습니다 (해상 수송 필요)' : '갈 수 없는 곳입니다' };
    if (!A.canEnter(w, id, dest)) return { ok: false, msg: '통행권이 없습니다' };
    a.path = p.slice(1); a.mode = 'move'; a.siege = 0; a.prog = 0;
    return { ok: true, path: p };
  };

  // ── 보급: 자국/동맹 영토면 보충, 적지는 우리 통제 영토와 연결돼 있으면 천천히, 끊기면 빠르게 감소 ──
  function connected(w, id, from) {
    const seen = new Set([from]), q = [from];
    const friendly = (i) => { const c = w.controller(i); return c === id || D.has(w, 'alliance', id, c) || D.overlord(w, c) === id || D.overlord(w, id) === c; };
    while (q.length) {
      const x = q.pop();
      if (w.state.regions[x].owner === id && !w.state.regions[x].occ) return true;
      for (const y of w.map.regions[x].nb) if (!seen.has(y) && friendly(y) && !A.at(w, y).some(b => W4.War.atWar(w, id, b.owner))) { seen.add(y); q.push(y); }
    }
    return false;
  }
  function monthArmies(w) {
    for (const a of w.armies.slice()) {
      const N = w.nations[a.owner], M = N.mods || {}, size = A.size(a);
      if (size <= 0.05) { w.armies.splice(w.armies.indexOf(a), 1); continue; }
      // 유지비 (금·식량) — 국고가 비면 사기 하락
      let up = 0, food = 0; for (const k of CLS) { up += a.u[k] * W4.UNIT_CLASSES[k].upkeep; food += a.u[k] * W4.UNIT_CLASSES[k].food; }
      up *= 1 - (M.upkeep || 0);
      N.spentNext.gold = (N.spentNext.gold || 0) + up; N.spentNext.food = (N.spentNext.food || 0) + food;
      if (N.res.gold < 0 || N.res.food <= 0) a.morale = Math.max(0.2, a.morale - 0.1);
      // 보급
      const s = w.state.regions[a.loc], ctrl = s.occ || s.owner;
      const home = ctrl === a.owner || D.has(w, 'alliance', a.owner, ctrl) || D.overlord(w, ctrl) === a.owner || D.overlord(w, a.owner) === ctrl || D.has(w, 'access', ctrl, a.owner);
      if (home) a.supply = Math.min(1, a.supply + 0.35);
      else a.supply = clamp(a.supply - (connected(w, a.owner, a.loc) ? 0.05 : 0.2) * (a.gen.trait === 'logistician' ? 0.5 : 1), 0, 1);
      a.cutOff = !home && !connected(w, a.owner, a.loc);
      // 소모 (보급 부족·험지)
      const terr = W4.TERRAIN[w.map.regions[a.loc].terrain];
      let att = (a.supply < 0.3 ? 0.05 : 0) + (terr.move > 1.7 && !home ? 0.015 : 0);
      if (att) { const lost = size * att * (a.gen.trait === 'logistician' ? 0.5 : 1); scale(a, 1 - lost / size); N.score.casualties += lost; }
      // 사기 회복 (휴식)
      if (a.mode !== 'move' && home) a.morale = Math.min(1, a.morale + 0.15);
      if (a.train > 0) a.train--;
    }
  }
  const scale = (a, k) => { for (const c of CLS) a.u[c] = Math.max(0, a.u[c] * k); };

  // ── 일 단위: 이동 → 교전 → 공성 ──
  function dayArmies(w) {
    for (const a of w.armies) {
      if (a.mode !== 'move' || !a.path.length || a.train > 0) continue;
      const nxt = a.path[0];
      if (!A.canEnter(w, a.owner, nxt)) { a.path = []; a.mode = 'idle'; continue; }
      const slow = Math.min(...CLS.filter(k => a.u[k] > 0.05).map(k => W4.UNIT_CLASSES[k].speed));
      a.prog += (Number.isFinite(slow) ? slow : 1) * (a.gen.trait === 'swift' ? 1.3 : 1) * 1.1 / W4.TERRAIN[w.map.regions[nxt].terrain].move;
      if (a.prog >= 1) {
        a.prog = 0; a.loc = nxt; a.path.shift(); a.siege = 0;
        if (!a.path.length) a.mode = 'idle';
        a.morale = Math.max(0.3, a.morale - 0.02);
        // 적 군단을 만나면 이동 정지
        if (A.at(w, a.loc).some(b => b.owner !== a.owner && W4.War.atWar(w, a.owner, b.owner))) { a.path = []; a.mode = 'idle'; }
      }
    }
    // 교전: 지역마다 적대 세력이 같이 있으면 한 번
    const locs = new Set(w.armies.map(a => a.loc));
    for (const i of locs) {
      const here = A.at(w, i);
      if (here.length < 2) continue;
      const owners = [...new Set(here.map(a => a.owner))];
      let pair = null;
      for (let x = 0; x < owners.length && !pair; x++) for (let y = x + 1; y < owners.length; y++) if (W4.War.atWar(w, owners[x], owners[y])) { pair = [owners[x], owners[y]]; break; }
      if (!pair) continue;
      const war = W4.War.of(w, pair[0], pair[1]);
      // 지역 통제국 쪽이 방어측 (지형·요새 보너스)
      const ctrl = w.controller(i);
      const sideOf = (o) => (W4.War.side(war, o) === W4.War.side(war, pair[0]) ? 0 : 1);
      const sides = [[], []]; for (const a of here) { if (!W4.War.atWar(w, a.owner, pair[1 - sideOf(a.owner)]) && a.owner !== pair[0] && a.owner !== pair[1]) continue; sides[sideOf(a.owner)].push(a); }
      if (!sides[0].length || !sides[1].length) continue;
      const defSide = sides[1].some(a => a.owner === ctrl || W4.War.side(war, a.owner) === W4.War.side(war, ctrl)) ? 1 : 0;
      const atk = sides[1 - defSide], dfn = sides[defSide];
      const player = w.player && [...atk, ...dfn].some(a => a.owner === w.player);
      if (player && A.onPlayerBattle && !w.flags.autoBattles) { const r = A.onPlayerBattle(w, i, atk, dfn); if (r === 'pause') { w.paused = { battle: i, att: atk.map(a => a.id), def: dfn.map(a => a.id) }; return; } }
      resolve(w, i, atk, dfn);
    }
    // 공성: 적대 지역에 홀로 있는 군단
    for (const a of w.armies) {
      if (a.mode === 'move' || a.train > 0) continue;
      const s = w.state.regions[a.loc], ctrl = s.occ || s.owner;
      if (ctrl === a.owner) continue;
      // 자국 영토가 점령당해 있으면 탈환, 아니면 적대 지역 공성
      const liberating = s.owner === a.owner || (D.has(w, 'alliance', a.owner, s.owner) && W4.War.atWar(w, a.owner, ctrl));
      if (!liberating && !hostile(w, a.owner, a.loc)) continue;
      if (A.at(w, a.loc).some(b => b.owner !== a.owner && W4.War.atWar(w, a.owner, b.owner))) continue;
      const M = w.nations[a.owner].mods || {};
      const fort = s.fort || 0, garrison = ctrl === 'neutral' ? 1 + s.dev * 0.3 : 0;
      a.mode = 'siege';
      a.siege += (1 + (a.u.sie || 0) * W4.UNIT_CLASSES.sie.siege + A.size(a) * 0.08) * (1 + (M.siege || 0)) * (a.gen.trait === 'sieger' ? 1.5 : 1) / (1 + fort * 1.6 + garrison);
      if (a.siege >= 3) occupy(w, a, a.loc);
    }
  }
  function occupy(w, a, i) {
    const s = w.state.regions[i], r = w.map.regions[i], prev = s.occ || s.owner;
    a.siege = 0; a.mode = 'idle';
    if (s.owner === 'neutral') {                         // 중립 영지 병합
      s.owner = a.owner; s.occ = null; s.unrest = 30; w.nations[a.owner].ae = (w.nations[a.owner].ae || 0) + 3;
      w.event(`${w.def(a.owner).name}: ${r.name} 병합`, 'war', a.owner, { region: i });
    } else if (s.owner === a.owner || (s.occ && (s.owner === a.owner || D.has(w, 'alliance', a.owner, s.owner)))) {
      s.occ = null; w.event(`${r.name} 탈환 (${w.def(a.owner).name})`, 'war', a.owner, { region: i });
    } else {
      s.occ = a.owner; s.fort = Math.max(0, (s.fort || 0) - (s.fort > 1 ? 1 : 0));
      w.event(`${w.def(a.owner).name}: ${r.name} 점령${r.city && r.city.capital ? ' (수도!)' : ''}`, 'war', a.owner, { region: i, other: prev });
    }
    a.xp += 0.5;
    if (W4.onOccupy) W4.onOccupy(w, i, a.owner, prev);
  }
  A.occupy = occupy;
  // 자동 전투 계산: 몇 라운드 동안 서로의 전투력에 비례한 손실, 사기 붕괴 시 패배
  function resolve(w, i, atk, dfn, forced) {
    const r = w.map.regions[i], s = w.state.regions[i], T = W4.TERRAIN[r.terrain];
    const defBonus = 1 + T.def + (s.fort || 0) * 0.08;
    const P = (side, defending) => side.reduce((x, a) => x + A.power(w, a, defending), 0) * (defending ? defBonus : 1) * (0.9 + w.rand() * 0.2);
    const size0 = [atk.reduce((x, a) => x + A.size(a), 0), dfn.reduce((x, a) => x + A.size(a), 0)];
    let pa = P(atk, false), pd = P(dfn, true);
    let ma = 1, md = 1;
    for (let round = 0; !forced && round < 6 && ma > 0.25 && md > 0.25; round++) {
      const la = pd / (pa + pd) * 0.12, ld = pa / (pa + pd) * 0.12;
      for (const a of atk) scale(a, 1 - la); for (const a of dfn) scale(a, 1 - ld);
      ma -= ld < la ? (la - ld) * 3 + 0.05 : 0.05; md -= la < ld ? (ld - la) * 3 + 0.05 : 0.05;
      pa = P(atk, false); pd = P(dfn, true);
    }
    const winSide = forced ? forced.winner : (ma >= md ? 'att' : 'def');
    const W = winSide === 'att' ? atk : dfn, L = winSide === 'att' ? dfn : atk;
    if (forced) { for (const [list, k] of [[atk, forced.attLeft], [dfn, forced.defLeft]]) if (k != null) for (const a of list) scale(a, k); }
    const size1 = [atk.reduce((x, a) => x + A.size(a), 0), dfn.reduce((x, a) => x + A.size(a), 0)];
    const lost = [size0[0] - size1[0], size0[1] - size1[1]];
    for (const a of W) { a.morale = Math.max(0.2, a.morale - 0.1); a.xp += 1; if (a.gen && w.rand() < 0.15) a.gen.skill = Math.min(5, a.gen.skill + 1); }
    for (const a of L) { a.morale = Math.max(0.05, a.morale - 0.45); retreat(w, a); }
    const wo = W[0].owner, lo = L[0].owner;
    w.nations[wo].score.battlesWon++; w.nations[lo].score.battlesLost++;
    for (let k = 0; k < 2; k++) { const own = (k ? dfn : atk)[0].owner; w.nations[own].score.casualties += lost[k]; w.nations[own === wo ? lo : wo].score.kills += lost[k]; }
    const rec = { t: w.turn, d: w.day, region: i, att: atk[0].owner, def: dfn[0].owner, attSize: +size0[0].toFixed(1), defSize: +size0[1].toFixed(1), attLost: +lost[0].toFixed(1), defLost: +lost[1].toFixed(1), winner: wo, lostW: winSide === 'att' ? lost[0] : lost[1], lostL: winSide === 'att' ? lost[1] : lost[0], real: !!forced, replay: forced && forced.replay || null };
    W4.War.onBattle(w, rec);
    w.event(`⚔ ${r.name} 전투: ${w.def(wo).name} 승리 (${(winSide === 'att' ? size0[0] : size0[1]).toFixed(1)}k vs ${(winSide === 'att' ? size0[1] : size0[0]).toFixed(1)}k, 손실 ${rec.lostW.toFixed(1)}k / ${rec.lostL.toFixed(1)}k)`, 'battle', wo, { other: lo, region: i, battle: rec });
    // 전멸에 가까우면 해산
    w.armies = w.armies.filter(a => A.size(a) > 0.15);
    return rec;
  }
  A.resolve = resolve;
  function retreat(w, a) {
    const r = w.map.regions[a.loc];
    const safe = r.nb.filter(j => { const c = w.controller(j); return (c === a.owner || D.has(w, 'alliance', a.owner, c)) && !A.at(w, j).some(b => W4.War.atWar(w, a.owner, b.owner)); });
    if (!safe.length) { scale(a, 0.5); a.morale = 0.05; }              // 퇴로 없음: 절반 손실
    else { a.loc = safe[(w.rand() * safe.length) | 0]; }
    a.path = []; a.mode = 'idle'; a.siege = 0;
  }
  // 평화 후 적지에 있는 군단을 가장 가까운 자국 지역으로
  A.sendHome = (w, id) => {
    const mine = w.ownedRegions(id); if (!mine.length) return;
    for (const a of A.list(w, id)) {
      if (A.canEnter(w, id, a.loc) && !hostile(w, id, a.loc)) continue;
      let best = mine[0], bd = Infinity; const r = w.map.regions[a.loc];
      for (const j of mine) { const g = w.map.regions[j], d = (g.x - r.x) ** 2 + (g.y - r.y) ** 2; if (d < bd) { bd = d; best = j; } }
      a.loc = best; a.path = []; a.mode = 'idle'; a.siege = 0;
    }
  };

  W4.system({
    id: 'armies', order: 45,
    init(w) {
      w.armies = [];
      // 초기 군대: 수도에 군단 하나 (국가 성향에 따라 구성)
      for (const n of W4.NATIONS) {
        const cap = w.map.nations[n.id].capital, f = n.fam;
        const u = { inf: 6, arc: 3, cav: n.traits.includes('horselords') ? 3 : 1, sie: 0, mag: f.includes('pentagon') || f.includes('hexagon') ? 2 : 0 };
        A.create(w, n.id, cap, u);
      }
    },
    save(w, o) { o.armies = w.armies; o.armySeq = w.armySeq; },
    load(w, o) { w.armies = o.armies || []; w.armySeq = o.armySeq || w.armies.length; },
    day(w) { dayArmies(w); },
    month(w) { monthArmies(w); },
  });
})();
