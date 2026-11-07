// 캔버스 렌더러
window.SW = window.SW || {};

(() => {
  const TEAM = [
    { fill: '#3f7cff', stroke: '#9cc0ff', dark: '#1d3a80' },
    { fill: '#f04848', stroke: '#ffadad', dark: '#7a1d1d' },
  ];
  SW.TEAM_COLORS = TEAM;

  const TAU = Math.PI * 2;

  function poly(ctx, n, r, rot, scale = 1) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i * TAU / n;
      const x = Math.cos(a) * r * scale, y = Math.sin(a) * r * scale;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  SW.shapePath = (ctx, shape, r, rot) => {
    switch (shape) {
      case 'circle': ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); break;
      case 'triangle': poly(ctx, 3, r * 1.3, rot); break;
      case 'square': poly(ctx, 4, r * 1.2, rot + Math.PI / 4); break;
      case 'diamond': {
        const c = Math.cos(rot), s = Math.sin(rot), a = r * 1.35, b = r * 0.8;
        ctx.beginPath();
        ctx.moveTo(c * a, s * a); ctx.lineTo(-s * b, c * b); ctx.lineTo(-c * a, -s * a); ctx.lineTo(s * b, -c * b); ctx.closePath();
        break;
      }
      case 'pentagon': poly(ctx, 5, r * 1.15, rot); break;
      case 'hexagon': poly(ctx, 6, r * 1.1, rot); break;
      case 'star': {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.62 : r * 1.4;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        break;
      }
    }
  };

  SW.drawGlyph = (ctx, glyph, r, color, rot) => {
    const g = r * 0.5;
    ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.2); ctx.lineCap = 'round';
    switch (glyph) {
      case 'dot': ctx.beginPath(); ctx.arc(0, 0, g * 0.6, 0, TAU); ctx.fill(); break;
      case 'ring': ctx.beginPath(); ctx.arc(0, 0, g * 0.8, 0, TAU); ctx.stroke(); break;
      case 'plus': ctx.beginPath(); ctx.moveTo(-g, 0); ctx.lineTo(g, 0); ctx.moveTo(0, -g); ctx.lineTo(0, g); ctx.stroke(); break;
      case 'x': ctx.beginPath(); ctx.moveTo(-g * .8, -g * .8); ctx.lineTo(g * .8, g * .8); ctx.moveTo(g * .8, -g * .8); ctx.lineTo(-g * .8, g * .8); ctx.stroke(); break;
      case 'bar': ctx.save(); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-g * 1.1, 0); ctx.lineTo(g * 1.1, 0); ctx.stroke(); ctx.restore(); break;
      case 'double': ctx.beginPath(); ctx.arc(-g * .45, 0, g * .35, 0, TAU); ctx.arc(g * .45, 0, g * .35, 0, TAU); ctx.fill(); break;
      case 'sq': ctx.fillRect(-g * .6, -g * .6, g * 1.2, g * 1.2); break;
      case 'tri': poly(ctx, 3, g, rot); ctx.fill(); break;
      case 'star': SW.shapePath(ctx, 'star', g * 0.65, -Math.PI / 2); ctx.fill(); break;
      case 'chevron': ctx.save(); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-g * .5, -g * .8); ctx.lineTo(g * .5, 0); ctx.lineTo(-g * .5, g * .8); ctx.stroke(); ctx.restore(); break;
      case 'eye': ctx.beginPath(); ctx.ellipse(0, 0, g, g * .55, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, g * .3, 0, TAU); ctx.fill(); break;
      case 'bolt': ctx.beginPath(); ctx.moveTo(g * .3, -g); ctx.lineTo(-g * .4, g * .1); ctx.lineTo(g * .3, g * .1); ctx.lineTo(-g * .3, g); ctx.stroke(); break;
      case 'flake': for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(-g, 0); ctx.lineTo(g, 0); ctx.stroke(); ctx.restore(); } break;
      case 'skull': ctx.beginPath(); ctx.arc(0, -g * .15, g * .7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.arc(-g * .3, -g * .2, g * .2, 0, TAU); ctx.arc(g * .3, -g * .2, g * .2, 0, TAU); ctx.fill(); break;
      case 'wave': ctx.beginPath(); ctx.arc(0, 0, g * .8, -Math.PI * .1, Math.PI * 1.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -g * .6); ctx.moveTo(0, 0); ctx.lineTo(g * .45, 0); ctx.stroke(); break;
    }
  };

  // 단일 유닛 아이콘 (UI용)
  SW.drawUnitIcon = (canvas, type, team = 0, scale) => {
    const ctx = canvas.getContext('2d');
    const d = SW.UNITS[type];
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = scale || Math.min(1.6, (Math.min(w, h) * 0.32) / d.size);
    ctx.translate(w / 2, h / 2); ctx.scale(s, s);
    const rot = d.shape === 'triangle' || d.shape === 'diamond' ? 0 : d.shape === 'pentagon' || d.shape === 'star' ? -Math.PI / 2 : 0;
    SW.shapePath(ctx, d.shape, d.size, rot);
    ctx.fillStyle = TEAM[team].fill; ctx.fill();
    ctx.lineWidth = 1.5 / s * 1.2; ctx.strokeStyle = TEAM[team].stroke; ctx.stroke();
    SW.drawGlyph(ctx, d.glyph, d.size, d.accent, 0);
  };

  const ELC = (el) => (SW.ELEMENTS[el] && SW.ELEMENTS[el].color) || null;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = 1; this.ox = 0; this.oy = 0;
      this.zoom = 1; this.world = { W: SW.WORLD.W, H: SW.WORLD.H };
      this.camX = this.world.W / 2; this.camY = this.world.H / 2;
      this.showAuras = true;
      this.quality = 'high';
    }

    setWorld(W, H) {
      if (this.world.W !== W || this.world.H !== H) { this.world = { W, H }; this.resetView(); }
    }

    resize() {
      const c = this.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      this.dpr = dpr; this.cw = w; this.ch = h;
      this.fit = Math.min(w / this.world.W, h / this.world.H);
      this.scale = this.fit * this.zoom;
      this.clampCam(w, h);
      this.ox = w / 2 - this.camX * this.scale;
      this.oy = h / 2 - this.camY * this.scale;
    }

    clampCam(w, h) {
      const hw = w / 2 / this.scale, hh = h / 2 / this.scale;
      const W = this.world.W, H = this.world.H;
      this.camX = hw * 2 >= W ? W / 2 : Math.min(W - hw, Math.max(hw, this.camX));
      this.camY = hh * 2 >= H ? H / 2 : Math.min(H - hh, Math.max(hh, this.camY));
    }

    zoomAt(cx, cy, factor) {
      const p = this.toWorld(cx, cy);
      this.zoom = Math.min(8, Math.max(1, this.zoom * factor));
      this.resize();
      const q = this.toWorld(cx, cy);
      this.camX += p.x - q.x; this.camY += p.y - q.y;
      this.resize();
    }

    pan(dxScreen, dyScreen) { this.camX -= dxScreen / this.scale; this.camY -= dyScreen / this.scale; }
    resetView() { this.zoom = 1; this.camX = this.world.W / 2; this.camY = this.world.H / 2; }

    toWorld(cx, cy) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (cx - rect.left - this.ox) / this.scale, y: (cy - rect.top - this.oy) / this.scale };
    }

    draw(b, ui = {}) {
      this.setWorld(b.W, b.H);
      this.resize();
      const ctx = this.ctx, W = b.W, H = b.H, S = this.scale;
      const q = b.quality || this.quality;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      let sx = 0, sy = 0;
      if (b.shake > 0 && q !== 'low') { sx = (Math.random() - .5) * 8 * b.shake; sy = (Math.random() - .5) * 8 * b.shake; }
      ctx.setTransform(this.dpr * S, 0, 0, this.dpr * S, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));
      // 화면에 보이는 월드 영역 (컬링용)
      const vx0 = -this.ox / S - 40, vy0 = -this.oy / S - 40, vx1 = (this.cw - this.ox) / S + 40, vy1 = (this.ch - this.oy) / S + 40;
      const vis = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
      this.vis = vis;

      // 배경
      ctx.fillStyle = '#141a24'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1 / Math.max(1, S);
      ctx.beginPath();
      const gs = W > 2000 ? 100 : 50;
      for (let x = 0; x <= W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      if (ui.zones) for (const z of ui.zones) {
        ctx.fillStyle = z.color; ctx.fillRect(z.x0, 0, z.x1 - z.x0, H);
        ctx.strokeStyle = z.line; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(z.x1, 0); ctx.lineTo(z.x1, H); ctx.moveTo(z.x0, 0); ctx.lineTo(z.x0, H); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(1, 1, W - 2, H - 2);

      // 진형 표시 (배치/진군 중)
      if (ui.showForm && b.form) for (let t = 0; t < 2; t++) {
        const F = b.form[t]; if (!F) continue;
        ctx.strokeStyle = t === 0 ? 'rgba(120,170,255,.35)' : 'rgba(255,130,130,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(F.ax, F.ay, 8, 0, TAU); ctx.moveTo(F.ax, F.ay); ctx.lineTo(F.ax + Math.cos(F.ang) * 40, F.ay + Math.sin(F.ang) * 40); ctx.stroke();
      }

      this.drawAreas(ctx, b);

      // 오라
      if (this.showAuras && q === 'high') for (const u of b.units) {
        const a = u.def.aura; if (!a || !vis(u.x, u.y, a.radius)) continue;
        ctx.strokeStyle = a.enemy ? 'rgba(200,150,255,0.18)' : (u.team === 0 ? 'rgba(120,170,255,0.14)' : 'rgba(255,130,130,0.14)');
        ctx.fillStyle = a.enemy ? 'rgba(200,150,255,0.04)' : 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(u.x, u.y, a.radius, 0, TAU); ctx.fill(); ctx.stroke();
      }

      // 유닛: 화면상 크기가 작으면 단순 도형 일괄 렌더 (LOD)
      const lodPx = q === 'low' ? 4.5 : q === 'medium' ? 3.5 : 2.6;
      const lod = [[], []];
      for (let pass = 0; pass < 2; pass++) for (const u of b.units) {
        if (!!u.def.flying !== !!pass) continue;
        if (!vis(u.x, u.y, u.r + 10)) continue;
        if (u.r * S < lodPx && !u.def.boss) { lod[u.team].push(u); continue; }
        this.drawUnit(ctx, u, b, ui, q);
      }
      for (let t = 0; t < 2; t++) {
        if (!lod[t].length) continue;
        ctx.fillStyle = TEAM[t].fill; ctx.beginPath();
        for (const u of lod[t]) { if (u.stealthed) continue; const r = u.r; ctx.rect(u.x - r, u.y - r, r * 2, r * 2); }
        ctx.fill();
      }

      for (const p of b.projs) if (vis(p.x, p.y, 20)) this.drawProj(ctx, p);
      for (const f of b.fx) if (f.kind !== 'text' || q === 'high' || f.size >= 14) this.drawFx(ctx, f, S);

      // 브러시 미리보기
      if (ui.brush) {
        const br = ui.brush;
        ctx.strokeStyle = br.erase ? 'rgba(255,90,90,.8)' : (br.valid ? 'rgba(255,255,255,.7)' : 'rgba(255,80,80,.7)');
        ctx.lineWidth = 1.5 / Math.max(1, S); ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(br.x, br.y, br.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (br.type && !br.erase) {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(br.x, br.y);
          const d = SW.UNITS[br.type];
          SW.shapePath(ctx, d.shape, d.size, br.team === 0 ? 0 : Math.PI);
          ctx.fillStyle = TEAM[br.team].fill; ctx.fill(); ctx.restore();
        }
      }
      for (const u of [ui.hover, ui.selected]) {
        if (!u || !u.alive && !ui.deploy) continue;
        ctx.strokeStyle = u === ui.selected ? '#ffe680' : '#fff'; ctx.lineWidth = 1.5 / Math.max(1, S * 0.6);
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 5, 0, TAU); ctx.stroke();
        if (u.def.range > 40) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(u.x, u.y, u.def.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        if (u === ui.selected && u.target && u.target.alive) {
          ctx.strokeStyle = 'rgba(255,230,128,.5)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.target.x, u.target.y); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // ── 화면 공간 UI (궁극기 섬광 · 보스 체력 · 배너) ──
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (b.flashT > 0 && q !== 'low') { ctx.fillStyle = `rgba(${b.flashColor || '255,255,255'},${Math.min(0.25, b.flashT)})`; ctx.fillRect(0, 0, this.cw, this.ch); }
      const bosses = b.units.filter(u => u.def.boss);
      bosses.forEach((u, i) => this.drawBossBar(ctx, u, i));
      b.banners.forEach((bn, i) => this.drawBanner(ctx, bn, i, bosses.length));
    }

    drawBossBar(ctx, u, i) {
      const w = Math.min(520, this.cw - 120), x = (this.cw - w) / 2, y = 78 + i * 30;
      const bd = u.def.bossData;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - 2, y - 2, w + 4, 14);
      ctx.fillStyle = '#441a1a'; ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = bd.color || '#ff5050'; ctx.fillRect(x, y, w * Math.max(0, u.hp / u.maxHp), 10);
      for (const ph of bd.phases) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + w * ph.at - 1, y - 2, 2, 14); }
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      const ph = u.boss ? u.boss.phase : 0;
      ctx.fillText(`${u.def.name} · ${Math.ceil(u.hp).toLocaleString()} / ${Math.round(u.maxHp).toLocaleString()}${ph ? ` · ${ph + 1}단계` : ''}${u.boss && u.boss.revives ? ` · 부활 ${u.boss.revives}` : ''}`, this.cw / 2, y - 5);
    }

    drawBanner(ctx, bn, i, off) {
      const k = bn.t / bn.T, a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const y = this.ch * 0.3 + i * 52 + off * 10;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, y - 26, this.cw, bn.sub ? 52 : 40);
      ctx.font = `bold ${Math.min(26, this.cw / 18)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = bn.color || '#fff';
      ctx.fillText(bn.text, this.cw / 2, y + 2);
      if (bn.sub) { ctx.font = '12px sans-serif'; ctx.fillStyle = '#ddd'; ctx.fillText(bn.sub.slice(0, 80), this.cw / 2, y + 20); }
      ctx.globalAlpha = 1;
    }

    drawAreas(ctx, b) {
      for (const a of b.areas) {
        if (this.vis && !this.vis(a.x, a.y, a.r)) continue;
        const k = 1 - a.t / a.T;
        if (a.kind === 'meteor') {
          ctx.strokeStyle = `rgba(255,120,60,${0.4 + k * 0.5})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = `rgba(255,100,40,${0.1 + k * 0.2})`;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.fill();
          const mx = a.x - 200 * (1 - k), my = a.y - 400 * (1 - k);
          ctx.fillStyle = '#ffb070'; ctx.beginPath(); ctx.arc(mx, my, 10 + k * 6, 0, TAU); ctx.fill();
        } else if (a.kind === 'strike' || a.kind === 'tele') {
          const col = a.color || '#fff36b';
          ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + k * 0.5; ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = col; ctx.globalAlpha = 0.08 + k * 0.18; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (a.kind === 'vortex') {
          const kk = a.t / a.T, rot = b.time * 4;
          ctx.save(); ctx.translate(a.x, a.y);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a.r);
          g.addColorStop(0, `rgba(30,0,50,${0.8 * kk + 0.2})`); g.addColorStop(1, 'rgba(160,80,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, a.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(200,140,255,${0.6 * kk})`; ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, a.r * (0.3 + i * 0.18), rot + i, rot + i + 2); ctx.stroke(); }
          ctx.restore();
        } else if (a.kind === 'cloud') {
          const col = a.element === 'poison' ? '120,255,80' : '180,235,255';
          ctx.fillStyle = `rgba(${col},${0.12 + 0.06 * Math.sin(b.time * 6)})`;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(${col},.4)`; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }

    drawUnit(ctx, u, b, ui, q) {
      const d = u.def, T = TEAM[u.team];
      const fly = d.flying;
      const S = this.scale;
      const detail = u.r * S >= 5 || d.boss;
      ctx.save();
      ctx.translate(u.x + u.rx, u.y + u.ry);
      if (fly) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 6, u.r, u.r * .45, 0, 0, TAU); ctx.fill();
        ctx.translate(0, -8 + Math.sin(u.anim * 6) * 1.5);
      }
      ctx.globalAlpha = u.stealthed ? 0.3 : 1;
      let rot = 0;
      if (d.shape !== 'circle') rot = (d.shape === 'square' || d.shape === 'hexagon') && !d.boss ? u.facing * 0.25 : u.facing;
      if (d.id === 'phoenix' || d.id === 'voidcaller' || d.id === 'voidSovereign') rot = u.anim * 2;
      if (d.hatch) { const s = 1 + Math.sin(u.anim * 10) * 0.05; ctx.scale(s, s); }
      if (d.boss && q !== 'low') { ctx.shadowColor = d.bossData.color; ctx.shadowBlur = 18; }
      SW.shapePath(ctx, d.shape, u.r, rot);
      ctx.fillStyle = u.flash > 0 ? '#ffffff' : (u.freeze > 0 ? '#bfefff' : T.fill);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (detail) {
        ctx.lineWidth = Math.max(1.2, u.r * 0.14);
        ctx.strokeStyle = u.charging ? '#ffe680' : T.stroke;
        ctx.stroke();
        if (d.boss) { ctx.lineWidth = 3; ctx.strokeStyle = d.bossData.color; ctx.stroke(); }
        if (u.poisonStacks > 0) { ctx.fillStyle = `rgba(120,255,80,${0.12 + 0.06 * u.poisonStacks})`; ctx.fill(); }
        SW.drawGlyph(ctx, d.glyph, u.r, d.accent, rot);
        if (d.frontArmor) { ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, u.r * 1.25, u.facing - 0.7, u.facing + 0.7); ctx.stroke(); }
        if (u.shield > 0) {
          ctx.strokeStyle = u.shieldLight ? 'rgba(255,246,190,.9)' : 'rgba(140,220,255,.85)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, u.r + 4, 0, TAU); ctx.stroke();
        }
        if (q !== 'low') {
          if (u.burn > 0) {
            ctx.fillStyle = '#ff9a3c';
            for (let i = 0; i < 3; i++) { const a = u.anim * 5 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * u.r * .8, Math.sin(a) * u.r * .8 - 2, 1.8, 0, TAU); ctx.fill(); }
          }
          if (u.slowAmt > 0 || u.buff.slow > 0) { ctx.strokeStyle = 'rgba(160,220,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, u.r + 2, 0, TAU); ctx.stroke(); }
          if (u.stun > 0) {
            ctx.fillStyle = '#ffe14d';
            for (let i = 0; i < 3; i++) { const a = u.anim * 6 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * u.r, -u.r - 4 + Math.sin(a) * 2, 2, 0, TAU); ctx.fill(); }
          }
          if (u.markT > 0 || (u.cmdT > 0)) { ctx.strokeStyle = u.cmdT > 0 ? '#ffe27a' : '#b48cff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-u.r - 5, 0); ctx.lineTo(u.r + 5, 0); ctx.moveTo(0, -u.r - 5); ctx.lineTo(0, u.r + 5); ctx.stroke(); }
          if (u.weakT > 0) { ctx.fillStyle = 'rgba(120,60,200,.25)'; SW.shapePath(ctx, d.shape, u.r, rot); ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
      if (detail && !d.boss && (u.hp < u.maxHp || u.shield > 0 || d.hatch)) {
        const w = Math.max(14, u.r * 2), y = -u.r - (d.shape === 'star' ? 12 : 7);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-w / 2, y, w, 3);
        ctx.fillStyle = u.team === 0 ? '#7fb0ff' : '#ff8080';
        ctx.fillRect(-w / 2, y, w * Math.max(0, u.hp / u.maxHp), 3);
        if (u.shield > 0) { ctx.fillStyle = '#bfeaff'; ctx.fillRect(-w / 2, y - 2, w * Math.min(1, u.shield / u.maxHp), 1.5); }
        if (d.hatch) { ctx.fillStyle = '#ffcc33'; ctx.fillRect(-w / 2, y + 4, w * (1 - u.hatchT / d.hatch.t), 2); }
      }
      ctx.restore();
    }

    drawProj(ctx, p) {
      switch (p.kind) {
        case 'arrow': {
          const a = p.ang || 0, l = 8;
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); ctx.lineTo(p.x, p.y); ctx.stroke();
          break;
        }
        case 'bolt': case 'fireball': {
          const r = p.kind === 'fireball' ? 5 : 3.5;
          ctx.fillStyle = p.color; ctx.globalAlpha = 0.35;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          break;
        }
        case 'lob': {
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#b48a5a'; ctx.beginPath(); ctx.arc(p.x, p.y - (p.z || 0), 5, 0, TAU); ctx.fill();
          break;
        }
        case 'pierce': {
          const a = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = '#f3d29b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16); ctx.lineTo(p.x, p.y); ctx.stroke();
          break;
        }
      }
    }

    drawFx(ctx, f, S) {
      const k = f.t / f.T;
      ctx.globalAlpha = Math.max(0, 1 - k);
      switch (f.kind) {
        case 'p': ctx.fillStyle = f.color; ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size); break;
        case 'ring': ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, TAU); ctx.stroke(); break;
        case 'shock': ctx.strokeStyle = f.color; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.2 + 0.8 * k), 0, TAU); ctx.stroke(); break;
        case 'boom': {
          ctx.fillStyle = f.color; ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, TAU); ctx.fill();
          ctx.globalAlpha = Math.max(0, 1 - k); ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, TAU); ctx.stroke();
          break;
        }
        case 'crit': {
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ctx.moveTo(f.x + Math.cos(a) * f.r * 0.5, f.y + Math.sin(a) * f.r * 0.5); ctx.lineTo(f.x + Math.cos(a) * f.r * (1 + k * 0.6), f.y + Math.sin(a) * f.r * (1 + k * 0.6)); }
          ctx.stroke(); break;
        }
        case 'cone': {
          const half = f.ang * Math.PI / 360;
          ctx.fillStyle = f.color; ctx.globalAlpha *= 0.3;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.r * (0.6 + 0.4 * k), f.a - half, f.a + half); ctx.closePath(); ctx.fill();
          break;
        }
        case 'death': {
          ctx.save(); ctx.translate(f.x, f.y); const s = 1 + k * 0.6; ctx.scale(s, s);
          SW.shapePath(ctx, f.shape, f.r, f.a || 0); ctx.strokeStyle = TEAM[f.team].stroke; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
          break;
        }
        case 'bolt': {
          ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x + 10, f.y - 120);
          for (let i = 1; i <= 5; i++) ctx.lineTo(f.x + (Math.random() - .5) * 20, f.y - 120 + i * 24);
          ctx.stroke(); break;
        }
        case 'slash': ctx.strokeStyle = f.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, f.a - 0.7, f.a + 0.7); ctx.stroke(); break;
        case 'spin': ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, k * 6, k * 6 + 4); ctx.stroke(); break;
        case 'beam': if (f.t) { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.t.x, f.t.y); ctx.stroke(); } break;
        case 'lightning': {
          ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < f.pts.length; i++) {
            const [x, y] = f.pts[i];
            if (!i) { ctx.moveTo(x, y); continue; }
            const [px, py] = f.pts[i - 1];
            const mx = (x + px) / 2 + (Math.random() - .5) * 14, my = (y + py) / 2 + (Math.random() - .5) * 14;
            ctx.lineTo(mx, my); ctx.lineTo(x, y);
          }
          ctx.stroke(); break;
        }
        case 'dash': ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
        case 'block': ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 14, (f.a || 0) - 1, (f.a || 0) + 1); ctx.stroke(); break;
        case 'text': {
          const sz = (f.size || 13) / Math.max(0.6, Math.min(1.6, S));
          ctx.fillStyle = f.color; ctx.font = `bold ${sz}px sans-serif`; ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3 / Math.max(1, S); ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
          break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  SW.Renderer = Renderer;
})();
