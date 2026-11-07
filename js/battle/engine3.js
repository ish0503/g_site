// ─────────────────────────────────────────────
// Battle Engine 3.0 확장 — 2.0 메서드를 감싸서(wrap) 기능을 추가한다. (2.0 동작은 그대로 유지)
//   · 신규 상태: 출혈 · 공포 · 혼란 · 침묵 · 속박 · 무적 · 감전
//   · 사기(morale)와 패주 · 포위 · 부상 · 지휘관
//   · 지형 · 날씨 · 시간대 · 동적 전장(화재·크레이터·범람·낙뢰)
//   · 파괴 가능한 구조물(성벽·성문·탑·성채) · 승리 조건 · 이벤트 기록
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  const { rand, clamp, dist2 } = SW.util;
  // 고정 인자 래퍼 (rest/spread 할당을 피해 호출 비용 최소화)
  const wrap = (name, fn) => { const orig = P[name]; P[name] = function (a, b, c, d, e) { return fn.call(this, orig, a, b, c, d, e); }; };
  const NOMORALE = (d) => d.boss || d.structure || d.immobile || d.summonOnly || d.attack === 'none';

  // ── 생성자 옵션 확장 ──
  const Base = SW.Battle;
  class Battle3 extends Base {
    constructor(opts = {}) {
      super(opts);
      this.terrain = opts.terrain || null;
      this.weather = SW.WEATHER[opts.weather || 'clear'] || SW.WEATHER.clear;
      this.weatherId = opts.weather || 'clear';
      this.timeOfDay = SW.TIMES[opts.time || 'day'] || SW.TIMES.day;
      this.timeId = opts.time || 'day';
      this.moraleOn = !!opts.morale;
      this.moraleBonus = opts.moraleBonus || [0, 0];
      this.victory = opts.victory || { type: 'annihilate' };
      this.points = (opts.points || []).map(p => ({ ...p, owner: -1, prog: 0 }));
      this.score = [0, 0];
      this.events = [];
      this.commandEff = [1, 1];
      this.dynamic = opts.dynamic !== false;
      this.windDir = opts.windDir || (rand() < 0.5 ? 1 : -1);
      this.statMul = opts.statMul || null;    // 커스텀 규칙: 팀별 능력치 배율
      const per = Math.min(this.weather.perception || 1e9, this.timeOfDay.perception || 1e9);
      this.perception = per < 1e9 ? per : 0;
    }
  }
  SW.Battle = Battle3;
  SW.BattleBase = Base;

  P.logEvent = function (text, team = -1, kind = 'info') {
    if (this.events.length < 300) this.events.push({ t: this.time, text, team, kind });
  };

  // ── 생성 ──
  wrap('def', function (orig, type, team) {
    const c = this.defCache[team];
    if (c[type]) return c[type];
    const d = orig.call(this, type, team);
    const m = this.statMul && this.statMul[team];
    if (m) { d.hp *= m.hp || 1; d.dmg *= m.dmg || 1; d.speed *= m.speed || 1; }
    return d;
  });
  wrap('spawn', function (orig, type, team, x, y, extra) {
    const u = orig.call(this, type, team, x, y, extra);
    u.bleedT = 0; u.bleedDps = 0; u.fearT = 0; u.confT = 0; u.silT = 0; u.rootT = 0; u.invT = 0; u.shockT = 0;
    u.morale = NOMORALE(u.def) ? null : clamp(70 + (this.moraleBonus[team] || 0), 5, 100);
    u.mT = rand() * 0.5; u.exposeT = 0; u.stuckT = 0; u.surrounded = false;
    if (u.def.commander) { u.commander = true; }
    return u;
  });

  wrap('start', function (orig) {
    if (this.state !== 'PREPARING') return;
    orig.call(this);
    this.hadCommander = [0, 1].map(t => this.units.some(u => u.team === t && u.commander));
    if (this.weatherId !== 'clear' || this.timeId !== 'day') this.banner(`${this.weather.icon} ${this.weather.name} · ${this.timeOfDay.icon} ${this.timeOfDay.name}`, '#cfe0ff', 2, this.weather.desc);
    this.hooks.push((b, dt) => b.worldTick(dt));
  });

  // ── 월드 틱: 지형 변화 · 날씨 이벤트 · 거점 ──
  P.worldTick = function (dt) {
    this.wT = (this.wT || 0) + dt;
    if (this.terrain && this.dynamic) this.terrain.update(dt, this.weather);
    if (this.weather.lightning && this.dynamic) {
      this.lightT = (this.lightT || 4) - dt;
      if (this.lightT <= 0) {
        this.lightT = 5 + rand() * 4;
        const list = this.units; if (list.length) {
          const u = list[(rand() * list.length) | 0];
          this.areas.push({ kind: 'strike', x: u.x + (rand() - 0.5) * 60, y: u.y + (rand() - 0.5) * 60, r: 40, t: 1, T: 1, dmg: 35, element: 'lightning', team: -1, src: null, type: 'magic', tele: true, color: '#e8f0ff' });
        }
      }
      if (this.terrain && this.time > 60 && !this.flooded) { this.flooded = true; if (this.terrain.flood(0.6)) this.logEvent('폭풍으로 강이 범람했다', -1, 'world'); }
    }
    if (this.points.length) {
      this.pT = (this.pT || 0) + dt;
      if (this.pT >= 0.25) {
        const step = this.pT; this.pT = 0;
        for (const p of this.points) {
          const c = [0, 0];
          this.query(p.x, p.y, p.r, (u) => { if (!u.def.structure && (u.x - p.x) ** 2 + (u.y - p.y) ** 2 < p.r * p.r) c[u.team]++; });
          const d = c[0] && !c[1] ? 1 : c[1] && !c[0] ? -1 : 0;
          if (d) {
            p.prog = clamp(p.prog + d * step * 25 * Math.min(3, 1 + Math.log2(1 + c[d > 0 ? 0 : 1]) / 3), -100, 100);
            const no = p.prog >= 100 ? 0 : p.prog <= -100 ? 1 : p.owner;
            if (no !== p.owner) { p.owner = no; this.logEvent(`${no === 0 ? '파란' : '빨간'} 군이 ${p.name || '거점'}을(를) 점령`, no, 'point'); this.banner(`${p.name || '거점'} 점령: ${no === 0 ? '파란 군' : '빨간 군'}`, no === 0 ? '#8cb4ff' : '#ff8f8f', 1.5); }
          }
          if (p.owner >= 0) this.score[p.owner] += step * (this.victory.pointRate || 0.6);
        }
      }
    }
  };

  // ── 상태 진행 확장 ──
  wrap('updateStatus', function (orig, u, dt) {
    const d = u.def;
    if (d.structure) { u.burn = u.poison = u.poisonStacks = 0; u.slowAmt = 0; u.stun = u.freeze = 0; u.bleedT = u.fearT = u.confT = u.rootT = 0; }
    if (u.bleedT > 0) {
      u.bleedT -= dt;
      const moving = u.vx * u.vx + u.vy * u.vy > 100;
      this.damage(null, u, u.bleedDps * (moving ? 2 : 1) * dt, 'true', { dot: true, srcTeam: 1 - u.team });
      if (!u.alive) return false;
    }
    if (u.fearT > 0) u.fearT -= dt;
    if (u.confT > 0) u.confT -= dt;
    if (u.silT > 0) u.silT -= dt;
    if (u.rootT > 0) u.rootT -= dt;
    if (u.invT > 0) u.invT -= dt;
    if (u.shockT > 0) { u.shockT -= dt; u.cd += dt * 0.5; }
    if (u.exposeT > 0) u.exposeT -= dt;
    if (d.regenSelf && u.hp < u.maxHp) this.heal(u, d.regenSelf * dt, null, true);
    // 지형: 화재·용암
    if (this.terrain && !d.flying && !d.structure) {
      const tt = this.terrain.at(u.x, u.y);
      if (tt.burn && !(d.resist && d.resist.fire >= 1)) { this.damage(null, u, tt.burn * dt, 'true', { dot: true, srcTeam: -1, element: 'fire' }); if (!u.alive) return false; }
      if (this.weather.extinguish && u.burn > 0) u.burn -= dt;   // 비: 화상 빨리 꺼짐
    }
    if (!orig.call(this, u, dt)) return false;
    // 사기 (0.5초 간격)
    if (this.moraleOn && u.morale !== null) {
      u.mT -= dt;
      if (u.mT <= 0) { u.mT = 0.5; this.updateMorale(u); }
    }
    return true;
  });

  P.updateMorale = function (u) {
    const info = this.teamInfo[u.team], ei = this.teamInfo[1 - u.team];
    let target = 60 + (this.moraleBonus[u.team] || 0);
    const cmd = info.commander;
    if (cmd && cmd.alive && dist2(u, cmd) < 320 * 320) target += 20;
    if (info.count && ei.count) target += clamp((info.count / ei.count - 1) * 15, -15, 15);
    // 포위: 주변 적이 4명 이상
    let near = 0; this.enemiesIn(u.x, u.y, u.r + 34, u.team, () => { near++; });
    u.surrounded = near >= 4;
    if (u.surrounded) u.morale -= 4;
    if (u.hp < u.maxHp * 0.35) u.morale -= 1.5;
    if (u.sq !== undefined && this.squads && this.squads[u.sq] && this.squads[u.sq].order.type === 'hold') target += 8;
    u.morale += (target - u.morale) * 0.06;
    u.morale = clamp(u.morale, 0, 100);
    if (u.morale < 18 && u.fearT <= 0 && !u.commander && u.def.role !== 'hero') {
      u.fearT = 3; u.morale = 35;
      if (rand() < 0.15) this.addFx({ kind: 'text', x: u.x, y: u.y - u.r - 6, text: '패주!', color: '#ffb0b0', T: 0.8, size: 10 });
    }
  };

  // ── 인지: 지휘관 위치 ──
  wrap('perceive', function (orig) {
    orig.call(this);
    for (let t = 0; t < 2; t++) {
      const info = this.teamInfo[t]; info.commander = null;
      for (const u of this.teams[t]) if (u.commander) { info.commander = u; break; }
    }
  });

  // ── 판단 확장: 공포 · 혼란 · 침묵 · 구조물 돌파 ──
  wrap('trySkill', function (orig, u) { if (u.silT > 0) return false; return orig.call(this, u); });
  wrap('think', function (orig, u) {
    if (u.fearT > 0) { u.ai.action = 'flee'; u.ai.state = 'retreat'; u.near = this.nearestEnemy(u, 300); return; }
    if (u.confT > 0) {
      const list = []; this.query(u.x, u.y, 160, (o) => { if (o !== u && !o.def.structure) list.push(o); });
      if (list.length) { this.setTarget(u, list[(rand() * list.length) | 0]); u.ai.action = 'attack'; u.ai.state = 'attack'; return; }
    }
    orig.call(this, u);
    // 성벽에 막히면 가장 가까운 구조물을 공격
    if (u.stuckT > 0.9 && u.alive) {
      let best = null, bd = 90 * 90;
      this.enemyQuery(u, 90, (e) => { if (!e.def.structure) return; const q = dist2(u, e); if (q < bd) { bd = q; best = e; } });
      if (best) { this.setTarget(u, best); u.ai.action = 'attack'; u.breachT = 3; }
    }
    if (this.squadThink) this.squadThink(u);
  });
  wrap('canAttack', function (orig, u, t) {
    if (u.confT > 0 && t && t.alive && t !== u && !t.stealthed) return true;
    return orig.call(this, u, t);
  });

  // 타깃 가능 여부: 시야(안개·야간) · 숲 은폐
  wrap('targetable', function (orig, u, e) {
    if (!orig.call(this, u, e)) return false;
    if (e.exposeT > 0 || e.def.structure || e.def.boss) return true;
    const per = this.perception;
    if (per || (this.terrain && !e.def.flying)) {
      const d2 = dist2(u, e);
      if (per && d2 > per * per) return false;
      if (this.terrain && d2 > 170 * 170 && !e.def.flying && this.terrain.at(e.x, e.y).conceal) return false;
    }
    return true;
  });
  wrap('scoreTarget', function (orig, u, e, R, dd) {
    let s = orig.call(this, u, e, R, dd);
    if (e.def.structure) s = s < 0 ? s : s * ((u.def.vsStructure > 1 || u.def.role === 'siege' || u.breachT > 0) ? 1.4 : 0.3);
    if (e.commander) s += 0.25;
    return s;
  });

  // 사거리: 고지 · 바람
  wrap('reach', function (orig, u, t) {
    let r = orig.call(this, u, t);
    const d = u.def;
    if (d.range > 40 && d.attack !== 'heal') {
      if (this.terrain && !d.flying && this.terrain.at(u.x, u.y).high) r *= 1.15;
      if (this.weather.wind) r *= 1 + 0.12 * (u.team === 0 ? this.windDir : -this.windDir);
    }
    return r;
  });

  // ── 이동 확장: 공포·속박·지형 속도·통행 불가·포위 탈출 ──
  wrap('move', function (orig, u, dt) {
    const d = u.def;
    const ox = u.x, oy = u.y;
    if (u.rootT > 0 || d.immobile) { u.vx = u.vy = 0; return; }
    if (u.ai.action === 'flee') {
      const ne = u.near;
      const info = this.teamInfo[u.team];
      let mx = u.team === 0 ? -1 : 1, my = 0;
      if (ne) { const ex = u.x - ne.x, ey = u.y - ne.y, el = Math.hypot(ex, ey) || 1; mx = mx * 0.4 + ex / el * 0.6; my = ey / el * 0.6; }
      const ml = Math.hypot(mx, my) || 1;
      const sp = d.speed * 1.1;
      u.vx += (mx / ml * sp - u.vx) * Math.min(1, 10 * dt); u.vy += (my / ml * sp - u.vy) * Math.min(1, 10 * dt);
      u.x = clamp(u.x + u.vx * dt, u.r, this.W - u.r); u.y = clamp(u.y + u.vy * dt, u.r, this.H - u.r);
      u.facing = Math.atan2(u.vy, u.vx);
    } else {
      orig.call(this, u, dt);
      if (this.squadMove) this.squadMove(u, dt, ox, oy);
    }
    // 이동량에 지형·날씨·부상·감전 보정 적용
    let k = 1;
    if (!d.flying && this.terrain) k *= this.terrain.at(ox, oy).speed || 1;
    if (d.flying && this.weather.fly) k *= this.weather.fly;
    if (this.weather.speed) k *= this.weather.speed;
    if (this.moraleOn && u.hp < u.maxHp * 0.35) k *= 0.85;      // 부상
    if (u.shockT > 0) k *= 0.7;
    if (k !== 1) { u.x = ox + (u.x - ox) * k; u.y = oy + (u.y - oy) * k; }
    // 통행 불가 지형: 축 단위로 미끄러짐
    if (this.terrain && !d.flying && this.terrain.blocked(u.x, u.y)) {
      if (!this.terrain.blocked(u.x, oy)) u.y = oy;
      else if (!this.terrain.blocked(ox, u.y)) u.x = ox;
      else { u.x = ox; u.y = oy; }
    }
    // 막힘 감지 (성벽 돌파 판단용)
    const want = u.vx * u.vx + u.vy * u.vy, moved = (u.x - ox) ** 2 + (u.y - oy) ** 2;
    if (want > 200 && moved < want * dt * dt * 0.08) u.stuckT += dt; else u.stuckT = Math.max(0, u.stuckT - dt * 2);
    if (u.breachT > 0) u.breachT -= dt;
  });

  // ── 공격: 노출 · 야간 기습 ──
  wrap('attack', function (orig, u, t, dd, multExtra = 1) {
    u.exposeT = 2.5;
    if (this.timeOfDay.ambush && u.ambush && u.def.ambush) multExtra *= this.timeOfDay.ambush;
    return orig.call(this, u, t, dd, multExtra);
  });

  // ── 피해 계산 확장 ──
  wrap('damage', function (orig, src, t, amt, type, opt = {}) {
    if (!t.alive || amt <= 0) return 0;
    if (t.invT > 0) return 0;
    const d = src ? src.def : null;
    const el = opt.element !== undefined ? opt.element : (d ? d.element : null);
    // 날씨
    if (el === 'fire' && this.weather.fire) amt *= this.weather.fire;
    if (el === 'frost' && this.weather.frost) amt *= this.weather.frost;
    if (opt.proj && !opt.dot && this.weather.miss && src && src.def.range > 40 && rand() < this.weather.miss) {
      if (this.quality === 'high' && rand() < 0.3) this.addFx({ kind: 'text', x: t.x, y: t.y - t.r - 4, text: '빗나감', color: '#cccccc', T: 0.5, size: 9 });
      return 0;
    }
    if (src && !opt.dot) {
      // 사기 · 부상
      if (this.moraleOn && src.morale != null) amt *= 0.8 + 0.4 * src.morale / 100;
      if (this.moraleOn && src.hp < src.maxHp * 0.35 && src.morale != null) amt *= 0.9;
      // 지휘 효율
      if (this.commandEff[src.team] < 1 && src.sq !== undefined) amt *= 0.85 + 0.15 * this.commandEff[src.team];
      // 구조물
      if (t.def.structure) amt *= d.vsStructure || (d.role === 'siege' ? 1.5 : d.range > 40 && type !== 'magic' ? 0.5 : type === 'magic' ? 0.7 : 1);
      // 지형: 고지 공격자, 엄폐
      if (this.terrain) {
        if (!d.flying && this.terrain.at(src.x, src.y).high && !this.terrain.at(t.x, t.y).high) amt *= 1.1;
        if (!t.def.flying) {
          const tt = this.terrain.at(t.x, t.y);
          if (tt.cover && opt.proj) amt *= 1 - tt.cover;
          if (tt.wet && el === 'fire') amt *= 0.5;
          if (tt.armor && type === 'phys') amt = Math.max(amt * 0.2, amt - tt.armor);
          if (tt.wet && el === 'lightning') amt *= 1.3;
        }
      }
      if (t.surrounded && this.moraleOn && type === 'phys') amt *= 1.2;   // 포위: 방어력 붕괴
    }
    const sh = t.shield;
    const r = orig.call(this, src, t, amt, type, opt);
    if (sh > t.shield && src && this.stats[1 - t.team]) this.stats[t.team].absorbed = (this.stats[t.team].absorbed || 0) + (sh - t.shield);
    // 동적 전장: 화염 범위 공격이 숲에 불을 붙임
    if (this.terrain && this.dynamic && el === 'fire' && opt.splash && rand() < 0.08) this.terrain.ignite(t.x, t.y, 30);
    if (src && src.sq !== undefined && this.squads && this.squads[src.sq]) { const o = this.squads[src.sq].order.type; const os = this.orderStats || (this.orderStats = {}); (os[o] || (os[o] = { dealt: 0, time: 0 })).dealt += r || 0; }
    return r;
  });

  // 범위 충격: 크레이터 · 점화
  P.onImpact = function (x, y, r, el) {
    if (!this.terrain || !this.dynamic) return;
    if (r >= 55) this.terrain.crater(x, y, r);
    if (el === 'fire') this.terrain.ignite(x, y, r * 0.6);
  };

  // ── 사망 확장: 사기 · 지휘관 · 구조물 · 이벤트 ──
  wrap('kill', function (orig, u, src, silent) {
    if (!u.alive) return;
    const wasAlive = u.alive;
    orig.call(this, u, src, silent);
    if (u.alive || !wasAlive) return;
    const ts = this.stats[u.team];
    if (!this.firstBlood && !u.def.summonOnly && !u.def.structure) { this.firstBlood = true; this.logEvent(`첫 전사자: ${u.team ? '빨간' : '파란'} 군 ${u.def.name}`, u.team, 'blood'); }
    if (this.moraleOn) {
      this.alliesIn(u.x, u.y, 150, u.team, (o) => { if (o.morale != null) o.morale -= 5; });
      if (src && src.morale != null) src.morale = Math.min(100, src.morale + 3);
    }
    if (u.commander) {
      this.commandEff[u.team] = 0.5;
      this.logEvent(`${u.team ? '빨간' : '파란'} 군 지휘관 전사!`, u.team, 'commander');
      this.banner(`${u.team ? '빨간' : '파란'} 군 지휘관 전사!`, u.team ? '#ff8f8f' : '#8cb4ff', 2.2, '사기 급락 · 명령 효율 50%');
      for (const o of this.units) if (o.team === u.team && o.morale != null) o.morale -= 30;
    }
    if (u.def.structure) {
      this.logEvent(`${u.def.name} 파괴 (${u.team ? '빨간' : '파란'} 군)`, u.team, 'structure');
      if (this.visual) this.particles(u.x, u.y, '#9a9a9a', 16, 140);
      if (u.def.keep) this.banner(`${u.def.name} 함락!`, '#ffd36b', 2.5);
    }
    if (u.def.boss) this.logEvent(`보스 ${u.def.name} 격파`, u.team, 'boss');
    if (u.vip) this.logEvent(`보호 대상 ${u.def.name} 전사`, u.team, 'vip');
  });
  wrap('updateBoss', function (orig, u, dt) {
    const ph = u.boss.phase;
    orig.call(this, u, dt);
    if (u.boss.phase !== ph) this.logEvent(`${u.def.name} ${u.boss.phase + 1}단계 돌입`, u.team, 'boss');
  });
  wrap('trySkill', function (orig, u) {
    const ok = orig.call(this, u);
    if (ok && u.def.ability && u.def.ability.kind === 'ultimate') this.logEvent(`궁극기: ${u.def.name}의 ${u.def.ability.name}`, u.team, 'ult');
    return ok;
  });

  // ── 승리 조건 ──
  wrap('checkEnd', function (orig) {
    if (this.over) return;
    const v = this.victory;
    if (v.type === 'annihilate' || this.endless) return orig.call(this);
    const alive = [this.units.some(u => u.team === 0 && !u.def.structure), this.units.some(u => u.team === 1 && !u.def.structure)];
    const end = (w, why) => { this.endReason = why; this.finish(w); };
    if (!alive[0] && !alive[1]) return end(-1, '양측 전멸');
    if (v.type === 'keep') {
      const keep = this.units.find(u => u.def.keep);
      const def = v.defender;
      if (!keep) return end(1 - def, '성채 함락');
      if (!alive[1 - def]) return end(def, '공격군 전멸');
      if (!alive[def] && !this.units.some(u => u.team === def && u.def.structure && !u.def.keep && u.def.attack !== 'none')) { /* 수비대가 없어도 성채가 서 있으면 계속 */ }
      if (this.time >= this.timeLimit) { this.timeout = true; return end(def, '수비 성공 (시간 종료)'); }
      return;
    }
    if (!alive[0]) return end(1, '전멸');
    if (!alive[1]) return end(0, '적 전멸');
    if (v.type === 'protect' && this.units.every(u => !(u.vip && u.team === 0))) return end(1, '보호 대상 사망');
    if (v.type === 'commander' || v.type === 'war') {
      for (let t = 0; t < 2; t++) if (this.hadCommander && this.hadCommander[t] && !this.teamInfo[t].commander && !this.units.some(u => u.team === t && u.commander)) return end(1 - t, `${t ? '적' : '아군'} 지휘관 격파`);
    }
    if (v.type === 'war' && this.points.length) {
      if (this.score[0] >= (v.scoreWin || 100)) return end(0, '거점 점수 승리');
      if (this.score[1] >= (v.scoreWin || 100)) return end(1, '적 거점 점수 승리');
    }
    if (this.time >= this.timeLimit) {
      this.timeout = true;
      if (v.type === 'survive') return end(0, '생존 성공');
      if (v.type === 'protect') return end(0, '보호 성공');
      const hp = [0, 0]; for (const u of this.units) hp[u.team] += u.hp;
      return end(this.score[0] !== this.score[1] ? (this.score[0] > this.score[1] ? 0 : 1) : hp[0] > hp[1] ? 0 : 1, '시간 종료 판정');
    }
  });
})();
