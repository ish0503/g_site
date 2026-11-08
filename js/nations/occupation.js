// ─────────────────────────────────────────────
// 4.0 점령지 통치 · 불안 · 반란 · 영토 통합
//   불안(0~100, 지역 생산 감소): 비핵심 영토·낮은 안정도·전쟁 피로·외국 점령으로 오르고, 주둔군·높은 안정도로 내린다.
//   정책: 회유(금) · 진압(군단 주둔 시, 인구·안정도 손실) · 자치(생산 절반, 매달 불안 크게 감소)
//   반란(불안 70 초과, 확률): 주둔군이 강하면 진압, 아니면 원래 주인(핵심 국가)에게 돌아가거나 자유 영지로 독립
//   통합: 120개월(총독제 90개월) 소유하면 핵심 영토가 된다 → 원래 주인의 '핵심 영토' 전쟁 명분이 사라진다
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4, clamp = W4.clamp, A = W4.Army;
  const garrison = (w, i, id) => A.at(w, i).filter(a => a.owner === id).reduce((s, a) => s + A.power(w, a), 0);

  function monthUnrest(w) {
    for (let i = 0; i < w.state.regions.length; i++) {
      const s = w.state.regions[i], o = s.owner; if (o === 'neutral') { s.unrest = Math.max(0, (s.unrest || 0) - 2); continue; }
      const N = w.nations[o]; if (!N || !N.alive) continue;
      const M = N.mods || {};
      s.held = (s.held || 0) + 1;
      let d = -1.5;
      const nonCore = s.core && s.core !== o;
      if (nonCore) d += 2.2 * (1 + (M.unrest || 0));
      if (N.stab < 30) d += 2; else if (N.stab > 65) d -= 1;
      d += N.exhaustion / 40;
      if (s.occ && s.occ !== o) d += 3 * (1 + ((w.nations[s.occ].mods || {}).occUnrest || 0));     // 외국 점령에 대한 저항
      if (garrison(w, i, s.occ || o) > 0) d -= 3;
      if (s.autonomy) d -= 3;
      if (s.pacified && s.pacified > w.turn) d -= 2;
      s.unrest = clamp((s.unrest || 0) + d, 0, 100);
      // 통합
      const need = 120 - (W4.techMods(w, o).occUnrest ? 30 : 0);
      if (nonCore && s.held >= need && !s.occ) { const prev = s.core; s.core = o; w.event(`${w.map.regions[i].name}: ${w.def(o).name} 의 핵심 영토로 통합 (이전 ${prev === 'neutral' ? '자유 영지' : w.def(prev).name})`, 'unrest', o, { region: i }); }
      // 반란
      if (s.unrest > 70 && w.rand() < (s.unrest - 70) / 120) revolt(w, i);
    }
  }
  function revolt(w, i) {
    const s = w.state.regions[i], r = w.map.regions[i], o = s.owner, ctrl = s.occ || o;
    const rebels = (s.pop / 50) * (s.unrest / 50) * (1 + (W4.TERRAIN[r.terrain].def));
    const g = garrison(w, i, ctrl);
    if (g > rebels * 2) {           // 진압
      for (const a of A.at(w, i).filter(a => a.owner === ctrl)) for (const c in a.u) a.u[c] *= 0.92;
      s.unrest = 35; s.pop *= 0.98;
      w.event(`🔥 ${r.name} 반란 진압 (${w.def(ctrl).name})`, 'unrest', ctrl, { region: i });
      (w.chron && w.chron.revolts.push({ t: w.turn, region: i, owner: ctrl, result: 'suppressed' }));
      return;
    }
    if (s.occ && s.occ !== o) {     // 점령지 봉기: 점령 해제
      s.occ = null; s.unrest = 40;
      w.event(`🔥 ${r.name} 봉기 — ${w.def(ctrl).name} 점령군 축출`, 'unrest', ctrl, { region: i, other: o });
      (w.chron && w.chron.revolts.push({ t: w.turn, region: i, owner: ctrl, result: 'expelled' }));
      return;
    }
    // 분리: 핵심 국가가 살아 있으면 그쪽으로, 아니면 자유 영지
    const to = s.core && s.core !== o && s.core !== 'neutral' && w.nations[s.core].alive ? s.core : 'neutral';
    if (W4.cityOf(w, i) && w.map.regions[i].city && w.map.regions[i].city.capital && w.ownedRegions(o).length > 1 && to === 'neutral') { s.unrest = 50; return; }   // 수도는 독립하지 않음
    s.owner = to; s.occ = null; s.unrest = 20; s.held = 0;
    if (to === 'neutral') s.core = 'neutral';
    w.nations[o].stab -= 5;
    w.event(`🔥 ${r.name} 반란 성공 — ${to === 'neutral' ? '자유 영지로 독립' : w.def(to).name + ' 에 귀속'}`, 'unrest', o, { region: i, other: to });
    (w.chron && w.chron.revolts.push({ t: w.turn, region: i, owner: o, result: to }));
    for (const a of A.at(w, i).filter(a => a.owner === o)) A.sendHome(w, o);
    if (W4.War) W4.War.checkDeaths(w);
  }
  W4.revolt = revolt;

  // ── 점령지 통치 정책 ──
  W4.Act = W4.Act || {};
  W4.Act.pacify = (w, id, i) => {
    const s = w.state.regions[i], N = w.nations[id];
    if ((s.occ || s.owner) !== id) return { ok: false, msg: '통제 중인 지역이 아닙니다' };
    const cost = 40 + Math.round(s.pop / 10); if (N.res.gold < cost) return { ok: false, msg: `금 ${cost} 필요` };
    N.res.gold -= cost; s.unrest = Math.max(0, s.unrest - 20); s.pacified = w.turn + 6;
    return { ok: true };
  };
  W4.Act.suppress = (w, id, i) => {
    const s = w.state.regions[i];
    if ((s.occ || s.owner) !== id) return { ok: false, msg: '통제 중인 지역이 아닙니다' };
    if (!(garrison(w, i, id) > 0)) return { ok: false, msg: '지역에 군단이 있어야 합니다' };
    s.unrest = Math.max(0, s.unrest - 35); s.pop *= 0.97; w.nations[id].stab -= 2; w.nations[id].ae = (w.nations[id].ae || 0) + 1;
    return { ok: true };
  };
  W4.Act.autonomy = (w, id, i, on) => {
    const s = w.state.regions[i]; if (s.owner !== id) return { ok: false, msg: '자국 지역이 아닙니다' };
    s.autonomy = !!on; return { ok: true };
  };
  // 자치 지역은 생산 절반 (regionProd 감싸기)
  const origProd = W4.regionProd;
  W4.regionProd = (w, i, forId) => { const p = origProd(w, i, forId); if (w.state.regions[i].autonomy) for (const k in p) p[k] *= 0.5; return p; };

  W4.system({ id: 'unrest', order: 55, month(w) { monthUnrest(w); } });
})();
