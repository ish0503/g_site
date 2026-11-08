// ─────────────────────────────────────────────
// 4.0 화면: 외교 (관계·조약·전쟁 명분·받은 제안·외교 행동)
// ─────────────────────────────────────────────
(() => {
  const { $, $$, toast } = SW.ui;
  const W4 = SW.W4, UI = W4.UI, D = W4.Diplo;
  UI.diploSel = null;
  const relColor = (r) => (r > 30 ? '#7fdc8a' : r > 0 ? '#c8e6a0' : r > -30 ? '#ffc48a' : '#ff8a7a');
  const treatyIcons = (w, a, b) => D.list(w, a).filter(t => t.a === b || t.b === b).map(t => {
    const T = W4.TREATIES[t.type];
    const dir = T.sym ? '' : t.a === a ? (t.type === 'access' ? '(우리가 허가)' : t.type === 'vassal' ? '(종주)' : '(보장함)') : (t.type === 'access' ? '(허가받음)' : t.type === 'vassal' ? '(종속)' : '(보장받음)');
    return `<span title="${T.name} ${dir}${t.until ? ' · ' + (t.until - w.turn) + '개월 남음' : ''}">${T.icon}</span>`;
  }).join('');

  UI.register('diplo', '🤝 외교', (p, w) => {
    const id = w.player;
    if (!id) { p.innerHTML = '<p class="muted">관전 중: 국가를 누르면 그 국가의 외교 관계를 볼 수 있습니다.</p>' + (UI.diploSel ? detail(w, UI.diploSel, null) : ''); bind(p, w); return; }
    let h = '';
    if (w.diplo.inbox.length) {
      h += '<h4>📨 받은 제안</h4>' + w.diplo.inbox.map((q, k) => `<div class="row">${UI.flagHTML(q.from)} <b>${w.def(q.from).name}</b>: ${W4.TREATIES[q.type].icon} ${W4.TREATIES[q.type].name} <button class="btn small primary" data-ans="${k}:1">수락</button><button class="btn small" data-ans="${k}:0">거절</button></div>`).join('');
    }
    const lord = D.overlord(w, id);
    if (lord) h += `<div class="small">⚠ ${w.def(lord).name} 의 종속국입니다. 독자 외교가 제한됩니다.</div>`;
    h += '<h4>국가별 관계</h4><table class="w4t w4n"><tr><th></th><th>국가</th><th>관계</th><th>조약</th><th>명분</th></tr>' + w.alive().filter(o => o !== id).map(o => {
      const r = Math.round(D.rel(w, id, o)), cb = D.cbs(w, id, o);
      return `<tr data-dn="${o}" class="${UI.diploSel === o ? 'sel' : ''}"><td>${UI.flagHTML(o)}</td><td>${w.def(o).name}${D.atWar(w, id, o) ? ' ⚔️' : ''}</td><td style="color:${relColor(r)}">${r > 0 ? '+' : ''}${r}</td><td>${treatyIcons(w, id, o)}</td><td>${cb.length ? '🎯' : ''}</td></tr>`;
    }).join('') + '</table>';
    if (UI.diploSel && UI.diploSel !== id) h += detail(w, UI.diploSel, id);
    p.innerHTML = h;
    bind(p, w);
  });
  function detail(w, o, id) {
    const d = w.def(o), N = w.nations[o];
    let h = `<h3>${UI.flagHTML(o)} ${d.name}</h3><div class="small">${W4.GOVERNMENTS[N.gov].name} · 국가 AI: ${({ conqueror: '정복', builder: '건설', trader: '교역', zealot: '신앙', opportunist: '기회주의' })[d.ai]} · 국력 ${Math.round(W4.power(w, o))} · 침략 평판 ${Math.round(N.ae || 0)}</div>`;
    const tl = D.list(w, o);
    h += `<div class="small">조약: ${tl.length ? tl.map(t => `${W4.TREATIES[t.type].icon}${W4.TREATIES[t.type].name}(${w.def(t.a === o ? t.b : t.a).name})`).join(', ') : '없음'}</div>`;
    if (!id) return h;
    const cb = D.cbs(w, id, o), r = Math.round(D.rel(w, id, o));
    h += `<div class="small">관계 <b style="color:${relColor(r)}">${r}</b> · 우리 국력 ${Math.round(W4.power(w, id))} · 전쟁 명분: ${cb.length ? cb.map(c => ({ core: '핵심 영토', claim: '영유권', insult: '모욕', guarantee: '보장', ally: '동맹', liberation: '해방' })[c.kind]).join(', ') : '없음'}</div>`;
    const war = D.atWar(w, id, o);
    h += '<h4>제안</h4><div class="btnrow">' + ['alliance', 'defense', 'nap', 'trade', 'access', 'guarantee', 'vassal'].map(t => {
      const T = W4.TREATIES[t], has = t === 'access' ? D.has(w, 'access', o, id) : D.has(w, t, id, o);
      const label = t === 'access' ? '통행권 요청' : t === 'vassal' ? '종속 요구' : t === 'guarantee' ? '독립 보장' : T.name;
      return `<button class="btn small" data-prop="${t}" ${has || war ? 'disabled' : ''} title="${T.desc}">${T.icon} ${label}</button>`;
    }).join('') + '</div>';
    const mine = D.list(w, id).filter(t => (t.a === o || t.b === o) && !(t.type === 'vassal' && t.b === id));
    if (mine.length) h += '<div class="btnrow">' + mine.map(t => `<button class="btn small danger" data-cancel="${t.type}">✂ ${W4.TREATIES[t.type].name} 파기</button>`).join('') + '</div>';
    h += `<h4>행동</h4><div class="btnrow"><button class="btn small" data-act="improve">✉ 사절 파견 (💰40, 관계 +12)</button><button class="btn small" data-act="gift">🎁 선물 (💰100)</button><button class="btn small" data-act="fabricate" ${D.borders(w, id, o) ? '' : 'disabled'}>📜 영유권 날조 (💰100, 6개월)</button><button class="btn small danger" data-act="insult">😠 모욕</button></div>`;
    if (UI.diploWar) h += UI.diploWar(w, id, o);
    return h;
  }
  function bind(p, w) {
    const id = w.player;
    p.querySelectorAll('[data-dn]').forEach(x => x.onclick = () => { UI.diploSel = x.dataset.dn; UI.show('diplo'); });
    p.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const [k, y] = b.dataset.ans.split(':'); const r = W4.Act.answer(w, +k, y === '1'); if (!r.ok && r.msg) toast(r.msg); UI.show('diplo'); });
    const o = UI.diploSel;
    p.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => { const r = W4.Act.propose(w, id, o, b.dataset.prop); toast(!r.ok ? r.msg : r.accepted ? '수락했습니다!' : r.msg); UI.refresh(); });
    p.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { if (!confirm('조약을 파기할까요? 관계·안정도가 떨어질 수 있습니다.')) return; UI.act(W4.Act.cancel(w, id, b.dataset.cancel, o)); });
    p.querySelectorAll('[data-act]').forEach(b => b.onclick = () => UI.act(W4.Act[b.dataset.act](w, id, o)));
    if (UI.bindDiploWar) UI.bindDiploWar(p, w, id, o);
  }
  UI.onNation = (o) => { UI.diploSel = o; UI.show('diplo'); };
  UI.tabOrder = ['region', 'state', 'tech', 'diplo', 'nations'];
})();
