// 전투 엔진 (DOM 비의존)
window.SW = window.SW || {};

(() => {
  const W = 1600, H = 900;
  const rand = Math.random;
  const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

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

  // 수정자를 적용한 유닛 정의
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
    return d;
  };

  let UID = 1;

  class Battle {
    constructor(opts = {}) {
      this.W = W; this.H = H;
      this.units = [];
      this.projs = [];
      this.areas = [];
      this.fx = [];
      this.time = 0;
      this.over = false;
      this.winner = null;
      this.timeLimit = opts.timeLimit || 240;
      this.mods = opts.mods || [null, null];
      this.buffs = opts.buffs || [null, null];
      this.defCache = [{}, {}];
      this.teams = [[], []];
      this.grid = new Map();
      this.cell = 60;
      this.visual = opts.visual !== false;
      this.stats = [{ dmg: 0, kills: 0 }, { dmg: 0, kills: 0 }];
    }

    def(type, team) {
      const c = this.defCache[team];
      if (!c[type]) c[type] = SW.resolveDef(type, this.mods[team], this.buffs[team]);
      return c[type];
    }

    spawn(type, team, x, y, extra) {
      const d = this.def(type, team);
      const u = {
        uid: UID++, type, def: d, team, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: d.size, hp: d.hp, maxHp: d.hp, shield: 0, cd: rand() * 0.6,
        target: null, retarget: 0, facing: team === 0 ? 0 : Math.PI, alive: true,
        burn: 0, burnDps: 0, poison: 0, poisonStacks: 0, poisonDps: 0, slowT: 0, slowAmt: 0, stun: 0, freeze: 0,
        buff: { atkSpd: 0, dmg: 0, armor: 0, slow: 0, atkSlow: 0, speed: 0 },
        abilT: rand() * 2, leapT: 1 + rand(), stealthed: !!d.stealth, revealT: 0,
        charging: false, ambush: !!d.stealth, revived: false, flash: 0, summons: 0, raised: 0,
        life: d.lifetime || 0, hatchT: d.hatch ? d.hatch.t : 0, owner: null, anim: rand() * 10,
        ...extra,
      };
      this.units.push(u);
      return u;
    }

    remove(u) { const i = this.units.indexOf(u); if (i >= 0) this.units.splice(i, 1); }

    // ── 공간 분할 ──
    buildGrid() {
      this.grid.clear();
      const c = this.cell;
      for (const u of this.units) {
        if (!u.alive) continue;
        const k = ((u.x / c) | 0) + ((u.y / c) | 0) * 1000;
        let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(u);
      }
    }
    query(x, y, r, cb) {
      const c = this.cell;
      const x0 = Math.max(0, ((x - r) / c) | 0), x1 = ((x + r) / c) | 0;
      const y0 = Math.max(0, ((y - r) / c) | 0), y1 = ((y + r) / c) | 0;
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const a = this.grid.get(gx + gy * 1000); if (!a) continue;
        for (const u of a) if (u.alive) cb(u);
      }
    }
    enemiesIn(x, y, r, team, cb, airOk = true) {
      this.query(x, y, r + 30, (e) => {
        if (e.team === team || e.def.untargetable) return;
        if (!airOk && e.def.flying) return;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) cb(e);
      });
    }
    alliesIn(x, y, r, team, cb) {
      this.query(x, y, r, (e) => {
        if (e.team !== team) return;
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= r * r) cb(e);
      });
    }

    // ── 메인 스텝 ──
    step(dt) {
      if (this.over) return;
      this.time += dt;
      this.teams[0] = []; this.teams[1] = [];
      for (const u of this.units) if (u.alive) this.teams[u.team].push(u);
      this.buildGrid();
      this.applyAuras();
      for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
      this.updateProjectiles(dt);
      this.updateAreas(dt);
      this.separate(dt);
      // 사망 정리
      for (let i = this.units.length - 1; i >= 0; i--) if (!this.units[i].alive) this.units.splice(i, 1);
      if (this.visual) this.updateFx(dt);
      this.checkEnd();
    }

    checkEnd() {
      const a = this.units.some(u => u.team === 0), b = this.units.some(u => u.team === 1);
      if (!a || !b) { this.over = true; this.winner = a ? 0 : b ? 1 : -1; }
      else if (this.time >= this.timeLimit) {
        this.over = true; this.timeout = true;
        const hp = [0, 0]; for (const u of this.units) hp[u.team] += u.hp;
        this.winner = hp[0] > hp[1] ? 0 : 1;
      }
    }

    applyAuras() {
      for (const u of this.units) { const b = u.buff; b.atkSpd = b.dmg = b.armor = b.slow = b.atkSlow = b.speed = 0; }
      for (const u of this.units) {
        const a = u.def.aura; if (!u.alive || !a) continue;
        if (a.ally) this.alliesIn(u.x, u.y, a.radius, u.team, (o) => {
          if (o === u && u.type !== 'hero') return;
          for (const k in a.ally) o.buff[k] = Math.max(o.buff[k], a.ally[k]);
        });
        if (a.enemy) this.enemiesIn(u.x, u.y, a.radius, u.team, (o) => {
          for (const k in a.enemy) o.buff[k] = Math.max(o.buff[k], a.enemy[k]);
        });
      }
    }

    targetable(u, e) {
      if (!e.alive || e.team === u.team || e.stealthed || e.def.untargetable) return false;
      if (e.def.flying && !u.def.canHitAir) return false;
      return true;
    }

    findTarget(u) {
      const d = u.def, enemies = this.teams[1 - u.team];
      let best = null, bd = Infinity;
      // 도발
      if (!d.flying) {
        for (const e of enemies) if (e.def.taunt && this.targetable(u, e)) {
          const dd = dist2(u, e); if (dd < e.def.taunt * e.def.taunt && dd < bd) { bd = dd; best = e; }
        }
        if (best) return best;
      }
      const mode = d.targeting;
      if (mode === 'backline') {
        for (const e of enemies) if (this.targetable(u, e) && (e.def.range > 60 || e.def.support)) {
          const dd = dist2(u, e); if (dd < bd) { bd = dd; best = e; }
        }
        if (best) return best;
      } else if (mode === 'strongest') {
        const rr = (d.range + 40) ** 2; let bh = -1;
        for (const e of enemies) if (this.targetable(u, e) && dist2(u, e) < rr && e.maxHp > bh) { bh = e.maxHp; best = e; }
        if (best) return best;
      }
      for (const e of enemies) if (this.targetable(u, e)) {
        const dd = dist2(u, e); if (dd < bd) { bd = dd; best = e; }
      }
      return best;
    }

    findHealTarget(u) {
      let best = null, br = 0.999;
      const rr = (u.def.range * 3) ** 2;
      for (const o of this.teams[u.team]) {
        if (o === u || o.def.immobile && o.def.attack === 'none') continue;
        const r = o.hp / o.maxHp; if (r < br && dist2(u, o) < rr) { br = r; best = o; }
      }
      return best;
    }

    nearestEnemy(u) {
      let best = null, bd = Infinity;
      for (const e of this.teams[1 - u.team]) { if (e.stealthed) continue; const dd = dist2(u, e); if (dd < bd) { bd = dd; best = e; } }
      return best;
    }

    updateUnit(u, dt) {
      const d = u.def;
      u.anim += dt;
      if (u.flash > 0) u.flash -= dt;
      // 수명 / 부화
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
      // 상태 이상
      if (u.burn > 0) { u.burn -= dt; this.damage(null, u, u.burnDps * dt, 'true', { dot: true, srcTeam: 1 - u.team }); if (!u.alive) return; }
      if (u.poison > 0) { u.poison -= dt; this.damage(null, u, u.poisonDps * u.poisonStacks * dt, 'true', { dot: true, srcTeam: 1 - u.team }); if (!u.alive) return; if (u.poison <= 0) u.poisonStacks = 0; }
      if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slowAmt = 0; }
      if (d.stealth && !u.stealthed) { u.revealT -= dt; if (u.revealT <= 0) { u.stealthed = true; u.ambush = true; } }
      u.kx *= Math.pow(0.02, dt); u.ky *= Math.pow(0.02, dt);
      if (u.stun > 0 || u.freeze > 0) {
        u.stun -= dt; u.freeze -= dt;
        u.x = clamp(u.x + u.kx * dt, u.r, W - u.r); u.y = clamp(u.y + u.ky * dt, u.r, H - u.r);
        return;
      }

      // 공격 속도
      let spdMul = 1 + u.buff.atkSpd - u.buff.atkSlow;
      if (d.rage) spdMul *= 1 + 1.5 * (1 - u.hp / u.maxHp);
      u.cd -= dt * Math.max(0.2, spdMul);

      this.abilities(u, dt);
      if (!u.alive) return;

      // 타겟
      const isHealer = d.attack === 'heal';
      u.retarget -= dt;
      if (isHealer) {
        if (u.retarget <= 0 || !u.target || !u.target.alive || u.target.hp >= u.target.maxHp) { u.target = this.findHealTarget(u); u.retarget = 0.3; }
      } else if (u.retarget <= 0 || !u.target || !this.targetable(u, u.target)) {
        u.target = this.findTarget(u); u.retarget = 0.3 + rand() * 0.2;
      }
      const t = u.target;

      // 이동
      let mx = 0, my = 0, speed = d.speed * Math.max(0.1, 1 - Math.max(u.slowAmt, u.buff.slow)) * (1 + u.buff.speed);
      const hasFront = d.support && this.teams[u.team].some(o => !o.def.support && !o.def.immobile);
      if (!d.immobile) {
        if (d.keepDist && hasFront) {
          const ne = this.nearestEnemy(u);
          if (ne) {
            const dd = Math.sqrt(dist2(u, ne));
            const want = d.keepDist + (t && d.range > d.keepDist ? 0 : 0);
            if (dd < want) { mx = (u.x - ne.x) / dd; my = (u.y - ne.y) / dd; }
            else if (dd > want + 40) { mx = (ne.x - u.x) / dd; my = (ne.y - u.y) / dd; }
            u.facing = Math.atan2(ne.y - u.y, ne.x - u.x);
          }
        } else if (isHealer) {
          if (t) {
            const dd = Math.sqrt(dist2(u, t));
            if (dd > d.range * 0.8) { mx = (t.x - u.x) / dd; my = (t.y - u.y) / dd; }
          } else {
            const ne = this.nearestEnemy(u);
            if (ne) {
              const dd = Math.sqrt(dist2(u, ne));
              if (dd < 140) { mx = (u.x - ne.x) / dd; my = (u.y - ne.y) / dd; }
              else if (dd > 200 && hasFront) { mx = (ne.x - u.x) / dd; my = (ne.y - u.y) / dd; }
            }
          }
        } else if (t) {
          const dd = Math.sqrt(dist2(u, t)) || 0.01;
          const reach = this.reach(u, t);
          const nx = (t.x - u.x) / dd, ny = (t.y - u.y) / dd;
          u.facing = Math.atan2(ny, nx);
          if (d.minRange && dd < d.minRange) { mx = -nx; my = -ny; }
          else if (d.kite && dd < d.range * 0.45) { mx = -nx; my = -ny; }
          else if (dd > reach * 0.92) {
            mx = nx; my = ny;
            // 돌진
            if (d.charge) {
              if (dd > d.charge.minDist) u.charging = true;
              if (u.charging) speed *= d.charge.speedMul;
            }
            // 도약
            if (d.leap && u.leapT <= 0 && dd < d.leap.range && dd > reach + 20) {
              const ox = u.x, oy = u.y;
              u.x = t.x - nx * (reach * 0.8); u.y = t.y - ny * (reach * 0.8);
              u.leapT = d.leap.cd; u.ambush = true; u.cd = Math.min(u.cd, 0.05);
              this.addFx({ kind: 'dash', x: ox, y: oy, x2: u.x, y2: u.y, color: '#ff7070', T: 0.3 });
            }
          }
        }
      } else if (t) {
        u.facing = Math.atan2(t.y - u.y, t.x - u.x);
      }
      if (d.leap) u.leapT -= dt;
      u.vx = mx * speed; u.vy = my * speed;
      u.x = clamp(u.x + (u.vx + u.kx) * dt, u.r, W - u.r);
      u.y = clamp(u.y + (u.vy + u.ky) * dt, u.r, H - u.r);

      // 공격
      if (t && u.cd <= 0 && d.attack !== 'none') {
        const dd = Math.sqrt(dist2(u, t));
        if (dd <= this.reach(u, t) && !(d.minRange && dd < d.minRange)) {
          u.cd = d.atkCd;
          this.attack(u, t, dd);
        }
      } else if (!t && u.cd <= 0) u.cd = 0;
    }

    reach(u, t) {
      const d = u.def;
      if (d.attack === 'heal') return d.range;
      if (d.range > 40) return d.range + t.r;
      return u.r + t.r + 4 + (d.range || 0);
    }

    abilities(u, dt) {
      const d = u.def;
      if (!(d.summon || d.shieldGive || d.healPulse || d.vortex)) return;
      u.abilT -= dt;
      if (u.abilT > 0) return;
      if (d.summon) {
        u.abilT = d.summon.cd;
        const s = d.summon;
        const alive = this.units.filter(o => o.alive && o.owner === u.uid).length;
        const n = Math.min(s.count, s.max - alive);
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2;
          const off = s.unit === 'turret' ? 25 : 18;
          const fx = u.team === 0 ? 1 : -1;
          this.spawn(s.unit, u.team, clamp(u.x + fx * off + Math.cos(a) * 10, 10, W - 10), clamp(u.y + Math.sin(a) * off, 10, H - 10), { owner: u.uid });
          this.addFx({ kind: 'ring', x: u.x + fx * off, y: u.y, r: 18, color: d.accent, T: 0.4 });
        }
      } else if (d.shieldGive) {
        const s = d.shieldGive; u.abilT = s.cd;
        const cands = [];
        this.alliesIn(u.x, u.y, s.radius, u.team, (o) => { if (o !== u && o.shield < s.amt * 0.5) cands.push(o); });
        cands.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        for (const o of cands.slice(0, s.count)) { o.shield = Math.max(o.shield, s.amt); this.addFx({ kind: 'beam', x: u.x, y: u.y, t: o, color: '#8ad8ff', T: 0.3 }); }
      } else if (d.healPulse) {
        const s = d.healPulse; u.abilT = s.cd;
        this.alliesIn(u.x, u.y, s.radius, u.team, (o) => this.heal(o, s.amt));
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: s.radius, color: '#a8ffb0', T: 0.6 });
      } else if (d.vortex) {
        const t = u.target;
        if (!t || dist2(u, t) > (d.range + 80) ** 2) { u.abilT = 0.5; return; }
        const s = d.vortex; u.abilT = s.cd;
        this.areas.push({ kind: 'vortex', x: t.x, y: t.y, r: s.radius, t: s.dur, T: s.dur, pull: s.pull, dps: s.dps, team: u.team, src: u });
      }
    }

    attack(u, t, dd) {
      const d = u.def;
      if (d.stealth) { u.stealthed = false; u.revealT = d.stealth.reveal; }
      let mult = 1;
      if (u.ambush && d.ambush) { mult = d.ambush; u.ambush = false; }
      if (u.charging && d.charge) { mult *= d.charge.mult; }
      const dmg = d.dmg * mult;
      const knock = (u.charging && d.charge) ? d.charge.knock : 0;
      u.charging = false;
      const opt = { melee: d.range <= 40, knock };
      switch (d.attack) {
        case 'melee':
          if (d.splash) {
            this.enemiesIn(t.x, t.y, d.splash, u.team, (e) => this.hit(u, e, e === t ? dmg : dmg * 0.6, opt), d.canHitAir);
            this.addFx({ kind: 'ring', x: t.x, y: t.y, r: d.splash, color: d.accent, T: 0.25 });
          } else this.hit(u, t, dmg, opt);
          this.addFx({ kind: 'slash', x: u.x, y: u.y, a: u.facing, r: u.r + 6, color: '#fff', T: 0.15 });
          break;
        case 'spin':
          this.enemiesIn(u.x, u.y, d.splash + u.r, u.team, (e) => this.hit(u, e, dmg, opt), d.canHitAir);
          this.addFx({ kind: 'spin', x: u.x, y: u.y, r: d.splash + u.r, color: d.accent, T: 0.25 });
          break;
        case 'explode':
          this.explode(u, u.x, u.y, d.splash, dmg, d.dmgType);
          this.kill(u, null, true);
          break;
        case 'arrow': case 'bolt': case 'fireball':
          this.projs.push({ kind: d.attack, x: u.x, y: u.y, tx: t.x, ty: t.y, target: t, src: u, team: u.team, speed: d.projSpeed, dmg, type: d.dmgType, splash: d.splash, color: d.accent, life: 3, mult });
          break;
        case 'lob': {
          const T = Math.max(0.4, dd / d.projSpeed);
          // 이동 예측
          const px = t.x + t.vx * T * 0.6, py = t.y + t.vy * T * 0.6;
          this.projs.push({ kind: 'lob', x: u.x, y: u.y, sx: u.x, sy: u.y, tx: px, ty: py, t: 0, T, src: u, team: u.team, dmg, type: d.dmgType, splash: d.splash, color: d.accent });
          break;
        }
        case 'pierce': {
          const nx = (t.x - u.x) / dd, ny = (t.y - u.y) / dd;
          this.projs.push({ kind: 'pierce', x: u.x, y: u.y, vx: nx * d.projSpeed, vy: ny * d.projSpeed, dist: d.range + 120, src: u, team: u.team, dmg, type: d.dmgType, hit: new Set(), color: d.accent });
          break;
        }
        case 'chain': {
          const hitSet = new Set([t]); const pts = [[u.x, u.y], [t.x, t.y]];
          this.hit(u, t, dmg, { proj: true });
          let last = t, cur = dmg;
          for (let i = 1; i < d.chain.count; i++) {
            let nb = null, nd = Infinity;
            this.enemiesIn(last.x, last.y, d.chain.jump, u.team, (e) => {
              if (hitSet.has(e) || e.stealthed) return; const q = dist2(last, e); if (q < nd) { nd = q; nb = e; }
            });
            if (!nb) break;
            cur *= 0.85; hitSet.add(nb); pts.push([nb.x, nb.y]);
            this.hit(u, nb, cur, { proj: true });
            last = nb;
          }
          this.addFx({ kind: 'lightning', pts, color: '#fff36b', T: 0.25 });
          break;
        }
        case 'meteor': {
          // 가장 밀집한 곳 찾기
          let best = t, bc = 0;
          for (const e of this.teams[1 - u.team]) {
            if (e.stealthed || dist2(u, e) > (d.range + 40) ** 2) continue;
            let c = 0; this.enemiesIn(e.x, e.y, d.splash * 0.8, u.team, () => c++);
            if (c > bc) { bc = c; best = e; }
          }
          this.areas.push({ kind: 'meteor', x: best.x, y: best.y, r: d.splash, t: 1.2, T: 1.2, dmg, type: d.dmgType, team: u.team, src: u });
          break;
        }
        case 'heal':
          this.heal(t, d.heal);
          this.addFx({ kind: 'beam', x: u.x, y: u.y, t, color: '#7dff8a', T: 0.3 });
          break;
      }
    }

    explode(src, x, y, r, dmg, type) {
      this.enemiesIn(x, y, r, src ? src.team : -1, (e) => this.hit(src, e, dmg, {}));
      this.addFx({ kind: 'boom', x, y, r, color: '#ffa040', T: 0.45 });
      this.particles(x, y, '#ffa040', 14, 160);
    }

    heal(o, amt) {
      if (!o.alive || o.hp >= o.maxHp) return;
      o.hp = Math.min(o.maxHp, o.hp + amt);
    }

    // 피격: 피해 + 부가효과
    hit(src, t, dmg, opt) {
      if (!t.alive) return;
      const d = src ? src.def : null;
      this.damage(src, t, dmg, d ? d.dmgType : 'phys', opt);
      if (!d || !t.alive) return;
      const h = d.onHit;
      if (h) {
        if (h.burn) { t.burn = Math.max(t.burn, h.burn.dur); t.burnDps = Math.max(t.burnDps, h.burn.dps); }
        if (h.poison) { t.poison = h.poison.dur; t.poisonDps = Math.max(t.poisonDps, h.poison.dps); t.poisonStacks = Math.min(h.poison.max, t.poisonStacks + 1); }
        if (h.slow) { t.slowAmt = Math.max(t.slowAmt, h.slow.amt); t.slowT = Math.max(t.slowT, h.slow.dur); }
        if (h.freezeChance && rand() < h.freezeChance && !t.def.immobile) { t.freeze = h.freezeDur; }
        if (h.stunChance && rand() < h.stunChance && t.r < 20) { t.stun = h.stunDur; }
      }
      if (opt.knock && !t.def.immobile) {
        const dd = Math.sqrt(dist2(src, t)) || 1;
        const k = opt.knock * 3 * Math.min(1, 12 / t.r);
        t.kx += (t.x - src.x) / dd * k; t.ky += (t.y - src.y) / dd * k;
      }
    }

    damage(src, t, amt, type, opt = {}) {
      if (!t.alive || amt <= 0) return;
      const d = src ? src.def : null;
      if (src) {
        amt *= 1 + src.buff.dmg;
        if (d.bonusVsBig && t.r >= 13) amt *= d.bonusVsBig;
        if (d.antiAir && t.def.flying) amt *= d.antiAir;
        if (d.crit && !opt.dot && rand() < d.crit.chance) amt *= d.crit.mult;
      }
      if (opt.proj && t.def.blockChance && rand() < t.def.blockChance) {
        amt *= 0.15;
        if (this.visual && rand() < 0.5) this.addFx({ kind: 'block', x: t.x, y: t.y, T: 0.2 });
      }
      if (type === 'phys') {
        const armor = t.def.armor + t.buff.armor;
        amt = Math.max(amt * 0.2, amt - armor);
      }
      if (src && src.alive && !opt.noReflect) {
        if (t.def.reflectProj && opt.proj) this.damage(t, src, amt * t.def.reflectProj, 'true', { noReflect: true });
        if (t.def.thorns && opt.melee) this.damage(t, src, amt * t.def.thorns, 'true', { noReflect: true });
      }
      const team = src ? src.team : (opt.srcTeam ?? -1);
      if (team >= 0) this.stats[team].dmg += Math.min(amt, t.hp + t.shield);
      if (t.shield > 0) { const a = Math.min(t.shield, amt); t.shield -= a; amt -= a; }
      t.hp -= amt;
      if (!opt.dot) t.flash = 0.08;
      if (src && d.lifesteal && src.alive) this.heal(src, amt * d.lifesteal);
      if (t.hp <= 0) this.kill(t, src);
    }

    kill(u, src, silent) {
      if (!u.alive) return;
      const d = u.def;
      if (d.revive && !u.revived) {
        u.revived = true; u.hp = u.maxHp * d.revive.hpPct;
        u.burn = u.poison = 0; u.poisonStacks = 0;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: 70, color: '#fff4a0', T: 0.8 });
        this.addFx({ kind: 'text', x: u.x, y: u.y - 20, text: '부활!', color: '#fff4a0', T: 1.2 });
        return;
      }
      u.alive = false;
      if (src) this.stats[src.team].kills++;
      if (this.visual) this.particles(u.x, u.y, u.team === 0 ? '#5d95ff' : '#ff6060', Math.min(12, 4 + u.r / 2), 90);
      if (d.onDeath) {
        if (d.onDeath.heal) {
          const h = d.onDeath.heal;
          this.alliesIn(u.x, u.y, h.radius, u.team, (o) => this.heal(o, h.amt));
          this.addFx({ kind: 'ring', x: u.x, y: u.y, r: h.radius, color: '#ffe066', T: 0.7 });
        }
        if (d.onDeath.explode) this.explode(u, u.x, u.y, d.onDeath.explode.radius, d.onDeath.explode.dmg, 'phys');
      }
      if (d.rebirth && !u.noRebirth) {
        this.spawn('egg', u.team, u.x, u.y);
        this.addFx({ kind: 'text', x: u.x, y: u.y - 20, text: '환생 중...', color: '#ffcc33', T: 1.2 });
      }
      // 시체 부활
      if (!d.summonOnly || u.type === 'wisp') {
        for (const n of this.teams[1 - u.team]) {
          if (!n.alive || !n.def.raiseDead || n.raised >= n.def.raiseDead.max) continue;
          if (dist2(n, u) > n.def.raiseDead.radius ** 2) continue;
          n.raised++;
          const s = this.spawn('skeleton', n.team, u.x, u.y);
          s.cd = 0.8;
          this.addFx({ kind: 'beam', x: n.x, y: n.y, t: s, color: '#b6ffb0', T: 0.4 });
          this.addFx({ kind: 'ring', x: u.x, y: u.y, r: 16, color: '#b6ffb0', T: 0.5 });
          break;
        }
      }
    }

    updateProjectiles(dt) {
      const keep = [];
      for (const p of this.projs) {
        let done = false;
        if (p.kind === 'lob') {
          p.t += dt;
          const k = Math.min(1, p.t / p.T);
          p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
          p.z = Math.sin(k * Math.PI) * Math.min(120, p.T * 90);
          if (k >= 1) {
            this.enemiesIn(p.x, p.y, p.splash, p.team, (e) => this.hitP(p, e, p.dmg), false);
            this.addFx({ kind: 'boom', x: p.x, y: p.y, r: p.splash, color: '#d9a66b', T: 0.4 });
            if (this.visual) this.particles(p.x, p.y, '#b48a5a', 8, 100);
            done = true;
          }
        } else if (p.kind === 'pierce') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.dist -= Math.hypot(p.vx, p.vy) * dt;
          this.enemiesIn(p.x, p.y, 4, p.team, (e) => {
            if (p.hit.has(e)) return; p.hit.add(e);
            this.hitP(p, e, p.dmg * Math.pow(0.85, p.hit.size - 1));
          }, true);
          if (p.dist <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) done = true;
        } else {
          const t = p.target;
          if (t && t.alive && !t.stealthed) { p.tx = t.x; p.ty = t.y; }
          const dx = p.tx - p.x, dy = p.ty - p.y, dd = Math.hypot(dx, dy);
          const step = p.speed * dt;
          p.ang = Math.atan2(dy, dx);
          p.life -= dt;
          if (dd <= step + (t && t.alive ? t.r * 0.5 : 2)) {
            p.x = p.tx; p.y = p.ty;
            if (p.splash) {
              this.enemiesIn(p.x, p.y, p.splash, p.team, (e) => this.hitP(p, e, e === t ? p.dmg : p.dmg * 0.7), true);
              this.addFx({ kind: 'boom', x: p.x, y: p.y, r: p.splash, color: p.color, T: 0.3 });
            } else if (t && t.alive) this.hitP(p, t, p.dmg);
            done = true;
          } else { p.x += dx / dd * step; p.y += dy / dd * step; }
          if (p.life <= 0) done = true;
        }
        if (!done) keep.push(p);
      }
      this.projs = keep;
    }

    hitP(p, e, dmg) {
      const src = p.src;
      if (src && src.alive) this.hit(src, e, dmg, { proj: true });
      else {
        // 발사자 사망 시: 기본 피해만
        const fake = { def: src.def, team: p.team, alive: false, buff: { dmg: 0 }, x: p.x, y: p.y };
        this.hit(fake, e, dmg, { proj: true });
      }
    }

    updateAreas(dt) {
      const keep = [];
      for (const a of this.areas) {
        a.t -= dt;
        if (a.kind === 'meteor') {
          if (a.t <= 0) {
            const src = a.src.alive ? a.src : { def: a.src.def, team: a.team, alive: false, buff: { dmg: 0 }, x: a.x, y: a.y };
            this.enemiesIn(a.x, a.y, a.r, a.team, (e) => this.hit(src, e, a.dmg, { proj: true }), true);
            this.addFx({ kind: 'boom', x: a.x, y: a.y, r: a.r, color: '#ff7a3d', T: 0.6 });
            if (this.visual) this.particles(a.x, a.y, '#ff7a3d', 20, 220);
            this.shake = 0.3;
            continue;
          }
        } else if (a.kind === 'vortex') {
          this.enemiesIn(a.x, a.y, a.r, a.team, (e) => {
            if (e.def.immobile) return;
            const dx = a.x - e.x, dy = a.y - e.y, dd = Math.hypot(dx, dy) || 1;
            const f = a.pull * Math.min(1, dd / 20);
            e.x += dx / dd * f * dt * (12 / Math.max(8, e.r)); e.y += dy / dd * f * dt * (12 / Math.max(8, e.r));
            this.damage(a.src.alive ? a.src : null, e, a.dps * dt, 'magic', { dot: true, srcTeam: a.team });
          }, true);
          if (a.t <= 0) continue;
        }
        keep.push(a);
      }
      this.areas = keep;
    }

    separate() {
      for (const u of this.units) {
        if (!u.alive || u.def.immobile) continue;
        const fly = !!u.def.flying;
        this.query(u.x, u.y, u.r + 30, (o) => {
          if (o === u || !!o.def.flying !== fly) return;
          const dx = u.x - o.x, dy = u.y - o.y, rr = u.r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) return;
          const dd = Math.sqrt(d2) || 0.01;
          const ov = rr - dd;
          const mu = u.r * u.r, mo = o.def.immobile ? 1e9 : o.r * o.r;
          const k = ov * (mo / (mu + mo)) * 0.5;
          const nx = d2 ? dx / dd : rand() - 0.5, ny = d2 ? dy / dd : rand() - 0.5;
          u.x += nx * k; u.y += ny * k;
        });
        u.x = clamp(u.x, u.r, W - u.r); u.y = clamp(u.y, u.r, H - u.r);
      }
    }

    // ── 시각 효과 ──
    addFx(f) { if (this.visual) { f.t = 0; this.fx.push(f); } }
    particles(x, y, color, n, sp) {
      if (!this.visual || this.fx.length > 1500) return;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, s = sp * (0.3 + rand());
        this.fx.push({ kind: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, size: 1.5 + rand() * 2.5, t: 0, T: 0.4 + rand() * 0.4 });
      }
    }
    updateFx(dt) {
      const keep = [];
      for (const f of this.fx) {
        f.t += dt;
        if (f.kind === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
        if (f.kind === 'text') f.y -= 20 * dt;
        if (f.t < f.T) keep.push(f);
      }
      this.fx = keep;
      if (this.shake > 0) this.shake -= dt;
    }
  }

  SW.Battle = Battle;
  SW.WORLD = { W, H };
})();
