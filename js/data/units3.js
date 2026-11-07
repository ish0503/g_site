// ─────────────────────────────────────────────
// 3.0 병과 확장 — 신규 직업 · 지휘관 · 공성 구조물 · 신규 기술
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  SW.FAMILIES.structure = { name: '구조물', title: '공성 구조물', shape: 'square', color: '#9a9a9a', desc: '파괴 가능한 성벽·성문·방어탑·성채.' };

  const U = {
    // 보병
    gladiator: { name: '검투사', family: 'circle', size: 10, pop: 2, hp: 170, armor: 2, dmg: 17, atkCd: 0.8, speed: 62,
      onHit: { bleed: { dps: 4, dur: 4 } }, glyph: 'x', accent: '#ff6b6b', role: 'melee', skill: 'arenaFury',
      desc: '공격마다 출혈을 남긴다. 출혈 중인 적은 움직이면 두 배 피해를 받는다.' },
    pikeman: { name: '기병 저지병', family: 'circle', size: 9, pop: 1, hp: 115, armor: 2, dmg: 11, atkCd: 1.1, range: 20, speed: 48,
      bonusVsBig: 1.8, antiCharge: 3, glyph: 'bar', accent: '#c8ff9a', role: 'lancer', skill: 'pinStrike',
      desc: '돌격병·기병·비행 돌격에 3배 피해. 찌른 적을 속박한다.' },
    // 중보병
    ironclad: { name: '철갑병', family: 'square', size: 13, pop: 3, hp: 420, armor: 12, mres: -0.25, dmg: 11, atkCd: 1.2, speed: 33,
      glyph: 'sq', accent: '#d0d8e8', role: 'protector', skill: 'ironWall',
      desc: '방어력 12의 철벽. 대신 마법 피해를 25% 더 받는다.' },
    paladin: { name: '성기사', family: 'square', size: 12, pop: 3, hp: 320, armor: 6, dmg: 18, atkCd: 1.0, speed: 46, element: 'light',
      lifesteal: 0.1, glyph: 'plus', accent: '#fff4b0', role: 'melee', skill: 'divineShield',
      desc: '빛의 기사. 궁극기로 주변 아군에게 2초 무적을 건다.' },
    siegeGolem: { name: '공성 골렘', family: 'square', size: 20, pop: 5, hp: 900, armor: 6, dmg: 45, atkCd: 2.2, speed: 24, splash: 30,
      vsStructure: 4, glyph: 'x', accent: '#ffcf8a', role: 'bruiser', skill: 'wallBreaker',
      desc: '구조물에 4배 피해. 성문과 성벽을 부수는 데 특화.' },
    // 원거리
    javelin: { name: '투창병', family: 'triangle', size: 9, pop: 1, hp: 85, armor: 1, dmg: 16, atkCd: 1.7, range: 140, speed: 55,
      attack: 'arrow', projSpeed: 520, glyph: 'chevron', accent: '#ffe0a0', role: 'ranged', skill: 'pinningJavelin',
      desc: '짧은 사거리, 묵직한 투창. 기술로 적을 땅에 고정한다.' },
    cannon: { name: '포병', family: 'triangle', size: 13, pop: 4, hp: 140, armor: 2, dmg: 60, atkCd: 5, range: 430, minRange: 110, speed: 20,
      attack: 'lob', projSpeed: 300, splash: 55, vsStructure: 2.5, glyph: 'dot', accent: '#9a9a9a', role: 'siege', skill: 'grapeshot',
      desc: '초장거리 포격. 구조물에 2.5배. 가까운 적에게는 산탄 사격.' },
    // 마법
    shaman: { name: '주술사', family: 'pentagon', size: 10, pop: 3, hp: 95, dmg: 10, atkCd: 1.6, range: 180, speed: 45,
      dmgType: 'magic', attack: 'bolt', projSpeed: 340, element: 'dark', keepDist: 120, glyph: 'skull', accent: '#c48aff', role: 'mage', skill: 'hex',
      desc: '저주술사. 적을 혼란(아군 공격)과 침묵(기술 봉인) 상태로 만든다.' },
    // 비행
    skyhunter: { name: '하늘 사냥꾼', family: 'diamond', size: 10, pop: 3, hp: 120, armor: 1, dmg: 12, atkCd: 0.9, range: 150, speed: 95,
      attack: 'arrow', projSpeed: 480, flying: true, antiAir: 2, glyph: 'chevron', accent: '#b0f0ff', role: 'flyer', skill: 'strafe',
      desc: '비행 궁수. 대공 2배. 지상 근접 유닛은 공격할 수 없다.' },
    // 특수
    dimensionMage: { name: '차원술사', family: 'star', size: 12, pop: 6, hp: 300, armor: 2, dmg: 20, atkCd: 1.5, range: 200, speed: 45,
      dmgType: 'magic', attack: 'bolt', projSpeed: 380, element: 'dark', keepDist: 140, glyph: 'ring', accent: '#7fd8ff', role: 'mage', skill: 'riftWalk',
      desc: '주변 아군을 적의 배후로 순간이동시키고 적을 속박한다.' },
    annihilator: { name: '소멸자', family: 'star', size: 12, pop: 7, hp: 380, armor: 3, dmg: 45, atkCd: 2.2, range: 240, speed: 50,
      dmgType: 'true', attack: 'arrow', projSpeed: 1400, targeting: 'backline', glyph: 'eye', accent: '#ff4d6d', role: 'sniper', skill: 'erase',
      desc: '방어를 무시하는 소멸 광선. 궁극기로 약해진 적을 지우고 주변을 침묵시킨다.' },
    // 지휘관 (전쟁·캠페인·AI 대전에서 등장)
    commander: { name: '지휘관', family: 'hexagon', size: 14, pop: 0, hp: 1600, armor: 8, dmg: 22, atkCd: 1.0, speed: 52, keepDist: 150,
      commander: true, summonOnly: true, aura: { radius: 200, ally: { dmg: 0.1 } }, glyph: 'star', accent: '#ffe066', role: 'hero',
      desc: '군대의 지휘관. 주변 아군 사기와 공격력 상승. 전사하면 사기 급락, 명령 효율 50%.' },
    // 공성 구조물
    wall: { name: '성벽', family: 'structure', size: 14, pop: 0, hp: 1000, armor: 10, dmg: 0, attack: 'none', speed: 0, immobile: true,
      structure: true, summonOnly: true, glyph: 'none', accent: '#888', role: 'none', desc: '파괴 가능한 성벽.' },
    gate: { name: '성문', family: 'structure', size: 15, pop: 0, hp: 600, armor: 6, dmg: 0, attack: 'none', speed: 0, immobile: true,
      structure: true, summonOnly: true, glyph: 'bar', accent: '#c89a5a', role: 'none', desc: '성벽보다 약하다. 공격군의 1순위 목표.' },
    tower: { name: '방어탑', family: 'structure', size: 16, pop: 0, hp: 1000, armor: 8, dmg: 12, atkCd: 0.7, range: 250, speed: 0, immobile: true,
      attack: 'arrow', projSpeed: 520, antiAir: 1.5, structure: true, summonOnly: true, glyph: 'dot', accent: '#ffd36b', role: 'siege', desc: '화살을 쏘는 방어탑.' },
    keep: { name: '성채', family: 'structure', size: 30, pop: 0, hp: 6000, armor: 10, dmg: 22, atkCd: 0.6, range: 270, speed: 0, immobile: true,
      attack: 'arrow', projSpeed: 520, structure: true, keep: true, summonOnly: true, glyph: 'star', accent: '#ffd36b', role: 'siege', desc: '요새의 심장. 함락되면 공성전 패배.' },
  };
  for (const [id, u] of Object.entries(U)) { SW.UNITS[id] = u; SW.normalizeUnit(id, u); }
  for (const id of ['wall', 'gate', 'tower', 'keep']) { SW.UNITS[id].cls = 'tank'; }
  SW.UNITS.commander.cls = 'support';

  // ── 신규 기술 ──
  Object.assign(SW.ABILITIES, {
    arenaFury: { name: '투기장의 분노', kind: 'active', cd: 8, cond: 'enemiesNear:50:2',
      fx: [{ op: 'cone', range: 48, angle: 130, mult: 1.4 }, { op: 'status', at: 'enemies', radius: 55, st: { bleed: [6, 4] } }], desc: '전방을 베고 주변 적 모두에게 강한 출혈.' },
    pinStrike: { name: '창 고정', kind: 'active', cd: 7, cond: 'targetInReach',
      fx: [{ op: 'strike', mult: 1.5 }, { op: 'status', at: 'target', st: { root: 1.8 } }], desc: '1.5배 찌르기 + 1.8초 속박.' },
    ironWall: { name: '철벽 대형', kind: 'active', cd: 12, cond: 'enemiesNear:200:3',
      fx: [{ op: 'buffAllies', radius: 100, dur: 4, mods: { armor: 4, projTaken: -0.2 }, color: '#d0d8e8' }], desc: '주변 아군 방어력 +4, 투사체 피해 -20% (4초).' },
    divineShield: { name: '신성한 방패', kind: 'ultimate', cd: 22, cond: 'alliesHurt:110:3',
      fx: [{ op: 'status', at: 'allies', radius: 110, st: { inv: 2 } }], desc: '주변 아군 2초 무적.' },
    wallBreaker: { name: '성벽 파쇄', kind: 'active', cd: 9, cond: 'targetInReach',
      fx: [{ op: 'strike', mult: 3, knock: 40 }], desc: '3배 일격 (구조물에는 공성 배율까지 적용).' },
    pinningJavelin: { name: '고정 투창', kind: 'active', cd: 9, cond: 'targetInRange',
      fx: [{ op: 'shotStatus', mult: 2, st: { root: 2 } }], desc: '2배 투창 + 2초 속박.' },
    grapeshot: { name: '산탄 사격', kind: 'active', cd: 10, cond: 'enemiesNear:170:3',
      fx: [{ op: 'cone', range: 170, angle: 60, mult: 0.6 }], desc: '가까운 적에게 부채꼴 산탄.' },
    hex: { name: '저주', kind: 'active', cd: 12, cond: 'clusterAtTarget:70:2',
      fx: [{ op: 'status', at: 'targetArea', radius: 70, st: { conf: 3, sil: 4 } }], desc: '대상 주변 적 혼란 3초 + 침묵 4초.' },
    strafe: { name: '기총 사격', kind: 'active', cd: 8, cond: 'targetInRange',
      fx: [{ op: 'multiTarget', count: 6, mult: 1 }], desc: '사거리 안의 적 6명을 동시에 사격.' },
    riftWalk: { name: '차원 도약', kind: 'ultimate', cd: 18, cond: 'targetInRange',
      fx: [{ op: 'blinkAllies', count: 8, radius: 160 }, { op: 'status', at: 'targetArea', radius: 70, st: { root: 1.5 } }], desc: '주변 아군 8명을 적 배후로 순간이동, 적 속박.' },
    erase: { name: '소멸', kind: 'ultimate', cd: 16, cond: 'targetInRange',
      fx: [{ op: 'execute', threshold: 0.45, poisonThreshold: 0.6, mult: 2 }, { op: 'status', at: 'targetArea', radius: 100, st: { sil: 3 } }], desc: '체력 45% 이하의 적을 소멸, 주변 적 침묵.' },
  });
  for (const id of ['arenaFury', 'pinStrike', 'ironWall', 'divineShield', 'wallBreaker', 'pinningJavelin', 'grapeshot', 'hex', 'strafe', 'riftWalk', 'erase']) SW.ABILITIES[id].id = id;

  // ── 신규 효과 원시 동작 ──
  const OPS = SW.ABILITY_OPS;
  const applySt = (b, e, st) => {
    if (!e.alive || e.def.structure) return;
    const boss = e.def.boss;
    for (const [k, v] of Object.entries(st)) {
      if (k === 'bleed') { e.bleedT = Math.max(e.bleedT, v[1]); e.bleedDps = Math.max(e.bleedDps, v[0]); }
      else if (boss && (k === 'root' || k === 'conf' || k === 'fear')) continue;
      else if (k === 'root') e.rootT = Math.max(e.rootT, v);
      else if (k === 'conf') e.confT = Math.max(e.confT, v);
      else if (k === 'sil') e.silT = Math.max(e.silT, v);
      else if (k === 'fear') e.fearT = Math.max(e.fearT, v);
      else if (k === 'inv') e.invT = Math.max(e.invT, v);
      else if (k === 'shock') e.shockT = Math.max(e.shockT, v);
    }
  };
  SW.applyStatus = applySt;
  OPS.status = (b, u, f) => {
    const t = u.target;
    if (f.at === 'target') { if (!t || !t.alive) return false; applySt(b, t, f.st); return true; }
    if (f.at === 'self') { applySt(b, u, f.st); return true; }
    if (f.at === 'allies') { b.alliesIn(u.x, u.y, f.radius, u.team, (o) => applySt(b, o, f.st)); b.addFx({ kind: 'ring', x: u.x, y: u.y, r: f.radius, color: '#fff4b0', T: 0.7 }); return true; }
    const cx = f.at === 'targetArea' && t ? t.x : u.x, cy = f.at === 'targetArea' && t ? t.y : u.y;
    let n = 0; b.enemiesIn(cx, cy, f.radius, u.team, (e) => { applySt(b, e, f.st); n++; });
    b.addFx({ kind: 'shock', x: cx, y: cy, r: f.radius, color: u.def.accent, T: 0.5 });
    return n > 0;
  };
  OPS.shotStatus = (b, u, f) => {
    const t = u.target; if (!t || !t.alive) return false;
    b.fireProj(u, t, u.def.dmg * f.mult);
    SW.simDelay(b, 0.3, () => { if (t.alive) applySt(b, t, f.st); });
    return true;
  };
  OPS.blinkAllies = (b, u, f) => {
    const t = u.target; if (!t) return false;
    const list = []; b.alliesIn(u.x, u.y, f.radius, u.team, (o) => { if (o !== u && !o.def.immobile && !o.def.structure && !o.def.boss) list.push(o); });
    const back = Math.atan2(t.y - u.y, t.x - u.x);
    list.slice(0, f.count).forEach((o, i) => {
      const a = back + (i - f.count / 2) * 0.25, ox = o.x, oy = o.y;
      o.x = SW.util.clamp(t.x + Math.cos(a) * 60, o.r, b.W - o.r); o.y = SW.util.clamp(t.y + Math.sin(a) * 60, o.r, b.H - o.r);
      b.addFx({ kind: 'dash', x: ox, y: oy, x2: o.x, y2: o.y, color: '#7fd8ff', T: 0.4 });
    });
    return list.length > 0;
  };
  OPS.cross = (b, u, f) => {      // 십자형 범위
    const t = u.target; if (!t) return false;
    const w = f.width || 22, L = f.length || 140, dmg = u.def.dmg * (f.mult || 1);
    b.enemiesIn(t.x, t.y, L, u.team, (e) => { if (Math.abs(e.x - t.x) < w || Math.abs(e.y - t.y) < w) b.hit(u, e, dmg, { splash: true, element: f.element }); });
    b.addFx({ kind: 'cross', x: t.x, y: t.y, r: L, w, color: u.def.accent, T: 0.4 });
    return true;
  };

  // 출혈·대돌격 처리: hit 확장
  const P = SW.Battle.prototype;
  const origHit = P.hit;
  P.hit = function (src, t, dmg, opt) {
    const d = src && src.def;
    if (d && d.antiCharge && (t.charging || t.def.role === 'charger' || (t.def.flying && t.def.range <= 40))) dmg *= d.antiCharge;
    origHit.call(this, src, t, dmg, opt);
    if (d && d.onHit && d.onHit.bleed && t.alive && !t.def.structure) { t.bleedT = Math.max(t.bleedT || 0, d.onHit.bleed.dur); t.bleedDps = Math.max(t.bleedDps || 0, d.onHit.bleed.dps); }
  };

  // ── 스킬 트리 노드 ──
  const N = (id, name, cost, req, x, y, fx, desc) => ({ id, name, cost, req, x, y, fx, desc: desc || '', stage: 0 });
  const add = (fam, nodes) => { for (const n of nodes) { n.family = fam; SW.SKILL_TREES[fam].push(n); SW.SKILL_INDEX[n.id] = n; } };
  add('circle', [
    N('c_glad', '투기장', 450, ['c_sword'], 2, 5, [{ unlock: 'gladiator' }]),
    N('c_pike', '기병 저지 훈련', 300, ['c_spear2'], 0, 5, [{ unlock: 'pikeman' }]),
  ]);
  add('square', [
    N('s_iron', '철갑 단련', 500, ['s_bulwark'], 0.5, 5, [{ unlock: 'ironclad' }]),
    N('s_paladin', '성기사단', 700, ['s_taunt'], 1.6, 5, [{ unlock: 'paladin' }]),
    N('s_sgolem', '공성 골렘 제작', 700, ['s_golem2'], 4.5, 4, [{ unlock: 'siegeGolem' }]),
  ]);
  add('triangle', [
    N('t_jav', '투창술', 200, ['t_dmg1'], 0, 1, [{ unlock: 'javelin' }]),
    N('t_cannon', '화약 포병', 800, ['t_siege2'], 3, 5, [{ unlock: 'cannon' }]),
  ]);
  add('pentagon', [N('p_shaman', '주술', 550, ['p_necro'], 4, 5, [{ unlock: 'shaman' }])]);
  add('diamond', [N('d_sky', '하늘 사냥', 700, ['d_harpy'], 1, 4.9, [{ unlock: 'skyhunter' }])]);
  add('star', [
    N('st_dim', '차원 개방', 2000, ['st_void'], 0, 3, [{ unlock: 'dimensionMage' }]),
    N('st_anni', '소멸의 의식', 2400, ['st_colossus'], 4, 3, [{ unlock: 'annihilator' }]),
  ]);
  // 기존 공성 유닛의 구조물 특효
  SW.UNITS.ram.vsStructure = 3; SW.UNITS.catapult.vsStructure = 2.2; SW.UNITS.ballista.vsStructure = 1.6; SW.UNITS.golem.vsStructure = 1.8;
  // 공성전 전용: 공성 유닛 표시
  SW.SIEGE_UNITS = ['ram', 'catapult', 'cannon', 'siegeGolem', 'ballista'];
})();
