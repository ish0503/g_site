// ─────────────────────────────────────────────
// 4.0 세계 지도 렌더러
//   · 기본 층(지역 색·국경·해안)은 오프스크린 캔버스에 그려 두고, 소유권이 바뀔 때만 다시 그린다.
//   · 지도 모드: political(정치) · military(군사) · economic(경제) · terrain(지형)
//   · 위에 도시·수도·항구·요새·군단·함대·전선·라벨을 매 프레임 그린다.
//   · 이동(드래그)·확대(휠·핀치), 화면 좌표 → 지역 선택.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4;
  const SUB = 3;                      // 칸 하나를 3×3 픽셀로 (국경선을 칸 사이에 그리기 위해)
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const SEA = [28, 52, 86], SEA2 = [36, 66, 104];

  class WorldRender {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.mode = 'political'; this.view = { x: 0, y: 0, k: 1 }; this.dirty = true; this.sel = -1; this.hover = -1;
      this.base = document.createElement('canvas');
    }
    attach(world) { this.w = world; this.map = world.map; this.dirty = true; this.fit(); }
    setMode(m) { this.mode = m; this.dirty = true; }
    fit() {
      const r = this.cv.getBoundingClientRect(), W = r.width || 800, H = r.height || 500;
      const k = Math.min(W / W4.MAP_W, H / W4.MAP_H);
      this.view = { k, x: (W - W4.MAP_W * k) / 2, y: (H - W4.MAP_H * k) / 2 };
    }
    toMap(px, py) { const v = this.view; return { x: (px - v.x) / v.k, y: (py - v.y) / v.k }; }
    pick(px, py) { const p = this.toMap(px, py); return W4.regionAt(this.map, p.x, p.y); }
    pickSea(px, py) { const p = this.toMap(px, py); return W4.seaAt(this.map, p.x, p.y); }
    zoom(f, px, py) {
      const v = this.view, k2 = Math.max(0.3, Math.min(6, v.k * f)), f2 = k2 / v.k;
      v.x = px - (px - v.x) * f2; v.y = py - (py - v.y) * f2; v.k = k2;
    }
    // 지역 색 (모드별)
    regionColor(r, st) {
      const owner = st.owner, nat = owner === 'neutral' ? W4.NEUTRAL : W4.NATIONS[W4.NATION_INDEX[owner]];
      const terr = hex(W4.TERRAIN[r.terrain].color);
      if (this.mode === 'terrain') return terr;
      if (this.mode === 'economic') {
        const v = Math.min(1, (st.dev || r.dev) / 6 * 0.5 + (W4.regionValue ? W4.regionValue(this.w, r.id) : 0) / 40 * 0.5);
        return mix([60, 60, 70], [255, 205, 70], v);
      }
      let c = hex(nat.color);
      if (this.mode === 'military') c = mix(c, [70, 70, 80], 0.45);
      else c = mix(c, terr, 0.18);
      return c;
    }
    buildBase() {
      const M = this.map, GW = M.gw, GH = M.gh, S = this.w.state;
      const cv = this.base; cv.width = GW * SUB; cv.height = GH * SUB;
      const g = cv.getContext('2d'), img = g.createImageData(cv.width, cv.height), d = img.data;
      const col = M.regions.map(r => this.regionColor(r, S.regions[r.id]));
      const occ = M.regions.map(r => { const s = S.regions[r.id]; return s.occ && s.occ !== s.owner ? hex((W4.NATIONS[W4.NATION_INDEX[s.occ]] || W4.NEUTRAL).color) : null; });
      const ownerOf = (id) => (id < 0 ? null : (S.regions[id].occ || S.regions[id].owner));
      for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
        const i = cx + cy * GW, r = M.rid[i];
        for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
          const px = cx * SUB + sx, py = cy * SUB + sy, o = (px + py * cv.width) * 4;
          let c;
          if (r < 0) { const z = M.sea[i]; c = z >= 0 && (z & 1) ? SEA2 : SEA; if (this.w.state.seas && this.w.state.seas[z] && this.w.state.seas[z].blockade) c = mix(c, [120, 40, 40], 0.35); }
          else {
            c = col[r];
            if (occ[r] && ((px + py) % 6) < 2) c = occ[r];          // 점령지: 사선 무늬
            // 칸 가장자리 → 이웃 칸과 다른 지역/국가면 경계선
            const edgeR = sx === SUB - 1 ? M.rid[i + 1] : sx === 0 ? M.rid[i - 1] : null;
            const edgeD = sy === SUB - 1 ? M.rid[i + GW] : sy === 0 ? M.rid[i - GW] : null;
            for (const e of [edgeR, edgeD]) {
              if (e === null || e === undefined || e === r) continue;
              if (e < 0) { c = mix(c, [235, 225, 190], 0.55); break; }                         // 해안선
              if (ownerOf(e) !== ownerOf(r)) { c = mix(c, [15, 15, 20], 0.75); break; }         // 국경
              c = mix(c, [20, 20, 25], 0.3);                                                   // 지역 경계
            }
          }
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      this.dirty = false;
    }
    draw(extra) {
      const cv = this.cv, ctx = this.ctx, dpr = window.devicePixelRatio || 1;
      const r = cv.getBoundingClientRect();
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      if (this.dirty) this.buildBase();
      const v = this.view, M = this.map, S = this.w.state;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgb(20,38,64)'; ctx.fillRect(0, 0, r.width, r.height);
      ctx.save(); ctx.translate(v.x, v.y); ctx.scale(v.k, v.k);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.base, 0, 0, W4.MAP_W, W4.MAP_H);
      const k = v.k, inv = 1 / k;
      // 선택·마우스 위치 지역 강조
      for (const [id, colr] of [[this.hover, 'rgba(255,255,255,.35)'], [this.sel, '#ffe066']]) {
        if (id < 0) continue; const g = M.regions[id];
        ctx.strokeStyle = colr; ctx.lineWidth = 2.5 * inv; ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, Math.PI * 2); ctx.stroke();
        if (id === this.sel) for (const j of g.nb) { const h = M.regions[j]; ctx.strokeStyle = 'rgba(255,224,102,.35)'; ctx.lineWidth = 1 * inv; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(h.x, h.y); ctx.stroke(); }
      }
      // 전선 (전쟁 중인 국가끼리 맞닿은 경계)
      if (extra && extra.fronts) { ctx.strokeStyle = 'rgba(255,80,60,.85)'; ctx.lineWidth = 2.2 * inv; ctx.setLineDash([4 * inv, 3 * inv]); for (const [a, b] of extra.fronts) { const A = M.regions[a], B = M.regions[b]; const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.y - A.y, dy = A.x - B.x, L = Math.hypot(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(mx - dx / L * 9, my - dy / L * 9); ctx.lineTo(mx + dx / L * 9, my + dy / L * 9); ctx.stroke(); } ctx.setLineDash([]); }
      // 도시·요새·항구
      for (const g of M.regions) {
        const s = S.regions[g.id];
        if (g.city) {
          ctx.fillStyle = g.city.capital ? '#ffe066' : '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2 * inv;
          if (g.city.capital) { star(ctx, g.x, g.y, 6.5, 3); } else { ctx.beginPath(); ctx.rect(g.x - 3.2, g.y - 3.2, 6.4, 6.4); }
          ctx.fill(); ctx.stroke();
        }
        if (g.port) { ctx.fillStyle = '#9fe8ff'; ctx.font = `${10}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('⚓', g.x + 9, g.y + 10); }
        if (this.mode === 'military' && (s.fort || 0) > 0) { ctx.fillStyle = '#ddd'; ctx.font = '9px sans-serif'; ctx.fillText('🏰'.repeat(Math.min(3, s.fort)), g.x, g.y - 9); }
        if (this.mode === 'economic' && k > 0.8) { ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText((W4.RES[g.special] || { icon: '' }).icon, g.x - 9, g.y + 10); }
      }
      // 함대·군단 (외부에서 넘겨줌)
      if (extra && extra.draw) extra.draw(ctx, inv);
      // 라벨: 확대 수준에 따라 국가 이름 → 지역·도시 이름
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      if (k < 1.6) {
        for (const n of W4.NATIONS) {
          const ids = M.regions.filter(g => (S.regions[g.id].owner) === n.id); if (!ids.length) continue;
          const x = ids.reduce((a, g) => a + g.x, 0) / ids.length, y = ids.reduce((a, g) => a + g.y, 0) / ids.length;
          label(ctx, n.name, x, y - 12, 13 * Math.max(0.9, Math.min(1.4, 1 / k)), '#fff', inv);
        }
      } else {
        for (const g of M.regions) label(ctx, g.city ? g.city.name : g.root, g.x, g.y - 9, 9, g.city ? '#fff' : '#e6e6e6', inv);
      }
      if (k > 0.75) for (const z of M.seas) { ctx.fillStyle = 'rgba(160,200,240,.45)'; ctx.font = `italic ${11}px sans-serif`; ctx.fillText(z.name, z.x, z.y); }
      ctx.restore();
    }
  }
  function star(ctx, x, y, R, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } ctx.closePath(); }
  function label(ctx, t, x, y, size, color) { ctx.font = `bold ${size}px sans-serif`; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 3; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); }

  // 국기: 두 색 + 문장(도형)
  W4.drawFlag = (cv, nid) => {
    const n = nid === 'neutral' ? W4.NEUTRAL : W4.NATIONS[W4.NATION_INDEX[nid]];
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = n.color; g.fillRect(0, 0, W, H);
    g.fillStyle = n.color2; const v = (n.id || '').length % 3;
    if (v === 0) g.fillRect(0, H * 0.38, W, H * 0.24); else if (v === 1) g.fillRect(W * 0.33, 0, W * 0.34, H); else { g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.45, H / 2); g.lineTo(0, H); g.fill(); }
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1;
    const x = W / 2, y = H / 2, s = H * 0.26, sides = { circle: 0, triangle: 3, square: 4, pentagon: 5, hexagon: 6, diamond: 4 }[n.emblem];
    g.beginPath();
    if (!sides) g.arc(x, y, s, 0, Math.PI * 2);
    else for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + (n.emblem === 'square' ? Math.PI / 4 : 0) + i * Math.PI * 2 / sides; g.lineTo(x + Math.cos(a) * s * (n.emblem === 'diamond' && i % 2 ? 0.65 : 1), y + Math.sin(a) * s); }
    g.closePath(); g.fill(); g.stroke();
  };

  // 입력: 드래그 이동·휠/핀치 확대·탭 선택
  W4.bindMapInput = (R, onPick, onHover) => {
    const cv = R.cv; let drag = null, moved = false; const pts = new Map(); let pinch = null;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e)); if (pts.size === 1) { drag = pos(e); moved = false; } else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; } });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); R.zoom(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; moved = true; return; }
      if (drag && pts.size === 1) { const dx = p.x - drag.x, dy = p.y - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; if (moved) { R.view.x += dx; R.view.y += dy; drag = p; } }
      else if (onHover && e.pointerType === 'mouse') onHover(R.pick(p.x, p.y), p);
    });
    const up = (e) => { const p = pos(e); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (drag && !moved && pts.size === 0) onPick(R.pick(p.x, p.y), R.pickSea(p.x, p.y), p); if (!pts.size) drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); R.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive: false });
  };
  W4.WorldRender = WorldRender;
})();
