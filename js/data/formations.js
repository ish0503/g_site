// 진형 데이터
// mods: 전투 중 적용되는 진형 효과 (battle/formation.js, combat.js 에서 사용)
//   dmg: 공격력 배율 가산, armor: 방어력 가산, speed: 이동속도 배율 가산, chargeMult: 돌진 피해 배율 가산
//   splashTaken: 범위 피해 받는 배율 가산, supportEff: 치유·오라 효율 가산
//   backTaken: (원거리/지원) 받는 피해 배율 가산, frontDmg: 근접 공격력 가산, noFlank: 측면 공격 보너스 무효
// spacing: 배치 간격 배율, march: 진형을 유지하며 진군하는지
window.SW = window.SW || {};

SW.FORMATIONS = {
  free: { name: '자유', icon: '✳️', desc: '진형 없이 각 유닛이 알아서 싸운다 (1.0 방식).', weak: '-', mods: {}, spacing: 1, march: false },
  line: { name: '횡대', icon: '☰', desc: '넓은 전선을 유지하며 함께 진군. 공격력 +10%.', weak: '얇은 중앙이 돌파당하기 쉽다.',
    mods: { dmg: 0.1 }, spacing: 1.05, march: true },
  phalanx: { name: '방진', icon: '▦', desc: '빽빽한 밀집 대형. 방어력 +3, 근접 전열이 받는 피해 -15%, 치유 효과 +30%.', weak: '이동속도 -20%, 범위 공격에 약하다.',
    mods: { armor: 3, frontTaken: -0.15, speed: -0.2, supportEff: 0.3, splashTaken: 0.15 }, spacing: 0.95, march: true },
  wedge: { name: '쐐기', icon: '▶', desc: '적 전선을 꿰뚫는 돌파 대형. 이동속도 +15%, 돌진 피해 +40%.', weak: '방어력 -2, 측면이 약하다.',
    mods: { speed: 0.15, chargeMult: 0.4, armor: -2, frontDmg: 0.1 }, spacing: 1.05, march: true },
  circle: { name: '원형', icon: '◯', desc: '전방위 방어. 측면·후방 공격 보너스를 받지 않고 방어력 +2.', weak: '공격력 -10%.',
    mods: { noFlank: true, armor: 2, dmg: -0.1 }, spacing: 1, march: true },
  spread: { name: '산개', icon: '⁘', desc: '넓게 흩어져 범위 공격 피해 -40%.', weak: '치유·오라·보호막 효율 -30%.',
    mods: { splashTaken: -0.4, supportEff: -0.3 }, spacing: 2.2, march: true },
  protect: { name: '후방 보호', icon: '⛉', desc: '근접 유닛이 원거리·지원 유닛을 감싼다. 후열이 받는 피해 -25%.', weak: '근접 공격력 -10%.',
    mods: { backTaken: -0.25, frontDmg: -0.1 }, spacing: 1.05, march: true },
};
SW.FORMATION_ORDER = ['free', 'line', 'phalanx', 'wedge', 'circle', 'spread', 'protect'];
for (const [id, f] of Object.entries(SW.FORMATIONS)) f.id = id;
