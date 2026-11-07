// 저장 데이터 (localStorage)
window.SW = window.SW || {};
(() => {
  const KEY = 'shapewar_save_v1';
  const fresh = () => ({ gold: 0, cleared: {}, skills: ['c_root', 't_root'], deploys: {}, forms: {}, spent: 0, raids: {}, survivalBest: 0, settings: { quality: 'auto', auras: true, fps: false }, version: 2 });
  let data;
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { data = fresh(); }
  // 1.0 저장 데이터 호환: 새 필드 보충
  const f = fresh();
  for (const k of Object.keys(f)) if (data[k] === undefined) data[k] = f[k];
  data.settings = Object.assign(f.settings, data.settings || {});
  data.skills = data.skills.filter(id => SW.SKILL_INDEX[id]);
  data.version = 2;
  for (const r of ['c_root', 't_root']) if (!data.skills.includes(r)) data.skills.push(r);
  SW.save = {
    get data() { return data; },
    write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경 */ } },
    wipe() { data = fresh(); this.write(); },
    mods() { return SW.buildMods(data.skills); },
    clearedCount() { return Object.keys(data.cleared).length; },
  };
})();
