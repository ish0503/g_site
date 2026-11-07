// ─────────────────────────────────────────────
// Formation System — 진형 배치 · 진형 유지 진군 · 빈자리 보충 · 재정비
// ─────────────────────────────────────────────
(() => {
  const { clamp } = SW.util;
  const BACK = { ranged: 1, caster: 1, support: 1 };

  // 배치 화면용: 유닛 목록을 진형 모양으로 재배열 (x,y 를 직접 수정)
  // dir: +1 = 오른쪽을 향함(파란 팀), -1 = 왼쪽(빨간 팀)
  SW.arrangeFormation = (units, fid, dir, zone, H) => {
    if (!units.length) return;
    const f = SW.FORMATIONS[fid] || SW.FORMATIONS.line;
    const sp = f.spacing;
    const cy = H / 2;
    const isBack = (u) => BACK[u.def.cls] || u.def.immobile;
    const front = units.filter(u => !isBack(u) && !u.def.flying);
    const back = units.filter(u => isBack(u));
    const air = units.filter(u => u.def.flying && !isBack(u));
    const gapOf = (list) => (list.length ? Math.max(...list.map(u => u.r)) * 2 + 4 : 20) * sp;
    const maxW = H - 60;
    const pos = [];        // [unit, dx(전방 거리), dy]
    const rowsBlock = (list, startDepth, perRowMax) => {
      const g = gapOf(list); let depth = startDepth;
      const per = Math.max(1, Math.min(perRowMax, Math.floor(maxW / g)));
      for (let i = 0; i < list.length; i += per) {
        const row = list.slice(i, i + per);
        row.forEach((u, j) => pos.push([u, -depth, (j - (row.length - 1) / 2) * g]));
        depth += g;
      }
      return depth;
    };
    const sortBig = (a, b) => b.r - a.r || (b.def.hp - a.def.hp);
    front.sort(sortBig);
    switch (fid) {
      case 'phalanx': {
        const all = [...front, ...back];
        const g = gapOf(all), side = Math.ceil(Math.sqrt(all.length));
        all.forEach((u, i) => pos.push([u, -Math.floor(i / side) * g, (i % side - (side - 1) / 2) * g]));
        break;
      }
      case 'wedge': {
        const all = [...front, ...back];
        const g = gapOf(all); let i = 0, row = 0;
        while (i < all.length) {
          const n = row + 1;
          for (let j = 0; j < n && i < all.length; j++, i++) pos.push([all[i], -row * g * 0.9, (j - (n - 1) / 2) * g]);
          row++;
        }
        break;
      }
      case 'circle': {
        const g = gapOf(units);
        const place = (list, r0) => {
          let i = 0, r = r0;
          while (i < list.length) {
            const n = r < 1 ? 1 : Math.max(1, Math.floor(2 * Math.PI * r / g));
            for (let j = 0; j < n && i < list.length; j++, i++) {
              const a = j / n * Math.PI * 2;
              pos.push([list[i], Math.cos(a) * r, Math.sin(a) * r]);
            }
            r += g;
          }
          return r;
        };
        const inner = place(back, 0);
        place(front.concat(air), Math.max(inner, back.length ? g : 0));
        break;
      }
      case 'protect': {
        // 후열을 중앙에, 근접 유닛이 앞과 양옆을 감싼다
        const g = gapOf(units);
        const bside = Math.max(1, Math.ceil(Math.sqrt(back.length * 1.5)));
        back.forEach((u, i) => pos.push([u, -Math.floor(i / bside) * g, (i % bside - (bside - 1) / 2) * g]));
        const bw = bside * g / 2 + g, bd = Math.ceil(back.length / bside) * g;
        let k = 0, ring = 0;
        while (k < front.length) {
          const half = bw + ring * g, depthEnd = bd + ring * g;
          const slots = [];
          for (let y = -half; y <= half + 0.1; y += g) slots.push([g * (1 + ring), y]);
          for (let x = 0; x > -depthEnd; x -= g) { slots.push([x, -half]); slots.push([x, half]); }
          for (const [x, y] of slots) { if (k >= front.length) break; pos.push([front[k++], x, y]); }
          ring++;
        }
        break;
      }
      default: {     // line, spread, free
        const per = fid === 'line' ? 28 : fid === 'spread' ? 12 : 22;
        const d1 = rowsBlock(front, 0, per);
        rowsBlock(back, d1 + 10 * sp, per);
      }
    }
    if (fid !== 'circle' && air.length) {
      const minD = Math.min(0, ...pos.map(p => p[1]));
      const g = gapOf(air);
      air.forEach((u, j) => pos.push([u, minD - 20 - Math.floor(j / 12) * g, (j % 12 - 5.5) * g]));
    }
    // 진형 중심을 구역 앞쪽에 맞춤
    const minDx = Math.min(...pos.map(p => p[1])), maxDx = Math.max(...pos.map(p => p[1]));
    const zoneW = zone.x1 - zone.x0;
    const span = maxDx - minDx;
    const frontEdge = dir > 0 ? zone.x1 - 30 : zone.x0 + 30;
    let ys = pos.map(p => p[2]);
    const yScale = Math.min(1, (H - 40) / ((Math.max(...ys) - Math.min(...ys)) || 1));
    const xScale = Math.min(1, (zoneW - 40) / (span || 1));
    for (const [u, dx, dy] of pos) {
      const fx = (dx - maxDx) * xScale;    // 0 = 맨 앞
      u.x = clamp(frontEdge + fx * dir, zone.x0 + u.r, zone.x1 - u.r);
      u.y = clamp(cy + dy * yScale, u.r, H - u.r);
    }
  };

  Object.assign(SW.Battle.prototype, {
    formActive(team) { const f = SW.FORMATIONS[this.formation[team]]; return f && f.march && this.form && this.form[team]; },
    formSpeed(team) { return this.form && this.form[team] ? this.form[team].speed : 50; },

    initFormations() {
      this.form = [null, null];
      for (let team = 0; team < 2; team++) {
        const f = SW.FORMATIONS[this.formation[team]];
        if (!f || !f.march) continue;
        const members = this.teams[team].filter(u => !u.def.immobile && !u.def.boss);
        if (!members.length) continue;
        let cx = 0, cy = 0; for (const u of members) { cx += u.x; cy += u.y; } cx /= members.length; cy /= members.length;
        const fm = f.mods;
        let speed = Infinity;
        for (const u of members) if (!u.def.flying) speed = Math.min(speed, u.def.speed * (1 + (fm.speed || 0)));
        if (!isFinite(speed)) speed = 60;
        const ei = this.teamInfo[1 - team];
        const ang = Math.atan2(ei.cy - cy, ei.cx - cx);
        for (const u of members) u.ai.slot = { ox: u.x - cx, oy: u.y - cy };
        this.form[team] = { ax: cx, ay: cy, ang0: ang, ang, speed: clamp(speed, 25, 75), n0: members.length, contact: false };
      }
    },

    updateFormations(dt) {
      if (!this.form) return;
      for (let team = 0; team < 2; team++) {
        const F = this.form[team]; if (!F) continue;
        let n = 0, engaged = 0;
        for (const u of this.teams[team]) if (u.ai.slot) { n++; if (u.ai.engaged) engaged++; }
        if (!n) { this.form[team] = null; continue; }
        F.alive = n;
        F.scale = clamp(Math.sqrt(n / F.n0), 0.55, 1);       // 사망자 빈자리 보충: 진형을 좁힘
        F.contact = engaged > 0;
        const ei = this.teamInfo[1 - team];
        const dx = ei.cx - F.ax, dy = ei.cy - F.ay, dd = Math.hypot(dx, dy);
        // 진형 방향을 적 쪽으로 천천히 회전
        const want = Math.atan2(dy, dx);
        let da = Math.atan2(Math.sin(want - F.ang), Math.cos(want - F.ang));
        F.ang += clamp(da, -0.4 * dt, 0.4 * dt);
        // 접촉 전에는 전진, 접촉 후에는 천천히 밀고 나감
        const v = F.speed * (F.contact ? 0.35 : 1);
        if (dd > 60) { F.ax += dx / dd * v * dt; F.ay += dy / dd * v * dt; }
      }
    },

    slotPos(u) {
      const F = this.form && this.form[u.team]; const s = u.ai.slot;
      if (!F || !s) return null;
      const rot = F.ang - F.ang0, c = Math.cos(rot), sn = Math.sin(rot);
      const ox = s.ox * F.scale, oy = s.oy * F.scale;
      return { x: clamp(F.ax + ox * c - oy * sn, u.r, this.W - u.r), y: clamp(F.ay + ox * sn + oy * c, u.r, this.H - u.r) };
    },
  });
})();
