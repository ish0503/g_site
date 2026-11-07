// 직업 트리 · 특성: 모든 상위 직업이 오류 없이 전투하고, 기존 진화 저장 데이터가 그대로 동작하는지
const { load } = require('./harness');
const SW = load();
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; } };
const mods = () => SW.growthMods({ stat: [], patch: [] });
const reset = () => { SW.save.data.growth = {}; SW.save.data.equip = {}; SW.save.data.items = {}; };
T('모든 직업 노드의 기술이 존재', () => {
  const bad = []; for (const [t, tr] of Object.entries(SW.CLASS_TREES)) { if (!SW.UNITS[t]) bad.push(t); for (const [k, n] of Object.entries(tr)) if (n.skill && !SW.ABILITIES[n.skill]) bad.push(t + '.' + k); }
  return { ok: !bad.length, info: bad.join(',') };
});
T('상위 직업 48개 전투 (오류·NaN 없음)', () => {
  let n = 0, casts = 0; const errs = [];
  for (const [type, tr] of Object.entries(SW.CLASS_TREES)) for (const sub of ['a1', 'a2', 'b1', 'b2']) {
    reset(); SW.save.data.growth[type] = { xp: 0, lv: 10, spec: null, evo: false, cls: sub[0], sub, traits: ['keen', 'fury'] };
    const b = new SW.Battle({ visual: false, seed: 7, mods: [mods(), null] });
    for (let i = 0; i < 12; i++) b.spawn(type, 0, 300 + (i % 4) * 30, 350 + Math.floor(i / 4) * 30);
    for (let i = 0; i < 16; i++) b.spawn(i % 2 ? 'soldier' : 'archer', 1, 1200 + (i % 4) * 30, 350 + Math.floor(i / 4) * 30);
    b.start(); for (let i = 0; i < 60 * 25 && b.state === 'RUNNING'; i++) b.step(1 / 60);
    const d = b.defCache ? null : null;
    if (b.units.some(u => !Number.isFinite(u.x) || !Number.isFinite(u.hp))) errs.push(type + sub);
    const def = SW.resolveDef(type, mods());
    if (def.name !== tr[sub].name || (tr[sub].skill && def.skill !== tr[sub].skill)) errs.push(type + sub + ' def');
    casts += b.stats[0].casts; n++;
  }
  return { ok: !errs.length && casts > 0, info: `${n}개 · 기술 사용 ${casts}회 ${errs.join(',')}` };
});
T('특성 조합 적용 (연격: 치명타 배율 +0.4)', () => {
  reset(); SW.save.data.growth.soldier = { xp: 0, lv: 7, spec: null, evo: false, traits: ['keen', 'fury'] };
  const d = SW.resolveDef('soldier', mods()), base = SW.resolveDef('soldier', { stat: [], patch: [] });
  const bc = base.crit || { chance: 0, mult: 1.8 };
  SW.save.data.growth.mage = { xp: 0, lv: 7, spec: null, evo: false, traits: ['keen'] };
  const m = SW.resolveDef('mage', mods()), mb = SW.resolveDef('mage', { stat: [], patch: [] }).crit || { chance: 0 };
  return { ok: Math.abs(d.crit.chance - bc.chance - 0.06) < 1e-9 && Math.abs(d.crit.mult - bc.mult - 0.4) < 1e-9 && d.atkCd < base.atkCd && m.crit && Math.abs(m.crit.chance - mb.chance - 0.06) < 1e-9, info: `병사 ${JSON.stringify(d.crit)} · 마법사 ${JSON.stringify(m.crit)}` };
});
T('3.0 저장 데이터(spec+evo) 하위 호환', () => {
  reset(); SW.save.data.growth.archer = { xp: 10, lv: 10, spec: 'offense', evo: true };
  const d = SW.resolveDef('archer', mods());
  return { ok: d.name === SW.EVOLUTIONS.archer.name && d.crit && d.crit.chance === 0.2, info: d.name };
});
T('분기만 선택 (Lv5)', () => {
  reset(); SW.save.data.growth.mage = { xp: 0, lv: 6, spec: null, evo: false, cls: 'b' };
  const d = SW.resolveDef('mage', mods()), base = SW.resolveDef('mage', { stat: [], patch: [] });
  return { ok: d.name === '제어술사' && d.range > base.range && d.skill === base.skill, info: d.name };
});
reset();
console.log(`\n${pass} passed, ${fail} failed`);
