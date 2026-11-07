// ─────────────────────────────────────────────
// Boss System — 페이즈 전환 · 보스별 전용 패턴 AI
//   등장 → 탐색 → 공격 → 분노(체력 감소) → 최종기 → 격파
// ─────────────────────────────────────────────
(() => {
  const { rand, clamp, dist2 } = SW.util;

  const PATTERNS = {
    // 강철 거신: 전방 방패 강타, 최종기 대지 붕괴
    iron: {
      init(b, u) { u.boss.t.slam = 6; u.boss.t.ult = 0; },
      tick(b, u, dt) {
        const B = u.boss;
        if ((B.t.slam -= dt) <= 0 && u.target && dist2(u, u.target) < 170 * 170) {
          B.t.slam = B.phase >= 1 ? 5 : 8;
          b.coneBoss(u, 160, 90, 70, { knock: 70, color: '#c8d2e6' });
          b.addFx({ kind: 'text', x: u.x, y: u.y - u.r - 10, text: '방패 강타', color: '#c8d2e6', T: 0.9, size: 12 });
        }
        if (B.phase >= 2 && (B.t.ult -= dt) <= 0) {
          B.t.ult = 15;
          b.telegraph(u.x, u.y, 210, 1.2, () => {
            b.bossNova(u, u.x, u.y, 210, 120, { stun: 2, color: '#d9c7a0' });
            b.banner('대지 붕괴!', '#d9c7a0', 1.2);
          }, '#d9c7a0');
        }
      },
    },
    // 폭풍 군주: 밀집 지역 낙뢰, 최종기 천둥 심판
    storm: {
      init(b, u) { u.boss.t.strike = 3; u.boss.t.ult = 0; },
      tick(b, u, dt) {
        const B = u.boss;
        if ((B.t.strike -= dt) <= 0) {
          B.t.strike = B.phase >= 1 ? 4 : 5.5;
          const n = B.phase >= 1 ? 5 : 3;
          for (const p of b.clusters(u, n, 700)) b.areas.push({ kind: 'strike', x: p.x, y: p.y, r: 60, t: 1.3, T: 1.3, dmg: 75, element: 'lightning', team: u.team, src: u, type: 'magic', tele: true, color: '#fff36b' });
        }
        if (B.phase >= 2 && (B.t.ult -= dt) <= 0) {
          B.t.ult = 18;
          b.banner('천둥 심판', '#fff36b', 1.5);
          const list = []; b.enemiesIn(u.x, u.y, 600, u.team, (e) => list.push(e));
          list.slice(0, 40).forEach((e, i) => b.areas.push({ kind: 'strike', x: e.x, y: e.y, r: 30, t: 1.5 + i * 0.03, T: 1.5 + i * 0.03, dmg: 60, element: 'lightning', team: u.team, src: u, type: 'magic', tele: true, color: '#fff36b' }));
        }
      },
    },
    // 심연의 마도사: 해골 소환, 저주, 순간이동, 최종기 심연의 문
    abyss: {
      init(b, u) { u.boss.t.summon = 3; u.boss.t.curse = 5; u.boss.t.blink = 0; u.boss.t.ult = 0; },
      tick(b, u, dt) {
        const B = u.boss;
        if ((B.t.summon -= dt) <= 0) { B.t.summon = 7; for (let i = 0; i < 4; i++) b.summonNear(u, 'skeleton'); }
        if ((B.t.curse -= dt) <= 0) {
          B.t.curse = 6;
          const p = b.clusters(u, 1, 500)[0];
          if (p) b.telegraph(p.x, p.y, 90, 1, () => {
            b.enemiesIn(p.x, p.y, 90, u.team, (e) => { e.weakT = 5; e.markT = 5; e.markAmt = 0.2; b.damage(u, e, 25, 'magic', { element: 'dark', noElem: true }); });
            b.addFx({ kind: 'boom', x: p.x, y: p.y, r: 90, color: '#c07bff', T: 0.6 });
          }, '#c07bff');
        }
        if (B.phase >= 1 && (B.t.blink -= dt) <= 0 && u.nearD < 110) {
          B.t.blink = 5;
          const ox = u.x, oy = u.y, dir = u.team === 1 ? 1 : -1;
          u.x = clamp(u.x + dir * 260, u.r, b.W - u.r); u.y = clamp(u.y + (rand() - 0.5) * 300, u.r, b.H - u.r);
          b.addFx({ kind: 'dash', x: ox, y: oy, x2: u.x, y2: u.y, color: '#c07bff', T: 0.4 });
        }
        if (B.phase >= 2 && (B.t.ult -= dt) <= 0) {
          B.t.ult = 20;
          b.banner('심연의 문', '#c07bff', 1.5);
          for (let i = 0; i < 12; i++) b.summonNear(u, 'skeleton');
          b.heal(u, u.maxHp * 0.08, null, true);
        }
      },
    },
    // 불멸의 불사조: 재생(독이면 차단), 화염 브레스, 2회 부활, 최종기 태양 폭발
    phoenix: {
      init(b, u) { u.boss.t.breath = 4; u.boss.t.ult = 0; u.boss.revives = 2; },
      tick(b, u, dt) {
        const B = u.boss;
        if (u.poisonStacks > 0) { if (rand() < dt * 2) b.addFx({ kind: 'text', x: u.x, y: u.y - u.r - 6, text: '재생 차단', color: '#8cff5a', T: 0.6, size: 10 }); }
        else b.heal(u, u.maxHp * 0.02 * dt, null, true);
        if ((B.t.breath -= dt) <= 0 && u.target) {
          B.t.breath = B.phase >= 1 ? 4 : 6;
          u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
          b.coneBoss(u, 170, 80, 70, { element: 'fire', burn: { dps: 12, dur: 4 }, color: '#ff8a3d' });
        }
        if (B.phase >= 2 && (B.t.ult -= dt) <= 0) {
          B.t.ult = 16;
          b.telegraph(u.x, u.y, 220, 1.2, () => { b.bossNova(u, u.x, u.y, 220, 100, { element: 'fire', burn: { dps: 12, dur: 4 }, color: '#ffcc33' }); b.banner('태양 폭발!', '#ffcc33', 1.2); }, '#ffcc33');
        }
      },
      death(b, u) {
        const B = u.boss;
        if (B.revives > 0 && u.poisonStacks === 0) {
          B.revives--; u.hp = u.maxHp * 0.6; u.burn = 0;
          b.banner(`불사조 부활! (남은 부활 ${B.revives})`, '#ffcc33', 1.8);
          b.addFx({ kind: 'shock', x: u.x, y: u.y, r: 160, color: '#ffcc33', T: 0.8 });
          return true;
        }
        if (B.revives > 0) b.banner('독이 부활을 막았다!', '#8cff5a', 1.8);
        return false;
      },
    },
    // 공허의 지배자: 1단계 소용돌이 → 2단계 순간이동+공허체 → 3단계 블랙홀
    void: {
      init(b, u) { u.boss.t.vortex = 3; u.boss.t.tp = 4; u.boss.t.ult = 0; },
      tick(b, u, dt) {
        const B = u.boss;
        if ((B.t.vortex -= dt) <= 0) {
          B.t.vortex = B.phase >= 1 ? 5 : 6.5;
          const p = b.clusters(u, 1, 600)[0];
          if (p) b.areas.push({ kind: 'vortex', x: p.x, y: p.y, r: 120, t: 3, T: 3, pull: 100, dps: 22, team: u.team, src: u });
        }
        if (B.phase >= 1 && (B.t.tp -= dt) <= 0) {
          B.t.tp = 9;
          const p = b.clusters(u, 1, 2000)[0];
          if (p) {
            const ox = u.x, oy = u.y;
            u.x = clamp(p.x + (u.team === 1 ? 160 : -160), u.r, b.W - u.r); u.y = clamp(p.y, u.r, b.H - u.r);
            b.addFx({ kind: 'dash', x: ox, y: oy, x2: u.x, y2: u.y, color: '#a070ff', T: 0.4 });
            b.bossNova(u, u.x, u.y, 100, 60, { color: '#a070ff' });
          }
          for (let i = 0; i < 3; i++) b.summonNear(u, 'voidling');
        }
        if (B.phase >= 2 && (B.t.ult -= dt) <= 0) {
          B.t.ult = 20;
          b.banner('사건의 지평선', '#a070ff', 1.8);
          b.areas.push({ kind: 'vortex', x: b.W / 2, y: b.H / 2, r: 330, t: 6, T: 6, pull: 150, dps: 30, team: u.team, src: u, big: true });
          b.shake = 0.5;
        }
      },
    },
  };

  Object.assign(SW.Battle.prototype, {
    initBoss(u) {
      u.boss = { phase: 0, t: {}, revives: 0 };
      const p = PATTERNS[u.def.bossData.ai]; if (p && p.init) p.init(this, u);
    },
    updateBoss(u, dt) {
      const B = u.boss, bd = u.def.bossData;
      // 페이즈 전환
      const next = bd.phases[B.phase];
      if (next && u.hp <= u.maxHp * next.at) {
        B.phase++;
        this.banner(`${u.def.name} — ${next.name}`, bd.color, 2);
        this.addFx({ kind: 'shock', x: u.x, y: u.y, r: 200, color: bd.color, T: 0.7 });
        this.shake = 0.4;
        if (next.mods) this.addTimed(u, next.mods, 1e6);
        if (next.turn) B.turn = next.turn;
      }
      const p = PATTERNS[bd.ai]; if (p) p.tick(this, u, dt);
    },
    bossDeath(u) { const p = PATTERNS[u.def.bossData.ai]; return p && p.death ? p.death(this, u) : false; },

    // 적 밀집 지점 n곳 (격자 셀 인구 기반)
    clusters(u, n, range) {
      const cells = [...this.cellCount[1 - u.team].entries()].sort((a, c) => c[1] - a[1]);
      const out = [], c = this.cell;
      for (const [k, cnt] of cells) {
        const x = (k % 4096 + 0.5) * c, y = (Math.floor(k / 4096) + 0.5) * c;
        if ((x - u.x) ** 2 + (y - u.y) ** 2 > range * range) continue;
        if (out.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 100 * 100)) continue;
        out.push({ x, y, cnt });
        if (out.length >= n) break;
      }
      return out;
    },
    telegraph(x, y, r, delay, fn, color) {
      this.areas.push({ kind: 'tele', x, y, r, t: delay, T: delay, color, done: false });
      SW.simDelay(this, delay, fn);
    },
    bossNova(u, x, y, r, dmg, o = {}) {
      this.enemiesIn(x, y, r, u.team, (e) => {
        this.hit(u, e, dmg, { splash: true, element: o.element, type: 'phys' });
        if (!e.alive) return;
        if (o.stun) e.stun = Math.max(e.stun, o.stun);
        if (o.burn) { e.burn = o.burn.dur; e.burnDps = Math.max(e.burnDps, o.burn.dps); }
        if (o.knock && !e.def.immobile) this.knockback(e, x, y, o.knock);
      }, true);
      this.addFx({ kind: 'boom', x, y, r, color: o.color || '#fff', T: 0.6 });
      this.addFx({ kind: 'shock', x, y, r: r * 1.4, color: o.color || '#fff', T: 0.5 });
      this.particles(x, y, o.color || '#fff', 24, 260);
      this.shake = Math.max(this.shake || 0, 0.4);
    },
    coneBoss(u, range, deg, dmg, o = {}) {
      const half = deg * Math.PI / 360;
      this.enemiesIn(u.x, u.y, range, u.team, (e) => {
        let a = Math.atan2(e.y - u.y, e.x - u.x) - u.facing; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > half) return;
        this.hit(u, e, dmg, { splash: true, element: o.element });
        if (!e.alive) return;
        if (o.burn) { e.burn = o.burn.dur; e.burnDps = Math.max(e.burnDps, o.burn.dps); }
        if (o.knock && !e.def.immobile) this.knockback(e, u.x, u.y, o.knock);
      }, true);
      this.addFx({ kind: 'cone', x: u.x, y: u.y, a: u.facing, r: range, ang: deg, color: o.color || '#fff', T: 0.45 });
    },
  });
})();
