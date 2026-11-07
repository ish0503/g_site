// ─────────────────────────────────────────────
// 3.1 화면: 리플레이 보관함 · 직업 트리(전문화) · 보급 표시
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, fmt, go } = SW.ui;
  const S = SW.screens;
  const save = SW.save;

  function screen(id, title, back = 'menu') {
    const sc = el('section', 'screen'); sc.id = 'screen-' + id;
    sc.innerHTML = `<header class="bar"><button class="btn" data-go="${back}">← <span class="lbl">뒤로</span></button><h2>${title}</h2><div class="spacer"></div></header><div class="scr-body" id="${id}-body"></div>`;
    $('#app').insertBefore(sc, $('#toast'));
  }
  // 메뉴에 항목 추가
  const grids = $$('.menu-grid'); const last = grids[grids.length - 1];
  if (last) { const b = el('button', 'btn mbtn', '<b>리플레이 보관함</b><small>저장·공유한 전투</small>'); b.dataset.go = 'replays'; last.insertBefore(b, last.firstChild); }

  // ═════ 리플레이 보관함 ═════
  S.make_replays = () => screen('replays', '📼 리플레이 보관함');
  S.replays = async () => {
    const body = $('#replays-body');
    body.innerHTML = `<div class="panel form3"><p>전투 결과 화면의 🎬 리플레이에서 💾(보관) 또는 ⬇(파일)로 저장할 수 있습니다. 투사체·범위 효과·스킬·피해 판정·지형 변화까지 기록됩니다. 최근 12개를 브라우저에 보관합니다.</p>
      <div class="btns"><label class="btn">📂 파일에서 열기 (.gwrep)<input type="file" id="rp-file" accept=".gwrep,.json,application/json,application/gzip" hidden></label></div></div><div id="rp-list" class="cards"></div>`;
    $('#rp-file').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const R = await SW.Replay.unpack(f); SW.cmdUI.openReplay(R); } catch (err) { toast('리플레이 파일을 읽을 수 없습니다'); }
    };
    let list = [];
    try { list = await SW.Replay.list(); } catch (e) { $('#rp-list').innerHTML = '<p class="muted">이 브라우저에서는 보관함(IndexedDB)을 쓸 수 없습니다. 파일 저장·열기를 이용하세요.</p>'; return; }
    if (!list.length) { $('#rp-list').innerHTML = '<p class="muted">보관된 리플레이가 없습니다.</p>'; return; }
    $('#rp-list').innerHTML = list.map(r => `<div class="card"><div><div class="cn">${r.title}</div><div class="cd">${new Date(r.date).toLocaleString()} · ${Math.round(r.dur)}초 · 유닛 ${r.units} · ${r.winner === 0 ? '파란 군 승리' : r.winner === 1 ? '빨간 군 승리' : '무승부'} · ${(r.size / 1024).toFixed(0)}KB</div>
      <div class="row"><button class="btn small primary" data-play="${r.id}">▶ 재생</button><button class="btn small" data-dl="${r.id}">⬇ 파일</button><button class="btn small danger" data-del="${r.id}">삭제</button></div></div></div>`).join('');
    body.querySelectorAll('[data-play]').forEach(b => b.onclick = async () => { const rec = await SW.Replay.get(b.dataset.play); SW.cmdUI.openReplay(await SW.Replay.unpack(rec.blob)); });
    body.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { const rec = await SW.Replay.get(b.dataset.dl); const a = document.createElement('a'); a.href = URL.createObjectURL(rec.blob); a.download = `${rec.title.replace(/[^\w가-힣]+/g, '_')}.gwrep`; a.click(); });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await SW.Replay.remove(b.dataset.del); S.replays(); });
  };
})();
