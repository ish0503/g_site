// ─────────────────────────────────────────────
// 4.0 화면: 군사(군단·모집·이동) · 전쟁(점수·평화 협상) · 지도 위 군단·전선 · 선전포고
// ─────────────────────────────────────────────
(() => {
  const { $, $$, toast } = SW.ui;
  const W4 = SW.W4, UI = W4.UI, D = W4.Diplo, War = W4.War, A = W4.Army;
  UI.armySel = null;
  const CLS = Object.keys(W4.UNIT_CLASSES);
  const comp = (a) => CLS.filter(k => a.u[k] > 0.05).map(k => `${W4.UNIT_CLASSES[k].icon}${a.u[k].toFixed(a.u[k] < 10 ? 1 : 0)}`).join(' ');

  // ── 지도 위: 군단 방패·이동 경로·전선 ──
  UI.overlay = () => {
    const w = UI.world; if (!w || !w.armies) return null;
    return {
      fronts: War.fronts(w),
      draw(ctx, inv) {
        const byLoc = new Map(); for (const a of w.armies) { if (!byLoc.has(a.loc)) byLoc.set(a.loc, []); byLoc.get(a.loc).push(a); }
        // 선택한 군단 경로
        const sel = UI.armySel != null && w.armies.find(a => a.id === UI.armySel);
        if (sel && sel.path.length) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2 * inv; ctx.setLineDash([5 * inv, 4 * inv]); ctx.beginPath(); let p = w.map.regions[sel.loc]; ctx.moveTo(p.x, p.y); for (const i of sel.path) { p = w.map.regions[i]; ctx.lineTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]); }
        for (const [loc, list] of byLoc) {
          const g = w.map.regions[loc];
          list.forEach((a, k) => {
            const n = W4.NATIONS[W4.NATION_INDEX[a.owner]];
            const x = g.x - 14 + k * 9, y = g.y + 6 + k * 4, s = A.size(a);
            ctx.fillStyle = n.color; ctx.strokeStyle = a.id === UI.armySel ? '#ffe066' : '#111'; ctx.lineWidth = (a.id === UI.armySel ? 2.5 : 1.2) * inv;
            ctx.beginPath(); ctx.moveTo(x - 7, y - 6); ctx.lineTo(x + 7, y - 6); ctx.lineTo(x + 7, y + 2); ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s >= 10 ? Math.round(s) : s.toFixed(1), x, y + 1);
            if (a.mode === 'siege') { ctx.fillStyle = '#ffcf4d'; ctx.font = '8px sans-serif'; ctx.fillText('⚒', x + 9, y - 4); }
            if (a.cutOff) { ctx.fillStyle = '#ff7070'; ctx.font = '8px sans-serif'; ctx.fillText('!', x - 9, y - 4); }
          });
        }
        // 함대 (Phase 7 에서 채움)
        if (UI.drawFleets) UI.drawFleets(ctx, inv);
      },
    };
  };
  UI.tipExtra = (i) => { const w = UI.world; if (!w.armies) return ''; const here = A.at(w, i); return here.length ? '<br>' + here.map(a => `${W4.NATIONS[W4.NATION_INDEX[a.owner]].name.split(' ')[0]} ${a.name} ${A.size(a).toFixed(1)}k`).join('<br>') : ''; };

  // 지도 클릭: 군단이 선택돼 있으면 이동 명령
  const prevPick = UI.pickHook;
  UI.pickHook = (i) => {
    const w = UI.world;
    if (UI.armySel != null && w.player && i >= 0) {
      const a = w.armies.find(x => x.id === UI.armySel && x.owner === w.player);
      if (a) {
        if (i === a.loc) { UI.armySel = null; return false; }
        const r = W4.Act.move(w, w.player, a.id, i);
        toast(r.ok ? `${a.name}: ${w.map.regions[i].root}(으)로 이동 (${r.path.length - 1}칸)` : r.msg);
        if (r.ok) { UI.show('army'); return true; }
      }
    }
    return prevPick ? prevPick(i) : false;
  };

  // ── 군사 패널 ──
  UI.register('army', '⚔️ 군사', (p, w) => {
    const id = w.player;
    if (!id) { p.innerHTML = '<p class="muted">관전 중</p>'; return; }
    const N = w.nations[id], mine = A.list(w, id);
    let h = `<div class="small">인력 ${Math.round(N.manpower)}/${Math.round(N.manpowerMax)}천 · 군단 ${mine.length} · 총 병력 ${mine.reduce((s, a) => s + A.size(a), 0).toFixed(1)}k</div>`;
    h += '<h4>군단</h4>' + (mine.length ? mine.map(a => `<div class="w4army ${a.id === UI.armySel ? 'sel' : ''}" data-army="${a.id}"><b>${a.name}</b> <span class="small">${w.map.regions[a.loc].root} · ${({ idle: '대기', move: '이동', siege: '공성' })[a.mode]}${a.train > 0 ? ' · 훈련 중' : ''}${a.cutOff ? ' · ⚠보급 차단' : ''}</span><br><span class="small">${comp(a)} = ${A.size(a).toFixed(1)}k · 사기 ${Math.round(a.morale * 100)}% · 보급 ${Math.round(a.supply * 100)}% · 전투력 ${A.power(w, a).toFixed(0)}</span><br><span class="small muted">장군 ${a.gen.name} ★${a.gen.skill} · ${W4.GEN_TRAITS[a.gen.trait] || ''}</span></div>`).join('') : '<p class="muted small">군단이 없습니다</p>');
    const sel = mine.find(a => a.id === UI.armySel);
    if (sel) {
      const same = mine.filter(a => a !== sel && a.loc === sel.loc);
      h += `<div class="small">📍 지도에서 목적지를 누르면 이동합니다.</div><div class="btnrow">${same.map(b => `<button class="btn small" data-merge="${b.id}">합치기: ${b.name}</button>`).join('')}<button class="btn small" data-stop="1">정지</button><button class="btn small danger" data-disband="1">해산</button></div>`;
    }
    // 모집
    const where = UI.sel >= 0 && w.state.regions[UI.sel].owner === id && !w.state.regions[UI.sel].occ && (W4.cityOf(w, UI.sel) || w.state.regions[UI.sel].bld.barracks) ? UI.sel : w.map.nations[id].capital;
    h += `<h4>모집 — ${w.map.regions[where].root} <small class="muted">(도시·병영 지역을 지도에서 선택)</small></h4><div class="btnrow">` + CLS.map(k => { const C = W4.UNIT_CLASSES[k]; return `<button class="btn small" data-rec="${k}" title="공격 ${C.atk} · 방어 ${C.def} · 유지 금 ${C.upkeep}/식량 ${C.food}">${C.icon}${C.name} ×1 <small>${Object.entries(C.cost).map(([r, v]) => W4.RES[r].icon + v).join('')} 👥${C.mp}</small></button>`; }).join('') + '</div>';
    h += `<div class="btnrow"><button class="btn small" data-rec5="inf">보병 ×5</button><button class="btn small" data-rec5="arc">궁병 ×5</button><button class="btn small" data-rec5="cav">기병 ×5</button></div>`;
    p.innerHTML = h;
    p.querySelectorAll('[data-army]').forEach(x => x.onclick = () => { UI.armySel = +x.dataset.army; const a = w.armies.find(b => b.id === UI.armySel); if (a) { UI.sel = a.loc; UI.R.sel = a.loc; } UI.show('army'); });
    p.querySelectorAll('[data-merge]').forEach(b => b.onclick = () => UI.act(W4.Act.merge(w, id, sel.id, +b.dataset.merge)));
    p.querySelectorAll('[data-stop]').forEach(b => b.onclick = () => { sel.path = []; sel.mode = 'idle'; UI.show('army'); });
    p.querySelectorAll('[data-disband]').forEach(b => b.onclick = () => { if (confirm('군단을 해산할까요? (인력 절반 회수)')) { UI.armySel = null; UI.act(W4.Act.disband(w, id, sel.id)); } });
    p.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => UI.act(W4.Act.recruit(w, id, where, b.dataset.rec, 1, sel && sel.loc === where ? sel.id : null)));
    p.querySelectorAll('[data-rec5]').forEach(b => b.onclick = () => UI.act(W4.Act.recruit(w, id, where, b.dataset.rec5, 5, sel && sel.loc === where ? sel.id : null)));
  });

  // ── 전쟁 패널 ──
  UI.peaceDraft = {};
  UI.register('wars', '🔥 전쟁', (p, w) => {
    const id = w.player;
    let h = '';
    const offers = (w.diplo.peaceOffers || []);
    if (offers.length && id) h += '<h4>🕊 평화 제안</h4>' + offers.map((o, k) => `<div class="row">${w.def(o.from).name}: ${o.terms.white ? '백지 평화' : `${(o.terms.cede || []).map(i => w.map.regions[i].root).join(', ')}${o.terms.gold ? ' · 배상금 ' + o.terms.gold : ''}${o.terms.vassal ? ' · 종속' : ''}`} <button class="btn small primary" data-pans="${k}:1">수락</button><button class="btn small" data-pans="${k}:0">거절</button></div>`).join('');
    const wars = w.wars.filter(x => !id || War.side(x, id));
    h += `<h4>${id ? '우리 전쟁' : '진행 중인 전쟁'} (${wars.length})</h4>`;
    for (const war of wars) {
      const side = id ? War.side(war, id) : 'att', my = side === 'att' ? war.score : -war.score;
      h += `<div class="w4war"><b>${war.name}</b> <span class="small muted">${Math.floor((w.turn - war.start) / 12)}년 ${(w.turn - war.start) % 12}개월</span><br>
        <span class="small">공격: ${war.att.map(x => UI.flagHTML(x) + w.def(x).name.split(' ')[0]).join(' ')}<br>방어: ${war.def.map(x => UI.flagHTML(x) + w.def(x).name.split(' ')[0]).join(' ')}</span>
        <div class="hpbar"><div style="width:${50 + my / 2}%;background:${my >= 0 ? '#4dd08a' : '#ff7070'}"></div></div><div class="small">전쟁 점수 ${my > 0 ? '+' : ''}${my.toFixed(0)} · 전투 ${war.battles.length} · 명분 ${war.cb || '없음'}</div>`;
      if (id && war.lead.includes(id)) {
        const enemy = side === 'att' ? war.def : war.att, ours = side === 'att' ? war.att : war.def;
        const occ = []; w.state.regions.forEach((s, i) => { if (ours.includes(s.occ) && enemy.includes(s.owner)) occ.push(i); });
        const dr = UI.peaceDraft[war.id] = UI.peaceDraft[war.id] || { cede: [], gold: 0 };
        dr.cede = dr.cede.filter(i => occ.includes(i));
        const cost = War.termsCost(w, war, dr);
        h += `<div class="small">요구할 점령지:</div><div class="btnrow">${occ.map(i => `<button class="btn small ${dr.cede.includes(i) ? 'primary' : ''}" data-cede="${war.id}:${i}">${w.map.regions[i].root} (${War.regionCost(w, i).toFixed(0)})</button>`).join('') || '<span class="small muted">점령지 없음</span>'}</div>
          <div class="btnrow"><label class="small">배상금 <input type="number" min="0" step="50" value="${dr.gold}" data-gold="${war.id}" style="width:70px"></label><span class="small">요구 비용 ${cost.toFixed(0)} / 점수 ${my.toFixed(0)}</span></div>
          <div class="btnrow"><button class="btn small primary" data-peace="${war.id}">평화 제안</button><button class="btn small" data-white="${war.id}">백지 평화</button></div>`;
      } else if (id) h += `<div class="btnrow"><button class="btn small" data-sep="${war.id}">단독 강화</button></div>`;
      h += '</div>';
    }
    // 최근 전투
    const battles = w.log.filter(e => e.kind === 'battle' && (!id || e.who === id || e.other === id)).slice(-8).reverse();
    if (battles.length) h += '<h4>최근 전투</h4>' + battles.map(e => `<div class="small">${1000 + Math.floor(e.t / 12)}.${(e.t % 12) + 1} ${e.text}</div>`).join('');
    if (w.warHistory && w.warHistory.length) h += '<h4>지난 전쟁</h4>' + w.warHistory.slice(-6).reverse().map(x => `<div class="small">${x.name} (${1000 + Math.floor(x.start / 12)}~${1000 + Math.floor(x.end / 12)}) — ${x.winner ? w.def(x.winner).name + ' 승' : '백지 평화'} ${x.terms ? '· ' + x.terms : ''}</div>`).join('');
    p.innerHTML = h || '<p class="muted">전쟁이 없습니다.</p>';
    p.querySelectorAll('[data-pans]').forEach(b => b.onclick = () => { const [k, y] = b.dataset.pans.split(':'); UI.act(W4.Act.answerPeace(w, +k, y === '1')); });
    p.querySelectorAll('[data-cede]').forEach(b => b.onclick = () => { const [wid, i] = b.dataset.cede.split(':').map(Number); const dr = UI.peaceDraft[wid]; const k = dr.cede.indexOf(i); if (k >= 0) dr.cede.splice(k, 1); else dr.cede.push(i); UI.show('wars'); });
    p.querySelectorAll('[data-gold]').forEach(x => x.onchange = () => { UI.peaceDraft[+x.dataset.gold].gold = Math.max(0, +x.value || 0); UI.show('wars'); });
    p.querySelectorAll('[data-peace]').forEach(b => b.onclick = () => { const wid = +b.dataset.peace, r = W4.Act.peace(w, wid, id, Object.assign({}, UI.peaceDraft[wid])); toast(!r.ok ? r.msg : r.accepted ? '평화 조약 체결!' : r.msg); UI.R.dirty = true; UI.refresh(); });
    p.querySelectorAll('[data-white]').forEach(b => b.onclick = () => { const r = W4.Act.peace(w, +b.dataset.white, id, { white: true }); toast(!r.ok ? r.msg : r.accepted ? '백지 평화 체결' : r.msg); UI.R.dirty = true; UI.refresh(); });
    p.querySelectorAll('[data-sep]').forEach(b => b.onclick = () => { UI.act(W4.Act.peace(w, +b.dataset.sep, id, { white: true })); UI.R.dirty = true; });
  });

  // ── 외교 패널의 선전포고 ──
  UI.diploWar = (w, id, o) => {
    if (War.atWar(w, id, o)) return '';
    const c = War.canDeclare(w, id, o), cb = D.cbs(w, id, o);
    // 상대 편에 설 국가 예상
    const helpers = [...D.allies(w, o), ...D.vassals(w, o), ...w.diplo.treaties.filter(t => (t.type === 'defense' && (t.a === o || t.b === o)) || (t.type === 'guarantee' && t.b === o)).map(t => (t.type === 'guarantee' ? t.a : t.a === o ? t.b : t.a))].filter(x => x !== id);
    return `<h4>전쟁</h4><div class="small">예상 참전: ${[...new Set(helpers)].map(x => w.def(x).name).join(', ') || '없음'} · 상대 측 국력 ${Math.round(W4.power(w, o))}</div>
      <div class="btnrow"><button class="btn small danger" id="w4-declare" ${c.ok ? '' : 'disabled'} title="${c.msg || ''}">⚔️ 선전포고${cb.length ? '' : ' (명분 없음: 안정도 -10)'}</button></div>${c.ok ? '' : `<div class="small muted">${c.msg}</div>`}`;
  };
  UI.bindDiploWar = (p, w, id, o) => {
    const b = p.querySelector('#w4-declare'); if (!b) return;
    b.onclick = () => { if (!confirm(`${w.def(o).name} 에 선전포고할까요?`)) return; const r = W4.Act.declareWar(w, id, o); toast(r.ok ? '전쟁이 시작되었습니다!' : r.msg); UI.R.dirty = true; UI.show('wars'); };
  };
  UI.tabOrder = ['region', 'state', 'army', 'wars', 'diplo', 'tech', 'nations'];
  UI.topExtra = () => { const w = UI.world; const n = w.player ? w.wars.filter(x => War.side(x, w.player)).length : w.wars.length; return n ? `<span class="small" style="color:#ff8a7a">⚔️ 전쟁 ${n}</span>` : ''; };
})();
