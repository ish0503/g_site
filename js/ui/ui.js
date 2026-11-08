// UI 및 화면 전환
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const save = SW.save;
  const fmt = (n) => Math.round(n).toLocaleString();

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function icon(type, team = 0, size = 26) {
    const c = el('canvas'); c.style.width = size + 'px'; c.style.height = size + 'px';
    requestAnimationFrame(() => SW.drawUnitIcon(c, type, team));
    return c;
  }
  function updateGold() { $$('.gold-amt').forEach(e => e.textContent = fmt(save.data.gold)); }

  // ───────── 화면 전환 ─────────
  let current = 'menu', treeReturn = 'menu';
  function go(name) {
    if (name === 'sandbox') { Battle.open('sandbox'); name = 'battle'; }
    if (name === 'survival') { Battle.open('survival'); name = 'battle'; }
    if (name === 'tree' && current !== 'tree') treeReturn = current;
    if (current === 'battle' && name !== 'battle') Battle.close();
    if (!$('#screen-' + name) && SW.screens && SW.screens['make_' + name]) SW.screens['make_' + name]();
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    current = name;
    updateGold();
    if (name === 'stages') renderStages();
    if (name === 'tree') Tree.render();
    if (name === 'codex') renderCodex();
    if (name === 'raids') renderRaids();
    if (name === 'menu') renderMenu();
    if (SW.screens && SW.screens[name]) SW.screens[name]();
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
  });

  // ───────── 메뉴 ─────────
  function renderMenu() {
    const raids = Object.keys(save.data.raids).length;
    $('#menu-progress').textContent = `클리어 ${save.clearedCount()}/${SW.STAGES.length} · 레이드 ${raids}/${SW.RAIDS.length} · 생존 최고 ${save.data.survivalBest}웨이브 · 💰 ${fmt(save.data.gold)}`;
  }
  $('#btn-wipe').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('모든 진행 상황(골드, 스킬, 클리어 기록)을 초기화할까요?')) { save.wipe(); renderMenu(); toast('초기화되었습니다'); }
  });
  // 메뉴 배경: 데모 전투
  const MenuBG = {
    init() {
      this.canvas = $('#menu-bg'); this.r = new SW.Renderer(this.canvas); this.r.showAuras = false; this.reset();
      const loop = () => {
        if (current === 'menu') {
          for (let i = 0; i < 1; i++) this.b.step(1 / 60);
          if (this.b.over) { this.t = (this.t || 0) + 1; if (this.t > 120) this.reset(); }
          this.r.draw(this.b);
        }
        requestAnimationFrame(loop);
      };
      loop();
    },
    reset() {
      this.t = 0;
      this.b = new SW.Battle({ timeLimit: 120, quality: 'medium', formations: [['line', 'wedge', 'free'][(Math.random() * 3) | 0], 'free'] });
      const pool = SW.unitList().filter(u => u.pop <= 3).map(u => u.id);
      for (let team = 0; team < 2; team++) for (let g = 0; g < 5; g++) {
        const type = pool[(Math.random() * pool.length) | 0];
        const n = Math.max(2, Math.round(12 / SW.UNITS[type].pop));
        const cx = team ? 1100 + Math.random() * 350 : 150 + Math.random() * 350, cy = 120 + Math.random() * 660;
        for (let i = 0; i < n; i++) this.b.spawn(type, team, cx + (Math.random() - .5) * 80, cy + (Math.random() - .5) * 80);
      }
    },
  };

  // ───────── 스테이지 선택 ─────────
  function stageUnlocked(i) { return i === 0 || save.data.cleared[SW.STAGES[i - 1].id]; }
  function renderStages() {
    const g = $('#stage-grid'); g.innerHTML = '';
    const mods = save.mods();
    SW.STAGES.forEach((s, i) => {
      const unlocked = stageUnlocked(i), cleared = save.data.cleared[s.id];
      const c = el('div', 'stage' + (unlocked ? '' : ' locked') + (cleared ? ' cleared' : ''));
      c.innerHTML = `<div class="num">STAGE ${i + 1}</div><div class="nm">${unlocked ? s.name : '???'}</div>
        <div class="meta"><span>👤 인원 ${s.pop + mods.popBonus}</span><span>💰 ${cleared ? Math.round(s.reward * 0.3) : s.reward}</span><span>적 👤${SW.stageEnemyPop(s)}</span></div>`;
      if (cleared) c.appendChild(el('div', 'badge', '✔ 클리어'));
      if (unlocked) {
        const ic = el('div', 'icons');
        for (const [u, n] of s.enemies) { const sp = el('span'); sp.appendChild(icon(u, 1, 22)); sp.append('×' + n); ic.appendChild(sp); }
        c.appendChild(ic);
        c.addEventListener('click', () => { Battle.open('challenge', s); go('battle'); });
      } else c.appendChild(el('div', 'meta', '🔒 이전 스테이지를 클리어하세요'));
      g.appendChild(c);
    });
  }

  // ───────── 스킬 트리 ─────────
  const Tree = {
    fam: 'circle', sel: null,
    famUnlocked(f) { return save.data.skills.includes(SW.SKILL_TREES[f][0].id); },
    visible(n) {
      const sk = save.data.skills;
      return sk.includes(n.id) || !n.req.length || n.req.some(r => sk.includes(r));
    },
    nodeState(n) {
      const owned = save.data.skills.includes(n.id);
      if (owned) return 'owned';
      const reqOk = n.req.every(r => save.data.skills.includes(r));
      const stageOk = !n.stage || save.clearedCount() >= n.stage;
      if (!reqOk || !stageOk) return 'locked';
      return save.data.gold >= n.cost ? 'avail' : 'avail poor';
    },
    render() {
      const tabs = $('#tree-tabs'); tabs.innerHTML = '';
      for (const f of SW.FAMILY_ORDER) {
        const F = SW.FAMILIES[f];
        const b = el('button', (f === this.fam ? 'on' : '') + (this.famUnlocked(f) ? '' : ' locked'));
        const root = SW.SKILL_TREES[f][0];
        b.appendChild(icon(root.fx[0].unlock, 0, 20));
        b.append(`${F.name} · ${F.title}`);
        const owned = SW.SKILL_TREES[f].filter(n => save.data.skills.includes(n.id)).length;
        b.append(el('span', 'muted', ` ${owned}/${SW.SKILL_TREES[f].length}`));
        b.onclick = () => { this.fam = f; this.sel = null; this.render(); };
        tabs.appendChild(b);
      }
      const all = SW.SKILL_TREES[this.fam];
      // 보유한 노드와 그 바로 다음 단계만 공개
      const nodes = all.filter(n => this.visible(n));
      const hidden = all.length - nodes.length;
      const CX = 150, CY = 92, NW = 128, NH = 60, PAD = 20;
      const maxX = Math.max(...nodes.map(n => n.x)), maxY = Math.max(...nodes.map(n => n.y));
      const view = $('#tree-view'); view.innerHTML = '';
      const inner = el('div', 'tree-inner');
      const w = maxX * CX + NW + PAD * 2, h = maxY * CY + NH + PAD * 2;
      inner.style.width = w + 'px'; inner.style.height = h + 'px';
      const pos = (n) => ({ x: PAD + n.x * CX, y: PAD + n.y * CY });
      let svg = `<svg width="${w}" height="${h}">`;
      for (const n of nodes) for (const r of n.req) {
        const p = SW.SKILL_INDEX[r];
        if (!this.visible(p)) continue; const a = pos(p), b = pos(n);
        const owned = save.data.skills.includes(n.id), pOwned = save.data.skills.includes(r);
        const col = owned ? '#5fd38a' : pOwned ? '#ffcf4d' : '#3a465c';
        const x1 = a.x + NW / 2, y1 = a.y + NH, x2 = b.x + NW / 2, y2 = b.y;
        svg += `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" stroke="${col}" stroke-width="${owned ? 3 : 2}" fill="none"/>`;
      }
      svg += '</svg>';
      inner.innerHTML = svg;
      for (const n of nodes) {
        const st = this.nodeState(n);
        const e = el('div', `node ${st}${this.sel === n.id ? ' sel' : ''}`);
        const p = pos(n); e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
        const unlock = n.fx.find(f => f.unlock);
        if (unlock) e.appendChild(icon(unlock.unlock, 0, 30));
        else { const s = el('div', '', this.fxIcon(n)); s.style.cssText = 'font-size:20px;width:30px;text-align:center'; e.appendChild(s); }
        const t = el('div'); t.innerHTML = `<div class="nt">${n.name}</div><div class="nc">${st === 'owned' ? '✔ 보유' : (n.cost ? '💰 ' + fmt(n.cost) : '무료')}${n.stage && st === 'locked' && save.clearedCount() < n.stage ? ' 🔒' : ''}</div>`;
        e.appendChild(t);
        e.onclick = () => { this.sel = n.id; this.render(); };
        inner.appendChild(e);
      }
      view.appendChild(inner);
      if (this._centeredFam !== this.fam) { this._centeredFam = this.fam; view.scrollLeft = Math.max(0, (inner.offsetWidth - view.clientWidth) / 2); }
      if (hidden) view.appendChild(el('div', 'tree-fog', `🌫️ 아직 드러나지 않은 노드 ${hidden}개 · 노드를 습득하면 다음 단계가 나타납니다`));
      this.renderDetail();
    },
    fxIcon(n) {
      const f = n.fx[0];
      if (f.popBonus) return '👥'; if (f.goldBonus) return '💰';
      if (f.patch) return '✨';
      return { hp: '❤️', dmg: '⚔️', armor: '🛡️', speed: '👟', range: '🎯', atkCd: '⚡', splash: '💥', heal: '💚', lifesteal: '🩸', taunt: '📢', 'aura.radius': '📯' }[f.stat] || '⬆️';
    },
    renderDetail() {
      const d = $('#tree-detail'); d.innerHTML = '';
      const F = SW.FAMILIES[this.fam];
      const head = el('div', 'fam-head');
      head.appendChild(icon(SW.SKILL_TREES[this.fam][0].fx[0].unlock, 0, 40));
      head.appendChild(el('div', '', `<b>${F.name} · ${F.title}</b><div class="muted" style="font-size:12px">${F.desc}</div>`));
      d.appendChild(head);
      const n = this.sel && SW.SKILL_INDEX[this.sel];
      if (!n || !this.visible(n)) { d.appendChild(el('p', 'muted', '노드를 선택하면 자세한 정보가 표시됩니다.<br><br>🟩 보유 · 🟨 구매 가능 · ⬛ 잠김')); return; }
      const st = this.nodeState(n);
      d.appendChild(el('h3', '', n.name));
      if (n.desc) d.appendChild(el('div', 'muted', n.desc));
      const ul = el('ul'); for (const f of n.fx) ul.appendChild(el('li', '', SW.describeFx(f))); d.appendChild(ul);
      const unlock = n.fx.find(f => f.unlock);
      if (unlock) d.appendChild(unitCard(unlock.unlock, save.mods()));
      const req = el('div', 'req');
      if (n.req.length) req.innerHTML += '필요: ' + n.req.map(r => `<span class="${save.data.skills.includes(r) ? '' : 'bad'}">${SW.SKILL_INDEX[r].name}</span>`).join(', ') + '<br>';
      if (n.stage) req.innerHTML += `<span class="${save.clearedCount() >= n.stage ? '' : 'bad'}">스테이지 ${n.stage}개 클리어 필요 (현재 ${save.clearedCount()})</span>`;
      d.appendChild(req);
      if (st === 'owned') d.appendChild(el('div', '', '<b style="color:var(--green)">✔ 보유 중</b>'));
      else {
        const b = el('button', 'btn primary', `구매 (💰 ${fmt(n.cost)})`);
        b.style.width = '100%'; b.style.marginTop = '8px';
        b.disabled = st !== 'avail';
        b.onclick = () => {
          save.data.gold -= n.cost; save.data.spent = (save.data.spent || 0) + n.cost;
          save.data.skills.push(n.id); save.write(); updateGold();
          toast(`${n.name} 습득!`); this.render();
        };
        d.appendChild(b);
      }
    },
  };
  $('#tree-back').onclick = () => go(treeReturn === 'battle' ? (Battle.mode === 'raid' ? 'raids' : 'stages') : treeReturn);
  $('#tree-reset').onclick = () => {
    if (!confirm('모든 스킬을 초기화하고 사용한 골드를 돌려받을까요?')) return;
    let refund = 0;
    for (const id of save.data.skills) refund += SW.SKILL_INDEX[id].cost;
    save.data.gold += refund; save.data.spent = 0;
    save.data.skills = ['c_root', 't_root']; save.write(); updateGold(); Tree.render();
    toast(`💰 ${fmt(refund)} 환불`);
  };

  // ───────── 유닛 카드 / 도감 ─────────
  function statsHTML(d) {
    const rows = [['체력', fmt(d.hp)], ['방어', +d.armor.toFixed(1)], ['공격', d.attack === 'heal' ? '치유 ' + fmt(d.heal) : +d.dmg.toFixed(1)], ['주기', d.atkCd.toFixed(2) + 's'],
      ['사거리', d.range > 40 ? Math.round(d.range) : '근접'], ['속도', Math.round(d.speed)], ['인원', d.pop], ['DPS', d.attack === 'heal' ? '-' : (d.dmg / d.atkCd).toFixed(1)]];
    return '<div class="stats">' + rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('') + '</div>';
  }
  function skillHTML(d) {
    const a = d.ability || (d.skill && SW.ABILITIES[d.skill]);
    if (!a) return '';
    return `<div class="skill"><b>${a.kind === 'ultimate' ? '★ ' : ''}${a.name}</b> <span class="muted">${SW.SKILL_KIND_NAMES[a.kind]} · ${a.cd}초</span><div>${a.desc}</div></div>`;
  }
  function unitCard(type, mods, locked) {
    const d = SW.resolveDef(type, mods);
    const c = el('div', 'card' + (locked ? ' locked' : ''));
    const cv = el('canvas'); c.appendChild(cv); requestAnimationFrame(() => SW.drawUnitIcon(cv, type, d.boss ? 1 : 0));
    const b = el('div');
    b.innerHTML = `<div class="cn">${d.name} ${locked ? '🔒' : ''} <span class="role">${SW.ROLE_NAMES[d.role] || ''}</span></div><div class="cd">${d.desc}</div>${statsHTML(d)}${skillHTML(d)}<div class="tags">${SW.unitTraits(d).map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
    c.appendChild(b);
    return c;
  }
  function renderCodex() {
    const list = $('#codex-list'); list.innerHTML = '';
    const mods = save.mods();
    let total = 0, have = 0;
    for (const f of SW.FAMILY_ORDER) {
      const F = SW.FAMILIES[f];
      list.appendChild(el('h3', '', `${F.name} · ${F.title} <small>${F.desc}</small>`));
      const cards = el('div', 'cards');
      for (const u of SW.unitList(true).filter(u => u.family === f)) {
        const locked = !u.summonOnly && !mods.unlocks.has(u.id);
        if (!u.summonOnly) { total++; if (!locked) have++; }
        cards.appendChild(unitCard(u.id, mods, locked));
      }
      list.appendChild(cards);
    }
    list.appendChild(el('h3', '', `💀 보스 <small>보스 레이드와 샌드박스에서 만날 수 있다.</small>`));
    const cards = el('div', 'cards');
    for (const id of Object.keys(SW.BOSS_UNITS)) if (SW.UNITS[id].bossData) cards.appendChild(unitCard(id, null, false));
    list.appendChild(cards);
    list.appendChild(el('h3', '', '🔗 협동 · 속성 상성'));
    list.appendChild(el('div', 'help-inline', `<ul>
      <li><b>방어벽 + 집중 사격</b>: 방패병의 방어벽 안에 있는 궁수의 집중 사격이 1.6배.</li>
      <li><b>도발 + 마법</b>: 수호병의 도발에 걸린 적은 마법 피해를 25% 더 받는다.</li>
      <li><b>기절·넉백 + 검사</b>: 기절하거나 밀려난 적에게 검사의 후속 공격 +35%.</li>
      <li><b>방진 + 광역 치유</b>: 방진 진형에서 치유사의 광역 치유 +30%.</li>
      <li><b>냉기 + 돌진</b>: 둔화·빙결된 적에게 돌진 피해 1.5배. <b>냉기 + 번개</b>: 빙결된 적에게 번개 1.5배(감전).</li>
      <li><b>독 + 암살</b>: 중독된 적에게 암살자 계열 1.5배, 처형 기준 50%. 독은 회복량을 절반으로 줄인다.</li>
      <li><b>빛 보호막</b>은 화염 피해를 절반만 받는다. <b>어둠</b> 공격은 흡혈하고 적의 공격력을 20% 낮춘다.</li>
      <li><b>측면·후방 공격</b>은 피해 +25% (원형 진형은 면역).</li></ul>`));
    $('#codex-count').textContent = `해금 ${have}/${total} (소환물 제외) · 스탯은 현재 스킬 트리 적용 수치`;
  }

  // ───────── 보스 레이드 ─────────
  function renderRaids() {
    const g = $('#raid-grid'); g.innerHTML = '';
    const mods = save.mods();
    SW.RAIDS.forEach((r) => {
      const d = SW.UNITS[r.boss], ok = save.clearedCount() >= r.need, cleared = save.data.raids[r.boss];
      const c = el('div', 'stage raid' + (ok ? '' : ' locked') + (cleared ? ' cleared' : ''));
      c.style.setProperty('--boss', d.bossData.color);
      c.innerHTML = `<div class="num">BOSS RAID</div><div class="nm">${d.name}</div><div class="raid-title">${d.bossData.title}</div>
        <div class="meta"><span>👤 인원 ${r.pop + mods.popBonus}</span><span>💰 ${cleared ? Math.round(r.reward * 0.3) : r.reward}</span><span>❤️ ${fmt(d.hp)}</span></div>
        <div class="cd">${ok ? r.hint : `🔒 챌린지 스테이지 ${r.need}개 클리어 필요 (현재 ${save.clearedCount()})`}</div>`;
      const ic = el('div', 'icons'); const sp0 = el('span'); sp0.appendChild(icon(r.boss, 1, 30)); ic.appendChild(sp0);
      for (const [u, n] of r.escorts) { const sp = el('span'); sp.appendChild(icon(u, 1, 22)); sp.append('×' + n); ic.appendChild(sp); }
      c.appendChild(ic);
      if (cleared) c.appendChild(el('div', 'badge', '✔ 격파'));
      if (ok) c.onclick = () => { Battle.open('raid', r); go('battle'); };
      g.appendChild(c);
    });
  }

  // ───────── 설정 ─────────
  const settings = () => save.data.settings;
  $('#btn-settings').onclick = () => {
    $('#set-quality').value = settings().quality; $('#set-auras').checked = settings().auras; $('#set-fps').checked = settings().fps;
    $('#settings').hidden = false;
  };
  $('#set-close').onclick = () => {
    settings().quality = $('#set-quality').value; settings().auras = $('#set-auras').checked; settings().fps = $('#set-fps').checked;
    save.write(); $('#settings').hidden = true;
  };
  const isCoarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function autoQuality(n) {
    const q = settings().quality;
    if (q !== 'auto') return q;
    const lim = isCoarse() ? [150, 450] : [350, 900];
    return n > lim[1] ? 'low' : n > lim[0] ? 'medium' : 'high';
  }

  // ───────── 전투 화면 ─────────
  const MODE_NAMES = { challenge: '챌린지', sandbox: '샌드박스', raid: '보스 레이드', survival: '생존 모드' };
  const Battle = {
    mode: 'sandbox', stage: null, raid: null, b: null, phase: 'deploy', sel: 'soldier', brush: 1, tool: 'place', team: 0,
    speed: 1, snapshot: null, acc: 0, hover: null, selected: null, mouse: null, useMods: false, map: '1600x900', forms: ['free', 'free'],

    init() {
      this.canvas = $('#battle-canvas');
      this.r = new SW.Renderer(this.canvas);
      const c = this.canvas;
      c.addEventListener('contextmenu', e => e.preventDefault());
      this.touches = new Map();
      c.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (!this.pinchCheck()) this.pointer(e, 'down'); });
      c.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
          const prev = this.touches.get(e.pointerId);
          if (this.pinch) {
            const pts = [...this.touches.values()];
            const oldMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            const oldD = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            prev.x = e.clientX; prev.y = e.clientY;
            const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            this.r.pan(mid.x - oldMid.x, mid.y - oldMid.y);
            this.r.zoomAt(mid.x, mid.y, d / oldD);
            return;
          }
          prev.x = e.clientX; prev.y = e.clientY;
        }
        this.pointer(e, 'move');
      });
      const up = (e) => {
        // 전투 중 짧은 클릭/탭 = 유닛 선택
        if (this.panning && this.panning.click && Math.hypot(e.clientX - this.panning.sx, e.clientY - this.panning.sy) < 6) this.selectAt(e.clientX, e.clientY);
        this.drag = null; this.panning = null;
        if (e.pointerType === 'touch') { this.touches.delete(e.pointerId); if (this.touches.size < 2) this.pinch = false; this.mouse = null; this.hover = null; }
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      $('#z-info').onclick = () => document.body.classList.toggle('show-info');
      $('#b-info').onclick = (e) => { if (e.target.closest('button')) return; document.body.classList.remove('show-info'); };
      c.addEventListener('wheel', e => { e.preventDefault(); this.r.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
      const zc = () => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      $('#z-in').onclick = () => this.r.zoomAt(...zc(), 1.4);
      $('#z-out').onclick = () => this.r.zoomAt(...zc(), 1 / 1.4);
      $('#z-fit').onclick = () => this.r.resetView();
      c.addEventListener('pointerleave', () => { this.mouse = null; this.hover = null; });
      $('#b-start').onclick = () => this.start();
      $('#b-pause').onclick = () => this.togglePause();
      $('#b-reset').onclick = () => this.resetDeploy();
      $('#b-clear').onclick = () => this.clearAll();
      $('#b-back').onclick = () => go({ challenge: 'stages', raid: 'raids' }[this.mode] || 'menu');
      $$('#b-speed button').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.sp));
      $$('#brush-seg button').forEach(b => b.onclick = () => { this.brush = +b.dataset.b; segOn('#brush-seg', b); });
      $$('#tool-seg button').forEach(b => b.onclick = () => { this.tool = b.dataset.tool; segOn('#tool-seg', b); });
      $$('#sb-team button').forEach(b => b.onclick = () => { this.team = +b.dataset.team; segOn('#sb-team', b); this.renderPalette(); this.syncForm(); });
      $('#sb-mirror').onclick = () => this.mirror();
      $('#sb-random').onclick = () => this.randomArmy(this.team, Math.round(this.worldSize().W / 1600 * 80));
      $('#sb-war').onclick = () => this.massWar();
      $('#sb-map').onchange = (e) => { this.map = e.target.value; this.snapshot = []; this.rebuild(); this.r.resetView(); };
      $('#sb-mods').onchange = (e) => { this.useMods = e.target.checked; this.rebuild(); };
      const fs = $('#form-sel');
      for (const id of SW.FORMATION_ORDER) { const f = SW.FORMATIONS[id]; const o = el('option'); o.value = id; o.textContent = `${f.icon} 진형: ${f.name}`; fs.appendChild(o); }
      fs.onchange = () => { this.forms[this.team] = fs.value; this.formChanged(); };
      $('#form-apply').onclick = () => this.applyFormation();
      window.addEventListener('keydown', e => {
        if (current !== 'battle' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') { e.preventDefault(); this.phase === 'deploy' ? this.start() : this.togglePause(); }
        if (e.key === 'r' || e.key === 'R') this.resetDeploy();
        if (['1', '2', '3', '4'].includes(e.key)) this.setSpeed([0.5, 1, 2, 4][+e.key - 1]);
      });
      const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    get player() { return this.mode !== 'sandbox'; },
    deployKey() { return this.mode === 'challenge' ? this.stage.id : this.mode === 'raid' ? 'raid_' + this.raid.boss : this.mode === 'survival' ? 'survival' : this.mode === 'scenario' ? (this.sc.key || null) : null; },
    worldSize() {
      if (this.mode === 'scenario') return { W: this.sc.W || 1600, H: this.sc.H || 900 };
      if (this.mode !== 'sandbox') return { W: 1600, H: 900 };
      const [W, H] = this.map.split('x').map(Number); return { W, H };
    },

    open(mode, ctx) {
      this.mode = mode; this.phase = 'deploy'; this.selected = null; this.replayView = null; this.pick = null; this.selSquad = null;
      this.sc = mode === 'scenario' ? ctx : null;
      if (mode !== 'scenario' && mode !== this.lastMode) this.squadDefs = [];
      this.stage = mode === 'challenge' ? ctx : null; this.raid = mode === 'raid' ? ctx : null;
      this.r.resetView(); this.portraitView = true;
      $('#b-result').hidden = true;
      $('#sb-tools').style.display = mode === 'sandbox' ? '' : 'none';
      $$('.sb-only').forEach(e => e.style.display = mode === 'sandbox' ? '' : 'none');
      if (mode !== 'sandbox' && this.brush > 25) { this.brush = 1; segOn('#brush-seg', $('#brush-seg [data-b="1"]')); }
      $('#b-clear-lbl').textContent = mode === 'sandbox' ? ' 모두 지우기' : ' 내 유닛 지우기';
      this.mods = save.mods();
      document.body.classList.toggle('mode-scenario', mode === 'scenario');
      document.body.classList.toggle('mode-sandbox', mode === 'sandbox');
      if (mode === 'scenario') {
        const sc = ctx; this.team = 0;
        $('#b-name').textContent = sc.title; $('#b-sub').textContent = sc.sub || '';
        this.popLimit = sc.pop || Infinity;
        this.mods = sc.mods ? sc.mods[0] : this.mods;
        this.forms = [...(sc.formations || ['free', 'free'])];
        const key = this.deployKey();
        const saved = key && sc.restoreDeploy !== false ? (save.data.deploys[key] || []).filter(u => !sc.allowed || sc.allowed.includes(u.type)) : [];
        this.snapshot = [...sc.units, ...(saved.length && !sc.units.some(u => u.team === 0) ? saved : [])];
        this.squadDefs = (sc.squads || []).map(q => ({ ...q }));
        const pal = this.paletteUnits();
        if (pal.length && !pal.includes(this.sel)) this.sel = pal[0];
      } else if (this.player) {
        this.team = 0;
        const key = this.deployKey();
        const saved = (save.data.deploys[key] || []).filter(u => this.mods.unlocks.has(u.type));
        this.forms = [save.data.forms[key] || 'free', 'free'];
        let enemies = [];
        if (mode === 'challenge') {
          $('#b-name').textContent = `STAGE ${ctx.index + 1}. ${ctx.name}`; $('#b-sub').textContent = ctx.hint;
          this.popLimit = ctx.pop + this.mods.popBonus; enemies = SW.stageDeployment(ctx); this.forms[1] = ctx.formation || 'free';
        } else if (mode === 'raid') {
          const d = SW.UNITS[ctx.boss];
          $('#b-name').textContent = `💀 ${d.name}`; $('#b-sub').textContent = ctx.hint;
          this.popLimit = ctx.pop + this.mods.popBonus;
          enemies = [{ type: ctx.boss, team: 1, x: 1330, y: 450 }, ...SW.stageDeployment({ enemies: ctx.escorts })];
        } else {
          $('#b-name').textContent = '🌊 생존 모드'; $('#b-sub').textContent = `끝없는 적 웨이브를 버텨라 · 최고 기록 ${save.data.survivalBest}웨이브`;
          this.popLimit = SW.SURVIVAL.pop + this.mods.popBonus;
        }
        this.snapshot = [...enemies, ...saved];
        if (!this.mods.unlocks.has(this.sel)) this.sel = 'soldier';
      } else {
        $('#b-name').textContent = '샌드박스'; $('#b-sub').textContent = '자유롭게 배치하고 싸움을 지켜보세요 · 대규모 전쟁 지원';
        if (this.lastMode !== 'sandbox') this.snapshot = [];
        if (SW.UNITS[this.sel].boss && !SW.UNITS[this.sel].bossData) this.sel = 'soldier';
      }
      this.lastMode = mode;
      this.rebuild();
      this.renderPalette();
      this.syncForm();
      this.setSpeed(this.speed);
      this.showInfo(this.sel);
    },
    close() { this.saveDeploy(); },

    newBattle() {
      const { W, H } = this.worldSize();
      if (this.mode === 'scenario') {
        const sc = this.sc;
        return new SW.Battle({ W, H, mods: sc.mods || [this.mods, null], buffs: sc.buffs || [null, null], timeLimit: sc.timeLimit || 600, formations: this.forms,
          terrain: sc.terrain ? SW.Terrain.from(sc.terrain) : null, weather: sc.weather, time: sc.time, morale: !!sc.morale, victory: sc.victory, points: sc.points,
          moraleBonus: sc.moraleBonus, endless: !!sc.endless });
      }
      if (this.mode === 'sandbox' && this.rules) {
        const R = this.rules;
        return new SW.Battle({ W, H, mods: [this.useMods ? save.mods() : null, null], timeLimit: R.timeLimit || 900, formations: this.forms,
          terrain: this.baseTerrain ? SW.Terrain.from(this.baseTerrain.serialize()) : null, weather: R.weather, time: R.time, morale: R.morale,
          victory: { type: R.victory || 'annihilate', scoreWin: 100 }, points: R.points, statMul: R.statMul });
      }
      const mods = this.player ? [this.mods, null] : [this.useMods ? save.mods() : null, null];
      const buffs = this.mode === 'challenge' ? [null, this.stage.buff] : [null, null];
      const timeLimit = { challenge: 180, raid: 300, survival: 1e9, sandbox: 900 }[this.mode];
      return new SW.Battle({ W, H, mods, buffs, timeLimit, formations: this.forms, endless: this.mode === 'survival' });
    },
    rebuild() {
      this.b = this.newBattle();
      this.replayView = null;
      if (this.squadDefs && this.squadDefs.length) { this.b.initSquads(); for (const q of this.squadDefs) this.b.addSquad(q.team, q.name, q.order || 'free'); }
      for (const u of this.snapshot) this.b.spawn(u.type, u.team, u.x, u.y, u.sq !== undefined || u.vip ? { sq: u.sq, vip: u.vip, fixed: u.fixed } : undefined);
      if (this.sc && this.sc.setup) this.sc.setup(this.b);
      if ((this.sc && this.sc.supply) || (this.mode === 'sandbox' && this.rules && this.rules.supply)) { this.b.enableSupply(this.sc ? this.sc.supplyOpts || {} : {}); this.b.enableAmmo(this.sc && this.sc.ammo ? this.sc.ammo : {}); }
      this.phase = 'deploy'; this.acc = 0; this.selected = null;
      $('#b-result').hidden = true;
      this.updateHud();
    },
    takeSnapshot() {
      return this.b.units.map(u => { const o = { type: u.type, team: u.team, x: u.x, y: u.y }; if (u.sq !== undefined) o.sq = u.sq; if (u.vip) o.vip = true; if (u.fixed) o.fixed = true; return o; });
    },
    saveDeploy() {
      const key = this.deployKey();
      if (!key || this.phase !== 'deploy') return;
      save.data.deploys[key] = this.takeSnapshot().filter(u => u.team === 0).map(u => ({ ...u, x: Math.round(u.x), y: Math.round(u.y) }));
      save.data.forms[key] = this.forms[0];
      save.write();
    },

    usedPop() { let s = 0; for (const u of this.b.units) if (u.team === 0) s += u.def.pop; return s; },
    zone(team = this.team) {
      const W = this.b.W;
      if (this.mode === 'scenario') return this.sc.zone || { x0: 0, x1: W * 0.4 };
      if (this.player) return { x0: 0, x1: W * 0.4 };
      return team === 0 ? { x0: 0, x1: W * 0.47 } : { x0: W * 0.53, x1: W };
    },

    // ── 진형 ──
    syncForm() {
      $('#form-sel').value = this.forms[this.team];
      const f = SW.FORMATIONS[this.forms[this.team]];
      $('#form-sel').title = `${f.desc}\n약점: ${f.weak}`;
      const box = $('#form-desc'); if (box) box.textContent = `${f.desc} · 약점: ${f.weak}`;
    },
    formChanged() {
      if (this.phase === 'deploy') this.b.formation[this.team] = this.forms[this.team];
      this.syncForm(); this.saveDeploy();
      const f = SW.FORMATIONS[this.forms[this.team]];
      toast(`${f.icon} ${f.name}: ${f.desc}`);
    },
    applyFormation() {
      if (this.phase !== 'deploy') this.rebuild();
      const units = this.b.units.filter(u => u.team === this.team && !u.def.boss);
      if (!units.length) { toast('정렬할 유닛이 없습니다'); return; }
      SW.arrangeFormation(units, this.forms[this.team] === 'free' ? 'line' : this.forms[this.team], this.team === 0 ? 1 : -1, this.zone(), this.b.H);
      this.snapshot = this.takeSnapshot(); this.saveDeploy(); this.updateHud();
    },

    start() {
      if (this.phase !== 'deploy') return;
      const blue = this.b.units.some(u => u.team === 0), red = this.b.units.some(u => u.team === 1);
      if (!blue) { toast('유닛을 배치하세요!'); return; }
      if (!red && this.mode !== 'survival' && !(this.sc && this.sc.allowEmptyEnemy)) { toast('양쪽 팀 모두 유닛이 필요합니다'); return; }
      if (this.player && this.usedPop() > this.popLimit) { toast('인원 제한을 초과했습니다'); return; }
      this.saveDeploy();
      this.snapshot = this.takeSnapshot();
      this.startPop = this.usedPop();
      this.enemyHp0 = this.b.units.filter(u => u.team === 1).reduce((t, u) => t + u.maxHp, 0);
      this.b.formation = [...this.forms];
      if (this.mode === 'survival') SW.setupSurvival(this.b);
      if (this.sc && this.sc.onStart) this.sc.onStart(this.b);
      if (this.sc && this.sc.ai) this.sc.ai.forEach((p, t) => { if (p) this.b.addAI(t, p); });
      if (this.sc && this.sc.frontline) this.b.enableFrontline();
      if (this.b.units.length < 4000) SW.Recorder.attach(this.b);
      this.b.start();
      this.phase = 'fight'; this.acc = 0;
      if (this.r.zoom > 1) this.r.camX = this.b.W / 2;
      this.updateHud();
    },
    togglePause() {
      if (this.phase !== 'fight') return;
      if (this.b.state === 'PAUSED') this.b.resume(); else this.b.pause();
      this.updateHud();
    },
    resetDeploy() {
      if (this.sc && this.sc.noRetry && this.phase !== 'deploy') return;      // 세계 전투: 다시 싸우기 불가
      if (this.phase !== 'deploy') this.rebuild();
    },
    clearAll() {
      if (this.phase !== 'deploy') this.rebuild();
      if (this.player) this.b.units = this.b.units.filter(u => u.team === 1);
      else this.b.units = [];
      this.snapshot = this.takeSnapshot();
      this.saveDeploy(); this.updateHud();
    },
    setSpeed(s) { this.speed = s; $$('#b-speed button').forEach(b => b.classList.toggle('on', +b.dataset.sp === s)); },

    mirror() {
      if (this.phase !== 'deploy') this.rebuild();
      this.b.units = this.b.units.filter(u => u.team === 0);
      for (const u of [...this.b.units]) this.b.spawn(u.type, 1, this.b.W - u.x, u.y);
      this.forms[1] = this.forms[0]; this.b.formation[1] = this.forms[0];
      this.snapshot = this.takeSnapshot(); this.updateHud();
    },
    randomArmy(team, budget) {
      if (this.phase !== 'deploy') this.rebuild();
      this.b.units = this.b.units.filter(u => u.team !== team);
      const pool = SW.unitList().map(u => u.id);
      const z = this.zone(team), W = this.b.W, H = this.b.H;
      this.hashStart();
      let guard = 0;
      while (budget > 0 && guard++ < 400) {
        const type = pool[(Math.random() * pool.length) | 0], d = SW.UNITS[type];
        if (d.pop > budget) { if (budget < 3) break; continue; }
        const n = Math.max(1, Math.min(Math.floor(budget / d.pop), Math.round(12 / d.pop) + 2 + Math.floor(budget / 120)));
        const ranged = d.range > 40 || d.support;
        const depth = z.x1 - z.x0;
        const fx = ranged ? 0.25 + Math.random() * 0.3 : 0.6 + Math.random() * 0.35;
        const cx = team === 0 ? z.x0 + depth * fx : z.x1 - depth * fx;
        const cy = 60 + Math.random() * (H - 120);
        budget -= this.placeCluster(type, team, cx, cy, n, true) * d.pop || 1;
      }
      this.hashEnd();
      this.snapshot = this.takeSnapshot(); this.updateHud();
    },
    massWar() {
      const W = this.b.W;
      const budget = W >= 3200 ? 1000 : W >= 2400 ? 520 : 240;
      this.randomArmy(0, budget); this.randomArmy(1, budget);
      toast(`⚔ 대규모 전쟁: 유닛 ${this.b.units.length}기`);
    },

    // 배치 겹침 검사용 임시 공간 해시
    hashStart() { this.hash = new Map(); for (const u of this.b.units) this.hashAdd(u); },
    hashAdd(u) { if (!this.hash) return; const k = ((u.x / 40) | 0) + ((u.y / 40) | 0) * 4096; let a = this.hash.get(k); if (!a) this.hash.set(k, a = []); a.push(u); },
    hashEnd() { this.hash = null; },
    canPlace(type, team, x, y) {
      const d = SW.UNITS[type], z = this.zone(team);
      if (this.player && (x < z.x0 + d.size || x > z.x1 - d.size)) return false;
      if (x < d.size || x > this.b.W - d.size || y < d.size || y > this.b.H - d.size) return false;
      const check = (o) => {
        if (!!o.def.flying !== !!d.flying) return true;
        const rr = o.r + d.size + 1;
        return (o.x - x) ** 2 + (o.y - y) ** 2 >= rr * rr;
      };
      if (this.hash) {
        const gx = (x / 40) | 0, gy = (y / 40) | 0;
        for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) { const a = this.hash.get(i + j * 4096); if (a) for (const o of a) if (!check(o)) return false; }
        return true;
      }
      for (const o of this.b.units) if (!check(o)) return false;
      return true;
    },
    placeCluster(type, team, cx, cy, n, silent) {
      const d = SW.UNITS[type], gap = d.size * 2 + 3;
      const side = Math.ceil(Math.sqrt(n)) + 3;
      const pts = [];
      for (let i = -side; i <= side; i++) for (let j = -side; j <= side; j++) pts.push([i, j, i * i + j * j]);
      pts.sort((a, b) => a[2] - b[2]);
      let placed = 0, used = this.player ? this.usedPop() : 0;
      const own = !this.hash && n > 3; if (own) this.hashStart();
      for (const [i, j] of pts) {
        if (placed >= n) break;
        if (this.player && used + d.pop > this.popLimit) { if (!silent) toast('인원 제한에 도달했습니다'); break; }
        const x = cx + i * gap, y = cy + j * gap;
        if (this.canPlace(type, team, x, y)) { const u = this.b.spawn(type, team, x, y); this.hashAdd(u); placed++; used += d.pop; }
      }
      if (own) this.hashEnd();
      return placed;
    },
    eraseAt(x, y) {
      const r = 10 + Math.sqrt(this.brush) * 12;
      this.b.units = this.b.units.filter(u => {
        if (this.player && u.team !== 0) return true;
        return (u.x - x) ** 2 + (u.y - y) ** 2 > (r + u.r) ** 2;
      });
    },
    unitAt(x, y) {
      let best = null, bd = 900;
      for (const u of this.b.units) { const dd = (u.x - x) ** 2 + (u.y - y) ** 2; if (dd < bd && dd < (u.r + 8) ** 2) { bd = dd; best = u; } }
      return best;
    },
    selectAt(cx, cy) {
      const p = this.r.toWorld(cx, cy);
      const u = this.unitAt(p.x, p.y);
      this.selected = u;
      if (u) { this.showInfo(u.type, u); if (isCoarse()) document.body.classList.add('show-info'); }
    },

    pinchCheck() {
      if (this.touches.size >= 2) { this.pinch = true; this.drag = null; this.panning = null; this.mouse = null; return true; }
      return this.pinch;
    },

    pointer(e, kind) {
      if (kind === 'down' && this.pick && e.button === 0) { const pw = this.r.toWorld(e.clientX, e.clientY); SW.cmdUI.pointerHook(e, kind, pw); return; }
      if (kind === 'down' && (e.button === 1 || this.tool === 'pan' || (this.phase !== 'deploy' && e.button === 0))) {
        e.preventDefault();
        this.panning = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, click: this.phase !== 'deploy' || this.tool === 'pan' };
        this.canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      if (this.panning) {
        if (e.buttons === 0) { this.panning = null; }
        else { this.r.pan(e.clientX - this.panning.x, e.clientY - this.panning.y); this.panning.x = e.clientX; this.panning.y = e.clientY; return; }
      }
      const p = this.r.toWorld(e.clientX, e.clientY);
      this.mouse = p;
      if (SW.cmdUI && SW.cmdUI.pointerHook(e, kind, p)) return;
      if (kind === 'down') {
        this.canvas.setPointerCapture?.(e.pointerId);
        this.drag = { erase: e.button === 2 || this.tool === 'erase', last: null };
      }
      const best = this.unitAt(p.x, p.y);
      this.hover = best;
      if (best && !this.drag && !this.selected) this.showInfo(best.type, best);
      if (!this.drag || this.phase !== 'deploy') return;
      if (kind === 'move' && e.buttons === 0) { this.drag = null; return; }
      if (this.drag.erase) { this.eraseAt(p.x, p.y); this.snapshot = this.takeSnapshot(); this.updateHud(); return; }
      const d = SW.UNITS[this.sel];
      const minStep = (d.size * 2 + 3) * (this.brush > 1 ? Math.sqrt(this.brush) : 1);
      if (this.drag.last && Math.hypot(p.x - this.drag.last.x, p.y - this.drag.last.y) < minStep) return;
      if (this.player && !this.mods.unlocks.has(this.sel)) return;
      const n = this.placeCluster(this.sel, this.team, p.x, p.y, this.brush);
      if (n || !this.drag.last) this.drag.last = p;
      this.snapshot = this.takeSnapshot();
      this.updateHud();
    },

    paletteUnits() {
      const sc = this.sc; if (!sc) return [];
      if (sc.palette === 'none') return [];
      let ids = sc.allowed || (sc.palette === 'all' ? SW.unitList().filter(u => !u.custom).map(u => u.id) : SW.unitList().filter(u => this.mods.unlocks.has(u.id)).map(u => u.id));
      if (sc.extraUnits) ids = [...ids, ...sc.extraUnits.filter(x => !ids.includes(x))];
      return ids;
    },
    renderPalette() {
      const list = $('#palette-list'); list.innerHTML = '';
      const ch = this.player;
      if (this.mode === 'scenario') {
        const ids = this.paletteUnits();
        if (!ids.length) { list.appendChild(el('div', 'pal-msg', this.sc.palette === 'none' && this.sc.lockMsg ? this.sc.lockMsg : '이 모드에서는 유닛을 추가할 수 없습니다. 유닛을 드래그해 위치만 바꿀 수 있습니다.')); return; }
        const addU = (u) => {
          const b = el('div', 'pu' + (this.sel === u.id ? ' on' : ''));
          b.appendChild(icon(u.id, 0, 26)); b.appendChild(el('span', 'pn', u.name)); b.appendChild(el('span', 'pp', u.pop ? '👤' + u.pop : '-'));
          b.onclick = () => { this.sel = u.id; this.renderPalette(); this.showInfo(u.id); if (this.tool !== 'place') { this.tool = 'place'; segOn('#tool-seg', $('#tool-seg [data-tool=place]')); } };
          b.onmouseenter = () => { if (!this.selected) this.showInfo(u.id); };
          list.appendChild(b);
        };
        for (const f of [...SW.FAMILY_ORDER, 'structure']) {
          const us = ids.map(id => SW.UNITS[id]).filter(u => u && u.family === f);
          if (!us.length) continue;
          list.appendChild(el('div', 'fam', `${SW.FAMILIES[f].name} · ${SW.FAMILIES[f].title}`));
          us.forEach(addU);
        }
        return;
      }
      const addUnit = (u, locked) => {
        const b = el('div', 'pu' + (this.sel === u.id ? ' on' : '') + (locked ? ' locked' : ''));
        b.appendChild(icon(u.id, this.team, 26));
        b.appendChild(el('span', 'pn', u.name + (locked ? ' 🔒' : '')));
        b.appendChild(el('span', 'pp', u.boss ? '보스' : u.pop ? '👤' + u.pop : '소환'));
        b.onclick = () => {
          if (locked) { toast('스킬 트리에서 해금하세요'); this.showInfo(u.id); return; }
          this.sel = u.id; this.renderPalette(); this.showInfo(u.id);
          if (this.tool !== 'place') { this.tool = 'place'; segOn('#tool-seg', $('#tool-seg [data-tool=place]')); }
        };
        b.onmouseenter = () => { if (!this.selected) this.showInfo(u.id); };
        list.appendChild(b);
      };
      for (const f of SW.FAMILY_ORDER) {
        const units = SW.unitList(!ch).filter(u => u.family === f && !u.custom && !(u.summonOnly && (u.structure || u.commander)));
        if (ch && !units.some(u => this.mods.unlocks.has(u.id)) && !save.data.skills.includes(SW.SKILL_TREES[f][0].id)) {
          list.appendChild(el('div', 'fam', `${SW.FAMILIES[f].name} · ${SW.FAMILIES[f].title} 🔒`));
          continue;
        }
        list.appendChild(el('div', 'fam', `${SW.FAMILIES[f].name} · ${SW.FAMILIES[f].title}`));
        for (const u of units) addUnit(u, ch && !this.mods.unlocks.has(u.id));
      }
      if (!ch) {
        list.appendChild(el('div', 'fam', '🏰 구조물 · 지휘관'));
        for (const id of ['commander', 'wall', 'gate', 'tower', 'keep']) addUnit(SW.UNITS[id], false);
        const cus = Object.keys(SW.UNITS).filter(k => SW.UNITS[k].custom);
        if (cus.length) { list.appendChild(el('div', 'fam', '🛠 커스텀 유닛')); for (const id of cus) addUnit(SW.UNITS[id], false); }
        list.appendChild(el('div', 'fam', '💀 보스'));
        for (const id of Object.keys(SW.BOSS_UNITS)) if (SW.UNITS[id].bossData) addUnit(SW.UNITS[id], false);
      }
    },

    showInfo(type, inst) {
      const key = type + (inst ? inst.uid : '');
      if (this._infoKey === key && !inst) return;
      this._infoKey = key;
      const team = inst ? inst.team : this.team;
      const d = inst ? inst.def : this.b.def(type, team);
      const box = $('#b-info'); box.innerHTML = '';
      const h = el('h3'); h.appendChild(icon(type, team, 34)); h.append(d.name); box.appendChild(h);
      const el0 = d.element ? ` · ${SW.ELEMENTS[d.element].icon}${SW.ELEMENTS[d.element].name}` : '';
      box.appendChild(el('div', 'muted', `${SW.FAMILIES[d.family].name} · ${SW.ROLE_NAMES[d.role] || ''}${el0}${inst ? (inst.team ? ' · 빨간 팀' : ' · 파란 팀') : ''}`));
      if (inst) {
        this.infoInst = inst;
        const ai = SW.AI_STATE_NAMES[inst.alive ? inst.ai.state : 'dead'] || inst.ai.state;
        box.appendChild(el('div', 'hpbar', `<div style="width:${Math.max(0, inst.hp / inst.maxHp * 100)}%"></div>`));
        box.appendChild(el('div', 'muted', `HP ${fmt(Math.max(0, inst.hp))} / ${fmt(inst.maxHp)}${inst.shield > 0 ? ' (+🛡' + fmt(inst.shield) + ')' : ''} · 🧠 ${ai}`));
        const st = [];
        if (inst.burn > 0) st.push('🔥화상'); if (inst.poisonStacks > 0) st.push(`☠️독×${inst.poisonStacks}`); if (inst.slowAmt > 0) st.push('❄️둔화');
        if (inst.freeze > 0) st.push('🧊빙결'); if (inst.stun > 0) st.push('💫기절'); if (inst.weakT > 0) st.push('🌑약화'); if (inst.markT > 0) st.push('🎯표식');
        if (inst.tauntT > 0) st.push('📢도발됨'); if (inst.stealthed) st.push('👻은신'); if (inst.buff.atkSpd > 0) st.push('⚡가속'); if (inst.buff.dmg > 0) st.push('⚔️강화');
        if (st.length) box.appendChild(el('div', 'tags', st.map(t => `<span class="tag">${t}</span>`).join('')));
      } else this.infoInst = null;
      box.appendChild(el('div', 'desc', d.desc));
      const crit = d.crit ? Math.round((d.crit.chance + (inst ? inst.buff.crit : 0)) * 100) : 0;
      const rows = [['HP', fmt(d.hp)], ['ATK', d.attack === 'heal' ? '치유 ' + fmt(d.heal) : +d.dmg.toFixed(1)], ['DEF', +d.armor.toFixed(1)], ['SPD', Math.round(d.speed)],
        ['Range', d.range > 40 ? Math.round(d.range) : '근접'], ['ASPD', (1 / d.atkCd).toFixed(2) + '/s'], ['Crit', crit + '%'], ['인원', d.pop],
        ['피해 유형', { phys: '물리', magic: '마법', true: '고정' }[d.dmgType] || d.dmgType], ['저항', d.resist ? Object.entries(d.resist).map(([k, v]) => SW.ELEMENTS[k].name + ' ' + Math.round(v * 100) + '%').join(', ') : '-']];
      box.insertAdjacentHTML('beforeend', '<div class="stats">' + rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('') + '</div>');
      const a = d.ability;
      if (a) box.insertAdjacentHTML('beforeend', `<div class="skill"><b>${a.kind === 'ultimate' ? '★ ' : ''}${a.name}</b> <span class="muted">${SW.SKILL_KIND_NAMES[a.kind]} · ${a.cd}초${inst ? (inst.skillCd > 0 ? ` · 대기 ${inst.skillCd.toFixed(1)}초` : ' · 준비됨') : ''}</span><div>${a.desc}</div></div>`);
      if (inst && inst.st) box.insertAdjacentHTML('beforeend', `<div class="muted small">가한 피해 ${fmt(inst.st.dealt)} · 처치 ${inst.st.kills} · 치유 ${fmt(inst.st.healed)} · 기술 ${inst.st.casts}회</div>`);
      box.appendChild(el('div', 'tags', SW.unitTraits(d).map(t => `<span class="tag">${t}</span>`).join('')));
    },

    power(team) { let p = 0; for (const u of this.b.units) if (u.team === team) p += Math.sqrt(Math.max(0, u.hp) * (u.def.dmg / u.def.atkCd + 2)); return p; },

    updateHud() {
      const pop = $('#b-pop');
      if (this.player) {
        const used = this.phase === 'deploy' ? this.usedPop() : this.startPop;
        pop.hidden = false; pop.textContent = `👤 ${used}${isFinite(this.popLimit) ? ' / ' + this.popLimit : ' · 제한 없음'}`;
        pop.classList.toggle('over', used > this.popLimit);
      } else pop.hidden = true;
      const cnt = [0, 0]; for (const u of this.b.units) cnt[u.team]++;
      $('#b-count').innerHTML = `<span class="b">${cnt[0]}</span> vs <span class="r">${cnt[1]}</span>`;
      const fighting = this.phase === 'fight';
      $('#b-kills').hidden = this.phase === 'deploy';
      $('#b-kills').innerHTML = `☠ <span class="b">${this.b.stats[0].kills}</span> : <span class="r">${this.b.stats[1].kills}</span>`;
      $('#b-start').hidden = this.phase !== 'deploy';
      $('#b-pause').hidden = !fighting;
      $('#b-pause').textContent = this.b.state === 'PAUSED' ? '▶ 계속' : '⏸ 일시정지';
      $('#b-reset').disabled = this.phase === 'deploy' || !!(this.sc && this.sc.noRetry);
      const t = this.b.time, lim = this.b.timeLimit;
      const pw = [this.power(0), this.power(1)], tot = pw[0] + pw[1] || 1;
      const ft = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
      let timer;
      if (this.phase === 'deploy') timer = `배치 단계 · ${SW.FORMATIONS[this.forms[0]].icon} ${SW.FORMATIONS[this.forms[0]].name}${this.player ? '' : ` vs ${SW.FORMATIONS[this.forms[1]].icon} ${SW.FORMATIONS[this.forms[1]].name}`}`;
      else if (this.mode === 'survival') timer = `🌊 웨이브 ${this.b.survival ? this.b.survival.wave : 0} · ⏱ ${ft(t)} · 다음 웨이브 ${Math.max(0, Math.ceil(this.b.survival?.timer || 0))}초`;
      else timer = `⏱ ${ft(t)} / ${ft(lim)} · ${this.speed}×`;
      const sup = this.b.supplyOn ? `<div class="supply">🌾 <span class="sb" title="아군 보급"><div style="width:${this.b.supply[0]}%;background:${this.b.supply[0] < 30 ? '#ff7070' : '#ffcf4d'}"></div></span>${Math.round(this.b.supply[0])}% · 적 ${Math.round(this.b.supply[1])}%<span class="sb"><div style="width:${this.b.supply[1]}%;background:#c08a8a"></div></span>${this.b.ammoOn ? ` · 🏹 ${this.b.ammoPct(0)}% / 적 ${this.b.ammoPct(1)}%` : ''}</div>` : '';
      $('#b-timer').innerHTML = `${timer}${sup}${this.phase !== 'deploy' || cnt[1] ? `<div class="power" title="전투력"><div style="width:${pw[0] / tot * 100}%"></div><div style="width:${pw[1] / tot * 100}%"></div></div>` : ''}`;
      let hint = '';
      const touch = isCoarse();
      if (this.phase === 'deploy') hint = touch
        ? (this.player ? '파란 구역을 탭/드래그해 배치 · 진형 선택 후 [정렬]' : '탭해서 배치 · 두 손가락 확대 · ⚔ 대규모 전쟁')
        : (this.player ? '왼쪽 구역에 배치 · 우클릭 제거 · 진형 선택 후 [정렬] · Space 시작' : '좌클릭 배치 · 우클릭 제거 · ⚔ 대규모 전쟁으로 수천 기 전투');
      else if (this.phase === 'fight' && !this.selected) hint = touch ? '유닛을 탭해 상세 정보 보기' : '유닛을 클릭해 상세 정보 · 드래그로 화면 이동';
      $('#b-hint').textContent = hint; $('#b-hint').hidden = !hint;
    },

    frame(t) {
      const dtReal = Math.min(0.05, ((t - (this.lastT || t)) / 1000)); this.lastT = t;
      if (current !== 'battle' || !this.b) return;
      // 리플레이 재생 중
      if (this.replayView) {
        const v = this.replayView; v.tick(dtReal);
        const selU = this.replaySel !== undefined ? v.units.find(u => u.uid === this.replaySel) : null;
        this.r.draw(v, { selected: selU, trail: this.replaySel !== undefined ? v.trail(this.replaySel) : null });
        SW.cmdUI.drawMinimap(v); SW.cmdUI.updateReplayBar();
        return;
      }
      const b = this.b;
      b.quality = autoQuality(b.units.length);
      this.r.showAuras = settings().auras;
      let simMs = 0;
      if (this.phase === 'fight' && b.running) {
        this.acc += dtReal * this.speed;
        let n = 0; const t0 = performance.now();
        // 시뮬레이션은 고정 간격, 렌더링과 분리. 한 프레임에 과도한 스텝은 제한(느린 기기에서는 배속이 자동 감소)
        const maxSteps = b.units.length > 1500 ? 6 : 16;
        while (this.acc >= 1 / 60 && n < maxSteps) { b.step(1 / 60); this.acc -= 1 / 60; n++; if (performance.now() - t0 > 28) break; }
        if (this.acc > 0.25) this.acc = 0.25;
        simMs = performance.now() - t0;
        if (b.over) this.finish();
        this._hudT = (this._hudT || 0) + dtReal;
        if (this._hudT > 0.25) { this._hudT = 0; this.updateHud(); if (this.infoInst) this.showInfo(this.infoInst.type, this.infoInst); }
      }
      if (this.selected && !this.selected.alive && this.phase === 'fight') { /* 사망한 선택 유닛은 정보 유지 */ }
      const ui = { hover: this.hover, selected: this.selected, deploy: this.phase === 'deploy', showForm: this.phase === 'fight', squads: !!b.squads, selSquad: this.selSquad, squadTeam: this.mode === 'sandbox' || (this.sc && this.sc.spectate) ? undefined : 0 };
      if (this.phase === 'deploy') {
        const z = this.zone();
        if (this.player) ui.zones = [{ x0: z.x0, x1: z.x1, color: 'rgba(63,124,255,0.07)', line: 'rgba(63,124,255,0.5)' }];
        if (this.mouse && this.tool !== 'pan') {
          const erase = this.tool === 'erase' || (this.drag && this.drag.erase);
          ui.brush = { x: this.mouse.x, y: this.mouse.y, r: erase ? 10 + Math.sqrt(this.brush) * 12 : SW.UNITS[this.sel].size * (1 + Math.sqrt(this.brush) * 1.1), erase, type: this.sel, team: this.team, valid: !this.player || this.mouse.x < z.x1 };
        }
      }
      // 세로 화면: 배치 구역 위주로 확대 (처음 한 번)
      if (this.portraitView && this.canvas.clientWidth > 0) {
        this.portraitView = false;
        this.r.setWorld(b.W, b.H);
        if (this.canvas.clientHeight > this.canvas.clientWidth * 1.1) {
          this.r.zoom = Math.min(2.2, b.W / 800);
          this.r.camX = this.player ? b.W * 0.27 : b.W / 2; this.r.camY = b.H / 2;
        }
      }
      const r0 = performance.now();
      this.r.draw(b, ui);
      if (SW.cmdUI) SW.cmdUI.afterFrame(b, dtReal);
      if (settings().fps) {
        this._fps = (this._fps || 60) * 0.95 + (dtReal > 0 ? 1 / dtReal : 60) * 0.05;
        $('#b-fps').hidden = false;
        $('#b-fps').textContent = `${Math.round(this._fps)} FPS · 유닛 ${b.units.length} · 시뮬 ${simMs.toFixed(1)}ms · 렌더 ${(performance.now() - r0).toFixed(1)}ms · 품질 ${b.quality}`;
      } else $('#b-fps').hidden = true;
    },

    // ── 전투 결과 분석 ──
    analysis(team) {
      const b = this.b, rec = b.rec[team], S = b.stats[team];
      const types = Object.entries(rec).filter(([t]) => !SW.UNITS[t].summonOnly || rec[t].dealt > 0);
      const totalDealt = types.reduce((s, [, r]) => s + r.dealt, 0) || 1;
      types.sort((a, c) => c[1].dealt - a[1].dealt);
      const alive = {}; for (const u of b.units) if (u.team === team) alive[u.type] = (alive[u.type] || 0) + 1;
      const mvp = types[0];
      const factors = [];
      if (mvp && mvp[1].dealt / totalDealt > 0.3) factors.push([mvp[1].dealt / totalDealt, `${SW.UNITS[mvp[0]].name}의 화력 (전체 피해의 ${Math.round(mvp[1].dealt / totalDealt * 100)}%)`]);
      if (S.healed > S.taken * 0.2) factors.push([S.healed / (S.taken || 1), `지속적인 치유 (받은 피해의 ${Math.round(S.healed / (S.taken || 1) * 100)}% 회복)`]);
      const sumDealt = types.filter(([t]) => SW.UNITS[t].summonOnly).reduce((s, [, r]) => s + r.dealt, 0);
      if (sumDealt / totalDealt > 0.2) factors.push([sumDealt / totalDealt, `소환물의 활약 (피해 ${Math.round(sumDealt / totalDealt * 100)}%)`]);
      if (S.casts > 0 && S.casts > (types.reduce((s, [, r]) => s + r.n, 0)) * 0.8) factors.push([0.35, `적극적인 기술 활용 (${S.casts}회)`]);
      const kd = S.kills / Math.max(1, S.lost);
      if (kd > 2) factors.push([0.3 + kd / 20, `압도적인 교환비 (${kd.toFixed(1)} : 1)`]);
      if (b.formation[team] !== 'free') factors.push([0.25, `${SW.FORMATIONS[b.formation[team]].name} 진형 유지`]);
      factors.sort((a, c) => c[0] - a[0]);
      return { types, alive, totalDealt, S, mvp, factor: factors[0] ? factors[0][1] : '고른 병종 기여' };
    },
    analysisHTML(team, title) {
      const A = this.analysis(team), b = this.b;
      const life = b.best.life && b.best.life.team === team ? b.best.life : null;
      let h = `<div class="ana"><div class="ana-title">${title}</div>
        <div class="ana-grid"><span>총 피해량</span><b>${fmt(A.S.dmg)}</b><span>받은 피해</span><b>${fmt(A.S.taken)}</b><span>회복량</span><b>${fmt(A.S.healed)}</b>
        <span>처치 / 손실</span><b>${A.S.kills} / ${A.S.lost}</b><span>기술 사용</span><b>${A.S.casts}회</b><span>전투 시간</span><b>${b.time.toFixed(1)}초</b></div>`;
      if (A.mvp) h += `<div class="ana-line">🏅 최고 피해: <b>${SW.UNITS[A.mvp[0]].name}</b> (${fmt(A.mvp[1].dealt)})</div>`;
      if (life) h += `<div class="ana-line">🛡 최장 생존: <b>${SW.UNITS[life.type].name}</b> (${life.life.toFixed(1)}초)</div>`;
      h += `<div class="ana-line">🎯 결정적 요인: <b>${A.factor}</b></div>`;
      const n0 = A.types.reduce((s, [, r]) => s + r.n, 0), lost = A.types.reduce((s, [, r]) => s + r.died, 0);
      h += `<div class="ana-line">❤️ 생존율 <b>${n0 ? Math.round((1 - lost / n0) * 100) : 0}%</b> · 🛡 보호막 흡수 <b>${fmt(A.S.absorbed || 0)}</b>${b.formTime && b.formTime[team] ? ` · 진형 유지 <b>${b.formTime[team]}초</b>` : ''}${b.cmdUses && b.cmdUses[team] ? ` · 지휘 능력 <b>${b.cmdUses[team]}회</b>` : ''}</div>`;
      if (team === 0 && b.orderStats && Object.keys(b.orderStats).length) {
        h += '<div class="ana-line">📜 명령별 효율 (유닛·초당 피해): ' + Object.entries(b.orderStats).filter(([, o]) => o.time > 0).map(([k, o]) => `${SW.ORDERS[k].icon}${SW.ORDERS[k].name} <b>${(o.dealt / o.time).toFixed(1)}</b>`).join(' · ') + '</div>';
        const tac = (b.orderLog || []).filter(o => o.team === 0 && (o.type === 'flank' || o.type === 'rear'));
        if (tac.length) { const ok = b.squads.filter(q => q.team === 0 && q.order.done).length; h += `<div class="ana-line">🗡 우회 전술 성공률 <b>${Math.round(ok / tac.length * 100)}%</b> (${ok}/${tac.length})</div>`; }
      }
      const evs = (b.events || []).filter(e => e.kind !== 'order' && e.kind !== 'ai' && (e.team === team || e.team === -1 || e.kind === 'commander' || e.kind === 'front' || e.kind === 'boss')).slice(0, 14);
      if (evs.length && team === 0) h += `<details><summary>⏱ 주요 사건 (${evs.length})</summary><ul class="ev">${evs.map(e => `<li><span class="muted">${Math.floor(e.t / 60)}:${String(Math.floor(e.t % 60)).padStart(2, '0')}</span> ${e.text}</li>`).join('')}</ul></details>`;
      h += `<details><summary>유닛별 효율 보기</summary><table class="ana-table"><tr><th>유닛</th><th>수</th><th>생존</th><th>피해</th><th>DPS</th><th>받음</th><th>치유</th><th>처치</th><th>효율</th></tr>`;
      for (const [t, r] of A.types.slice(0, 16)) {
        const d = SW.UNITS[t], eff = d.pop ? r.dealt / (r.n * d.pop) : 0, dps = r.life > 0 ? r.dealt / r.life : 0;
        h += `<tr><td>${d.name}</td><td>${r.n}</td><td>${A.alive[t] || 0}</td><td>${fmt(r.dealt)}</td><td>${dps.toFixed(1)}</td><td>${fmt(r.taken)}</td><td>${fmt(r.healed)}</td><td>${r.kills}</td><td>${d.pop ? fmt(eff) : '-'}</td></tr>`;
      }
      h += '</table><div class="muted small">효율 = 인원 1당 가한 피해</div></details></div>';
      return h;
    },

    finish() {
      if (this.phase !== 'fight') return;
      this.phase = 'done';
      this.updateHud();
      const b = this.b, win = b.winner === 0;
      let title = '', rows = '';
      const reward = (g) => Math.round(g * (1 + this.mods.goldBonus));
      const pay = (g) => { if (g > 0) { save.data.gold += g; save.write(); updateGold(); } };
      if (this.mode === 'challenge' || this.mode === 'raid') {
        const isRaid = this.mode === 'raid', key = isRaid ? this.raid.boss : this.stage.id, base = isRaid ? this.raid.reward : this.stage.reward;
        const clearedMap = isRaid ? save.data.raids : save.data.cleared;
        this._clearedBefore = !!clearedMap[key];
        if (win) {
          const first = !clearedMap[key];
          let g = base * (first ? 1 : 0.3);
          const eff = this.startPop <= this.popLimit * 0.7;
          if (eff) g *= 1.3;
          g = reward(g); clearedMap[key] = true; pay(g);
          rows += `<div>${first ? '첫 클리어 보상' : '재도전 보상 (30%)'} <b>💰 ${fmt(g)}</b></div>`;
          if (eff) rows += `<div style="color:var(--green)">효율 보너스 (인원 ${this.startPop}/${this.popLimit}) <b>+30%</b></div>`;
          if (!isRaid) for (const f of SW.FAMILY_ORDER) {
            const root = SW.SKILL_TREES[f][0];
            if (root.stage && root.stage === save.clearedCount() && first) rows += `<div style="color:var(--accent)">🔓 ${SW.FAMILIES[f].title} 스킬 트리 개방!</div>`;
          }
          if (!isRaid) for (const r of SW.RAIDS) if (r.need === save.clearedCount() && first) rows += `<div style="color:#ff9a9a">💀 보스 레이드 개방: ${SW.UNITS[r.boss].name}</div>`;
        } else {
          if (b.timeout) rows += '<div style="color:#ff8a8a">시간 초과!</div>';
          let frac;
          if (isRaid) { const boss = b.units.find(u => u.def.boss); frac = boss ? 1 - boss.hp / boss.maxHp : 1; }
          else { const left = b.units.filter(u => u.team === 1 && !u.def.summonOnly).reduce((t, u) => t + Math.max(0, u.hp), 0); frac = 1 - left / (this.enemyHp0 || 1); }
          frac = Math.max(0, Math.min(1, frac));
          const g = reward(base * 0.4 * frac); pay(g);
          rows += `<div>${isRaid ? '보스 체력 감소' : '적 격파율'} <b>${Math.round(frac * 100)}%</b></div><div>패배 보상 <b>💰 ${fmt(g)}</b></div>`;
          rows += '<div class="muted" style="font-size:12px;margin-top:6px">💡 진형이나 병종 조합을 바꾸거나 스킬 트리를 강화해 보세요</div>';
        }
        title = win ? `<h2 class="win">${isRaid ? '보스 격파!' : '승리!'}</h2>` : '<h2 class="lose">패배</h2>';
      } else if (this.mode === 'survival') {
        const S = b.survival, waves = Math.max(0, S.wave - 1);
        const best = waves > save.data.survivalBest;
        if (best) save.data.survivalBest = waves;
        const g = reward(Math.round(20 * waves * (1 + waves / 8)));
        pay(g);
        title = `<h2 class="${waves >= 5 ? 'win' : 'lose'}">웨이브 ${waves} 생존</h2>`;
        rows += `<div>버틴 웨이브 <b>${waves}${best ? ' 🏆 신기록!' : ''}</b></div><div>생존 보상 <b>💰 ${fmt(g)}</b></div><div>처치한 적 <b>${b.stats[0].kills}</b></div>`;
      } else if (this.mode === 'scenario') {
        const res = (this.sc.onFinish && this.sc.onFinish(b, win, this)) || {};
        title = res.title || (win ? '<h2 class="win">승리!</h2>' : '<h2 class="lose">패배</h2>');
        rows += res.rows || '';
        this._extraBtns = res.buttons || [];
      } else {
        title = b.winner === 0 ? '<h2 class="win" style="color:#8cb4ff">파란 팀 승리</h2>' : b.winner === 1 ? '<h2 class="lose">빨간 팀 승리</h2>' : '<h2>무승부</h2>';
      }
      if (b.endReason) rows = `<div class="muted">결과: ${b.endReason}</div>` + rows;
      // 성장: 경험치 · 자원
      const xpMode = this.mode === 'challenge' || this.mode === 'raid' || this.mode === 'survival' || (this.sc && this.sc.xp);
      if (xpMode && SW.awardXP) {
        const ups = SW.awardXP(b, win ? 1 : 0.5);
        const res = this.mode === 'raid' ? (win ? { crystal: 2, mana: 20, ore: 10 } : { ore: 3 }) : this.mode === 'survival' ? { ore: Math.max(0, b.survival.wave - 1) * 2, food: 10 }
          : this.mode === 'challenge' ? (win ? { ore: 6, wood: 6, food: 10, crystal: this.stage.index % 5 === 4 && !this._clearedBefore ? 1 : 0 } : { ore: 2 }) : null;
        if (res) { SW.gain(res); const t = SW.costText(res); if (t) rows += `<div>자원 획득 <b>${t}</b></div>`; }
        if (ups.length) rows += `<div style="color:#ffe27a">⬆ 레벨 업: ${ups.slice(0, 6).join(', ')}${ups.length > 6 ? ' 외 ' + (ups.length - 6) : ''}</div>`;
        save.write(); updateGold();
      }
      SW.Recorder.finalize(b);
      const box = el('div', 'box');
      let anaHTML = this.analysisHTML(0, this.mode === 'sandbox' ? '🔵 파란 팀 분석' : '📊 전투 분석');
      if (this.mode === 'sandbox') anaHTML += this.analysisHTML(1, '🔴 빨간 팀 분석');
      box.innerHTML = title + (rows ? `<div class="rows">${rows}</div>` : '') + anaHTML;
      const btns = el('div', 'btns');
      const B = (txt, cls, fn) => { const x = el('button', 'btn ' + cls, txt); x.onclick = fn; btns.appendChild(x); };
      if (!(this.sc && this.sc.noRetry)) B('↺ 재배치', win && this.mode === 'challenge' ? '' : 'primary', () => this.rebuild());
      if (this.mode === 'challenge') {
        const next = SW.STAGES[this.stage.index + 1];
        if (win && next) B('다음 스테이지 ▶', 'primary', () => { this.open('challenge', next); });
        B('🌳 스킬 트리', '', () => go('tree'));
        B('스테이지 선택', '', () => go('stages'));
      } else if (this.mode === 'raid') { B('🌳 스킬 트리', '', () => go('tree')); B('레이드 목록', '', () => go('raids')); }
      else if (this.mode === 'survival') B('🌳 스킬 트리', '', () => go('tree'));
      else if (this.mode !== 'scenario') B('결과 닫기', '', () => { $('#b-result').hidden = true; });
      for (const x of this._extraBtns || []) B(x.text, x.cls || '', x.fn);
      this._extraBtns = null;
      if (b.replay) B('🎬 리플레이', '', () => SW.cmdUI.startReplay(b.replay));
      box.appendChild(btns);
      const r = $('#b-result'); r.innerHTML = ''; r.appendChild(box); r.hidden = false;
    },
  };
  function segOn(sel, btn) { $$(sel + ' button').forEach(b => b.classList.toggle('on', b === btn)); }

  // 초기화
  Battle.init();
  MenuBG.init();
  go('menu');
  SW.ui = { go, Battle, Tree, toast, icon, el, $, $$, fmt, segOn, updateGold, unitCard, statsHTML, current: () => current };
})();
