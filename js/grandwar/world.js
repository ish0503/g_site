// ─────────────────────────────────────────────
// 4.0 세계 상태 코어 — 결정론적 RNG · 시스템 등록 · 월/일 진행 · 직렬화 · 기록
//   각 하위 시스템(경제·기술·외교·전쟁·해상·반란·기록)은 W4.system({...}) 으로 등록되어
//   init(w) / month(w) / day(w, d) / save(w,o) / load(w,o) 를 제공한다. 순서는 order 값.
//   전략 계층(월) → 군사 계층(일, 월당 DAYS 단계) → 실시간 전투(별도, Battle.step) 로 주기를 분리.
// ─────────────────────────────────────────────
(() => {
  const W4 = SW.W4;
  W4.DAYS = 4;                         // 한 달을 나누는 군사 단계 수
  const systems = [];
  W4.systems = systems;
  W4.system = (s) => { const i = systems.findIndex(x => x.id === s.id); if (i >= 0) systems[i] = s; else systems.push(s); systems.sort((a, b) => (a.order || 0) - (b.order || 0)); };

  // 직렬화 가능한 RNG (mulberry32, 상태는 정수 하나)
  const rnd = (w) => { let t = (w.rs = (w.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  class World {
    constructor(opts = {}) {
      this.v4 = 1;
      this.seed = opts.seed ?? W4.DEFAULT_SEED;
      this.rs = (opts.rngSeed ?? this.seed * 2654435761) | 0;
      this.turn = 0; this.day = 0;
      this.player = opts.player || null;          // 플레이어 국가 id (null = 관전)
      this.scenario = opts.scenario || 'conquest';
      this.diff = opts.diff ?? 1;
      this.log = [];                               // 최근 사건 (최대 300)
      this.flags = {};
      this.map = W4.genMap(this.seed);
      this.state = W4.baseState(this.map);
      this.nations = {};
      for (const n of W4.NATIONS) this.nations[n.id] = { id: n.id, alive: true };
      if (opts.setup) opts.setup(this);            // 시나리오별 소유권 조정 등 (시스템 init 전에)
      for (const s of systems) if (s.init) s.init(this, opts);
    }
    rand() { return rnd(this); }
    pick(arr) { return arr[(this.rand() * arr.length) | 0]; }
    get year() { return 1000 + Math.floor(this.turn / 12); }
    get month() { return (this.turn % 12) + 1; }
    dateStr() { return `${this.year}년 ${this.month}월`; }
    nat(id) { return this.nations[id]; }
    def(id) { return W4.NATIONS[W4.NATION_INDEX[id]]; }
    alive() { return W4.NATIONS.filter(n => this.nations[n.id].alive).map(n => n.id); }
    regionsOf(id, occupiedToo = false) { const out = []; this.state.regions.forEach((s, i) => { if ((s.occ || s.owner) === id || (!occupiedToo && s.owner === id && !s.occ)) out.push(i); }); return [...new Set(out)]; }
    ownedRegions(id) { const out = []; this.state.regions.forEach((s, i) => { if (s.owner === id) out.push(i); }); return out; }
    controller(i) { const s = this.state.regions[i]; return s.occ || s.owner; }
    event(text, kind = 'info', who = null, extra) {
      const e = { t: this.turn, d: this.day, text, kind, who };
      if (extra) Object.assign(e, extra);
      this.log.push(e); if (this.log.length > 300) this.log.shift();
      for (const s of systems) if (s.onEvent) s.onEvent(this, e);
      return e;
    }
    // 한 달 진행: 일 단위 군사 단계 → 월 단위 전략 단계
    advance(months = 1) {
      for (let m = 0; m < months; m++) {
        for (let d = 0; d < W4.DAYS; d++) { this.day = d; for (const s of systems) if (s.day) s.day(this, d); if (this.paused) return; }
        this.day = 0;
        for (const s of systems) if (s.month) s.month(this);
        this.turn++;
        if (this.paused) return;
      }
    }
    // 직렬화: 지도는 시드로 다시 만들 수 있으므로 저장하지 않는다
    toJSON() {
      const o = { v4: 1, seed: this.seed, rs: this.rs, turn: this.turn, player: this.player, scenario: this.scenario, diff: this.diff, log: this.log, flags: this.flags, state: this.state, nations: this.nations };
      for (const s of systems) if (s.save) s.save(this, o);
      return o;
    }
    static fromJSON(o) {
      if (!o || !o.v4) throw new Error('4.0 세계 데이터가 아닙니다');
      const w = Object.create(World.prototype);
      Object.assign(w, { v4: 1, seed: o.seed, rs: o.rs, turn: o.turn, day: 0, player: o.player, scenario: o.scenario, diff: o.diff ?? 1, log: o.log || [], flags: o.flags || {}, state: o.state, nations: o.nations });
      w.map = W4.genMap(w.seed);
      if (w.state.regions.length !== w.map.regions.length) throw new Error('지도와 저장 데이터의 지역 수가 다릅니다');
      for (const s of systems) if (s.load) s.load(w, o);
      return w;
    }
  }
  W4.World = World;
  // 다른 모듈에서 쓰는 결정론적 도우미
  W4.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
})();
