// 유닛 데이터 정의
// 모든 유닛은 기하학 도형으로 표현되며, 같은 도형 = 같은 계열(스킬트리)입니다.
window.SW = window.SW || {};

SW.FAMILIES = {
  circle:   { name: '원',     title: '보병 계열',   shape: 'circle',   color: '#8fd3ff', desc: '균형 잡힌 근접 보병. 숫자로 밀어붙이고, 치유로 버틴다.' },
  triangle: { name: '삼각형', title: '사수 계열',   shape: 'triangle', color: '#ffd36b', desc: '원거리 물리 공격. 화살, 독, 공성병기.' },
  square:   { name: '사각형', title: '중장 계열',   shape: 'square',   color: '#c9c9c9', desc: '높은 체력과 방어력. 도발, 반사, 돌진.' },
  diamond:  { name: '마름모', title: '기동 계열',   shape: 'diamond',  color: '#9dff9d', desc: '빠르고 치명적. 암살, 은신, 자폭, 비행.' },
  pentagon: { name: '오각형', title: '마법 계열',   shape: 'pentagon', color: '#d59bff', desc: '방어력을 무시하는 마법 피해. 범위, 연쇄, 소환.' },
  hexagon:  { name: '육각형', title: '지원 계열',   shape: 'hexagon',  color: '#7ff0d8', desc: '오라와 보호막으로 아군을 강화하고 적을 약화.' },
  star:     { name: '별',     title: '전설 계열',   shape: 'star',     color: '#ffb347', desc: '전장을 뒤흔드는 전설의 존재들.' },
};

SW.FAMILY_ORDER = ['circle', 'triangle', 'square', 'diamond', 'pentagon', 'hexagon', 'star'];

// 공통 기본값
SW.UNIT_DEFAULTS = {
  size: 9, pop: 1, hp: 100, armor: 0, dmg: 10, atkCd: 1, range: 0, speed: 50,
  dmgType: 'phys', attack: 'melee', projSpeed: 400, splash: 0,
  glyph: 'none', accent: '#ffffff',
};

