// ─────────────────────────────────────────────
// 4.0 기술 연구 — 군사 · 경제 · 행정 · 해양 (계열당 6단계)
//   연구력(월) = (기본 2 + 학술원 + 인구/400) × (1 + 연구 수정자)
//   각 기술은 국가 수정자(fx)를 주고, 군사 기술 일부는 실시간 전투의 유닛 능력치(battle)로 이어진다.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4;
  const T = (id, br, tier, name, desc, fx, battle) => ({ id, br, tier, name, desc, fx: fx || {}, battle: battle || null });
  W4.TECH_BRANCHES = { mil: '⚔️ 군사', eco: '💰 경제', adm: '📜 행정', nav: '⚓ 해양' };
  W4.TECHS = [
    T('drill', 'mil', 1, '정규 훈련', '군사력 +5%, 사기 +5%', { mil: 0.05, morale: 0.05 }, { hp: 0.05 }),
    T('steel', 'mil', 2, '강철 무기', '전투 유닛 공격 +8%', { mil: 0.05 }, { dmg: 0.08 }),
    T('siegecraft', 'mil', 3, '공성 공학', '공성 속도 +40%', { siege: 0.4 }),
    T('cavalry', 'mil', 4, '기병 교리', '기병 +15%, 말 생산 +20%', { cav: 0.15, horses: 0.2 }, { speed: 0.05 }),
    T('combined', 'mil', 5, '제병 협동', '군사력 +10%, 전투 체력 +8%', { mil: 0.1 }, { hp: 0.08 }),
    T('arcartillery', 'mil', 6, '마도 포병', '전투 공격 +10%, 공성 +30%', { siege: 0.3, mil: 0.05 }, { dmg: 0.1 }),
    T('rotation', 'eco', 1, '윤작', '식량 +15%', { food: 0.15 }),
    T('guilds', 'eco', 2, '길드', '금 +10%, 목재 +10%', { gold: 0.1, wood: 0.1 }),
    T('deepmining', 'eco', 3, '심층 채굴', '철·석탄·석재 +20%', { iron: 0.2, coal: 0.2, stone: 0.2 }),
    T('banking', 'eco', 4, '은행', '세금 +12%, 건설비 -10%', { tax: 0.12, build: 0.1 }),
    T('traderoutes', 'eco', 5, '교역로', '무역 +25%', { trade: 0.25 }),
    T('industry', 'eco', 6, '공방 산업', '모든 생산 +10%', { food: 0.1, wood: 0.1, iron: 0.1, stone: 0.1, gold: 0.1, coal: 0.1 }),
    T('bureaucracy', 'adm', 1, '관료제', '안정도 +5', { stab: 5 }),
    T('census', 'adm', 2, '인구 조사', '인력 +20%, 인구 증가 +20%', { manpower: 0.2, pop: 0.2 }),
    T('lawcode', 'adm', 3, '법전', '불안 -25%, 안정도 +3', { unrest: -0.25, stab: 3 }),
    T('governors', 'adm', 4, '총독제', '점령지 불안 -30%, 유지비 -10%', { occUnrest: -0.3, upkeep: -0.1 }),
    T('academies', 'adm', 5, '왕립 학회', '연구 +20%', { research: 0.2 }),
    T('centralism', 'adm', 6, '중앙 집권', '세금 +10%, 안정도 +5', { tax: 0.1, stab: 5 }),
    T('shipbuilding', 'nav', 1, '조선술', '함선 건조비 -15%', { shipCost: 0.15 }),
    T('navigation', 'nav', 2, '항해술', '함대 이동 +1, 무역 +10%', { fleetMove: 1, trade: 0.1 }),
    T('galleons', 'nav', 3, '대형 범선', '함선 전투력 +20%', { naval: 0.2 }),
    T('blockade', 'nav', 4, '봉쇄 전술', '봉쇄 효과 +50%', { blockade: 0.5 }),
    T('amphibious', 'nav', 5, '상륙전', '상륙 불이익 절반', { landing: 0.5 }),
    T('admiralty', 'nav', 6, '해군 본부', '함선 전투력 +20%, 유지비 -20%', { naval: 0.2, navUpkeep: 0.2 }),
  ];
  W4.TECH_INDEX = Object.fromEntries(W4.TECHS.map(t => [t.id, t]));
  W4.techCost = (t) => Math.round(25 * Math.pow(1.55, t.tier - 1));

  W4.techMods = (w, id) => { const out = {}, R = w.nations[id].research; if (!R) return out; for (const tid of R.done) { const t = W4.TECH_INDEX[tid]; for (const k in t.fx) out[k] = (out[k] || 0) + t.fx[k]; } return out; };
  // 실시간 전투로 넘길 유닛 능력치 보정
  W4.techBattle = (w, id) => { const out = {}; for (const tid of w.nations[id].research.done) { const b = W4.TECH_INDEX[tid].battle; if (b) for (const k in b) out[k] = (out[k] || 0) + b[k]; } return out; };
  W4.canResearch = (w, id, tid) => {
    const t = W4.TECH_INDEX[tid], R = w.nations[id].research; if (!t || R.done.includes(tid)) return false;
    return t.tier === 1 || W4.TECHS.some(x => x.br === t.br && x.tier === t.tier - 1 && R.done.includes(x.id));
  };
  W4.Act = W4.Act || {};
  W4.Act.research = (w, id, tid) => { if (!W4.canResearch(w, id, tid)) return { ok: false, msg: '연구할 수 없습니다' }; const R = w.nations[id].research; if (R.cur !== tid) { R.cur = tid; } return { ok: true }; };

  W4.system({
    id: 'tech', order: 20,
    init(w) { for (const n of W4.NATIONS) w.nations[n.id].research = { done: [], cur: null, prog: 0, pref: null }; },
    month(w) {
      for (const n of W4.NATIONS) {
        const N = w.nations[n.id]; if (!N.alive) continue;
        const R = N.research, pts = W4.nationStats(w, n.id).research;
        R.rate = pts;
        if (!R.cur || !W4.canResearch(w, n.id, R.cur)) R.cur = W4.autoTech ? W4.autoTech(w, n.id) : null;
        if (!R.cur) continue;
        R.prog += pts;
        const t = W4.TECH_INDEX[R.cur];
        if (R.prog >= W4.techCost(t)) {
          R.prog -= W4.techCost(t); R.done.push(t.id); R.cur = null;
          W4.calcMods(w, n.id);
          w.event(`${n.name}: ${t.name} 연구 완료`, 'tech', n.id);
        }
      }
    },
  });
  // 기본 연구 선택(플레이어가 고르지 않았을 때): 선호 계열 → 가장 싼 기술
  W4.autoTech = (w, id) => {
    const R = w.nations[id].research;
    const opts = W4.TECHS.filter(t => W4.canResearch(w, id, t.id));
    if (!opts.length) return null;
    const pref = R.pref || ({ conqueror: 'mil', builder: 'eco', trader: 'nav', zealot: 'adm', opportunist: 'mil' })[w.def(id).ai] || 'eco';
    opts.sort((a, b) => (a.tier - (a.br === pref ? 0.6 : 0)) - (b.tier - (b.br === pref ? 0.6 : 0)) || a.id.localeCompare(b.id));
    return opts[0].id;
  };
})();
