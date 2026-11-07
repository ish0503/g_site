// ─────────────────────────────────────────────
// Battle Engine 2.0 — 코어 (상태 관리 · 메인 루프 · 공간 분할)
// 전투 판정은 combat.js, AI는 ai.js, 기술은 abilities.js, 진형은 formation.js, 보스는 boss.js 에서
// Battle.prototype 을 확장한다. DOM 에 의존하지 않으므로 Node 에서도 시뮬레이션 가능.
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  // 결정론적 난수: 전투마다 시드를 가진 생성기(mulberry32). 같은 시드 = 같은 전투.
  SW.makeRng = (seed) => {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  let curRng = Math.random;
  const rand = () => curRng();
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
  SW.util = { rand, clamp, dist2, setRng: (f) => { const p = curRng; curRng = f || Math.random; return p; } };
  // fn 실행 동안 전투의 난수 생성기를 사용
  const withRng = (b, fn) => { const prev = curRng; curRng = b._rng; try { return fn(); } finally { curRng = prev; } };
  SW.withRng = withRng;

  const deepMerge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') a[k] = deepMerge({ ...a[k] }, v);
      else a[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    }
    return a;
  };
  const matches = (t, def) => t === def.id || t === 'family:' + def.family;
  const getPath = (o, p) => p.split('.').reduce((x, k) => x && x[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) { if (!x[ks[i]]) return; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; };

  // 스킬 트리 수정자 + 스테이지 버프를 적용한 유닛 정의
  SW.resolveDef = (id, mods, buff) => {
    const base = SW.UNITS[id];
    let d = JSON.parse(JSON.stringify(base));
    if (mods) {
      for (const fx of mods.patch) if (matches(fx.t, base)) d = deepMerge(d, fx.patch);
      const mul = {}, add = {};
      for (const fx of mods.stat) if (matches(fx.t, base)) {
        if (fx.mul !== undefined) mul[fx.stat] = (mul[fx.stat] || 0) + fx.mul;
        if (fx.add !== undefined) add[fx.stat] = (add[fx.stat] || 0) + fx.add;
      }
      for (const s of new Set([...Object.keys(mul), ...Object.keys(add)])) {
        const v = getPath(d, s) || 0;
        setPath(d, s, v * (1 + (mul[s] || 0)) + (add[s] || 0));
      }
    }
    if (buff) { d.hp *= 1 + (buff.hp || 0); d.dmg *= 1 + (buff.dmg || 0); }
    if (d.atkCd < 0.1) d.atkCd = 0.1;
    d.ability = d.skill ? SW.ABILITIES[d.skill] : null;
    return d;
  };

  let UID = 1;
  const BUFF_KEYS = ['atkSpd', 'dmg', 'armor', 'slow', 'atkSlow', 'speed', 'regen', 'crit', 'block', 'reflect', 'dodge', 'lifesteal', 'projTaken', 'covered'];
  SW.BUFF_KEYS = BUFF_KEYS;
  const newBuff = () => { const b = {}; for (const k of BUFF_KEYS) b[k] = 0; return b; };

  // 전투 상태: PREPARING → RUNNING ⇄ PAUSED → FINISHED
  class Battle {
    constructor(opts = {}) {
      this.W = opts.W || 1600; this.H = opts.H || 900;
      this.state = 'PREPARING';
      this.units = []; this.projs = []; this.areas = []; this.fx = []; this.banners = [];
      this.fxPool = [];
      this.time = 0;
      this.over = false; this.winner = null;
      this.timeLimit = opts.timeLimit || 240;
      this.mods = opts.mods || [null, null];
      this.buffs = opts.buffs || [null, null];
      this.formation = opts.formations ? [...opts.formations] : ['free', 'free'];
      this.endless = !!opts.endless;           // 생존 모드: 적 전멸로 끝나지 않음
      this.hooks = [];                          // 매 스텝 호출되는 모드 로직
      this.defCache = [{}, {}];
      this.teams = [[], []];
      this.grid = new Map(); this.cell = 64;
      this.cellCount = [new Map(), new Map()];
      this.visual = opts.visual !== false;
      this.quality = opts.quality || 'high';
      this.seed = opts.seed !== undefined ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
      this._rng = SW.makeRng(this.seed);
      this.stats = [this.newTeamStats(), this.newTeamStats()];
      this.rec = [{}, {}];                      // 유닛 종류별 통계
      this.best = { life: null };
      this.teamInfo = [{}, {}];
    }
    newTeamStats() { return { dmg: 0, taken: 0, healed: 0, kills: 0, casts: 0, lost: 0 }; }

    def(type, team) {
      const c = this.defCache[team];
      if (!c[type]) c[type] = SW.resolveDef(type, this.mods[team], this.buffs[team]);
      return c[type];
    }
    fm(team) { return SW.FORMATIONS[this.formation[team]].mods; }

    spawn(type, team, x, y, extra) { return withRng(this, () => this._spawn(type, team, x, y, extra)); }
    _spawn(type, team, x, y, extra) {
      const d = this.def(type, team);
      const u = {
        uid: UID++, type, def: d, team, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: d.size, mass: d.size * d.size, hp: d.hp, maxHp: d.hp, shield: 0, shieldLight: false, cd: rand() * 0.6,
        target: null, facing: team === 0 ? 0 : Math.PI, alive: true,
        burn: 0, burnDps: 0, poison: 0, poisonStacks: 0, poisonDps: 0, slowT: 0, slowAmt: 0, stun: 0, freeze: 0,
        weakT: 0, markT: 0, markAmt: 0, exposedT: 0, exposedAmt: 0, tauntT: 0, tauntBy: null, cmdT: 0, cmdAmt: 0, cmdTeam: -1, knockT: 0,
        timed: [], buff: newBuff(), aggro: 0,
        ai: { state: 'idle', action: 'attack', think: rand() * 0.3, hold: 0, slot: null, cmd: null },
        skillCd: d.ability ? d.ability.cd * (0.25 + rand() * 0.45) : 0, skillT: 0,
        abilT: rand() * 2, leapT: 1 + rand(), stealthed: !!d.stealth, revealT: 0,
        charging: false, ambush: !!d.stealth, revived: false, flash: 0, rx: 0, ry: 0, raised: 0,
        life: d.lifetime || 0, hatchT: d.hatch ? d.hatch.t : 0, owner: null, anim: rand() * 10, cycleI: 0,
        born: this.time, st: { dealt: 0, taken: 0, healed: 0, kills: 0, casts: 0 },
        ...extra,
      };
      if (d.boss) this.initBoss(u);
      this.units.push(u);
      const r = this.recOf(u); r.n++;
      return u;
    }
    recOf(u) {
      const t = this.rec[u.team];
      return t[u.type] || (t[u.type] = { n: 0, died: 0, dealt: 0, taken: 0, healed: 0, kills: 0, casts: 0, life: 0 });
    }
    remove(u) { const i = this.units.indexOf(u); if (i >= 0) this.units.splice(i, 1); }

    // ── 상태 전환 ──
    start() {
      if (this.state !== 'PREPARING') return;
      this.state = 'RUNNING';
      this.perceive();
      this.initFormations();
      for (const u of this.units) if (u.def.boss) this.banner(`⚠ 보스 등장: ${u.def.name}`, u.def.bossData.color || '#ff6060', 2.5, u.def.bossData.title);
    }
    pause() { if (this.state === 'RUNNING') this.state = 'PAUSED'; }
    resume() { if (this.state === 'PAUSED') this.state = 'RUNNING'; }
    get running() { return this.state === 'RUNNING'; }

    // ── 공간 분할 ──
    buildGrid() {
      this.grid.clear(); this.cellCount[0].clear(); this.cellCount[1].clear();
      if (!this.tgrid) this.tgrid = [new Map(), new Map()];
      this.tgrid[0].clear(); this.tgrid[1].clear();
      const c = this.cell;
      for (const u of this.units) {
        if (!u.alive) continue;
        const k = ((u.x / c) | 0) + ((u.y / c) | 0) * 4096;
        let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(u);
        const tg = this.tgrid[u.team];
        let b = tg.get(k); if (!b) tg.set(k, b = []); b.push(u);
        const cc = this.cellCount[u.team]; cc.set(k, (cc.get(k) || 0) + 1);
      }
    }
    cellDensity(team, x, y) { const c = this.cell; return this.cellCount[team].get(((x / c) | 0) + ((y / c) | 0) * 4096) || 0; }
    // team 을 지정하면 그 팀의 격자만 검색 (적/아군 검색이 상대 유닛을 건너뜀)
    query(x, y, r, cb, team) {
      const c = this.cell, g = team === undefined ? this.grid : this.tgrid[team];
      const x0 = Math.max(0, ((x - r) / c) | 0), x1 = ((x + r) / c) | 0;
      const y0 = Math.max(0, ((y - r) / c) | 0), y1 = ((y + r) / c) | 0;
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const a = g.get(gx + gy * 4096); if (!a) continue;
        for (let i = 0; i < a.length; i++) if (a[i].alive && cb(a[i]) === true) return;
      }
    }
    enemiesIn(x, y, r, team, cb, airOk = true) {
      const each = (e) => {
        if (e.def.untargetable) return;
        if (!airOk && e.def.flying) return;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) cb(e);
      };
      if (team === 0 || team === 1) this.query(x, y, r + 30, each, 1 - team);
      else { this.query(x, y, r + 30, each, 0); this.query(x, y, r + 30, each, 1); }
    }
    alliesIn(x, y, r, team, cb) {
      this.query(x, y, r, (e) => {
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= r * r) cb(e);
      }, team);
    }
    enemyQuery(u, r, cb) { this.query(u.x, u.y, r, cb, 1 - u.team); }

    // ── 1. 인지: 팀 목록, 격자, 팀 정보 ──
    perceive() {
      this.teams[0] = []; this.teams[1] = [];
      for (const u of this.units) if (u.alive) this.teams[u.team].push(u);
      this.buildGrid();
      for (let t = 0; t < 2; t++) {
        const list = this.teams[t], info = this.teamInfo[t];
        let sx = 0, sy = 0, n = 0, front = 0;
        for (const u of list) { if (!u.def.support && !u.def.immobile && u.def.attack !== 'none') front++; if (!u.def.summonOnly) { sx += u.x; sy += u.y; n++; } }
        if (!n) for (const u of list) { sx += u.x; sy += u.y; n++; }
        info.cx = n ? sx / n : this.W / 2; info.cy = n ? sy / n : this.H / 2;
        info.front = front; info.count = list.length;
      }
    }

    // ── 메인 스텝 (고정 시간 간격) ──
    step(dt) { const prev = curRng; curRng = this._rng; try { this._step(dt); } finally { curRng = prev; } }
    _step(dt) {
      if (this.state === 'PREPARING') this.start();
      if (this.state !== 'RUNNING' || this.over) return;
      this.time += dt;
      this.perceive();                        // 1. Perception
      this.applyBuffs(dt);                    // 7. Status (버프·오라)
      this.updateFormations(dt);              // 4. Formation
      const big = this.units.length > 700;
      // (3.1) 업데이트 LOD: 대규모 전투에서 적과 멀리 떨어진 유닛은 격프레임으로 2배 시간 간격 갱신
      const lod = this.units.length > 900, par = (this.frame || 0) & 1;
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (!u.alive) continue;
        if (lod && u.nearD > 600 && !u.def.boss && u.ai.action !== 'flee') {
          if ((u.uid & 1) !== par) continue;
          this.updateUnit(u, dt * 2, big);
        } else this.updateUnit(u, dt, big);   // 2·3·5·6 Targeting / Movement / Combat / Skill
      }
      this.updateProjectiles(dt);
      this.updateAreas(dt);
      this.frame = (this.frame || 0) + 1;
      const sepEvery = this.units.length > 1500 ? 3 : big ? 2 : 1;
      if (this.frame % sepEvery === 0) this.separate();    // 대규모 전투: 충돌 처리 빈도 조절
      this.cleanupDead();                     // 8. Death
      for (const h of this.hooks) h(this, dt);
      if (this.visual) this.updateFx(dt);
      this.checkEnd();
    }

    cleanupDead() {
      let w = 0;
      for (let i = 0; i < this.units.length; i++) { const u = this.units[i]; if (u.alive) this.units[w++] = u; }
      this.units.length = w;
    }

    checkEnd() {
      const a = this.units.some(u => u.team === 0), b = this.units.some(u => u.team === 1);
      if (this.endless) { if (!a) this.finish(1); return; }
      if (!a || !b) this.finish(a ? 0 : b ? 1 : -1);
      else if (this.time >= this.timeLimit) {
        this.timeout = true;
        const hp = [0, 0]; for (const u of this.units) hp[u.team] += u.hp;
        this.finish(hp[0] > hp[1] ? 0 : 1);
      }
    }
    finish(winner) {
      this.over = true; this.winner = winner; this.state = 'FINISHED';
      for (const u of this.units) {
        const life = this.time - u.born;
        this.recOf(u).life += life;
        this.trackLife(u, life);
      }
    }
    trackLife(u, life) {
      if (u.def.summonOnly) return;
      if (!this.best.life || life > this.best.life.life) this.best.life = { type: u.type, team: u.team, life };
    }

    // ── 버프: 오라 · 시간제 효과 · 재생 ──
    applyBuffs(dt) {
      for (const u of this.units) {
        const b = u.buff;
        if (!u.bd && !u.timed.length) continue;          // (3.1) 버프가 없던 유닛은 초기화 생략
        b.atkSpd = b.dmg = b.armor = b.slow = b.atkSlow = b.speed = b.regen = b.crit = b.block = b.reflect = b.dodge = b.lifesteal = b.projTaken = b.covered = 0;
        u.bd = u.timed.length > 0;
        if (u.timed.length) {
          for (let i = u.timed.length - 1; i >= 0; i--) {
            const t = u.timed[i]; t.t -= dt;
            if (t.t <= 0) { u.timed.splice(i, 1); continue; }
            for (const k in t.mods) b[k] += t.mods[k];
          }
        }
      }
      // 오라는 0.2초마다 다시 계산해 유닛별로 캐시 (대규모 전투 최적화)
      this._abT = (this._abT || 0) - dt;
      if (this._abT <= 0) {
        this._abT = 0.2;
        for (const u of this.units) u.ab = null;
        for (const u of this.units) {
          const a = u.def.aura; if (!u.alive || !a) continue;
          const eff = 1 + (this.fm(u.team).supportEff || 0);
          if (a.ally) this.alliesIn(u.x, u.y, a.radius, u.team, (o) => {
            if (o === u && u.type !== 'hero') return;
            const ab = o.ab || (o.ab = {});
            for (const k in a.ally) { const v = a.ally[k] * eff; if (!(ab[k] >= v)) ab[k] = v; }
          });
          if (a.enemy) this.enemiesIn(u.x, u.y, a.radius, u.team, (o) => {
            const ab = o.ab || (o.ab = {});
            for (const k in a.enemy) if (!(ab[k] >= a.enemy[k])) ab[k] = a.enemy[k];
          });
        }
      }
      for (const u of this.units) {
        const ab = u.ab; if (!ab) continue;
        const b = u.buff; u.bd = true;
        for (const k in ab) if (ab[k] > b[k]) b[k] = ab[k];
      }
    }
    addTimed(u, mods, dur) { u.timed.push({ mods, t: dur }); }

    // ── 유닛 업데이트 ──
    updateUnit(u, dt, big) {
      const d = u.def;
      u.anim += dt;
      if (u.flash > 0) u.flash -= dt;
      u.rx *= 0.8; u.ry *= 0.8;
      if (d.lifetime) { u.life -= dt; if (u.life <= 0) { this.kill(u, null, true); return; } }
      if (d.hatch) {
        u.hatchT -= dt;
        if (u.hatchT <= 0) {
          u.alive = false;
          const p = this.spawn(d.hatch.into, u.team, u.x, u.y, { noRebirth: true });
          p.hp = p.maxHp * 0.6;
          this.addFx({ kind: 'ring', x: u.x, y: u.y, r: 60, color: '#ffcc33', T: 0.6 });
          return;
        }
      }
      if (!this.updateStatus(u, dt)) return;
      if (u.skillCd > 0) u.skillCd -= dt;
      if (d.boss) this.updateBoss(u, dt);
      if (!u.alive) return;
      if (u.stun > 0 || u.freeze > 0) {
        u.stun -= dt; u.freeze -= dt; u.ai.state = 'stunned';
        u.vx *= 0.8; u.vy *= 0.8;
        u.x = clamp(u.x + u.kx * dt, u.r, this.W - u.r); u.y = clamp(u.y + u.ky * dt, u.r, this.H - u.r);
        return;
      }
      // 공격 속도
      let spdMul = 1 + u.buff.atkSpd - u.buff.atkSlow;
      if (d.rage) spdMul *= 1 + 1.5 * (1 - u.hp / u.maxHp);
      u.cd -= dt * Math.max(0.2, spdMul);

      this.passiveAbilities(u, dt);
      if (!u.alive) return;

      // AI 판단 (유닛별 분산 주기)
      u.ai.think -= dt; u.ai.hold -= dt;
      if (u.ai.think <= 0) {
        // 전투와 먼 유닛은 판단 주기를 늘린다 (중요도 기반 업데이트 빈도)
        u.ai.think = (u.nearD > 650 ? 0.6 : big ? (this.units.length > 1500 ? 0.5 : 0.35) : 0.22) + rand() * 0.18;
        this.think(u);
        if (!u.alive) return;
      }
      this.move(u, dt);
      this.tryAttack(u);
    }

    // 상태이상 진행. 사망하면 false
    updateStatus(u, dt) {
      if (u.burn > 0) { u.burn -= dt; this.damage(null, u, u.burnDps * dt, 'true', { dot: true, srcTeam: 1 - u.team, element: 'fire' }); if (!u.alive) return false; }
      if (u.poison > 0) {
        u.poison -= dt; this.damage(null, u, u.poisonDps * u.poisonStacks * dt, 'true', { dot: true, srcTeam: 1 - u.team, element: 'poison' });
        if (!u.alive) return false; if (u.poison <= 0) u.poisonStacks = 0;
      }
      if (u.buff.regen > 0 && u.hp < u.maxHp) this.heal(u, u.buff.regen * dt, null, true);
      if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slowAmt = 0; }
      if (u.weakT > 0) u.weakT -= dt;
      if (u.markT > 0) u.markT -= dt;
      if (u.exposedT > 0) u.exposedT -= dt;
      if (u.cmdT > 0) u.cmdT -= dt;
      if (u.knockT > 0) u.knockT -= dt;
      if (u.tauntT > 0) { u.tauntT -= dt; if (u.tauntT <= 0 || !u.tauntBy || !u.tauntBy.alive) { u.tauntT = 0; u.tauntBy = null; } }
      if (u.def.stealth && !u.stealthed) { u.revealT -= dt; if (u.revealT <= 0) { u.stealthed = true; u.ambush = true; } }
      const decay = Math.pow(0.02, dt); u.kx *= decay; u.ky *= decay;
      return true;
    }

    // ── 시각 효과 (판정과 분리) ──
    fxBudget() { return this.quality === 'low' ? 300 : this.quality === 'medium' ? 800 : 1600; }
    addFx(f) {
      if (!this.visual || this.fx.length > this.fxBudget()) return;
      f.t = 0; this.fx.push(f);
    }
    particles(x, y, color, n, sp) {
      if (!this.visual) return;
      if (this.quality === 'low') n = Math.ceil(n / 4); else if (this.quality === 'medium') n = Math.ceil(n / 2);
      const budget = this.fxBudget();
      for (let i = 0; i < n && this.fx.length < budget; i++) {
        const a = rand() * Math.PI * 2, s = sp * (0.3 + rand());
        const p = this.fxPool.pop() || {};       // 파티클 객체 재사용 풀
        p.kind = 'p'; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.color = color;
        p.size = 1.5 + rand() * 2.5; p.t = 0; p.T = 0.4 + rand() * 0.4;
        this.fx.push(p);
      }
    }
    banner(text, color, T = 2, sub) { if (this.visual) this.banners.push({ text, sub, color, t: 0, T }); }
    updateFx(dt) {
      let w = 0;
      for (let i = 0; i < this.fx.length; i++) {
        const f = this.fx[i];
        f.t += dt;
        if (f.kind === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
        else if (f.kind === 'text') f.y -= 22 * dt;
        if (f.t < f.T) this.fx[w++] = f;
        else if (f.kind === 'p' && this.fxPool.length < 2000) this.fxPool.push(f);
      }
      this.fx.length = w;
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter(b => b.t < b.T);
      if (this.shake > 0) this.shake -= dt;
      if (this.flashT > 0) this.flashT -= dt;
    }
  }

  SW.Battle = Battle;
  SW.WORLD = { W: 1600, H: 900 };
})();
