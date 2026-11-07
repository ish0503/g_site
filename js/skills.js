// 스킬 트리 정의
// fx 효과 종류:
//   { unlock: 'unitId' }                          : 유닛 해금
//   { t: 'family:circle' | 'unitId', stat, mul }  : 스탯 배율 증가 (0.15 = +15%)
//   { t, stat, add }                              : 스탯 고정값 증가
//   { t, patch: {...} }                           : 특수 능력 부여/변경
//   { popBonus: n }                               : 챌린지 인원 제한 +n
//   { goldBonus: r }                              : 획득 골드 +r
window.SW = window.SW || {};

const N = (id, name, cost, req, x, y, fx, desc, stage) => ({ id, name, cost, req, x, y, fx, desc: desc || '', stage: stage || 0 });
const F = (fam) => 'family:' + fam;

SW.SKILL_TREES = {
  circle: [
    N('c_root', '보병 전술', 0, [], 2, 0, [{ unlock: 'soldier' }], '병사를 운용할 수 있다.'),
    N('c_hp1', '강인한 체력', 80, ['c_root'], 0, 1, [{ t: F('circle'), stat: 'hp', mul: 0.15 }]),
    N('c_dmg1', '날카로운 칼날', 80, ['c_root'], 2, 1, [{ t: F('circle'), stat: 'dmg', mul: 0.15 }]),
    N('c_shield', '방패병 훈련', 150, ['c_root'], 4, 1, [{ unlock: 'shieldman' }]),
    N('c_hp2', '철의 의지', 250, ['c_hp1'], 0, 2, [{ t: F('circle'), stat: 'hp', mul: 0.2 }]),
    N('c_spear', '창병 훈련', 120, ['c_dmg1'], 1, 2, [{ unlock: 'spearman' }]),
    N('c_berserk', '광전사의 길', 300, ['c_dmg1'], 3, 2, [{ unlock: 'berserker' }]),
    N('c_shield2', '방패벽', 300, ['c_shield'], 4, 2, [{ t: 'shieldman', patch: { blockChance: 0.8 } }, { t: 'shieldman', stat: 'armor', add: 3 }], '방패병의 투사체 방어 확률 80%, 방어력 +3.'),
    N('c_heal', '치유술', 220, ['c_hp2'], 0, 3, [{ unlock: 'healer' }]),
    N('c_spear2', '장창', 250, ['c_spear'], 1, 3, [{ t: 'spearman', stat: 'range', add: 10 }, { t: 'spearman', patch: { bonusVsBig: 3.5 } }], '창병 사거리 +10, 대형 특효 3.5배.'),
    N('c_march', '강행군', 200, ['c_spear'], 2, 3, [{ t: F('circle'), stat: 'speed', mul: 0.2 }]),
    N('c_berserk2', '피의 갈증', 400, ['c_berserk'], 3, 3, [{ t: 'berserker', stat: 'lifesteal', add: 0.2 }], '광전사 흡혈 +20%.'),
    N('c_armor', '사슬 갑옷', 350, ['c_shield2'], 4, 3, [{ t: F('circle'), stat: 'armor', add: 2 }]),
    N('c_heal2', '숙련된 치유', 350, ['c_heal'], 0, 4, [{ t: 'healer', stat: 'heal', mul: 0.6 }, { t: 'healer', stat: 'range', add: 30 }], '치유량 +60%, 치유 사거리 +30.'),
    N('c_martyr', '순교의 맹세', 400, ['c_heal'], 1, 4, [{ unlock: 'martyr' }]),
    N('c_command', '지휘관', 500, ['c_march'], 2, 4, [{ popBonus: 3 }], '모든 챌린지에서 인원 제한 +3.'),
    N('c_elite', '정예 보병', 700, ['c_berserk2', 'c_armor'], 3.5, 4, [{ t: F('circle'), stat: 'hp', mul: 0.2 }, { t: F('circle'), stat: 'dmg', mul: 0.2 }], '보병 계열 체력·공격력 +20%.'),
    N('c_martyr2', '성스러운 희생', 500, ['c_martyr'], 1, 5, [{ t: 'martyr', patch: { onDeath: { heal: { radius: 120, amt: 120 } } } }], '순교자의 사망 치유량 120, 범위 증가.'),
  ],

  triangle: [
    N('t_root', '궁술', 0, [], 2, 0, [{ unlock: 'archer' }], '궁수를 운용할 수 있다.'),
    N('t_dmg1', '정밀 사격', 100, ['t_root'], 1, 1, [{ t: F('triangle'), stat: 'dmg', mul: 0.15 }]),
    N('t_range', '장궁', 120, ['t_root'], 3, 1, [{ t: F('triangle'), stat: 'range', mul: 0.12 }]),
    N('t_cross', '연사 기술', 150, ['t_dmg1'], 0, 2, [{ unlock: 'crossbow' }]),
    N('t_fire', '불화살', 250, ['t_dmg1'], 1, 2, [{ t: 'archer', patch: { onHit: { burn: { dps: 5, dur: 3 } } } }], '궁수의 화살이 적을 불태운다 (초당 5, 3초).'),
    N('t_poison', '독침', 200, ['t_dmg1'], 2, 2, [{ unlock: 'poisoner' }]),
    N('t_siege', '공성 공학', 350, ['t_range'], 3, 2, [{ unlock: 'catapult' }]),
    N('t_sniper', '저격술', 300, ['t_range'], 4, 2, [{ unlock: 'sniper' }]),
    N('t_cross2', '연발 장치', 300, ['t_cross'], 0, 3, [{ t: 'crossbow', stat: 'atkCd', mul: -0.25 }], '연사수 공격 속도 +33%.'),
    N('t_volley', '일제 사격', 350, ['t_fire'], 1, 3, [{ t: F('triangle'), stat: 'atkCd', mul: -0.12 }], '사수 계열 공격 속도 증가.'),
    N('t_poison2', '맹독', 350, ['t_poison'], 2, 3, [{ t: 'poisoner', patch: { onHit: { poison: { dps: 6, dur: 6, max: 8 } } } }], '독 피해 초당 6, 최대 8중첩.'),
    N('t_ballista', '발리스타', 450, ['t_siege'], 3, 3, [{ unlock: 'ballista' }]),
    N('t_sniper2', '철갑탄', 450, ['t_sniper'], 4, 3, [{ t: 'sniper', stat: 'dmg', mul: 0.5 }, { t: 'sniper', patch: { dmgType: 'true' } }], '저격수 피해 +50%, 방어력을 완전히 무시.'),
    N('t_hp', '가죽 갑옷', 250, ['t_cross2'], 0, 4, [{ t: F('triangle'), stat: 'hp', mul: 0.3 }]),
    N('t_eagle', '매의 눈', 500, ['t_volley', 't_poison2'], 1.5, 4, [{ t: F('triangle'), stat: 'dmg', mul: 0.25 }, { t: F('triangle'), patch: { crit: { chance: 0.15, mult: 2 } } }], '사수 계열 공격력 +25%, 15% 확률 치명타(2배).'),
    N('t_siege2', '화염 탄두', 500, ['t_ballista'], 3, 4, [{ t: 'catapult', patch: { onHit: { burn: { dps: 10, dur: 4 } } } }, { t: 'catapult', stat: 'splash', mul: 0.3 }], '투석기 범위 +30%, 화상 부여.'),
    N('t_ballista2', '연노', 500, ['t_ballista'], 4, 4, [{ t: 'ballista', stat: 'atkCd', mul: -0.35 }, { t: 'ballista', stat: 'dmg', mul: 0.3 }], '발리스타 공격 속도·피해 대폭 증가.'),
  ],

  square: [
    N('s_root', '중장갑 훈련', 300, [], 2, 0, [{ unlock: 'guardian' }], '수호병을 운용할 수 있다.', 3),
    N('s_armor1', '강화 갑옷', 200, ['s_root'], 1, 1, [{ t: F('square'), stat: 'armor', add: 2 }]),
    N('s_ram', '돌격 훈련', 250, ['s_root'], 3, 1, [{ unlock: 'ram' }]),
    N('s_hp', '두꺼운 장갑판', 300, ['s_armor1'], 0, 2, [{ t: F('square'), stat: 'hp', mul: 0.25 }]),
    N('s_thorn', '가시 갑옷', 300, ['s_armor1'], 1, 2, [{ unlock: 'thorn' }]),
    N('s_mirror', '거울 방패', 350, ['s_armor1'], 2, 2, [{ unlock: 'mirror' }]),
    N('s_ram2', '파성추', 350, ['s_ram'], 3, 2, [{ t: 'ram', patch: { charge: { mult: 5, speedMul: 3, minDist: 60, knock: 110 } } }], '돌격병의 돌진 피해 5배, 넉백 강화.'),
    N('s_golem', '골렘 창조', 500, ['s_ram'], 4, 2, [{ unlock: 'golem' }]),
    N('s_taunt', '도발의 함성', 300, ['s_hp'], 0, 3, [{ t: 'guardian', stat: 'taunt', mul: 0.6 }, { t: 'guardian', stat: 'hp', mul: 0.3 }], '수호병 도발 범위 +60%, 체력 +30%.'),
    N('s_thorn2', '강철 가시', 350, ['s_thorn'], 1, 3, [{ t: 'thorn', patch: { thorns: 1.0 } }], '가시 반사 피해 100%.'),
    N('s_mirror2', '완벽한 반사', 350, ['s_mirror'], 2, 3, [{ t: 'mirror', patch: { reflectProj: 1.0, blockChance: 0.3 } }], '반사 100%, 30% 확률로 투사체 차단.'),
    N('s_golem2', '대지 강타', 500, ['s_golem'], 4, 3, [{ t: 'golem', stat: 'splash', mul: 0.4 }, { t: 'golem', patch: { onHit: { stunChance: 0.3, stunDur: 1 } } }], '골렘 범위 +40%, 30% 확률 기절.'),
    N('s_fortress', '요새 건설', 800, ['s_golem2', 's_mirror2'], 3, 4, [{ unlock: 'fortress' }]),
    N('s_bulwark', '불굴', 600, ['s_taunt', 's_thorn2'], 0.5, 4, [{ t: F('square'), stat: 'hp', mul: 0.3 }, { t: F('square'), stat: 'dmg', mul: 0.3 }], '중장 계열 체력·공격력 +30%.'),
    N('s_fortress2', '대포 요새', 700, ['s_fortress'], 3, 5, [{ t: 'fortress', patch: { attack: 'fireball', dmgType: 'phys', splash: 30, projSpeed: 380 } }, { t: 'fortress', stat: 'dmg', mul: 0.6 }], '요새가 범위 폭발탄을 쏜다.'),
  ],

  diamond: [
    N('d_root', '경보병 훈련', 300, [], 2, 0, [{ unlock: 'scout' }], '척후병을 운용할 수 있다.', 5),
    N('d_speed', '질풍', 200, ['d_root'], 0, 1, [{ t: F('diamond'), stat: 'speed', mul: 0.15 }]),
    N('d_bomber', '폭약 제조', 250, ['d_root'], 2, 1, [{ unlock: 'bomber' }]),
    N('d_assassin', '암살 교본', 350, ['d_root'], 4, 1, [{ unlock: 'assassin' }]),
    N('d_cavalry', '기마술', 400, ['d_speed'], 0, 2, [{ unlock: 'cavalry' }]),
    N('d_blade', '검무', 350, ['d_speed', 'd_bomber'], 1, 2, [{ unlock: 'bladedancer' }]),
    N('d_bomber2', '화약 증량', 300, ['d_bomber'], 2, 2, [{ t: 'bomber', stat: 'splash', mul: 0.4 }, { t: 'bomber', stat: 'dmg', mul: 0.3 }], '자폭병 폭발 범위 +40%, 피해 +30%.'),
    N('d_phantom', '그림자 술법', 400, ['d_assassin'], 3, 2, [{ unlock: 'phantom' }]),
    N('d_assassin2', '급소 찌르기', 400, ['d_assassin'], 4, 2, [{ t: 'assassin', patch: { ambush: 5 } }, { t: 'assassin', patch: { leap: { range: 220, cd: 4 } } }], '암살자 도약 후 첫 공격 5배, 도약 쿨다운 4초.'),
    N('d_harpy', '하늘의 사냥꾼', 500, ['d_cavalry'], 0, 3, [{ unlock: 'harpy' }]),
    N('d_blade2', '칼날 폭풍', 400, ['d_blade'], 1, 3, [{ t: 'bladedancer', stat: 'splash', mul: 0.4 }, { t: 'bladedancer', stat: 'lifesteal', add: 0.25 }], '칼춤꾼 범위 +40%, 흡혈 25%.'),
    N('d_crit', '치명 일격', 450, ['d_phantom', 'd_assassin2'], 3.5, 3, [{ t: F('diamond'), patch: { crit: { chance: 0.2, mult: 2.5 } } }], '기동 계열 20% 확률 치명타(2.5배).'),
    N('d_harpy2', '폭풍 날개', 450, ['d_harpy'], 0, 4, [{ t: 'harpy', stat: 'hp', mul: 0.5 }, { t: 'harpy', stat: 'dmg', mul: 0.4 }], '하피 체력 +50%, 공격력 +40%.'),
    N('d_hp', '경량 갑주', 400, ['d_blade2'], 1.5, 4, [{ t: F('diamond'), stat: 'hp', mul: 0.3 }, { t: F('diamond'), stat: 'armor', add: 1 }]),
    N('d_phantom2', '깊은 어둠', 450, ['d_crit'], 3.5, 4, [{ t: 'phantom', patch: { stealth: { reveal: 0.8 } } }, { t: 'phantom', stat: 'dmg', mul: 0.4 }], '유령 노출 시간 0.8초, 공격력 +40%.'),
  ],

  pentagon: [
    N('p_root', '비전 학파', 400, [], 2, 0, [{ unlock: 'mage' }], '마법사를 운용할 수 있다.', 7),
    N('p_dmg', '마력 증폭', 300, ['p_root'], 1, 1, [{ t: F('pentagon'), stat: 'dmg', mul: 0.2 }]),
    N('p_frost', '냉기 학파', 350, ['p_root'], 3, 1, [{ unlock: 'frost' }]),
    N('p_storm', '뇌전 학파', 400, ['p_dmg'], 0, 2, [{ unlock: 'storm' }]),
    N('p_mage2', '폭염', 350, ['p_dmg'], 1, 2, [{ t: 'mage', stat: 'splash', mul: 0.5 }, { t: 'mage', patch: { onHit: { burn: { dps: 6, dur: 3 } } } }], '마법사 범위 +50%, 화상 부여.'),
    N('p_summon', '소환 학파', 450, ['p_frost'], 3, 2, [{ unlock: 'summoner' }]),
    N('p_frost2', '절대 영도', 400, ['p_frost'], 4, 2, [{ t: 'frost', patch: { onHit: { slow: { amt: 0.6, dur: 3 }, freezeChance: 0.3, freezeDur: 2 } } }], '빙결 확률 30%, 둔화 강화.'),
    N('p_storm2', '연쇄 번개', 400, ['p_storm'], 0, 3, [{ t: 'storm', patch: { chain: { count: 7, jump: 110 } } }], '번개가 7명까지 연쇄.'),
    N('p_meteor', '운석 소환', 700, ['p_mage2'], 1, 3, [{ unlock: 'meteor' }]),
    N('p_summon2', '정령 군단', 400, ['p_summon'], 3, 3, [{ t: 'summoner', patch: { summon: { unit: 'wisp', count: 3, cd: 5, max: 12 } } }], '정령 3기씩, 최대 12기 소환.'),
    N('p_necro', '강령술', 600, ['p_summon'], 4, 3, [{ unlock: 'necromancer' }]),
    N('p_hp', '마력 방벽', 350, ['p_storm2'], 0, 4, [{ t: F('pentagon'), stat: 'hp', mul: 0.4 }]),
    N('p_arch', '대마도사', 800, ['p_meteor', 'p_summon2'], 2, 4, [{ t: F('pentagon'), stat: 'dmg', mul: 0.3 }, { t: F('pentagon'), stat: 'atkCd', mul: -0.15 }], '마법 계열 공격력 +30%, 공격 속도 증가.'),
    N('p_necro2', '죽음의 군주', 500, ['p_necro'], 4, 4, [{ t: 'necromancer', patch: { raiseDead: { radius: 240, max: 25 } } }], '부활 범위 증가, 최대 25기.'),
  ],

  hexagon: [
    N('h_root', '군악대', 400, [], 2, 0, [{ unlock: 'drummer' }], '전고수를 운용할 수 있다.', 9),
    N('h_banner', '군기', 300, ['h_root'], 0, 1, [{ unlock: 'banner' }]),
    N('h_shielder', '방벽술', 350, ['h_root'], 2, 1, [{ unlock: 'shielder' }]),
    N('h_engineer', '공병대', 350, ['h_root'], 4, 1, [{ unlock: 'engineer' }]),
    N('h_aura', '울려퍼지는 함성', 400, ['h_banner'], 0, 2, [{ t: F('hexagon'), stat: 'aura.radius', mul: 0.4 }], '모든 오라 범위 +40%.'),
    N('h_priest', '성직', 450, ['h_shielder'], 1.5, 2, [{ unlock: 'priest' }]),
    N('h_shield2', '강화 방벽', 350, ['h_shielder'], 2.5, 2, [{ t: 'shielder', patch: { shieldGive: { amt: 80, count: 6, radius: 150, cd: 4 } } }], '보호막 80, 6명, 4초마다.'),
    N('h_turret2', '개량 포탑', 400, ['h_engineer'], 4, 2, [{ t: 'turret', stat: 'dmg', mul: 0.6 }, { t: 'engineer', patch: { summon: { unit: 'turret', count: 1, cd: 6, max: 4 } } }], '포탑 공격력 +60%, 최대 4개.'),
    N('h_drum2', '전쟁의 북', 400, ['h_aura'], 0, 3, [{ t: 'drummer', patch: { aura: { radius: 110, ally: { atkSpd: 0.6, speed: 0.2 } } } }], '전고수: 공격속도 +60%, 이동속도 +20%.'),
    N('h_chrono', '시간 왜곡', 600, ['h_priest'], 1.5, 3, [{ unlock: 'chrono' }]),
    N('h_priest2', '축복', 450, ['h_priest'], 2.5, 3, [{ t: 'priest', patch: { healPulse: { amt: 40, radius: 130, cd: 3 } } }], '대사제 치유 40, 범위 증가.'),
    N('h_hp', '호위대', 300, ['h_turret2'], 4, 3, [{ t: F('hexagon'), stat: 'hp', mul: 0.5 }]),
    N('h_banner2', '왕의 깃발', 500, ['h_drum2'], 0, 4, [{ t: 'banner', patch: { aura: { radius: 120, ally: { dmg: 0.5, armor: 4 } } } }], '기수: 공격력 +50%, 방어력 +4.'),
    N('h_chrono2', '시간 정지', 500, ['h_chrono'], 1.5, 4, [{ t: 'chrono', patch: { aura: { radius: 140, enemy: { slow: 0.55, atkSlow: 0.4 } } } }], '시간술사 둔화 대폭 강화.'),
    N('h_command', '총사령부', 800, ['h_priest2', 'h_hp'], 3.2, 4, [{ popBonus: 5 }], '모든 챌린지에서 인원 제한 +5.'),
  ],

  star: [
    N('st_root', '전설의 부름', 1500, [], 2, 0, [{ unlock: 'hero' }], '영웅을 운용할 수 있다.', 14),
    N('st_hero2', '영웅의 기백', 800, ['st_root'], 1, 1, [{ t: 'hero', stat: 'hp', mul: 0.4 }, { t: 'hero', stat: 'dmg', mul: 0.4 }]),
    N('st_phoenix', '불사의 불꽃', 1500, ['st_root'], 3, 1, [{ unlock: 'phoenix' }]),
    N('st_void', '공허의 문', 1800, ['st_hero2'], 1, 2, [{ unlock: 'voidcaller' }]),
    N('st_colossus', '거신 각성', 2200, ['st_phoenix'], 3, 2, [{ unlock: 'colossus' }]),
    N('st_gold', '전리품', 600, ['st_root'], 2, 1, [{ goldBonus: 0.25 }], '획득 골드 +25%.'),
    N('st_legend', '전설', 2000, ['st_void', 'st_colossus'], 2, 3, [{ t: F('star'), stat: 'hp', mul: 0.3 }, { t: F('star'), stat: 'dmg', mul: 0.3 }, { popBonus: 5 }], '전설 계열 체력·공격력 +30%, 인원 제한 +5.'),
  ],
};

