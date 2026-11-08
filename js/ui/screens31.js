// ─────────────────────────────────────────────
// 3.1 화면: 리플레이 보관함 · 직업 분기 트리 · 특성
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
  // ═════ 군대 관리: 직업 분기 트리 · 특성 (기존 화면 뒤에 덧붙임) ═════
  const origArmy = S.army;
  S.army = () => {
    origArmy();
    const det = $('.army-det'); if (!det) return;
    const on = $('.army-list .pu.on'); const type = on && on.dataset.u; if (!type) return;
    // 목록 이름을 현재 직업 이름으로
    $$('.army-list .pu').forEach(x => { const n = SW.classNameOf(x.dataset.u); if (n) x.querySelector('.pn').textContent = n; });
    const g = SW.growthOf(type), T = SW.CLASS_TREES[type], evo = SW.EVOLUTIONS[type];
    g.traits = g.traits || [];
    const box = el('div', 'ctree');
    let h = '';
    if (T) {
      const node = (k, lvReq, picked, locked) => {
        const n = T[k], sk = n.skill && SW.ABILITIES[n.skill];
        return `<div class="cnode ${picked ? 'on' : ''} ${locked ? 'off' : ''}" ${!picked && !locked ? `data-cn="${k}"` : ''}><b>${n.name}</b><span class="small">${n.desc}</span>${sk ? `<span class="small muted">🌀 ${sk.name}: ${sk.desc}</span>` : ''}${!picked && !locked ? `<span class="small pick">${lvReq === 10 ? `선택 ${SW.costText(SW.SUB_COST)}` : '선택 (무료)'}</span>` : ''}</div>`;
      };
      h += `<h4>🌳 직업 분기 (Lv.5 분기 → Lv.10 상위 직업)</h4>`;
      h += `<div class="ctrow">${['a', 'b'].map(k => node(k, 5, g.cls === k, g.lv < 5 || (g.cls && g.cls !== k))).join('')}</div>`;
      if (g.cls) {
        const subs = [g.cls + '1', g.cls + '2'];
        h += `<div class="ctrow">${subs.map(k => node(k, 10, g.sub === k, g.lv < 10 || (g.sub && g.sub !== k) || g.evo)).join('')}</div>`;
      } else h += '<div class="small muted">Lv.5 에서 갈래를 고르면 Lv.10 상위 직업 두 가지가 열립니다.</div>';
      if (evo) h += `<div class="small muted">Lv.10 에서는 상위 직업과 기존 진화(${evo.name}) 중 하나만 적용됩니다.${g.evo ? ' 이 유닛은 기존 진화를 사용 중이며, 상위 직업으로 바꾸려면 진화를 해제하세요 (진화 비용 💎' + evo.cost + ' 환급).' : ''}</div>`;
      if (g.evo && evo) h += `<button class="btn small" id="evo-undo">진화 해제 (환급)</button>`;
      if (g.cls) h += ` <a href="#" id="cls-reset" class="small">직업 초기화 (💎1, 상위 직업 비용은 환급되지 않음)</a>`;
    }
    if (T) {
      // 3.2: 전문화 통합 — Lv5 에 갈래(직업)와 보조 전문화를 함께 고른다
      h += `<h4>🎯 보조 전문화 (Lv.5)</h4><div class="btnrow">` + Object.entries(SW.SPECS).map(([k, sp]) => `<button class="btn small ${g.spec === k ? 'primary' : ''}" data-spec2="${k}" ${g.lv < 5 || g.spec ? 'disabled' : ''} title="${sp.desc}">${sp.icon} ${sp.name}</button>`).join('') + `</div>${g.spec ? `<div class="small">${SW.SPECS[g.spec].name}: ${SW.SPECS[g.spec].desc}</div>` : '<div class="small muted">직업 갈래와 함께 적용되는 능력치 특화</div>'}`;
    }
    h += `<h4>✨ 특성 (Lv.3 · Lv.7)</h4>`;
    for (const [tier, lv] of [[1, 3], [2, 7]]) {
      const cur = g.traits[tier - 1];
      h += `<div class="row">${Object.entries(SW.TRAITS).filter(([, t]) => t.tier === tier).map(([id, t]) => `<button class="btn small ${cur === id ? 'primary' : ''}" data-tr="${tier}:${id}" ${g.lv < lv || cur ? 'disabled' : ''} title="${t.desc}">${t.icon} ${t.name}</button>`).join('')}</div>`;
    }
    const combos = SW.comboOf(g.traits);
    h += `<div class="small">${combos.length ? combos.map(c => `🔗 <b>${c.name}</b>: ${c.desc}`).join(' · ') : '<span class="muted">조합: ' + SW.TRAIT_COMBOS.map(c => `${SW.TRAITS[c.a].name}+${SW.TRAITS[c.b].name}=${c.name}`).join(', ') + '</span>'}</div>`;
    if (g.traits.some(Boolean)) h += `<a href="#" id="tr-reset" class="small">특성 초기화 (💎1)</a>`;
    box.innerHTML = h;
    det.insertBefore(box, $('#army-card'));
    if (T) {   // 기존 전문화 줄은 직업 트리 패널로 옮겼으므로 숨긴다 (초기화 링크는 유지)
      for (const h4 of det.querySelectorAll(':scope > h4')) if (h4.textContent.startsWith('전문화')) { h4.hidden = true; const row = h4.nextElementSibling; if (row && row.classList.contains('row')) row.hidden = true; }
    }
    box.querySelectorAll('[data-spec2]').forEach(x => x.onclick = () => { g.spec = x.dataset.spec2; redo(); });
    if (T && g.sub) { const ev = $('#evo'); if (ev) ev.disabled = true; }
    const redo = () => { save.write(); S.army(); };
    box.querySelectorAll('[data-cn]').forEach(x => x.onclick = () => {
      const k = x.dataset.cn;
      if (k.length === 1) { g.cls = k; g.sub = null; toast(`${T[k].name}(으)로 전직`); return redo(); }
      if (!SW.pay(SW.SUB_COST)) return toast('자원 부족 ' + SW.costText(SW.SUB_COST));
      g.sub = k; toast(`${T[k].name}(으)로 전직!`); redo();
    });
    const eu = $('#evo-undo'); if (eu) eu.onclick = () => { g.evo = false; SW.gain({ crystal: evo.cost }); toast('진화 해제 (수정 환급)'); redo(); };
    const cr = $('#cls-reset'); if (cr) cr.onclick = (e) => { e.preventDefault(); if (!SW.pay({ crystal: 1 })) return toast('수정 부족'); g.cls = null; g.sub = null; redo(); };
    box.querySelectorAll('[data-tr]').forEach(x => x.onclick = () => { const [tier, id] = x.dataset.tr.split(':'); g.traits[+tier - 1] = id; redo(); });
    const tr = $('#tr-reset'); if (tr) tr.onclick = (e) => { e.preventDefault(); if (!SW.pay({ crystal: 1 })) return toast('수정 부족'); g.traits = []; redo(); };
  };
})();
