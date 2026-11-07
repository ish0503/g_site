// ─────────────────────────────────────────────
// ANALYTICS — 전투 리플레이 기록/재생 · 밸런스 분석기
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  // 리플레이: 일정 간격으로 모든 유닛 상태를 압축 저장 (Int16: 인덱스, x, y, 체력‰, 방향)
  SW.Recorder = {
    attach(b) {
      const R = { frames: [], meta: [], idx: new Map(), W: b.W, H: b.H, terrain: b.terrain ? b.terrain.serialize() : null, weather: b.weatherId, time: b.timeId, t: 0, interval: b.units.length > 800 ? 0.5 : 0.25, maxFrames: 1400 };
      b.replay = R;
      const snap = () => {
        const n = b.units.length, a = new Int16Array(n * 5);
        let k = 0;
        for (const u of b.units) {
          let i = R.idx.get(u.uid);
          if (i === undefined) { i = R.meta.length; R.idx.set(u.uid, i); R.meta.push({ type: u.type, team: u.team, r: u.r, sq: u.sq, born: b.time }); }
          if (i > 32000) continue;
          a[k++] = i; a[k++] = u.x; a[k++] = u.y; a[k++] = Math.max(0, Math.round(u.hp / u.maxHp * 1000)); a[k++] = Math.round(u.facing * 1000);
        }
        R.frames.push({ t: b.time, d: k === a.length ? a : a.slice(0, k), banners: b.banners.filter(x => x.t < 0.05).map(x => ({ text: x.text, color: x.color, sub: x.sub })) });
      };
      snap();
      b.hooks.push((bb, dt) => {
        R.t += dt;
        if (R.t >= R.interval && R.frames.length < R.maxFrames) { R.t = 0; snap(); }
      });
      return R;
    },
    finalize(b) { const R = b.replay; if (!R) return null; R.events = b.events.slice(); R.end = b.time; R.winner = b.winner; R.frames.push({ t: b.time, d: new Int16Array(0), banners: [] }); return R; },
  };

  // 재생용 의사 전투 객체: 렌더러가 그대로 그릴 수 있다
  SW.ReplayView = class {
    constructor(R) {
      this.R = R; this.W = R.W; this.H = R.H; this.time = 0; this.speed = 1; this.playing = true;
      this.terrain = R.terrain ? SW.Terrain.from(R.terrain) : null;
      this.units = []; this.projs = []; this.areas = []; this.fx = []; this.banners = []; this.quality = 'medium';
      this.pool = []; this.fi = 0; this.trails = new Map(); this.events = R.events || [];
      this.state = 'REPLAY';
    }
    get duration() { return this.R.end || 0; }
    seek(t) { this.time = Math.max(0, Math.min(this.duration, t)); this.fi = 0; this.banners = []; this.build(); }
    tick(dt) {
      if (!this.playing) return this.build();
      const prev = this.time;
      this.time = Math.min(this.duration, this.time + dt * this.speed);
      for (const f of this.R.frames) if (f.t > prev && f.t <= this.time) for (const bn of f.banners) this.banners.push({ ...bn, t: 0, T: 1.8 });
      for (const b of this.banners) b.t += dt * this.speed;
      this.banners = this.banners.filter(b => b.t < b.T);
      if (this.time >= this.duration) this.playing = false;
      this.build();
    }
    build() {
      const F = this.R.frames; if (!F.length) return;
      let i = this.fi; while (i < F.length - 2 && F[i + 1].t <= this.time) i++; while (i > 0 && F[i].t > this.time) i--;
      this.fi = i;
      const A = F[i], B = F[Math.min(i + 1, F.length - 1)];
      const k = B.t > A.t ? (this.time - A.t) / (B.t - A.t) : 0;
      const nb = new Map(); for (let j = 0; j < B.d.length; j += 5) nb.set(B.d[j], j);
      this.units.length = 0;
      let p = 0;
      for (let j = 0; j < A.d.length; j += 5) {
        const id = A.d[j], m = this.R.meta[id]; if (!m) continue;
        const jb = nb.get(id);
        const u = this.pool[p] || (this.pool[p] = { buff: { slow: 0 }, rx: 0, ry: 0, flash: 0, anim: 0, alive: true });
        p++;
        let x = A.d[j + 1], y = A.d[j + 2], hp = A.d[j + 3], f = A.d[j + 4] / 1000;
        if (jb !== undefined) { x += (B.d[jb + 1] - x) * k; y += (B.d[jb + 2] - y) * k; hp += (B.d[jb + 3] - hp) * k; }
        else if (k > 0.5) continue;       // 다음 프레임에 없음 = 전사
        u.uid = id; u.type = m.type; u.def = SW.UNITS[m.type]; u.team = m.team; u.r = m.r; u.x = x; u.y = y; u.facing = f;
        u.maxHp = 1000; u.hp = hp; u.anim = this.time + id; u.sq = m.sq;
        this.units.push(u);
      }
    }
    trail(id) {
      const pts = [];
      for (const f of this.R.frames) { if (f.t > this.time) break; for (let j = 0; j < f.d.length; j += 5) if (f.d[j] === id) { pts.push([f.d[j + 1], f.d[j + 2]]); break; } }
      return pts;
    }
  };

  // ── 밸런스 분석기: 같은 인원으로 1:1 병종 대결을 반복해 승률 행렬 계산 ──
  SW.duel = (a, b, pop = 16, runs = 2) => {
    let w = 0;
    for (let r = 0; r < runs; r++) {
      const bt = new SW.Battle({ visual: false, timeLimit: 90 });
      for (const [type, team] of [[a, 0], [b, 1]]) {
        const d = SW.UNITS[type], n = Math.max(1, Math.round(pop / Math.max(1, d.pop)));
        const gap = d.size * 2 + 4, cols = Math.ceil(Math.sqrt(n));
        for (let i = 0; i < n; i++) bt.spawn(type, team, (team ? 1100 : 500) + (team ? 1 : -1) * (i % cols) * gap, 450 + (Math.floor(i / cols) - cols / 2) * gap);
      }
      let n = 0; while (!bt.over && n < 60 * 95) { bt.step(1 / 60); n++; }
      if (bt.winner === 0) w++; else if (bt.winner === -1) w += 0.5;
    }
    return w / runs;
  };
})();
