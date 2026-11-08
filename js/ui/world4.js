// ─────────────────────────────────────────────
// 4.0 세계 전략 화면
//   지도(정치·군사·경제·지형) + 옆 패널(지역·국가·외교·군사·기술·기록)
//   이 파일은 화면 틀과 지도·지역·국가 패널을 담당하고, 다른 패널은 W4UI.tabs 에 등록된다.
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, fmt, go } = SW.ui;
  const S = SW.screens;
  const W4 = SW.W4;
  const UI = W4.UI = { tabs: {}, tabOrder: [], world: null, R: null, sel: -1, selSea: -1, tab: 'region', raf: 0 };

  // 메뉴에 4.0 분류 추가
  (() => {
    const box = $('.menu-buttons'); if (!box) return;
    const cat = el('div', 'menu-cat', '🌍 4.0 세계 전략'), g = el('div', 'menu-grid');
    for (const [id, name, sub] of [['w4menu', '세계 정복', '16개국 · 120지역 · 국가 운영과 전쟁']]) { const b = el('button', 'btn mbtn', `<b>${name}</b><small>${sub}</small>`); b.dataset.go = id; g.appendChild(b); }
    box.insertBefore(g, box.firstChild); box.insertBefore(cat, g);
  })();

  const nat = (id) => (id === 'neutral' || !id ? W4.NEUTRAL : W4.NATIONS[W4.NATION_INDEX[id]]);
  UI.nat = nat;
  UI.flag = (id, w = 30, h = 20) => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px'; c.className = 'w4flag'; W4.drawFlag(c, id); return c; };
  UI.flagHTML = (id) => `<span class="w4f" data-flag="${id}"></span>`;
  UI.fillFlags = (root) => root.querySelectorAll('[data-flag]').forEach(x => { if (!x.firstChild) x.appendChild(UI.flag(x.dataset.flag, 24, 16)); });
  UI.register = (id, label, render) => { UI.tabs[id] = { label, render }; if (!UI.tabOrder.includes(id)) UI.tabOrder.push(id); };

  // ── 화면 틀 ──
  S.make_world4 = () => {
    const sc = el('section', 'screen'); sc.id = 'screen-world4';
    sc.innerHTML = `<header class="bar w4bar"><button class="btn" id="w4-back">← <span class="lbl">나가기</span></button><h2 id="w4-title">🌍 세계</h2><div class="spacer"></div>
      <div class="seg" id="w4-modes"><button data-m="political" class="on">정치</button><button data-m="military">군사</button><button data-m="economic">경제</button><button data-m="terrain">지형</button></div>
      <div id="w4-top"></div></header>
      <div class="w4"><div class="w4-map"><canvas id="w4-cv"></canvas><div class="w4-zoom"><button class="btn small" data-z="1.3">＋</button><button class="btn small" data-z="0.77">－</button><button class="btn small" data-z="0">⤢</button></div><div id="w4-tip" class="w4-tip" hidden></div></div>
      <aside class="w4-side"><div class="tabs2" id="w4-tabs"></div><div id="w4-panel" class="w4-panel"></div></aside></div>`;
    $('#app').insertBefore(sc, $('#toast'));
    UI.R = new W4.WorldRender($('#w4-cv'));
    $$('#w4-modes button').forEach(b => b.onclick = () => { $$('#w4-modes button').forEach(x => x.classList.toggle('on', x === b)); UI.R.setMode(b.dataset.m); });
    $$('.w4-zoom button').forEach(b => b.onclick = () => { const z = +b.dataset.z, r = UI.R.cv.getBoundingClientRect(); if (!z) UI.R.fit(); else UI.R.zoom(z, r.width / 2, r.height / 2); });
    $('#w4-back').onclick = () => { if (UI.onExit) UI.onExit(); else go(UI.backTo || 'menu'); };
    W4.bindMapInput(UI.R, (id, sea) => { if (UI.pickHook && UI.pickHook(id, sea)) return; UI.sel = id; UI.selSea = id < 0 ? sea : -1; UI.R.sel = id; if (id >= 0 || sea >= 0) UI.show(UI.tabs.region ? 'region' : UI.tab); }, (id, p) => {
      UI.R.hover = id; const tip = $('#w4-tip');
      if (id < 0) { tip.hidden = true; return; }
      const r = UI.world.map.regions[id], s = UI.world.state.regions[id];
      tip.hidden = false; tip.style.left = (p.x + 14) + 'px'; tip.style.top = (p.y + 10) + 'px';
      tip.innerHTML = `<b>${r.name}</b><br>${nat(s.owner).name}${s.occ && s.occ !== s.owner ? ` · 점령: ${nat(s.occ).name}` : ''}${UI.tipExtra ? UI.tipExtra(id) : ''}`;
    });
    addEventListener('resize', () => { if (UI.R && $('#screen-world4').classList.contains('active')) UI.R.fit(); });
  };
  S.world4 = () => {
    if (!UI.world) { go('w4menu'); return; }
    cancelAnimationFrame(UI.raf);
    requestAnimationFrame(() => { UI.R.attach(UI.world); UI.show(UI.tab); loop(); });
  };
  function loop() {
    if (!$('#screen-world4').classList.contains('active')) return;
    UI.R.draw(UI.overlay ? UI.overlay() : null);
    UI.raf = requestAnimationFrame(loop);
  }
  // 세계 열기 (모드 화면에서 호출)
  UI.open = (world, opts = {}) => {
    UI.world = world; UI.sel = -1; UI.selSea = -1; UI.tab = opts.tab || 'region'; UI.backTo = opts.back || 'w4menu'; UI.onExit = opts.onExit || null;
    if (UI.R) { UI.R.sel = -1; UI.R.dirty = true; }
    go('world4');
    $('#w4-title').textContent = opts.title || '🌍 세계';
  };
  UI.refresh = () => { if (UI.R) UI.R.dirty = true; UI.show(UI.tab); if (UI.top) $('#w4-top').innerHTML = UI.top(); };
  UI.show = (tab) => {
    UI.tab = tab;
    const tabs = $('#w4-tabs'); tabs.innerHTML = UI.tabOrder.filter(t => !UI.tabs[t].hidden || !UI.tabs[t].hidden()).map(t => `<button class="${t === tab ? 'on' : ''}" data-t="${t}">${UI.tabs[t].label}</button>`).join('');
    tabs.querySelectorAll('[data-t]').forEach(b => b.onclick = () => UI.show(b.dataset.t));
    const p = $('#w4-panel'); p.innerHTML = '';
    if (UI.tabs[tab]) UI.tabs[tab].render(p, UI.world);
    UI.fillFlags(p);
    if (UI.top) { $('#w4-top').innerHTML = UI.top(); UI.fillFlags($('#w4-top')); }
  };

  // ── 지역 패널 ──
  UI.register('region', '📍 지역', (p, w) => {
    const M = w.map;
    if (UI.sel < 0 && UI.selSea >= 0) {
      const z = M.seas[UI.selSea];
      p.innerHTML = `<h3>🌊 ${z.name}</h3><div class="small muted">인접 해역 ${z.nb.length} · 해안 지역 ${z.coast.length}</div>` + (UI.seaExtra ? UI.seaExtra(UI.selSea) : '');
      return;
    }
    if (UI.sel == null || !M.regions[UI.sel]) UI.sel = -1;
    if (UI.sel < 0) { p.innerHTML = '<p class="muted">지도에서 지역을 누르면 정보가 나옵니다. 끌어서 이동, 휠·핀치로 확대합니다.</p>' + (UI.regionEmpty ? UI.regionEmpty() : ''); return; }
    const r = M.regions[UI.sel], s = w.state.regions[UI.sel], T = W4.TERRAIN[r.terrain];
    const prod = W4.regionProd ? W4.regionProd(w, r.id) : r.prod;
    p.innerHTML = `<h3>${r.city ? (r.city.capital ? '★ ' : '■ ') : ''}${r.name}</h3>
      <div class="row">${UI.flagHTML(s.owner)} <b>${nat(s.owner).name}</b>${s.occ && s.occ !== s.owner ? ` · 점령: ${UI.flagHTML(s.occ)} ${nat(s.occ).name}` : ''}</div>
      <table class="w4t"><tr><td>대륙</td><td>${W4.CONTINENTS[r.cont].name}</td></tr><tr><td>지형</td><td>${T.name} (이동 ${T.move}× · 방어 +${Math.round(T.def * 100)}%)</td></tr>
      <tr><td>인구</td><td>${fmt(Math.round(s.pop))}천</td></tr><tr><td>개발도</td><td>${s.dev}</td></tr><tr><td>요새</td><td>${s.fort ? '🏰'.repeat(s.fort) : '-'}</td></tr>
      <tr><td>도시</td><td>${r.city ? r.city.name + (r.city.capital ? ' (수도)' : '') : '-'}${r.port ? ' · ⚓ 항구' : r.coastal ? ' · 해안' : ''}</td></tr>
      <tr><td>생산/월</td><td>${Object.entries(prod).filter(([, v]) => v > 0.05).map(([k, v]) => `${W4.RES[k].icon}${v.toFixed(1)}`).join(' ')}</td></tr>
      <tr><td>이웃</td><td class="small">${r.nb.map(j => M.regions[j].root).join(', ')}</td></tr></table>` + (UI.regionExtra ? UI.regionExtra(r.id) : '');
  });
  // ── 국가 목록 ──
  UI.register('nations', '🏳 국가', (p, w) => {
    const rows = W4.NATIONS.map(n => {
      const st = w.nations ? w.nations[n.id] : null;
      const regs = w.state.regions.filter(s => s.owner === n.id).length;
      return `<tr data-n="${n.id}" class="${st && !st.alive ? 'dead' : ''}"><td>${UI.flagHTML(n.id)}</td><td><b>${n.name}</b><div class="small muted">${W4.GOVERNMENTS[n.gov].name} · ${n.traits.map(t => W4.TRAITS[t].icon + W4.TRAITS[t].name).join(' ')}</div></td><td>${regs}</td>${UI.nationCols ? UI.nationCols(n.id) : ''}</tr>`;
    }).join('');
    p.innerHTML = `<table class="w4t w4n"><tr><th></th><th>국가</th><th>지역</th>${UI.nationHead || ''}</tr>${rows}</table>`;
    p.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { if (UI.onNation) UI.onNation(x.dataset.n); else { const cap = w.map.nations[x.dataset.n].capital; UI.sel = cap; UI.R.sel = cap; UI.show('region'); } });
  });

  // ── 4.0 메뉴 (Phase 9 에서 모드 목록 확장) ──
  S.make_w4menu = () => {
    const sc = el('section', 'screen'); sc.id = 'screen-w4menu';
    sc.innerHTML = `<header class="bar"><button class="btn" data-go="menu">← <span class="lbl">뒤로</span></button><h2>🌍 세계 전략 4.0</h2></header><div class="scr-body" id="w4menu-body"></div>`;
    $('#app').insertBefore(sc, $('#toast'));
  };
  S.w4menu = () => {
    const body = $('#w4menu-body');
    body.innerHTML = `<div class="panel form3"><p>4개 대륙·16개 국가·120개 지역의 세계 지도입니다.</p>
      <label>지도 시드 <input type="number" id="w4-seed" value="${W4.DEFAULT_SEED}"></label>
      <div class="btns"><button class="btn primary big" id="w4-view">🗺 세계 지도 보기</button></div></div><div id="w4-modes-list"></div>`;
    $('#w4-view').onclick = () => {
      const map = W4.genMap(+$('#w4-seed').value || W4.DEFAULT_SEED);
      UI.open({ map, state: W4.baseState(map) }, { title: '🗺 세계 지도' });
    };
    if (UI.menuExtra) UI.menuExtra(body);
  };
})();
