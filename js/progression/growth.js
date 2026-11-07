// ─────────────────────────────────────────────
// 성장 시스템 3.0 — 레벨(숙련도) · 승급 · 전문화(특성) · 진화 · 장비 · 룬 · 자원
// 모든 효과는 스킬 트리와 같은 수정자(mods)로 변환되어 전투에 적용된다.
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  SW.RESOURCES = {
    gold: { name: '골드', icon: '💰' }, food: { name: '식량', icon: '🌾' }, wood: { name: '목재', icon: '🪵' },
    ore: { name: '광석', icon: '⛏️' }, mana: { name: '마나', icon: '🔮' }, crystal: { name: '수정', icon: '💎' },
  };
  SW.MAX_LEVEL = 10;
  SW.xpNeed = (lv) => Math.round(80 * Math.pow(lv, 1.55));          // lv → lv+1 필요 경험치

  // 전문화 (레벨 5에 선택)
  SW.SPECS = {
    offense: { name: '공격 특화', icon: '⚔️', desc: '공격력 +22%, 체력 -8%', fx: [['dmg', 'mul', 0.22], ['hp', 'mul', -0.08]] },
    defense: { name: '방어 특화', icon: '🛡️', desc: '체력 +25%, 방어력 +2, 이동 -8%', fx: [['hp', 'mul', 0.25], ['armor', 'add', 2], ['speed', 'mul', -0.08]] },
    agility: { name: '기동 특화', icon: '💨', desc: '이동 +18%, 공격 주기 -12%', fx: [['speed', 'mul', 0.18], ['atkCd', 'mul', -0.12]] },
  };

  // 진화 (레벨 10 + 수정) — 상위 직업으로 변경
  SW.EVOLUTIONS = {
    soldier: { name: '근위병', cost: 3, desc: '정예 근위병. 체력 +40%, 공격 +25%, 방어 +3', patch: { glyph: 'star' }, fx: [['hp', 'mul', 0.4], ['dmg', 'mul', 0.25], ['armor', 'add', 3]] },
    archer: { name: '명궁', cost: 3, desc: '사거리 +20%, 공격 +30%, 치명타 20%', patch: { crit: { chance: 0.2, mult: 2.2 } }, fx: [['range', 'mul', 0.2], ['dmg', 'mul', 0.3]] },
    shieldman: { name: '철벽 방패병', cost: 3, desc: '투사체 방어 80%, 체력 +40%', patch: { blockChance: 0.8 }, fx: [['hp', 'mul', 0.4]] },
    spearman: { name: '장창 근위', cost: 3, desc: '사거리 +12, 대형 특효 4배', patch: { bonusVsBig: 4 }, fx: [['range', 'add', 12], ['hp', 'mul', 0.2]] },
    mage: { name: '대마법사', cost: 4, desc: '범위 +40%, 공격 +35%', fx: [['splash', 'mul', 0.4], ['dmg', 'mul', 0.35]] },
    healer: { name: '성녀', cost: 4, desc: '치유 +80%, 주변 치유 파동', patch: { healPulse: { amt: 18, radius: 90, cd: 4 } }, fx: [['heal', 'mul', 0.8]] },
    scout: { name: '추적자', cost: 3, desc: '이동 +20%, 공격 +60%, 치명타 25%', patch: { crit: { chance: 0.25, mult: 2 } }, fx: [['speed', 'mul', 0.2], ['dmg', 'mul', 0.6]] },
    guardian: { name: '성채 수호자', cost: 4, desc: '체력 +50%, 도발 범위 +50%', fx: [['hp', 'mul', 0.5], ['taunt', 'mul', 0.5]] },
    cavalry: { name: '기사', cost: 4, desc: '체력 +40%, 돌격 피해 4배', patch: { charge: { mult: 4, speedMul: 1.4, minDist: 80, knock: 50 } }, fx: [['hp', 'mul', 0.4]] },
    assassin: { name: '그림자 군주', cost: 5, desc: '도약 후 첫 공격 5배, 도약 대기 3초', patch: { ambush: 5, leap: { range: 220, cd: 3 } }, fx: [['hp', 'mul', 0.3]] },
    swordsman: { name: '검성', cost: 4, desc: '공격 +35%, 치명타 25%, 후속 공격 +60%', patch: { crit: { chance: 0.25, mult: 2 }, followUp: 0.6 }, fx: [['dmg', 'mul', 0.35]] },
    golem: { name: '태고의 골렘', cost: 5, desc: '체력 +50%, 범위 +30%', fx: [['hp', 'mul', 0.5], ['splash', 'mul', 0.3]] },
  };

  // 장비: slot, 허용 분류(cls), 비용, 효과 / 등급(I~III)으로 강화
  const C_MELEE = ['front', 'tank', 'assassin'], C_RANGED = ['ranged'], C_CASTER = ['caster', 'support'], C_ALL = null;
  SW.ITEMS = {
    sword: { name: '강철 검', slot: 'weapon', icon: '🗡️', cls: C_MELEE, cost: { gold: 200, ore: 10 }, fx: [['dmg', 'mul', 0.12], ['atkCd', 'mul', -0.05]], desc: '공격력 +12%, 공격 속도 증가' },
    greatsword: { name: '대검', slot: 'weapon', icon: '⚔️', cls: C_MELEE, cost: { gold: 350, ore: 25 }, fx: [['dmg', 'mul', 0.25], ['atkCd', 'mul', 0.05]], desc: '공격력 +25%, 공격 속도 감소' },
    bow: { name: '합성궁', slot: 'weapon', icon: '🏹', cls: C_RANGED, cost: { gold: 200, wood: 15 }, fx: [['range', 'mul', 0.1], ['dmg', 'mul', 0.08]], desc: '사거리 +10%, 공격력 +8%' },
    longbow: { name: '장궁', slot: 'weapon', icon: '🎯', cls: C_RANGED, cost: { gold: 320, wood: 30 }, fx: [['range', 'mul', 0.2]], desc: '사거리 +20%' },
    staff: { name: '마력 지팡이', slot: 'weapon', icon: '🪄', cls: C_CASTER, cost: { gold: 250, mana: 15 }, fx: [['dmg', 'mul', 0.15], ['splash', 'mul', 0.1]], desc: '마법 피해 +15%, 범위 +10%' },
    orb: { name: '비전 보주', slot: 'weapon', icon: '🔮', cls: C_CASTER, cost: { gold: 350, mana: 30 }, fx: [['atkCd', 'mul', -0.12]], desc: '공격·시전 속도 +12%' },
    leather: { name: '가죽 갑옷', slot: 'armor', icon: '🦺', cls: C_ALL, cost: { gold: 150 }, fx: [['hp', 'mul', 0.12], ['speed', 'mul', 0.05]], desc: '체력 +12%, 이동 +5%' },
    chain: { name: '사슬 갑옷', slot: 'armor', icon: '⛓️', cls: C_ALL, cost: { gold: 250, ore: 20 }, fx: [['hp', 'mul', 0.15], ['armor', 'add', 2]], desc: '체력 +15%, 방어력 +2' },
    plate: { name: '판금 갑옷', slot: 'armor', icon: '🛡️', cls: ['front', 'tank'], cost: { gold: 400, ore: 40 }, fx: [['hp', 'mul', 0.25], ['armor', 'add', 4], ['speed', 'mul', -0.1]], desc: '체력 +25%, 방어 +4, 이동 -10%' },
    robe: { name: '마법사 로브', slot: 'armor', icon: '🥋', cls: C_CASTER, cost: { gold: 220, mana: 10 }, fx: [['hp', 'mul', 0.2], ['mres', 'add', 0.15]], desc: '체력 +20%, 마법 저항 15%' },
    towershield: { name: '탑 방패', slot: 'armor', icon: '🧱', cls: ['tank'], cost: { gold: 380, wood: 20, ore: 20 }, fx: [['blockChance', 'add', 0.25], ['armor', 'add', 3]], desc: '투사체 방어 +25%, 방어 +3' },
    boots: { name: '질풍 장화', slot: 'trinket', icon: '👢', cls: C_ALL, cost: { gold: 200 }, fx: [['speed', 'mul', 0.15]], desc: '이동 +15%' },
    amulet: { name: '활력의 부적', slot: 'trinket', icon: '📿', cls: C_ALL, cost: { gold: 250, crystal: 1 }, fx: [['regenAura', 'set', 2]], desc: '초당 체력 2 재생' },
    charm: { name: '치명 장신구', slot: 'trinket', icon: '💍', cls: C_ALL, cost: { gold: 300, crystal: 1 }, fx: [['crit.chance', 'add', 0.08]], desc: '치명타 +8%' },
    horn: { name: '전쟁 뿔피리', slot: 'trinket', icon: '📯', cls: C_ALL, cost: { gold: 250 }, fx: [['lifesteal', 'add', 0.06], ['dmg', 'mul', 0.05]], desc: '흡혈 6%, 공격 +5%' },
    r_fire: { name: '화염 룬', slot: 'rune', icon: '🔥', cls: C_ALL, cost: { mana: 25, crystal: 1 }, patch: { element: 'fire' }, fx: [], desc: '공격이 화염 속성 (화상)' },
    r_frost: { name: '냉기 룬', slot: 'rune', icon: '❄️', cls: C_ALL, cost: { mana: 25, crystal: 1 }, patch: { element: 'frost' }, fx: [], desc: '공격이 냉기 속성 (둔화)' },
    r_light: { name: '번개 룬', slot: 'rune', icon: '⚡', cls: C_ALL, cost: { mana: 25, crystal: 1 }, patch: { element: 'lightning' }, fx: [['dmg', 'mul', 0.05]], desc: '공격이 번개 속성 (빙결 대상 1.5배)' },
    r_poison: { name: '독 룬', slot: 'rune', icon: '☠️', cls: C_ALL, cost: { mana: 25, crystal: 1 }, patch: { element: 'poison' }, fx: [], desc: '공격이 독 속성 (회복 차단)' },
    r_dark: { name: '어둠 룬', slot: 'rune', icon: '🌑', cls: C_ALL, cost: { mana: 30, crystal: 2 }, patch: { element: 'dark' }, fx: [], desc: '공격이 어둠 속성 (흡혈·약화)' },
    r_holy: { name: '빛의 룬', slot: 'rune', icon: '✨', cls: C_ALL, cost: { mana: 30, crystal: 2 }, patch: {}, fx: [['regenAura', 'set', 3], ['mres', 'add', 0.1]], desc: '재생 +3, 마법 저항 10%' },
  };
  SW.SLOTS = { weapon: '무기', armor: '방어구', trinket: '장신구', rune: '룬' };
  SW.TIER_COST = [null, { gold: 0 }, { gold: 300, ore: 30, crystal: 1 }, { gold: 600, ore: 60, crystal: 3 }];
  SW.itemAllowed = (item, type) => !item.cls || item.cls.includes(SW.UNITS[type].cls);

  // ── 저장 데이터 접근 ──
  const G = () => {
    const d = SW.save.data;
    d.res = d.res || { food: 0, wood: 0, ore: 0, mana: 0, crystal: 0 };
    d.growth = d.growth || {};       // type → { xp, lv, spec, evo }
    d.items = d.items || {};         // itemId → tier
    d.equip = d.equip || {};         // type → { weapon, armor, trinket, rune }
    return d;
  };
  SW.growthOf = (type) => { const d = G(); return d.growth[type] || (d.growth[type] = { xp: 0, lv: 1, spec: null, evo: false }); };
  SW.canAfford = (cost) => { const d = G(); return Object.entries(cost).every(([k, v]) => (k === 'gold' ? d.gold : d.res[k] || 0) >= v); };
  SW.pay = (cost) => { const d = G(); if (!SW.canAfford(cost)) return false; for (const [k, v] of Object.entries(cost)) { if (k === 'gold') d.gold -= v; else d.res[k] -= v; } return true; };
  SW.gain = (res) => { const d = G(); for (const [k, v] of Object.entries(res)) { if (!v) continue; if (k === 'gold') d.gold += v; else d.res[k] = (d.res[k] || 0) + v; } };
  SW.costText = (cost) => Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `${SW.RESOURCES[k].icon}${v}`).join(' ');

  // ── 경험치 지급 (플레이어 전투 후) ──
  SW.awardXP = (battle, mult = 1) => {
    const rec = battle.rec[0], ups = [];
    for (const [type, r] of Object.entries(rec)) {
      const u = SW.UNITS[type];
      if (!u || u.summonOnly || u.boss || u.structure || type.startsWith('cu_')) continue;
      const g = SW.growthOf(type);
      if (g.lv >= SW.MAX_LEVEL) continue;
      // 실제 전투 행동 기반 경험치: 가한 피해 + 받아낸 피해 + 치유 + 처치
      let xp = (r.dealt * 0.08 + r.taken * 0.04 + r.healed * 0.08 + r.kills * 4 + r.casts * 2) * mult / Math.max(1, Math.sqrt(r.n) * 0.6);
      xp = Math.round(Math.min(xp, SW.xpNeed(g.lv) * 1.5));
      g.xp += xp;
      while (g.lv < SW.MAX_LEVEL && g.xp >= SW.xpNeed(g.lv)) { g.xp -= SW.xpNeed(g.lv); g.lv++; ups.push(`${u.name} Lv.${g.lv}`); }
    }
    return ups;
  };

  // ── 성장 → 수정자 변환 ──
  const toFx = (t, list) => list.map(([stat, op, v]) => op === 'mul' ? { t, stat, mul: v } : op === 'add' ? { t, stat, add: v } : { t, patch: setPath({}, stat, v) });
  const setPath = (o, p, v) => { const ks = p.split('.'); let x = o; ks.slice(0, -1).forEach(k => x = x[k] = x[k] || {}); x[ks[ks.length - 1]] = v; return o; };
  SW.growthMods = (mods) => {
    const d = G();
    for (const [type, g] of Object.entries(d.growth)) {
      if (!SW.UNITS[type]) continue;
      if (g.lv > 1) { mods.stat.push({ t: type, stat: 'hp', mul: 0.03 * (g.lv - 1) }); mods.stat.push({ t: type, stat: 'dmg', mul: 0.03 * (g.lv - 1) }); }
      if (g.lv >= 5) mods.stat.push({ t: type, stat: 'armor', add: g.lv >= 10 ? 2 : 1 });     // 승급
      if (g.spec && SW.SPECS[g.spec]) for (const f of toFx(type, SW.SPECS[g.spec].fx)) (f.patch ? mods.patch : mods.stat).push(f);
      if (g.evo && SW.EVOLUTIONS[type]) {
        const e = SW.EVOLUTIONS[type];
        mods.patch.push({ t: type, patch: { name: e.name, desc: e.desc + ' (진화)', evolved: true, ...(e.patch || {}) } });
        for (const f of toFx(type, e.fx)) (f.patch ? mods.patch : mods.stat).push(f);
      }
    }
    for (const [type, eq] of Object.entries(d.equip)) {
      if (!SW.UNITS[type]) continue;
      for (const id of Object.values(eq)) {
        const it = SW.ITEMS[id]; if (!it || !d.items[id]) continue;
        const tier = d.items[id], k = 1 + 0.5 * (tier - 1);
        for (const [stat, op, v] of it.fx) {
          if (stat === 'regenAura') mods.patch.push({ t: type, patch: { regenSelf: v * k } });
          else if (op === 'mul') mods.stat.push({ t: type, stat, mul: v * k });
          else if (op === 'add') mods.stat.push({ t: type, stat, add: v * k });
        }
        if (it.patch && Object.keys(it.patch).length) mods.patch.push({ t: type, patch: it.patch });
      }
    }
    return mods;
  };
})();
