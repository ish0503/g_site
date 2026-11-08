// ─────────────────────────────────────────────
// 3.2 전투 중 탄약 보급 + 협공(양익 포위) 전술
//   탄약: 팀별 탄약고(원거리 유닛 수 × 35발 × 시작 비율). 투사체 1발 = 1. 바닥나면 원거리 피해 40%.
//         보급 규칙이 켜져 있으면 살아 있는 보급 기지가 초당 탄약을 조금씩 채운다 (보급 30% 이상일 때).
//   식량은 war/supply.js 의 보급량이 담당한다.
//   협공: 아군 전열이 적과 맞붙은 뒤 여유 기동 부대가 둘 이상이면 양쪽 측면으로 동시에 우회 (tactics 다음에 실행)
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  P.enableAmmo = function (opts = {}) {
    if (this.ammoOn) return;
    this.ammoOn = true;
    const n = [0, 0];
    for (const u of this.units) if (!u.def.structure && u.def.range > 40 && u.def.attack !== 'heal' && u.def.attack !== 'none') n[u.team]++;
    this.ammoMax = n.map(k => Math.max(1, k * 35));
    this.ammo = this.ammoMax.map((m, t) => m * ((opts.start ? opts.start[t] : 100) / 100));
    this.hooks.push((b, dt) => b.ammoTick(dt));
  };
  P.ammoPct = function (t) { return this.ammoOn ? Math.round(this.ammo[t] / this.ammoMax[t] * 100) : null; };
  P.ammoTick = function (dt) {
    this.ammoT = (this.ammoT || 0) + dt; if (this.ammoT < 1) return; this.ammoT = 0;
    if (!this.supplyOn) return;
    for (let t = 0; t < 2; t++) {
      if (this.supply[t] < 30) continue;
      const d = this.teams[t].filter(u => u.def.depot && u.alive).length;
      const before = this.ammo[t];
      this.ammo[t] = Math.min(this.ammoMax[t], this.ammo[t] + this.ammoMax[t] * 0.004 * d);
      if (before < 1 && this.ammo[t] >= 1) this.logEvent(`${t ? '적' : '아군'} 탄약 보급 재개`, t, 'supply');
    }
  };
  const origFire = P.fireProj;
  P.fireProj = function (u, t, dmg, o) {
    if (this.ammoOn && u && !u.def.structure && u.team != null) {
      if (this.ammo[u.team] >= 1) {
        this.ammo[u.team] -= 1;
        if (this.ammo[u.team] < 1) { this.logEvent(`${u.team ? '적' : '아군'} 탄약 고갈 — 원거리 피해 40%`, u.team, 'supply'); if (this.visual) this.banner(`${u.team ? '적' : '아군'} 탄약 고갈!`, u.team ? '#9cc0ff' : '#ffb070', 1.4); }
      } else dmg *= 0.4;
    }
    return origFire.call(this, u, t, dmg, o);
  };

  // ── 협공 ──
  const origAI = P.aiCommand;
  P.aiCommand = function (team) {
    origAI.call(this, team);
    const A = this.ai[team];
    if (!A || A.legacy || (A.off && A.off.pincer) || this.time < 15) return;
    if (A.pincerT && this.time - A.pincerT < 45) return;
    const squads = this.squads.filter(s => s.team === team && s.alive >= 4);
    const enemyFront = this.teamInfo[1 - team];
    if (!enemyFront || !enemyFront.count) return;
    // 아군 전열이 교전 중인가: 전열 부대 근처에 적이 3명 이상
    const engaged = squads.some(s => { if (s.role !== 'front') return false; let n = 0; this.enemiesIn(s.cx, s.cy, 170, team, () => { n++; }); return n >= 3; });
    if (!engaged) return;
    // 기동력: 돌격·척후·암살·비행 역할이거나 빠른 유닛이 절반 이상인 부대
    const mob = new Map();
    for (const u of this.teams[team]) { if (u.sq === undefined || !u.alive) continue; const m = mob.get(u.sq) || [0, 0]; m[1]++; if (['charger', 'skirmisher', 'assassin', 'flyer'].includes(u.def.role) || u.def.speed >= 75) m[0]++; mob.set(u.sq, m); }
    const isMobile = (s) => s.role === 'mobile' || ((mob.get(s.id) || [0, 1])[0] / (mob.get(s.id) || [0, 1])[1] >= 0.5);
    const free = squads.filter(s => isMobile(s) && !['rear', 'retreat', 'escort'].includes(s.order.type) && s.alive >= 4).sort((a, b) => b.alive - a.alive);
    if (free.length < 2) return;
    const [a, b] = free;
    this.setOrder(a.id, 'flank'); this.setOrder(b.id, 'flank');
    // 두 번째 부대는 반대쪽 측면으로
    const oa = a.order, ob = b.order;
    if (oa.w1 && ob.w1 && Math.sign(oa.w1.y - enemyFront.cy) === Math.sign(ob.w1.y - enemyFront.cy)) {
      ob.w1 = { x: ob.w1.x, y: Math.max(40, Math.min(this.H - 40, enemyFront.cy - (oa.w1.y - enemyFront.cy))) };
    }
    A.pincerT = this.time;
    this.logEvent(`${team ? '적' : '아군'} AI: 협공 — ${a.name}·${b.name} 양익 포위`, team, 'ai');
  };
})();
