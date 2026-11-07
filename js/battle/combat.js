// ─────────────────────────────────────────────
// Combat System — 공격 · 공통 피해 계산 · 속성 · 투사체 · 범위 효과 · 사망 · 충돌
// ─────────────────────────────────────────────
(() => {
  const { rand, clamp, dist2 } = SW.util;
  const BACK = { ranged: 1, caster: 1, support: 1 };
  const FRONT = { front: 1, tank: 1 };

  Object.assign(SW.Battle.prototype, {
    reach(u, t) {
      const d = u.def;
      if (d.attack === 'heal') return d.range;
      if (d.range > 40) return d.range + t.r;
      return u.r + t.r + 4 + (d.range || 0);
    },

    canAttack(u, t) {
      return t && t.alive && t.team !== u.team && !t.stealthed && !t.def.untargetable && (!t.def.flying || u.def.canHitAir);
    },

    tryAttack(u) {
      const d = u.def, t = u.target;
      if (!t || u.cd > 0 || d.attack === 'none' || d.attack === 'heal' && t.team !== u.team) { if (!t && u.cd < 0) u.cd = 0; return; }
      if (d.attack === 'heal') {
        if (!t.alive || dist2(u, t) > d.range * d.range) return;
        u.cd = d.atkCd; this.heal(t, d.heal, u);
        this.addFx({ kind: 'beam', x: u.x, y: u.y, t, color: '#7dff8a', T: 0.3 });
        return;
      }
      if (!this.canAttack(u, t)) return;
      const dd = Math.sqrt(dist2(u, t));
      if (dd > this.reach(u, t) || (d.minRange && dd < d.minRange)) return;
      if (d.turnRate) {   // 회전이 느린 유닛은 정면의 적만 공격
        let a = Math.atan2(t.y - u.y, t.x - u.x) - u.facing; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > 1.2) return;
      }
      u.cd = d.atkCd;
      u.ai.state = 'attack';
      this.attack(u, t, dd);
    },

    attack(u, t, dd, multExtra = 1) {
      const d = u.def;
      if (d.stealth) { u.stealthed = false; u.revealT = d.stealth.reveal; }
      let mult = multExtra;
      if (u.ambush && d.ambush) { mult *= d.ambush; u.ambush = false; }
      const charge = u.charging && d.charge;
      if (charge) mult *= d.charge.mult * (1 + (this.fm(u.team).chargeMult || 0));
      const dmg = d.dmg * mult;
      const knock = charge ? d.charge.knock : 0;
      u.charging = false;
      let element = d.element;
      if (d.cycle) { element = d.cycle[u.cycleI % d.cycle.length]; u.cycleI++; }
      const opt = { melee: d.range <= 40, knock, charge: !!charge, element };
      // 공격 연출: 공격 방향으로 살짝 튀어나감
      if (opt.melee) { u.rx += Math.cos(u.facing) * 3; u.ry += Math.sin(u.facing) * 3; }
      switch (d.attack) {
        case 'melee':
          if (d.splash) {
            this.enemiesIn(t.x, t.y, d.splash, u.team, (e) => this.hit(u, e, e === t ? dmg : dmg * 0.6, { ...opt, splash: e !== t }), d.canHitAir);
            this.addFx({ kind: 'ring', x: t.x, y: t.y, r: d.splash, color: d.accent, T: 0.25 });
          } else this.hit(u, t, dmg, opt);
          if (this.quality !== 'low') this.addFx({ kind: 'slash', x: u.x, y: u.y, a: u.facing, r: u.r + 6, color: '#fff', T: 0.15 });
          break;
        case 'spin':
          this.enemiesIn(u.x, u.y, d.splash + u.r, u.team, (e) => this.hit(u, e, dmg, { ...opt, splash: true }), d.canHitAir);
          this.addFx({ kind: 'spin', x: u.x, y: u.y, r: d.splash + u.r, color: d.accent, T: 0.25 });
          break;
        case 'breath':
          this.coneHit(u, u.facing, d.range + u.r + 10, d.cone || 70, dmg, opt);
          this.addFx({ kind: 'cone', x: u.x, y: u.y, a: u.facing, r: d.range + u.r, ang: d.cone || 70, color: SW.ELEMENTS[element]?.color || d.accent, T: 0.35 });
          break;
        case 'explode':
          this.explode(u, u.x, u.y, d.splash, dmg);
          this.kill(u, null, true);
          break;
        case 'arrow': case 'bolt': case 'fireball':
          this.fireProj(u, t, dmg, { element, mult });
          break;
        case 'lob': {
          const T = Math.max(0.4, dd / d.projSpeed);
          const px = t.x + t.vx * T * 0.6, py = t.y + t.vy * T * 0.6;
          this.projs.push({ kind: 'lob', x: u.x, y: u.y, sx: u.x, sy: u.y, tx: px, ty: py, t: 0, T, src: u, team: u.team, dmg, type: d.dmgType, splash: d.splash, color: d.accent, element });
          break;
        }
        case 'pierce': this.firePierce(u, t, dmg, 0); break;
        case 'chain': {
          const hitSet = new Set([t]); const pts = [[u.x, u.y], [t.x, t.y]];
          this.hit(u, t, dmg, { proj: true, element });
          let last = t, cur = dmg;
          for (let i = 1; i < d.chain.count; i++) {
            let nb = null, nd = Infinity;
            this.enemiesIn(last.x, last.y, d.chain.jump, u.team, (e) => {
              if (hitSet.has(e) || e.stealthed) return; const q = dist2(last, e); if (q < nd) { nd = q; nb = e; }
            });
            if (!nb) break;
            cur *= 0.85; hitSet.add(nb); pts.push([nb.x, nb.y]);
            this.hit(u, nb, cur, { proj: true, element });
            last = nb;
          }
          this.addFx({ kind: 'lightning', pts, color: '#fff36b', T: 0.25 });
          break;
        }
        case 'meteor': {
          const best = this.densestEnemy(u, d.range + 40, d.splash * 0.8) || t;
          this.areas.push({ kind: 'meteor', x: best.x, y: best.y, r: d.splash, t: 1.2, T: 1.2, dmg, type: d.dmgType, team: u.team, src: u, element });
          break;
        }
      }
    },

    fireProj(u, t, dmg, o = {}) {
      const d = u.def;
      this.projs.push({ kind: o.kind || d.attack, x: u.x, y: u.y, tx: t.x, ty: t.y, target: t, src: u, team: u.team, speed: o.speed || d.projSpeed,
        dmg, type: o.type || d.dmgType, splash: o.splash !== undefined ? o.splash : d.splash, color: o.element ? (SW.ELEMENTS[o.element]?.color || d.accent) : d.accent,
        life: 3, element: o.element !== undefined ? o.element : d.element, crit: o.crit });
    },
    firePierce(u, t, dmg, knock) {
      const d = u.def, dd = Math.sqrt(dist2(u, t)) || 1;
      const nx = (t.x - u.x) / dd, ny = (t.y - u.y) / dd, sp = d.projSpeed || 700;
      this.projs.push({ kind: 'pierce', x: u.x, y: u.y, vx: nx * sp, vy: ny * sp, dist: Math.max(d.range, 200) + 120, src: u, team: u.team, dmg, type: d.dmgType, hit: new Set(), color: d.accent, knock });
    },

    coneHit(u, ang, range, deg, dmg, opt) {
      const half = deg * Math.PI / 360;
      this.enemiesIn(u.x, u.y, range, u.team, (e) => {
        let a = Math.atan2(e.y - u.y, e.x - u.x) - ang;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) <= half) this.hit(u, e, dmg, { ...opt, splash: true });
      }, u.def.canHitAir);
    },

    densestEnemy(u, range, r) {
      let best = null, bc = 0;
      const enemies = this.teams[1 - u.team];
      const step = Math.max(1, Math.floor(enemies.length / 60));    // 대규모 전투: 표본만 검사
      for (let i = 0; i < enemies.length; i += step) {
        const e = enemies[i];
        if (e.stealthed || dist2(u, e) > range * range) continue;
        const c = this.cellDensity(e.team, e.x, e.y);
        if (c > bc) { bc = c; best = e; }
      }
      return best;
    },

    explode(src, x, y, r, dmg, element) {
      this.enemiesIn(x, y, r, src ? src.team : -1, (e) => this.hit(src, e, dmg, { splash: true, element }));
      this.addFx({ kind: 'boom', x, y, r, color: '#ffa040', T: 0.45 });
      this.addFx({ kind: 'shock', x, y, r: r * 1.6, color: '#ffd0a0', T: 0.35 });
      this.particles(x, y, '#ffa040', 14, 160);
    },

    heal(o, amt, src, regen) {
      if (!o.alive || o.hp >= o.maxHp || amt <= 0) return 0;
      if (o.poisonStacks > 0) amt *= 0.5;                       // 독: 회복 차단 50%
      if (!regen) amt *= 1 + (this.fm(o.team).supportEff || 0);
      const real = Math.min(amt, o.maxHp - o.hp);
      o.hp += real;
      if (src) { src.st.healed += real; this.recOf(src).healed += real; }
      this.stats[o.team].healed += real;
      return real;
    },

    // 피격: 피해 + 부가효과
    hit(src, t, dmg, opt) {
      if (!t.alive) return;
      const d = src ? src.def : null;
      const dealt = this.damage(src, t, dmg, opt.type || (d ? d.dmgType : 'phys'), opt);
      if (!d || !t.alive || dealt === 0) return;
      const h = d.onHit;
      if (h) {
        if (h.burn) { t.burn = Math.max(t.burn, h.burn.dur); t.burnDps = Math.max(t.burnDps, h.burn.dps); }
        if (h.poison) { t.poison = h.poison.dur; t.poisonDps = Math.max(t.poisonDps, h.poison.dps); t.poisonStacks = Math.min(h.poison.max, t.poisonStacks + 1); }
        if (h.slow) { t.slowAmt = Math.max(t.slowAmt, h.slow.amt); t.slowT = Math.max(t.slowT, h.slow.dur); }
        if (h.freezeChance && rand() < h.freezeChance && !t.def.immobile && !t.def.boss) t.freeze = h.freezeDur;
        if (h.stunChance && rand() < h.stunChance && t.r < 20) t.stun = h.stunDur;
      }
      if (opt.knock && !t.def.immobile) this.knockback(t, src.x, src.y, opt.knock);
    },

    knockback(t, fx, fy, force) {
      const dx = t.x - fx, dy = t.y - fy, dd = Math.hypot(dx, dy) || 1;
      const k = force * 3 * clamp(100 / t.mass, 0.05, 1.5);     // 질량이 클수록 덜 밀림
      t.kx += dx / dd * k; t.ky += dy / dd * k; t.knockT = 0.6;
    },

    // 속성 기본 효과
    applyElement(t, el, d) {
      const h = d && d.onHit;
      switch (el) {
        case 'fire': if (!(h && h.burn) && t.burn < 1.5) { t.burn = 2; t.burnDps = Math.max(t.burnDps, 3); } break;
        case 'frost': if (!(h && h.slow)) { t.slowAmt = Math.max(t.slowAmt, 0.3); t.slowT = Math.max(t.slowT, 1.5); } break;
        case 'poison': if (!(h && h.poison)) { t.poison = 4; t.poisonDps = Math.max(t.poisonDps, 3); t.poisonStacks = Math.min(4, t.poisonStacks + 1); } break;
        case 'dark': t.weakT = 3; break;
      }
    },

    // ── 공통 피해 계산 모듈 ──
    damage(src, t, amt, type, opt = {}) {
      if (!t.alive || amt <= 0) return 0;
      const d = src ? src.def : null;
      const el = opt.element !== undefined ? opt.element : (d ? d.element : null);
      const fmS = src ? this.fm(src.team) : null, fmT = this.fm(t.team);
      let crit = false, flank = false, combo = null;
      if (src && !opt.dot) {
        let m = 1 + src.buff.dmg + (fmS.dmg || 0) - (src.weakT > 0 ? 0.2 : 0);
        if (opt.melee && FRONT[d.cls]) m += fmS.frontDmg || 0;
        amt *= Math.max(0.2, m);
        if (d.bonusVsBig && t.r >= 13) amt *= d.bonusVsBig;
        if (d.antiAir && t.def.flying) amt *= d.antiAir;
        const cc = (d.crit ? d.crit.chance : 0) + src.buff.crit;
        if (opt.forceCrit || rand() < cc) { amt *= d.crit ? Math.max(1.5, d.crit.mult) : 1.5; crit = true; }
        // 측면·후방 공격
        if (!fmT.noFlank && !t.def.immobile) {
          const fx = Math.cos(t.facing), fy = Math.sin(t.facing), dx = src.x - t.x, dy = src.y - t.y, dd = Math.hypot(dx, dy) || 1;
          if ((fx * dx + fy * dy) / dd < -0.45) { amt *= 1.25; flank = true; }
        }
        // 협동·속성 상성
        if (d.followUp && (t.stun > 0 || t.knockT > 0)) { amt *= 1 + d.followUp; combo = '후속 공격'; }
        if (d.cls === 'assassin' && t.poisonStacks > 0) { amt *= 1.5; combo = '독 마무리'; }
        if (t.cmdT > 0 && t.cmdTeam === src.team) amt *= 1 + t.cmdAmt;
        if (type === 'magic' && t.exposedT > 0) { amt *= 1 + t.exposedAmt; combo = combo || '무방비'; }
        if (el === 'lightning' && t.freeze > 0) { amt *= 1.5; combo = '감전'; }
        if (opt.charge && (t.slowAmt > 0 || t.freeze > 0)) { amt *= 1.5; combo = '빙결 돌파'; }
      }
      if (t.markT > 0) amt *= 1 + t.markAmt;
      if (el && t.def.resist && t.def.resist[el]) amt *= 1 - t.def.resist[el];
      if (opt.splash) amt *= Math.max(0.1, 1 + (fmT.splashTaken || 0));
      if (BACK[t.def.cls]) amt *= 1 + (fmT.backTaken || 0);
      else if (opt.melee && FRONT[t.def.cls]) amt *= 1 + (fmT.frontTaken || 0);
      if (opt.proj) amt *= Math.max(0, 1 + t.buff.projTaken);
      // 회피
      if (opt.melee && !opt.dot && (t.def.dodge || 0) + t.buff.dodge > 0 && rand() < (t.def.dodge || 0) + t.buff.dodge) {
        if (this.quality === 'high') this.addFx({ kind: 'text', x: t.x, y: t.y - t.r - 4, text: '회피', color: '#cfe8ff', T: 0.5, size: 10 });
        return 0;
      }
      // 투사체 방어
      if (opt.proj && (t.def.blockChance || t.buff.block) && rand() < (t.def.blockChance || 0) + t.buff.block) {
        amt *= 0.15;
        if (this.quality !== 'low' && rand() < 0.5) this.addFx({ kind: 'block', x: t.x, y: t.y, a: src ? Math.atan2(src.y - t.y, src.x - t.x) : 0, T: 0.2 });
      }
      // 보스 정면 장갑
      if (t.def.frontArmor && src) {
        const fx = Math.cos(t.facing), fy = Math.sin(t.facing), dx = src.x - t.x, dy = src.y - t.y, dd = Math.hypot(dx, dy) || 1;
        if ((fx * dx + fy * dy) / dd > 0.35) { amt *= 1 - t.def.frontArmor; if (this.quality === 'high' && rand() < 0.1) this.addFx({ kind: 'block', x: t.x + fx * t.r, y: t.y + fy * t.r, a: t.facing, T: 0.2 }); }
      }
      if (type === 'phys') {
        const armor = t.def.armor + t.buff.armor + (fmT.armor || 0);
        amt = Math.max(Math.min(1, amt), amt * 0.2, amt - armor);   // D_final = max(1, D - DEF) (최소 20% 보장)
      } else if (type === 'magic' && t.def.mres) amt *= 1 - t.def.mres;
      // 반사 · 가시
      if (src && src.alive && !opt.noReflect) {
        const refl = (t.def.reflectProj || 0) + t.buff.reflect;
        if (refl && opt.proj) this.damage(t, src, amt * refl, 'true', { noReflect: true });
        if (t.def.thorns && opt.melee) this.damage(t, src, amt * t.def.thorns, 'true', { noReflect: true });
      }
      // 보호막 (빛 보호막은 화염을 절반만 받음)
      if (t.shield > 0) {
        const eff = (el === 'fire' && t.shieldLight) ? 2 : 1;
        const a = Math.min(t.shield * eff, amt);
        t.shield -= a / eff; amt -= a;
        if (t.shield <= 0.01) { t.shield = 0; t.shieldLight = false; }
      }
      const real = Math.min(amt, Math.max(0, t.hp));
      t.hp -= amt;
      // 통계
      const team = src ? src.team : (opt.srcTeam ?? -1);
      if (team >= 0) this.stats[team].dmg += real;
      this.stats[t.team].taken += real;
      t.st.taken += real; this.recOf(t).taken += real;
      if (src && src.st) { src.st.dealt += real; if (src.type) this.recOf(src).dealt += real; }
      if (!opt.dot) {
        t.flash = 0.08;
        if (src) { const dx = t.x - src.x, dy = t.y - src.y, dd = Math.hypot(dx, dy) || 1; t.rx += dx / dd * 2; t.ry += dy / dd * 2; }
        if (this.visual && this.quality !== 'low') {
          if (crit && amt > 8) this.addFx({ kind: 'crit', x: t.x, y: t.y, r: t.r + 6, T: 0.25 });
          if (combo && this.quality === 'high' && rand() < 0.3) this.addFx({ kind: 'text', x: t.x, y: t.y - t.r - 6, text: combo, color: '#ffe680', T: 0.7, size: 10 });
          if (el && SW.ELEMENTS[el] && this.quality === 'high' && rand() < 0.35) this.particles(t.x, t.y, SW.ELEMENTS[el].color, 2, 60);
        }
      }
      if (src && d && !opt.dot) {
        const ls = (d.lifesteal || 0) + src.buff.lifesteal + (el === 'dark' ? 0.1 : 0);
        if (ls && src.alive) this.heal(src, real * ls, src, true);
        if (el && !opt.noElem) this.applyElement(t, el, d);
      }
      if (t.hp <= 0) this.kill(t, src);
      return real;
    },

    // ── 사망 시스템 ──
    kill(u, src, silent) {
      if (!u.alive) return;
      const d = u.def;
      if (d.boss && this.bossDeath(u)) return;
      if (d.revive && !u.revived) {
        u.revived = true; u.hp = u.maxHp * d.revive.hpPct;
        u.burn = u.poison = 0; u.poisonStacks = 0;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: 70, color: '#fff4a0', T: 0.8 });
        this.addFx({ kind: 'text', x: u.x, y: u.y - 20, text: '부활!', color: '#fff4a0', T: 1.2 });
        return;
      }
      u.alive = false;
      if (u.target) { u.target.aggro = Math.max(0, u.target.aggro - 1); u.target = null; }
      const life = this.time - u.born;
      const r = this.recOf(u); r.died++; r.life += life;
      this.trackLife(u, life);
      this.stats[u.team].lost++;
      if (src && src.st) { this.stats[src.team].kills++; src.st.kills++; if (src.type) this.recOf(src).kills++; }
      if (this.visual) {
        this.particles(u.x, u.y, u.team === 0 ? '#5d95ff' : '#ff6060', Math.min(12, 4 + u.r / 2), 90);
        if (this.quality !== 'low') this.addFx({ kind: 'death', x: u.x, y: u.y, r: u.r, shape: d.shape, team: u.team, a: u.facing, T: 0.4 });
      }
      if (d.onDeath) {
        if (d.onDeath.heal) {
          const h = d.onDeath.heal;
          this.alliesIn(u.x, u.y, h.radius, u.team, (o) => this.heal(o, h.amt, null));
          this.addFx({ kind: 'ring', x: u.x, y: u.y, r: h.radius, color: '#ffe066', T: 0.7 });
        }
        if (d.onDeath.explode) this.explode(u, u.x, u.y, d.onDeath.explode.radius, d.onDeath.explode.dmg);
      }
      if (d.rebirth && !u.noRebirth) {
        this.spawn('egg', u.team, u.x, u.y);
        this.addFx({ kind: 'text', x: u.x, y: u.y - 20, text: '환생 중...', color: '#ffcc33', T: 1.2 });
      }
      // 시체 부활 (강령술)
      if (!d.summonOnly || u.type === 'wisp') {
        this.query(u.x, u.y, 260, (n) => {
          if (!n.def.raiseDead || n.raised >= n.def.raiseDead.max) return;
          if (dist2(n, u) > n.def.raiseDead.radius ** 2) return;
          n.raised++;
          const s = this.spawn('skeleton', n.team, u.x, u.y, { owner: n.uid });
          s.cd = 0.8;
          this.addFx({ kind: 'beam', x: n.x, y: n.y, t: s, color: '#b6ffb0', T: 0.4 });
          this.addFx({ kind: 'ring', x: u.x, y: u.y, r: 16, color: '#b6ffb0', T: 0.5 });
          return true;
        }, 1 - u.team);
      }
    },

    // ── 투사체 시스템 ──
    updateProjectiles(dt) {
      let w = 0;
      for (let i = 0; i < this.projs.length; i++) {
        const p = this.projs[i];
        let done = false;
        if (p.kind === 'lob') {
          p.t += dt;
          const k = Math.min(1, p.t / p.T);
          p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
          p.z = Math.sin(k * Math.PI) * Math.min(120, p.T * 90);
          if (k >= 1) {
            this.enemiesIn(p.x, p.y, p.splash, p.team, (e) => this.hitP(p, e, p.dmg, true), false);
            this.addFx({ kind: 'boom', x: p.x, y: p.y, r: p.splash, color: '#d9a66b', T: 0.4 });
            this.particles(p.x, p.y, '#b48a5a', 8, 100);
            done = true;
          }
        } else if (p.kind === 'pierce') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.dist -= Math.hypot(p.vx, p.vy) * dt;
          this.enemiesIn(p.x, p.y, 4, p.team, (e) => {
            if (p.hit.has(e)) return; p.hit.add(e);
            this.hitP(p, e, p.dmg * Math.pow(0.85, p.hit.size - 1));
            if (p.knock && e.alive && !e.def.immobile) this.knockback(e, p.x - p.vx, p.y - p.vy, p.knock);
          }, true);
          if (p.dist <= 0 || p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) done = true;
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
              this.enemiesIn(p.x, p.y, p.splash, p.team, (e) => this.hitP(p, e, e === t ? p.dmg : p.dmg * 0.7, e !== t), true);
              this.addFx({ kind: 'boom', x: p.x, y: p.y, r: p.splash, color: p.color, T: 0.3 });
            } else if (t && t.alive) this.hitP(p, t, p.dmg);
            done = true;
          } else { p.x += dx / dd * step; p.y += dy / dd * step; }
          if (p.life <= 0) done = true;
        }
        if (!done) this.projs[w++] = p;
      }
      this.projs.length = w;
    },

    // 발사자가 이미 죽었어도 피해는 들어간다
    ghost(src, team, x, y) { return { def: src.def, team, alive: false, buff: src.buff, x, y, st: null, type: null, weakT: 0 }; },
    hitP(p, e, dmg, splash) {
      const src = p.src.alive ? p.src : this.ghost(p.src, p.team, p.x, p.y);
      this.hit(src, e, dmg, { proj: true, splash, element: p.element, type: p.type, forceCrit: p.crit });
    },

    // ── 범위 효과 ──
    updateAreas(dt) {
      let w = 0;
      for (let i = 0; i < this.areas.length; i++) {
        const a = this.areas[i];
        a.t -= dt;
        const src = a.src && a.src.alive ? a.src : (a.src ? this.ghost(a.src, a.team, a.x, a.y) : null);
        let keep = true;
        if (a.kind === 'meteor' || a.kind === 'strike') {
          if (a.t <= 0) {
            this.enemiesIn(a.x, a.y, a.r, a.team, (e) => this.hit(src, e, a.dmg, { proj: true, splash: true, element: a.element, type: a.type || 'magic', stunExtra: a.stun }), true);
            if (a.kind === 'meteor') {
              this.addFx({ kind: 'boom', x: a.x, y: a.y, r: a.r, color: '#ff7a3d', T: 0.6 });
              this.addFx({ kind: 'shock', x: a.x, y: a.y, r: a.r * 1.8, color: '#ffc090', T: 0.45 });
              this.particles(a.x, a.y, '#ff7a3d', 20, 220);
              this.shake = Math.max(this.shake || 0, 0.3);
            } else {
              this.addFx({ kind: 'bolt', x: a.x, y: a.y, color: a.color || '#fff36b', T: 0.3 });
              this.addFx({ kind: 'ring', x: a.x, y: a.y, r: a.r, color: a.color || '#fff36b', T: 0.3 });
            }
            if (a.stun) this.enemiesIn(a.x, a.y, a.r, a.team, (e) => { if (!e.def.boss) e.stun = Math.max(e.stun, a.stun); });
            keep = false;
          }
        } else if (a.kind === 'vortex') {
          this.enemiesIn(a.x, a.y, a.r, a.team, (e) => {
            if (e.def.immobile || e.def.boss) return;
            const dx = a.x - e.x, dy = a.y - e.y, dd = Math.hypot(dx, dy) || 1;
            const f = a.pull * Math.min(1, dd / 20) * clamp(100 / e.mass, 0.2, 1.5);
            e.x += dx / dd * f * dt; e.y += dy / dd * f * dt;
            this.damage(src, e, a.dps * dt, 'magic', { dot: true, srcTeam: a.team, element: 'dark' });
          }, true);
          if (a.t <= 0) keep = false;
        } else if (a.kind === 'tele') {
          if (a.t <= 0) keep = false;
        } else if (a.kind === 'cloud') {
          a.tick -= dt;
          if (a.tick <= 0) {
            a.tick = 0.5;
            this.enemiesIn(a.x, a.y, a.r, a.team, (e) => {
              if (a.element === 'poison') { e.poison = 4; e.poisonDps = Math.max(e.poisonDps, 4); e.poisonStacks = Math.min(8, e.poisonStacks + 1); }
              else if (a.element === 'frost') {
                e.slowAmt = Math.max(e.slowAmt, 0.6); e.slowT = Math.max(e.slowT, 1);
                this.damage(src, e, 4, 'magic', { dot: true, srcTeam: a.team, element: 'frost' });
                if (rand() < 0.12 && !e.def.immobile && !e.def.boss) e.freeze = 1.2;
              }
            }, true);
          }
          if (a.t <= 0) keep = false;
        }
        if (keep) this.areas[w++] = a;
      }
      this.areas.length = w;
    },

    // ── 충돌 (질량 기반 겹침 해소) ──
    // 격자 셀 단위로 이웃 셀 쌍만 한 번씩 검사 (O(n·k), 클로저 없음)
    separate() {
      const W = this.W, H = this.H, grid = this.grid;
      const NB = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      const pair = (u, o) => {
        if (!u.alive || !o.alive || !!u.def.flying !== !!o.def.flying) return;
        const dx = u.x - o.x, dy = u.y - o.y, rr = u.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) return;
        const iu = u.def.immobile, io = o.def.immobile;
        if (iu && io) return;
        const dd = Math.sqrt(d2) || 0.01;
        const nx = d2 ? dx / dd : rand() - 0.5, ny = d2 ? dy / dd : rand() - 0.5;
        const ov = (rr - dd) * 0.5;
        const mu = iu ? 1e9 : u.mass, mo = io ? 1e9 : o.mass, tot = mu + mo;
        const ku = ov * mo / tot * 2, ko = ov * mu / tot * 2;
        u.x += nx * ku * 0.5; u.y += ny * ku * 0.5;
        o.x -= nx * ko * 0.5; o.y -= ny * ko * 0.5;
      };
      for (const [k, a] of grid) {
        const gx = k % 4096, gy = (k - gx) / 4096;
        for (const [ox, oy] of NB) {
          const b = ox === 0 && oy === 0 ? a : grid.get((gx + ox) + (gy + oy) * 4096);
          if (!b) continue;
          if (a === b) { for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) pair(a[i], a[j]); }
          else for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) pair(a[i], b[j]);
        }
      }
      for (const u of this.units) { if (u.x < u.r) u.x = u.r; else if (u.x > W - u.r) u.x = W - u.r; if (u.y < u.r) u.y = u.r; else if (u.y > H - u.r) u.y = H - u.r; }
    },

    // ── 기존 패시브 능력 (주기적 소환 · 보호막 부여 · 치유 파동) ──
    passiveAbilities(u, dt) {
      const d = u.def;
      if (!(d.summon || d.shieldGive || d.healPulse)) return;
      u.abilT -= dt;
      if (u.abilT > 0) return;
      const eff = 1 + (this.fm(u.team).supportEff || 0);
      if (d.summon) {
        u.abilT = d.summon.cd;
        const s = d.summon;
        let alive = 0; for (const o of this.teams[u.team]) if (o.owner === u.uid && o.alive) alive++;
        const n = Math.min(s.count, s.max - alive);
        for (let i = 0; i < n; i++) this.summonNear(u, s.unit);
      } else if (d.shieldGive) {
        const s = d.shieldGive; u.abilT = s.cd;
        const cands = [];
        this.alliesIn(u.x, u.y, s.radius, u.team, (o) => { if (o !== u && o.shield < s.amt * 0.5) cands.push(o); });
        cands.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        for (const o of cands.slice(0, s.count)) { o.shield = Math.max(o.shield, s.amt * eff); this.addFx({ kind: 'beam', x: u.x, y: u.y, t: o, color: '#8ad8ff', T: 0.3 }); }
      } else if (d.healPulse) {
        const s = d.healPulse; u.abilT = s.cd;
        this.alliesIn(u.x, u.y, s.radius, u.team, (o) => this.heal(o, s.amt, u));
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: s.radius, color: '#a8ffb0', T: 0.6 });
      }
    },
    summonNear(u, type) {
      const a = rand() * Math.PI * 2, off = type === 'turret' ? 25 : 18;
      const fx = u.team === 0 ? 1 : -1;
      const s = this.spawn(type, u.team, clamp(u.x + fx * off + Math.cos(a) * 10, 10, this.W - 10), clamp(u.y + Math.sin(a) * off, 10, this.H - 10), { owner: u.uid });
      this.addFx({ kind: 'ring', x: s.x, y: s.y, r: 18, color: u.def.accent, T: 0.4 });
      return s;
    },
  });
})();
