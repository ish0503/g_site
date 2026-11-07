// ─────────────────────────────────────────────
// WAR SYSTEM — 부대 · 명령 · 지휘관 능력 · 전술 AI(지휘관 AI) · 전선 · 군대 편성기
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  const P = SW.Battle.prototype;
  const { rand, clamp, dist2 } = SW.util;

  SW.ORDERS = {
    free: { name: '자유 전투', icon: '✳️', desc: 'AI가 자율적으로 판단' },
    attack: { name: '전면 공격', icon: '⚔️', desc: '적군을 향해 진격 (후퇴하지 않음)' },
    hold: { name: '방어 유지', icon: '🛡️', desc: '지정 위치 사수, 범위 안의 적만 교전', point: true },
    retreat: { name: '후퇴', icon: '↩️', desc: '지정 위치로 철수', point: true },
    rally: { name: '집결', icon: '🚩', desc: '지정 지점에 집결 후 방어', point: true },
    focus: { name: '집중 공격', icon: '🎯', desc: '지정한 적 유닛을 우선 공격', unit: true },
    flank: { name: '측면 공격', icon: '↪️', desc: '적 측면으로 우회 후 공격' },
    rear: { name: '후방 기습', icon: '🗡️', desc: '적 후방으로 우회해 원거리·지원 유닛 기습' },
    escort: { name: '호위', icon: '🤝', desc: '지정 아군(부대)을 보호', ally: true },
    nochase: { name: '추격 금지', icon: '⛔', desc: '현재 지역을 벗어나지 않음' },
    reserve: { name: '예비대', icon: '⏸', desc: '대기하다가 투입 명령 시 공격', point: true },
  };
  SW.ORDER_ORDER = ['free', 'attack', 'hold', 'rally', 'retreat', 'focus', 'flank', 'rear', 'escort', 'nochase', 'reserve'];
  SW.SQUAD_COLORS = ['#ffd36b', '#7fe0ff', '#ff9ad5', '#9dff9d', '#ffb070', '#c9a8ff', '#ff7070', '#a0ffd8'];

  SW.CMD_ABILITIES = [
    { id: 'charge', name: '돌격 명령', icon: '⚔️', cd: 35, dur: 8, mods: { dmg: 0.25, speed: 0.15 }, morale: 15, desc: '8초간 공격력 +25%, 이동 +15%' },
    { id: 'ironwill', name: '철벽 명령', icon: '🛡️', cd: 35, dur: 8, mods: { armor: 4, projTaken: -0.25 }, morale: 10, desc: '8초간 방어력 +4, 투사체 피해 -25%' },
    { id: 'haste', name: '신속 명령', icon: '💨', cd: 30, dur: 8, mods: { speed: 0.35 }, desc: '8초간 이동속도 +35%' },
    { id: 'volley', name: '집중 사격', icon: '🏹', cd: 35, dur: 8, mods: { atkSpd: 0.4, dmg: 0.15 }, filter: 'ranged', desc: '원거리 유닛 공격속도 +40%, 공격력 +15%' },
    { id: 'fallback', name: '전술 후퇴', icon: '↩️', cd: 40, dur: 6, mods: { projTaken: -0.4, speed: 0.2 }, order: 'retreat', desc: '피해를 줄이며 후방으로 철수' },
    { id: 'laststand', name: '최후의 저항', icon: '🔥', cd: 60, dur: 10, mods: { dmg: 0.5, atkSpd: 0.3, lifesteal: 0.15 }, filter: 'low', morale: 40, desc: '병력이 절반 이하인 부대 대폭 강화' },
  ];

  // ── 부대 관리 ──
  P.initSquads = function () {
    if (this.squads) return;
    this.squads = []; this.cmdCd = [{}, {}]; this.ai = [null, null]; this.orderLog = [];
    // 명령별 효율 통계: 명령 유형별 유닛·초 누적 (가한 피해는 engine3 damage 에서 누적)
    this.hooks.push((b, dt) => {
      b._osT = (b._osT || 0) + dt; if (b._osT < 1) return; b._osT = 0;
      const os = b.orderStats || (b.orderStats = {});
      for (const s of b.squads) if (s.alive && s.team === 0) (os[s.order.type] || (os[s.order.type] = { dealt: 0, time: 0 })).time += s.alive;
      if (b.form) for (let t = 0; t < 2; t++) if (b.form[t]) (b.formTime || (b.formTime = [0, 0]))[t] += 1;
    });
  };
  P.addSquad = function (team, name, order = 'free') {
    this.initSquads();
    const id = this.squads.length;
    const n = this.squads.filter(s => s.team === team).length;
    this.squads.push({ id, team, name: name || `제${n + 1}부대`, color: SW.SQUAD_COLORS[n % SW.SQUAD_COLORS.length], order: { type: order }, n0: 0, alive: 0 });
    return id;
  };
  P.squadUnits = function (id) { return this.units.filter(u => u.sq === id && u.alive); };
  P.squadInfoCalc = function () {
    if (!this.squads) return;
    for (const s of this.squads) { s.cx = 0; s.cy = 0; s.alive = 0; s.power = 0; s.cls = {}; }
    for (const u of this.units) {
      if (u.sq === undefined || !u.alive) continue;
      const s = this.squads[u.sq]; if (!s) continue;
      s.cx += u.x; s.cy += u.y; s.alive++; s.power += Math.sqrt(Math.max(0, u.hp) * (u.def.dmg / u.def.atkCd + 2));
      s.cls[u.def.cls] = (s.cls[u.def.cls] || 0) + 1;
    }
    for (const s of this.squads) {
      if (s.alive) { s.cx /= s.alive; s.cy /= s.alive; }
      if (!s.n0) s.n0 = s.alive;
      if (s.alive === 0 && s.n0 && !s.wiped) { s.wiped = true; this.logEvent(`${s.team ? '적' : '아군'} ${s.name} 전멸`, s.team, 'squad'); }
    }
  };
  wrapPerceive();
  function wrapPerceive() {
    const orig = P.perceive;
    P.perceive = function () { orig.call(this); this.squadInfoCalc(); };
  }

  P.setOrder = function (id, type, o = {}) {
    const s = this.squads[id]; if (!s) return;
    const units = this.squadUnits(id);
    const ei = this.teamInfo[1 - s.team];
    const order = { type, ...o, stage: 0, t: this.time };
    if (SW.ORDERS[type] && SW.ORDERS[type].point && order.x === undefined) {
      // 지점이 없으면: 후퇴/예비대는 자기 진영 쪽, 그 외는 현재 위치
      const back = s.team === 0 ? 0.12 : 0.88;
      order.x = type === 'retreat' || type === 'reserve' ? this.W * back : s.cx; order.y = s.cy;
    }
    if (type === 'nochase') { order.x = s.cx; order.y = s.cy; }
    if (type === 'flank' || type === 'rear') {
      const side = s.cy < ei.cy ? -1 : 1;
      const dirx = s.team === 0 ? 1 : -1;
      order.w1 = { x: clamp(ei.cx - dirx * 120, 40, this.W - 40), y: clamp(ei.cy + side * this.H * 0.36, 40, this.H - 40) };
      order.w2 = type === 'rear' ? { x: clamp(ei.cx + dirx * 280, 40, this.W - 40), y: clamp(ei.cy + side * 60, 40, this.H - 40) } : null;
    }
    // 부대원 상대 위치 기억 (진형 유지 이동)
    // 명령 유형이 바뀔 때만 대열 간격을 다시 기억 (같은 명령 반복으로 대열이 압축되지 않도록)
    if (!s.order || s.order.type !== type || !units.some(u => u.sqOff)) {
      const spread = Math.sqrt(units.length) * 14 + 20;
      for (const u of units) { const ox = u.x - s.cx, oy = u.y - s.cy, l = Math.hypot(ox, oy), k = l > spread ? spread / l : 1; u.sqOff = { x: ox * k, y: oy * k }; }
    }
    // 지휘관 부재 시 명령 지연
    if (this.commandEff[s.team] < 1) order.delay = this.time + 1.5;
    s.order = order;
    this.orderLog.push({ t: this.time, team: s.team, squad: s.name, type });
    if (s.team === 0 || this.logAI) this.logEvent(`${s.team ? '적' : ''} ${s.name}: ${SW.ORDERS[type].name}`.trim(), s.team, 'order');
  };

  P.gotoMove = function (u, dt) {
    const d = u.def, g = u.ai.dest; if (!g) return;
    const dx = g.x - u.x, dy = g.y - u.y, d2 = dx * dx + dy * dy;
    if (d2 < 16 && u.vx * u.vx + u.vy * u.vy < 4 && !u.kx && !u.ky) { u.vx = u.vy = 0; return; }   // (3.1) 제자리 대기
    const dd = Math.sqrt(d2);
    let mx = 0, my = 0;
    if (dd > 6) { mx = dx / dd; my = dy / dd; u.facing = Math.atan2(dy, dx); const wp = this.nav ? this.navDir(u, g.x, g.y) : null; if (wp) { const wx = wp.x - u.x, wy = wp.y - u.y, wl = Math.sqrt(wx * wx + wy * wy) || 1; mx = wx / wl; my = wy / wl; } }
    const fm = this.fm(u.team);
    const speed = d.speed * Math.max(0.1, 1 - Math.max(u.slowAmt, u.buff.slow)) * Math.max(0.1, 1 + u.buff.speed + (fm.speed || 0)) * (dd < 30 ? dd / 30 : 1);
    const k = Math.min(1, clamp(14 * 12 / u.r, 4, 20) * dt);
    u.vx += (mx * speed - u.vx) * k; u.vy += (my * speed - u.vy) * k;
    u.x = clamp(u.x + (u.vx + u.kx) * dt, u.r, this.W - u.r); u.y = clamp(u.y + (u.vy + u.ky) * dt, u.r, this.H - u.r);
  };
  const goTo = (u, x, y, state) => { u.ai.action = 'goto'; u.ai.dest = { x, y }; u.ai.state = state; };
  const withOff = (b, u, x, y) => ({ x: clamp(x + (u.sqOff ? u.sqOff.x : 0), u.r, b.W - u.r), y: clamp(y + (u.sqOff ? u.sqOff.y : 0), u.r, b.H - u.r) });

  // ── 명령 수행 (유닛 판단 후 호출) ──
  P.squadThink = function (u) {
    // 궁극기·장판 회피: 적의 낙하 예고 지역 안이면 빠져나온다
    if (this.areas.length && !u.def.immobile && u.ai.action !== 'flee') {
      for (const a of this.areas) {
        if (a.team === u.team || !(a.kind === 'meteor' || a.kind === 'strike' || a.kind === 'tele') || a.t < 0.25) continue;
        const dx = u.x - a.x, dy = u.y - a.y, dd = Math.hypot(dx, dy);
        if (dd < a.r + u.r) { const l = dd || 1; goTo(u, a.x + dx / l * (a.r + 25), a.y + dy / l * (a.r + 25), 'retreat'); u.ai.dodge = true; return; }
      }
    }
    u.ai.dodge = false;
    if (!this.squads || u.sq === undefined || u.commander && !this.squads[u.sq]) return;
    const s = this.squads[u.sq]; if (!s) return;
    const o = s.order;
    if (o.delay && this.time < o.delay) return;
    const t = u.target;
    const tdist = (p) => t && t.team !== u.team ? Math.hypot(t.x - p.x, t.y - p.y) : Infinity;
    switch (o.type) {
      case 'free': return;
      case 'attack':
        if (u.ai.action === 'retreat') u.ai.action = 'attack';
        if (!t) { const ei = this.teamInfo[1 - u.team]; const p = withOff(this, u, ei.cx, ei.cy); goTo(u, p.x, p.y, 'approach'); }
        return;
      case 'hold': case 'reserve': {
        const leash = o.type === 'reserve' ? 150 : 140 + Math.max(0, u.def.range);
        const p = withOff(this, u, o.x, o.y);
        const near = t && tdist(p) < leash;
        if (!near) { this.setTarget(u, near ? t : null); goTo(u, p.x, p.y, o.type === 'reserve' ? 'idle' : 'regroup'); }
        else if (u.ai.action === 'march') u.ai.action = 'attack';
        return;
      }
      case 'retreat': { const p = withOff(this, u, o.x, o.y); goTo(u, p.x, p.y, 'retreat'); if (Math.hypot(s.cx - o.x, s.cy - o.y) < 60 && this.time - o.t > 3) this.setOrder(s.id, 'hold', { x: o.x, y: o.y }); return; }
      case 'rally': {
        const p = withOff(this, u, o.x, o.y);
        if (Math.hypot(s.cx - o.x, s.cy - o.y) < 90) { this.setOrder(s.id, 'hold', { x: o.x, y: o.y }); return; }
        if (!(t && Math.hypot(t.x - u.x, t.y - u.y) < 70)) goTo(u, p.x, p.y, 'regroup');
        return;
      }
      case 'focus':
        if (o.target && o.target.alive && this.targetable(u, o.target)) { this.setTarget(u, o.target); if (u.ai.action === 'march' || u.ai.action === 'goto') u.ai.action = 'attack'; }
        else this.setOrder(s.id, 'attack');
        return;
      case 'flank': case 'rear': {
        const wp = o.stage === 0 ? o.w1 : o.stage === 1 && o.w2 ? o.w2 : null;
        if (wp) {
          if (Math.hypot(s.cx - wp.x, s.cy - wp.y) < 130) { o.stage++; if (s.team === 0 || this.logAI) this.logEvent(`${s.team ? '적 ' : ''}${s.name}: ${o.stage === 1 && o.w2 ? '측면 도달' : '우회 완료, 공격 개시'}`, s.team, 'tactic'); if (!o.w2 || o.stage >= 2) o.done = true; return; }
          if (!(t && Math.hypot(t.x - u.x, t.y - u.y) < 90)) { const p = withOff(this, u, wp.x, wp.y); goTo(u, p.x, p.y, 'approach'); }
          return;
        }
        // 도착 후: 후방 기습이면 원거리·지원 우선
        if (o.type === 'rear' && (!t || (t.def.cls !== 'ranged' && t.def.cls !== 'caster' && t.def.cls !== 'support'))) {
          let best = null, bd = 400 * 400;
          this.enemyQuery(u, 400, (e) => { if ((e.def.cls === 'ranged' || e.def.cls === 'caster' || e.def.cls === 'support') && this.targetable(u, e)) { const q = dist2(u, e); if (q < bd) { bd = q; best = e; } } });
          if (best) this.setTarget(u, best);
        }
        if (u.ai.action === 'march' || u.ai.action === 'retreat') u.ai.action = 'attack';
        return;
      }
      case 'escort': {
        const es = o.squad !== undefined ? this.squads[o.squad] : null;
        const ex = es && es.alive ? es.cx : o.unit && o.unit.alive ? o.unit.x : null, ey = es && es.alive ? es.cy : o.unit && o.unit.alive ? o.unit.y : null;
        if (ex === null) { this.setOrder(s.id, 'attack'); return; }
        let best = null, bd = 230 * 230;
        this.enemyQuery({ x: ex, y: ey, team: u.team }, 230, (e) => { if (this.targetable(u, e)) { const q = (e.x - ex) ** 2 + (e.y - ey) ** 2; if (q < bd) { bd = q; best = e; } } });
        if (best) { this.setTarget(u, best); u.ai.action = 'attack'; }
        else { const p = withOff(this, u, ex, ey); goTo(u, p.x, p.y, 'protect'); }
        return;
      }
      case 'nochase': {
        if (t && tdist(o) > 220) { this.setTarget(u, null); const p = withOff(this, u, o.x, o.y); goTo(u, p.x, p.y, 'regroup'); }
        return;
      }
    }
  };
  // 이동 시스템 연결: 'goto' 행동
  (() => {
    const orig = P.move;
    P.move = function (u, dt) { if (u.ai.action === 'goto' && u.ai.dest && u.rootT <= 0 && u.ai.action !== 'flee' && !u.def.immobile) { this.gotoMove(u, dt); return; } orig.call(this, u, dt); };
  })();
  // 행동 상태 이름 추가
  Object.assign(SW.AI_STATE_NAMES, { flee: '패주' });

  // ── 지휘관 능력 ──
  P.useCommand = function (team, id, sqId) {
    this.initSquads();
    const a = SW.CMD_ABILITIES.find(x => x.id === id); if (!a) return false;
    const cd = this.cmdCd[team][id] || 0;
    if (cd > this.time) return false;
    const cmdAlive = !!this.teamInfo[team].commander;
    const eff = cmdAlive ? 1 : 0.5;
    this.cmdCd[team][id] = this.time + a.cd * (cmdAlive ? 1 : 1.5);
    const mods = {}; for (const k in a.mods) mods[k] = a.mods[k] * eff;
    let targets = this.units.filter(u => u.team === team && !u.def.structure && (sqId === null || sqId === undefined || u.sq === sqId));
    if (a.filter === 'ranged') targets = targets.filter(u => u.def.range > 40);
    if (a.filter === 'low' && this.squads) targets = targets.filter(u => { const s = this.squads[u.sq]; return !s || s.alive <= s.n0 * 0.5; });
    for (const u of targets) { this.addTimed(u, mods, a.dur); if (a.morale && u.morale != null) u.morale = Math.min(100, u.morale + a.morale * eff); }
    if (a.order && this.squads) for (const s of this.squads) if (s.team === team && (sqId === null || sqId === undefined || s.id === sqId)) this.setOrder(s.id, a.order);
    this.banner(`${team ? '적 ' : ''}${a.icon} ${a.name}${cmdAlive ? '' : ' (지휘관 부재: 효과 50%)'}`, team ? '#ff9a9a' : '#9cc0ff', 1.4);
    this.logEvent(`${team ? '적 ' : ''}지휘: ${a.name}`, team, 'command');
    (this.cmdUses || (this.cmdUses = [0, 0]))[team]++;
    return true;
  };

  // ── 전술 AI (지휘관 AI) ──
  SW.AI_PERSONALITIES = {
    balanced: { name: '균형', desc: '전열 공격, 원거리 엄호, 기동대 측면, 예비대 운용' },
    aggressive: { name: '공격형', desc: '전군 돌격, 기동대 후방 기습' },
    defensive: { name: '방어형', desc: '진지 사수 후 역습, 예비대 다수' },
    flanker: { name: '포위형', desc: '망치와 모루 — 정면 고정 후 양 측면 포위' },
    artillery: { name: '포격형', desc: '방어선 뒤에서 원거리 화력 집중' },
    adaptive: { name: '학습형', desc: '과거 전투 결과로 가장 승률 높은 전략 선택' },
  };
  P.addAI = function (team, personality = 'balanced') {
    this.initSquads();
    if (personality === 'adaptive') personality = SW.pickLearned ? SW.pickLearned() : 'balanced';
    this.ai[team] = { pers: personality, t: 0, plan: false, reserveOut: false, flags: {} };
    if (!this._aiHook) { this._aiHook = true; this.hooks.push((b, dt) => { for (let t = 0; t < 2; t++) if (b.ai[t]) { b.ai[t].t -= dt; if (b.ai[t].t <= 0) { b.ai[t].t = 1.5; b.aiCommand(t); } } }); }
  };
  const roleOf = (s) => {
    const c = s.cls || {}; const get = (k) => c[k] || 0;
    const front = get('front') + get('tank'), ranged = get('ranged') + get('caster'), mobile = get('assassin') + get('flyer'), sup = get('support');
    const m = Math.max(front, ranged, mobile, sup);
    return m === front ? 'front' : m === ranged ? 'ranged' : m === mobile ? 'mobile' : 'support';
  };
  P.teamPower = function (team) { let p = 0; for (const u of this.teams[team]) if (!u.def.structure) p += Math.sqrt(Math.max(0, u.hp) * (u.def.dmg / u.def.atkCd + 2)); return p; };
  P.aiCommand = function (team) {
    const A = this.ai[team]; const squads = this.squads.filter(s => s.team === team && s.alive > 0);
    if (!squads.length) return;
    const my = this.teamInfo[team], en = this.teamInfo[1 - team], dir = team === 0 ? 1 : -1;
    const by = { front: [], ranged: [], mobile: [], support: [] };
    const cmdSq = my.commander && my.commander.sq !== undefined ? my.commander.sq : -1;
    for (const s of squads) if (s.id !== cmdSq) by[s.role || (s.role = roleOf(s))].push(s);
    // 지휘부는 군대 중심 뒤쪽을 따라간다
    if (cmdSq >= 0 && this.squads[cmdSq].order.type !== 'retreat') {
      let fx = 0, fy = 0, fn = 0; for (const s of squads) if (s.id !== cmdSq) { fx += s.cx * s.alive; fy += s.cy * s.alive; fn += s.alive; }
      if (fn) { const cs = this.squads[cmdSq], o = cs.order; const hx = clamp(fx / fn - dir * 240, 30, this.W - 30), hy = clamp(fy / fn, 40, this.H - 40); if (o.type !== 'hold') { cs.order = { type: 'hold', x: hx, y: hy, stage: 0, t: this.time }; } else { o.x = hx; o.y = hy; } }
    }
    const frontS = by.front.sort((a, b) => b.alive - a.alive);
    const say = (txt) => { if (!A.flags[txt]) { A.flags[txt] = true; this.logEvent(`${team ? '적' : '아군'} AI: ${txt}`, team, 'ai'); } };
    if (!A.plan) {
      A.plan = true;
      const pers = A.pers;
      const holdX = my.cx + dir * (pers === 'defensive' || pers === 'artillery' ? 60 : 0);
      frontS.forEach((s, i) => {
        if (pers === 'defensive' || pers === 'artillery') this.setOrder(s.id, 'hold', { x: holdX + dir * 80, y: s.cy });
        else if (pers === 'flanker' && i > 0) this.setOrder(s.id, 'flank');
        else if ((pers === 'balanced' || pers === 'defensive') && frontS.length >= 3 && i === frontS.length - 1) { this.setOrder(s.id, 'reserve'); A.reserve = s.id; }
        else this.setOrder(s.id, 'attack');
      });
      for (const s of by.ranged) this.setOrder(s.id, pers === 'aggressive' ? 'attack' : 'hold', { x: holdX - dir * 40, y: s.cy });
      for (const s of by.mobile) this.setOrder(s.id, pers === 'defensive' ? 'reserve' : pers === 'artillery' ? 'escort' : pers === 'aggressive' || pers === 'flanker' ? 'rear' : 'flank', by.ranged[0] ? { squad: by.ranged[0].id } : {});
      for (const s of by.support) this.setOrder(s.id, frontS[0] ? 'escort' : 'free', frontS[0] ? { squad: frontS[0].id } : {});
      say(`${SW.AI_PERSONALITIES[pers].name} 전략 개시`);
      return;
    }
    const pr = this.teamPower(team) / Math.max(1, this.teamPower(1 - team));
    A.pr = pr;
    // 원거리 부대가 공격받으면 근접 부대 하나를 호위로 돌린다 (측면 위협 감지)
    for (const r of by.ranged) {
      let threat = 0; this.enemiesIn(r.cx, r.cy, 200, team, (e) => { if (e.def.range <= 40) threat++; });
      if (threat >= 5 && !A.flags['esc' + r.id]) {
        const f = frontS.find(s => s.order.type !== 'escort' && s.id !== A.reserve) || by.mobile[0];
        if (f) { this.setOrder(f.id, 'escort', { squad: r.id }); A.flags['esc' + r.id] = true; say('측면 위협 감지 — 원거리 부대 호위'); }
      }
    }
    // 적이 원거리 위주면 기동대를 후방 기습으로
    let enR = 0, enN = 0; for (const e of this.teams[1 - team]) { enN++; if (e.def.cls === 'ranged' || e.def.cls === 'caster') enR++; }
    if (enN && enR / enN > 0.45) for (const s of by.mobile) if (s.order.type !== 'rear' && !s.order.done) { this.setOrder(s.id, 'rear'); say('적 원거리 편중 — 후방 기습'); }
    // 전세에 따른 전술 변경
    if (pr < 0.8 && A.reserve !== undefined && !A.reserveOut) { A.reserveOut = true; const rs = this.squads[A.reserve]; if (rs && rs.alive) { this.setOrder(rs.id, 'attack'); say('예비대 투입'); this.banner(`${team ? '적 ' : ''}예비대 투입!`, team ? '#ff9a9a' : '#9cc0ff', 1.4); } }
    if (pr < 0.65) { if (this.useCommand(team, 'ironwill', null)) say('전세 불리 — 철벽 명령'); if (pr < 0.45) this.useCommand(team, 'laststand', null); }
    if (pr > 1.3) { for (const s of squads) if (s.id !== cmdSq && (s.order.type === 'hold' || s.order.type === 'reserve')) this.setOrder(s.id, 'attack'); if (this.useCommand(team, 'charge', null)) say('전세 유리 — 총공격'); }
    if (by.ranged.length && this.time > 6) this.useCommand(team, 'volley', null);
    // 원거리 방어선은 전열 뒤를 따라간다
    if (frontS[0] && frontS[0].alive) for (const r of by.ranged) if (r.order.type === 'hold') { r.order.x = frontS[0].cx - dir * 110; r.order.y = clamp(frontS[0].cy, 60, this.H - 60); }
    // 지휘관 보호: 지휘관 근처에 적이 많으면 후퇴
    const c = my.commander;
    if (c) { let th = 0; this.enemiesIn(c.x, c.y, 160, team, () => { th++; }); if (th >= 4 && c.sq !== undefined && this.squads[c.sq].order.type !== 'retreat') { this.setOrder(c.sq, 'retreat'); say('지휘관 후퇴'); } }
    // 전선 붕괴 대응
    if (this.front && this.front.collapsed && this.front.collapsed[team] && A.reserve !== undefined && !A.reserveOut) { A.reserveOut = true; this.setOrder(A.reserve, 'attack'); say('전선 붕괴 — 예비대 긴급 투입'); }
  };

  // ── 전선 시스템 ──
  P.enableFrontline = function (bands = 10) {
    this.front = { bands: [], collapsed: [false, false], t: 0 };
    for (let i = 0; i < bands; i++) this.front.bands.push({ y0: i * this.H / bands, y1: (i + 1) * this.H / bands, x: null, c: [0, 0], max: [0, 0], fallen: [false, false], owner: -1 });
    this.hooks.push((b, dt) => { b.front.t -= dt; if (b.front.t <= 0) { b.front.t = 0.5; b.updateFront(); } });
  };
  P.updateFront = function () {
    const F = this.front, n = F.bands.length, bh = this.H / n;
    const xs = F.bands.map(() => [[], []]);
    for (const u of this.units) { if (u.def.flying || u.def.structure || u.def.summonOnly && !u.commander) continue; const i = Math.min(n - 1, (u.y / bh) | 0); xs[i][u.team].push(u.x); }
    F.collapsed = [false, false];
    F.bands.forEach((b, i) => {
      const [a, c] = xs[i]; b.c = [a.length, c.length];
      for (let t = 0; t < 2; t++) b.max[t] = Math.max(b.max[t], b.c[t]);
      if (b.c[0] >= 3 && b.c[1] >= 3) b.contact = true;     // 교전이 있었던 구역만 붕괴 판정
      a.sort((p, q) => p - q); c.sort((p, q) => p - q);
      const f0 = a.length ? a[Math.floor(a.length * 0.85)] : null, f1 = c.length ? c[Math.floor(c.length * 0.15)] : null;
      b.x = f0 !== null && f1 !== null ? (f0 + f1) / 2 : f0 !== null ? f0 : f1;
      b.owner = a.length > c.length * 1.5 ? 0 : c.length > a.length * 1.5 ? 1 : -1;
      for (let t = 0; t < 2; t++) {
        if (!b.fallen[t] && b.contact && b.max[t] >= 6 && b.c[t] < b.max[t] * 0.25 && b.c[1 - t] >= 4) {
          b.fallen[t] = true;
          this.logEvent(`${t ? '적' : '아군'} 전선 붕괴 (구역 ${i + 1})`, t, 'front');
          this.banner(`${t ? '적' : '아군'} 전선 붕괴!`, t ? '#9cc0ff' : '#ff9a9a', 1.5, `구역 ${i + 1} 돌파 — 측면 노출`);
          for (const u of this.teams[t]) if (u.morale != null && Math.abs(u.y - (b.y0 + b.y1) / 2) < bh * 2) u.morale -= 15;
          for (const u of this.teams[1 - t]) if (u.y >= b.y0 - bh && u.y <= b.y1 + bh) this.addTimed(u, { dmg: 0.1 }, 8);
        }
        if (b.fallen[t]) F.collapsed[t] = true;
      }
    });
  };

  // ── 군대 편성기: 성향에 따라 부대 구성을 만들어 배치 ──
  const POOLS = (allowed) => {
    const list = (allowed || SW.unitList().map(u => u.id)).filter(id => SW.UNITS[id] && !SW.UNITS[id].summonOnly && !SW.UNITS[id].boss);
    const by = { front: [], ranged: [], mobile: [], support: [] };
    for (const id of list) {
      const c = SW.UNITS[id].cls;
      const k = c === 'front' || c === 'tank' ? 'front' : c === 'ranged' || c === 'caster' ? 'ranged' : c === 'assassin' || c === 'flyer' ? 'mobile' : 'support';
      by[k].push(id);
    }
    return by;
  };
  const TEMPLATES = {
    balanced: [['front', 0.28], ['front', 0.18], ['ranged', 0.22], ['ranged', 0.1], ['mobile', 0.12], ['support', 0.1]],
    aggressive: [['front', 0.3], ['front', 0.25], ['mobile', 0.2], ['ranged', 0.15], ['support', 0.1]],
    defensive: [['front', 0.3], ['front', 0.2], ['ranged', 0.25], ['support', 0.15], ['mobile', 0.1]],
    flanker: [['front', 0.3], ['mobile', 0.2], ['mobile', 0.15], ['ranged', 0.2], ['support', 0.15]],
    artillery: [['front', 0.3], ['ranged', 0.3], ['ranged', 0.2], ['support', 0.1], ['mobile', 0.1]],
  };
  SW.buildArmy = (o) => {
    // o: { team, budget(인원), pers, allowed, W, H, zone:{x0,x1}, rnd, commander, maxPop }
    const rnd = o.rnd || rand, pools = POOLS(o.allowed), pers = SW.AI_PERSONALITIES[o.pers] && TEMPLATES[o.pers] ? o.pers : 'balanced';
    const tpl = TEMPLATES[pers];
    const units = [], squads = [];
    const dir = o.team === 0 ? 1 : -1;
    const z = o.zone, depth = z.x1 - z.x0, frontX = o.team === 0 ? z.x1 - 40 : z.x0 + 40;
    const lanes = { front: 0, ranged: 0, mobile: 0, support: 0 };
    tpl.forEach(([kind, share], i) => {
      let pool = pools[kind].length ? pools[kind] : pools.front.length ? pools.front : pools.ranged;
      if (!pool.length) return;
      // 부대 내 1~2 병종
      const t1 = pool[(rnd() * pool.length) | 0], t2 = pool[(rnd() * pool.length) | 0];
      const pop = o.budget * share;
      const sq = { name: `제${squads.length + 1}부대`, kind, units: [] };
      const comp = t1 === t2 ? [[t1, 1]] : [[t1, 0.6], [t2, 0.4]];
      for (const [t, w] of comp) {
        const d = SW.UNITS[t]; const n = Math.max(1, Math.floor(pop * w / Math.max(1, d.pop)));
        for (let k = 0; k < n; k++) sq.units.push(t);
      }
      // 배치: 역할별 위치
      const lane = lanes[kind]++;
      const depthF = kind === 'front' ? 0.08 + lane * 0.12 : kind === 'ranged' ? 0.42 + lane * 0.1 : kind === 'support' ? 0.3 : 0.2;
      let cy = o.H / 2;
      if (kind === 'mobile') cy = lane % 2 === 0 ? o.H * 0.18 : o.H * 0.82;
      else if (kind === 'front' && tpl.filter(x => x[0] === 'front').length > 1) cy = o.H * (lane === 0 ? 0.42 : 0.62);
      const cx = frontX - dir * depth * depthF;
      const gap = Math.max(...sq.units.map(t => SW.UNITS[t].size)) * 2 + 4;
      const cols = Math.max(1, Math.ceil(Math.sqrt(sq.units.length * 0.35)));
      const rows = Math.ceil(sq.units.length / cols);
      sq.units.forEach((t, k) => {
        const c = k % cols, r = Math.floor(k / cols);
        units.push({ type: t, team: o.team, x: clamp(cx - dir * c * gap, z.x0 + 10, z.x1 - 10), y: clamp(cy + (r - (rows - 1) / 2) * gap, 12, o.H - 12), sq: squads.length });
      });
      squads.push(sq);
    });
    if (o.commander !== false) {
      const sqi = squads.length; squads.push({ name: '지휘부', kind: 'command', units: ['commander'] });
      units.push({ type: 'commander', team: o.team, x: frontX - dir * depth * 0.55, y: o.H / 2, sq: sqi });
    }
    return { units, squads, pers };
  };

  // ── AI 학습: 성향별 전적 저장 → 학습형 AI가 승률 높은 전략 선택 ──
  SW.recordLearn = (pers, won, vsPers) => {
    if (!SW.save) return;
    const L = SW.save.data.aiLearn || (SW.save.data.aiLearn = {});
    const r = L[pers] || (L[pers] = { w: 0, n: 0, vs: {} });
    r.n++; if (won) r.w++;
    if (vsPers) { const v = r.vs[vsPers] || (r.vs[vsPers] = { w: 0, n: 0 }); v.n++; if (won) v.w++; }
  };
  SW.pickLearned = (vsPers) => {
    const L = (SW.save && SW.save.data.aiLearn) || {};
    const keys = ['balanced', 'aggressive', 'defensive', 'flanker', 'artillery'];
    if (rand() < 0.15) return keys[(rand() * keys.length) | 0];   // 탐색
    let best = 'balanced', bs = -1;
    for (const k of keys) {
      const r = L[k] || { w: 0, n: 0, vs: {} };
      const v = vsPers && r.vs && r.vs[vsPers];
      const s = v && v.n >= 2 ? (v.w + 1) / (v.n + 2) : (r.w + 1) / (r.n + 2);
      if (s > bs) { bs = s; best = k; }
    }
    return best;
  };
})();
