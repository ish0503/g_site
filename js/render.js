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

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = 1; this.ox = 0; this.oy = 0;
      this.zoom = 1; this.camX = SW.WORLD.W / 2; this.camY = SW.WORLD.H / 2;
      this.showAuras = true;
    }

    resize() {
      const c = this.canvas, dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      this.dpr = dpr;
      this.fit = Math.min(w / SW.WORLD.W, h / SW.WORLD.H);
      this.scale = this.fit * this.zoom;
      this.clampCam(w, h);
      this.ox = w / 2 - this.camX * this.scale;
      this.oy = h / 2 - this.camY * this.scale;
    }

    clampCam(w, h) {
      const hw = w / 2 / this.scale, hh = h / 2 / this.scale;
      const W = SW.WORLD.W, H = SW.WORLD.H;
      this.camX = hw * 2 >= W ? W / 2 : Math.min(W - hw, Math.max(hw, this.camX));
      this.camY = hh * 2 >= H ? H / 2 : Math.min(H - hh, Math.max(hh, this.camY));
    }

    zoomAt(cx, cy, factor) {
      const p = this.toWorld(cx, cy);
      this.zoom = Math.min(5, Math.max(1, this.zoom * factor));
      this.resize();
      const q = this.toWorld(cx, cy);
      this.camX += p.x - q.x; this.camY += p.y - q.y;
      this.resize();
    }

    pan(dxScreen, dyScreen) { this.camX -= dxScreen / this.scale; this.camY -= dyScreen / this.scale; }
    resetView() { this.zoom = 1; this.camX = SW.WORLD.W / 2; this.camY = SW.WORLD.H / 2; }

    toWorld(cx, cy) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (cx - rect.left - this.ox) / this.scale, y: (cy - rect.top - this.oy) / this.scale };
    }

    draw(b, ui = {}) {
      this.resize();
      const ctx = this.ctx, W = SW.WORLD.W, H = SW.WORLD.H;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      let sx = 0, sy = 0;
      if (b.shake > 0) { sx = (Math.random() - .5) * 8 * b.shake; sy = (Math.random() - .5) * 8 * b.shake; }
      ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));

      // 배경
      ctx.fillStyle = '#141a24'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 50) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      // 배치 구역
      if (ui.zones) for (const z of ui.zones) {
        ctx.fillStyle = z.color; ctx.fillRect(z.x0, 0, z.x1 - z.x0, H);
        ctx.strokeStyle = z.line; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(z.x1, 0); ctx.lineTo(z.x1, H); ctx.moveTo(z.x0, 0); ctx.lineTo(z.x0, H); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(1, 1, W - 2, H - 2);

      // 영역 효과
      for (const a of b.areas) {
        if (a.kind === 'meteor') {
          const k = 1 - a.t / a.T;
          ctx.strokeStyle = `rgba(255,120,60,${0.4 + k * 0.5})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = `rgba(255,100,40,${0.1 + k * 0.2})`;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.fill();
          // 낙하하는 운석
          const mx = a.x - 200 * (1 - k), my = a.y - 400 * (1 - k);
          ctx.fillStyle = '#ffb070'; ctx.beginPath(); ctx.arc(mx, my, 10 + k * 6, 0, TAU); ctx.fill();
        } else if (a.kind === 'vortex') {
          const k = a.t / a.T, rot = b.time * 4;
          ctx.save(); ctx.translate(a.x, a.y);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a.r);
          g.addColorStop(0, `rgba(30,0,50,${0.8 * k + 0.2})`); g.addColorStop(1, 'rgba(160,80,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, a.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(200,140,255,${0.6 * k})`; ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, a.r * (0.3 + i * 0.18), rot + i, rot + i + 2); ctx.stroke(); }
          ctx.restore();
        }
      }

      // 오라
      if (this.showAuras) for (const u of b.units) {
        const a = u.def.aura; if (!a) continue;
        ctx.strokeStyle = a.enemy ? 'rgba(200,150,255,0.18)' : (u.team === 0 ? 'rgba(120,170,255,0.14)' : 'rgba(255,130,130,0.14)');
        ctx.fillStyle = a.enemy ? 'rgba(200,150,255,0.04)' : 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(u.x, u.y, a.radius, 0, TAU); ctx.fill(); ctx.stroke();
      }

      // 유닛 (지상 → 비행)
      for (let pass = 0; pass < 2; pass++) for (const u of b.units) {
        if (!!u.def.flying !== !!pass) continue;
        this.drawUnit(ctx, u, b, ui);
      }

      // 투사체
      for (const p of b.projs) this.drawProj(ctx, p);

      // 효과
      for (const f of b.fx) this.drawFx(ctx, f);

      // 브러시 미리보기
      if (ui.brush) {
        const br = ui.brush;
        ctx.strokeStyle = br.erase ? 'rgba(255,90,90,.8)' : (br.valid ? 'rgba(255,255,255,.7)' : 'rgba(255,80,80,.7)');
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(br.x, br.y, br.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (br.type && !br.erase) {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(br.x, br.y);
          const d = SW.UNITS[br.type];
          SW.shapePath(ctx, d.shape, d.size, br.team === 0 ? 0 : Math.PI);
          ctx.fillStyle = TEAM[br.team].fill; ctx.fill(); ctx.restore();
        }
      }
      if (ui.hover) {
        const u = ui.hover;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 5, 0, TAU); ctx.stroke();
        if (u.def.range > 40) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(u.x, u.y, u.def.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      }
    }

    drawUnit(ctx, u, b, ui) {
      const d = u.def, T = TEAM[u.team];
      const fly = d.flying;
      ctx.save();
      ctx.translate(u.x, u.y);
      if (fly) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 6, u.r, u.r * .45, 0, 0, TAU); ctx.fill();
        ctx.translate(0, -8 + Math.sin(u.anim * 6) * 1.5);
      }
      let alpha = 1;
      if (u.stealthed) alpha = 0.3;
      ctx.globalAlpha = alpha;
      let rot = 0;
      if (d.shape !== 'circle') rot = (d.shape === 'square' || d.shape === 'hexagon') ? u.facing * 0.25 : (d.shape === 'pentagon' || d.shape === 'star') ? u.facing + (d.type === 'hero' ? 0 : 0) : u.facing;
      if (d.id === 'phoenix' || d.id === 'voidcaller') rot = u.anim * 2;
      if (d.hatch) { const s = 1 + Math.sin(u.anim * 10) * 0.05; ctx.scale(s, s); }

      SW.shapePath(ctx, d.shape, u.r, rot);
      ctx.fillStyle = u.flash > 0 ? '#ffffff' : (u.freeze > 0 ? '#bfefff' : T.fill);
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, u.r * 0.14);
      ctx.strokeStyle = u.charging ? '#ffe680' : T.stroke;
      ctx.stroke();
      if (u.poisonStacks > 0) { ctx.fillStyle = `rgba(120,255,80,${0.12 + 0.06 * u.poisonStacks})`; ctx.fill(); }
      SW.drawGlyph(ctx, d.glyph, u.r, d.accent, rot);
      if (u.shield > 0) {
        ctx.strokeStyle = 'rgba(140,220,255,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, u.r + 4, 0, TAU); ctx.stroke();
      }
      if (u.burn > 0) {
        ctx.fillStyle = '#ff9a3c';
        for (let i = 0; i < 3; i++) { const a = u.anim * 5 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * u.r * .8, Math.sin(a) * u.r * .8 - 2, 1.8, 0, TAU); ctx.fill(); }
      }
      if (u.slowAmt > 0 || u.buff.slow > 0) { ctx.strokeStyle = 'rgba(160,220,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, u.r + 2, 0, TAU); ctx.stroke(); }
      if (u.stun > 0) {
        ctx.fillStyle = '#ffe14d';
        for (let i = 0; i < 3; i++) { const a = u.anim * 6 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * u.r, -u.r - 4 + Math.sin(a) * 2, 2, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // 체력바
      if (u.hp < u.maxHp || u.shield > 0 || d.hatch) {
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

    drawFx(ctx, f) {
      const k = f.t / f.T;
      ctx.globalAlpha = Math.max(0, 1 - k);
      switch (f.kind) {
        case 'p': ctx.fillStyle = f.color; ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size); break;
        case 'ring': ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, TAU); ctx.stroke(); break;
        case 'boom': {
          ctx.fillStyle = f.color; ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, TAU); ctx.fill();
          ctx.globalAlpha = Math.max(0, 1 - k); ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, TAU); ctx.stroke();
          break;
        }
        case 'slash': ctx.strokeStyle = f.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, f.a - 0.7, f.a + 0.7); ctx.stroke(); break;
        case 'spin': ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, k * 6, k * 6 + 4); ctx.stroke(); break;
        case 'beam': if (f.t2 !== undefined || f.t) { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.t.x, f.t.y); ctx.stroke(); } break;
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
        case 'block': ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 14, -1, 1); ctx.stroke(); break;
        case 'text': ctx.fillStyle = f.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); break;
      }
      ctx.globalAlpha = 1;
    }
  }

  SW.Renderer = Renderer;
})();