SW.SKILL_INDEX = {};
for (const [fam, nodes] of Object.entries(SW.SKILL_TREES))
  for (const n of nodes) { n.family = fam; SW.SKILL_INDEX[n.id] = n; }

// 효과 설명 자동 생성
SW.STAT_NAMES = { hp: '체력', dmg: '공격력', armor: '방어력', speed: '이동속도', range: '사거리', atkCd: '공격 주기', splash: '범위', heal: '치유량', lifesteal: '흡혈', taunt: '도발 범위', 'aura.radius': '오라 범위' };
SW.describeFx = (fx) => {
  if (fx.unlock) return `유닛 해금: ${SW.UNITS[fx.unlock].name}`;
  if (fx.popBonus) return `인원 제한 +${fx.popBonus}`;
  if (fx.goldBonus) return `골드 획득 +${Math.round(fx.goldBonus * 100)}%`;
  const who = fx.t.startsWith('family:') ? SW.FAMILIES[fx.t.slice(7)].title : SW.UNITS[fx.t].name;
  if (fx.patch) return `${who}: 특수 능력 강화`;
  const s = SW.STAT_NAMES[fx.stat] || fx.stat;
  if (fx.mul !== undefined) return `${who} ${s} ${fx.mul > 0 ? '+' : ''}${Math.round(fx.mul * 100)}%`;
  return `${who} ${s} +${fx.stat === 'lifesteal' ? Math.round(fx.add * 100) + '%' : fx.add}`;
};

// 보유 스킬 → 수정자 목록
SW.buildMods = (owned) => {
  const mods = { unlocks: new Set(), stat: [], patch: [], popBonus: 0, goldBonus: 0 };
  for (const id of owned) {
    const n = SW.SKILL_INDEX[id]; if (!n) continue;
    for (const fx of n.fx) {
      if (fx.unlock) mods.unlocks.add(fx.unlock);
      else if (fx.popBonus) mods.popBonus += fx.popBonus;
      else if (fx.goldBonus) mods.goldBonus += fx.goldBonus;
      else if (fx.patch) mods.patch.push(fx);
      else mods.stat.push(fx);
    }
  }
  return mods;
};
