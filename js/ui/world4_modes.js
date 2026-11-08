// ─────────────────────────────────────────────
// 4.0 화면: 모드 메뉴 · 목표 진행 · 자동 진행 · 승리/패배 · 세계 샌드박스 도구 · 시나리오 편집기
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, go } = SW.ui;
  const S = SW.screens, W4 = SW.W4, UI = W4.UI, save = SW.save, D = W4.Diplo;
  let pick = { scenario: 'conquest', nation: 'valor', seed: W4.DEFAULT_SEED, diff: 1 };

  // ── 메뉴 (모드 카드 + 국가 선택 + 저장된 세계/시나리오) ──
  S.w4menu = () => {
    const body = $('#w4menu-body');
    const SC = W4.SCENARIOS, cur = SC[pick.scenario];
    const scen = save.data.world.scenarios || {};
    body.innerHTML = `<div class="cards">${Object.entries(SC).map(([k, s]) => `<div class="card scen ${k === pick.scenario ? 'on' : ''}" data-sc="${k}"><div><div class="cn">${s.icon} ${s.name}</div><div class="cd">${s.desc}</div></div></div>`).join('')}
      <div class="card scen" data-edit="1"><div><div class="cn">✏️ 시나리오 편집기</div><div class="cd">영토·자원·정치 체제·동맹·초기 전쟁을 직접 정해 커스텀 국가 시나리오를 만든다.</div></div></div></div>
      <div class="panel form3"><h3>${cur.icon} ${cur.name}</h3>
      ${cur.pick ? `<div class="w4pick">${W4.NATIONS.map(n => `<button class="btn ${n.id === pick.nation ? 'primary' : ''}" data-pick="${n.id}">${UI.flagHTML(n.id)} ${n.name}<small>${W4.CONTINENTS.find(c => c.id === n.cont).name.split(' ').pop()} · ${W4.GOVERNMENTS[n.gov].name} · ${n.traits.map(t => W4.TRAITS[t].icon).join('')}</small></button>`).join('')}</div>` : ''}
      <label>지도 시드 <input type="number" id="w4-seed" value="${pick.seed}"></label>
      ${cur.pick ? `<label>난이도 <select id="w4-diff"><option value="0.8">쉬움</option><option value="1">보통</option><option value="1.3">어려움</option></select></label>` : ''}
      <div class="btns"><button class="btn primary big" id="w4-start">▶ 시작</button><button class="btn" id="w4-view">🗺 지도만 보기</button></div></div>
      ${Object.keys(scen).length ? `<div class="panel form3"><h3>✏️ 저장된 커스텀 시나리오</h3>${Object.entries(scen).map(([k, s]) => `<div class="row"><b>${s.name}</b> <span class="small muted">${s.player ? '플레이: ' + W4.NATIONS[W4.NATION_INDEX[s.player]].name : '관전'}</span> <button class="btn small primary" data-cplay="${k}">시작</button><button class="btn small" data-cedit="${k}">편집</button><button class="btn small danger" data-cdel="${k}">삭제</button></div>`).join('')}</div>` : ''}
      <div class="panel form3"><h3>📂 저장된 세계</h3><div id="w4-slots"></div></div>`;
    UI.fillFlags(body);
    if ($('#w4-diff')) $('#w4-diff').value = String(pick.diff);
    const keep = () => { pick.seed = +$('#w4-seed').value || W4.DEFAULT_SEED; if ($('#w4-diff')) pick.diff = +$('#w4-diff').value; };
    body.querySelectorAll('[data-sc]').forEach(c => c.onclick = () => { keep(); pick.scenario = c.dataset.sc; S.w4menu(); });
    body.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { keep(); pick.nation = b.dataset.pick; S.w4menu(); });
    body.querySelector('[data-edit]').onclick = () => { keep(); UI.openEditor(null); };
    $('#w4-view').onclick = () => { keep(); const map = W4.genMap(pick.seed); UI.open({ map, state: W4.baseState(map) }, { title: '🗺 세계 지도' }); };
    $('#w4-start').onclick = () => {
      keep();
      const w = W4.newScenario(pick.scenario, { player: pick.nation, seed: pick.seed, diff: pick.diff });
      UI.open(w, { title: `${cur.icon} ${w.player ? w.def(w.player).name : cur.name}`, tab: w.player ? 'state' : 'nations' });
    };
    body.querySelectorAll('[data-cplay]').forEach(b => b.onclick = () => { const s = scen[b.dataset.cplay]; const w = W4.customWorld(s); UI.open(w, { title: `✏️ ${s.name}`, tab: w.player ? 'state' : 'nations' }); });
    body.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => UI.openEditor(b.dataset.cedit));
    body.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { if (confirm('시나리오를 삭제할까요?')) { delete save.data.world.scenarios[b.dataset.cdel]; save.write(); S.w4menu(); } });
    // 저장된 세계
    const list = save.world.list();
    $('#w4-slots').innerHTML = list.length ? list.map(s => `<div class="row"><b>${s.name}</b> <span class="small muted">${s.wdate || ''} · ${new Date(s.date).toLocaleString()}</span> <button class="btn small primary" data-load="${s.slot}">불러오기</button><button class="btn small danger" data-del="${s.slot}">삭제</button></div>`).join('') : '<p class="muted small">없음</p>';
    body.querySelectorAll('[data-load]').forEach(b => b.onclick = () => {
      const o = save.world.get(b.dataset.load); if (!o) { toast('불러오기 실패 (데이터 손상)'); return; }
      try { const w = W4.World.fromJSON(o); w.slot = b.dataset.load; const sc = W4.SCENARIOS[w.scenario]; UI.open(w, { title: `${sc ? sc.icon : '✏️'} ${w.player ? w.def(w.player).name : (sc ? sc.name : '커스텀')}`, tab: w.player ? 'state' : 'nations' }); }
      catch (e) { toast('불러오기 실패: ' + e.message); }
    });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('이 세계 저장을 삭제할까요? (직전 판본은 보존됩니다)')) { save.world.remove(b.dataset.del); S.w4menu(); } });
  };
  UI.menuExtra = null;

  // ── 목표 진행 · 자동 진행 ──
  const objText = (w) => {
    if (!w.nations || !w.scenario) return '';
    const p = w.player, own = p ? w.ownedRegions(p).length : 0;
    switch (w.scenario) {
      case 'conquest': return `👑 ${own}/72`;
      case 'nationwar': return `⚔️ 숙적 ${w.def(w.flags.rival).name.split(' ')[0]} · ${Math.max(0, 120 - w.turn)}개월`;
      case 'continental': { const c = W4.CONTINENTS.findIndex(K => K.id === w.flags.activeCont); return `🗺 ${w.ownedRegions(p).filter(i => w.map.regions[i].cont === c).length}/23`; }
      case 'worldwar': { const B = w.flags.blocs; if (!B || !p) return '🌍'; const mine = B[0].includes(p) ? 0 : 1; const held = B[1 - mine].filter(e => { const s = w.state.regions[w.map.nations[e].capital]; return B[mine].includes(s.occ || s.owner); }).length; return `🌍 적 수도 ${held}/6`; }
      default: return W4.SCENARIOS[w.scenario] ? W4.SCENARIOS[w.scenario].icon : '✏️';
    }
  };
  const prevTop = UI.topExtra;
  UI.topExtra = () => (prevTop ? prevTop() : '') + `<span class="small" title="목표">${objText(UI.world)}</span><button class="btn small ${UI.auto ? 'primary' : ''}" id="w4-auto" title="자동 진행">${UI.auto ? '⏸' : '⏩'}</button>`;
  const prevShow = UI.show;
  UI.show = (tab) => { prevShow(tab); const b = $('#w4-auto'); if (b) b.onclick = () => { UI.auto = !UI.auto; UI.show(UI.tab); if (UI.auto) tick(); }; };
  function tick() {
    if (!UI.auto) return;
    const w = UI.world, active = $('#screen-world4') && $('#screen-world4').classList.contains('active');
    if (!active || !w || !w.nations || document.querySelector('.w4modal')) { UI.auto = false; UI.show(UI.tab); return; }
    UI.nextMonth(1);
    setTimeout(tick, w.player ? 450 : 250);
  }
  // ── 승리·패배 ──
  const prevAfter = UI.afterMonth;
  UI.afterMonth = (w) => {
    if (prevAfter) prevAfter(w);
    if (w.result && !w.resultSeen && !document.querySelector('.w4modal')) {
      UI.auto = false;
      const box = el('div', 'w4modal');
      box.innerHTML = `<div class="box"><h2 class="${w.result.win ? 'win' : 'lose'}">${w.result.win ? '🏆 승리!' : '💀 패배'}</h2><p>${w.result.text}</p><p class="small muted">${w.dateStr()} · ${W4.SCENARIOS[w.scenario] ? W4.SCENARIOS[w.scenario].name : '커스텀'}</p>
        <div class="btns">${w.result.win ? '<button class="btn primary" data-r="cont">계속 플레이</button>' : (w.player ? '<button class="btn" data-r="spec">관전으로 계속</button>' : '')}<button class="btn" data-r="chron">📜 기록 보기</button><button class="btn" data-r="menu">메뉴로</button></div></div>`;
      document.body.appendChild(box);
      box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        box.remove(); w.resultSeen = true;
        if (b.dataset.r === 'spec') { w.player = null; w.flags.autoBattles = true; UI.show('nations'); }
        if (b.dataset.r === 'chron') UI.show('chron');
        if (b.dataset.r === 'menu') go('w4menu');
      });
    }
  };

  // ── 세계 샌드박스 도구 (sandbox·aivsai·custom 관전) ──
  UI.sbx = { nation: 'valor', tool: null };
  UI.register('sbx', '🛠 도구', (p, w) => {
    const X = UI.sbx;
    p.innerHTML = `<div class="small">국가 <select id="sbx-n">${W4.NATIONS.map(n => `<option value="${n.id}" ${n.id === X.nation ? 'selected' : ''}>${n.name}${w.nations[n.id].alive ? '' : ' (멸망)'}</option>`).join('')}<option value="neutral" ${X.nation === 'neutral' ? 'selected' : ''}>자유 영지</option></select></div>
      <div class="btnrow"><button class="btn small ${X.tool === 'paint' ? 'primary' : ''}" data-t="paint">🖌 지역 소유권 칠하기</button><button class="btn small ${X.tool === 'army' ? 'primary' : ''}" data-t="army">⚔ 군단 생성 (지역 클릭)</button></div>
      <div class="btnrow"><button class="btn small" data-g="gold">💰 금 +1000</button><button class="btn small" data-g="all">📦 자원 +500</button></div>
      <h4>선전포고</h4><div class="btnrow"><select id="sbx-t">${W4.NATIONS.filter(n => n.id !== X.nation && w.nations[n.id].alive).map(n => `<option value="${n.id}">${n.name}</option>`).join('')}</select><button class="btn small danger" id="sbx-war">⚔️ ${X.nation === 'neutral' ? '' : w.def(X.nation).name.split(' ')[0]} → 선전포고</button></div>
      <h4>진행 중인 전쟁</h4>${w.wars.map(x => `<div class="small">${x.name} (점수 ${Math.round(x.score)}) <button class="btn small" data-peace="${x.id}">🕊 백지 평화</button></div>`).join('') || '<div class="small muted">없음</div>'}`;
    $('#sbx-n').onchange = (e) => { X.nation = e.target.value; UI.show('sbx'); };
    p.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { X.tool = X.tool === b.dataset.t ? null : b.dataset.t; UI.show('sbx'); });
    p.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { if (X.nation === 'neutral') return; W4.Act.sandbox.give(w, X.nation, b.dataset.g === 'gold' ? { gold: 1000 } : Object.fromEntries(W4.RES_KEYS.map(k => [k, 500]))); UI.refresh(); });
    $('#sbx-war').onclick = () => { if (X.nation === 'neutral') return; const r = W4.Act.sandbox.war(w, X.nation, $('#sbx-t').value); toast(r.ok ? '선전포고' : r.msg); UI.R.dirty = true; UI.show('sbx'); };
    p.querySelectorAll('[data-peace]').forEach(b => b.onclick = () => { W4.Act.sandbox.peace(w, +b.dataset.peace); UI.R.dirty = true; UI.show('sbx'); });
  });
  UI.tabs.sbx.hidden = () => !(UI.world && UI.world.nations && (UI.world.scenario === 'sandbox' || UI.world.scenario === 'aivsai' || (UI.world.scenario === 'custom' && !UI.world.player)));
  const prevPick = UI.pickHook;
  UI.pickHook = (i, sea) => {
    const w = UI.world;
    if (w && w.nations && !UI.tabs.sbx.hidden() && UI.sbx.tool && i >= 0) {
      if (UI.sbx.tool === 'paint') { W4.Act.sandbox.setOwner(w, i, UI.sbx.nation); UI.R.dirty = true; UI.sel = i; UI.show('sbx'); return true; }
      if (UI.sbx.tool === 'army' && UI.sbx.nation !== 'neutral') { const r = W4.Act.sandbox.army(w, UI.sbx.nation, i); toast(r.ok ? '군단 생성' : r.msg); return true; }
    }
    if (UI.editing && i >= 0) { UI.editPaint(i); return true; }
    return prevPick ? prevPick(i, sea) : false;
  };

  // ── 시나리오 편집기 ──
  let ed = null;
  UI.openEditor = (key) => {
    const base = key ? JSON.parse(JSON.stringify(save.data.world.scenarios[key])) : { name: '새 시나리오', seed: pick.seed, player: 'valor', owners: {}, nations: {}, alliances: [], wars: [] };
    ed = Object.assign(base, { key: key || null, brush: 'valor' });
    const map = W4.genMap(ed.seed), state = W4.baseState(map);
    for (const [i, o] of Object.entries(ed.owners)) if (state.regions[+i]) state.regions[+i].owner = o;
    UI.editing = true;
    UI.open({ map, state }, { title: '✏️ 시나리오 편집기', tab: 'edit', onExit: () => { UI.editing = false; go('w4menu'); } });
  };
  UI.editPaint = (i) => { const w = UI.world; w.state.regions[i].owner = ed.brush; ed.owners[i] = ed.brush; UI.R.dirty = true; UI.sel = i; };
  UI.register('edit', '✏️ 편집', (p, w) => {
    if (!UI.editing || !ed) { p.innerHTML = '<p class="muted">편집 중이 아닙니다</p>'; return; }
    const opt = (sel, incNeutral) => W4.NATIONS.map(n => `<option value="${n.id}" ${n.id === sel ? 'selected' : ''}>${n.name}</option>`).join('') + (incNeutral ? `<option value="neutral" ${sel === 'neutral' ? 'selected' : ''}>자유 영지</option>` : '');
    const count = (id) => w.state.regions.filter(s => s.owner === id).length;
    p.innerHTML = `<label class="small">이름 <input id="ed-name" value="${ed.name.replace(/"/g, '&quot;')}"></label>
      <h4>🖌 영토 칠하기</h4><div class="small">국가를 고르고 지도에서 지역을 누르세요.</div><select id="ed-brush">${opt(ed.brush, true)}</select>
      <h4>국가 설정 (${ed.brush === 'neutral' ? '-' : W4.NATIONS[W4.NATION_INDEX[ed.brush]].name} · ${count(ed.brush)}곳)</h4>
      ${ed.brush === 'neutral' ? '' : `<label class="small">시작 금 <input type="number" id="ed-gold" value="${(ed.nations[ed.brush] || {}).gold ?? 300}" style="width:90px"></label> <label class="small">정치 체제 <select id="ed-gov">${Object.entries(W4.GOVERNMENTS).map(([k, g]) => `<option value="${k}" ${((ed.nations[ed.brush] || {}).gov || W4.NATIONS[W4.NATION_INDEX[ed.brush]].gov) === k ? 'selected' : ''}>${g.name}</option>`).join('')}</select></label>`}
      <h4>동맹 · 초기 전쟁</h4><div class="btnrow"><select id="ed-a">${opt('valor')}</select><select id="ed-b">${opt('ferrum')}</select><button class="btn small" id="ed-ally">🤝 동맹 추가</button><button class="btn small danger" id="ed-war">⚔️ 전쟁 추가</button></div>
      ${ed.alliances.map((x, k) => `<div class="small">🤝 ${x.map(id => W4.NATIONS[W4.NATION_INDEX[id]].name).join(' · ')} <a href="#" data-dela="${k}">삭제</a></div>`).join('')}${ed.wars.map((x, k) => `<div class="small">⚔️ ${x.map(id => W4.NATIONS[W4.NATION_INDEX[id]].name).join(' → ')} <a href="#" data-delw="${k}">삭제</a></div>`).join('')}
      <h4>플레이</h4><select id="ed-player"><option value="">관전 (AI 대전)</option>${opt(ed.player)}</select>
      <div class="btns"><button class="btn primary" id="ed-save">💾 저장</button><button class="btn primary" id="ed-play">▶ 시작</button><button class="btn" id="ed-reset">초기 영토로</button></div>`;
    $('#ed-player').value = ed.player || '';
    const sync = () => { ed.name = $('#ed-name').value || '시나리오'; ed.player = $('#ed-player').value || null; if ($('#ed-gold')) { ed.nations[ed.brush] = Object.assign(ed.nations[ed.brush] || {}, { gold: +$('#ed-gold').value, gov: $('#ed-gov').value }); } };
    $('#ed-brush').onchange = (e) => { sync(); ed.brush = e.target.value; UI.show('edit'); };
    $('#ed-ally').onclick = () => { sync(); const a = $('#ed-a').value, b = $('#ed-b').value; if (a !== b) ed.alliances.push([a, b]); UI.show('edit'); };
    $('#ed-war').onclick = () => { sync(); const a = $('#ed-a').value, b = $('#ed-b').value; if (a !== b) ed.wars.push([a, b]); UI.show('edit'); };
    p.querySelectorAll('[data-dela]').forEach(x => x.onclick = (e) => { e.preventDefault(); ed.alliances.splice(+x.dataset.dela, 1); UI.show('edit'); });
    p.querySelectorAll('[data-delw]').forEach(x => x.onclick = (e) => { e.preventDefault(); ed.wars.splice(+x.dataset.delw, 1); UI.show('edit'); });
    const data = () => ({ name: ed.name, seed: ed.seed, player: ed.player, owners: ed.owners, nations: ed.nations, alliances: ed.alliances, wars: ed.wars });
    $('#ed-save').onclick = () => { sync(); const k = ed.key || ('c' + Date.now().toString(36)); ed.key = k; save.data.world.scenarios[k] = data(); save.write(); toast('시나리오를 저장했습니다'); };
    $('#ed-play').onclick = () => { sync(); UI.editing = false; const w2 = W4.customWorld(data()); UI.open(w2, { title: `✏️ ${ed.name}`, tab: w2.player ? 'state' : 'nations' }); };
    $('#ed-reset').onclick = () => { if (!confirm('칠한 영토를 모두 지울까요?')) return; ed.owners = {}; for (const r of w.map.regions) w.state.regions[r.id].owner = r.owner; UI.R.dirty = true; UI.show('edit'); };
  });
  UI.tabs.edit.hidden = () => !UI.editing;
  // 편집기가 아닐 때 편집 탭을 숨기고, 편집기에서는 편집·지역·국가만
  const origOpen = UI.open;
  UI.open = (world, opts = {}) => { if (opts.tab !== 'edit') UI.editing = false; origOpen(world, opts); };
  UI.tabOrder = ['edit', 'region', 'state', 'army', 'navy', 'wars', 'diplo', 'tech', 'chron', 'sbx', 'nations'];
  // 지도만 보기·편집기에서는 국가 데이터가 없으므로 해당 탭 숨김
  for (const t of ['state', 'army', 'navy', 'wars', 'diplo', 'tech', 'chron']) { const T = UI.tabs[t]; if (T) { const h = T.hidden; T.hidden = () => !(UI.world && UI.world.nations) || (h ? h() : false); } }
})();
