// ─────────────────────────────────────────────
// 4.0 세계 전투 ↔ 실시간 전투 엔진 연결
//   W4.toBattle(w, region, attackers, defenders) → 실시간 전투 시나리오
//     · 병과·국가 계열 → 실제 유닛 종류, 병력 비율 유지 (총 ~1400기 이하로 축척)
//     · 지역 지형 → 전장 지형, 계절·대륙 → 날씨, 요새(2 이상) → 성벽·성채 공성전
//     · 기술(군사) → 유닛 능력치, 군단 사기 → 시작 사기, 군단 보급 → 보급량·탄약
//     · 플레이어 측에는 스킬 트리·성장·직업 분기·장비(save.mods)를 그대로 적용
//     · 3.1 경로 탐색·전술 AI·협공·보급·탄약·리플레이가 그대로 동작
//   W4.applyBattle(w, link, battle) → 생존 비율을 군단에 반영하고 세계 전투 기록·전쟁 점수 갱신
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, A = W4.Army;
  const CLS = Object.keys(W4.UNIT_CLASSES);
  const POOL = {
    inf: (f) => f.includes('square') ? ['shieldman', 'guardian', 'soldier', 'spearman'] : ['soldier', 'spearman', 'shieldman', 'swordsman'],
    arc: (f) => f.includes('triangle') ? ['archer', 'crossbow', 'javelin'] : ['archer', 'crossbow'],
    cav: (f) => f.includes('diamond') ? ['cavalry', 'scout', 'assassin'] : ['cavalry', 'scout'],
    sie: () => ['catapult', 'ballista'],
    mag: (f) => f.includes('pentagon') ? ['mage', 'storm', 'frost', 'elementalist', 'healer'] : ['mage', 'frost', 'healer'],
  };
  const TERR = { plains: 'plain', forest: 'forest', hills: 'plain', mountains: 'mountain', desert: 'desert', swamp: 'swamp', tundra: 'snow', coast: 'river' };

  W4.battleWeather = (w, i) => {
    const r = w.map.regions[i], m = w.month, cont = W4.CONTINENTS[r.cont].id, x = w.rand();
    if (r.terrain === 'tundra' || (cont === 'bor' && (m === 12 || m <= 2))) return x < 0.5 ? 'blizzard' : 'clear';
    if (r.terrain === 'desert') return x < 0.35 ? 'sandstorm' : 'clear';
    if (r.terrain === 'swamp' || r.terrain === 'coast') return x < 0.3 ? 'fog' : x < 0.5 ? 'rain' : 'clear';
    return x < 0.15 ? 'rain' : x < 0.22 ? 'wind' : 'clear';
  };
  // 국가 기술 → 전투 수정자 (모든 계열에 적용)
  function techMods(w, id, base) {
    const m = base ? { unlocks: base.unlocks, stat: base.stat.slice(), patch: base.patch.slice(), popBonus: 0, goldBonus: 0 } : { unlocks: new Set(), stat: [], patch: [], popBonus: 0, goldBonus: 0 };
    const tb = W4.techBattle(w, id), M = w.nations[id].mods || {};
    const fams = Object.keys(SW.FAMILIES || { circle: 1, triangle: 1, square: 1, pentagon: 1, hexagon: 1, diamond: 1 });
    for (const f of fams) {
      for (const [k, v] of Object.entries(tb)) m.stat.push({ t: 'family:' + f, stat: k, mul: v });
      if (M.mil) m.stat.push({ t: 'family:' + f, stat: 'dmg', mul: M.mil * 0.5 });
    }
    return m;
  }

  W4.toBattle = (w, i, atk, dfn, opts = {}) => {
    const r = w.map.regions[i], s = w.state.regions[i];
    const total = [...atk, ...dfn].reduce((x, a) => x + A.size(a), 0);
    const per = Math.min(30, (opts.maxUnits || 1400) / Math.max(1, total));      // 대대(1,000명)당 실제 유닛 수
    const big = total * per > 700;
    const W = big ? 2400 : 1600, H = big ? 1350 : 900;
    const seed = (w.turn * 1009 + i * 31 + w.day) >>> 0;
    const fort = (s.fort || 0) >= 2 && w.controller(i) === dfn[0].owner;
    // 플레이어가 있으면 플레이어 측이 team 0
    const playerSide = w.player && dfn.some(a => a.owner === w.player) ? 'def' : 'att';
    const sides = playerSide === 'def' ? [dfn, atk] : [atk, dfn];
    const defTeam = playerSide === 'def' ? 0 : 1;
    const terrain = new SW.Terrain(W, H).generate(fort ? 'plain' : TERR[r.terrain] || 'plain', seed);
    let units = [], squads = [];
    let F = null;
    if (fort) { F = SW.buildFort(W, H, defTeam === 1 ? 'right' : 'left', defTeam, terrain, s.fort >= 3 ? 1.15 : 1); units.push(...F.units); }
    const rng = SW.makeRng(seed);
    sides.forEach((list, team) => {
      const owner = list[0].owner, fam = w.def(owner).fam;
      const zone = F && team === defTeam ? { x0: F.inner.x0 + 30, x1: F.inner.x1 - 20, y0: F.inner.y0 + 20, y1: F.inner.y1 - 20 }
        : team === 0 ? { x0: 50, x1: W * 0.33, y0: 60, y1: H - 60 } : { x0: W * 0.67, x1: W - 50, y0: 60, y1: H - 60 };
      // 병과별 합계
      const tot = {}; for (const c of CLS) tot[c] = list.reduce((x, a) => x + (a.u[c] || 0), 0);
      // 열 배치: 공성·마법(후방) → 궁병 → 보병(전방), 기병은 양 측면
      const depthOrder = team === 0 ? ['sie', 'mag', 'arc', 'inf'] : ['inf', 'arc', 'mag', 'sie'];
      const colW = (zone.x1 - zone.x0) / 4;
      for (const c of CLS) {
        const n = Math.round(tot[c] * per); if (n <= 0) continue;
        const pool = POOL[c](fam).filter(id => SW.UNITS[id]);
        const sq = squads.length; squads.push({ team, name: `${team === defTeam && F ? '수비 ' : ''}${W4.UNIT_CLASSES[c].name}대`, order: 'free' });
        for (let k = 0; k < n; k++) {
          const type = pool[k % pool.length];
          let x, y;
          if (c === 'cav') { const top = k % 2 === 0; x = zone.x0 + rng() * (zone.x1 - zone.x0); y = top ? zone.y0 + rng() * (zone.y1 - zone.y0) * 0.2 : zone.y1 - rng() * (zone.y1 - zone.y0) * 0.2; }
          else { const col = depthOrder.indexOf(c); x = zone.x0 + colW * col + rng() * colW; y = zone.y0 + rng() * (zone.y1 - zone.y0); }
          units.push({ type, team, x, y, sq });
        }
      }
      // 지휘관 (가장 강한 군단의 장군)
      if (SW.UNITS.commander) { const sq = squads.length; squads.push({ team, name: '지휘부', order: 'hold' }); units.push({ type: 'commander', team, x: team === 0 ? zone.x0 + 20 : zone.x1 - 20, y: (zone.y0 + zone.y1) / 2, sq, vip: true }); }
    });
    units = units.filter(u => !terrain.blocked(u.x, u.y));
    const morale = sides.map(list => Math.round((list.reduce((x, a) => x + a.morale * A.size(a), 0) / Math.max(0.01, list.reduce((x, a) => x + A.size(a), 0)) - 1) * 40));
    const supply = sides.map(list => Math.round(Math.min(...list.map(a => a.supply)) * 100));
    const pers = sides.map(list => w.def(list[0].owner).pers);
    const playerTeam = w.player && sides[0].some(a => a.owner === w.player) ? 0 : null;
    const mods = sides.map((list, t) => techMods(w, list[0].owner, t === playerTeam && SW.save ? SW.save.mods() : null));
    const sc = {
      title: `⚔ ${r.name} 전투`, sub: `${w.def(sides[0][0].owner).name} ${sides[0].reduce((x, a) => x + A.size(a), 0).toFixed(1)}k vs ${w.def(sides[1][0].owner).name} ${sides[1].reduce((x, a) => x + A.size(a), 0).toFixed(1)}k · 1기 ≈ ${Math.round(1000 / per)}명${fort ? ' · 요새 공성' : ''}`,
      W, H, terrain: terrain.serialize(), weather: W4.battleWeather(w, i), time: w.month >= 4 && w.month <= 9 ? 'day' : 'dusk',
      units, squads, palette: 'none', pop: 0, restoreDeploy: false, noRetry: true, spectate: playerTeam === null,
      morale: true, frontline: true, supply: true, supplyOpts: { start0: supply[0], start1: supply[1] }, ammo: { start: supply },
      moraleBonus: morale, mods, ai: [playerTeam === 0 ? null : pers[0], pers[1]],
      victory: F ? { type: 'keep', defender: defTeam } : { type: 'annihilate' }, timeLimit: 480,
      setup: F ? (b) => SW.setupTraps && SW.setupTraps(b, F.traps, defTeam) : null,
    };
    const link = { region: i, att: atk.map(a => a.id), def: dfn.map(a => a.id), sideIds: sides.map(l => l.map(a => a.id)), playerTeam, per, n0: [0, 0] };
    return { sc, link };
  };

  // 실시간 전투 결과 → 세계 (생존 비율로 군단 축소, 승패는 실제 결과)
  W4.applyBattle = (w, link, b, replayId) => {
    const alive = [0, 0], start = link.n0;
    for (const u of b.units) if (u.alive && !u.def.structure && !u.def.summonOnly && u.type !== 'commander') alive[u.team]++;
    const ratio = [0, 1].map(t => (start[t] ? alive[t] / start[t] : 1));
    const armies = (ids) => ids.map(id => w.armies.find(a => a.id === id)).filter(Boolean);
    const sides = link.sideIds.map(armies);
    if (!sides[0].length || !sides[1].length) return null;
    const winTeam = b.winner === 0 || b.winner === 1 ? b.winner : (ratio[0] >= ratio[1] ? 0 : 1);
    const attIsTeam0 = link.att.includes(sides[0][0].id);
    const attTeam = attIsTeam0 ? 0 : 1;
    // 패주한 쪽도 일부는 살아 돌아온다 (전장에서 사라진 패잔병 회수 30%)
    const left = ratio.map((x, t) => Math.min(1, x + (t !== winTeam ? (1 - x) * 0.3 : (1 - x) * 0.5)));
    return A.resolve(w, link.region, armies(link.att), armies(link.def), { winner: winTeam === attTeam ? 'att' : 'def', attLeft: left[attTeam], defLeft: left[1 - attTeam], replay: replayId || null });
  };
  // 실제 전투에서 시작 유닛 수 기록 (구조물·소환·지휘관 제외)
  W4.countBattle = (link, b) => { link.n0 = [0, 0]; for (const u of b.units) if (!u.def.structure && !u.def.summonOnly && u.type !== 'commander') link.n0[u.team]++; };
})();
// 화면 없이 실제 전투 엔진으로 시나리오 실행 (시험·'엔진 자동 전투'용) — UI 의 newBattle/start 와 같은 순서
(() => {
  const W4 = SW.W4;
  W4.buildBattle = (sc, opts = {}) => {
    const b = new SW.Battle({ W: sc.W, H: sc.H, mods: sc.mods || [null, null], timeLimit: sc.timeLimit || 600, terrain: sc.terrain ? SW.Terrain.from(sc.terrain) : null, weather: sc.weather, time: sc.time,
      morale: !!sc.morale, victory: sc.victory, moraleBonus: sc.moraleBonus, visual: !!opts.visual, quality: opts.quality || 'low', seed: opts.seed || 1 });
    b.initSquads(); const ids = sc.squads.map(q => b.addSquad(q.team, q.name, q.order || 'free'));
    for (const u of sc.units) b.spawn(u.type, u.team, u.x, u.y, u.sq !== undefined || u.vip ? { sq: u.sq !== undefined ? ids[u.sq] : undefined, vip: u.vip } : undefined);
    if (sc.setup) sc.setup(b);
    if (sc.supply) { b.enableSupply(sc.supplyOpts || {}); b.enableAmmo(sc.ammo || {}); }
    return b;
  };
  W4.runBattle = (sc, link, opts = {}) => {
    const b = W4.buildBattle(sc, opts);
    W4.countBattle(link, b);
    sc.ai.forEach((p, t) => b.addAI(t, p || 'balanced'));
    if (sc.frontline) b.enableFrontline();
    b.start();
    const max = 60 * (opts.maxSec || sc.timeLimit || 480);
    for (let k = 0; k < max && !b.over; k++) b.step(1 / 60);
    return b;
  };
})();
