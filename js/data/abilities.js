// 전투 기술 데이터베이스
// kind: active(일반 기술) / trigger(조건 자동 발동) / ultimate(궁극기)
// cond: 발동 조건 (battle/abilities.js 에서 해석)
//   targetInReach | targetInRange | targetFar:d | enemiesNear:r:n | alliesHurt:r:n | hpBelow:x | clusterAtTarget:r:n | always
// fx: 효과 원시 동작 목록 (battle/abilities.js 의 EXEC 참조)
window.SW = window.SW || {};

SW.ABILITIES = {
  // ── 원: 보병 ──
  shieldBash: { name: '방패 강타', kind: 'active', cd: 7, cond: 'targetInReach',
    fx: [{ op: 'strike', mult: 1.5, stun: 0.8, knock: 30 }], desc: '대상을 강타해 0.8초 기절시키고 밀쳐낸다.' },
  pierceLunge: { name: '돌파 찌르기', kind: 'active', cd: 8, cond: 'targetFar:30',
    fx: [{ op: 'dash', range: 110, mult: 2, bigMult: 1.5 }], desc: '대상에게 돌진해 2배 피해. 대형 유닛에게 추가 1.5배.' },
  shieldWall: { name: '방어벽', kind: 'active', cd: 12, cond: 'enemiesNear:240:3',
    fx: [{ op: 'buffSelf', dur: 4, mods: { block: 1, speed: -0.8, armor: 4 } },
      { op: 'buffAllies', radius: 110, dur: 4, mods: { projTaken: -0.5, covered: 1 }, color: '#e6e6e6' }],
    desc: '4초간 모든 투사체를 막고, 주변 아군이 받는 투사체 피해 50% 감소. [협동] 엄호받는 궁수의 집중 사격 강화.' },
  bloodFrenzy: { name: '피의 광란', kind: 'trigger', cd: 15, cond: 'hpBelow:0.5',
    fx: [{ op: 'buffSelf', dur: 5, mods: { atkSpd: 0.8, lifesteal: 0.2 } }], desc: '체력 50% 이하에서 5초간 공격속도 +80%, 흡혈 +20%.' },
  massHeal: { name: '광역 치유', kind: 'active', cd: 11, cond: 'alliesHurt:110:3',
    fx: [{ op: 'heal', radius: 110, amt: 45 }], desc: '주변 아군 모두 45 회복. [협동] 방진에서 효과 +30%.' },
  holyLight: { name: '성스러운 빛', kind: 'active', cd: 14, cond: 'enemiesNear:120:2',
    fx: [{ op: 'shield', radius: 90, amt: 35, count: 6, light: true }], desc: '주변 아군 6명에게 빛의 보호막(35).' },
  whirlwind: { name: '회오리 베기', kind: 'active', cd: 7, cond: 'enemiesNear:50:2',
    fx: [{ op: 'cone', range: 46, angle: 140, mult: 1.6 }], desc: '전방 140° 범위를 베어 1.6배 피해.' },

  // ── 삼각형: 사수 ──
  focusVolley: { name: '집중 사격', kind: 'active', cd: 9, cond: 'targetInRange',
    fx: [{ op: 'volley', count: 4, mult: 1, coveredMult: 1.6 }], desc: '연속 4발 사격. [협동] 방어벽 엄호 중이면 1.6배.' },
  fanBarrage: { name: '탄막', kind: 'active', cd: 8, cond: 'targetInRange',
    fx: [{ op: 'fan', count: 7, spread: 45, mult: 1 }], desc: '부채꼴로 7발을 흩뿌린다.' },
  headshot: { name: '헤드샷', kind: 'active', cd: 12, cond: 'targetInRange',
    fx: [{ op: 'snipe', mult: 2.5, lowHp: 0.4, lowMult: 4 }], desc: '방어 무시 2.5배 사격. 체력 40% 이하 대상에게는 4배.' },
  toxicCloud: { name: '독구름', kind: 'active', cd: 11, cond: 'clusterAtTarget:60:2',
    fx: [{ op: 'cloud', radius: 60, dur: 4, element: 'poison' }], desc: '4초간 독구름. 안의 적에게 독이 계속 중첩된다.' },
  barrage: { name: '연속 투척', kind: 'active', cd: 14, cond: 'targetInRange',
    fx: [{ op: 'lobs', count: 3, scatter: 70 }], desc: '대상 주변에 돌 3개를 연속 투척.' },
  heavyBolt: { name: '중장 볼트', kind: 'active', cd: 12, cond: 'targetInRange',
    fx: [{ op: 'pierceShot', mult: 2, knock: 60 }], desc: '2배 피해의 관통 볼트가 적을 밀어낸다.' },

  // ── 사각형: 중장 ──
  warCry: { name: '도발의 함성', kind: 'active', cd: 12, cond: 'enemiesNear:160:3',
    fx: [{ op: 'taunt', radius: 170, dur: 3, exposed: 0.25 }, { op: 'buffSelf', dur: 3, mods: { armor: 6 } }],
    desc: '주변 적을 3초간 강제 도발. 도발된 적은 마법 피해 +25% [협동: 마법사].' },
  shockwave: { name: '충격파', kind: 'active', cd: 10, cond: 'enemiesNear:60:2',
    fx: [{ op: 'nova', radius: 60, mult: 1.2, knock: 80 }], desc: '주변 적을 밀쳐내는 충격파.' },
  earthquake: { name: '지진', kind: 'active', cd: 13, cond: 'enemiesNear:90:4',
    fx: [{ op: 'nova', radius: 95, mult: 1, stun: 1 }], desc: '주변 적 모두를 1초 기절시킨다.' },
  mirrorWard: { name: '거울 결계', kind: 'active', cd: 14, cond: 'hpBelow:0.85',
    fx: [{ op: 'buffSelf', dur: 3, mods: { reflect: 1 } }, { op: 'buffAllies', radius: 90, dur: 3, mods: { reflect: 0.4 }, color: '#e8f6ff' }],
    desc: '3초간 자신은 투사체 100% 추가 반사, 주변 아군도 40% 반사.' },
  spikeBurst: { name: '가시 폭발', kind: 'active', cd: 10, cond: 'enemiesNear:60:3',
    fx: [{ op: 'nova', radius: 62, dmg: 35 }], desc: '사방으로 가시를 터뜨려 35 피해.' },
  arrowStorm: { name: '화살 폭풍', kind: 'active', cd: 10, cond: 'targetInRange',
    fx: [{ op: 'multiTarget', count: 10, mult: 1.2 }], desc: '사거리 안의 적 10명에게 동시에 사격.' },

  // ── 마름모: 기동 ──
  sprint: { name: '질주', kind: 'active', cd: 9, cond: 'targetFar:150',
    fx: [{ op: 'buffSelf', dur: 3, mods: { speed: 1 } }], desc: '3초간 이동속도 2배.' },
  execute: { name: '처형', kind: 'active', cd: 9, cond: 'targetInReach',
    fx: [{ op: 'execute', threshold: 0.35, poisonThreshold: 0.5, mult: 2 }], desc: '체력 35% 이하(중독 시 50%)의 적을 즉사. 아니면 2배 피해.' },
  vanish: { name: '소멸', kind: 'active', cd: 10, cond: 'hpBelow:0.7',
    fx: [{ op: 'stealth' }, { op: 'buffSelf', dur: 2, mods: { speed: 0.6 } }], desc: '즉시 다시 은신하고 빠르게 이탈.' },
  bladeStorm: { name: '칼날 폭풍', kind: 'active', cd: 11, cond: 'enemiesNear:45:3',
    fx: [{ op: 'buffSelf', dur: 3, mods: { atkSpd: 1, dodge: 0.3 } }], desc: '3초간 공격속도 2배, 회피 30%.' },
  trample: { name: '돌격 나팔', kind: 'trigger', cd: 8, cond: 'targetFar:110',
    fx: [{ op: 'buffSelf', dur: 2, mods: { speed: 0.6 } }, { op: 'recharge' }], desc: '돌진을 재충전하고 2초간 가속.' },
  dive: { name: '급강하', kind: 'active', cd: 7, cond: 'targetFar:40',
    fx: [{ op: 'dash', range: 170, mult: 2, knock: 40 }], desc: '대상에게 급강하해 2배 피해.' },
  riposte: { name: '반격', kind: 'active', cd: 6, cond: 'targetInReach',
    fx: [{ op: 'strike', mult: 2.2, crit: true }], desc: '반드시 치명타가 터지는 2.2배 일격.' },
  shadowMark: { name: '그림자 표식', kind: 'active', cd: 10, cond: 'targetInRange',
    fx: [{ op: 'mark', dur: 5, taken: 0.25 }, { op: 'stealth' }], desc: '대상이 받는 모든 피해 +25% (5초), 다시 은신.' },
  venomStorm: { name: '맹독 폭풍', kind: 'ultimate', cd: 18, cond: 'clusterAtTarget:70:3',
    fx: [{ op: 'cone', range: 150, angle: 100, dmg: 40, element: 'poison', poisonStacks: 3 }], desc: '거대한 독 브레스. 독 3중첩.' },

  // ── 오각형: 마법 ──
  firestorm: { name: '화염 폭풍', kind: 'active', cd: 12, cond: 'clusterAtTarget:65:3',
    fx: [{ op: 'nova', at: 'target', radius: 70, mult: 2, element: 'fire', burn: { dps: 8, dur: 3 } }], desc: '대상 주변을 불태워 2배 피해 + 화상.' },
  thunderstorm: { name: '뇌우', kind: 'active', cd: 14, cond: 'targetInRange',
    fx: [{ op: 'strikes', count: 6, radius: 200, dmg: 32, element: 'lightning', delay: 0.6 }], desc: '대상 주변 적 6명에게 낙뢰.' },
  blizzard: { name: '눈보라', kind: 'active', cd: 14, cond: 'clusterAtTarget:70:3',
    fx: [{ op: 'cloud', radius: 80, dur: 3, element: 'frost' }], desc: '3초간 눈보라. 강한 둔화와 빙결.' },
  elementalBurst: { name: '원소 폭발', kind: 'active', cd: 12, cond: 'clusterAtTarget:60:2',
    fx: [{ op: 'nova', at: 'target', radius: 60, mult: 2.5, element: 'cycle' }], desc: '현재 속성으로 2.5배 범위 폭발.' },
  greatSummon: { name: '대소환', kind: 'active', cd: 20, cond: 'enemiesNear:350:3',
    fx: [{ op: 'summonBurst', unit: 'wisp', count: 4 }], desc: '정령 4기를 즉시 소환 (제한 무시).' },
  lifeDrain: { name: '생명 흡수', kind: 'active', cd: 8, cond: 'targetInRange',
    fx: [{ op: 'drain', dmg: 40 }], desc: '대상의 생명력 40을 흡수.' },
  meteorShower: { name: '유성우', kind: 'ultimate', cd: 25, cond: 'clusterAtTarget:80:4',
    fx: [{ op: 'meteors', count: 4, radius: 70, mult: 0.8 }], desc: '운석 4개를 연속으로 떨어뜨린다.' },

  // ── 육각형: 지원 ──
  warDrums: { name: '전쟁의 북', kind: 'active', cd: 16, cond: 'enemiesNear:260:3',
    fx: [{ op: 'buffAllies', radius: 160, dur: 5, mods: { atkSpd: 0.5, speed: 0.2 }, color: '#ffe27a' }], desc: '주변 아군 5초간 공격속도 +50%, 이동속도 +20%.' },
  rally: { name: '결집', kind: 'active', cd: 16, cond: 'alliesHurt:140:4',
    fx: [{ op: 'heal', radius: 140, pct: 0.12 }, { op: 'buffAllies', radius: 140, dur: 5, mods: { armor: 3 }, color: '#ff8a8a' }], desc: '주변 아군 최대 체력 12% 회복, 방어력 +3.' },
  lightBarrier: { name: '빛의 방벽', kind: 'active', cd: 15, cond: 'enemiesNear:260:3',
    fx: [{ op: 'shield', radius: 140, amt: 70, count: 40, light: true }], desc: '주변 아군 전원에게 빛의 보호막(70). 화염 피해를 절반만 받는다.' },
  divineLight: { name: '신성한 빛', kind: 'active', cd: 12, cond: 'alliesHurt:120:3',
    fx: [{ op: 'heal', radius: 120, amt: 50, cleanse: true }], desc: '주변 아군 50 회복 + 모든 상태이상 해제.' },
  timeStop: { name: '시간 정지', kind: 'ultimate', cd: 20, cond: 'enemiesNear:120:5',
    fx: [{ op: 'freeze', radius: 115, dur: 1.6 }], desc: '주변 적 전부 1.6초간 정지.' },
  repair: { name: '수리', kind: 'active', cd: 8, cond: 'always',
    fx: [{ op: 'heal', radius: 160, amt: 80, filter: 'mech' }], desc: '주변 포탑·요새·사각형 유닛 80 수리.' },
  balladOfValor: { name: '용맹의 노래', kind: 'active', cd: 14, cond: 'enemiesNear:260:3',
    fx: [{ op: 'buffAllies', radius: 160, dur: 5, mods: { dmg: 0.25, crit: 0.15 }, color: '#ffd0ef' }], desc: '주변 아군 공격력 +25%, 치명타 +15%.' },
  focusFire: { name: '집중 포화', kind: 'active', cd: 12, cond: 'enemiesNear:320:2',
    fx: [{ op: 'command', range: 320, radius: 260, dur: 6, taken: 0.3 }], desc: '가장 위협적인 적을 지목. 주변 아군이 일제히 공격하고 피해 +30%.' },

  // ── 별: 전설 ──
  heroicStrike: { name: '영웅의 일격', kind: 'ultimate', cd: 20, cond: 'enemiesNear:110:4',
    fx: [{ op: 'nova', radius: 115, dmg: 160, stun: 0.6 }, { op: 'buffAllies', radius: 160, dur: 5, mods: { dmg: 0.3 }, color: '#fff4a0' }],
    desc: '주변 적에게 160 피해 + 기절, 아군 공격력 +30%.' },
  flameBurst: { name: '화염 폭발', kind: 'active', cd: 12, cond: 'enemiesNear:100:3',
    fx: [{ op: 'nova', radius: 100, dmg: 60, element: 'fire', burn: { dps: 10, dur: 4 } }], desc: '주변을 폭발시켜 60 피해 + 강한 화상.' },
  voidRift: { name: '공허 균열', kind: 'active', cd: 7, cond: 'targetInRange',
    fx: [{ op: 'vortex', radius: 110, dur: 3, pull: 90, dps: 20 }], desc: '적을 끌어모으는 공허 소용돌이 생성.' },
  worldBreaker: { name: '세계 분쇄', kind: 'ultimate', cd: 20, cond: 'enemiesNear:150:5',
    fx: [{ op: 'nova', radius: 160, dmg: 120, stun: 1.5, knock: 60 }], desc: '넓은 범위에 120 피해 + 1.5초 기절.' },
};
for (const [id, a] of Object.entries(SW.ABILITIES)) a.id = id;
SW.SKILL_KIND_NAMES = { active: '액티브', trigger: '트리거', ultimate: '궁극기', passive: '패시브' };
