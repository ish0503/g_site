// ─────────────────────────────────────────────
// 3.0 콘텐츠 — 공성전 요새 · 전쟁 시나리오 · 보스 부위 · 연속 보스전 · 무한 전쟁 · 전술 퍼즐
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  const { clamp, rand } = SW.util;

  // ── 요새 생성: 구조물 유닛 목록 + 지형(성벽 위) + 함정 ──
  // side: 요새가 있는 쪽 ('right' | 'left'), team: 수비 팀
  SW.buildFort = (W, H, side, team, terrain, size = 1) => {
    const out = [], traps = [];
    const fw = W * 0.3 * size, fh = H * 0.62 * size;
    const x1 = side === 'right' ? W - 50 : 50 + fw, x0 = x1 - fw;
    const y0 = (H - fh) / 2, y1 = y0 + fh;
    const face = side === 'right' ? x0 : x1;        // 공격군을 향한 면
    const back = side === 'right' ? x1 : x0;
    const step = 26;
    const gateY = H / 2;
    const seg = (type, x, y) => out.push({ type, team, x, y });
    for (let y = y0; y <= y1; y += step) {
      if (Math.abs(y - gateY) < step * 1.6) seg('gate', face, y); else seg('wall', face, y);
    }
    for (let x = Math.min(face, back) + step; x < Math.max(face, back); x += step) { seg('wall', x, y0); seg('wall', x, y1); }
    seg('tower', face, y0); seg('tower', face, y1);
    seg('tower', face, y0 + fh * 0.25); seg('tower', face, y0 + fh * 0.75);
    seg('keep', (x0 + x1) / 2 + (side === 'right' ? fw * 0.15 : -fw * 0.15), H / 2);
    if (terrain) {
      // 성벽 안쪽은 '성벽 위·요새' 지형 (고지·엄폐·방어)
      const inner = side === 'right' ? face + 20 : face - 20;
      for (let y = y0 + 20; y < y1 - 10; y += terrain.tile * 0.5) terrain.paint(inner, y, 34, 'fort');
      for (let x = x0; x < x1; x += 40) { terrain.paint(x, y0 + 30, 26, 'road'); terrain.paint(x, y1 - 30, 26, 'road'); }
    }
    // 성문 앞 함정
    const dir = side === 'right' ? -1 : 1;
    for (let i = 0; i < 4; i++) traps.push({ x: face + dir * (70 + (i % 2) * 50), y: gateY + (i < 2 ? -50 : 50), r: 34, uses: 6 });
    return { units: out, traps, inner: { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1 }, face, gateY };
  };
  // 함정: 밟은 적에게 피해 + 속박
  SW.setupTraps = (b, traps, team) => {
    b.traps = traps.map(t => ({ ...t, team }));
    b.hooks.push((bb, dt) => {
      bb.trapT = (bb.trapT || 0) + dt; if (bb.trapT < 0.3) return; bb.trapT = 0;
      for (const tr of bb.traps) {
        if (tr.uses <= 0) continue;
        bb.enemiesIn(tr.x, tr.y, tr.r, tr.team, (e) => {
          if (tr.uses <= 0 || e.def.flying) return;
          tr.uses--; bb.damage(null, e, 45, 'phys', { srcTeam: tr.team }); e.rootT = Math.max(e.rootT || 0, 1.2);
          bb.addFx({ kind: 'spikes', x: tr.x, y: tr.y, r: tr.r, T: 0.4 });
        }, false);
      }
    });
  };

  // ── 공성전 시나리오 ──
  SW.SIEGES = [
    { id: 'assault', name: '요새 공격', desc: '성문을 부수고 성채를 함락하라. 공성 유닛(투석기·포병·공성 골렘·돌격병)이 핵심.', side: 'right', defender: 1, pop: 140, time: 420, reward: { gold: 900, wood: 40, ore: 30 },
      garrison: [['archer', 13], ['crossbow', 7], ['soldier', 24], ['shieldman', 8], ['guardian', 3], ['priest', 2], ['catapult', 2]] },
    { id: 'defense', name: '요새 방어', desc: '4분 동안 성채를 지켜라. 성벽 위의 원거리 유닛은 고지·엄폐 효과를 받는다.', side: 'left', defender: 0, pop: 90, time: 240, reward: { gold: 800, wood: 30, ore: 40 },
      attackers: [['soldier', 50], ['ram', 8], ['siegeGolem', 3], ['catapult', 6], ['archer', 30], ['cavalry', 10], ['berserker', 14]] },
  ];

  // ── 전쟁 시나리오 (대규모 전쟁 시뮬레이션) ──
  SW.WAR_SCENARIOS = [
    { id: 'field', name: '평원 회전', desc: '끝없는 평원에서 벌어지는 두 대군의 정면 승부. 중앙 거점 3곳.', terrain: 'plain', weather: 'clear', time: 'day', W: 3200, H: 1800,
      player: 1500, enemy: 1800, enemyPers: 'balanced', points: [[0.5, 0.25], [0.5, 0.5], [0.5, 0.75]] },
    { id: 'river', name: '강 건너기', desc: '적은 강 건너편 방어선을 지킨다. 여울을 차지하라.', terrain: 'river', weather: 'clear', time: 'day', W: 3200, H: 1800,
      player: 1500, enemy: 1700, enemyPers: 'defensive', points: [[0.5, 0.25], [0.5, 0.75]], fordPoints: true },
    { id: 'fortress', name: '요새 공방', desc: '적 지휘관이 요새 안에 있다. 성벽을 뚫고 지휘관을 격파하라.', terrain: 'plain', weather: 'clear', time: 'day', W: 3200, H: 1800,
      player: 1600, enemy: 1300, enemyPers: 'defensive', fort: true, points: [] },
    { id: 'night', name: '야간 기습', desc: '안개 낀 밤. 시야가 짧고 기습 피해가 1.5배.', terrain: 'forest', weather: 'fog', time: 'night', W: 3200, H: 1800,
      player: 1400, enemy: 1600, enemyPers: 'flanker', points: [[0.5, 0.5]] },
    { id: 'storm', name: '폭풍의 계곡', desc: '산악 계곡의 폭풍. 낙뢰와 범람, 원거리 빗나감.', terrain: 'mountain', weather: 'storm', time: 'dusk', W: 3200, H: 1800,
      player: 1500, enemy: 1700, enemyPers: 'aggressive', points: [[0.5, 0.35], [0.5, 0.65]] },
  ];

  // ── 보스 부위: 강철 거신의 방패 ──
  (() => {
    const P = SW.Battle.prototype;
    const origInit = P.initBoss;
    P.initBoss = function (u) {
      origInit.call(this, u);
      if (u.def.bossData.ai === 'iron') u.boss.parts = [{ id: 'shield', name: '거대 방패', hp: 2400, max: 2400 }];
      if (u.def.bossData.ai === 'void') u.boss.parts = [{ id: 'core', name: '공허 핵', hp: 3000, max: 3000, weak: true }];
    };
    const origDmg = P.damage;
    P.damage = function (src, t, amt, type, opt = {}) {
      if (t.boss && t.boss.parts && src && !opt.dot && amt > 0) {
        const sh = t.boss.parts.find(p => p.id === 'shield' && p.hp > 0);
        if (sh) {
          const fx = Math.cos(t.facing), fy = Math.sin(t.facing), dx = src.x - t.x, dy = src.y - t.y, dd = Math.hypot(dx, dy) || 1;
          if ((fx * dx + fy * dy) / dd > 0.35) {
            sh.hp -= amt * 0.6;
            if (sh.hp <= 0) {
              sh.hp = 0; t.def = Object.assign({}, t.def, { frontArmor: 0 }); t.weakT = 1e6;
              this.banner('거대 방패 파괴! 약점 노출', '#ffe680', 2.2, '정면 장갑 해제 · 받는 피해 증가'); this.logEvent('강철 거신의 방패 파괴', t.team, 'boss');
              this.addFx({ kind: 'shock', x: t.x, y: t.y, r: 160, color: '#ffe680', T: 0.7 });
            }
          }
        }
        const core = t.boss.parts.find(p => p.id === 'core' && p.hp > 0);
        if (core && t.boss.phase >= 1) { core.hp -= amt * 0.5; if (core.hp <= 0) { core.hp = 0; this.banner('공허 핵 붕괴! 지배자 약화', '#c9a8ff', 2); this.logEvent('공허 핵 붕괴', t.team, 'boss'); this.addTimed(t, { atkSlow: 0.4 }, 1e6); t.boss.t.ult = 1e9; } }
        if (t.boss.parts.some(p => p.id === 'shield' && p.hp <= 0)) amt *= 1.25;
      }
      return origDmg.call(this, src, t, amt, type, opt);
    };
  })();

  // ── 연속 보스전 ──
  SW.BOSS_RUSH = { pop: 110, reward: { gold: 3000, crystal: 8 }, order: ['abyssMage', 'stormLord', 'ironColossus', 'immortalPhoenix', 'voidSovereign'] };
  SW.setupBossRush = (b) => {
    const R = { i: 0, wait: 0 };
    b.bossRush = R;
    const spawnBoss = () => {
      const id = SW.BOSS_RUSH.order[R.i], raid = SW.RAIDS.find(r => r.boss === id);
      b.spawn(id, 1, b.W - 260, b.H / 2);
      for (const u of SW.stageDeployment({ enemies: raid.escorts })) b.spawn(u.type, 1, u.x, u.y);
      b.banner(`보스 ${R.i + 1}/5: ${SW.UNITS[id].name}`, SW.UNITS[id].bossData.color, 2.2);
      b.logEvent(`연속 보스전 ${R.i + 1}단계: ${SW.UNITS[id].name}`, 1, 'boss');
    };
    b.hooks.push((bb, dt) => {
      if (bb.teams[1].length) return;
      R.wait += dt;
      if (R.wait < 4) return;
      R.wait = 0; R.i++;
      if (R.i >= SW.BOSS_RUSH.order.length) { R.done = true; bb.finish(0); bb.endReason = '연속 보스전 완주'; return; }
      for (const u of bb.teams[0]) bb.heal(u, u.maxHp * 0.3, null, true);
      spawnBoss();
    });
    return spawnBoss;
  };

  // ── 전술 퍼즐 ──
  // units: [유닛, 수, x, y, 열] (파란 팀은 위치만 바꿀 수 있음)
  SW.PUZZLES = [
    { id: 'p1', name: '포위망 돌파', goal: '아군 손실 2기 이하로 승리', desc: '기병 6기로 원형으로 둘러싼 병사들을 돌파하라. 돌진 각도가 핵심.', blue: [['cavalry', 6, 300, 450, 2]], red: [['soldier', 22, 1150, 450, 5]], cond: { maxLoss: 2 }, reward: { crystal: 1, gold: 200 } },
    { id: 'p2', name: '궁수의 언덕', goal: '승리', desc: '궁수 14기 vs 병사 28기. 언덕(고지)과 숲(엄폐)을 이용하라.', terrain: 'hills', blue: [['archer', 14, 300, 450, 2]], red: [['soldier', 28, 1250, 450, 4]], reward: { crystal: 1, gold: 200 } },
    { id: 'p3', name: '호위 임무', goal: '60초 동안 보호 대상(대사제) 생존', desc: '방패병과 수호병으로 대사제를 암살자들로부터 지켜라.', blue: [['priest', 1, 260, 450, 1, true], ['shieldman', 6, 330, 450, 2], ['guardian', 2, 360, 450, 1]], red: [['assassin', 10, 1300, 450, 2], ['scout', 10, 1250, 300, 2]], victory: { type: 'protect' }, time: 60, reward: { crystal: 2, gold: 250 } },
    { id: 'p4', name: '불타는 숲', goal: '60초 안에 승리', desc: '숲속에 숨은 적. 화염은 숲에 불을 붙인다.', terrain: 'forest', blue: [['mage', 6, 300, 450, 2], ['shieldman', 6, 420, 450, 2]], red: [['archer', 16, 1200, 450, 4], ['soldier', 14, 1100, 450, 3]], time: 60, cond: { timeWin: true }, reward: { crystal: 2, gold: 250 } },
    { id: 'p5', name: '얼음과 번개', goal: '승리', desc: '냉기로 얼리고 번개로 깨뜨려라 (감전 1.5배).', blue: [['frost', 4, 300, 400, 2], ['storm', 4, 300, 500, 2], ['shieldman', 4, 420, 450, 2]], red: [['golem', 3, 1200, 450, 1], ['guardian', 2, 1100, 450, 1]], reward: { crystal: 2, gold: 300 } },
    { id: 'p6', name: '거신 사냥', goal: '승리', desc: '창병의 대형 특효와 치유사의 지원으로 거신을 쓰러뜨려라.', blue: [['spearman', 12, 350, 450, 3], ['healer', 4, 230, 450, 2]], red: [['colossus', 1, 1200, 450, 1]], reward: { crystal: 2, gold: 300 } },
    { id: 'p7', name: '성문 돌파', goal: '성채 함락', desc: '공성 골렘과 병사들로 작은 요새를 무너뜨려라.', siege: true, blue: [['siegeGolem', 2, 300, 450, 1], ['soldier', 16, 400, 450, 4], ['archer', 8, 220, 450, 2]], red: [['archer', 8, 0, 0, 0], ['soldier', 8, 0, 0, 0]], victory: { type: 'keep', defender: 1 }, time: 240, reward: { crystal: 3, gold: 400 } },
    { id: 'p8', name: '밤의 암살', goal: '적 지휘관 격파', desc: '야간. 암살자와 유령으로 경비병 사이의 지휘관을 노려라.', time_: 'night', blue: [['assassin', 5, 300, 450, 1], ['phantom', 4, 260, 450, 1]], red: [['commander', 1, 1350, 450, 1], ['soldier', 16, 1150, 450, 4], ['archer', 8, 1300, 450, 2]], victory: { type: 'commander' }, reward: { crystal: 3, gold: 400 } },
  ];

  // ── 무한 전쟁 ──
  SW.INFINITE = { W: 2400, H: 1350, pop: 110, scale: 2.2, reinforce: 12 };
})();
