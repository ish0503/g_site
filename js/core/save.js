// 저장 데이터 (localStorage)
//   · 기본 저장(챌린지·샌드박스·성장 등): KEY 하나 (버전 4)
//   · 4.0 세계 정복 저장: 슬롯별 별도 키(KEY_world_<slot>) — 기존 데이터와 섞이지 않는다.
//   · 마이그레이션 전 원본을 KEY_backup_v<이전 버전> 에 보존하고, 실패하면 원본으로 되돌린다.
//   · 원본이 손상(JSON 오류)되면 KEY_corrupt_<시각> 에 보존하고 가장 최근의 정상 백업에서 복구한다.
window.SW = window.SW || {};
(() => {
  const KEY = 'shapewar_save_v1', VERSION = 4;
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const get = (k) => { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } };
  const set = (k, v) => { try { if (LS) LS.setItem(k, v); return true; } catch (e) { return false; } };
  const keys = () => { try { return LS ? Object.keys(LS) : []; } catch (e) { return []; } };
  const fresh = () => ({ gold: 0, cleared: {}, skills: ['c_root', 't_root'], deploys: {}, forms: {}, spent: 0, raids: {}, survivalBest: 0, settings: { quality: 'auto', auras: true, fps: false }, res: { food: 100, wood: 50, ore: 20, mana: 20, crystal: 1 }, growth: {}, items: {}, equip: {}, aiLearn: {}, puzzles: {}, scenarios: {}, customUnits: {}, campaign: null, world: { slots: {}, scenarios: {} }, version: VERSION });

  // 버전별 마이그레이션 (원본 객체를 직접 바꾸지 않도록 복사본에 적용)
  function migrate(o) {
    const d = JSON.parse(JSON.stringify(o));
    const f = fresh();
    for (const k of Object.keys(f)) if (d[k] === undefined) d[k] = f[k];          // 1.0~3.1: 새 필드 보충
    d.settings = Object.assign(f.settings, d.settings || {});
    if (!Array.isArray(d.skills)) d.skills = f.skills.slice();
    d.skills = d.skills.filter(id => !SW.SKILL_INDEX || SW.SKILL_INDEX[id]);
    for (const r of ['c_root', 't_root']) if (!d.skills.includes(r)) d.skills.push(r);
    d.res = d.res || f.res;
    for (const k of ['growth', 'items', 'equip', 'aiLearn', 'puzzles', 'scenarios', 'customUnits']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    // 4.0: 세계 정복 색인만 추가 (챌린지·샌드박스·캠페인 데이터는 그대로 둔다)
    if (!d.world || typeof d.world !== 'object') d.world = { slots: {}, scenarios: {} };
    d.world.slots = d.world.slots || {}; d.world.scenarios = d.world.scenarios || {};
    if (typeof d.gold !== 'number' || !Number.isFinite(d.gold)) throw new Error('gold 필드 손상');
    d.version = VERSION;
    return d;
  }
  // 가장 최근의 정상 백업 찾기
  function latestBackup() {
    let best = null;
    for (const k of keys()) {
      if (!(k.startsWith(KEY + '_auto') || k.startsWith(KEY + '_backup'))) continue;
      try { const o = JSON.parse(get(k)); if (o && typeof o.gold === 'number') { const t = o._savedAt || 0; if (!best || t > best.t) best = { k, o, t }; } } catch (e) { /* 손상된 백업은 건너뜀 */ }
    }
    return best;
  }

  const status = { recovered: null, migratedFrom: null, migrationError: null };
  let data;
  const raw = get(KEY);
  let parsed = null;
  if (raw) {
    try { parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object') throw new Error('형식 오류'); }
    catch (e) {
      set(KEY + '_corrupt_' + Date.now(), raw);          // 손상된 원본 보존
      const b = latestBackup();
      parsed = b ? b.o : null; status.recovered = b ? b.k : 'fresh';
    }
  }
  if (!parsed) data = fresh();
  else {
    const from = parsed.version || 1;
    if (from < VERSION && raw && !status.recovered) { set(KEY + '_backup_v' + from, raw); status.migratedFrom = from; }
    try { data = migrate(parsed); }
    catch (e) {
      // 마이그레이션 실패: 원본은 백업 키에 남아 있음. 최소 보정만 한 원본으로 진행하고 오류를 기록
      status.migrationError = String(e.message || e);
      data = Object.assign(fresh(), parsed); data.version = parsed.version || 1;
    }
  }

  SW.save = {
    KEY, VERSION, status,
    get data() { return data; },
    write() {
      try {
        data._savedAt = Date.now();
        set(KEY, JSON.stringify(data));
        // 자동 백업: 10분마다 순환 백업 3개
        const now = Date.now(), last = +get(KEY + '_bt') || 0;
        if (now - last > 600000) { const i = (+get(KEY + '_bi') || 0) % 3; set(KEY + '_auto' + i, JSON.stringify(data)); set(KEY + '_bi', i + 1); set(KEY + '_bt', now); }
      } catch (e) { /* 저장 불가 환경 */ }
    },
    exportText() { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); },
    importText(t) {
      const o = JSON.parse(decodeURIComponent(escape(atob(t.trim())))); if (!o || typeof o.gold !== 'number') throw new Error('bad');
      if (raw || get(KEY)) set(KEY + '_backup_import_' + Date.now(), get(KEY));      // 가져오기 전 현재 데이터 보존
      data = migrate(o); this.write();
    },
    backups() { return keys().filter(k => k.startsWith(KEY + '_auto') || k.startsWith(KEY + '_backup') || k.startsWith(KEY + '_corrupt')); },
    restore(k) { const o = JSON.parse(get(k)); set(KEY + '_backup_restore_' + Date.now(), get(KEY)); data = migrate(o); this.write(); },
    wipe() { set(KEY + '_backup_wipe_' + Date.now(), get(KEY)); data = fresh(); this.write(); },
    mods() { const m = SW.buildMods(data.skills); if (SW.growthMods) SW.growthMods(m); return m; },
    treeMods() { return SW.buildMods(data.skills); },
    clearedCount() { return Object.keys(data.cleared).length; },
    // ── 4.0 세계 정복 저장 슬롯 (별도 키, 덮어쓰기 전 직전 판본 보존) ──
    world: {
      key: (slot) => KEY + '_world_' + slot,
      put(slot, state, meta = {}) {
        const k = this.key(slot), prev = get(k);
        if (prev) set(k + '_prev', prev);
        const ok = set(k, JSON.stringify(state));
        if (ok) { data.world.slots[slot] = Object.assign({ date: Date.now() }, meta); SW.save.write(); }
        return ok;
      },
      get(slot) {
        const k = this.key(slot);
        for (const kk of [k, k + '_prev']) { try { const o = JSON.parse(get(kk)); if (o && o.v4) return o; } catch (e) { /* 다음 후보 */ } }
        return null;
      },
      list() { return Object.entries(data.world.slots).map(([slot, m]) => Object.assign({ slot }, m)).sort((a, b) => b.date - a.date); },
      remove(slot) { const k = this.key(slot); const v = get(k); if (v) set(k + '_prev', v); try { LS && LS.removeItem(k); } catch (e) { /* 무시 */ } delete data.world.slots[slot]; SW.save.write(); },
    },
  };
})();
