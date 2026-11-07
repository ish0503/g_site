// ─────────────────────────────────────────────
// 3.1 완전한 리플레이 — 유닛 + 상태 + 투사체 + 범위 효과 + 이펙트 + 피해 판정 + 지형 변화 기록
//   저장: 브라우저 IndexedDB 보관함(최근 12개) · 파일 내보내기/가져오기(.gwrep, gzip 압축)
//   3.0 리플레이(SW.Recorder / SW.ReplayView)를 같은 인터페이스로 대체한다.
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  const PK = { arrow: 0, bolt: 1, fireball: 2, lob: 3, pierce: 4 }, PK_N = Object.keys(PK);
  const AK = { meteor: 0, strike: 1, tele: 2, vortex: 3, cloud: 4 }, AK_N = Object.keys(AK);
  const FX_KEEP = { boom: 1, shock: 1, lightning: 1, ring: 1, text: 1, cone: 1, cross: 1, dash: 1, bolt: 1, crit: 1, death: 1, beam: 1, spin: 1, spikes: 1 };
  const U = 7;     // 유닛당 Int16 개수: 인덱스, x, y, 체력‰, 방향, 상태 비트, 보호막‰

  SW.Recorder = {
    attach(b) {
      const R = { v: 2, frames: [], meta: [], idx: new Map(), colors: [], cmap: new Map(), W: b.W, H: b.H, terrain: b.terrain ? b.terrain.serialize() : null,
        terrains: [], weather: b.weatherId, time: b.timeId, t: 0, interval: b.units.length > 800 ? 0.5 : b.units.length > 300 ? 0.25 : 0.15, maxFrames: 1600,
        fx: [], hits: [], kills: [], seed: b.seed, created: Date.now() };
      b.replay = R;
      const col = (c) => { if (!c) return 0; let i = R.cmap.get(c); if (i === undefined) { i = R.colors.length; R.colors.push(c); R.cmap.set(c, i); } return i; };
      const uidx = (u) => { let i = R.idx.get(u.uid); if (i === undefined) { i = R.meta.length; R.idx.set(u.uid, i); R.meta.push({ type: u.type, team: u.team, r: u.r, sq: u.sq, born: b.time, boss: !!u.def.boss, mh: Math.round(u.maxHp) }); } return i; };
      const snap = () => {
        const n = b.units.length, a = new Int16Array(n * U); let k = 0;
        for (const u of b.units) {
          const i = uidx(u); if (i > 32000) continue;
          const fl = (u.stealthed ? 1 : 0) | (u.stun > 0 || u.freeze > 0 ? 2 : 0) | (u.burn > 0 ? 4 : 0) | (u.poisonStacks > 0 ? 8 : 0) | (u.freeze > 0 ? 16 : 0) | (u.fearT > 0 ? 32 : 0) | (u.charging ? 64 : 0) | (u.shieldLight ? 128 : 0);
          a[k++] = i; a[k++] = u.x; a[k++] = u.y; a[k++] = Math.max(0, Math.round(u.hp / u.maxHp * 1000)); a[k++] = Math.round(u.facing * 1000); a[k++] = fl; a[k++] = Math.min(1000, Math.round(u.shield / u.maxHp * 1000));
        }
        const p = new Int16Array(b.projs.length * 6); let j = 0;
        for (const q of b.projs) { p[j++] = PK[q.kind] ?? 0; p[j++] = q.x; p[j++] = q.y; p[j++] = Math.round((q.ang ?? Math.atan2(q.vy || 0, q.vx || 1)) * 1000); p[j++] = q.z || 0; p[j++] = col(q.color); }
        const ar = new Int16Array(b.areas.length * 6); let m = 0;
        for (const q of b.areas) { if (AK[q.kind] === undefined) continue; ar[m++] = AK[q.kind]; ar[m++] = q.x; ar[m++] = q.y; ar[m++] = q.r; ar[m++] = Math.round((q.t / (q.T || 1)) * 1000); ar[m++] = col(q.color || (q.element === 'poison' ? '#8cff5a' : q.element === 'frost' ? '#bfefff' : '')); }
        R.frames.push({ t: b.time, d: k === a.length ? a : a.slice(0, k), p: p.slice(0, j), a: ar.slice(0, m),
          banners: b.banners.filter(x => x.t < 0.05).map(x => ({ text: x.text, color: x.color, sub: x.sub })) });
        if (b.terrain && b.terrain.version !== R.tver && b.time - (R.tT || -9) > 2) { R.tver = b.terrain.version; R.tT = b.time; R.terrains.push({ t: b.time, d: b.terrain.serialize().d }); }
      };
      // 이펙트 기록 (시각 효과는 판정과 분리되어 있으므로 addFx 를 가로채 기록)
      const origAdd = b.addFx.bind(b);
      b.addFx = (f) => {
        if (FX_KEEP[f.kind] && R.fx.length < 20000) {
          const e = { t: b.time, k: f.kind, x: f.x, y: f.y, T: f.T };
          if (f.r !== undefined) e.r = f.r; if (f.color) e.c = f.color; if (f.text) { e.tx = f.text; e.s = f.size; }
          if (f.a !== undefined) e.a = f.a; if (f.ang !== undefined) e.g = f.ang; if (f.x2 !== undefined) { e.x2 = f.x2; e.y2 = f.y2; }
          if (f.w !== undefined) e.w = f.w; if (f.pts) e.pts = f.pts.map(p => [p[0] | 0, p[1] | 0]); if (f.t && f.t.x !== undefined && f.kind === 'beam') { e.x2 = f.t.x; e.y2 = f.t.y; }
          if (f.shape) { e.sh = f.shape; e.tm = f.team; }
          R.fx.push(e);
        }
        return origAdd(f);
      };
      // 피해 판정 기록: 큰 피해(≥40)와 처치
      const origDmg = b.damage;
      b.damage = function (src, t, amt, type, opt) {
        const r = origDmg.call(this, src, t, amt, type, opt);
        if (r >= 40 && R.hits.length < 6000 && !(opt && opt.dot)) R.hits.push({ t: this.time, x: t.x | 0, y: t.y | 0, v: Math.round(r), tm: t.team });
        return r;
      };
      const origKill = b.kill;
      b.kill = function (u, src, silent) {
        const was = u.alive; origKill.call(this, u, src, silent);
        if (was && !u.alive && R.kills.length < 20000) R.kills.push({ t: this.time, v: uidx(u), k: src && src.uid ? uidx(src) : -1 });
      };
      snap();
      b.hooks.push((bb, dt) => { R.t += dt; if (R.t >= R.interval && R.frames.length < R.maxFrames) { R.t = 0; snap(); } });
      return R;
    },
    finalize(b) {
      const R = b.replay; if (!R || R.done) return R;
      R.done = true; R.events = b.events.slice(); R.end = b.time; R.winner = b.winner;
      R.frames.push({ t: b.time, d: new Int16Array(0), p: new Int16Array(0), a: new Int16Array(0), banners: [] });
      return R;
    },
  };

  // ── 재생 ──
  SW.ReplayView = class {
    constructor(R) {
      this.R = R; this.W = R.W; this.H = R.H; this.time = 0; this.speed = 1; this.playing = true;
      this.terrain0 = R.terrain; this.terrain = R.terrain ? SW.Terrain.from(R.terrain) : null; this.tIdx = -1;
      this.units = []; this.projs = []; this.areas = []; this.fx = []; this.banners = []; this.quality = 'medium';
      this.pool = []; this.ppool = []; this.apool = []; this.fi = 0; this.events = R.events || [];
      this.weatherId = R.weather; this.timeOfDay = SW.TIMES[R.time] || null; this.state = 'REPLAY';
      this.fxTimes = (R.fx || []).map(e => e.t);
    }
    get duration() { return this.R.end || 0; }
    seek(t) { this.time = Math.max(0, Math.min(this.duration, t)); this.fi = 0; this.banners = []; this.build(); }
    tick(dt) {
      if (this.playing) {
        const prev = this.time;
        this.time = Math.min(this.duration, this.time + dt * this.speed);
        for (const f of this.R.frames) if (f.t > prev && f.t <= this.time) for (const bn of f.banners) this.banners.push({ ...bn, t: 0, T: 1.8 });
        for (const b of this.banners) b.t += dt * this.speed;
        this.banners = this.banners.filter(b => b.t < b.T);
        if (this.time >= this.duration) this.playing = false;
      }
      this.build();
    }
    frameAt() {
      const F = this.R.frames; let i = this.fi;
      while (i < F.length - 2 && F[i + 1].t <= this.time) i++; while (i > 0 && F[i].t > this.time) i--;
      this.fi = i; return i;
    }
    build() {
      const R = this.R, F = R.frames; if (!F.length) return;
      const i = this.frameAt(), A = F[i], B = F[Math.min(i + 1, F.length - 1)];
      const k = B.t > A.t ? (this.time - A.t) / (B.t - A.t) : 0;
      // 지형 변화
      if (R.terrains && R.terrains.length) {
        let ti = -1; for (let j = 0; j < R.terrains.length; j++) if (R.terrains[j].t <= this.time) ti = j;
        if (ti !== this.tIdx) { this.tIdx = ti; this.terrain = SW.Terrain.from(ti < 0 ? this.terrain0 : { ...this.terrain0, d: R.terrains[ti].d }); }
      }
      // 유닛 (보간)
      const nb = new Map(); for (let j = 0; j < B.d.length; j += U) nb.set(B.d[j], j);
      this.units.length = 0; let p = 0;
      for (let j = 0; j < A.d.length; j += U) {
        const id = A.d[j], m = R.meta[id]; if (!m) continue;
        const jb = nb.get(id);
        if (jb === undefined && k > 0.5) continue;
        const u = this.pool[p] || (this.pool[p] = { buff: { slow: 0 }, rx: 0, ry: 0, anim: 0, alive: true, timed: [] });
        p++;
        let x = A.d[j + 1], y = A.d[j + 2], hp = A.d[j + 3];
        if (jb !== undefined) { x += (B.d[jb + 1] - x) * k; y += (B.d[jb + 2] - y) * k; hp += (B.d[jb + 3] - hp) * k; }
        const fl = A.d[j + 5];
        u.uid = id; u.type = m.type; u.def = SW.UNITS[m.type] || SW.UNITS.soldier; u.team = m.team; u.r = m.r; u.x = x; u.y = y; u.facing = A.d[j + 4] / 1000;
        u.maxHp = m.mh || 1000; u.hp = hp / 1000 * u.maxHp; u.anim = this.time + id; u.sq = m.sq;
        u.stealthed = !!(fl & 1); u.stun = fl & 2 ? 1 : 0; u.burn = fl & 4 ? 1 : 0; u.poisonStacks = fl & 8 ? 2 : 0; u.freeze = fl & 16 ? 1 : 0; u.charging = !!(fl & 64);
        u.shield = A.d[j + 6] / 1000 * u.maxHp; u.shieldLight = !!(fl & 128); u.flash = 0; u.slowAmt = 0; u.markT = 0; u.cmdT = 0; u.weakT = 0;
        if (m.boss && u.def.bossData) u.boss = { phase: 0, parts: null, revives: 0 }; else u.boss = null;
        this.units.push(u);
      }
      // 투사체
      this.projs.length = 0;
      const pa = A.p || []; for (let j = 0, q = 0; j < pa.length; j += 6, q++) {
        const o = this.ppool[q] || (this.ppool[q] = {});
        o.kind = PK_N[pa[j]]; o.x = pa[j + 1]; o.y = pa[j + 2]; o.ang = pa[j + 3] / 1000; o.z = pa[j + 4]; o.color = R.colors[pa[j + 5]] || '#fff';
        o.vx = Math.cos(o.ang); o.vy = Math.sin(o.ang);
        // 다음 프레임 방향으로 조금 진행 (보간)
        const sp = o.kind === 'pierce' ? 700 : o.kind === 'lob' ? 0 : 420; o.x += o.vx * sp * k * (B.t - A.t); o.y += o.vy * sp * k * (B.t - A.t);
        this.projs.push(o);
      }
      // 범위 효과
      this.areas.length = 0;
      const aa = A.a || []; for (let j = 0, q = 0; j < aa.length; j += 6, q++) {
        const o = this.apool[q] || (this.apool[q] = {});
        o.kind = AK_N[aa[j]]; o.x = aa[j + 1]; o.y = aa[j + 2]; o.r = aa[j + 3]; o.T = 1; o.t = Math.max(0, aa[j + 4] / 1000 - k * 0.15); o.color = R.colors[aa[j + 5]] || undefined;
        if (o.kind === 'cloud') o.element = o.color === '#8cff5a' ? 'poison' : 'frost';
        this.areas.push(o);
      }
      // 이펙트: 현재 시각에 살아 있는 기록된 이펙트를 재구성
      this.fx.length = 0;
      const E = R.fx || [], tm = this.time;
      let lo = 0, hi = this.fxTimes.length; const t0 = tm - 1.5;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.fxTimes[mid] < t0) lo = mid + 1; else hi = mid; }
      for (let j = lo; j < E.length && E[j].t <= tm; j++) {
        const e = E[j], age = tm - e.t; if (age > e.T) continue;
        const f = { kind: e.k, x: e.x, y: e.y, t: age, T: e.T, r: e.r, color: e.c, text: e.tx, size: e.s, a: e.a, ang: e.g, x2: e.x2, y2: e.y2, w: e.w, pts: e.pts, shape: e.sh, team: e.tm };
        if (e.k === 'beam') f.kind = 'dash';
        if (e.k === 'text') f.y = e.y - age * 22;
        this.fx.push(f);
      }
      // 큰 피해 숫자
      for (const h of R.hits || []) { if (h.t > tm) break; const age = tm - h.t; if (age < 0.7) this.fx.push({ kind: 'text', x: h.x, y: h.y - 14 - age * 30, text: String(h.v), color: h.tm === 0 ? '#ff9a9a' : '#ffe680', size: 11, t: age, T: 0.7 }); }
    }
    trail(id) {
      const pts = [];
      for (const f of this.R.frames) { if (f.t > this.time) break; for (let j = 0; j < f.d.length; j += U) if (f.d[j] === id) { pts.push([f.d[j + 1], f.d[j + 2]]); break; } }
      return pts;
    }
    killsBy(id) { return (this.R.kills || []).filter(k => k.k === id && k.t <= this.time).length; }
  };

  // ── 직렬화 (공유·보관) ──
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const i16 = (a) => b64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  const fromI16 = (s) => { const u = unb64(s); return new Int16Array(u.buffer, 0, u.byteLength >> 1); };
  SW.Replay = {
    toJSON(R) {
      return JSON.stringify({ ...R, idx: undefined, cmap: undefined, frames: R.frames.map(f => ({ t: f.t, d: i16(f.d), p: i16(f.p || new Int16Array(0)), a: i16(f.a || new Int16Array(0)), b: f.banners.length ? f.banners : undefined })) });
    },
    fromJSON(txt) {
      const o = JSON.parse(txt);
      o.frames = o.frames.map(f => ({ t: f.t, d: fromI16(f.d), p: fromI16(f.p), a: fromI16(f.a), banners: f.b || [] }));
      return o;
    },
    async pack(R) {
      const txt = this.toJSON(R);
      if (typeof CompressionStream === 'undefined') return new Blob([txt], { type: 'application/json' });
      return await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    },
    async unpack(blob) {
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
      const txt = head[0] === 0x1f && head[1] === 0x8b && typeof DecompressionStream !== 'undefined'
        ? await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await blob.text();
      return this.fromJSON(txt);
    },
    // IndexedDB 보관함
    db() {
      return new Promise((res, rej) => {
        if (typeof indexedDB === 'undefined') return rej(new Error('no idb'));
        const q = indexedDB.open('shapewar_replays', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('r', { keyPath: 'id' });
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
    },
    async save(R, title) {
      const db = await this.db(), blob = await this.pack(R);
      const rec = { id: 'r' + Date.now(), title: title || '전투', date: Date.now(), dur: R.end, units: R.meta.length, winner: R.winner, size: blob.size, blob };
      await new Promise((res, rej) => { const tx = db.transaction('r', 'readwrite'); tx.objectStore('r').put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      const all = await this.list();
      for (const old of all.slice(12)) await this.remove(old.id);      // 최근 12개만 보관
      return rec;
    },
    async list() {
      const db = await this.db();
      return new Promise((res) => { const out = []; const tx = db.transaction('r'); tx.objectStore('r').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { const v = c.value; out.push({ ...v, blob: undefined }); c.continue(); } else res(out.sort((a, b) => b.date - a.date)); }; });
    },
    async get(id) { const db = await this.db(); return new Promise((res) => { const q = db.transaction('r').objectStore('r').get(id); q.onsuccess = () => res(q.result); }); },
    async remove(id) { const db = await this.db(); return new Promise((res) => { const tx = db.transaction('r', 'readwrite'); tx.objectStore('r').delete(id); tx.oncomplete = res; }); },
  };
})();
