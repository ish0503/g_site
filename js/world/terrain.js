// ─────────────────────────────────────────────
// World System — 지형 · 날씨 · 시간 · 동적 전장
// 지형은 40px 타일 격자. 모든 효과는 실제 전투 규칙으로 작동한다 (engine3.js 에서 적용).
// ─────────────────────────────────────────────
window.SW = window.SW || {};

(() => {
  // speed: 이동 배율, cover: 투사체 피해 감소, high: 고지(사거리·피해 보너스), conceal: 은폐(멀리서 공격 불가)
  // wet: 물(화염 피해 반감, 방어 -2), burn: 초당 화염 피해, block: 통행 불가, armor: 방어력 가산
  const T = [
    { id: 'plain', name: '평원', color: '#1a2230', speed: 1 },
    { id: 'forest', name: '숲', color: '#16341f', speed: 0.8, cover: 0.3, conceal: true, flammable: true },
    { id: 'hill', name: '언덕', color: '#3a3524', speed: 0.85, high: true },
    { id: 'mountain', name: '산악', color: '#4a4a52', block: true },
    { id: 'desert', name: '사막', color: '#3d3420', speed: 0.9, heat: 0.1 },
    { id: 'snow', name: '설원', color: '#3a4555', speed: 0.8 },
    { id: 'swamp', name: '늪지', color: '#25331f', speed: 0.55 },
    { id: 'lava', name: '용암', color: '#5a1d0c', speed: 0.85, burn: 10 },
    { id: 'water', name: '강·호수', color: '#173552', speed: 0.45, wet: true, armor: -2 },
    { id: 'ford', name: '여울', color: '#22476a', speed: 0.75, wet: true, armor: -1 },
    { id: 'fort', name: '성벽 위·요새', color: '#3b3b44', speed: 1, armor: 3, cover: 0.25, high: true },
    { id: 'fire', name: '불타는 숲', color: '#6a2a10', speed: 0.85, burn: 8, burning: true },
    { id: 'burnt', name: '잿더미', color: '#221c19', speed: 0.95 },
    { id: 'crater', name: '크레이터', color: '#2a2622', speed: 0.75 },
    { id: 'road', name: '도로', color: '#2e2a26', speed: 1.15 },
  ];
  const ID = {}; T.forEach((t, i) => { t.i = i; ID[t.id] = i; });
  SW.TERRAIN_TYPES = T; SW.TERRAIN_ID = ID;
  SW.TERRAIN_PAINT = ['plain', 'forest', 'hill', 'mountain', 'desert', 'snow', 'swamp', 'lava', 'water', 'ford', 'fort', 'road'];

  // 날씨: 실제 규칙
  SW.WEATHER = {
    clear: { name: '맑음', icon: '☀️', desc: '특수 효과 없음' },
    rain: { name: '비', icon: '🌧️', desc: '화염 피해 -50%, 화재가 빨리 꺼짐, 이동 -5%', fire: 0.5, speed: 0.95, extinguish: 2 },
    storm: { name: '폭풍', icon: '⛈️', desc: '원거리 빗나감 15%, 비행 속도 -30%, 화염 -40%, 무작위 낙뢰', fire: 0.6, miss: 0.15, fly: 0.7, lightning: true, extinguish: 2 },
    blizzard: { name: '눈보라', icon: '🌨️', desc: '이동 -20%, 냉기 피해 +30%, 시야 320', speed: 0.8, frost: 1.3, perception: 320 },
    fog: { name: '안개', icon: '🌫️', desc: '시야 220 — 그 너머의 적은 공격할 수 없음 (공격한 적은 노출)', perception: 220 },
    sandstorm: { name: '모래폭풍', icon: '🏜️', desc: '원거리 빗나감 25%, 시야 300', miss: 0.25, perception: 300 },
    wind: { name: '강풍', icon: '🌬️', desc: '바람을 등진 쪽 원거리 사거리 +12%, 맞바람 쪽 -12%', wind: 1 },
  };
  SW.TIMES = {
    day: { name: '낮', icon: '🌞', desc: '기본 시야', dark: 0 },
    dusk: { name: '황혼', icon: '🌇', desc: '시야 420', perception: 420, dark: 0.25 },
    night: { name: '야간', icon: '🌙', desc: '시야 260, 기습(은신·암살) 피해 1.5배, 은신 노출 시간 감소', perception: 260, ambush: 1.5, dark: 0.5 },
  };

  // 시드 난수
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  class Terrain {
    constructor(W, H, tile = 40) {
      this.W = W; this.H = H; this.tile = tile;
      this.cols = Math.ceil(W / tile); this.rows = Math.ceil(H / tile);
      this.t = new Uint8Array(this.cols * this.rows);
      this.fires = new Map();      // 타일 인덱스 → 남은 시간
      this.dirty = true; this.version = 0;
    }
    idx(x, y) { const c = (x / this.tile) | 0, r = (y / this.tile) | 0; if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1; return c + r * this.cols; }
    at(x, y) { const i = this.idx(x, y); return T[i < 0 ? 0 : this.t[i]]; }
    setI(i, id) { if (i >= 0 && this.t[i] !== id) { this.t[i] = id; this.dirty = true; } }
    paint(x, y, r, id) {
      const tl = this.tile;
      for (let ry = Math.floor((y - r) / tl); ry <= Math.floor((y + r) / tl); ry++) for (let cx = Math.floor((x - r) / tl); cx <= Math.floor((x + r) / tl); cx++) {
        if (cx < 0 || ry < 0 || cx >= this.cols || ry >= this.rows) continue;
        const px = (cx + 0.5) * tl, py = (ry + 0.5) * tl;
        if ((px - x) ** 2 + (py - y) ** 2 <= r * r) this.setI(cx + ry * this.cols, typeof id === 'number' ? id : ID[id]);
      }
    }
    blob(x, y, r, id, rnd) { for (let k = 0; k < 5; k++) this.paint(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, r * (0.4 + rnd() * 0.5), id); }
    blocked(x, y) { return T[this.t[this.idx(x, y)] || 0].block; }

    // 프리셋 생성
    generate(preset, seed = 1) {
      const rnd = rng(seed), W = this.W, H = this.H, s = W / 1600;
      const base = { desert: 'desert', snow: 'snow', swamp: 'swamp', volcanic: 'desert' }[preset] || 'plain';
      this.t.fill(ID[base]);
      const mid = (a, b) => a + rnd() * (b - a);
      const scatter = (n, id, r, keepCenter) => {
        for (let i = 0; i < n; i++) {
          let x = mid(0.08, 0.92) * W, y = mid(0.08, 0.92) * H;
          if (keepCenter && Math.abs(x - W / 2) < W * 0.12) x += (x < W / 2 ? -1 : 1) * W * 0.15;
          this.blob(x, y, r * s, id, rnd);
        }
      };
      switch (preset) {
        case 'plain': scatter(4, 'forest', 120); scatter(3, 'hill', 110); break;
        case 'forest': scatter(14, 'forest', 150); scatter(2, 'hill', 100); break;
        case 'mountain': scatter(7, 'mountain', 70, true); scatter(6, 'hill', 140); scatter(3, 'forest', 100); break;
        case 'desert': scatter(5, 'hill', 120); this.blob(W / 2, mid(0.3, 0.7) * H, 90 * s, 'water', rnd); break;
        case 'snow': scatter(5, 'forest', 100); scatter(4, 'hill', 120); break;
        case 'swamp': scatter(10, 'water', 60); scatter(6, 'forest', 90); break;
        case 'volcanic': scatter(6, 'lava', 55, true); scatter(4, 'mountain', 60, true); scatter(4, 'crater', 90); break;
        case 'river': case 'fortress': default: {
          scatter(5, 'forest', 120); scatter(3, 'hill', 100);
          if (preset === 'river') {
            let x = W / 2;
            const fords = [H * mid(0.15, 0.35), H * mid(0.6, 0.85)];
            for (let y = 0; y < H; y += this.tile / 2) {
              x += (rnd() - 0.5) * 18 * s;
              const ford = fords.some(f => Math.abs(f - y) < 70 * s);
              this.paint(x, y, 55 * s, ford ? 'ford' : 'water');
            }
          }
          if (preset === 'fortress') { /* 요새 구조물은 siege 모드에서 배치 */ }
        }
      }
      this.dirty = true;
      return this;
    }

    // 동적 변화: 점화 · 크레이터 · 화재 확산
    ignite(x, y, r) {
      const tl = this.tile;
      for (let ry = Math.floor((y - r) / tl); ry <= Math.floor((y + r) / tl); ry++) for (let cx = Math.floor((x - r) / tl); cx <= Math.floor((x + r) / tl); cx++) {
        if (cx < 0 || ry < 0 || cx >= this.cols || ry >= this.rows) continue;
        const i = cx + ry * this.cols;
        if (T[this.t[i]].flammable) { this.setI(i, ID.fire); this.fires.set(i, 6 + SW.util.rand() * 3); }
      }
    }
    crater(x, y, r) {
      const i0 = this.idx(x, y); if (i0 < 0) return;
      const tt = T[this.t[i0]];
      if (tt.block || tt.wet || tt.id === 'fort' || tt.id === 'fire') return;
      this.paint(x, y, Math.min(r * 0.5, 50), 'crater');
    }
    update(dt, weather) {
      if (!this.fires.size) return;
      this.fireT = (this.fireT || 0) + dt;
      const ext = (weather && weather.extinguish) || 1;
      const spread = this.fireT >= 1; if (spread) this.fireT = 0;
      for (const [i, t] of [...this.fires]) {
        const nt = t - dt * ext;
        if (nt <= 0) { this.fires.delete(i); this.setI(i, ID.burnt); continue; }
        this.fires.set(i, nt);
        if (spread && SW.util.rand() < 0.3 / ext) {
          const c = i % this.cols, r = (i / this.cols) | 0;
          const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][(SW.util.rand() * 4) | 0];
          const j = (c + n[0]) + (r + n[1]) * this.cols;
          if (c + n[0] >= 0 && c + n[0] < this.cols && r + n[1] >= 0 && r + n[1] < this.rows && T[this.t[j]].flammable) { this.setI(j, ID.fire); this.fires.set(j, 6 + SW.util.rand() * 3); }
        }
      }
      if (this.fires.size) this.dirty = true;
    }
    flood(rate) {
      // 폭풍으로 강이 범람: 물에 인접한 평지 타일이 여울로
      const add = [];
      for (let i = 0; i < this.t.length; i++) if (T[this.t[i]].id === 'water') {
        const c = i % this.cols, r = (i / this.cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0]]) { const j = (c + dx) + r * this.cols; if (c + dx >= 0 && c + dx < this.cols && ['plain', 'burnt', 'crater', 'forest'].includes(T[this.t[j]].id) && SW.util.rand() < rate) add.push(j); }
      }
      for (const j of add) this.setI(j, ID.ford);
      return add.length;
    }

    // 렌더링용 캐시 캔버스
    canvas() {
      if (!this.dirty && this._cv) return this._cv;
      if (typeof document === 'undefined') return null;
      const cv = this._cv || (this._cv = document.createElement('canvas'));
      cv.width = this.cols; cv.height = this.rows;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(this.cols, this.rows);
      const rgb = T.map(t => [parseInt(t.color.slice(1, 3), 16), parseInt(t.color.slice(3, 5), 16), parseInt(t.color.slice(5, 7), 16)]);
      for (let i = 0; i < this.t.length; i++) {
        let [r, g, b] = rgb[this.t[i]];
        if (this.t[i] === ID.fire) { const f = Math.random() * 40; r += f; g += f / 3; }
        const n = ((i * 2654435761) >>> 24) % 9 - 4;     // 약간의 질감
        img.data[i * 4] = r + n; img.data[i * 4 + 1] = g + n; img.data[i * 4 + 2] = b + n; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      this.dirty = false; this.version++;
      return cv;
    }
    serialize() { let s = ''; for (const v of this.t) s += String.fromCharCode(65 + v); return { W: this.W, H: this.H, tile: this.tile, d: s }; }
    static from(o) { const t = new Terrain(o.W, o.H, o.tile); for (let i = 0; i < t.t.length && i < o.d.length; i++) t.t[i] = o.d.charCodeAt(i) - 65; return t; }
  }
  SW.Terrain = Terrain;
  SW.TERRAIN_PRESETS = { plain: '평원', forest: '숲', river: '강', mountain: '산악', desert: '사막', snow: '설원', swamp: '늪지', volcanic: '화산 지대', fortress: '요새' };
})();
