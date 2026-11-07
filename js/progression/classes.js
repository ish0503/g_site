// ─────────────────────────────────────────────
// 3.1 직업 분기 트리 · 특성 조합
//   · Lv5: 두 갈래 직업 중 하나 선택 (분기)
//   · Lv10: 선택한 갈래의 두 상위 직업 중 하나 (💎3 · 💰500) — 고유 기술로 교체
//     3.0 의 고정 진화(SW.EVOLUTIONS)도 Lv10 의 세 번째 선택지로 그대로 남는다 (둘 중 하나만 적용).
//   · 특성: Lv3 / Lv7 에 하나씩. 특정 조합은 추가 보너스(시너지).
//   저장: growth[type] 에 cls('a'|'b'), sub('a1'|'a2'|'b1'|'b2'), traits([t1, t2]) 를 추가할 뿐 기존 필드는 그대로.
// ─────────────────────────────────────────────
(() => {
  // ── 고유 기술 (기존 효과 원시 동작만 사용) ──
  Object.assign(SW.ABILITIES, {
    vanguardCharge: { name: '선봉 돌격', kind: 'active', cd: 9, cond: 'targetFar:40',
      fx: [{ op: 'dash', range: 140, mult: 2, knock: 40 }, { op: 'buffAllies', radius: 90, dur: 4, mods: { speed: 0.25, dmg: 0.15 }, color: '#ffd28a' }],
      desc: '적에게 돌진해 2배 피해, 주변 아군 4초간 이동 +25%·공격 +15%.' },
    pinShot: { name: '꿰뚫는 표식', kind: 'active', cd: 10, cond: 'targetInRange',
      fx: [{ op: 'snipe', mult: 1.8, lowHp: 0.3, lowMult: 3 }, { op: 'mark', dur: 5, taken: 0.25 }],
      desc: '방어 무시 1.8배 사격 후 표식: 5초간 받는 피해 +25%.' },
    arrowRain: { name: '화살비', kind: 'active', cd: 12, cond: 'clusterAtTarget:80:3',
      fx: [{ op: 'strikes', radius: 100, count: 7, delay: 0.6, dmg: 26 }], desc: '대상 주변 적 7명에게 화살비 (각 26).' },
    spearWall: { name: '창벽', kind: 'active', cd: 12, cond: 'enemiesNear:150:3',
      fx: [{ op: 'buffAllies', radius: 80, dur: 5, mods: { armor: 3, dmg: 0.2 }, color: '#d8e0ff' }], desc: '주변 아군 5초간 방어 +3·공격 +20%.' },
    impale: { name: '관통 돌격', kind: 'active', cd: 8, cond: 'targetFar:30',
      fx: [{ op: 'dash', range: 120, mult: 2.6, bigMult: 2 }], desc: '돌진해 2.6배 피해. 대형 유닛에게 추가 2배.' },
    aegis: { name: '수호의 방패', kind: 'active', cd: 13, cond: 'enemiesNear:200:3',
      fx: [{ op: 'shield', radius: 120, amt: 60, count: 10 }], desc: '주변 아군 10명에게 보호막(60).' },
    holyNova: { name: '심판의 빛', kind: 'active', cd: 9, cond: 'enemiesNear:80:2',
      fx: [{ op: 'nova', radius: 80, mult: 2.2 }, { op: 'heal', radius: 80, amt: 20 }], desc: '주변 적에게 빛 피해, 아군 20 회복.' },
    arcaneRain: { name: '비전 폭격', kind: 'active', cd: 13, cond: 'clusterAtTarget:60:3',
      fx: [{ op: 'meteors', count: 3, radius: 50, mult: 1.5 }], desc: '밀집한 적에게 비전탄 3발 (각 1.5배).' },
    frostNova: { name: '서리 폭발', kind: 'active', cd: 12, cond: 'enemiesNear:90:3',
      fx: [{ op: 'freeze', radius: 90, dur: 1.4 }, { op: 'nova', radius: 90, mult: 1, element: 'frost' }], desc: '주변 적 1.4초 빙결 + 냉기 피해.' },
    lanceBreak: { name: '창기병 돌파', kind: 'active', cd: 9, cond: 'targetFar:80',
      fx: [{ op: 'dash', range: 180, mult: 2.4, knock: 70 }, { op: 'cone', range: 50, angle: 90, mult: 1.2 }], desc: '장거리 돌진 2.4배 + 전방 베기.' },
    quake: { name: '지각 붕괴', kind: 'active', cd: 14, cond: 'enemiesNear:110:4',
      fx: [{ op: 'nova', radius: 120, mult: 1.6, stun: 1, knock: 40 }], desc: '주변 120 범위 1.6배 피해·1초 기절.' },
  });

  // ── 직업 트리 ── [이름, 설명, fx, patch, skill]
  const N = (name, desc, fx, patch, skill) => ({ name, desc, fx: fx || [], patch: patch || null, skill: skill || null });
  SW.CLASS_TREES = {
    soldier: {
      a: N('방패 보병', '체력 +15%, 방어 +2', [['hp', 'mul', 0.15], ['armor', 'add', 2]]),
      b: N('돌격 보병', '공격 +15%, 이동 +8%', [['dmg', 'mul', 0.15], ['speed', 'mul', 0.08]]),
      a1: N('근위대장', '체력 +30%, 방어 +3 · 기술: 방어벽', [['hp', 'mul', 0.3], ['armor', 'add', 3]], { glyph: 'star' }, 'shieldWall'),
      a2: N('파수꾼', '체력 +25%, 도발 · 기술: 도발의 함성', [['hp', 'mul', 0.25], ['armor', 'add', 2]], null, 'warCry'),
      b1: N('광전사', '공격 +30%, 흡혈 8% · 기술: 피의 광란', [['dmg', 'mul', 0.3], ['lifesteal', 'add', 0.08]], null, 'bloodFrenzy'),
      b2: N('선봉장', '공격 +20%, 이동 +12% · 기술: 선봉 돌격', [['dmg', 'mul', 0.2], ['speed', 'mul', 0.12]], { glyph: 'chevron' }, 'vanguardCharge'),
    },
    archer: {
      a: N('저격 궁수', '사거리 +12%, 공격 +10%', [['range', 'mul', 0.12], ['dmg', 'mul', 0.1]]),
      b: N('속사 궁수', '공격 주기 -12%', [['atkCd', 'mul', -0.12]]),
      a1: N('명사수', '사거리 +20%, 치명타 20% · 기술: 헤드샷', [['range', 'mul', 0.2], ['dmg', 'mul', 0.25]], { crit: { chance: 0.2, mult: 2.2 } }, 'headshot'),
      a2: N('표식 사냥꾼', '공격 +20% · 기술: 꿰뚫는 표식', [['dmg', 'mul', 0.2], ['range', 'mul', 0.1]], null, 'pinShot'),
      b1: N('연사수', '공격 주기 -20% · 기술: 탄막', [['atkCd', 'mul', -0.2], ['dmg', 'mul', 0.1]], null, 'fanBarrage'),
      b2: N('화살비 지휘관', '체력 +15% · 기술: 화살비', [['hp', 'mul', 0.15], ['dmg', 'mul', 0.12]], null, 'arrowRain'),
    },
    spearman: {
      a: N('방진 창병', '체력 +15%, 방어 +1', [['hp', 'mul', 0.15], ['armor', 'add', 1]]),
      b: N('돌격 창병', '공격 +15%, 대형 특효', [['dmg', 'mul', 0.15]], { bonusVsBig: 3 }),
      a1: N('장창 근위', '사거리 +12, 대형 특효 4배 · 기술: 창벽', [['range', 'add', 12], ['hp', 'mul', 0.2]], { bonusVsBig: 4 }, 'spearWall'),
      a2: N('방진 대장', '방어 +3, 체력 +25% · 기술: 방어벽', [['armor', 'add', 3], ['hp', 'mul', 0.25]], null, 'shieldWall'),
      b1: N('용 사냥꾼', '대형 특효 5배 · 기술: 관통 돌격', [['dmg', 'mul', 0.2]], { bonusVsBig: 5 }, 'impale'),
      b2: N('경창기병', '이동 +25%, 공격 +15% · 기술: 질주', [['speed', 'mul', 0.25], ['dmg', 'mul', 0.15]], null, 'sprint'),
    },
    shieldman: {
      a: N('성벽 방패병', '투사체 방어 +15%, 체력 +10%', [['blockChance', 'add', 0.15], ['hp', 'mul', 0.1]]),
      b: N('반격 방패병', '공격 +25%, 방어 +1', [['dmg', 'mul', 0.25], ['armor', 'add', 1]]),
      a1: N('철벽 방패병', '투사체 방어 80%, 체력 +35% · 기술: 방어벽', [['hp', 'mul', 0.35]], { blockChance: 0.8 }, 'shieldWall'),
      a2: N('수호 기사', '체력 +30% · 기술: 수호의 방패', [['hp', 'mul', 0.3], ['armor', 'add', 1]], null, 'aegis'),
      b1: N('반격의 달인', '공격 +30% · 기술: 반격', [['dmg', 'mul', 0.3], ['atkCd', 'mul', -0.1]], null, 'riposte'),
      b2: N('방패 투사', '체력 +20%, 기절 · 기술: 방패 강타', [['hp', 'mul', 0.2], ['dmg', 'mul', 0.25]], null, 'shieldBash'),
    },
    mage: {
      a: N('파괴술사', '공격 +15%, 범위 +10%', [['dmg', 'mul', 0.15], ['splash', 'mul', 0.1]]),
      b: N('제어술사', '사거리 +10%, 체력 +10%', [['range', 'mul', 0.1], ['hp', 'mul', 0.1]]),
      a1: N('대마법사', '범위 +40%, 공격 +30% · 기술: 화염 폭풍', [['splash', 'mul', 0.4], ['dmg', 'mul', 0.3]], null, 'firestorm'),
      a2: N('비전술사', '공격 +25% · 기술: 비전 폭격', [['dmg', 'mul', 0.25], ['atkCd', 'mul', -0.08]], null, 'arcaneRain'),
      b1: N('서리술사', '냉기 속성 · 기술: 서리 폭발', [['hp', 'mul', 0.15]], { element: 'frost' }, 'frostNova'),
      b2: N('뇌전술사', '번개 속성 · 기술: 뇌우', [['dmg', 'mul', 0.15]], { element: 'lightning' }, 'thunderstorm'),
    },
    healer: {
      a: N('사제', '치유 +25%', [['heal', 'mul', 0.25]]),
      b: N('전투 사제', '체력 +15%, 공격 +30%', [['hp', 'mul', 0.15], ['dmg', 'mul', 0.3]]),
      a1: N('성녀', '치유 +70%, 치유 파동 · 기술: 광역 치유', [['heal', 'mul', 0.7]], { healPulse: { amt: 18, radius: 90, cd: 4 } }, 'massHeal'),
      a2: N('수호 사제', '치유 +40% · 기술: 성스러운 빛', [['heal', 'mul', 0.4], ['hp', 'mul', 0.1]], null, 'holyLight'),
      b1: N('심판관', '공격 +40% · 기술: 심판의 빛', [['dmg', 'mul', 0.4], ['hp', 'mul', 0.15]], null, 'holyNova'),
      b2: N('군종 사제', '체력 +20% · 기술: 결집', [['hp', 'mul', 0.2], ['heal', 'mul', 0.2]], null, 'rally'),
    },
    scout: {
      a: N('추적병', '공격 +20%', [['dmg', 'mul', 0.2]]),
      b: N('척후병', '이동 +15%, 체력 +10%', [['speed', 'mul', 0.15], ['hp', 'mul', 0.1]]),
      a1: N('추적자', '공격 +55%, 치명타 25% · 기술: 처형', [['dmg', 'mul', 0.55]], { crit: { chance: 0.25, mult: 2 } }, 'execute'),
      a2: N('그림자 사냥꾼', '공격 +35% · 기술: 그림자 표식', [['dmg', 'mul', 0.35], ['speed', 'mul', 0.1]], null, 'shadowMark'),
      b1: N('질풍 기수', '이동 +30% · 기술: 질주', [['speed', 'mul', 0.3], ['dmg', 'mul', 0.2]], null, 'sprint'),
      b2: N('교란병', '체력 +25% · 기술: 칼날 폭풍', [['hp', 'mul', 0.25], ['dmg', 'mul', 0.2]], null, 'bladeStorm'),
    },
    guardian: {
      a: N('요새 수호자', '체력 +15%, 방어 +2', [['hp', 'mul', 0.15], ['armor', 'add', 2]]),
      b: N('전투 수호자', '공격 +30%', [['dmg', 'mul', 0.3]]),
      a1: N('성채 수호자', '체력 +45%, 도발 범위 +50% · 기술: 도발의 함성', [['hp', 'mul', 0.45], ['taunt', 'mul', 0.5]], null, 'warCry'),
      a2: N('빛의 방벽', '체력 +30% · 기술: 빛의 장벽', [['hp', 'mul', 0.3], ['armor', 'add', 2]], null, 'lightBarrier'),
      b1: N('파괴의 수호자', '공격 +40% · 기술: 충격파', [['dmg', 'mul', 0.4], ['hp', 'mul', 0.15]], null, 'shockwave'),
      b2: N('전쟁 군주', '공격 +25% · 기술: 영웅의 일격', [['dmg', 'mul', 0.25], ['hp', 'mul', 0.2]], null, 'heroicStrike'),
    },
    cavalry: {
      a: N('중기병', '체력 +20%', [['hp', 'mul', 0.2], ['armor', 'add', 1]]),
      b: N('경기병', '이동 +15%, 공격 +10%', [['speed', 'mul', 0.15], ['dmg', 'mul', 0.1]]),
      a1: N('기사', '체력 +40%, 돌격 4배 · 기술: 돌격 나팔', [['hp', 'mul', 0.4]], { charge: { mult: 4, speedMul: 1.4, minDist: 80, knock: 50 } }, 'trample'),
      a2: N('창기병', '공격 +25% · 기술: 창기병 돌파', [['dmg', 'mul', 0.25], ['hp', 'mul', 0.2]], null, 'lanceBreak'),
      b1: N('약탈 기병', '이동 +20%, 흡혈 10% · 기술: 질주', [['speed', 'mul', 0.2], ['lifesteal', 'add', 0.1]], null, 'sprint'),
      b2: N('기마 궁수', '사거리 → 원거리, 공격 +10% · 기술: 집중 사격', [['dmg', 'mul', 0.1]], { range: 150, attack: 'arrow', projSpeed: 420 }, 'focusVolley'),
    },
    assassin: {
      a: N('처형자', '공격 +20%', [['dmg', 'mul', 0.2]]),
      b: N('그림자', '이동 +12%, 회피', [['speed', 'mul', 0.12], ['hp', 'mul', 0.1]]),
      a1: N('그림자 군주', '도약 후 첫 공격 5배 · 기술: 처형', [['hp', 'mul', 0.3]], { ambush: 5, leap: { range: 220, cd: 3 } }, 'execute'),
      a2: N('암살 대가', '공격 +35%, 치명타 30% · 기술: 칼날 폭풍', [['dmg', 'mul', 0.35]], { crit: { chance: 0.3, mult: 2.2 } }, 'bladeStorm'),
      b1: N('표식 암살자', '공격 +25% · 기술: 그림자 표식', [['dmg', 'mul', 0.25], ['speed', 'mul', 0.1]], null, 'shadowMark'),
      b2: N('흡혈 암살자', '흡혈 20% · 기술: 생명 흡수', [['hp', 'mul', 0.2]], { lifesteal: 0.2 }, 'lifeDrain'),
    },
    swordsman: {
      a: N('결투가', '치명타 +10%', [['crit.chance', 'add', 0.1], ['dmg', 'mul', 0.1]]),
      b: N('검무사', '공격 주기 -12%', [['atkCd', 'mul', -0.12]]),
      a1: N('검성', '공격 +35%, 후속 공격 +60% · 기술: 영웅의 일격', [['dmg', 'mul', 0.35]], { crit: { chance: 0.25, mult: 2 }, followUp: 0.6 }, 'heroicStrike'),
      a2: N('반격 검사', '공격 +25% · 기술: 반격', [['dmg', 'mul', 0.25], ['hp', 'mul', 0.15]], null, 'riposte'),
      b1: N('칼날 무희', '공격 주기 -15% · 기술: 칼날 폭풍', [['atkCd', 'mul', -0.15], ['speed', 'mul', 0.1]], null, 'bladeStorm'),
      b2: N('흡혈 검사', '흡혈 15% · 기술: 피의 광란', [['dmg', 'mul', 0.2], ['lifesteal', 'add', 0.15]], null, 'bloodFrenzy'),
    },
    golem: {
      a: N('바위 골렘', '체력 +20%', [['hp', 'mul', 0.2], ['armor', 'add', 1]]),
      b: N('분쇄 골렘', '공격 +20%, 범위 +10%', [['dmg', 'mul', 0.2], ['splash', 'mul', 0.1]]),
      a1: N('태고의 골렘', '체력 +50%, 범위 +30% · 기술: 지진', [['hp', 'mul', 0.5], ['splash', 'mul', 0.3]], null, 'earthquake'),
      a2: N('수정 골렘', '투사체 방어 40% · 기술: 반사 결계', [['hp', 'mul', 0.3]], { blockChance: 0.4 }, 'mirrorWard'),
      b1: N('지각 골렘', '공격 +30% · 기술: 지각 붕괴', [['dmg', 'mul', 0.3], ['hp', 'mul', 0.15]], null, 'quake'),
      b2: N('용암 골렘', '화염 속성 · 기술: 화염 폭풍', [['dmg', 'mul', 0.2], ['hp', 'mul', 0.2]], { element: 'fire' }, 'firestorm'),
    },
  };

  // ── 특성 (Lv3 / Lv7) 과 조합 ──
  SW.TRAITS = {
    tough: { tier: 1, name: '강인함', icon: '💪', desc: '체력 +10%', fx: [['hp', 'mul', 0.1]] },
    keen: { tier: 1, name: '예리함', icon: '🎯', desc: '치명타 +6%', fx: [['crit.chance', 'add', 0.06]] },
    swift: { tier: 1, name: '날렵함', icon: '💨', desc: '이동 +8%', fx: [['speed', 'mul', 0.08]] },
    disciplined: { tier: 1, name: '규율', icon: '📏', desc: '방어 +1, 공격 주기 -4%', fx: [['armor', 'add', 1], ['atkCd', 'mul', -0.04]] },
    vampiric: { tier: 1, name: '흡혈', icon: '🩸', desc: '흡혈 5%', fx: [['lifesteal', 'add', 0.05]] },
    veteran: { tier: 2, name: '노련함', icon: '🎖', desc: '공격 +8%, 체력 +5%', fx: [['dmg', 'mul', 0.08], ['hp', 'mul', 0.05]] },
    bulwark: { tier: 2, name: '보루', icon: '🧱', desc: '방어 +2, 체력 +8%', fx: [['armor', 'add', 2], ['hp', 'mul', 0.08]] },
    fury: { tier: 2, name: '분노', icon: '🔥', desc: '공격 주기 -10%', fx: [['atkCd', 'mul', -0.1]] },
    hunter: { tier: 2, name: '사냥꾼', icon: '🏹', desc: '공격 +6%, 사거리 +6%', fx: [['dmg', 'mul', 0.06], ['range', 'mul', 0.06]] },
    regen: { tier: 2, name: '재생', icon: '💚', desc: '초당 체력 1.5 재생', fx: [['regenSelf', 'sum', 1.5]] },
  };
  SW.TRAIT_COMBOS = [
    { a: 'tough', b: 'bulwark', name: '불굴', desc: '체력 +10%', fx: [['hp', 'mul', 0.1]] },
    { a: 'keen', b: 'fury', name: '연격', desc: '치명타 배율 +0.4', fx: [['crit.mult', 'add', 0.4]] },
    { a: 'swift', b: 'hunter', name: '추격자', desc: '이동 +8%, 공격 +5%', fx: [['speed', 'mul', 0.08], ['dmg', 'mul', 0.05]] },
    { a: 'vampiric', b: 'fury', name: '피의 갈증', desc: '흡혈 +5%', fx: [['lifesteal', 'add', 0.05]] },
    { a: 'disciplined', b: 'veteran', name: '정예 규율', desc: '공격 +6%, 방어 +1', fx: [['dmg', 'mul', 0.06], ['armor', 'add', 1]] },
    { a: 'tough', b: 'regen', name: '재생력', desc: '재생 +1.5', fx: [['regenSelf', 'sum', 1.5]] },
  ];
  SW.SUB_COST = { crystal: 3, gold: 500 };
  SW.comboOf = (traits) => SW.TRAIT_COMBOS.filter(c => traits && traits.includes(c.a) && traits.includes(c.b));
  // 현재 적용 중인 직업 이름 (없으면 null)
  SW.classNameOf = (type) => {
    const g = SW.save && SW.save.data.growth && SW.save.data.growth[type], T = SW.CLASS_TREES[type];
    if (!g || !T) return null;
    return g.sub && T[g.sub] ? T[g.sub].name : g.cls && T[g.cls] ? T[g.cls].name : null;
  };

  // ── 성장 수정자에 반영 ──
  const orig = SW.growthMods;
  SW.growthMods = (mods) => {
    orig(mods);
    const d = SW.save.data;
    for (const [type, g] of Object.entries(d.growth || {})) {
      const base = SW.UNITS[type]; if (!base) continue;
      const fx = [], patch = {};
      let regen = 0, needCrit = false;
      const T = SW.CLASS_TREES[type];
      if (T && g.cls && T[g.cls]) {
        const nodes = [T[g.cls]];
        if (g.sub && T[g.sub] && g.sub[0] === g.cls) nodes.push(T[g.sub]);
        for (const n of nodes) { fx.push(...n.fx); if (n.patch) Object.assign(patch, n.patch); if (n.skill) patch.skill = n.skill; }
        const top = nodes[nodes.length - 1]; patch.name = top.name; patch.className = top.name;
      }
      for (const id of g.traits || []) if (SW.TRAITS[id]) fx.push(...SW.TRAITS[id].fx);
      for (const c of SW.comboOf(g.traits)) fx.push(...c.fx);
      for (const [stat, op, v] of fx) {
        if (stat === 'regenSelf') { regen += v; continue; }
        if (stat.startsWith('crit.') && !base.crit && !patch.crit) needCrit = true;
        if (op === 'mul') mods.stat.push({ t: type, stat, mul: v });
        else if (op === 'add') mods.stat.push({ t: type, stat, add: v });
      }
      if (needCrit) patch.crit = { chance: 0, mult: 1.8 };
      if (regen) mods.stat.push({ t: type, stat: 'regenSelf', add: regen });
      if (Object.keys(patch).length) mods.patch.push({ t: type, patch });
    }
    return mods;
  };
})();
