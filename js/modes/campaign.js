// ─────────────────────────────────────────────
// 캠페인 · 정복 · 외교 · 경제 · 보급
//   세계 지도(18개 지역) → 지역 선택 → 전투 → 점령 → 자원·성장 → 다음 지역
//   AI 세력끼리도 전쟁하고 영토를 다툰다. 동맹·휴전·교역·선전포고.
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  const FACTIONS = {
    player: { name: '기하 연합', color: '#3f7cff', pool: null, pers: 'balanced' },
    square: { name: '사각 제국', color: '#d05050', fam: ['square', 'circle'], pers: 'defensive', desc: '중장갑 방어 위주. 요새가 많다.' },
    triangle: { name: '삼각 왕국', color: '#d9a83a', fam: ['triangle', 'circle'], pers: 'artillery', desc: '궁병과 공성 병기의 나라.' },
    pentagon: { name: '오각 마탑', color: '#a064e6', fam: ['pentagon', 'hexagon'], pers: 'balanced', desc: '마법사와 지원가의 탑. 마나가 풍부.' },
    diamond: { name: '마름모 유목민', color: '#3fb27f', fam: ['diamond', 'circle'], pers: 'flanker', desc: '빠른 기동대와 암살자.' },
  };
  SW.FACTIONS = FACTIONS;
  const AI_F = ['square', 'triangle', 'pentagon', 'diamond'];

  // 지역: [id, 이름, x, y, 이웃, 지형, 기후, 초기 소유, 특수]
  const R = [
    ['home', '기하의 요람', 120, 310, ['plains', 'woods', 'hills'], 'plain', 'temperate', 'player', 'capital'],
    ['plains', '푸른 평원', 260, 200, ['home', 'river', 'ironpass'], 'plain', 'temperate', 'neutral'],
    ['woods', '속삭이는 숲', 250, 420, ['home', 'swamp', 'river'], 'forest', 'temperate', 'neutral'],
    ['hills', '바람 언덕', 150, 500, ['home', 'swamp'], 'mountain', 'temperate', 'neutral'],
    ['river', '대하 나루', 400, 310, ['plains', 'woods', 'desert', 'crossing'], 'river', 'temperate', 'neutral'],
    ['swamp', '안개 늪', 330, 540, ['woods', 'hills', 'crossing'], 'swamp', 'wet', 'pentagon'],
    ['ironpass', '철의 관문', 420, 120, ['plains', 'fortress', 'desert'], 'mountain', 'cold', 'square'],
    ['fortress', '사각 요새', 570, 80, ['ironpass', 'empire', 'tundra'], 'plain', 'cold', 'square', 'fort'],
    ['empire', '사각 제국 수도', 720, 140, ['fortress', 'tundra', 'volcano'], 'plain', 'cold', 'square', 'capital'],
    ['tundra', '얼어붙은 벌판', 640, 250, ['fortress', 'empire', 'desert', 'oasis'], 'snow', 'cold', 'square'],
    ['desert', '황금 사막', 550, 330, ['river', 'ironpass', 'tundra', 'oasis', 'crossing'], 'desert', 'dry', 'triangle'],
    ['oasis', '오아시스 왕궁', 720, 380, ['desert', 'tundra', 'volcano', 'kingdom'], 'desert', 'dry', 'triangle', 'capital'],
    ['crossing', '세 갈래 길', 500, 470, ['river', 'swamp', 'desert', 'tower', 'steppe'], 'plain', 'temperate', 'neutral'],
    ['kingdom', '삼각 성채', 860, 430, ['oasis', 'volcano', 'steppe'], 'plain', 'dry', 'triangle', 'fort'],
    ['tower', '오각 마탑', 640, 560, ['crossing', 'steppe', 'abyss'], 'swamp', 'wet', 'pentagon', 'capital'],
    ['abyss', '심연의 균열', 820, 580, ['tower', 'steppe'], 'volcanic', 'storm', 'neutral', 'boss'],
    ['steppe', '끝없는 초원', 780, 500, ['crossing', 'tower', 'kingdom', 'abyss', 'nomad'], 'plain', 'temperate', 'diamond'],
    ['nomad', '유목민 대천막', 930, 560, ['steppe', 'kingdom'], 'plain', 'temperate', 'diamond', 'capital'],
    ['volcano', '화산 요새', 880, 260, ['empire', 'oasis', 'kingdom'], 'volcanic', 'dry', 'neutral', 'boss'],
  ];
  SW.CAMPAIGN_MAP = R.map(([id, name, x, y, nb, terrain, climate, owner, special]) => ({ id, name, x, y, nb, terrain, climate, owner, special }));
  const RM = Object.fromEntries(SW.CAMPAIGN_MAP.map(r => [r.id, r]));
  // 이웃 관계 대칭화
  for (const r of SW.CAMPAIGN_MAP) for (const n of r.nb) if (!RM[n].nb.includes(r.id)) RM[n].nb.push(r.id);
  const CLIMATE = {
    temperate: [['clear', 5], ['rain', 2], ['fog', 1], ['wind', 1]], cold: [['clear', 3], ['blizzard', 3], ['fog', 1]],
    dry: [['clear', 4], ['sandstorm', 3], ['wind', 1]], wet: [['rain', 3], ['fog', 3], ['clear', 2]], storm: [['storm', 4], ['rain', 2]],
  };
  const INCOME = { plain: { gold: 60, food: 30 }, forest: { gold: 30, wood: 30, food: 10 }, mountain: { gold: 30, ore: 20 }, river: { gold: 50, food: 35 },
    swamp: { gold: 25, mana: 15 }, snow: { gold: 30, ore: 15 }, desert: { gold: 45, crystal: 0.2 }, volcanic: { gold: 30, ore: 25, crystal: 0.3 } };

  const relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const pick = (list) => { const tot = list.reduce((s, x) => s + x[1], 0); let r = Math.random() * tot; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; };

  const C = SW.Campaign = {
    get s() { return SW.save.data.campaign; },
    region(id) { return RM[id]; },
    newGame(diff = 1) {
      const st = { turn: 1, diff, regions: {}, rel: {}, treaty: {}, log: [], over: false, pendingDefense: [] };
      for (const r of SW.CAMPAIGN_MAP) {
        const base = r.special === 'capital' ? 60 : r.special === 'fort' ? 45 : r.special === 'boss' ? 0 : r.owner === 'neutral' ? 18 : 30;
        st.regions[r.id] = { owner: r.owner, garrison: base, fort: r.special === 'fort' ? 2 : r.special === 'capital' ? (r.owner === 'player' ? 1 : 2) : 0 };
      }
      const all = ['player', ...AI_F];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) st.rel[relKey(all[i], all[j])] = all[i] === 'player' ? -10 : Math.round(-30 + Math.random() * 50);
      SW.save.data.campaign = st;
      this.log('새로운 정복 전쟁이 시작되었다. 기하의 요람에서 출정하라.');
      SW.save.write();
      return st;
    },
    log(text) { const st = this.s; st.log.unshift(`[${st.turn}턴] ${text}`); st.log.length = Math.min(st.log.length, 60); },
    owner(id) { return this.s.regions[id].owner; },
    rel(a, b) { return this.s.rel[relKey(a, b)] ?? 0; },
    addRel(a, b, v) { const k = relKey(a, b); this.s.rel[k] = Math.max(-100, Math.min(100, (this.s.rel[k] ?? 0) + v)); },
    treaty(a, b) { return this.s.treaty[relKey(a, b)] || null; },
    setTreaty(a, b, t, turns = 8) { this.s.treaty[relKey(a, b)] = t ? { type: t, until: this.s.turn + turns } : null; },
    atWar(a, b) { const t = this.treaty(a, b); if (t && (t.type === 'ally' || t.type === 'truce')) return false; return a === 'neutral' || b === 'neutral' || this.rel(a, b) < 0; },
    owned(f = 'player') { return SW.CAMPAIGN_MAP.filter(r => this.owner(r.id) === f); },
    playerPop() { return Math.min(200, 40 + this.owned().length * 8); },
    // 보급선: 수도와 연결된 영토만 보급
    supplied(f = 'player') {
      const cap = SW.CAMPAIGN_MAP.find(r => this.owner(r.id) === f && r.special === 'capital');
      const seen = new Set(); if (!cap) return seen;
      const q = [cap.id]; seen.add(cap.id);
      while (q.length) { const id = q.shift(); for (const n of RM[id].nb) if (!seen.has(n) && this.owner(n) === f) { seen.add(n); q.push(n); } }
      return seen;
    },
    income() {
      const sup = this.supplied(), tot = { gold: 0, food: 0, wood: 0, ore: 0, mana: 0, crystal: 0 };
      for (const r of this.owned()) {
        if (!sup.has(r.id)) continue;
        const inc = INCOME[r.terrain] || INCOME.plain;
        for (const [k, v] of Object.entries(inc)) tot[k] += v * (r.special === 'capital' ? 2 : 1);
      }
      for (const f of AI_F) { const t = this.treaty('player', f); if (t && t.type === 'trade') { tot.gold += 40; tot.food += 15; } }
      return tot;
    },
    upkeep() { return Math.round(this.playerPop() / 4); },
    canAttack(id) {
      const r = RM[id], o = this.owner(id);
      if (o === 'player') return false;
      if (!r.nb.some(n => this.owner(n) === 'player')) return false;
      const t = o !== 'neutral' && this.treaty('player', o);
      return !(t && (t.type === 'ally' || t.type === 'truce'));
    },
    // 전투 시나리오 생성
    battleFor(id, defense) {
      const st = this.s, r = RM[id], reg = st.regions[id];
      const enemyF = defense ? defense.attacker : reg.owner;
      const fac = FACTIONS[enemyF] || { fam: ['circle', 'triangle', 'square'], pers: 'balanced' };
      const allowed = SW.unitList().filter(u => (fac.fam || ['circle', 'triangle']).includes(u.family) && u.family !== 'star' && !u.summonOnly).map(u => u.id);
      const budget = Math.round((defense ? defense.power : reg.garrison) * (0.85 + 0.15 * st.diff) * (1 + st.turn * 0.025));
      const weather = pick(CLIMATE[r.climate] || CLIMATE.temperate);
      const time = Math.random() < 0.2 ? 'night' : Math.random() < 0.2 ? 'dusk' : 'day';
      const foodShort = (SW.save.data.res.food || 0) < 0;
      return {
        regionId: id, enemyFaction: enemyF, allowed, budget, terrain: r.terrain === 'volcanic' ? 'volcanic' : r.terrain, weather, time,
        siege: !defense && (reg.fort >= 2), defendFort: defense && reg.fort > 0 ? reg.fort : 0, boss: r.special === 'boss' ? (id === 'abyss' ? 'abyssMage' : 'immortalPhoenix') : null,
        pers: fac.pers, moraleBonus: foodShort ? -25 : 0, allies: this.allyHelp(id),
      };
    },
    allyHelp(id) {
      const out = [];
      for (const f of AI_F) { const t = this.treaty('player', f); if (t && t.type === 'ally' && RM[id].nb.some(n => this.owner(n) === f)) out.push({ faction: f, budget: 20 + Math.max(0, this.rel('player', f)) / 2 }); }
      return out;
    },
    resolve(id, win, frac = 0, defense) {
      const st = this.s, reg = st.regions[id], r = RM[id];
      if (defense) {
        if (win) { this.log(`${r.name} 방어 성공! ${FACTIONS[defense.attacker].name}의 공격을 격퇴했다.`); this.addRel('player', defense.attacker, -5); }
        else { reg.owner = defense.attacker; reg.garrison = Math.round(defense.power * 0.5); reg.fort = Math.max(0, reg.fort - 1); this.log(`${r.name}을(를) ${FACTIONS[defense.attacker].name}에게 빼앗겼다.`); }
      } else if (win) {
        const prev = reg.owner;
        reg.owner = 'player'; reg.garrison = 15; reg.fort = Math.max(0, reg.fort - 1);
        this.log(`${r.name} 점령!${prev !== 'neutral' ? ` (${FACTIONS[prev].name}로부터)` : ''}`);
        if (prev !== 'neutral') { this.addRel('player', prev, -20); for (const f of AI_F) if (f !== prev && this.rel(f, prev) < 0) this.addRel('player', f, 5); }
        if (r.special === 'boss') { SW.gain({ crystal: 4, mana: 40 }); this.log(`${r.name}의 보스를 처치하고 수정 4개를 얻었다.`); }
        if (r.special === 'capital' && prev !== 'neutral') this.log(`★ ${FACTIONS[prev].name}의 수도가 함락되었다!`);
      } else {
        reg.garrison = Math.max(5, Math.round(reg.garrison * (1 - frac * 0.6)));
        this.log(`${r.name} 공격 실패. 적 수비대가 약화되었다 (${reg.garrison}).`);
      }
      this.checkOver();
      SW.save.write();
    },
    autoResolve(atkPower, defPower) { const a = atkPower * (0.7 + Math.random() * 0.6), d = defPower * (0.75 + Math.random() * 0.6); return a > d; },
    checkOver() {
      const st = this.s;
      const caps = SW.CAMPAIGN_MAP.filter(r => r.special === 'capital' && r.owner !== 'player');
      if (caps.every(c => this.owner(c.id) === 'player' || (this.treaty('player', this.owner(c.id)) || {}).type === 'ally')) {
        if (!st.over) { st.over = 'win'; this.log('★★★ 세계 정복 완료! 모든 세력의 수도를 점령하거나 동맹을 맺었다.'); SW.gain({ crystal: 15, gold: 5000 }); }
      }
      if (!this.owned().length) st.over = 'lose';
    },
    // ── 외교 ──
    gift(f, gold) { if (SW.save.data.gold < gold) return false; SW.save.data.gold -= gold; this.addRel('player', f, Math.round(gold / 25)); this.log(`${FACTIONS[f].name}에 ${gold} 골드를 선물했다.`); return true; },
    propose(f, type) {
      const rel = this.rel('player', f);
      const need = { ally: 50, truce: -30, trade: 10 }[type];
      if (rel < need) { this.log(`${FACTIONS[f].name}이(가) ${type === 'ally' ? '동맹' : type === 'truce' ? '휴전' : '교역'} 제안을 거절했다 (관계 ${rel} < ${need}).`); this.addRel('player', f, -3); return false; }
      this.setTreaty('player', f, type, type === 'ally' ? 99 : type === 'truce' ? 6 : 10);
      if (type !== 'trade') this.addRel('player', f, 10);
      this.log(`${FACTIONS[f].name}과(와) ${type === 'ally' ? '동맹' : type === 'truce' ? '휴전' : '교역 협정'}을 맺었다.`);
      return true;
    },
    declareWar(f) { this.setTreaty('player', f, null); this.addRel('player', f, -40); this.log(`${FACTIONS[f].name}에 선전포고했다.`); },
    // ── 턴 종료: 수입 · 유지비 · AI 세력 행동 ──
    endTurn() {
      const st = this.s, ev = [];
      const inc = this.income(), up = this.upkeep();
      inc.food -= up;
      SW.gain(Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, k === 'crystal' ? Math.floor(v + Math.random()) : Math.round(v)])));
      const res = SW.save.data.res;
      if (res.food < 0) this.log(`⚠ 식량 부족! 다음 전투에서 사기 -25. (식량 ${Math.round(res.food)})`);
      const cut = this.owned().filter(r => !this.supplied().has(r.id));
      if (cut.length) this.log(`⚠ 보급로 차단: ${cut.map(r => r.name).join(', ')} — 수입 없음, 수비대 감소`);
      for (const r of cut) st.regions[r.id].garrison = Math.max(5, st.regions[r.id].garrison - 4);
      // AI 세력 행동
      for (const f of AI_F) {
        const mine = this.owned(f); if (!mine.length) continue;
        for (const r of mine) st.regions[r.id].garrison = Math.min(140, st.regions[r.id].garrison + 3 + (r.special === 'capital' ? 4 : 0) + st.turn * 0.2);
        if (Math.random() < 0.55) {
          const targets = [];
          for (const r of mine) for (const n of r.nb) { const o = this.owner(n); if (o !== f && this.atWar(f, o)) targets.push([r, RM[n]]); }
          if (!targets.length) continue;
          const [from, to] = targets[(Math.random() * targets.length) | 0];
          const atk = st.regions[from.id].garrison * 0.8, def = st.regions[to.id].garrison * (1 + st.regions[to.id].fort * 0.3);
          if (this.owner(to.id) === 'player') {
            st.pendingDefense.push({ region: to.id, attacker: f, power: Math.round(atk) });
            ev.push(`${FACTIONS[f].name}이(가) ${to.name}을(를) 공격해 온다!`);
          } else if (this.autoResolve(atk, def)) {
            const prev = this.owner(to.id);
            st.regions[to.id].owner = f; st.regions[to.id].garrison = Math.round(atk * 0.5); st.regions[from.id].garrison *= 0.6;
            this.log(`${FACTIONS[f].name}이(가) ${to.name}을(를) ${prev === 'neutral' ? '' : FACTIONS[prev].name + '로부터 '}빼앗았다.`);
            if (prev !== 'neutral') this.addRel(f, prev, -15);
          } else { st.regions[from.id].garrison *= 0.7; st.regions[to.id].garrison *= 0.8; }
        }
      }
      // 관계 변화: 공동의 적이 있으면 가까워진다
      for (const f of AI_F) {
        const t = this.treaty('player', f); if (t && t.until <= st.turn) { this.setTreaty('player', f, null); this.log(`${FACTIONS[f].name}과(와)의 ${t.type === 'ally' ? '동맹' : t.type === 'truce' ? '휴전' : '교역'}이 만료되었다.`); }
        this.addRel('player', f, this.rel('player', f) < 0 ? 1 : -1);
        for (const g of AI_F) if (g !== f && Math.random() < 0.2) this.addRel(f, g, Math.random() < 0.5 ? -5 : 4);
      }
      for (const r of this.owned()) st.regions[r.id].garrison = Math.min(80, st.regions[r.id].garrison + 2 + st.regions[r.id].fort);
      st.turn++;
      this.checkOver();
      SW.save.write();
      return { income: inc, events: ev };
    },
    fortify(id) {
      const cost = { gold: 200, wood: 40 };
      const reg = this.s.regions[id]; if (reg.fort >= 3 || !SW.pay(cost)) return false;
      reg.fort++; reg.garrison += 10; this.log(`${RM[id].name} 요새화 (Lv.${reg.fort})`); SW.save.write(); return true;
    },
    recruit(id) {
      const cost = { gold: 150, food: 30 };
      if (!SW.pay(cost)) return false;
      this.s.regions[id].garrison += 15; this.log(`${RM[id].name} 수비대 징집 (+15)`); SW.save.write(); return true;
    },
  };
  SW.FACTION_ORDER = AI_F;
})();
