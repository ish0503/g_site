// 저장 데이터 (localStorage)
window.SW = window.SW || {};
(() => {
  const KEY = 'shapewar_save_v1';
  const fresh = () => ({ gold: 0, cleared: {}, skills: ['c_root', 't_root'], deploys: {}, forms: {}, spent: 0, raids: {}, survivalBest: 0, settings: { quality: 'auto', auras: true, fps: false }, res: { food: 100, wood: 50, ore: 20, mana: 20, crystal: 1 }, growth: {}, items: {}, equip: {}, aiLearn: {}, puzzles: {}, scenarios: {}, customUnits: {}, campaign: null, version: 3 });
  let data;
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { data = fresh(); }
  // 1.0 저장 데이터 호환: 새 필드 보충
  const f = fresh();
  for (const k of Object.keys(f)) if (data[k] === undefined) data[k] = f[k];
  data.settings = Object.assign(f.settings, data.settings || {});
  data.skills = data.skills.filter(id => SW.SKILL_INDEX[id]);
  // 3.0 마이그레이션: 이전 버전 저장 데이터를 백업한 뒤 새 필드 추가
  let rawVer = 3; try { const raw = localStorage.getItem(KEY); rawVer = raw ? (JSON.parse(raw).version || 1) : 3; } catch (e) { /* 무시 */ }
  if (rawVer < 3) {
    try { localStorage.setItem(KEY + '_backup_v' + rawVer, localStorage.getItem(KEY)); } catch (e) { /* 무시 */ }
  }
  data.res = data.res || { food: 100, wood: 50, ore: 20, mana: 20, crystal: 1 };
  for (const k of ['growth', 'items', 'equip', 'aiLearn', 'puzzles', 'scenarios', 'customUnits']) if (!data[k]) data[k] = {};
  data.version = 3;
  for (const r of ['c_root', 't_root']) if (!data.skills.includes(r)) data.skills.push(r);
  SW.save = {
    get data() { return data; },
    write() {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        // 자동 백업: 10분마다 순환 백업 3개
        const now = Date.now(), last = +localStorage.getItem(KEY + '_bt') || 0;
        if (now - last > 600000) { const i = (+localStorage.getItem(KEY + '_bi') || 0) % 3; localStorage.setItem(KEY + '_auto' + i, JSON.stringify(data)); localStorage.setItem(KEY + '_bi', i + 1); localStorage.setItem(KEY + '_bt', now); }
      } catch (e) { /* 저장 불가 환경 */ }
    },
    exportText() { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); },
    importText(t) { const o = JSON.parse(decodeURIComponent(escape(atob(t.trim())))); if (!o || typeof o.gold !== 'number') throw new Error('bad'); data = Object.assign(fresh(), o); this.write(); },
    backups() { const out = []; for (const k of Object.keys(localStorage)) if (k.startsWith(KEY + '_auto') || k.startsWith(KEY + '_backup')) out.push(k); return out; },
    restore(k) { const o = JSON.parse(localStorage.getItem(k)); data = Object.assign(fresh(), o); this.write(); },
    wipe() { data = fresh(); this.write(); },
    mods() { const m = SW.buildMods(data.skills); if (SW.growthMods) SW.growthMods(m); return m; },
    treeMods() { return SW.buildMods(data.skills); },
    clearedCount() { return Object.keys(data.cleared).length; },
  };
})();
