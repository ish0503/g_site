// ─────────────────────────────────────────────
// 3.1 전술 AI — 지휘관 AI 고도화 (3.0 의 aiCommand 는 aiCommandLegacy 로 보존)
//   · 적 편성 분석 → 상성 대응 (원거리 편중 → 돌격+후방 기습, 근접 편중 → 방어선+사격, 기병 → 창병 전열, 비행 → 대공 우선)
//   · 지형 활용: 방어 지점은 언덕·요새·숲을 우선
//   · 국지 우세 판단: 전선 구역별 전력비 → 밀리는 구역에 증원, 무너진 적 구역으로 돌파
//   · 핵심 목표 사냥: 적 지휘관·보스·치유사·마법사를 기동대가 집중 공격
//   · 부대 단위 후퇴·재집결 판단, 명령 최소 유지 시간(진동 방지)
//   · 상황별 학습: 적 편성 유형마다 어떤 전략이 이겼는지 기록
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  const { clamp, dist2 } = SW.util;
  P.aiCommandLegacy = P.aiCommand;

  const roleOf = (s) => {
    const c = s.cls || {}; const g = (k) => c[k] || 0;
    const front = g('front') + g('tank'), ranged = g('ranged') + g('caster'), mobile = g('assassin') + g('flyer'), sup = g('support');
    const m = Math.max(front, ranged, mobile, sup);
    return m === front ? 'front' : m === ranged ? 'ranged' : m === mobile ? 'mobile' : 'support';
  };
  // 편성 분석
  P.analyzeArmy = function (team) {
    const r = { n: 0, front: 0, ranged: 0, mobile: 0, flyer: 0, cav: 0, tank: 0, heal: 0, lancer: 0, magic: 0 };
    for (const u of this.teams[team]) {
      if (u.def.structure) continue;
      const d = u.def; r.n++;
      if (d.cls === 'front' || d.cls === 'tank') r.front++;
      if (d.cls === 'ranged' || d.cls === 'caster') r.ranged++;
      if (d.cls === 'assassin' || d.cls === 'flyer') r.mobile++;
      if (d.flying) r.flyer++;
      if (d.role === 'charger' || d.charge) r.cav++;
      if (d.cls === 'tank') r.tank++;
      if (d.attack === 'heal' || d.healPulse) r.heal++;
      if (d.role === 'lancer' || d.bonusVsBig || d.antiCharge) r.lancer++;
      if (d.dmgType === 'magic') r.magic++;
    }
    const n = Math.max(1, r.n);
    for (const k of Object.keys(r)) if (k !== 'n') r[k + 'F'] = r[k] / n;
    return r;
  };
  // 편성 서명 (학습용): 적의 지배적 성향
  SW.compSig = (an) => an.flyerF > 0.2 ? 'air' : an.rangedF > 0.45 ? 'ranged' : an.cavF > 0.25 ? 'cav' : an.tankF > 0.3 ? 'tank' : an.mobileF > 0.3 ? 'mobile' : 'line';
  // 핵심 목표: 지휘관·보스·치유사·고화력 마법사·공성
  P.keyTargets = function (team) {
    const list = [];
    for (const e of this.teams[1 - team]) {
      if (e.stealthed || e.def.structure) continue;
      const d = e.def;
      let v = e.commander ? 5 : d.boss ? 6 : (d.attack === 'heal' || d.healPulse) ? 3 : d.role === 'mage' ? 2.5 : d.role === 'siege' ? 2 : d.role === 'sniper' ? 2 : d.role === 'summoner' ? 2 : 0;
      if (v) list.push([e, v * (1.4 - e.hp / e.maxHp * 0.4)]);
    }
    return list.sort((a, b) => b[1] - a[1]).map(x => x[0]);
  };
  // 방어하기 좋은 지형 (언덕·요새·숲) 탐색
  P.goodSpot = function (x, y, R = 240, prefer = ['hill', 'fort', 'forest']) {
    const T = this.terrain; if (!T) return null;
    let best = null, bs = 0;
    for (let dy = -R; dy <= R; dy += 40) for (let dx = -R; dx <= R; dx += 40) {
      const px = clamp(x + dx, 30, this.W - 30), py = clamp(y + dy, 30, this.H - 30), t = T.at(px, py);
      const k = prefer.indexOf(t.id); if (k < 0) continue;
      const s = (prefer.length - k) - Math.hypot(dx, dy) / R;
      if (s > bs) { bs = s; best = { x: px, y: py, kind: t.id }; }
    }
    return best;
  };

  P.aiCommand = function (team) {
    const A = this.ai[team];
    if (A.legacy) return this.aiCommandLegacy(team);
    const squads = this.squads.filter(s => s.team === team && s.alive > 0);
    if (!squads.length) return;
    const my = this.teamInfo[team], en = this.teamInfo[1 - team], dir = team === 0 ? 1 : -1;
    A.mem = A.mem || {};
    const say = (txt, key = txt) => { if (!A.flags[key]) { A.flags[key] = true; this.logEvent(`${team ? '적' : '아군'} AI: ${txt}`, team, 'ai'); } };
    // 명령 (최소 유지 4초, 같은 과업이면 재명령하지 않음)
    const order = (s, type, params, task, force) => {
      const m = A.mem[s.id] || (A.mem[s.id] = { since: -99, task: '' });
      if (!force && m.task === task) return false;
      if (!force && this.time - m.since < 4) return false;
      m.since = this.time; m.task = task;
      this.setOrder(s.id, type, params || {});
      return true;
    };
    const cmdSq = my.commander && my.commander.sq !== undefined ? my.commander.sq : -1;
    const by = { front: [], ranged: [], mobile: [], support: [] };
    for (const s of squads) if (s.id !== cmdSq) by[s.role || (s.role = roleOf(s))].push(s);
    const front = by.front.sort((a, b) => b.alive - a.alive);
    // 지휘부: 군 중심 뒤를 따라간다
    if (cmdSq >= 0) {
      let fx = 0, fy = 0, fn = 0; for (const s of squads) if (s.id !== cmdSq) { fx += s.cx * s.alive; fy += s.cy * s.alive; fn += s.alive; }
      const cs = this.squads[cmdSq], c = my.commander;
      let th = 0; this.enemiesIn(c.x, c.y, 170, team, () => { th++; });
      if (th >= 4 && cs.order.type !== 'retreat') { this.setOrder(cmdSq, 'retreat'); say('지휘관 후퇴'); }
      else if (fn && cs.order.type !== 'retreat') { const hx = clamp(fx / fn - dir * 240, 30, this.W - 30), hy = clamp(fy / fn, 40, this.H - 40); if (cs.order.type !== 'hold') cs.order = { type: 'hold', x: hx, y: hy, stage: 0, t: this.time }; else { cs.order.x = hx; cs.order.y = hy; } }
    }
    // 분석 (3초마다)
    if (!A.an || this.time - A.anT > 3) { A.an = { me: this.analyzeArmy(team), en: this.analyzeArmy(1 - team) }; A.anT = this.time; if (!A.sig) A.sig = SW.compSig(A.an.en); }
    const { me, en: E } = A.an;
    const pr = this.teamPower(team) / Math.max(1, this.teamPower(1 - team)); A.pr = pr;

    // ── 초기 계획: 상성 대응 + 성향 ──
    if (!A.plan) {
      A.plan = true;
      const OFF0 = A.off || {};
      let stance = A.pers === 'defensive' || A.pers === 'artillery' ? 'defend' : 'attack';
      if (OFF0.stance) { /* 상성 판단 끔 */ }
      else if (E.rangedF > 0.45) { stance = 'attack'; say('적 원거리 편중 — 거리를 좁혀 돌격'); }
      else if (E.front > 0 && E.frontF > 0.55 && me.rangedF > 0.35) { stance = 'defend'; say('적 근접 편중 — 방어선 뒤에서 사격'); }
      const lineX = my.cx + dir * 90;
      front.forEach((s, i) => {
        const lancers = (s.cls.front || 0) && this.units.some(u => u.sq === s.id && (u.def.role === 'lancer' || u.def.antiCharge));
        if (E.cavF > 0.25 && lancers) { const sp = this.goodSpot(lineX, s.cy) || { x: lineX, y: s.cy }; order(s, 'hold', sp, 'anticav', true); say('적 기병 다수 — 창병 방어선'); return; }
        if (stance === 'defend') { const sp = this.goodSpot(lineX, s.cy) || { x: lineX, y: s.cy }; order(s, 'hold', sp, 'line', true); if (sp.kind) say(`방어선을 ${SW.TERRAIN_TYPES[SW.TERRAIN_ID[sp.kind]].name}에 구축`); }
        else if (A.pers === 'flanker' && i > 0) order(s, 'flank', {}, 'flank', true);
        else if (front.length >= 3 && i === front.length - 1 && A.pers !== 'aggressive') { order(s, 'reserve', {}, 'reserve', true); A.reserve = s.id; }
        else order(s, 'attack', {}, 'attack', true);
      });
      for (const s of by.ranged) {
        const sp = this.goodSpot(my.cx - dir * 20, s.cy, 260, ['hill', 'fort', 'forest']) || { x: my.cx - dir * 30, y: s.cy };
        order(s, A.pers === 'aggressive' && stance === 'attack' ? 'attack' : 'hold', sp, 'fire', true);
        if (OFF0.prefer) { /* 선호 목표 끔 */ }
        else if (E.flyerF > 0.2) { s.prefer = 'flyer'; say('적 비행 유닛 — 대공 사격 우선'); }
        else if (E.tankF > 0.3 && s.cls.caster) { s.prefer = 'tank'; say('적 중장갑 — 마법 화력 집중'); }
      }
      for (const s of by.mobile) {
        if (E.heal >= 3) s.prefer = 'support';
        if (stance === 'defend' && A.pers === 'defensive') { order(s, 'reserve', {}, 'reserve', true); if (A.reserve === undefined) A.reserve = s.id; }
        else order(s, E.rangedF > 0.3 || A.pers === 'aggressive' || A.pers === 'flanker' ? 'rear' : 'flank', {}, 'raid', true);
      }
      for (const s of by.support) if (front[0]) order(s, 'escort', { squad: front[0].id }, 'escort', true);
      say(`${SW.AI_PERSONALITIES[A.pers] ? SW.AI_PERSONALITIES[A.pers].name : A.pers} 전략 개시 (상대 편성: ${({ air: '공중', ranged: '원거리', cav: '기병', tank: '중장갑', mobile: '기동', line: '보병' })[A.sig]})`);
      return;
    }

    // ── 동적 판단 ──
    const OFF = A.off || {};
    // 1) 부대 후퇴·재집결
    for (const s of (OFF.retreat ? [] : squads)) {
      if (s.id === cmdSq) continue;
      const m = A.mem[s.id] || (A.mem[s.id] = { since: -99, task: '' });
      if (m.task === 'retreat') {
        if (this.time - m.since > 7) { const tgt = front.find(f => f !== s && f.alive > 3) || s; order(s, 'hold', { x: clamp(tgt.cx - dir * 60, 30, this.W - 30), y: tgt.cy }, 'regroup', true); }
        continue;
      }
      if (s.n0 >= 4 && s.alive < s.n0 * 0.4) {
        let near = 0; this.enemiesIn(s.cx, s.cy, 220, team, () => { near++; });
        if (near > s.alive * 1.5 && near >= 4) {
          const safe = (my.commander && { x: my.commander.x, y: my.commander.y }) || { x: clamp(s.cx - dir * 300, 30, this.W - 30), y: s.cy };
          if (order(s, 'retreat', safe, 'retreat', true)) this.logEvent(`${team ? '적' : '아군'} AI: ${s.name} 후퇴 후 재집결`, team, 'ai');
        }
      }
    }
    // 2) 핵심 목표 사냥 (기동대)
    const keys = this.keyTargets(team);
    if (keys.length && !OFF.hunt) for (const s of by.mobile) {
      const m = A.mem[s.id]; if (m && m.task === 'retreat') continue;
      // (조정) 가까운(600px 이내) 핵심 목표만, 교전 중이 아닐 때 사냥 — 전장을 가로지르는 무리한 돌격 방지
      let engaged = 0; this.enemiesIn(s.cx, s.cy, 150, team, () => { engaged++; });
      if (engaged > 2) continue;
      const tgt = keys.find(k => k.alive && (k.x - s.cx) ** 2 + (k.y - s.cy) ** 2 < 600 * 600); if (!tgt) continue;
      if (order(s, 'focus', { target: tgt }, 'hunt:' + tgt.uid)) say(`핵심 목표 ${tgt.def.name} 사냥`, 'hunt' + tgt.uid);
    }
    // 3) 국지 우세: 밀리는 전선 구역에 증원, 무너진 적 구역 돌파
    if (this.front && !OFF.reinforce) {
      let worst = null, wr = 1;
      for (const [i, b] of this.front.bands.entries()) {
        const mine = b.c[team], theirs = b.c[1 - team];
        if (!b.contact || theirs < 6) continue;
        const ratio = mine / theirs; if (ratio < wr) { wr = ratio; worst = [i, b]; }
        if (b.fallen[1 - team]) {
          const s = by.mobile.find(q => !(A.mem[q.id] && A.mem[q.id].task.startsWith('hunt')));
          if (s) { const y = (b.y0 + b.y1) / 2; if (order(s, 'flank', {}, 'exploit' + i)) { s.order.w1 = { x: clamp(b.x + dir * 250, 40, this.W - 40), y }; s.order.w2 = null; say(`적 전선 붕괴 구역 ${i + 1} 돌파`, 'ex' + i); } }
        }
      }
      if (worst && wr < 0.6) {
        const [i, b] = worst, y = (b.y0 + b.y1) / 2, x = clamp((b.x || my.cx) - dir * 60, 30, this.W - 30);
        const cand = [A.reserve !== undefined ? this.squads[A.reserve] : null, ...front].filter(q => q && q.alive > 3 && q.id !== cmdSq && !(A.mem[q.id] && A.mem[q.id].task === 'retreat'));
        let pick = null, pd = 1e9;
        for (const q of cand) { let near = 0; this.enemiesIn(q.cx, q.cy, 300, team, () => { near++; }); if (near > 3 && q.id !== A.reserve) continue; const d = Math.abs(q.cy - y); if (d < pd) { pd = d; pick = q; } }
        if (pick && order(pick, 'rally', { x, y }, 'reinforce' + i)) { say(`전선 구역 ${i + 1} 열세 — ${pick.name} 증원`, 'rf' + i + pick.id); if (pick.id === A.reserve) A.reserveOut = true; }
      }
    }
    // 4) 원거리 부대 호위 (측면 위협)
    for (const r of by.ranged) {
      let threat = 0; this.enemiesIn(r.cx, r.cy, 200, team, (e) => { if (e.def.range <= 40) threat++; });
      if (threat >= 5) { const f = front.find(s => !(A.mem[s.id] && /^(escort|retreat)/.test(A.mem[s.id].task))) ; if (f && order(f, 'escort', { squad: r.id }, 'escort' + r.id)) say('측면 위협 감지 — 원거리 부대 호위', 'esc' + r.id); }
      // 원거리 방어선은 전열 뒤를 따라간다 (고지 우선)
      if (r.order.type === 'hold' && front[0] && front[0].alive) {
        const sp = this.goodSpot(front[0].cx - dir * 110, front[0].cy, 120, ['hill', 'fort']) || { x: front[0].cx - dir * 110, y: front[0].cy };
        r.order.x = clamp(sp.x, 30, this.W - 30); r.order.y = clamp(sp.y, 40, this.H - 40);
      }
    }
    // 4.5) 화력 집중: 아군 전열에 가장 가까운 '약한 적 부대'를 집중 공격 대상으로 지정 (란체스터 법칙)
    if (A.focusFire && !OFF.focus && this.squads) {      // 실험 기능: 기본 비활성 (거울전 시험에서 승률 개선 없음)
      const es = this.squads.filter(q => q.team !== team && q.alive > 0);
      const anchor = front[0] && front[0].alive ? front[0] : squads[0];
      let best = null, bs = Infinity;
      for (const q of es) {
        const d = Math.hypot(q.cx - anchor.cx, q.cy - anchor.cy);
        if (d > 700) continue;
        const sc = q.power * (1 + d / 400);
        if (sc < bs) { bs = sc; best = q; }
      }
      A.focusSq = best ? best.id : null;
      for (const q of [...by.ranged, ...front]) q.preferSq = A.focusSq;
    }
    // 5) 전세 판단: 예비대 · 지휘관 능력 · 총공격
    if (pr < 0.8 && A.reserve !== undefined && !A.reserveOut) { const rs = this.squads[A.reserve]; if (rs && rs.alive) { A.reserveOut = true; order(rs, 'attack', {}, 'commit', true); say('예비대 투입'); this.banner(`${team ? '적 ' : ''}예비대 투입!`, team ? '#ff9a9a' : '#9cc0ff', 1.4); } }
    if (pr < 0.65) { if (this.useCommand(team, 'ironwill', null)) say('전세 불리 — 철벽 명령'); if (pr < 0.45) this.useCommand(team, 'laststand', null); }
    if (pr > 1.3) { for (const s of squads) if (s.id !== cmdSq && (s.order.type === 'hold' || s.order.type === 'reserve') && !(A.mem[s.id] && A.mem[s.id].task === 'retreat')) order(s, 'attack', {}, 'push'); if (this.useCommand(team, 'charge', null)) say('전세 유리 — 총공격'); }
    if (by.ranged.length && this.time > 6) this.useCommand(team, 'volley', null);
    if (this.time > 20 && pr < 1 && me.cavF > 0.2) this.useCommand(team, 'haste', null);
  };

  // 부대 선호 목표 (대공 우선 등)
  const origScore = P.scoreTarget;
  P.scoreTarget = function (u, e, R, dd) {
    let s = origScore.call(this, u, e, R, dd);
    if (s >= 0 && u.sq !== undefined && this.squads) {
      const q = this.squads[u.sq];
      if (q && q.prefer && (q.prefer === 'flyer' ? e.def.flying : q.prefer === 'support' ? (e.def.cls === 'support') : e.def.cls === q.prefer)) s += 0.8;
      if (q && q.preferSq != null && e.sq === q.preferSq) s += 0.5;      // 화력 집중 대상 부대
    }
    return s;
  };

  // 상황별 학습: (전략, 상대 편성 서명) 별 전적
  const origRec = SW.recordLearn, origPick = SW.pickLearned;
  SW.recordLearn = (pers, won, vsPers, sig) => {
    origRec(pers, won, vsPers);
    if (!sig || !SW.save) return;
    const L = SW.save.data.aiLearn, r = L[pers]; if (!r) return;
    r.ctx = r.ctx || {}; const c = r.ctx[sig] || (r.ctx[sig] = { w: 0, n: 0 }); c.n++; if (won) c.w++;
  };
  SW.pickLearned = (vsPers, sig) => {
    if (!sig) return origPick(vsPers);
    const L = (SW.save && SW.save.data.aiLearn) || {};
    const keys = ['balanced', 'aggressive', 'defensive', 'flanker', 'artillery'];
    if (SW.util.rand() < 0.15) return keys[(SW.util.rand() * keys.length) | 0];
    let best = origPick(vsPers), bs = -1;
    for (const k of keys) { const c = L[k] && L[k].ctx && L[k].ctx[sig]; if (c && c.n >= 2) { const s = (c.w + 1) / (c.n + 2); if (s > bs) { bs = s; best = k; } } }
    return best;
  };
})();