SW.UNITS = {
  // ───────────── 원 : 보병 ─────────────
  soldier: {
    name: '병사', family: 'circle', size: 9, pop: 1, hp: 100, armor: 1, dmg: 11, atkCd: 0.9, speed: 55,
    glyph: 'none', desc: '가장 기본적인 보병. 싸고 믿음직하다.',
  },
  spearman: {
    name: '창병', family: 'circle', size: 9, pop: 1, hp: 90, armor: 1, dmg: 10, atkCd: 1.0, range: 16, speed: 52,
    bonusVsBig: 2.5, glyph: 'bar', accent: '#ffe27a',
    desc: '긴 창으로 조금 떨어져서 찌른다. 거대한 적(골렘, 기병 등)에게 2.5배 피해.',
  },
  shieldman: {
    name: '방패병', family: 'circle', size: 11, pop: 2, hp: 240, armor: 5, dmg: 8, atkCd: 1.1, speed: 40,
    blockChance: 0.5, glyph: 'ring', accent: '#e6e6e6',
    desc: '큰 방패로 투사체의 50%를 막아낸다 (막으면 피해 85% 감소).',
  },
  berserker: {
    name: '광전사', family: 'circle', size: 10, pop: 2, hp: 150, armor: 0, dmg: 15, atkCd: 0.8, speed: 65,
    rage: true, lifesteal: 0.15, glyph: 'x', accent: '#ff9b9b',
    desc: '체력이 낮을수록 공격 속도가 최대 2.5배까지 빨라진다. 피해량 일부를 흡혈.',
  },
  healer: {
    name: '치유사', family: 'circle', size: 8, pop: 2, hp: 70, dmg: 0, atkCd: 1.0, range: 100, speed: 50,
    attack: 'heal', heal: 14, glyph: 'plus', accent: '#7dff8a',
    desc: '가장 체력 비율이 낮은 아군을 치유한다. 직접 공격하지 않는다.',
  },
  martyr: {
    name: '순교자', family: 'circle', size: 9, pop: 1, hp: 110, armor: 1, dmg: 9, atkCd: 1.0, speed: 55,
    onDeath: { heal: { radius: 90, amt: 70 } }, glyph: 'dot', accent: '#ffe066',
    desc: '쓰러질 때 주변 아군의 체력을 70 회복시킨다.',
  },

  // ───────────── 삼각형 : 사수 ─────────────
  archer: {
    name: '궁수', family: 'triangle', size: 9, pop: 1, hp: 60, dmg: 9, atkCd: 1.2, range: 190, speed: 50,
    attack: 'arrow', projSpeed: 420, antiAir: 1.5, glyph: 'dot', accent: '#fff3b0',
    desc: '기본 원거리 유닛. 비행 유닛에게 1.5배 피해.',
  },
  crossbow: {
    name: '연사수', family: 'triangle', size: 9, pop: 1, hp: 65, dmg: 4, atkCd: 0.35, range: 150, speed: 50,
    attack: 'arrow', projSpeed: 480, antiAir: 1.3, glyph: 'double', accent: '#fff3b0',
    desc: '약한 화살을 매우 빠르게 연사한다. 방어력이 높은 적에게 약하다.',
  },
  sniper: {
    name: '저격수', family: 'triangle', size: 9, pop: 2, hp: 50, dmg: 55, atkCd: 3.2, range: 340, speed: 48,
    attack: 'arrow', projSpeed: 1000, kite: true, targeting: 'strongest', glyph: 'eye', accent: '#ff6b6b',
    desc: '매우 먼 사거리에서 가장 강한 적을 노린다. 적이 다가오면 물러선다.',
  },
  poisoner: {
    name: '독침수', family: 'triangle', size: 8, pop: 1, hp: 55, dmg: 3, atkCd: 1.0, range: 160, speed: 52,
    attack: 'arrow', projSpeed: 420, onHit: { poison: { dps: 4, dur: 5, max: 5 } }, glyph: 'dot', accent: '#8cff5a',
    desc: '독침은 최대 5중첩되는 독을 남긴다. 독은 방어력을 무시한다.',
  },
  catapult: {
    name: '투석기', family: 'triangle', size: 13, pop: 3, hp: 120, armor: 1, dmg: 35, atkCd: 4, range: 380, minRange: 90, speed: 22,
    attack: 'lob', projSpeed: 260, splash: 45, glyph: 'sq', accent: '#d9a66b',
    desc: '돌을 던져 넓은 범위에 피해. 최소 사거리가 있어 가까운 적은 못 맞힌다.',
  },
  ballista: {
    name: '발리스타', family: 'triangle', size: 13, pop: 3, hp: 140, armor: 2, dmg: 40, atkCd: 2.8, range: 300, speed: 22,
    attack: 'pierce', projSpeed: 700, glyph: 'bar', accent: '#d9a66b',
    desc: '거대한 볼트가 일직선상의 모든 적을 관통한다.',
  },

  // ───────────── 사각형 : 중장 ─────────────
  guardian: {
    name: '수호병', family: 'square', size: 13, pop: 3, hp: 450, armor: 7, dmg: 10, atkCd: 1.2, speed: 35,
    taunt: 90, glyph: 'ring', accent: '#ffd36b',
    desc: '주변 적들이 자신만 공격하도록 도발한다. 엄청난 방어력.',
  },
  ram: {
    name: '돌격병', family: 'square', size: 12, pop: 2, hp: 220, armor: 3, dmg: 14, atkCd: 1.2, speed: 45,
    charge: { mult: 3.5, speedMul: 2.8, minDist: 70, knock: 70 }, glyph: 'chevron', accent: '#ffb38a',
    desc: '멀리 있는 적에게 돌진해 3.5배 피해를 주고 밀쳐낸다.',
  },
  golem: {
    name: '골렘', family: 'square', size: 22, pop: 5, hp: 1000, armor: 4, dmg: 32, atkCd: 2.0, speed: 25,
    splash: 40, glyph: 'x', accent: '#b0a089',
    desc: '거대한 바위 거인. 내려찍기로 주변 적 모두에게 피해.',
  },
  mirror: {
    name: '반사병', family: 'square', size: 12, pop: 2, hp: 260, armor: 3, dmg: 9, atkCd: 1.0, speed: 38,
    reflectProj: 0.6, glyph: 'sq', accent: '#e8f6ff',
    desc: '투사체·마법 피해의 60%를 공격자에게 되돌려준다.',
  },
  thorn: {
    name: '가시갑병', family: 'square', size: 12, pop: 2, hp: 280, armor: 4, dmg: 9, atkCd: 1.0, speed: 38,
    thorns: 0.5, glyph: 'star', accent: '#a8ff8a',
    desc: '근접 공격을 받으면 피해의 50%를 되돌려준다.',
  },
  fortress: {
    name: '요새', family: 'square', size: 26, pop: 6, hp: 1600, armor: 8, dmg: 13, atkCd: 0.45, range: 230, speed: 0,
    attack: 'arrow', projSpeed: 500, immobile: true, antiAir: 1.3, glyph: 'sq', accent: '#ffd36b',
    desc: '움직이지 않는 거대한 방어탑. 사방으로 화살을 쏟아낸다.',
  },

  // ───────────── 마름모 : 기동 ─────────────
  scout: {
    name: '척후병', family: 'diamond', size: 8, pop: 1, hp: 65, dmg: 7, atkCd: 0.55, speed: 120,
    glyph: 'dot', accent: '#eaffea',
    desc: '매우 빠른 경보병. 적의 후방을 교란한다.',
  },
  assassin: {
    name: '암살자', family: 'diamond', size: 9, pop: 2, hp: 85, dmg: 22, atkCd: 1.0, speed: 95,
    targeting: 'backline', leap: { range: 170, cd: 6 }, ambush: 3, glyph: 'x', accent: '#ff7070',
    desc: '후방의 원거리·지원 유닛을 노린다. 도약 후 첫 공격은 3배 피해.',
  },
  phantom: {
    name: '유령', family: 'diamond', size: 9, pop: 2, hp: 80, dmg: 16, atkCd: 0.9, speed: 80,
    stealth: { reveal: 2 }, ambush: 2.5, glyph: 'eye', accent: '#c8c8ff',
    desc: '은신 상태로 공격받지 않는다. 공격하면 2초간 모습을 드러낸다. 은신 중 첫 공격 2.5배.',
  },
  bomber: {
    name: '자폭병', family: 'diamond', size: 9, pop: 1, hp: 50, dmg: 90, atkCd: 1, speed: 85,
    attack: 'explode', splash: 60, glyph: 'star', accent: '#ffa040',
    desc: '적에게 달려가 폭발한다. 도착 전에 처치하면 폭발하지 않는다.',
  },
  bladedancer: {
    name: '칼춤꾼', family: 'diamond', size: 9, pop: 2, hp: 120, armor: 1, dmg: 9, atkCd: 0.5, speed: 70,
    attack: 'spin', splash: 30, glyph: 'x', accent: '#9ff7ff',
    desc: '회전 베기로 주변의 모든 적을 동시에 공격한다.',
  },
  cavalry: {
    name: '기병', family: 'diamond', size: 12, pop: 3, hp: 230, armor: 3, dmg: 16, atkCd: 1.0, speed: 110,
    charge: { mult: 2.5, speedMul: 1.3, minDist: 80, knock: 35 }, glyph: 'chevron', accent: '#fff0b0',
    desc: '빠르고 튼튼한 기마병. 돌격 시 2.5배 피해.',
  },
  harpy: {
    name: '하피', family: 'diamond', size: 9, pop: 2, hp: 70, dmg: 9, atkCd: 0.7, speed: 100,
    flying: true, glyph: 'chevron', accent: '#ffd0ff',
    desc: '비행 유닛. 지상 근접 유닛은 하피를 공격할 수 없다.',
  },

  // ───────────── 오각형 : 마법 ─────────────
  mage: {
    name: '마법사', family: 'pentagon', size: 10, pop: 2, hp: 75, dmg: 18, atkCd: 1.8, range: 190, speed: 45,
    dmgType: 'magic', attack: 'fireball', projSpeed: 300, splash: 32, glyph: 'dot', accent: '#ffae5c',
    desc: '화염구로 범위 마법 피해. 방어력을 무시한다.',
  },
  storm: {
    name: '뇌전술사', family: 'pentagon', size: 10, pop: 2, hp: 70, dmg: 18, atkCd: 2.0, range: 180, speed: 45,
    dmgType: 'magic', attack: 'chain', chain: { count: 4, jump: 90 }, glyph: 'bolt', accent: '#fff36b',
    desc: '번개가 최대 4명의 적에게 연쇄된다.',
  },
  frost: {
    name: '냉기술사', family: 'pentagon', size: 10, pop: 2, hp: 75, dmg: 8, atkCd: 1.5, range: 180, speed: 45,
    dmgType: 'magic', attack: 'bolt', projSpeed: 350, splash: 25,
    onHit: { slow: { amt: 0.5, dur: 2.5 }, freezeChance: 0.1, freezeDur: 1.5 }, glyph: 'flake', accent: '#bdf3ff',
    desc: '냉기 탄환이 적을 50% 둔화시키고, 10% 확률로 빙결시킨다.',
  },
  summoner: {
    name: '소환사', family: 'pentagon', size: 10, pop: 3, hp: 90, dmg: 6, atkCd: 1.5, range: 160, speed: 45,
    dmgType: 'magic', attack: 'bolt', projSpeed: 350, keepDist: 120,
    summon: { unit: 'wisp', count: 2, cd: 6, max: 8 }, glyph: 'ring', accent: '#e2b8ff',
    desc: '6초마다 정령 2기를 소환한다 (최대 8기).',
  },
  necromancer: {
    name: '강령술사', family: 'pentagon', size: 10, pop: 3, hp: 90, dmg: 8, atkCd: 1.5, range: 170, speed: 45,
    dmgType: 'magic', attack: 'bolt', projSpeed: 350, keepDist: 120,
    raiseDead: { radius: 180, max: 12 }, glyph: 'skull', accent: '#d7ffd0',
    desc: '근처에서 쓰러진 적을 해골병으로 되살려 아군으로 만든다 (최대 12).',
  },
  meteor: {
    name: '운석술사', family: 'pentagon', size: 11, pop: 4, hp: 80, dmg: 90, atkCd: 7, range: 360, speed: 40,
    dmgType: 'magic', attack: 'meteor', splash: 75, keepDist: 160, glyph: 'star', accent: '#ff7a3d',
    desc: '적 밀집 지역에 거대한 운석을 떨어뜨린다. 시전 후 1.2초 뒤 착탄.',
  },

  // ───────────── 육각형 : 지원 ─────────────
  drummer: {
    name: '전고수', family: 'hexagon', size: 10, pop: 2, hp: 90, dmg: 5, atkCd: 1.0, speed: 50, keepDist: 70,
    aura: { radius: 110, ally: { atkSpd: 0.35 } }, glyph: 'double', accent: '#ffe27a',
    desc: '북소리로 주변 아군의 공격 속도를 35% 높인다.',
  },
  banner: {
    name: '기수', family: 'hexagon', size: 10, pop: 2, hp: 100, dmg: 5, atkCd: 1.0, speed: 50, keepDist: 70,
    aura: { radius: 110, ally: { dmg: 0.3, armor: 2 } }, glyph: 'bar', accent: '#ff8a8a',
    desc: '군기를 휘날려 주변 아군의 공격력 30%, 방어력 2 증가.',
  },
  shielder: {
    name: '방벽술사', family: 'hexagon', size: 10, pop: 2, hp: 85, dmg: 4, atkCd: 1.0, speed: 50, keepDist: 90,
    shieldGive: { amt: 45, count: 4, radius: 130, cd: 5 }, glyph: 'ring', accent: '#8ad8ff',
    desc: '5초마다 주변 아군 4명에게 45의 보호막을 씌운다.',
  },
  priest: {
    name: '대사제', family: 'hexagon', size: 11, pop: 3, hp: 110, dmg: 4, atkCd: 1.0, speed: 48, keepDist: 90,
    healPulse: { amt: 22, radius: 100, cd: 3 }, glyph: 'plus', accent: '#fffbd0',
    desc: '3초마다 주변 모든 아군의 체력을 22 회복시킨다.',
  },
  chrono: {
    name: '시간술사', family: 'hexagon', size: 11, pop: 3, hp: 95, dmg: 4, atkCd: 1.0, speed: 48, keepDist: 80,
    aura: { radius: 120, enemy: { slow: 0.35, atkSlow: 0.25 } }, glyph: 'wave', accent: '#c9a8ff',
    desc: '주변 적의 이동속도 35%, 공격속도 25% 감소.',
  },
  engineer: {
    name: '공병', family: 'hexagon', size: 10, pop: 2, hp: 90, dmg: 6, atkCd: 1.0, speed: 50, keepDist: 110,
    summon: { unit: 'turret', count: 1, cd: 7, max: 2 }, glyph: 'sq', accent: '#ffcf8a',
    desc: '7초마다 포탑을 설치한다 (최대 2개).',
  },

  // ───────────── 별 : 전설 ─────────────
  hero: {
    name: '영웅', family: 'star', size: 16, pop: 8, hp: 1600, armor: 6, dmg: 40, atkCd: 1.0, speed: 55,
    splash: 30, lifesteal: 0.1, revive: { hpPct: 0.5 }, aura: { radius: 100, ally: { armor: 3 } },
    glyph: 'dot', accent: '#fff4a0',
    desc: '광역 베기와 흡혈, 주변 아군 방어력 +3. 한 번 쓰러져도 체력 50%로 부활한다.',
  },
  phoenix: {
    name: '불사조', family: 'star', size: 14, pop: 7, hp: 500, armor: 2, dmg: 16, atkCd: 0.6, speed: 85,
    dmgType: 'magic', attack: 'spin', splash: 36, flying: true, onHit: { burn: { dps: 8, dur: 3 } }, rebirth: true,
    glyph: 'tri', accent: '#ffcc33',
    desc: '비행. 주변을 불태운다. 죽으면 알이 되며, 알이 5초 버티면 다시 태어난다.',
  },
  voidcaller: {
    name: '공허술사', family: 'star', size: 13, pop: 7, hp: 420, armor: 2, dmg: 14, atkCd: 1.2, range: 210, speed: 42,
    dmgType: 'magic', attack: 'bolt', projSpeed: 380, keepDist: 150,
    vortex: { radius: 110, cd: 7, dur: 3, pull: 90, dps: 20 }, glyph: 'ring', accent: '#c07bff',
    desc: '7초마다 공허 소용돌이를 만들어 적을 한곳에 끌어모으고 피해를 준다.',
  },
  colossus: {
    name: '거신', family: 'star', size: 28, pop: 10, hp: 3200, armor: 8, dmg: 60, atkCd: 2.5, speed: 20,
    splash: 60, onHit: { stunChance: 0.5, stunDur: 1.2 }, glyph: 'x', accent: '#ffe0a0',
    desc: '땅을 내려찍어 넓은 범위에 피해를 주고 50% 확률로 기절시킨다.',
  },

  // ───────────── 소환물 (직접 배치 불가 / 샌드박스 배치 가능) ─────────────
  wisp: {
    name: '정령', family: 'pentagon', size: 6, pop: 0, hp: 35, dmg: 5, atkCd: 0.6, speed: 95,
    dmgType: 'magic', lifetime: 25, summonOnly: true, glyph: 'dot', accent: '#f0d0ff',
    desc: '소환사가 부르는 작은 정령. 25초 후 사라진다.',
  },
  skeleton: {
    name: '해골병', family: 'circle', size: 8, pop: 0, hp: 60, armor: 1, dmg: 8, atkCd: 1.0, speed: 50,
    summonOnly: true, glyph: 'skull', accent: '#f0f0e0',
    desc: '강령술사가 되살린 해골 병사.',
  },
  turret: {
    name: '포탑', family: 'hexagon', size: 9, pop: 0, hp: 160, armor: 3, dmg: 8, atkCd: 0.6, range: 180, speed: 0,
    attack: 'arrow', projSpeed: 450, immobile: true, lifetime: 30, summonOnly: true, glyph: 'dot', accent: '#ffcf8a',
    desc: '공병이 세우는 자동 포탑. 30초 유지.',
  },
  egg: {
    name: '불사조 알', family: 'star', size: 10, pop: 0, hp: 250, armor: 4, dmg: 0, speed: 0, attack: 'none',
    immobile: true, hatch: { t: 5, into: 'phoenix' }, summonOnly: true, glyph: 'dot', accent: '#ffcc33',
    desc: '5초 동안 살아남으면 불사조로 부활한다.',
  },
};

