// ─────────────────────────────────────────────
// Advanced AI 2.0 — 지능형 타깃 선정 + 역할별 행동 상태 머신
//   Score = w1·D + w2·T + w3·V + w4·R + w5·S (+ 밀집도, 협동 보정)
//   행동: idle / march / approach / attack / skill / retreat / pursuit / protect / support / regroup / stunned
// ─────────────────────────────────────────────
(() => {
  const { rand, clamp, dist2 } = SW.util;

  // 역할별 가중치 [D 거리, T 위협, V 취약, R 역할 우선순위, S 전략 중요도, dens 밀집도]
  const W = {
    melee: [1.2, 0.4, 0.4, 0.3, 0.2, 0], lancer: [0.9, 0.3, 0.3, 0.9, 0.2, 0], protector: [1.0, 0.8, 0.1, 0.5, 0.1, 0],
    bruiser: [1.2, 0.3, 0.2, 0.2, 0.2, 0.4], charger: [0.8, 0.3, 0.5, 0.6, 0.3, 0], skirmisher: [0.8, 0.2, 0.7, 0.7, 0.4, 0],
    duelist: [0.8, 0.6, 0.2, 0.9, 0.3, 0], hero: [1.0, 0.6, 0.3, 0.3, 0.5, 0.3], suicide: [0.7, 0, 0, 0.2, 0, 1.2],
    ranged: [0.8, 0.5, 0.7, 0.5, 0.3, 0], sniper: [0.4, 0.7, 0.4, 0.7, 0.6, 0], siege: [0.5, 0.2, 0.2, 0.4, 0.3, 1.0],
    mage: [0.6, 0.3, 0.3, 0.3, 0.3, 0.9], summoner: [1.0, 0.3, 0.3, 0.3, 0.3, 0], assassin: [0.3, 0.2, 0.7, 1.2, 0.8, 0],
    flyer: [0.8, 0.3, 0.6, 0.6, 0.3, 0.2], healer: [1, 0, 0, 0, 0, 0], support: [1, 0.2, 0.2, 0.2, 0.2, 0], boss: [1.0, 0.5, 0.2, 0.2, 0.2, 0.5],
    none: [1, 0, 0, 0, 0, 0],
  };
  // 역할별 적 분류 우선순위
  const P = {
    melee: { front: 1, tank: 0.7, ranged: 0.6, caster: 0.6, support: 0.5, assassin: 0.8, flyer: 0.5, boss: 0.7 },
    lancer: { front: 0.7, tank: 0.8, ranged: 0.4, caster: 0.4, support: 0.4, assassin: 0.6, flyer: 0.5, boss: 1 },
    protector: { assassin: 1, front: 0.8, tank: 0.5, ranged: 0.5, caster: 0.5, support: 0.4, flyer: 0.6, boss: 0.8 },
    bruiser: { front: 1, tank: 0.8, ranged: 0.6, caster: 0.6, support: 0.6, assassin: 0.7, flyer: 0.3, boss: 0.8 },
    charger: { ranged: 0.9, caster: 0.9, support: 0.8, front: 0.5, tank: 0.3, assassin: 0.6, flyer: 0.4, boss: 0.6 },
    skirmisher: { ranged: 1, caster: 1, support: 1, front: 0.3, tank: 0.1, assassin: 0.5, flyer: 0.4, boss: 0.3 },
    duelist: { front: 1, tank: 0.7, assassin: 0.9, ranged: 0.4, caster: 0.4, support: 0.4, flyer: 0.6, boss: 0.9 },
    hero: { front: 0.9, tank: 0.8, ranged: 0.7, caster: 0.8, support: 0.7, assassin: 0.8, flyer: 0.6, boss: 1 },
    ranged: { front: 0.7, tank: 0.5, ranged: 0.8, caster: 0.9, support: 0.7, assassin: 1, flyer: 0.9, boss: 0.8 },
    sniper: { caster: 1, ranged: 0.9, support: 1, front: 0.5, tank: 0.6, assassin: 0.8, flyer: 0.7, boss: 1 },
    siege: { tank: 1, front: 0.8, ranged: 0.5, caster: 0.5, support: 0.5, assassin: 0.3, flyer: 0, boss: 1 },
    mage: { front: 0.7, tank: 0.6, ranged: 0.6, caster: 0.6, support: 0.6, assassin: 0.7, flyer: 0.6, boss: 0.8 },
    summoner: { front: 0.7, tank: 0.6, ranged: 0.6, caster: 0.6, support: 0.6, assassin: 0.8, flyer: 0.6, boss: 0.7 },
    assassin: { caster: 1, ranged: 1, support: 1, front: 0.2, tank: 0.1, assassin: 0.5, flyer: 0.3, boss: 0.4 },
    flyer: { ranged: 1, caster: 1, support: 0.9, front: 0.4, tank: 0.3, assassin: 0.6, flyer: 0.7, boss: 0.6 },
    boss: { front: 0.8, tank: 0.6, ranged: 0.8, caster: 0.8, support: 0.8, assassin: 0.8, flyer: 0.8 },
  };
  // 후퇴 체력 기준
  const RETREAT = { ranged: 0.3, sniper: 0.5, mage: 0.3, summoner: 0.35, assassin: 0.35, skirmisher: 0.3, healer: 0.4, support: 0.4, flyer: 0.2 };
  SW.AI_STATE_NAMES = {
    idle: '대기', search: '탐색', march: '진군', approach: '접근', attack: '공격', skill: '기술 사용', retreat: '후퇴',
    pursuit: '추격', protect: '아군 보호', support: '지원', regroup: '진형 재정비', stunned: '행동 불가', dead: '사망',
  };

  Object.assign(SW.Battle.prototype, {
    // ── 타깃 선정 ──
    targetable(u, e) {
      if (!e.alive || e.team === u.team || e.stealthed || e.def.untargetable) return false;
      if (e.def.flying && !u.def.canHitAir) return false;
      return true;
    },

    scoreTarget(u, e, R, dd) {
      const d = u.def, w = W[d.role] || W.melee, pri = P[d.role] || P.melee;
      const range = d.range > 40 ? d.range : 0;
      const Dn = range ? (dd <= range + e.r ? 1 : 1 - (dd - range) / R) : 1 - dd / R;
      const ed = e.def;
      const T = Math.min(1, (ed.dmg / ed.atkCd) / 25) * 0.7 + (e.target === u ? 0.3 : 0);
      const V = (1 - e.hp / e.maxHp) * 0.6 + (ed.armor < 2 ? 0.2 : 0) + ((e.poisonStacks || e.slowAmt || e.stun > 0 || e.freeze > 0) ? 0.2 : 0);
      let Rr = pri[ed.cls] ?? 0.5;
      if (d.bonusVsBig && e.r >= 13) Rr += 0.8;
      if (d.antiAir && ed.flying) Rr += 0.5;
      if (d.role === 'duelist' && ed.cls === 'front') Rr += Math.min(0.6, e.maxHp / 800);
      if (d.role === 'sniper') Rr += Math.min(0.5, e.maxHp / 1500);
      if (d.role === 'protector' && e.target && e.target.team === u.team && e.target.def.cls !== 'front' && e.target.def.cls !== 'tank') Rr += 0.6;
      if (d.minRange && dd < d.minRange) return -1;
      let S = ed.boss ? 1 : ed.cls === 'support' ? 0.6 : ed.summonOnly ? 0.05 : 0.3;
      if (e.markT > 0 || (e.cmdT > 0 && e.cmdTeam === u.team)) S += 0.6;
      let s = w[0] * Dn + w[1] * T + w[2] * V + w[3] * Rr + w[4] * S;
      if (w[5]) s += w[5] * Math.min(1, this.cellDensity(e.team, e.x, e.y) / 6);
      // 협동 판단: 근접은 과잉 집중 회피, 원거리는 집중 사격 선호
      if (range) s += 0.05 * Math.min(e.aggro, 4);
      else s -= 0.08 * Math.max(0, e.aggro - 3);
      return s;
    },

    chooseTarget(u) {
      const d = u.def;
      // 강제 도발 (기술)
      if (u.tauntT > 0 && u.tauntBy && this.targetable(u, u.tauntBy)) return u.tauntBy;
      // 수호병 패시브 도발
      if (!d.flying) {
        let best = null, bd = Infinity;
        this.enemyQuery(u, 140, (e) => {
          if (!e.def.taunt || !this.targetable(u, e)) return;
          const dd = dist2(u, e); if (dd < e.def.taunt * e.def.taunt && dd < bd) { bd = dd; best = e; }
        });
        if (best) return best;
      }
      // 지휘관(전술가) 명령
      if (u.ai.cmd && u.ai.cmd.alive && u.ai.cmd.cmdT > 0 && this.targetable(u, u.ai.cmd)) return u.ai.cmd;
      // 후보 탐색 (공간 분할 → 점차 확장)
      const wide = d.cls === 'assassin' || d.role === 'skirmisher' || d.role === 'sniper';
      let R = Math.max(wide ? 600 : 340, (d.range || 0) + 140);
      let best = null, bs = -Infinity, cur = -Infinity, n = 0;
      const evalE = (e) => {
        if (!this.targetable(u, e)) return;
        const dd = Math.sqrt(dist2(u, e));
        if (dd > R) return;
        const s = this.scoreTarget(u, e, R, dd);
        if (e === u.target) cur = s;
        if (s > bs) { bs = s; best = e; }
        if (++n > 60) return true;      // 대규모 전투: 후보 수 제한
      };
      this.enemyQuery(u, R, evalE);
      if (!best) {
        // 전장 전체에서 가장 가까운 적
        // 멀리 있는 적: 전체가 아니라 표본만 검사 (대규모 전투 최적화)
        let bd = Infinity;
        const list = this.teams[1 - u.team], stepN = Math.max(1, Math.floor(list.length / 48)), off = (u.uid % stepN);
        for (let i = off; i < list.length; i += stepN) { const e = list[i]; if (this.targetable(u, e)) { const q = dist2(u, e); if (q < bd) { bd = q; best = e; } } }
        if (!best) for (const e of list) if (this.targetable(u, e)) { best = e; break; }
        return best;
      }
      // 불필요한 타깃 전환 방지 (히스테리시스)
      if (u.target && cur > -Infinity && best !== u.target && bs < cur * 1.15 + 0.05) return u.target;
      return best;
    },

    findHealTarget(u) {
      let best = null, br = 0.999;
      const R = u.def.range * 3;
      this.alliesIn(u.x, u.y, R, u.team, (o) => {
        if (o === u || o.def.hatch) return;
        let r = o.hp / o.maxHp;
        if (o.def.cls === 'tank' || o.def.boss) r -= 0.1;     // 핵심 아군 우선
        if (r < br) { br = r; best = o; }
      });
      return best;
    },

    // 가까운 반경부터 단계적으로 검색 (밀집 난전에서 수천 번의 거리 계산을 피함)
    nearestEnemy(u, R = 500) {
      let best = null;
      for (const r of [70, 150, R]) {
        if (r > R && best) break;
        let bd = Math.min(r, R) ** 2;
        this.enemyQuery(u, Math.min(r, R), (e) => { if (e.stealthed) return; const q = dist2(u, e); if (q < bd) { bd = q; best = e; } });
        if (best || r >= R) break;
      }
      return best;
    },

    setTarget(u, t) {
      if (u.target === t) return;
      if (u.target) u.target.aggro = Math.max(0, u.target.aggro - 1);
      u.target = t;
      if (t && t.team !== u.team) t.aggro++;
    },

    // ── 판단 (분산 주기) ──
    think(u) {
      const d = u.def, ai = u.ai;
      const isHealer = d.attack === 'heal';
      // 타깃
      if (isHealer) this.setTarget(u, this.findHealTarget(u));
      else this.setTarget(u, this.chooseTarget(u));
      // 기술 사용
      if (d.ability && u.skillCd <= 0) this.trySkill(u);
      if (!u.alive) return;
      const t = u.target;
      const ne = this.nearestEnemy(u, 300);
      const neD = ne ? Math.sqrt(dist2(u, ne)) : Infinity;
      u.near = ne; u.nearD = neD;
      const info = this.teamInfo[u.team];
      // 행동 점수
      let action = 'attack';
      const thr = d.ai?.retreat ?? RETREAT[d.role] ?? 0;
      if (ai.action === 'retreat' && ai.hold > 0) action = 'retreat';
      else if (thr && u.hp < u.maxHp * thr && neD < 150 && info.front > 1 && !d.immobile && !u.stealthed && (ai.retreatCd || 0) <= this.time) {
        action = 'retreat'; ai.hold = 1.5; ai.retreatCd = this.time + 5;     // 후퇴 후 5초간 재후퇴 금지
      }
      else if (d.support || isHealer) action = 'support';
      else if (d.role === 'protector' && this.findProtectee(u)) action = 'protect';
      else {
        const engaged = t && Math.sqrt(dist2(u, t)) < this.reach(u, t) + (d.range > 40 ? 80 : 170);
        ai.engaged = engaged || neD < 120;
        if (!ai.engaged && ai.slot && this.formActive(u.team)) action = 'march';
        else if (!t) action = 'idle';
      }
      ai.action = action;
    },

    findProtectee(u) {
      // 공격받고 있는 아군 원거리·지원 유닛을 찾아 그 공격자를 막는다
      let best = null, bs = 0;
      this.alliesIn(u.x, u.y, 240, u.team, (o) => {
        if (o === u || (o.def.cls !== 'ranged' && o.def.cls !== 'caster' && o.def.cls !== 'support')) return;
        const s = o.aggro + (1 - o.hp / o.maxHp);
        if (o.aggro > 0 && s > bs) { bs = s; best = o; }
      });
      if (!best) { u.protectee = null; return null; }
      // 보호 대상을 노리는 가장 가까운 적
      let att = null, ad = Infinity;
      this.enemiesIn(best.x, best.y, 160, u.team, (e) => {
        if (e.target !== best || !this.targetable(u, e)) return;
        const q = dist2(e, best); if (q < ad) { ad = q; att = e; }
      });
      if (!att) { u.protectee = null; return null; }
      u.protectee = best; this.setTarget(u, att);
      return best;
    },

    // ── 이동 실행 ──
    move(u, dt) {
      const d = u.def, ai = u.ai, t = u.target;
      let mx = 0, my = 0;
      const fm = this.fm(u.team);
      let speed = d.speed * Math.max(0.1, 1 - Math.max(u.slowAmt, u.buff.slow)) * Math.max(0.1, 1 + u.buff.speed + (fm.speed || 0));
      const info = this.teamInfo[u.team];
      const face = (x, y) => { u.facing = Math.atan2(y - u.y, x - u.x); };
      const toward = (x, y, stopAt = 0) => {
        const dx = x - u.x, dy = y - u.y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > stopAt && dd > 0.5) { mx = dx / dd; my = dy / dd; }
        return dd;
      };
      if (!d.immobile) {
        switch (ai.action) {
          case 'retreat': {
            ai.state = 'retreat';
            const ne = u.near;
            if (ne) {
              const ax = ne.x - u.x, ay = ne.y - u.y, al = Math.hypot(ax, ay) || 1;
              const bx = info.cx - u.x, by = info.cy - u.y, bl = Math.hypot(bx, by) || 1;
              mx = -ax / al * 0.7 + bx / bl * 0.3; my = -ay / al * 0.7 + by / bl * 0.3;
              const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
            }
            break;
          }
          case 'support': {
            ai.state = 'support';
            const ne = u.near || this.nearestEnemy(u, 700);
            if (d.attack === 'heal') {
              if (t && t.team === u.team) { toward(t.x, t.y, d.range * 0.8); face(t.x, t.y); }
              else if (ne) {
                const dd = Math.sqrt(dist2(u, ne));
                if (dd < 140) { mx = (u.x - ne.x) / dd; my = (u.y - ne.y) / dd; }
                else if (dd > 210 && info.front > 0) toward(ne.x, ne.y);
                face(ne.x, ne.y);
              }
            } else if (ne) {
              const dd = Math.sqrt(dist2(u, ne)) || 1;
              if (info.front > 0) {
                const want = d.keepDist || 90;
                if (dd < want) { mx = (u.x - ne.x) / dd; my = (u.y - ne.y) / dd; }
                else if (dd > want + 40) { mx = (ne.x - u.x) / dd; my = (ne.y - u.y) / dd; }
              } else if (t) {      // 아군 전열이 없으면 직접 싸운다
                ai.state = 'attack';
                if (Math.sqrt(dist2(u, t)) > this.reach(u, t) * 0.92) toward(t.x, t.y);
              }
              face(ne.x, ne.y);
            }
            break;
          }
          case 'protect': {
            ai.state = 'protect';
            const p = u.protectee;
            if (p && p.alive && t) {
              const dx = t.x - p.x, dy = t.y - p.y, dl = Math.hypot(dx, dy) || 1;
              const gx = p.x + dx / dl * (p.r + u.r + 6), gy = p.y + dy / dl * (p.r + u.r + 6);
              if (Math.sqrt(dist2(u, t)) > this.reach(u, t)) toward(gx, gy, 3);
              face(t.x, t.y);
            } else ai.action = 'attack';
            break;
          }
          case 'march': {
            const sp = this.slotPos(u);
            if (sp) {
              const dd = toward(sp.x, sp.y, 4);
              ai.state = dd > 30 ? 'regroup' : 'march';
              const ti = this.teamInfo[1 - u.team]; face(ti.cx, ti.cy);
              if (dd < 30) speed = Math.min(speed, this.formSpeed(u.team) * 1.05 + dd);
            }
            break;
          }
          case 'idle': ai.state = 'idle'; break;
          default: {
            if (!t) { ai.state = 'search'; break; }
            const dd = Math.sqrt(dist2(u, t)) || 0.01;
            const reach = this.reach(u, t);
            const nx = (t.x - u.x) / dd, ny = (t.y - u.y) / dd;
            u.facing = Math.atan2(ny, nx);
            const ne = u.near;
            const kiteD = d.kite ? d.range * 0.45 : (d.range > 100 && d.cls !== 'tank' ? d.range * 0.3 : 0);
            if (d.minRange && dd < d.minRange) { mx = -nx; my = -ny; ai.state = 'retreat'; }
            else if (kiteD && ne && u.nearD < kiteD && ne.def.range <= 40 && info.front > 0) {
              // 근접 적에게서 거리 유지 (카이팅)
              const ex = u.x - ne.x, ey = u.y - ne.y, el = Math.hypot(ex, ey) || 1;
              mx = ex / el; my = ey / el; ai.state = 'retreat';
            } else if (dd > reach * 0.92) {
              mx = nx; my = ny;
              ai.state = (t.hp < t.maxHp * 0.3 && (t.vx * nx + t.vy * ny) > 10) ? 'pursuit' : 'approach';
              if (ai.state === 'pursuit') speed *= 1.1;
              if (d.charge) {
                if (dd > d.charge.minDist) u.charging = true;
                if (u.charging) speed *= d.charge.speedMul;
              }
              if (d.leap && u.leapT <= 0 && dd < d.leap.range && dd > reach + 20) {
                const ox = u.x, oy = u.y;
                u.x = t.x - nx * (reach * 0.8); u.y = t.y - ny * (reach * 0.8);
                u.leapT = d.leap.cd; u.ambush = true; u.cd = Math.min(u.cd, 0.05);
                this.addFx({ kind: 'dash', x: ox, y: oy, x2: u.x, y2: u.y, color: '#ff7070', T: 0.3 });
              }
            } else ai.state = 'attack';
          }
        }
      } else if (t) { face(t.x, t.y); ai.state = 'attack'; }
      if (d.leap) u.leapT -= dt;
      // 느린 회전 (강철 거신): 바라보는 방향으로만 이동
      if (d.turnRate) {
        const want = u.facing, rate = (u.boss && u.boss.turn) || d.turnRate;
        const prev = u.turnFacing ?? want;
        let da = Math.atan2(Math.sin(want - prev), Math.cos(want - prev));
        u.facing = prev + clamp(da, -rate * dt, rate * dt); u.turnFacing = u.facing;
        const ml = Math.hypot(mx, my);
        if (ml > 0) { const al = Math.max(0, Math.cos(da)); mx = Math.cos(u.facing) * al; my = Math.sin(u.facing) * al; }
      }
      // 관성: 목표 속도로 부드럽게 가속 (대형 유닛일수록 느리게 방향 전환)
      const accel = clamp(14 * 12 / u.r, 4, 20);
      const k = Math.min(1, accel * dt);
      u.vx += (mx * speed - u.vx) * k; u.vy += (my * speed - u.vy) * k;
      u.x = clamp(u.x + (u.vx + u.kx) * dt, u.r, this.W - u.r);
      u.y = clamp(u.y + (u.vy + u.ky) * dt, u.r, this.H - u.r);
    },
  });
})();
