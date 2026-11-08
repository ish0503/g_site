// ─────────────────────────────────────────────
// 4.0 화면: 해군 (함대 건조·이동·정박·승선·상륙·봉쇄 표시)
// ─────────────────────────────────────────────
(() => {
  const { toast } = SW.ui;
  const W4 = SW.W4, UI = W4.UI, N = W4.Naval, A = W4.Army;
  UI.fleetSel = null;
  const SK = Object.keys(W4.SHIPS);
  // 지도: 함대 (해역 중심 근처에 배 모양)
  UI.drawFleets = (ctx, inv) => {
    const w = UI.world; if (!w.fleets) return;
    const by = new Map(); for (const f of w.fleets) { const k = f.port !== null && f.port !== undefined ? 'p' + f.port : 's' + f.sea; if (!by.has(k)) by.set(k, []); by.get(k).push(f); }
    for (const [k, list] of by) {
      let x, y; if (k[0] === 'p') { const r = w.map.regions[+k.slice(1)], z = w.map.seas[r.seas[0]]; x = r.x + (z.x - r.x) * 0.25; y = r.y + (z.y - r.y) * 0.25; } else { const z = w.map.seas[+k.slice(1)]; x = z.x; y = z.y + 12; }
      list.forEach((f, j) => {
        const n = W4.NATIONS[W4.NATION_INDEX[f.owner]], xx = x + j * 12 - (list.length - 1) * 6;
        ctx.fillStyle = n.color; ctx.strokeStyle = f.id === UI.fleetSel ? '#ffe066' : '#111'; ctx.lineWidth = (f.id === UI.fleetSel ? 2.5 : 1) * inv;
        ctx.beginPath(); ctx.moveTo(xx - 7, y); ctx.lineTo(xx + 7, y); ctx.lineTo(xx + 4, y + 5); ctx.lineTo(xx - 4, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y - 8); ctx.lineTo(xx + 5, y - 2); ctx.closePath(); ctx.fillStyle = '#eee'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(N.size(f)), xx, y + 13);
        if (N.carried(w, f).length) { ctx.fillStyle = '#ffcf4d'; ctx.fillText('⚔', xx + 8, y - 4); }
      });
      if (UI.fleetSel != null) { const f = list.find(q => q.id === UI.fleetSel); if (f && f.path.length) { ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2 * inv; ctx.setLineDash([4 * inv, 4 * inv]); ctx.beginPath(); ctx.moveTo(x, y); for (const s of f.path) ctx.lineTo(w.map.seas[s].x, w.map.seas[s].y); ctx.stroke(); ctx.setLineDash([]); } }
    }
  };
  UI.seaExtra = (z) => {
    const w = UI.world; const st = w.state.seas[z], here = N.inSea(w, z);
    return `<div class="small">${st.blockade ? `🚫 ${w.def(st.blockade).name} 봉쇄 중` : '봉쇄 없음'}</div>` + (here.length ? here.map(f => `<div class="small">${w.def(f.owner).name.split(' ')[0]} ${f.name}: ${SK.map(k => W4.SHIPS[k].icon + (f.s[k] || 0)).join(' ')}</div>`).join('') : '');
  };
  // 지도 클릭: 함대가 선택돼 있으면 해역=이동, 해안=상륙/정박
  const prevPick = UI.pickHook;
  UI.pickHook = (i, sea) => {
    const w = UI.world;
    if (UI.fleetSel != null && w.player) {
      const f = w.fleets.find(x => x.id === UI.fleetSel && x.owner === w.player);
      if (f) {
        if (i < 0 && sea >= 0) { const r = W4.Act.moveFleet(w, w.player, f.id, sea); toast(r.ok ? `${f.name}: ${w.map.seas[sea].name}(으)로 (${r.path.length - 1}해역)` : r.msg); UI.show('navy'); return true; }
        if (i >= 0) {
          const s = w.state.regions[i], r = w.map.regions[i];
          if (N.carried(w, f).length && r.seas.includes(f.sea) && (s.occ || s.owner) !== w.player) { const res = W4.Act.land(w, w.player, f.id, i); toast(res.ok ? '상륙!' : res.msg); UI.R.dirty = true; UI.show('navy'); return true; }
          if ((r.port || s.bld.shipyard) && s.owner === w.player) { const res = W4.Act.dock(w, w.player, f.id, i); toast(res.ok ? `${r.root} 항구로 귀항` : res.msg); UI.show('navy'); return true; }
          if (N.carried(w, f).length && r.seas.includes(f.sea)) { const res = W4.Act.land(w, w.player, f.id, i); toast(res.ok ? '상륙' : res.msg); UI.show('navy'); return true; }
        }
      }
    }
    return prevPick ? prevPick(i, sea) : false;
  };
  UI.register('navy', '⚓ 해군', (p, w) => {
    const id = w.player; if (!id) { p.innerHTML = '<p class="muted">관전 중</p>'; return; }
    const mine = N.list(w, id);
    const ports = w.ownedRegions(id).filter(i => !w.state.regions[i].occ && (w.map.regions[i].port || w.state.regions[i].bld.shipyard) && w.map.regions[i].seas.length);
    let h = `<div class="small">함대 ${mine.length} · 항구 ${ports.length}${ports.some(i => W4.isBlockaded(w, i)) ? ' · ⚠ 봉쇄당한 항구 있음' : ''}</div>`;
    h += '<h4>함대</h4>' + (mine.length ? mine.map(f => { const c = N.carried(w, f); return `<div class="w4army ${f.id === UI.fleetSel ? 'sel' : ''}" data-fleet="${f.id}"><b>${f.name}</b> <span class="small">${f.port !== null && f.port !== undefined ? '⚓ ' + w.map.regions[f.port].root : '🌊 ' + w.map.seas[f.sea].name}${f.mode === 'move' ? ' · 항해 중' : ''}</span><br><span class="small">${SK.map(k => W4.SHIPS[k].icon + W4.SHIPS[k].name + ' ' + (f.s[k] || 0)).join(' · ')} · 전투력 ${N.power(w, f).toFixed(0)} · 사기 ${Math.round(f.morale * 100)}%</span>${c.length ? `<br><span class="small">승선: ${c.map(a => `${a.name} ${A.size(a).toFixed(1)}k`).join(', ')} (수송 ${N.load(w, f).toFixed(1)}/${N.capacity(f)})</span>` : ''}</div>`; }).join('') : '<p class="muted small">함대가 없습니다</p>');
    const sel = mine.find(f => f.id === UI.fleetSel);
    if (sel) {
      h += '<div class="small">🌊 바다를 누르면 이동, 자국 항구를 누르면 귀항, 승선 중이면 해안 지역을 눌러 상륙합니다.</div>';
      if (sel.port !== null && sel.port !== undefined) {
        const here = A.list(w, id).filter(a => a.loc === sel.port && !a.onFleet);
        if (here.length) h += '<div class="btnrow">' + here.map(a => `<button class="btn small" data-embark="${a.id}">🚢 ${a.name} 승선 (${A.size(a).toFixed(1)}k)</button>`).join('') + '</div>';
      }
    }
    const where = UI.sel >= 0 && ports.includes(UI.sel) ? UI.sel : ports[0];
    if (where !== undefined) h += `<h4>건조 — ${w.map.regions[where].root} <small class="muted">(항구를 지도에서 선택)</small></h4><div class="btnrow">` + SK.map(k => { const S = W4.SHIPS[k]; return `<button class="btn small" data-ship="${k}">${S.icon}${S.name} <small>${Object.entries(S.cost).map(([r, v]) => W4.RES[r].icon + v).join('')}</small></button>`; }).join('') + '</div><div class="small muted">수송선 1척 = 5개 대대 · 전투선 2척 이상이 적 항구 해역에 있으면 봉쇄 · 보급선은 맞닿은 해안의 아군을 보급</div>';
    else h += '<p class="small muted">항구나 조선소가 없습니다 (해안 지역에 조선소를 지으세요)</p>';
    p.innerHTML = h;
    p.querySelectorAll('[data-fleet]').forEach(x => x.onclick = () => { UI.fleetSel = +x.dataset.fleet; UI.armySel = null; UI.show('navy'); });
    p.querySelectorAll('[data-embark]').forEach(b => b.onclick = () => UI.act(W4.Act.embark(w, id, +b.dataset.embark, sel.id)));
    p.querySelectorAll('[data-ship]').forEach(b => b.onclick = () => UI.act(W4.Act.buildShip(w, id, where, b.dataset.ship, 1)));
  });
  UI.tabOrder = ['region', 'state', 'army', 'navy', 'wars', 'diplo', 'tech', 'nations'];
})();
