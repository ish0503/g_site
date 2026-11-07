// 저장 데이터 (localStorage)
window.SW = window.SW || {};
(() => {
  const KEY = 'shapewar_save_v1';
  const fresh = () => ({ gold: 0, cleared: {}, skills: ['c_root', 't_root'], deploys: {}, spent: 0 });
  let data;
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { data = fresh(); }
  for (const r of ['c_root', 't_root']) if (!data.skills.includes(r)) data.skills.push(r);
  SW.save = {
    get data() { return data; },
    write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경 */ } },
    wipe() { data = fresh(); this.write(); },
    mods() { return SW.buildMods(data.skills); },
    clearedCount() { return Object.keys(data.cleared).length; },
  };
})();
