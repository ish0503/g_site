// ─────────────────────────────────────────────
// 4.0 화면: 점령지 통치(지역 패널) · 세계 전쟁 기록(연표·영토 그래프·전쟁 기여도·전투·리플레이)
// ─────────────────────────────────────────────
(() => {
  const { $, toast } = SW.ui;
  const W4 = SW.W4, UI = W4.UI;
  const ym = (t) => `${1000 + Math.floor(t / 12)}.${(t % 12) + 1}`;
  // 지역 패널: 불안·통치 정책
  const prevRegion = UI.regionExtra;
  UI.regionExtra = (i) => {
    let h = prevRegion ? prevRegion(i) : '';
    const w = UI.world, id = w.player; if (!id || !w.chron) return h;
    const s = w.state.regions[i], ctrl = s.occ || s.owner;
    if (ctrl !== id) return h;
    const nonCore = s.core && s.core !== s.owner;
    h += `<h4>🏛 통치</h4><div class="small">불안 ${Math.round(s.unrest || 0)} ${s.unrest > 70 ? '⚠ 반란 위험' : ''} · ${nonCore ? `비핵심 영토 (통합까지 ${Math.max(0, 120 - (s.held || 0))}개월)` : '핵심 영토'}${s.autonomy ? ' · 자치 중 (생산 절반)' : ''}</div>
      <div class="btnrow"><button class="btn small" data-gov="pacify">🕊 회유 (💰${40 + Math.round(s.pop / 10)})</button><button class="btn small" data-gov="suppress">⚔ 진압 (주둔군 필요)</button>${s.owner === id ? `<button class="btn small" data-gov="autonomy">${s.autonomy ? '자치 철회' : '🏳 자치 부여'}</button>` : ''}</div>`;
    setTimeout(() => document.querySelectorAll('#w4-panel [data-gov]').forEach(b => b.onclick = () => {
      const k = b.dataset.gov;
      UI.act(k === 'autonomy' ? W4.Act.autonomy(w, id, i, !s.autonomy) : W4.Act[k](w, id, i));
    }));
    return h;
  };
  // 지도 툴팁에 불안 표시
  const prevTip = UI.tipExtra;
  UI.tipExtra = (i) => { const s = UI.world.state.regions[i]; return (prevTip ? prevTip(i) : '') + (s.unrest > 30 ? `<br>불안 ${Math.round(s.unrest)}` : ''); };

  UI.chronTab = 'timeline';
  UI.register('chron', '📜 기록', (p, w) => {
    if (!w.chron) { p.innerHTML = '<p class="muted">기록 없음</p>'; return; }
    const C = w.chron, tabs = { timeline: '연표', map: '영토 변화', wars: '전쟁', battles: '전투' };
    let h = `<div class="seg">${Object.entries(tabs).map(([k, v]) => `<button data-ct="${k}" class="${UI.chronTab === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    if (UI.chronTab === 'timeline') {
      const list = C.timeline.slice(-80).reverse();
      h += '<div class="w4tl">' + list.map(e => `<div class="small"><span class="muted">${ym(e.t)}</span> ${e.text}</div>`).join('') + '</div>';
    } else if (UI.chronTab === 'map') {
      h += chart(w);
      const last = C.snaps[C.snaps.length - 1];
      if (last) h += '<table class="w4t"><tr><th></th><th>국가</th><th>지역</th><th>국력</th><th>병력</th></tr>' + Object.keys(last.regions).sort((a, b) => last.regions[b] - last.regions[a]).map(id => `<tr><td>${UI.flagHTML(id)}</td><td>${w.def(id).name}</td><td>${last.regions[id]}</td><td>${last.power[id]}</td><td>${last.armies[id]}k</td></tr>`).join('') + '</table>';
    } else if (UI.chronTab === 'wars') {
      for (const x of W4.Chronicle.wars(w).slice(0, 20)) {
        const rows = Object.entries(x.contrib).sort((a, b) => b[1].kills - a[1].kills);
        h += `<div class="w4war"><b>${x.name}</b> <span class="small muted">${ym(x.start)} ~ ${x.end != null ? ym(x.end) : '진행 중'}</span><div class="small">${x.end != null ? (x.winner ? w.def(x.winner).name + ' 승 · ' : '백지 평화 · ') + (x.terms || '') : '전쟁 점수 ' + Math.round(x.score)}</div>
          ${rows.length ? `<table class="w4t"><tr><th>국가</th><th>전투</th><th>승</th><th>처치</th><th>손실</th><th>점령</th></tr>${rows.map(([id, c]) => `<tr><td>${UI.flagHTML(id)} ${w.def(id).name.split(' ')[0]}</td><td>${c.battles}</td><td>${c.won}</td><td>${c.kills.toFixed(1)}k</td><td>${c.lost.toFixed(1)}k</td><td>${c.occupied}</td></tr>`).join('')}</table>` : '<div class="small muted">기여 기록 없음</div>'}</div>`;
      }
    } else {
      const list = C.battles.slice(-40).reverse();
      h += list.map((b, k) => `<div class="small">${ym(b.t)} <b>${w.map.regions[b.region].root}</b>: ${w.def(b.att).name.split(' ')[0]} ${b.attSize}k vs ${w.def(b.def).name.split(' ')[0]} ${b.defSize}k → <b>${w.def(b.winner).name.split(' ')[0]}</b> 승 (손실 ${b.attLost}/${b.defLost}k)${b.real ? ' ⚔실전' : ''}${b.replay ? ` <button class="btn small" data-rp="${b.replay}">▶ 리플레이</button>` : ''}</div>`).join('') || '<p class="muted small">전투 없음</p>';
    }
    p.innerHTML = h;
    p.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { UI.chronTab = b.dataset.ct; UI.show('chron'); });
    p.querySelectorAll('[data-rp]').forEach(b => b.onclick = async () => {
      try { const rec = await SW.Replay.get(b.dataset.rp); if (!rec) { toast('리플레이가 보관함에 없습니다 (최근 12개만 보관)'); return; } SW.cmdUI.openReplay(await SW.Replay.unpack(rec.blob), 'world4'); }
      catch (e) { toast('리플레이를 열 수 없습니다'); }
    });
  });
  // 영토 변화 그래프 (상위 8개국 지역 수, SVG)
  function chart(w) {
    const S = w.chron.snaps; if (S.length < 2) return '<p class="small muted">1년 이상 지나면 그래프가 표시됩니다</p>';
    const ids = W4.NATIONS.map(n => n.id).sort((a, b) => Math.max(...S.map(s => s.regions[b] || 0)) - Math.max(...S.map(s => s.regions[a] || 0))).slice(0, 8);
    const W = 300, H = 140, maxR = Math.max(10, ...S.flatMap(s => ids.map(id => s.regions[id] || 0)));
    const x = (k) => 20 + k / (S.length - 1) * (W - 30), y = (v) => H - 15 - v / maxR * (H - 25);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="w4chart"><line x1="20" y1="${H - 15}" x2="${W - 10}" y2="${H - 15}" stroke="#556"/>`;
    for (const id of ids) { const col = W4.NATIONS[W4.NATION_INDEX[id]].color; svg += `<polyline fill="none" stroke="${col}" stroke-width="2" points="${S.map((s, k) => `${x(k).toFixed(1)},${y(s.regions[id] || 0).toFixed(1)}`).join(' ')}"/>`; }
    svg += `<text x="20" y="10" fill="#aab" font-size="9">지역 수 (최대 ${maxR})</text><text x="${W - 10}" y="${H - 3}" fill="#aab" font-size="9" text-anchor="end">${ym(S[S.length - 1].t)}</text><text x="20" y="${H - 3}" fill="#aab" font-size="9">${ym(S[0].t)}</text></svg>`;
    return svg + `<div class="small">${ids.map(id => `<span style="color:${W4.NATIONS[W4.NATION_INDEX[id]].color}">■</span> ${w.def(id).name.split(' ')[0]}`).join(' ')}</div>`;
  }
  UI.tabOrder = ['region', 'state', 'army', 'navy', 'wars', 'diplo', 'tech', 'chron', 'nations'];
})();
