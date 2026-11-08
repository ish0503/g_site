// 실행: node tests/save.test.js — 저장 데이터 마이그레이션·손상 복구·세계 정복 슬롯 (가짜 localStorage)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const T = (name, fn) => { try { const r = fn(); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${r.info || ''}`); r.ok ? pass++ : fail++; } catch (e) { console.log('FAIL', name, e.stack.split('\n').slice(0, 2).join(' | ')); fail++; } };
function boot(store) {
  // 실제 localStorage 처럼 항목을 열거 가능한 고유 속성으로 둔다 (메서드는 열거 불가)
  const ls = store;
  if (!ls.getItem) Object.defineProperties(ls, {
    getItem: { value: k => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null) },
    setItem: { value: (k, v) => { ls[k] = String(v); } },
    removeItem: { value: k => { delete ls[k]; } },
  });
  const lsProxy = ls;
  const ctx = { console, Math, JSON, Object, Array, Number, String, Date, Error, Proxy, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'), escape, unescape, encodeURIComponent, decodeURIComponent, localStorage: lsProxy };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['js/data/units.js', 'js/data/tree.js', 'js/core/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.SW;
}
const KEY = 'shapewar_save_v1';
const v1 = { gold: 1234, cleared: { s1: 3, s2: 2 }, skills: ['c_root', 't_root', 'bogus_skill'], deploys: { s1: [{ type: 'soldier', x: 1, y: 2 }] } };
const v3 = { gold: 777, cleared: { s1: 3 }, skills: ['c_root', 't_root'], growth: { archer: { xp: 5, lv: 10, spec: 'offense', evo: true } }, campaign: { turn: 9, regions: {} }, scenarios: { my: { name: 'x' } }, version: 3 };

T('빈 저장소 → 새 데이터 (버전 4)', () => { const S = boot({}); return { ok: S.save.data.version === 4 && S.save.data.world && S.save.data.gold === 0 }; });
T('1.0 데이터: 원본 백업 + 기록 보존', () => {
  const st = { [KEY]: JSON.stringify(v1) }; const S = boot(st), d = S.save.data;
  return { ok: st[KEY + '_backup_v1'] === JSON.stringify(v1) && d.gold === 1234 && d.cleared.s2 === 2 && d.deploys.s1.length === 1 && !d.skills.includes('bogus_skill') && d.version === 4 && S.save.status.migratedFrom === 1, info: `from v${S.save.status.migratedFrom}` };
});
T('3.0 데이터: 성장·캠페인·시나리오 보존, 세계 정복으로 변환 안 됨', () => {
  const st = { [KEY]: JSON.stringify(v3) }; const S = boot(st), d = S.save.data;
  return { ok: st[KEY + '_backup_v3'] && d.growth.archer.evo === true && d.campaign.turn === 9 && d.scenarios.my && Object.keys(d.world.slots).length === 0 && d.version === 4 };
});
T('4.0 데이터 재실행 시 추가 백업 없음', () => {
  const st = {}; let S = boot(st); S.save.data.gold = 50; S.save.write(); const n = Object.keys(st).length; S = boot(st);
  return { ok: S.save.data.gold === 50 && !Object.keys(st).some(k => k.includes('_backup_v4')) && Object.keys(st).length === n };
});
T('손상된 원본: 보존 후 최근 백업에서 복구', () => {
  const st = { [KEY]: '{"gold": 12, broken', [KEY + '_auto0']: JSON.stringify(Object.assign({}, v3, { gold: 500, _savedAt: 1 })), [KEY + '_auto1']: JSON.stringify(Object.assign({}, v3, { gold: 900, _savedAt: 2 })) };
  const S = boot(st); const corrupt = Object.keys(st).find(k => k.startsWith(KEY + '_corrupt_'));
  return { ok: corrupt && st[corrupt] === '{"gold": 12, broken' && S.save.data.gold === 900 && S.save.status.recovered === KEY + '_auto1', info: `복구 ${S.save.status.recovered}` };
});
T('마이그레이션 실패(gold 손상) → 원본 백업 유지·오류 기록', () => {
  const bad = { gold: 'abc', cleared: {} }; const st = { [KEY]: JSON.stringify(bad) }; const S = boot(st);
  return { ok: st[KEY + '_backup_v1'] === JSON.stringify(bad) && !!S.save.status.migrationError, info: S.save.status.migrationError };
});
T('세계 정복 슬롯: 별도 키·직전 판본 보존·손상 시 직전 판본', () => {
  const st = {}; const S = boot(st); const W = S.save.world;
  W.put('a', { v4: 1, turn: 1 }, { name: 'A' }); W.put('a', { v4: 1, turn: 2 });
  const ok1 = W.get('a').turn === 2 && JSON.parse(st[KEY + '_world_a_prev']).turn === 1 && !JSON.parse(st[KEY]).world.slots.a.turn;
  st[KEY + '_world_a'] = '{broken'; const ok2 = W.get('a').turn === 1;
  W.remove('a'); return { ok: ok1 && ok2 && !W.list().length && st[KEY + '_world_a_prev'] };
});
T('가져오기·초기화 전 현재 데이터 보존', () => {
  const st = { [KEY]: JSON.stringify(v3) }; const S = boot(st); S.save.wipe();
  return { ok: Object.keys(st).some(k => k.startsWith(KEY + '_backup_wipe_') && JSON.parse(st[k]).gold === 777) && S.save.data.gold === 0 };
});
console.log(`\n${pass} passed, ${fail} failed`);