// 기본값 채우기 및 id 지정
for (const [id, u] of Object.entries(SW.UNITS)) {
  for (const [k, v] of Object.entries(SW.UNIT_DEFAULTS)) if (u[k] === undefined) u[k] = v;
  u.id = id;
  u.shape = SW.FAMILIES[u.family].shape;
  if (u.canHitAir === undefined) u.canHitAir = !!(u.flying || u.range > 40 || u.attack !== 'melee' && u.attack !== 'explode');
  if (u.attack === 'spin' && !u.flying) u.canHitAir = false;
  if (u.attack === 'lob') u.canHitAir = false;
  u.support = !!(u.keepDist || u.attack === 'heal');
}

SW.unitList = (includeSummons) =>
  Object.values(SW.UNITS).filter(u => includeSummons || !u.summonOnly)
    .sort((a, b) => SW.FAMILY_ORDER.indexOf(a.family) - SW.FAMILY_ORDER.indexOf(b.family));

// 특성 태그 (UI 표시용)
SW.unitTraits = (u) => {
  const t = [];
  if (u.flying) t.push('비행');
  if (u.dmgType === 'magic') t.push('마법 피해');
  if (u.canHitAir && !u.flying && u.attack !== 'heal' && u.attack !== 'none') t.push('대공 가능');
  if (u.antiAir) t.push(`대공 ×${u.antiAir}`);
  if (u.splash && u.attack !== 'explode') t.push('범위 피해');
  if (u.attack === 'pierce') t.push('관통');
  if (u.attack === 'chain') t.push('연쇄');
  if (u.attack === 'lob') t.push('곡사');
  if (u.minRange) t.push('최소 사거리');
  if (u.onHit?.burn) t.push('화상');
  if (u.onHit?.poison) t.push('독');
  if (u.onHit?.slow) t.push('둔화');
  if (u.onHit?.freezeChance) t.push('빙결');
  if (u.onHit?.stunChance) t.push('기절');
  if (u.lifesteal) t.push('흡혈');
  if (u.taunt) t.push('도발');
  if (u.blockChance) t.push('투사체 방어');
  if (u.reflectProj) t.push('반사');
  if (u.thorns) t.push('가시');
  if (u.rage) t.push('광폭화');
  if (u.charge) t.push('돌진');
  if (u.leap) t.push('도약');
  if (u.stealth) t.push('은신');
  if (u.kite) t.push('거리 유지');
  if (u.bonusVsBig) t.push('대형 특효');
  if (u.aura) t.push('오라');
  if (u.attack === 'heal' || u.healPulse) t.push('치유');
  if (u.shieldGive) t.push('보호막');
  if (u.summon) t.push('소환');
  if (u.raiseDead) t.push('시체 부활');
  if (u.onDeath) t.push('사망 시 효과');
  if (u.revive) t.push('부활');
  if (u.rebirth) t.push('환생');
  if (u.immobile) t.push('고정형');
  if (u.vortex) t.push('소용돌이');
  if (u.attack === 'explode') t.push('자폭');
  if (u.crit) t.push('치명타');
  return t;
};
