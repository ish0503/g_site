// ─────────────────────────────────────────────
// 생존 모드 — 끝없이 강해지는 적 웨이브를 버틴다
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  const TIERS = [
    ['soldier', 'archer', 'spearman', 'scout'],
    ['shieldman', 'berserker', 'crossbow', 'healer', 'poisoner', 'ram'],
    ['guardian', 'assassin', 'mage', 'frost', 'cavalry', 'harpy', 'swordsman', 'bladedancer'],
    ['golem', 'storm', 'catapult', 'sniper', 'drummer', 'banner', 'necromancer', 'phantom', 'duelist'],
    ['summoner', 'priest', 'ballista', 'meteor', 'wyvern', 'elementalist', 'thorn', 'mirror', 'chrono'],
    ['hero', 'phoenix', 'voidcaller', 'colossus'],
  ];
  SW.SURVIVAL = { pop: 50, interval: 28, TIERS };

  // 웨이브 n 의 적 구성 (인원 예산을 무작위 병종에 분배)
  SW.survivalWave = (n, scale = 1) => {
    const budget = Math.round((10 + n * 7 + n * n * 0.35) * scale);
    const tier = Math.min(TIERS.length - 1, Math.floor((n - 1) / 3));
    const pool = TIERS.slice(0, tier + 1).flat();
    const groups = [];
    let left = budget, guard = 0;
    while (left > 0 && guard++ < 40) {
      const type = pool[(SW.util.rand() * pool.length) | 0], d = SW.UNITS[type];
      if (d.pop > left) { if (left < 2) break; continue; }
      const cnt = Math.max(1, Math.min(Math.floor(left / d.pop), Math.ceil(10 / d.pop) + ((SW.util.rand() * 4) | 0)));
      groups.push([type, cnt]); left -= cnt * d.pop;
    }
    // 5 웨이브마다 보스급 정예
    if (n % 5 === 0) groups.push([n >= 15 ? 'colossus' : n >= 10 ? 'hero' : 'golem', 1]);
    return { groups, buff: { hp: n * 0.04, dmg: n * 0.025 } };
  };

  // 전투에 웨이브 진행 로직 연결
  SW.setupSurvival = (b, onWave, opts = {}) => {
    const S = { wave: 0, timer: 2, spawned: 0, best: 0 };
    b.survival = S;
    b.hooks.push((bb, dt) => {
      S.timer -= dt;
      const enemies = bb.teams[1].length;
      if (S.timer <= 0 || (enemies === 0 && S.timer > 3)) {
        if (S.wave > 0 && enemies === 0) S.cleared = S.wave;
        S.wave++; S.timer = SW.SURVIVAL.interval;
        const w = SW.survivalWave(S.wave, opts.scale || 1);
        // 무한 전쟁: 웨이브마다 아군 증원
        if (opts.reinforce && S.wave > 1 && opts.pool && opts.pool.length) {
          let left = opts.reinforce;
          while (left > 0) { const t = opts.pool[(SW.util.rand() * opts.pool.length) | 0], d = SW.UNITS[t]; if (d.pop > left) break; bb.spawn(t, 0, 40 + SW.util.rand() * 60, 80 + SW.util.rand() * (bb.H - 160)); left -= d.pop; }
          bb.banner('증원 도착', '#8cb4ff', 1.2);
        }
        bb.buffs[1] = w.buff; bb.defCache[1] = {};
        for (const [type, cnt] of w.groups) {
          const d = SW.UNITS[type], ranged = d.range > 40 || d.support;
          const cx = bb.W - (ranged ? 60 : 130) - SW.util.rand() * 40, cy = 80 + SW.util.rand() * (bb.H - 160);
          const cols = Math.max(1, Math.ceil(Math.sqrt(cnt) / 1.5)), g = d.size * 2 + 6;
          for (let i = 0; i < cnt; i++) {
            const u = bb.spawn(type, 1, Math.min(bb.W - d.size, cx + (i % cols) * g), Math.max(d.size, Math.min(bb.H - d.size, cy + (Math.floor(i / cols) - cnt / cols / 2) * g)));
            u.ai.think = SW.util.rand() * 0.3;
          }
          S.spawned += cnt;
        }
        bb.banner(`웨이브 ${S.wave}`, '#ff8a8a', 1.6, w.groups.map(([t, c]) => `${SW.UNITS[t].name}×${c}`).join(' '));
        if (onWave) onWave(S.wave);
      }
    });
    return S;
  };
})();
