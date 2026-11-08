// ─────────────────────────────────────────────
// 4.0 세계 데이터: 대륙 · 국가 · 정치 체제 · 국가 특성 · 자원 · 지형
//   지역(120)의 모양·위치는 js/world/worldmap.js 가 이 데이터와 시드로 결정론적으로 생성한다.
// ─────────────────────────────────────────────
window.SW = window.SW || {};
SW.W4 = SW.W4 || {};

(() => {
  const W4 = SW.W4;
  W4.MAP_W = 1600; W4.MAP_H = 1000; W4.CELL = 8;
  W4.DEFAULT_SEED = 40;

  // 대륙: 중심·반지름·지역 수
  W4.CONTINENTS = [
    { id: 'occ', name: '서방 대륙 옥시아', cx: 330, cy: 330, rx: 270, ry: 240, regions: 30 },
    { id: 'bor', name: '북방 대륙 보레아', cx: 1100, cy: 245, rx: 350, ry: 185, regions: 30 },
    { id: 'aus', name: '남방 대륙 아우스트라', cx: 470, cy: 790, rx: 320, ry: 175, regions: 30 },
    { id: 'ori', name: '동방 대륙 오리엔타', cx: 1260, cy: 720, rx: 265, ry: 230, regions: 30 },
  ];

  W4.GOVERNMENTS = {
    monarchy: { name: '군주정', stab: 5, tax: 0, admin: 0.05, desc: '안정도 +5' },
    empire: { name: '제국', stab: 0, tax: 0.05, mil: 0.1, desc: '세금 +5%, 군사력 +10%' },
    republic: { name: '공화정', stab: 0, tax: 0.1, trade: 0.1, desc: '세금 +10%, 무역 +10%' },
    merchant: { name: '상업 공화국', stab: -3, tax: 0.05, trade: 0.25, desc: '무역 +25%' },
    theocracy: { name: '신정', stab: 10, research: -0.05, desc: '안정도 +10, 연구 -5%' },
    magocracy: { name: '마탑 의회', stab: 0, research: 0.2, mana: 0.3, desc: '연구 +20%, 마력 +30%' },
    tribal: { name: '부족 연합', stab: -5, mil: 0.15, upkeep: -0.15, desc: '군사력 +15%, 유지비 -15%' },
    junta: { name: '군사 정권', stab: -5, mil: 0.2, desc: '군사력 +20%, 안정도 -5' },
  };

  W4.TRAITS = {
    agrarian: { name: '농업 국가', icon: '🌾', fx: { food: 0.25 } },
    mercantile: { name: '상인 길드', icon: '💰', fx: { trade: 0.2, gold: 0.1 } },
    miners: { name: '광산 전통', icon: '⛏️', fx: { iron: 0.25, coal: 0.2 } },
    builders: { name: '요새 건축', icon: '🏰', fx: { fort: 1, stone: 0.2 } },
    horselords: { name: '기마 전통', icon: '🐎', fx: { horses: 0.4, cav: 0.15 } },
    seafarers: { name: '해양 국가', icon: '⚓', fx: { naval: 0.25, trade: 0.1 } },
    arcane: { name: '비전 학파', icon: '🔮', fx: { mana: 0.4, research: 0.1 } },
    disciplined: { name: '규율의 군대', icon: '🛡️', fx: { mil: 0.1, morale: 0.1 } },
    populous: { name: '인구 대국', icon: '👥', fx: { pop: 0.2 } },
    scholars: { name: '학자 왕국', icon: '📜', fx: { research: 0.25 } },
  };

  // 자원 8종
  W4.RES = {
    food: { name: '식량', icon: '🌾' }, wood: { name: '목재', icon: '🪵' }, iron: { name: '철', icon: '⛓️' }, stone: { name: '석재', icon: '🪨' },
    gold: { name: '금', icon: '💰' }, coal: { name: '석탄', icon: '⚫' }, horses: { name: '말', icon: '🐎' }, mana: { name: '마력 결정', icon: '🔮' },
  };
  W4.RES_KEYS = Object.keys(W4.RES);

  // 지형: 이동 비용·방어 보너스·기본 생산(월)·전투 지형 프리셋
  W4.TERRAIN = {
    plains: { name: '평원', color: '#7fa65a', move: 1, def: 0, prod: { food: 6, horses: 1.5, gold: 2 }, battle: 'plain' },
    forest: { name: '숲', color: '#4f7f45', move: 1.4, def: 0.15, prod: { wood: 6, food: 2, gold: 1 }, battle: 'forest' },
    hills: { name: '구릉', color: '#9c8f5c', move: 1.5, def: 0.25, prod: { stone: 4, iron: 2, food: 2, gold: 1 }, battle: 'hills' },
    mountains: { name: '산악', color: '#8a8580', move: 2.2, def: 0.4, prod: { iron: 5, coal: 3, stone: 3 }, battle: 'mountain' },
    desert: { name: '사막', color: '#d4bd7a', move: 1.6, def: 0.05, prod: { gold: 5, stone: 1, horses: 1 }, battle: 'desert' },
    swamp: { name: '늪지', color: '#5e7a5e', move: 1.8, def: 0.2, prod: { mana: 3, food: 2, wood: 2 }, battle: 'swamp' },
    tundra: { name: '동토', color: '#c9d6dc', move: 1.6, def: 0.1, prod: { coal: 3, iron: 2, food: 1 }, battle: 'snow' },
    coast: { name: '해안 평야', color: '#8fb36a', move: 1, def: 0, prod: { food: 5, gold: 3, wood: 1 }, battle: 'river' },
  };

  // 국가 16 (대륙별 4) — fam: 선호 유닛 계열, pers: 전술 AI 성향, ai: 국가 AI 성향
  const N = (id, cont, name, color, color2, emblem, gov, traits, fam, pers, ai) => ({ id, cont, name, color, color2, emblem, gov, traits, fam, pers, ai });
  W4.NATIONS = [
    N('valor', 'occ', '발로르 왕국', '#3f7cff', '#ffd25a', 'circle', 'monarchy', ['disciplined', 'agrarian'], ['circle', 'triangle'], 'balanced', 'builder'),
    N('ferrum', 'occ', '페룸 제국', '#c0423f', '#202020', 'square', 'empire', ['miners', 'builders'], ['square', 'circle'], 'defensive', 'conqueror'),
    N('sylva', 'occ', '실바 연맹', '#3fae6a', '#f0f0d0', 'triangle', 'tribal', ['horselords'], ['triangle', 'diamond'], 'flanker', 'opportunist'),
    N('aurum', 'occ', '아우룸 상업국', '#e0b030', '#5a2a80', 'diamond', 'merchant', ['mercantile', 'seafarers'], ['circle', 'triangle'], 'artillery', 'trader'),
    N('kryos', 'bor', '크리오스 공국', '#8fd0ff', '#ffffff', 'hexagon', 'monarchy', ['builders'], ['square', 'hexagon'], 'defensive', 'builder'),
    N('drakmar', 'bor', '드라크마르 군국', '#8a2f2f', '#f0a030', 'triangle', 'junta', ['disciplined', 'miners'], ['square', 'triangle'], 'aggressive', 'conqueror'),
    N('nordhal', 'bor', '노르달 부족', '#6a8a9a', '#e0e0e0', 'diamond', 'tribal', ['horselords', 'populous'], ['diamond', 'circle'], 'flanker', 'opportunist'),
    N('arcanis', 'bor', '아르카니스 마탑', '#a064e6', '#ffe08a', 'pentagon', 'magocracy', ['arcane', 'scholars'], ['pentagon', 'hexagon'], 'artillery', 'builder'),
    N('solara', 'aus', '솔라라 신정국', '#ffb347', '#ffffff', 'hexagon', 'theocracy', ['populous', 'agrarian'], ['hexagon', 'circle'], 'balanced', 'zealot'),
    N('marea', 'aus', '마레아 공화국', '#2fa0b0', '#ffffff', 'circle', 'republic', ['seafarers', 'mercantile'], ['triangle', 'circle'], 'balanced', 'trader'),
    N('cindra', 'aus', '신드라 왕조', '#d0602f', '#2a2a2a', 'square', 'empire', ['miners'], ['square', 'pentagon'], 'aggressive', 'conqueror'),
    N('verdis', 'aus', '베르디스 자유도시', '#7fbf3f', '#3a3a3a', 'triangle', 'republic', ['scholars', 'mercantile'], ['triangle', 'pentagon'], 'artillery', 'trader'),
    N('oriens', 'ori', '오리엔스 제국', '#d04080', '#ffd700', 'pentagon', 'empire', ['populous', 'disciplined'], ['circle', 'square'], 'balanced', 'conqueror'),
    N('jadeon', 'ori', '제이드온 왕국', '#30b090', '#ffffff', 'circle', 'monarchy', ['agrarian', 'builders'], ['circle', 'hexagon'], 'defensive', 'builder'),
    N('tempest', 'ori', '템페스트 해양국', '#3060c0', '#9fe8ff', 'diamond', 'merchant', ['seafarers'], ['triangle', 'diamond'], 'flanker', 'trader'),
    N('umbra', 'ori', '움브라 결사', '#504070', '#b48cff', 'hexagon', 'magocracy', ['arcane'], ['pentagon', 'diamond'], 'aggressive', 'opportunist'),
  ];
  W4.NATION_INDEX = Object.fromEntries(W4.NATIONS.map((n, i) => [n.id, i]));
  W4.NEUTRAL = { id: 'neutral', name: '자유 영지', color: '#9a9a8a', color2: '#5a5a50', emblem: 'circle' };

  // 지역·도시 이름 생성용 음절
  W4.SYL = {
    a: ['아', '바', '카', '다', '라', '마', '사', '타', '하', '에', '레', '세', '오', '로', '소', '우', '루', '이', '리', '시', '키', '미', '노', '토', '브', '크', '드', '그', '벨', '알'],
    b: ['르', '스', '덴', '란', '몬', '린', '셀', '탄', '본', '렌', '드', '닌', '로', '가', '디', '나', '모', '테', '반', '콘', '라', '네', '도', '리'],
    c: ['하임', '포트', '베르크', '도르', '마르', '랜드', '헤븐', '게이트', '폴', '크로스', '리아', '니아', '스톤', '필드', '우드', '홀드', '베일', '브룩'],
    region: ['평원', '고원', '계곡', '숲', '변경', '해안', '분지', '구릉', '협곡', '초원', '늪', '설원', '사막', '산맥', '만'],
  };
})();
