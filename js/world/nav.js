// ─────────────────────────────────────────────
// 3.1 경로 탐색 — 20px 내비게이션 격자 + 다익스트라 흐름장(flow field) + 시야선(LOS)
//   · 통행 불가: 산악 지형, 살아 있는 성벽·성문·방어탑·성채
//   · 비용: 지형 이동 속도의 역수 (강·늪은 비싸서 여울·다리로 우회)
//   · 직선 경로가 막히지 않았으면 그대로 직진, 막혔으면 목적지 흐름장을 따라 이동
//   · 구조물이 파괴되면 격자를 즉시 갱신 → 성벽의 틈으로 진입
//   흐름장은 목적지 셀(40px 단위)별로 캐시(LRU)하고 스텝당 계산 개수를 제한한다.
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  const CELL = 20, SOFT = 1.6;      // SOFT 이상 비용 셀은 시야선 판정에서 '우회 고려' 대상

  class Nav {
    constructor(b) {
      this.b = b; this.cols = Math.ceil(b.W / CELL); this.rows = Math.ceil(b.H / CELL);
      const n = this.cols * this.rows;
      this.cost = new Float32Array(n); this.fields = new Map(); this.budget = 0; this.ver = 0;
      this.heap = new Int32Array(n * 4 + 16); this.hk = new Float32Array(n * 4 + 16);
      this.rebuild();
    }
    idx(x, y) { let c = (x / CELL) | 0, r = (y / CELL) | 0; if (c < 0) c = 0; else if (c >= this.cols) c = this.cols - 1; if (r < 0) r = 0; else if (r >= this.rows) r = this.rows - 1; return c + r * this.cols; }
    rebuild() {
      const b = this.b, T = b.terrain, cols = this.cols;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
        let k = 1;
        if (T) { const t = T.at(x, y); k = t.block ? Infinity : 1 / (t.speed || 1); }
        this.cost[c + r * cols] = k;
      }
      // 살아 있는 구조물이 차지한 셀은 통행 불가
      for (const u of b.units) {
        if (!u.alive || !u.def.structure) continue;
        const R = u.r + 6, c0 = Math.max(0, ((u.x - R) / CELL) | 0), c1 = Math.min(cols - 1, ((u.x + R) / CELL) | 0);
        const r0 = Math.max(0, ((u.y - R) / CELL) | 0), r1 = Math.min(this.rows - 1, ((u.y + R) / CELL) | 0);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
          if ((x - u.x) ** 2 + (y - u.y) ** 2 <= R * R) this.cost[c + r * cols] = Infinity;
        }
      }
      this.fields.clear(); this.ver++; this.dirty = false;
      this.tver = T ? T.version : 0;
    }
    // 시야선: 통행 불가 또는 비싼 셀을 지나는지 (DDA)
    clear(x0, y0, x1, y1, maxL = 1e9) {
      let dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      if (L > maxL) { dx *= maxL / L; dy *= maxL / L; L = maxL; }      // 가까운 구간만 검사 (먼 장애물은 가까워졌을 때 처리)
      const n = Math.ceil(L / (CELL * 1.4));        // 28px 간격 샘플 (구조물·산악 두께 ≥ 40px)
      for (let i = 1; i < n; i++) { const k = this.cost[this.idx(x0 + dx * i / n, y0 + dy * i / n)]; if (k >= SOFT) return false; }
      return true;
    }
    // 목적지 셀까지의 다익스트라 거리장 (8방향)
    field(gx, gy, q = 40) {
      // 먼 목적지는 굵게 양자화해 여러 유닛이 같은 흐름장을 공유
      gx = (Math.floor(gx / q) + 0.5) * q; gy = (Math.floor(gy / q) + 0.5) * q;
      const key = (q << 24) | (((gx / 20) | 0) << 12) | ((gy / 20) | 0);
      let f = this.fields.get(key);
      if (f) { this.fields.delete(key); this.fields.set(key, f); return f; }        // LRU 갱신
      if (this.budget <= 0) return null;                                              // 이번 스텝 계산 한도 초과
      this.budget--;
      const cols = this.cols, rows = this.rows, n = cols * rows, cost = this.cost;
      const dist = new Float32Array(n).fill(Infinity);
      let goal = this.idx(gx, gy);
      if (cost[goal] === Infinity) {      // 목적지가 막힌 셀이면 가장 가까운 열린 셀
        let best = -1, bd = Infinity; const gc = goal % cols, gr = (goal / cols) | 0;
        for (let r = Math.max(0, gr - 4); r <= Math.min(rows - 1, gr + 4); r++) for (let c = Math.max(0, gc - 4); c <= Math.min(cols - 1, gc + 4); c++) { const i = c + r * cols; if (cost[i] < Infinity) { const d = (c - gc) ** 2 + (r - gr) ** 2; if (d < bd) { bd = d; best = i; } } }
        if (best < 0) return null; goal = best;
      }
      // 이진 힙 (인라인, 클로저 없음) + 8방향 오프셋 사전 계산
      const heap = this.heap, hk = this.hk; let hn = 0;
      const D = Math.SQRT2, last = cols - 1, lastR = rows - 1;
      dist[goal] = 0; heap[0] = goal; hk[0] = 0; hn = 1;
      while (hn > 0) {
        const kd = hk[0], i = heap[0];
        // pop
        hn--;
        if (hn > 0) {
          const li = heap[hn], lk = hk[hn]; let j = 0;
          for (;;) { const l = 2 * j + 1; if (l >= hn) break; let m = l; if (l + 1 < hn && hk[l + 1] < hk[l]) m = l + 1; if (hk[m] >= lk) break; heap[j] = heap[m]; hk[j] = hk[m]; j = m; }
          heap[j] = li; hk[j] = lk;
        }
        if (kd > dist[i]) continue;
        const c = i % cols, r = (i - c) / cols, ci = cost[i];
        const cL = c > 0, cR = c < last, rU = r > 0, rD = r < lastR;
        for (let k = 0; k < 8; k++) {
          let j, diag = false;
          switch (k) {
            case 0: if (!cL) continue; j = i - 1; break;
            case 1: if (!cR) continue; j = i + 1; break;
            case 2: if (!rU) continue; j = i - cols; break;
            case 3: if (!rD) continue; j = i + cols; break;
            case 4: if (!cL || !rU || cost[i - 1] === Infinity || cost[i - cols] === Infinity) continue; j = i - cols - 1; diag = true; break;
            case 5: if (!cR || !rU || cost[i + 1] === Infinity || cost[i - cols] === Infinity) continue; j = i - cols + 1; diag = true; break;
            case 6: if (!cL || !rD || cost[i - 1] === Infinity || cost[i + cols] === Infinity) continue; j = i + cols - 1; diag = true; break;
            default: if (!cR || !rD || cost[i + 1] === Infinity || cost[i + cols] === Infinity) continue; j = i + cols + 1; diag = true;
          }
          const cj = cost[j]; if (cj === Infinity) continue;
          const nd = Math.fround(kd + (diag ? D : 1) * (cj + ci) * 0.5);   // dist·hk 가 Float32 이므로 같은 정밀도로 비교 (반복 재삽입 방지)
          if (nd < dist[j]) {
            dist[j] = nd;
            // push
            let q = hn++;
            while (q > 0) { const p = (q - 1) >> 1; if (hk[p] <= nd) break; heap[q] = heap[p]; hk[q] = hk[p]; q = p; }
            heap[q] = j; hk[q] = nd;
          }
        }
      }
      f = { dist, goal };
      this.fields.set(key, f);
      if (this.fields.size > 96) this.fields.delete(this.fields.keys().next().value);
      return f;
    }
    // 흐름장을 따라 몇 칸 앞의 지점 (시야가 닿는 가장 먼 지점으로 당김)
    step(f, x, y) {
      const cols = this.cols, rows = this.rows, dist = f.dist;
      let i = this.idx(x, y);
      if (dist[i] === Infinity) {      // 현재 셀이 막혀 있으면(구조물에 붙어 있음) 주변의 열린 셀
        let best = -1, bd = Infinity; const c = i % cols, r = (i / cols) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nc = c + dx, nr = r + dy; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue; const j = nc + nr * cols; if (dist[j] < bd) { bd = dist[j]; best = j; } }
        if (best < 0 || bd === Infinity) return null; i = best;
      }
      let pts = [];
      for (let s = 0; s < 6; s++) {
        const c = i % cols, r = (i - c) / cols; let best = i, bd = dist[i];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nc = c + dx, nr = r + dy; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue; const j = nc + nr * cols; if (dist[j] < bd) { bd = dist[j]; best = j; } }
        if (best === i) break;
        i = best; pts.push(i);
      }
      if (!pts.length) return null;
      for (let k = pts.length - 1; k >= 0; k--) {
        const c = pts[k] % cols, r = (pts[k] - c) / cols, px = (c + 0.5) * CELL, py = (r + 0.5) * CELL;
        if (k === 0 || this.clear(x, y, px, py)) return { x: px, y: py };
      }
      return null;
    }
  }
  SW.Nav = Nav;

  // 전투 시작 시: 막힌 지형·구조물·비싼 지형이 있을 때만 내비게이션 활성화
  const origStart = P.start;
  P.start = function () {
    if (this.state !== 'PREPARING') return origStart.call(this);
    origStart.call(this);
    const T = this.terrain;
    const costly = T && T.t.some(v => { const t = SW.TERRAIN_TYPES[v]; return t.block || (t.speed || 1) < 0.62; });
    if (costly || this.units.some(u => u.def.structure)) {
      this.nav = new Nav(this);
      this.hooks.push((b) => {
        const N = b.nav; if (!N) return;
        // 흐름장 계산 예산: 큰 지도(셀 15000+)는 2스텝당 1개, 대규모 전투는 스텝당 2개
        N.budget = N.cost.length > 15000 ? ((b.frame || 0) & 1) : b.units.length > 800 ? 2 : 4;
        if (N.dirty) N.rebuild();
        else if (b.terrain && b.terrain.version !== N.tver && (b.navT = (b.navT || 0) + 1) % 300 === 0) N.rebuild();   // 화재·범람 등 지형 변화 반영 (5초 간격)
      });
    }
  };
  // 구조물 파괴 → 격자 갱신
  const origKill = P.kill;
  P.kill = function (u, src, silent) {
    const was = u.alive;
    origKill.call(this, u, src, silent);
    if (was && !u.alive && u.def.structure && this.nav) this.nav.dirty = true;
  };

  // 이동 방향 보정: (tx,ty) 로 가려는 유닛의 실제 진행 방향을 돌려준다 (null = 직진 유지)
  P.navDir = function (u, tx, ty) {
    const N = this.nav;
    if (!N || u.def.flying) return null;
    if ((tx - u.x) ** 2 + (ty - u.y) ** 2 < 150 * 150 && !this.terrain?.blocked?.(u.x + (tx - u.x) * 0.5, u.y + (ty - u.y) * 0.5)) return null;   // 가까운 목표는 직진
    const c = u.navC || (u.navC = { t: 0, tx: 0, ty: 0, p: null, ver: -1 });
    c.t -= 1 / 60;
    if (c.t > 0 && c.ver === N.ver && Math.abs(c.tx - tx) < 30 && Math.abs(c.ty - ty) < 30) return c.p;
    c.t = (this.units.length > 800 ? 0.45 : 0.25) + (u.uid % 7) * 0.02; c.tx = tx; c.ty = ty; c.ver = N.ver;
    if (N.clear(u.x, u.y, tx, ty)) { c.p = null; u.noPath = false; return null; }
    const far = (tx - u.x) ** 2 + (ty - u.y) ** 2 > 500 * 500;
    const f = N.field(tx, ty, far ? 160 : 80);
    if (!f) { c.t = 0.05; c.p = null; return null; }       // 흐름장 계산 대기
    const p = N.step(f, u.x, u.y);
    u.noPath = !p;
    c.p = p;
    return p;
  };
})();
