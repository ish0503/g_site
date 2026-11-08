// ─────────────────────────────────────────────
// 4.0 세계 전쟁 기록 (연대기)
//   · 타임라인: 선전포고·종전·전투·점령·멸망·반란·통합·조약 (사건 로그는 300개로 잘리지만 연대기는 3,000개까지 유지)
//   · 전쟁별 기여도: 국가별 전투 수·승리·처치·손실·점령 지역
//   · 매년 영토·국력 스냅숏 (그래프용)
//   · 실시간 전투 리플레이 id 를 전투 기록에 연결 (리플레이 보관함에서 다시 보기)
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, War = W4.War;
  const KEEP = { war: 1, peace: 1, battle: 1, unrest: 1, diplo: 0, build: 0, tech: 0, econ: 0 };
  const C = W4.Chronicle = {};
  const contrib = (war, id) => (war.contrib = war.contrib || {})[id] || (war.contrib[id] = { battles: 0, won: 0, kills: 0, lost: 0, occupied: 0, naval: 0 });

  // 전투 기여도
  const origOnBattle = War.onBattle;
  War.onBattle = (w, rec) => {
    origOnBattle(w, rec);
    const war = War.of(w, rec.att, rec.def); if (!war) return;
    for (const [id, kills, lost] of [[rec.att, rec.defLost, rec.attLost], [rec.def, rec.attLost, rec.defLost]]) {
      const c = contrib(war, id); c.battles++; c.kills += kills; c.lost += lost; if (rec.winner === id) c.won++;
    }
    w.chron.battles.push({ t: w.turn, region: rec.region, att: rec.att, def: rec.def, winner: rec.winner, attSize: rec.attSize, defSize: rec.defSize, attLost: rec.attLost, defLost: rec.defLost, real: rec.real, replay: rec.replay, war: war.id });
    if (w.chron.battles.length > 1500) w.chron.battles.shift();
  };
  // 점령 기여도
  const origOcc = W4.onOccupy;
  W4.onOccupy = (w, i, by, prev) => {
    if (origOcc) origOcc(w, i, by, prev);
    const war = prev && prev !== 'neutral' ? War.of(w, by, prev) : null;
    if (war) contrib(war, by).occupied++;
    w.chron.occupations.push({ t: w.turn, region: i, by, from: prev });
    if (w.chron.occupations.length > 1500) w.chron.occupations.shift();
  };
  // 리플레이 id 를 나중에 연결 (UI 가 저장 후 호출)
  C.linkReplay = (w, rec, id) => { rec.replay = id; const b = w.chron.battles.slice().reverse().find(x => x.t === rec.t && x.region === rec.region && x.att === rec.att); if (b) b.replay = id; };

  function snapshot(w) {
    const regions = {}, power = {}, armies = {};
    for (const n of W4.NATIONS) { if (!w.nations[n.id].alive) continue; regions[n.id] = w.ownedRegions(n.id).length; power[n.id] = Math.round(W4.power(w, n.id)); armies[n.id] = +W4.Army.list(w, n.id).reduce((s, a) => s + W4.Army.size(a), 0).toFixed(1); }
    w.chron.snaps.push({ t: w.turn, regions, power, armies, wars: w.wars.length });
  }
  C.snapshot = snapshot;
  // 전쟁 요약 (진행 중 + 종료)
  C.wars = (w) => {
    const live = w.wars.map(x => ({ id: x.id, name: x.name, att: x.att, def: x.def, start: x.start, end: null, score: x.score, contrib: x.contrib || {}, winner: null, terms: '' }));
    const done = (w.warHistory || []).map(x => Object.assign({}, x, { contrib: x.contrib || {} }));
    return [...live, ...done].sort((a, b) => b.start - a.start);
  };

  W4.system({
    id: 'chronicle', order: 90,
    init(w) { w.chron = { timeline: [], battles: [], occupations: [], revolts: [], snaps: [] }; snapshot(w); },
    save(w, o) { o.chron = w.chron; },
    load(w, o) { w.chron = o.chron || { timeline: [], battles: [], occupations: [], revolts: [], snaps: [] }; },
    onEvent(w, e) {
      if (!w.chron || !KEEP[e.kind]) return;
      if (e.kind === 'battle') return;          // 전투는 battles 목록에 따로
      w.chron.timeline.push({ t: e.t, text: e.text, kind: e.kind, who: e.who, other: e.other, region: e.region, war: e.war });
      if (w.chron.timeline.length > 3000) w.chron.timeline.shift();
    },
    month(w) { if (w.turn % 12 === 11) snapshot(w); },
  });
})();
