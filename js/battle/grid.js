// ─────────────────────────────────────────────
// 3.1 공간 분할 최적화 — Map 기반 격자를 타입 배열 연결 리스트로 교체
//   · 전체 격자 + 팀별 격자 + 팀별 셀 인구 (Int32Array / Uint16Array, 매 스텝 재사용 → GC 없음)
//   · 충돌 분리를 클로저 없이 셀 쌍 단위로 처리
// 2.0/3.0 의 buildGrid · query · cellDensity · separate · clusters 를 같은 인터페이스로 대체한다.
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;

  const origSpawn = P._spawn;
  P._spawn = function (type, team, x, y, extra) { const u = origSpawn.call(this, type, team, x, y, extra); u.fly = !!u.def.flying; u.imm = !!u.def.immobile; return u; };

  P.buildGrid = function () {
    const c = this.cell;
    if (!this.gCols) { this.gCols = Math.ceil(this.W / c) + 1; this.gRows = Math.ceil(this.H / c) + 1; }
    const cols = this.gCols, rows = this.gRows, nc = cols * rows;
    if (!this.gHead || this.gHead.length !== nc) {
      this.gHead = new Int32Array(nc); this.tHead = [new Int32Array(nc), new Int32Array(nc)];
      this.cnt = [new Uint16Array(nc), new Uint16Array(nc)];
    }
    const units = this.units, n = units.length;
    if (!this.gNext || this.gNext.length < n) { const m = n * 2 + 256; this.gNext = new Int32Array(m); this.tNext = new Int32Array(m); }
    const gH = this.gHead, tH0 = this.tHead[0], tH1 = this.tHead[1], gN = this.gNext, tN = this.tNext, c0 = this.cnt[0], c1 = this.cnt[1];
    gH.fill(-1); tH0.fill(-1); tH1.fill(-1); c0.fill(0); c1.fill(0);
    for (let i = 0; i < n; i++) {
      const u = units[i]; if (!u.alive) continue;
      let cx = (u.x / c) | 0, cy = (u.y / c) | 0;
      if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
      const k = cx + cy * cols;
      gN[i] = gH[k]; gH[k] = i;
      if (u.team === 0) { tN[i] = tH0[k]; tH0[k] = i; c0[k]++; } else { tN[i] = tH1[k]; tH1[k] = i; c1[k]++; }
    }
    this.gUnits = units;      // 이 격자가 가리키는 배열 (cleanupDead 는 새 배열을 만든다)
  };

  P.cellDensity = function (team, x, y) {
    const c = this.cell; let cx = (x / c) | 0, cy = (y / c) | 0;
    if (cx < 0 || cy < 0 || cx >= this.gCols || cy >= this.gRows) return 0;
    return this.cnt[team][cx + cy * this.gCols];
  };

  P.query = function (x, y, r, cb, team) {
    if (!this.gHead) this.buildGrid();
    const c = this.cell, cols = this.gCols, rows = this.gRows, units = this.gUnits;
    const head = team === undefined ? this.gHead : this.tHead[team], next = team === undefined ? this.gNext : this.tNext;
    let x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0, y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= cols) x1 = cols - 1; if (y1 >= rows) y1 = rows - 1;
    for (let gy = y0; gy <= y1; gy++) {
      const row = gy * cols;
      for (let gx = x0; gx <= x1; gx++) {
        for (let i = head[gx + row]; i >= 0; i = next[i]) {
          const u = units[i];
          if (u.alive && cb(u) === true) return;
        }
      }
    }
  };

  // 사망 유닛 정리: 같은 배열을 압축하지 않고 새 배열을 만든다 (격자 인덱스가 스텝 끝까지 유효하도록)
  P.cleanupDead = function () {
    let dead = 0; for (const u of this.units) if (!u.alive) dead++;
    if (dead) this.units = this.units.filter(u => u.alive);
  };

  P.separate = function () {
    if (!this.gHead) return;
    const W = this.W, H = this.H, cols = this.gCols, rows = this.gRows, units = this.gUnits, head = this.gHead, next = this.gNext;
    const rand = SW.util.rand;
    const pair = (u, o) => {
      const dx = u.x - o.x, dy = u.y - o.y, rr = u.r + o.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;                       // 대부분의 쌍은 여기서 끝 (속성 조회 전에 거리 먼저)
      if (!u.alive || !o.alive || u.fly !== o.fly) return;
      const iu = u.imm, io = o.imm;
      if (iu && io) return;
      let nx, ny, dd;
      if (d2 > 0) { dd = Math.sqrt(d2); nx = dx / dd; ny = dy / dd; } else { dd = 0.01; nx = rand() - 0.5; ny = rand() - 0.5; }
      const ov = (rr - dd) * 0.5;
      const mu = iu ? 1e9 : u.mass, mo = io ? 1e9 : o.mass, tot = mu + mo;
      const ku = ov * mo / tot, ko = ov * mu / tot;
      u.x += nx * ku; u.y += ny * ku; o.x -= nx * ko; o.y -= ny * ko;
    };
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const k = cx + cy * cols;
      for (let i = head[k]; i >= 0; i = next[i]) {
        const u = units[i];
        for (let j = next[i]; j >= 0; j = next[j]) pair(u, units[j]);          // 같은 셀
        // 이웃 셀 4개 (각 쌍을 한 번만 검사)
        if (cx + 1 < cols) for (let j = head[k + 1]; j >= 0; j = next[j]) pair(u, units[j]);
        if (cy + 1 < rows) {
          const kd = k + cols;
          for (let j = head[kd]; j >= 0; j = next[j]) pair(u, units[j]);
          if (cx > 0) for (let j = head[kd - 1]; j >= 0; j = next[j]) pair(u, units[j]);
          if (cx + 1 < cols) for (let j = head[kd + 1]; j >= 0; j = next[j]) pair(u, units[j]);
        }
      }
    }
    for (const u of units) { if (!u.alive) continue; if (u.x < u.r) u.x = u.r; else if (u.x > W - u.r) u.x = W - u.r; if (u.y < u.r) u.y = u.r; else if (u.y > H - u.r) u.y = H - u.r; }
  };

  // 적 밀집 지점 (보스 패턴용)
  P.clusters = function (u, n, range) {
    const cnt = this.cnt ? this.cnt[1 - u.team] : null; if (!cnt) return [];
    const c = this.cell, cols = this.gCols, cells = [];
    for (let k = 0; k < cnt.length; k++) if (cnt[k] > 0) cells.push(k);
    cells.sort((a, b) => cnt[b] - cnt[a]);
    const out = [];
    for (const k of cells) {
      const x = (k % cols + 0.5) * c, y = (Math.floor(k / cols) + 0.5) * c;
      if ((x - u.x) ** 2 + (y - u.y) ** 2 > range * range) continue;
      if (out.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 100 * 100)) continue;
      out.push({ x, y, cnt: cnt[k] });
      if (out.length >= n) break;
    }
    return out;
  };
})();
