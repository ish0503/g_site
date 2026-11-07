// ─────────────────────────────────────────────
// Skill System — 조건 판정 + 효과 실행기 (data/abilities.js 를 해석)
// ─────────────────────────────────────────────
(() => {
  const { rand, clamp, dist2 } = SW.util;

  const COND = {
    always: () => true,
    targetInReach(b, u) { const t = u.target; return t && t.team !== u.team && Math.sqrt(dist2(u, t)) <= b.reach(u, t) + 6; },
    targetInRange(b, u) { const t = u.target; return t && t.team !== u.team && Math.sqrt(dist2(u, t)) <= Math.max(u.def.range, 40) + t.r + 10; },
    targetFar(b, u, d) { const t = u.target; if (!t || t.team === u.team) return false; const dd = Math.sqrt(dist2(u, t)); return dd > +d + b.reach(u, t) && dd < 260 + (u.def.range || 0); },
    enemiesNear(b, u, r, n) { let c = 0; b.enemiesIn(u.x, u.y, +r, u.team, () => { c++; }); return c >= +n; },
    alliesHurt(b, u, r, n) { let c = 0; b.alliesIn(u.x, u.y, +r, u.team, (o) => { if (o.hp < o.maxHp * 0.75) c++; }); return c >= +n; },
    hpBelow(b, u, x) { return u.hp < u.maxHp * +x; },
    clusterAtTarget(b, u, r, n) {
      const t = u.target; if (!t || t.team === u.team) return false;
      if (Math.sqrt(dist2(u, t)) > Math.max(u.def.range, 60) + 60) return false;
      let c = 0; b.enemiesIn(t.x, t.y, +r, u.team, () => { c++; }); return c >= +n;
    },
  };

  const EXEC = {
    strike(b, u, f) {
      const t = u.target; if (!t || !t.alive) return false;
      b.hit(u, t, u.def.dmg * f.mult, { melee: true, forceCrit: f.crit, knock: f.knock });
      if (f.stun && t.alive && !t.def.boss) t.stun = Math.max(t.stun, f.stun);
      b.addFx({ kind: 'crit', x: t.x, y: t.y, r: t.r + 8, T: 0.25 });
      u.cd = Math.max(u.cd, u.def.atkCd * 0.5);
      return true;
    },
    dash(b, u, f) {
      const t = u.target; if (!t || !t.alive || u.def.immobile) return false;
      const dd = Math.sqrt(dist2(u, t)); if (dd > f.range + b.reach(u, t)) return false;
      const reach = b.reach(u, t), nx = (t.x - u.x) / dd, ny = (t.y - u.y) / dd, ox = u.x, oy = u.y;
      u.x = t.x - nx * reach * 0.8; u.y = t.y - ny * reach * 0.8; u.facing = Math.atan2(ny, nx);
      let m = f.mult; if (f.bigMult && t.r >= 13) m *= f.bigMult;
      b.hit(u, t, u.def.dmg * m, { melee: true, knock: f.knock, charge: true });
      b.addFx({ kind: 'dash', x: ox, y: oy, x2: u.x, y2: u.y, color: u.def.accent, T: 0.3 });
      return true;
    },
    cone(b, u, f) {
      const t = u.target; if (t) u.facing = Math.atan2(t.y - u.y, t.x - u.x);
      const dmg = f.dmg || u.def.dmg * (f.mult || 1);
      b.enemiesIn(u.x, u.y, f.range + u.r, u.team, (e) => {
        let a = Math.atan2(e.y - u.y, e.x - u.x) - u.facing; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > f.angle * Math.PI / 360) return;
        b.hit(u, e, dmg, { melee: u.def.range <= 40, splash: true, element: f.element });
        if (f.poisonStacks && e.alive) { e.poison = 5; e.poisonDps = Math.max(e.poisonDps, 5); e.poisonStacks = Math.min(8, e.poisonStacks + f.poisonStacks); }
      }, u.def.canHitAir || u.def.flying);
      b.addFx({ kind: 'cone', x: u.x, y: u.y, a: u.facing, r: f.range + u.r, ang: f.angle, color: f.element ? SW.ELEMENTS[f.element].color : u.def.accent, T: 0.35 });
      return true;
    },
    nova(b, u, f) {
      let x = u.x, y = u.y;
      if (f.at === 'target') { const t = u.target; if (!t) return false; x = t.x; y = t.y; }
      const el = f.element === 'cycle' ? (u.def.cycle ? u.def.cycle[(u.cycleI + 2) % 3] : null) : f.element;
      const dmg = f.dmg || u.def.dmg * (f.mult || 1);
      b.enemiesIn(x, y, f.radius, u.team, (e) => {
        b.hit(u, e, dmg, { splash: true, element: el, type: f.dmg && !el ? 'phys' : undefined, knock: 0 });
        if (!e.alive) return;
        if (f.stun && !e.def.boss) e.stun = Math.max(e.stun, f.stun);
        if (f.burn) { e.burn = Math.max(e.burn, f.burn.dur); e.burnDps = Math.max(e.burnDps, f.burn.dps); }
        if (f.knock && !e.def.immobile) b.knockback(e, x, y, f.knock);
      }, true);
      const col = el ? SW.ELEMENTS[el].color : u.def.accent;
      b.addFx({ kind: 'boom', x, y, r: f.radius, color: col, T: 0.45 });
      b.addFx({ kind: 'shock', x, y, r: f.radius * 1.5, color: col, T: 0.4 });
      b.particles(x, y, col, 12, 180);
      if (f.radius >= 100) b.shake = Math.max(b.shake || 0, 0.25);
      if (b.onImpact) b.onImpact(x, y, f.radius, el);
      return true;
    },
    buffSelf(b, u, f) { b.addTimed(u, f.mods, f.dur); b.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.r + 10, color: u.def.accent, T: 0.5 }); return true; },
    buffAllies(b, u, f) {
      const eff = 1 + (b.fm(u.team).supportEff || 0);
      const mods = {}; for (const k in f.mods) mods[k] = f.mods[k] * (k === 'covered' ? 1 : eff);
      b.alliesIn(u.x, u.y, f.radius, u.team, (o) => b.addTimed(o, mods, f.dur));
      b.addFx({ kind: 'ring', x: u.x, y: u.y, r: f.radius, color: f.color || u.def.accent, T: 0.7 });
      return true;
    },
    heal(b, u, f) {
      let n = 0;
      b.alliesIn(u.x, u.y, f.radius, u.team, (o) => {
        if (f.filter === 'mech' && !(o.def.family === 'square' || o.type === 'turret' || o.def.immobile)) return;
        let amt = f.amt || o.maxHp * f.pct;
        if (u.def.skill === 'massHeal' && b.formation[u.team] === 'phalanx') amt *= 1.3;     // [협동] 방진 + 광역 치유
        if (b.heal(o, amt, u) > 0) n++;
        if (f.cleanse) { o.burn = 0; o.poison = 0; o.poisonStacks = 0; o.slowAmt = 0; o.slowT = 0; o.freeze = 0; o.stun = 0; o.weakT = 0; }
      });
      b.addFx({ kind: 'ring', x: u.x, y: u.y, r: f.radius, color: '#a8ffb0', T: 0.7 });
      return n > 0 || f.filter !== 'mech';
    },
    shield(b, u, f) {
      const eff = 1 + (b.fm(u.team).supportEff || 0);
      const list = [];
      b.alliesIn(u.x, u.y, f.radius, u.team, (o) => list.push(o));
      list.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
      for (const o of list.slice(0, f.count)) { o.shield = Math.max(o.shield, f.amt * eff); if (f.light) o.shieldLight = true; }
      b.addFx({ kind: 'ring', x: u.x, y: u.y, r: f.radius, color: '#fff6c0', T: 0.7 });
      return list.length > 0;
    },
    taunt(b, u, f) {
      b.enemiesIn(u.x, u.y, f.radius, u.team, (e) => {
        if (e.def.boss) return;
        e.tauntT = f.dur; e.tauntBy = u; b.setTarget(e, u);
        if (f.exposed) { e.exposedT = f.dur + 1; e.exposedAmt = f.exposed; }
      });
      b.addFx({ kind: 'shock', x: u.x, y: u.y, r: f.radius, color: '#ffd36b', T: 0.5 });
      return true;
    },
    volley(b, u, f) {
      const t = u.target; if (!t) return false;
      const covered = u.buff.covered > 0;
      const m = covered ? f.coveredMult : f.mult;
      for (let i = 0; i < f.count; i++) setTimeoutSim(b, i * 0.12, () => { if (u.alive && t.alive) b.fireProj(u, t, u.def.dmg * m); });
      if (covered) b.addFx({ kind: 'text', x: u.x, y: u.y - 16, text: '엄호 사격!', color: '#e6e6e6', T: 0.8, size: 10 });
      return true;
    },
    fan(b, u, f) {
      const t = u.target; if (!t) return false;
      const base = Math.atan2(t.y - u.y, t.x - u.x), R = u.def.range + 40;
      for (let i = 0; i < f.count; i++) {
        const a = base + (i - (f.count - 1) / 2) * (f.spread * Math.PI / 180) / (f.count - 1);
        b.fireProj(u, { x: u.x + Math.cos(a) * R, y: u.y + Math.sin(a) * R, alive: false, r: 0 }, u.def.dmg * f.mult, { kind: 'arrow', splash: 10 });
      }
      return true;
    },
    snipe(b, u, f) {
      const t = u.target; if (!t) return false;
      const m = t.hp < t.maxHp * f.lowHp ? f.lowMult : f.mult;
      b.fireProj(u, t, u.def.dmg * m, { type: 'true', speed: 1400, crit: false });
      b.addFx({ kind: 'dash', x: u.x, y: u.y, x2: t.x, y2: t.y, color: '#ff6b6b', T: 0.15 });
      u.cd = u.def.atkCd;
      return true;
    },
    cloud(b, u, f) {
      const t = u.target; if (!t) return false;
      b.areas.push({ kind: 'cloud', x: t.x, y: t.y, r: f.radius, t: f.dur, T: f.dur, tick: 0, element: f.element, team: u.team, src: u });
      return true;
    },
    lobs(b, u, f) {
      const t = u.target; if (!t) return false;
      for (let i = 0; i < f.count; i++) setTimeoutSim(b, i * 0.25, () => {
        if (!u.alive) return;
        const tx = t.x + (rand() - 0.5) * f.scatter * 2, ty = t.y + (rand() - 0.5) * f.scatter * 2;
        const T = Math.max(0.5, Math.hypot(tx - u.x, ty - u.y) / u.def.projSpeed);
        b.projs.push({ kind: 'lob', x: u.x, y: u.y, sx: u.x, sy: u.y, tx, ty, t: 0, T, src: u, team: u.team, dmg: u.def.dmg, type: u.def.dmgType, splash: u.def.splash, color: u.def.accent });
      });
      return true;
    },
    pierceShot(b, u, f) { const t = u.target; if (!t) return false; b.firePierce(u, t, u.def.dmg * f.mult, f.knock); return true; },
    multiTarget(b, u, f) {
      const list = [];
      b.enemiesIn(u.x, u.y, u.def.range, u.team, (e) => { if (!e.stealthed && (!e.def.flying || u.def.canHitAir)) list.push(e); });
      if (!list.length) return false;
      list.sort(() => rand() - 0.5);
      for (const e of list.slice(0, f.count)) b.fireProj(u, e, u.def.dmg * f.mult, { kind: 'arrow', splash: 0 });
      return true;
    },
    execute(b, u, f) {
      const t = u.target; if (!t || !t.alive) return false;
      const th = t.poisonStacks > 0 ? f.poisonThreshold : f.threshold;
      if (!t.def.boss && t.hp < t.maxHp * th) {
        b.addFx({ kind: 'text', x: t.x, y: t.y - t.r - 6, text: '처형!', color: '#ff7070', T: 0.9 });
        b.damage(u, t, t.hp + t.shield + 1, 'true', { noReflect: true });
      } else b.hit(u, t, u.def.dmg * f.mult, { melee: true });
      b.addFx({ kind: 'crit', x: t.x, y: t.y, r: t.r + 8, T: 0.3 });
      return true;
    },
    stealth(b, u) { if (!u.def.stealth) return false; u.stealthed = true; u.ambush = true; b.addFx({ kind: 'ring', x: u.x, y: u.y, r: 20, color: '#b48cff', T: 0.4 }); return true; },
    recharge(b, u) { u.charging = true; return true; },
    mark(b, u, f) {
      const t = u.target; if (!t || !t.alive) return false;
      t.markT = f.dur; t.markAmt = f.taken;
      b.addFx({ kind: 'text', x: t.x, y: t.y - t.r - 6, text: '표식', color: '#b48cff', T: 0.9 });
      return true;
    },
    strikes(b, u, f) {
      const t = u.target; if (!t) return false;
      const list = [];
      b.enemiesIn(t.x, t.y, f.radius, u.team, (e) => list.push(e));
      list.sort(() => rand() - 0.5);
      list.slice(0, f.count).forEach((e, i) => b.areas.push({ kind: 'strike', x: e.x, y: e.y, r: 26, t: f.delay + i * 0.08, T: f.delay + i * 0.08, dmg: f.dmg, element: f.element, team: u.team, src: u, type: 'magic' }));
      return list.length > 0;
    },
    summonBurst(b, u, f) { for (let i = 0; i < f.count; i++) b.summonNear(u, f.unit); return true; },
    drain(b, u, f) {
      const t = u.target; if (!t || !t.alive) return false;
      const dealt = b.damage(u, t, f.dmg, 'magic', { element: 'dark', noElem: false });
      b.heal(u, dealt, u, true);
      b.addFx({ kind: 'beam', x: t.x, y: t.y, t: u, color: '#b6ffb0', T: 0.5 });
      return true;
    },
    meteors(b, u, f) {
      for (let i = 0; i < f.count; i++) {
        const e = b.densestEnemy(u, u.def.range + 60, f.radius) || u.target; if (!e) return i > 0;
        b.areas.push({ kind: 'meteor', x: e.x + (rand() - 0.5) * 60, y: e.y + (rand() - 0.5) * 60, r: f.radius, t: 1.2 + i * 0.35, T: 1.2 + i * 0.35, dmg: u.def.dmg * f.mult, type: 'magic', team: u.team, src: u, element: 'fire' });
      }
      return true;
    },
    freeze(b, u, f) {
      b.enemiesIn(u.x, u.y, f.radius, u.team, (e) => { if (!e.def.immobile && !e.def.boss) e.freeze = Math.max(e.freeze, f.dur); else if (e.def.boss) { e.slowAmt = 0.6; e.slowT = f.dur; } });
      b.addFx({ kind: 'shock', x: u.x, y: u.y, r: f.radius, color: '#c9a8ff', T: 0.6 });
      return true;
    },
    command(b, u, f) {
      // 사거리 안의 가장 위협적인 적을 지목해 아군 집중 공격
      let best = null, bs = -1;
      b.enemiesIn(u.x, u.y, f.range, u.team, (e) => {
        if (e.stealthed) return;
        const s = (e.def.dmg / e.def.atkCd) * (e.def.boss ? 3 : 1) + e.aggro * -1 + (1 - e.hp / e.maxHp) * 10;
        if (s > bs) { bs = s; best = e; }
      });
      if (!best) return false;
      best.cmdT = f.dur; best.cmdAmt = f.taken; best.cmdTeam = u.team;
      b.alliesIn(u.x, u.y, f.radius, u.team, (o) => { if (!o.def.support && o.def.attack !== 'heal') o.ai.cmd = best; });
      b.addFx({ kind: 'text', x: best.x, y: best.y - best.r - 8, text: '집중 포화!', color: '#ffe27a', T: 1 });
      b.addFx({ kind: 'beam', x: u.x, y: u.y, t: best, color: '#ffe27a', T: 0.5 });
      return true;
    },
    vortex(b, u, f) {
      const t = u.target; if (!t) return false;
      b.areas.push({ kind: 'vortex', x: t.x, y: t.y, r: f.radius, t: f.dur, T: f.dur, pull: f.pull, dps: f.dps, team: u.team, src: u });
      return true;
    },
  };

  SW.ABILITY_OPS = EXEC;    // 3.0 신규 기술이 효과를 추가할 수 있도록 공개

  // 전투 시간 기준 지연 실행 (일시정지 시 함께 멈춤)
  function setTimeoutSim(b, delay, fn) {
    if (!b._timers) { b._timers = []; b.hooks.push((bb, dt) => { const list = bb._timers; bb._timers = []; for (const x of list) { x.t -= dt; if (x.t <= 0) x.fn(); else bb._timers.push(x); } }); }
    if (delay <= 0) fn(); else b._timers.push({ t: delay, fn });
  }
  SW.simDelay = setTimeoutSim;

  Object.assign(SW.Battle.prototype, {
    checkCond(u, cond) {
      const [k, ...args] = cond.split(':');
      const fn = COND[k]; return fn ? fn(this, u, ...args) : false;
    },
    trySkill(u) {
      const a = u.def.ability;
      if (!a) return false;
      if (!this.checkCond(u, a.cond)) return false;
      let ok = false;
      for (const f of a.fx) { const e = EXEC[f.op]; if (e && e(this, u, f)) ok = true; }
      if (!ok) { u.skillCd = 1; return false; }
      u.skillCd = a.cd;
      u.st.casts++; this.recOf(u).casts++; this.stats[u.team].casts++;
      u.ai.state = 'skill'; u.skillT = 0.6;
      if (this.visual && this.quality !== 'low') {
        if (a.kind === 'ultimate') {
          this.addFx({ kind: 'text', x: u.x, y: u.y - u.r - 12, text: '★ ' + a.name, color: '#ffe066', T: 1.4, size: 15 });
          this.flashT = 0.25; this.flashColor = u.team === 0 ? '120,170,255' : '255,120,120';
        } else if (this.quality === 'high' && this.units.length < 400) {
          this.addFx({ kind: 'text', x: u.x, y: u.y - u.r - 8, text: a.name, color: u.team === 0 ? '#bcd4ff' : '#ffc4c4', T: 0.9, size: 10 });
        }
      }
      return true;
    },
  });
})();
