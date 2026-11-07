// 보스 데이터 — 보스는 일반 유닛과 별도의 AI(battle/boss.js)를 사용한다.
// phases: 체력 비율(at) 이하가 되면 진입. 패턴 주기와 강화가 바뀐다.
window.SW = window.SW || {};

SW.BOSS_UNITS = {
  ironColossus: {
    name: '강철 거신', family: 'square', size: 34, pop: 0, hp: 7500, armor: 8, dmg: 48, atkCd: 2.2, speed: 24, splash: 55,
    frontArmor: 0.75, turnRate: 0.55, glyph: 'sq', accent: '#c8d2e6', canHitAir: false,
    desc: '정면에서 오는 피해를 75% 막는다. 방향 전환이 매우 느리다.',
    bossData: { title: '정면 장갑 75% · 느린 회전', color: '#c8d2e6', ai: 'iron',
      phases: [{ at: 0.5, name: '분노', mods: { atkSpd: 0.4 }, turn: 1.0 }, { at: 0.25, name: '최후의 일격', ult: true }] },
  },
  stormLord: {
    name: '폭풍 군주', family: 'pentagon', size: 24, pop: 0, hp: 6500, armor: 4, mres: 0.2, dmg: 24, atkCd: 1.6, range: 270, speed: 36,
    dmgType: 'magic', attack: 'chain', chain: { count: 5, jump: 90 }, element: 'lightning', keepDist: 220, glyph: 'bolt', accent: '#fff36b',
    desc: '밀집한 곳에 낙뢰를 떨어뜨린다. 산개 진형으로 피해를 줄여라.',
    bossData: { title: '광역 낙뢰 · 밀집 진형 사냥', color: '#fff36b', ai: 'storm',
      phases: [{ at: 0.5, name: '폭풍 격화', mods: { atkSpd: 0.3 } }, { at: 0.25, name: '천둥 심판', ult: true }] },
  },
  abyssMage: {
    name: '심연의 마도사', family: 'pentagon', size: 20, pop: 0, hp: 5200, armor: 2, dmg: 26, atkCd: 1.3, range: 260, speed: 42,
    dmgType: 'magic', attack: 'bolt', projSpeed: 380, element: 'dark', keepDist: 320, glyph: 'skull', accent: '#c07bff',
    desc: '후방에서 해골을 소환하고 저주를 건다. 몸은 약하니 암살자로 파고들어라.',
    bossData: { title: '소환 · 저주 · 순간이동', color: '#c07bff', ai: 'abyss',
      phases: [{ at: 0.6, name: '어둠의 장막' }, { at: 0.25, name: '심연의 문', ult: true }] },
  },
  immortalPhoenix: {
    name: '불멸의 불사조', family: 'star', size: 26, pop: 0, hp: 7000, armor: 3, dmg: 28, atkCd: 0.8, speed: 70,
    dmgType: 'magic', attack: 'spin', splash: 50, element: 'fire', flying: true, onHit: { burn: { dps: 10, dur: 3 } },
    glyph: 'tri', accent: '#ffcc33', resist: { fire: 1 },
    desc: '초당 체력 2% 재생, 쓰러져도 두 번 부활한다. 중독 상태면 재생과 부활이 막힌다.',
    bossData: { title: '재생 · 2회 부활 · 독에 약함', color: '#ffb347', ai: 'phoenix',
      phases: [{ at: 0.5, name: '불꽃 폭주', mods: { speed: 0.3, atkSpd: 0.3 } }, { at: 0.25, name: '태양 폭발', ult: true }] },
  },
  voidSovereign: {
    name: '공허의 지배자', family: 'star', size: 30, pop: 0, hp: 20000, armor: 6, dmg: 45, atkCd: 1.4, range: 230, speed: 32,
    dmgType: 'magic', attack: 'bolt', projSpeed: 400, element: 'dark', keepDist: 190, glyph: 'ring', accent: '#a070ff',
    desc: '3단계 보스. 소용돌이 → 순간이동과 공허체 소환 → 전장을 삼키는 블랙홀.',
    bossData: { title: '3단계 전장 조작', color: '#a070ff', ai: 'void',
      phases: [{ at: 0.6, name: '2단계: 차원 붕괴' }, { at: 0.3, name: '3단계: 사건의 지평선', ult: true }] },
  },
  voidling: {
    name: '공허체', family: 'diamond', size: 8, pop: 0, hp: 140, armor: 1, dmg: 12, atkCd: 0.7, speed: 105, dmgType: 'magic', element: 'dark',
    lifetime: 30, summonOnly: true, bossMinion: true, glyph: 'dot', accent: '#a070ff', desc: '공허의 지배자가 부르는 하수인.',
  },
};
for (const [id, u] of Object.entries(SW.BOSS_UNITS)) {
  if (u.bossData) { u.boss = true; u.role = 'boss'; }
  else u.role = 'skirmisher';
  SW.UNITS[id] = u;
  SW.normalizeUnit(id, u);
  if (u.boss) { u.cls = 'boss'; u.skill = null; }
  if (id === 'voidling') u.boss = true;   // 목록에서 숨김
}
SW.UNITS.voidling.boss = false; SW.UNITS.voidling.hidden = true;

// 보스 레이드 목록
SW.RAIDS = [
  { boss: 'ironColossus', pop: 60, reward: 900, need: 6, hint: '정면 공격은 75% 막힌다. 쐐기·기동 유닛으로 측면과 후방을 노려라.',
    escorts: [['guardian', 3, 1180, 450, 1], ['crossbow', 10, 1350, 450, 2]] },
  { boss: 'stormLord', pop: 60, reward: 1000, need: 9, hint: '낙뢰는 밀집한 곳에 떨어진다. 산개 진형이 유리하다.',
    escorts: [['shieldman', 6, 1120, 450, 2], ['storm', 2, 1350, 450, 1]] },
  { boss: 'abyssMage', pop: 55, reward: 1100, need: 12, hint: '해골 군단 뒤에 숨는다. 암살자·그림자 추적자·저격수로 본체를 노려라.',
    escorts: [['skeleton', 16, 1150, 450, 4], ['necromancer', 2, 1380, 450, 1]] },
  { boss: 'immortalPhoenix', pop: 65, reward: 1300, need: 15, hint: '비행 + 재생 + 부활. 독(독침수·와이번)으로 재생과 부활을 막고 대공으로 집중하라.',
    escorts: [['harpy', 8, 1200, 450, 2]] },
  { boss: 'voidSovereign', pop: 80, reward: 1800, need: 20, hint: '단계마다 패턴이 바뀐다. 3단계 블랙홀에 휩쓸리지 않도록 산개하고 원거리로 마무리하라.',
    escorts: [['golem', 2, 1150, 450, 1], ['priest', 1, 1400, 450, 1]] },
];
