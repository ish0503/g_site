// ─────────────────────────────────────────────
// 4.0 화면: 국정(경제·내정) · 기술 · 상단 자원 막대 · 턴 진행 · 저장
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, fmt } = SW.ui;
  const W4 = SW.W4, UI = W4.UI, save = SW.save;
  const f1 = (v) => (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1));
  const me = () => UI.world && UI.world.player;

  // 상단: 날짜·자원·다음 달·저장
  UI.top = () => {
    const w = UI.world; if (!w || !w.nations) return '';
    const id = me(), N = id && w.nations[id];
    let h = `<b>${w.dateStr()}</b>`;
    if (N) h += ' ' + W4.RES_KEYS.map(k => { const inc = (N.income[k] || 0) - (N.spent[k] || 0); return `<span title="${W4.RES[k].name} ${inc >= 0 ? '+' : ''}${f1(inc)}/월">${W4.RES[k].icon}${fmt(Math.floor(N.res[k]))}</span>`; }).join(' ') + ` <span title="안정도">⚖️${Math.round(N.stab)}</span> <span title="인력(천 명)">👥${Math.round(N.manpower)}</span>`;
    h += ` <button class="btn small primary" id="w4-next">▶ 다음 달</button>${UI.topExtra ? UI.topExtra() : ''}<button class="btn small" id="w4-save">💾</button>`;
    return h;
  };
  const bindTop = () => {
    const nb = $('#w4-next'); if (nb) nb.onclick = () => UI.nextMonth();
    const sb = $('#w4-save'); if (sb) sb.onclick = () => UI.saveWorld();
  };
  const origShow = UI.show;
  UI.show = (tab) => { origShow(tab); bindTop(); };
  UI.nextMonth = (n = 1) => {
    const w = UI.world; const before = w.log.length;
    w.advance(n);
    UI.R.dirty = true; UI.refresh(); bindTop();
    const news = w.log.slice(before).filter(e => !w.player || e.who === w.player || e.other === w.player || (e.kind === 'war' && e.text.includes('선전포고')) || e.kind === 'peace');
    if (news.length) toast(news.slice(-3).map(e => e.text).join(' · '));
    if (UI.afterMonth) UI.afterMonth(w);
  };
  UI.saveWorld = (slot) => {
    const w = UI.world; slot = slot || w.slot || ('w' + Date.now().toString(36)); w.slot = slot;
    const ok = save.world.put(slot, w.toJSON(), { name: (w.player ? w.def(w.player).name : '관전') + ' · ' + (W4.SCENARIOS && W4.SCENARIOS[w.scenario] ? W4.SCENARIOS[w.scenario].name : w.scenario), date: Date.now(), wdate: w.dateStr(), nation: w.player, scenario: w.scenario });
    toast(ok ? '세계를 저장했습니다' : '저장 실패 (저장 공간 부족)');
  };

  // ── 지역 패널: 건설·개발 ──
  const prevRegionExtra = UI.regionExtra;
  UI.regionExtra = (i) => {
    let h = prevRegionExtra ? prevRegionExtra(i) : '';
    const w = UI.world, id = me(); if (!w || !w.nations || !id) return h;
    const s = w.state.regions[i], r = w.map.regions[i];
    const bl = Object.entries(s.bld || {}).filter(([, v]) => v).map(([k, v]) => `${W4.BUILDINGS[k].icon}${W4.BUILDINGS[k].name}${v > 1 ? ' ' + v : ''}`).join(' · ');
    h += `<div class="small">건물: ${bl || '없음'} · 불안 ${Math.round(s.unrest || 0)}</div>`;
    if (s.owner !== id || s.occ) return h;
    const N = w.nations[id];
    const q = N.queue.filter(x => x.r === i).map(x => `${x.kind === 'b' ? W4.BUILDINGS[x.key].name : x.kind === 'dev' ? '개발' : '도시 건설'} (${x.left}개월)`);
    if (q.length) h += `<div class="small">공사 중: ${q.join(', ')}</div>`;
    h += '<h4>🏗 건설</h4><div class="btnrow">' + Object.entries(W4.BUILDINGS).filter(([, B]) => !B.coastal || r.coastal).map(([k, B]) => {
      const lv = s.bld[k] || 0, cost = W4.costOf(w, id, 'b', i, k), can = lv < B.max && W4.RES_KEYS.every(x => (N.res[x] || 0) >= (cost[x] || 0));
      return `<button class="btn small" data-bld="${k}" ${lv >= B.max ? 'disabled' : ''} title="${B.name} (${Object.entries(B.fx).map(([a, b]) => a + ' +' + b).join(', ')}) · ${B.time}개월">${B.icon}${B.name}${lv ? ' ' + (lv + 1) : ''} <small class="${can ? '' : 'muted'}">${costTxt(cost)}</small></button>`;
    }).join('') + '</div>';
    const dc = W4.costOf(w, id, 'dev', i);
    h += `<div class="btnrow"><button class="btn small" id="w4-dev" ${s.dev >= 8 ? 'disabled' : ''}>📈 개발 (${s.dev}→${s.dev + 1}) <small>${costTxt(dc)}</small></button>`;
    if (!W4.cityOf(w, i)) h += `<button class="btn small" id="w4-city" ${s.dev < 4 ? 'disabled' : ''} title="개발도 4 이상">🏙 도시 건설 <small>${costTxt(W4.costOf(w, id, 'city', i))}</small></button>`;
    h += '</div>';
    setTimeout(() => {
      $$('#w4-panel [data-bld]').forEach(b => b.onclick = () => act(W4.Act.build(w, id, i, b.dataset.bld)));
      const d = $('#w4-dev'); if (d) d.onclick = () => act(W4.Act.develop(w, id, i));
      const c = $('#w4-city'); if (c) c.onclick = () => act(W4.Act.foundCity(w, id, i));
    });
    return h;
  };
  const costTxt = (c) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => W4.RES[k].icon + v).join('');
  const act = (r) => { if (!r.ok) toast(r.msg || '불가'); else toast('명령을 내렸습니다'); UI.refresh(); bindTop(); };
  UI.act = act;

  // ── 국정 패널 ──
  UI.register('state', '🏛 국정', (p, w) => {
    const id = me(); if (!id || !w.nations) { p.innerHTML = '<p class="muted">관전 중입니다.</p>'; return; }
    const N = w.nations[id], d = w.def(id), st = W4.nationStats(w, id), M = N.mods;
    const rows = W4.RES_KEYS.map(k => `<tr><td>${W4.RES[k].icon} ${W4.RES[k].name}</td><td>${fmt(Math.floor(N.res[k]))}</td><td style="color:#7fdc8a">+${f1(N.income[k] || 0)}</td><td style="color:#ff9a8a">-${f1(N.spent[k] || 0)}</td></tr>`).join('');
    p.innerHTML = `<h3>${UI.flagHTML(id)} ${d.name}</h3>
      <div class="small">${W4.GOVERNMENTS[N.gov].name} (${W4.GOVERNMENTS[N.gov].desc}) · ${d.traits.map(t => W4.TRAITS[t].icon + W4.TRAITS[t].name).join(' ')}</div>
      <table class="w4t"><tr><td>안정도</td><td>${Math.round(N.stab)} / 100 ${N.stab < 30 ? '⚠ 세금 -20%·반란 위험' : ''}</td></tr><tr><td>인구</td><td>${fmt(Math.round(st.pop))}천 · 지역 ${st.regions} · 개발도 합 ${st.dev}</td></tr>
      <tr><td>인력</td><td>${Math.round(N.manpower)} / ${Math.round(N.manpowerMax)}천</td></tr><tr><td>연구력</td><td>${st.research.toFixed(1)}/월</td></tr><tr><td>전쟁 피로</td><td>${Math.round(N.exhaustion)}</td></tr></table>
      <h4>세율</h4><div class="seg">${Object.entries(W4.TAX).map(([k, t]) => `<button data-tax="${k}" class="${N.tax === k ? 'on' : ''}">${t.name} (×${t.mul}, 안정 ${t.stab >= 0 ? '+' : ''}${t.stab})</button>`).join('')}</div>
      <h4>자원 (월 수입/지출)</h4><table class="w4t">${rows}</table>
      <h4>🏪 시장 (금으로 구입, 월 300단위)</h4><div class="btnrow">${['food', 'wood', 'iron', 'stone', 'horses', 'mana', 'coal'].map(k => `<button class="btn small" data-buy="${k}">${W4.RES[k].icon}+100 <small>💰${Math.round(W4.RES_VALUE[k] * 300)}</small></button>`).join('')}</div>
      <h4>건설 대기열 (${N.queue.length}/6)</h4>${N.queue.length ? N.queue.map(q => `<div class="small">${w.map.regions[q.r].root}: ${q.kind === 'b' ? W4.BUILDINGS[q.key].name : q.kind === 'dev' ? '개발' : '도시 건설'} — ${q.left}개월</div>`).join('') : '<div class="small muted">비어 있음 — 지역을 눌러 건설하세요</div>'}
      <h4>국가 수정자</h4><div class="small muted">${Object.entries(M).filter(([, v]) => v).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.abs(v) < 1 ? Math.round(v * 100) + '%' : v}`).join(' · ')}</div>`;
    p.querySelectorAll('[data-tax]').forEach(b => b.onclick = () => act(W4.Act.setTax(w, id, b.dataset.tax)));
    p.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => act(W4.Act.buyRes(w, id, b.dataset.buy, 100)));
  });
  // ── 기술 패널 ──
  UI.register('tech', '🔬 기술', (p, w) => {
    const id = me(); if (!id || !w.nations) { p.innerHTML = '<p class="muted">관전 중입니다.</p>'; return; }
    const R = w.nations[id].research;
    const cur = R.cur && W4.TECH_INDEX[R.cur];
    let h = `<div class="small">연구력 ${(R.rate || W4.nationStats(w, id).research).toFixed(1)}/월 · 진행 중: <b>${cur ? cur.name : '없음'}</b>${cur ? ` (${Math.floor(R.prog)}/${W4.techCost(cur)})` : ''}</div>`;
    for (const [br, name] of Object.entries(W4.TECH_BRANCHES)) {
      h += `<h4>${name}</h4><div class="btnrow">` + W4.TECHS.filter(t => t.br === br).map(t => {
        const done = R.done.includes(t.id), can = W4.canResearch(w, id, t.id);
        return `<button class="btn small ${done ? 'primary' : ''} ${R.cur === t.id ? 'on' : ''}" ${can ? `data-tech="${t.id}"` : 'disabled'} title="${t.desc}">${done ? '✔ ' : R.cur === t.id ? '▶ ' : ''}${t.tier}. ${t.name} <small>${done ? '' : W4.techCost(t)}</small></button>`;
      }).join('') + '</div>';
    }
    h += '<div class="small muted">각 계열은 앞 단계를 연구해야 다음 단계가 열립니다. 군사 기술 일부는 실제 전투에서 유닛 능력치를 올립니다.</div>';
    p.innerHTML = h;
    p.querySelectorAll('[data-tech]').forEach(b => b.onclick = () => act(W4.Act.research(w, id, b.dataset.tech)));
  });
  // 국가 목록 열
  UI.nationHead = '<th>금</th><th>안정</th><th>기술</th>';
  UI.nationCols = (id) => { const N = UI.world.nations && UI.world.nations[id]; if (!N || !N.res) return '<td></td><td></td><td></td>'; return `<td>${fmt(Math.floor(N.res.gold))}</td><td>${Math.round(N.stab)}</td><td>${N.research.done.length}</td>`; };

  // ── 4.0 메뉴: 새 세계 시작·불러오기 ──
  const prevMenu = UI.menuExtra;
  UI.menuExtra = (body) => {
    if (prevMenu) prevMenu(body);
    const box = el('div', 'panel form3');
    box.innerHTML = `<h3>👑 세계 정복 — 국가 선택</h3><div class="w4pick">${W4.NATIONS.map(n => `<button class="btn" data-pick="${n.id}">${UI.flagHTML(n.id)} ${n.name}<small>${W4.CONTINENTS.find(c => c.id === n.cont).name.split(' ').pop()} · ${W4.GOVERNMENTS[n.gov].name}</small></button>`).join('')}</div>
      <label>난이도 <select id="w4-diff"><option value="0.8">쉬움</option><option value="1" selected>보통</option><option value="1.3">어려움</option></select></label>
      <h3>📂 저장된 세계</h3><div id="w4-slots"></div>`;
    body.appendChild(box); UI.fillFlags(box);
    box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const seed = +$('#w4-seed').value || W4.DEFAULT_SEED;
      const w = new W4.World({ seed, player: b.dataset.pick, diff: +$('#w4-diff').value, scenario: 'conquest' });
      UI.open(w, { title: '👑 ' + w.def(w.player).name, tab: 'state' });
    });
    const list = save.world.list();
    $('#w4-slots').innerHTML = list.length ? list.map(s => `<div class="row"><b>${s.name}</b> <span class="small muted">${s.wdate || ''} · ${new Date(s.date).toLocaleString()}</span> <button class="btn small primary" data-load="${s.slot}">불러오기</button><button class="btn small danger" data-del="${s.slot}">삭제</button></div>`).join('') : '<p class="muted small">없음</p>';
    box.querySelectorAll('[data-load]').forEach(b => b.onclick = () => {
      const o = save.world.get(b.dataset.load); if (!o) { toast('불러오기 실패 (데이터 손상)'); return; }
      try { const w = W4.World.fromJSON(o); w.slot = b.dataset.load; UI.open(w, { title: w.player ? '👑 ' + w.def(w.player).name : '🌍 관전', tab: w.player ? 'state' : 'nations' }); }
      catch (e) { toast('불러오기 실패: ' + e.message); }
    });
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('이 세계 저장을 삭제할까요? (직전 판본은 보존됩니다)')) { save.world.remove(b.dataset.del); SW.screens.w4menu(); } });
  };
  // 탭 순서: 지역 · 국정 · 기술 · 국가 (+ 이후 외교·군사·기록)
  UI.tabOrder = ['region', 'state', 'tech', 'nations'];
})();
