// ─────────────────────────────────────────────
// 3.1 전투 보급 — 보급 기지 · 보급량 · 보급선 · 보급 차단
//   · 각 군은 후방 보급 기지(파괴 가능)와 보급량(0~100%)을 가진다.
//   · 시작 병력 대비 남은 병력에 비례해 보급이 소모되고, 살아 있는 기지가 보급을 채운다.
//   · 보급 기지에서 너무 멀리 나간 유닛은 '보급선 이탈' (공격력·사기·기술 회복 저하).
//   · 보급량 30% 미만: 전군 공격력 -10%·재생 중단·사기 하락 / 0%: 공격력 -25%·기술 회복 절반.
//   · 기지가 파괴되면 사기 하락. AI는 기동대로 적 기지를 습격하고 자기 기지를 호위한다.
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  const { clamp } = SW.util;
  SW.UNITS.depot = { name: '보급 기지', family: 'structure', size: 18, pop: 0, hp: 900, armor: 6, dmg: 0, attack: 'none', speed: 0, immobile: true,
    structure: true, depot: true, summonOnly: true, glyph: 'plus', accent: '#ffcf8a', role: 'none', desc: '군대의 보급을 채운다. 파괴되면 보급과 사기가 떨어진다.' };
  SW.normalizeUnit('depot', SW.UNITS.depot); SW.UNITS.depot.cls = 'tank';

  // 전투에 보급 시스템 연결 (start 전에 호출)
  P.enableSupply = function (opts = {}) {
    if (this.supplyOn) return;
    this.supplyOn = true;
    this.supply = [opts.start0 ?? 100, opts.start1 ?? 100];
    this.supplyRange = opts.range || Math.max(900, this.W * 0.55);
    for (let t = 0; t < 2; t++) {
      if (this.units.some(u => u.team === t && u.def.depot)) continue;
      const x = t === 0 ? 40 : this.W - 40;
      for (const fy of [0.3, 0.7]) this.spawn('depot', t, x, this.H * fy);
    }
    this.hooks.push((b, dt) => b.supplyTick(dt));
  };
  P.supplyTick = function (dt) {
    this.supT = (this.supT || 0) + dt; if (this.supT < 1) return;
    const step = this.supT; this.supT = 0;
    for (let t = 0; t < 2; t++) {
      const depots = this.teams[t].filter(u => u.def.depot && u.alive), army = this.teams[t].filter(u => !u.def.structure);
      if (!this.supArmy0) this.supArmy0 = [0, 0];
      if (!this.supArmy0[t]) this.supArmy0[t] = Math.max(1, army.length);
      // 소모: (시작 병력 대비 남은 병력 비율, 최소 40%) × 1.2%/초 · 보충: 기지당 0.25%/초
      //   병력 온전 시 기지 2개: -0.7%/초 (약 100초 뒤 30% 미만) · 기지 1개: -0.95%/초 · 기지 0개: -1.2%/초
      const use = Math.max(0.4, army.length / this.supArmy0[t]) * 1.2 * step, gain = depots.length * 0.25 * step;
      const before = this.supply[t];
      this.supply[t] = clamp(this.supply[t] - use + gain, 0, 100);
      if (before >= 30 && this.supply[t] < 30) { this.logEvent(`${t ? '적' : '아군'} 보급 부족 (30% 미만)`, t, 'supply'); this.banner(`${t ? '적' : '아군'} 보급 부족!`, t ? '#9cc0ff' : '#ffb070', 1.4); }
      if (before > 0 && this.supply[t] === 0) this.logEvent(`${t ? '적' : '아군'} 보급 고갈`, t, 'supply');
      const S = this.supply[t], R2 = this.supplyRange ** 2;
      for (const u of army) {
        let inLine = false; for (const d of depots) if ((d.x - u.x) ** 2 + (d.y - u.y) ** 2 < R2) { inLine = true; break; }
        u.outSupply = !inLine;
        u.supMul = (S <= 0 ? 0.75 : S < 30 ? 0.9 : 1) * (inLine ? 1 : 0.9);
        if (S <= 0 || !inLine) { if (u.skillCd > 0) u.skillCd += step * (S <= 0 ? 0.5 : 0.25); }
        if (this.moraleOn && u.morale != null && (S < 30 || !inLine)) u.morale -= (S <= 0 ? 1 : 0.5) * step;
      }
    }
  };
  // 공격력 보정 · 재생 차단
  const origDmg = P.damage;
  P.damage = function (src, t, amt, type, opt) {
    if (this.supplyOn && src && src.supMul && src.supMul !== 1 && !(opt && opt.dot)) amt *= src.supMul;
    return origDmg.call(this, src, t, amt, type, opt);
  };
  const origHeal = P.heal;
  P.heal = function (o, amt, src, regen) {
    if (this.supplyOn && regen && this.supply[o.team] < 30) return 0;
    return origHeal.call(this, o, amt, src, regen);
  };
  // 기지 파괴: 사기 하락
  const origKill = P.kill;
  P.kill = function (u, src, silent) {
    const was = u.alive; origKill.call(this, u, src, silent);
    if (was && !u.alive && u.def.depot) {
      this.supply[u.team] = Math.max(0, this.supply[u.team] - 15);
      this.banner(`${u.team ? '적' : '아군'} 보급 기지 파괴!`, u.team ? '#9cc0ff' : '#ff9a9a', 1.8, '보급량 -15% · 사기 하락');
      this.logEvent(`${u.team ? '적' : '아군'} 보급 기지 파괴`, u.team, 'supply');
      for (const o of this.units) if (o.team === u.team && o.morale != null) o.morale -= 10;
    }
  };
  // 전멸 판정에서 보급 기지는 제외
  const origEnd = P.checkEnd;
  P.checkEnd = function () {
    if (this.supplyOn && !this.over && !this.endless && this.victory.type === 'annihilate') {
      const a = this.units.some(u => u.team === 0 && !u.def.structure), b = this.units.some(u => u.team === 1 && !u.def.structure);
      if (!a || !b) { this.finish(a ? 0 : b ? 1 : -1); return; }
    }
    return origEnd.call(this);
  };
  // AI: 적 기지 습격 · 자기 기지 호위 (tactics 의 aiCommand 뒤에 실행)
  const origAI = P.aiCommand;
  P.aiCommand = function (team) {
    origAI.call(this, team);
    if (!this.supplyOn || this.ai[team].legacy || this.time < 25) return;
    const A = this.ai[team];
    const squads = this.squads.filter(s => s.team === team && s.alive > 0);
    const mine = this.teams[team].filter(u => u.def.depot), theirs = this.teams[1 - team].filter(u => u.def.depot);
    // 자기 기지 위협 → 가까운 부대 호위
    for (const d of mine) {
      let th = 0; this.enemiesIn(d.x, d.y, 260, team, () => { th++; });
      if (th >= 3 && !A.flags['guard' + d.uid]) {
        let best = null, bd = 1e12; for (const s of squads) { const q = (s.cx - d.x) ** 2 + (s.cy - d.y) ** 2; if (q < bd && !(s.role === 'ranged')) { bd = q; best = s; } }
        if (best) { this.setOrder(best.id, 'escort', { unit: d }); A.flags['guard' + d.uid] = true; this.logEvent(`${team ? '적' : '아군'} AI: 보급 기지 방어`, team, 'ai'); }
      }
    }
    // 기동대가 적 기지 습격 (한 부대만)
    if (theirs.length && !A.raidSq) {
      const mob = squads.find(s => (s.cls.assassin || 0) + (s.cls.flyer || 0) + (s.cls.front || 0) > 0 && s.role === 'mobile');
      if (mob) { A.raidSq = mob.id; this.setOrder(mob.id, 'focus', { target: theirs[0] }); this.logEvent(`${team ? '적' : '아군'} AI: 보급 기지 습격`, team, 'ai'); }
    } else if (A.raidSq != null) {
      const s = this.squads[A.raidSq];
      if (s && s.alive && s.order.type !== 'focus' && theirs.length) this.setOrder(s.id, 'focus', { target: theirs[0] });
    }
  };
})();
