// 테스트 하네스: index.html 의 전투 관련 스크립트를 Node vm 에 로드 (UI·렌더러 제외)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
function load() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1])
    .filter(f => !f.startsWith('js/ui/') && !f.startsWith('js/render/') && f !== 'js/core/save.js');
  const ctx = { console, Math, JSON, Set, Map, WeakMap, Object, Array, Infinity, isFinite, Number, String, Uint8Array, Int16Array, Int32Array, Float32Array, Date, Error, Promise, setTimeout, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  const SW = ctx.SW;
  // 메모리 저장소
  const data = { gold: 0, res: { food: 0, wood: 0, ore: 0, mana: 0, crystal: 0 }, growth: {}, items: {}, equip: {}, skills: ['c_root', 't_root'], cleared: {}, aiLearn: {} };
  SW.save = { data, write() {}, mods() { const m = SW.buildMods(data.skills); SW.growthMods(m); return m; } };
  return SW;
}
// 전투 실행 도우미
function battle(SW, opts, setup, maxSec = 300) {
  const b = new SW.Battle({ visual: false, ...opts });
  setup(b);
  let n = 0; while (!b.over && n < 60 * maxSec) { b.step(1 / 60); n++; }
  return b;
}
function grid(b, type, team, n, cx, cy, cols = 5) {
  const d = b.def(type, team), g = d.size * 2 + 4;
  for (let i = 0; i < n; i++) b.spawn(type, team, cx + (i % cols) * g * (team ? 1 : -1), cy + (Math.floor(i / cols) - n / cols / 2) * g);
}
module.exports = { load, battle, grid, ROOT };
