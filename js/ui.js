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
    if (name === 'tree' && current !== 'tree') treeReturn = current === 'battle' ? 'stages' : current;
    if (current === 'battle' && name !== 'battle') Battle.close();
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    current = name;
    updateGold();
    if (name === 'stages') renderStages();
    if (name === 'tree') Tree.render();
    if (name === 'codex') renderCodex();
    if (name === 'menu') renderMenu();
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
  });

  // ───────── 메뉴 ─────────
  function renderMenu() {
    $('#menu-progress').textContent = `클리어 ${save.clearedCount()}/${SW.STAGES.length} · 💰 ${fmt(save.data.gold)}`;
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
      this.b = new SW.Battle({ timeLimit: 120 });
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
  $('#tree-back').onclick = () => go(treeReturn === 'battle' ? 'stages' : treeReturn);
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
  function unitCard(type, mods, locked) {
    const d = SW.resolveDef(type, mods);
    const c = el('div', 'card' + (locked ? ' locked' : ''));
    const cv = el('canvas'); c.appendChild(cv); requestAnimationFrame(() => SW.drawUnitIcon(cv, type, 0));
    const b = el('div');
    b.innerHTML = `<div class="cn">${d.name} ${locked ? '🔒' : ''}</div><div class="cd">${d.desc}</div>${statsHTML(d)}<div class="tags">${SW.unitTraits(d).map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
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
    $('#codex-count').textContent = `해금 ${have}/${total} (소환물 제외) · 스탯은 현재 스킬 트리 적용 수치`;
  }

  // ───────── 전투 화면 ─────────
  const Battle = {
    mode: 'sandbox', stage: null, b: null, phase: 'deploy', sel: 'soldier', brush: 1, tool: 'place', team: 0,
    speed: 1, paused: false, snapshot: null, acc: 0, hover: null, mouse: null, useMods: false,

    init() {
      this.canvas = $('#battle-canvas');
      this.r = new SW.Renderer(this.canvas);
      const c = this.canvas;
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('pointerdown', e => this.pointer(e, 'down'));
      c.addEventListener('pointermove', e => this.pointer(e, 'move'));
      window.addEventListener('pointerup', () => { this.drag = null; this.panning = null; });
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
      $('#b-back').onclick = () => go(this.mode === 'challenge' ? 'stages' : 'menu');
      $$('#b-speed button').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.sp));
      $$('#brush-seg button').forEach(b => b.onclick = () => { this.brush = +b.dataset.b; segOn('#brush-seg', b); });
      $$('#tool-seg button').forEach(b => b.onclick = () => { this.tool = b.dataset.tool; segOn('#tool-seg', b); });
      $$('#sb-team button').forEach(b => b.onclick = () => { this.team = +b.dataset.team; segOn('#sb-team', b); this.renderPalette(); });
      $('#sb-mirror').onclick = () => this.mirror();
      $('#sb-random').onclick = () => this.randomArmy();
      $('#sb-mods').onchange = (e) => { this.useMods = e.target.checked; this.rebuild(); };
      window.addEventListener('keydown', e => {
        if (current !== 'battle') return;
        if (e.code === 'Space') { e.preventDefault(); this.phase === 'deploy' ? this.start() : this.togglePause(); }
        if (e.key === 'r' || e.key === 'R') this.resetDeploy();
        if (['1', '2', '3', '4'].includes(e.key)) this.setSpeed([0.5, 1, 2, 4][+e.key - 1]);
      });
      const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    open(mode, stage) {
      this.mode = mode; this.stage = stage || null; this.phase = 'deploy'; this.paused = false;
      this.r.resetView();
      $('#b-result').hidden = true;
      $('#sb-tools').style.display = mode === 'sandbox' ? '' : 'none';
      $('#b-clear').textContent = mode === 'sandbox' ? '🗑 모두 지우기' : '🗑 내 유닛 지우기';
      if (mode === 'challenge') {
        this.team = 0;
        this.mods = save.mods();
        $('#b-name').textContent = `STAGE ${stage.index + 1}. ${stage.name}`;
        $('#b-sub').textContent = stage.hint;
        this.popLimit = stage.pop + this.mods.popBonus;
        const saved = save.data.deploys[stage.id] || [];
        this.snapshot = [...SW.stageDeployment(stage), ...saved.filter(u => this.mods.unlocks.has(u.type))];
        if (!this.mods.unlocks.has(this.sel)) this.sel = 'soldier';
      } else {
        $('#b-name').textContent = '샌드박스';
        $('#b-sub').textContent = '자유롭게 배치하고 싸움을 지켜보세요';
        this.snapshot = this.snapshot && this.lastMode === 'sandbox' ? this.snapshot : [];
      }
      this.lastMode = mode;
      this.rebuild();
      this.renderPalette();
      this.setSpeed(this.speed);
      this.updateHud();
      this.showInfo(this.sel);
    },
    close() { if (this.mode === 'challenge' && this.phase === 'deploy') this.saveDeploy(); },

    newBattle() {
      const mods = this.mode === 'challenge' ? [this.mods, null] : [this.useMods ? save.mods() : null, null];
      const buffs = this.mode === 'challenge' ? [null, this.stage.buff] : [null, null];
      return new SW.Battle({ mods, buffs, timeLimit: this.mode === 'challenge' ? 180 : 600 });
    },
    rebuild() {
      this.b = this.newBattle();
      for (const u of this.snapshot) this.b.spawn(u.type, u.team, u.x, u.y);
      this.phase = 'deploy'; this.acc = 0;
      $('#b-result').hidden = true;
      this.updateHud();
    },
    takeSnapshot() { return this.b.units.map(u => ({ type: u.type, team: u.team, x: u.x, y: u.y })); },
    saveDeploy() {
      if (this.mode !== 'challenge' || this.phase !== 'deploy') return;
      save.data.deploys[this.stage.id] = this.takeSnapshot().filter(u => u.team === 0).map(u => ({ ...u, x: Math.round(u.x), y: Math.round(u.y) }));
      save.write();
    },

    usedPop() { return this.b.units.filter(u => u.team === 0).reduce((s, u) => s + u.def.pop, 0); },
    zone() {
      if (this.mode === 'challenge') return { x0: 0, x1: 640 };
      return { x0: 0, x1: SW.WORLD.W };
    },

    start() {
      if (this.phase !== 'deploy') return;
      const blue = this.b.units.some(u => u.team === 0), red = this.b.units.some(u => u.team === 1);
      if (!blue || !red) { toast(this.mode === 'challenge' ? '유닛을 배치하세요!' : '양쪽 팀 모두 유닛이 필요합니다'); return; }
      if (this.mode === 'challenge' && this.usedPop() > this.popLimit) { toast('인원 제한을 초과했습니다'); return; }
      this.saveDeploy();
      this.snapshot = this.takeSnapshot();
      this.startPop = this.usedPop();
      this.phase = 'fight'; this.paused = false; this.acc = 0;
      this.updateHud();
    },
    togglePause() { if (this.phase === 'fight') { this.paused = !this.paused; this.updateHud(); } },
    resetDeploy() { if (this.phase !== 'deploy') this.rebuild(); },
    clearAll() {
      if (this.phase !== 'deploy') this.rebuild();
      if (this.mode === 'challenge') this.b.units = this.b.units.filter(u => u.team === 1);
      else this.b.units = [];
      this.snapshot = this.takeSnapshot();
      this.saveDeploy(); this.updateHud();
    },
    setSpeed(s) { this.speed = s; $$('#b-speed button').forEach(b => b.classList.toggle('on', +b.dataset.sp === s)); },

    mirror() {
      if (this.phase !== 'deploy') this.rebuild();
      this.b.units = this.b.units.filter(u => u.team === 0);
      for (const u of [...this.b.units]) this.b.spawn(u.type, 1, SW.WORLD.W - u.x, u.y);
      this.snapshot = this.takeSnapshot(); this.updateHud();
    },
    randomArmy() {
      if (this.phase !== 'deploy') this.rebuild();
      const team = this.team;
      this.b.units = this.b.units.filter(u => u.team !== team);
      const pool = SW.unitList().map(u => u.id);
      let budget = 80;
      while (budget > 0) {
        const type = pool[(Math.random() * pool.length) | 0], d = SW.UNITS[type];
        const n = Math.max(1, Math.min(Math.floor(budget / d.pop), Math.round(8 / d.pop) + 1));
        if (d.pop > budget) { budget -= 1; continue; }
        const ranged = d.range > 40 || d.support;
        const cx = team === 0 ? (ranged ? 250 : 520) + (Math.random() - .5) * 120 : (ranged ? 1350 : 1080) + (Math.random() - .5) * 120;
        const cy = 100 + Math.random() * 700;
        this.placeCluster(type, team, cx, cy, n, true);
        budget -= n * d.pop;
      }
      this.snapshot = this.takeSnapshot(); this.updateHud();
    },

    // 배치 가능 여부
    canPlace(type, team, x, y) {
      const d = SW.UNITS[type], z = this.zone();
      if (this.mode === 'challenge' && (x < z.x0 + d.size || x > z.x1 - d.size)) return false;
      if (x < d.size || x > SW.WORLD.W - d.size || y < d.size || y > SW.WORLD.H - d.size) return false;
      for (const o of this.b.units) {
        if (!!o.def.flying !== !!d.flying) continue;
        const rr = o.r + d.size + 1;
        if ((o.x - x) ** 2 + (o.y - y) ** 2 < rr * rr) return false;
      }
      return true;
    },
    placeCluster(type, team, cx, cy, n, silent) {
      const d = SW.UNITS[type], gap = d.size * 2 + 3;
      const side = Math.ceil(Math.sqrt(n)) + 2;
      const pts = [];
      for (let i = -side; i <= side; i++) for (let j = -side; j <= side; j++) pts.push([i, j, i * i + j * j]);
      pts.sort((a, b) => a[2] - b[2]);
      let placed = 0;
      for (const [i, j] of pts) {
        if (placed >= n) break;
        if (this.mode === 'challenge' && this.usedPop() + d.pop > this.popLimit) { if (!silent) toast('인원 제한에 도달했습니다'); break; }
        const x = cx + i * gap, y = cy + j * gap;
        if (this.canPlace(type, team, x, y)) { this.b.spawn(type, team, x, y); placed++; }
      }
      return placed;
    },
    eraseAt(x, y) {
      const r = 10 + Math.sqrt(this.brush) * 12;
      this.b.units = this.b.units.filter(u => {
        if (this.mode === 'challenge' && u.team !== 0) return true;
        return (u.x - x) ** 2 + (u.y - y) ** 2 > (r + u.r) ** 2;
      });
    },

    pointer(e, kind) {
      // 화면 이동: 휠 버튼 / 이동 도구 / 전투 중 드래그
      if (kind === 'down' && (e.button === 1 || this.tool === 'pan' || (this.phase !== 'deploy' && e.button === 0))) {
        e.preventDefault();
        this.panning = { x: e.clientX, y: e.clientY };
        this.canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      if (this.panning) {
        if (e.buttons === 0) { this.panning = null; }
        else { this.r.pan(e.clientX - this.panning.x, e.clientY - this.panning.y); this.panning = { x: e.clientX, y: e.clientY }; return; }
      }
      const p = this.r.toWorld(e.clientX, e.clientY);
      this.mouse = p;
      if (kind === 'down') {
        this.canvas.setPointerCapture?.(e.pointerId);
        this.drag = { erase: e.button === 2 || this.tool === 'erase', last: null };
      }
      // 호버
      let best = null, bd = 400;
      for (const u of this.b.units) { const dd = (u.x - p.x) ** 2 + (u.y - p.y) ** 2; if (dd < bd && dd < (u.r + 6) ** 2) { bd = dd; best = u; } }
      this.hover = best;
      if (best && !this.drag) this.showInfo(best.type, best);
      if (!this.drag || this.phase !== 'deploy') return;
      if (kind === 'move' && e.buttons === 0) { this.drag = null; return; }
      if (this.drag.erase) { this.eraseAt(p.x, p.y); this.snapshot = this.takeSnapshot(); this.updateHud(); return; }
      const d = SW.UNITS[this.sel];
      const minStep = (d.size * 2 + 3) * (this.brush > 1 ? Math.sqrt(this.brush) : 1);
      if (this.drag.last && Math.hypot(p.x - this.drag.last.x, p.y - this.drag.last.y) < minStep) return;
      if (this.mode === 'challenge' && !this.mods.unlocks.has(this.sel)) return;
      const n = this.placeCluster(this.sel, this.team, p.x, p.y, this.brush);
      if (n || !this.drag.last) this.drag.last = p;
      this.snapshot = this.takeSnapshot();
      this.updateHud();
    },

    renderPalette() {
      const list = $('#palette-list'); list.innerHTML = '';
      const ch = this.mode === 'challenge';
      for (const f of SW.FAMILY_ORDER) {
        const units = SW.unitList(!ch).filter(u => u.family === f);
        if (ch && !units.some(u => this.mods.unlocks.has(u.id)) && !save.data.skills.includes(SW.SKILL_TREES[f][0].id)) {
          // 계열 자체가 잠김
          list.appendChild(el('div', 'fam', `${SW.FAMILIES[f].name} · ${SW.FAMILIES[f].title} 🔒`));
          continue;
        }
        list.appendChild(el('div', 'fam', `${SW.FAMILIES[f].name} · ${SW.FAMILIES[f].title}`));
        for (const u of units) {
          const locked = ch && !this.mods.unlocks.has(u.id);
          const b = el('div', 'pu' + (this.sel === u.id ? ' on' : '') + (locked ? ' locked' : ''));
          b.appendChild(icon(u.id, this.team, 26));
          b.appendChild(el('span', 'pn', u.name + (locked ? ' 🔒' : '')));
          b.appendChild(el('span', 'pp', u.pop ? '👤' + u.pop : '소환'));
          b.onclick = () => {
            if (locked) { toast('스킬 트리에서 해금하세요'); this.showInfo(u.id); return; }
            this.sel = u.id; this.renderPalette(); this.showInfo(u.id);
            if (this.tool === 'erase') { this.tool = 'place'; segOn('#tool-seg', $('#tool-seg [data-tool=place]')); }
          };
          b.onmouseenter = () => this.showInfo(u.id);
          list.appendChild(b);
        }
      }
    },

    showInfo(type, inst) {
      if (this._infoKey === type + (inst ? inst.uid : '') && !inst) return;
      this._infoKey = type + (inst ? inst.uid : '');
      const team = inst ? inst.team : this.team;
      const d = inst ? inst.def : this.b.def(type, team);
      const box = $('#b-info'); box.innerHTML = '';
      const h = el('h3'); h.appendChild(icon(type, team, 34)); h.append(d.name); box.appendChild(h);
      box.appendChild(el('div', 'muted', `${SW.FAMILIES[d.family].name} · ${SW.FAMILIES[d.family].title}${inst ? (inst.team ? ' · 빨간 팀' : ' · 파란 팀') : ''}`));
      if (inst) {
        this.infoInst = inst;
        box.appendChild(el('div', 'hpbar', `<div style="width:${Math.max(0, inst.hp / inst.maxHp * 100)}%"></div>`));
        box.appendChild(el('div', 'muted', `HP ${fmt(inst.hp)} / ${fmt(inst.maxHp)}${inst.shield > 0 ? ' (+🛡' + fmt(inst.shield) + ')' : ''}`));
      } else this.infoInst = null;
      box.appendChild(el('div', 'desc', d.desc));
      box.insertAdjacentHTML('beforeend', statsHTML(d));
      box.appendChild(el('div', 'tags', SW.unitTraits(d).map(t => `<span class="tag">${t}</span>`).join('')));
    },

    updateHud() {
      const ch = this.mode === 'challenge';
      const pop = $('#b-pop');
      if (ch) {
        const used = this.phase === 'deploy' ? this.usedPop() : this.startPop;
        pop.hidden = false; pop.textContent = `👤 ${used} / ${this.popLimit}`;
        pop.classList.toggle('over', used > this.popLimit);
      } else pop.hidden = true;
      const cnt = [0, 0], hp = [0, 0];
      for (const u of this.b.units) { cnt[u.team]++; hp[u.team] += u.hp; }
      const tot = hp[0] + hp[1] || 1;
      $('#b-count').innerHTML = `<span class="b">${cnt[0]}</span> vs <span class="r">${cnt[1]}</span>`;
      const fighting = this.phase === 'fight';
      $('#b-start').hidden = this.phase !== 'deploy';
      $('#b-pause').hidden = !fighting;
      $('#b-pause').textContent = this.paused ? '▶ 계속' : '⏸ 일시정지';
      $('#b-reset').disabled = this.phase === 'deploy';
      $('#b-clear').disabled = false;
      const t = this.b.time, lim = this.b.timeLimit;
      $('#b-timer').innerHTML = this.phase === 'deploy' ? '배치 단계' :
        `⏱ ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / ${Math.floor(lim / 60)}:${String(lim % 60).padStart(2, '0')}<div class="power"><div style="width:${hp[0] / tot * 100}%"></div><div style="width:${hp[1] / tot * 100}%"></div></div>`;
      let hint = '';
      if (this.phase === 'deploy') hint = ch ? '왼쪽 구역에 유닛을 배치하세요 · 우클릭으로 제거 · Space로 시작' : '좌클릭: 배치 · 우클릭: 제거 · 팀을 바꿔 양쪽에 배치하세요';
      $('#b-hint').textContent = hint; $('#b-hint').hidden = !hint;
    },

    frame(t) {
      const dtReal = Math.min(0.05, ((t - (this.lastT || t)) / 1000)); this.lastT = t;
      if (current !== 'battle' || !this.b) return;
      if (this.phase === 'fight' && !this.paused) {
        this.acc += dtReal * this.speed;
        let n = 0;
        while (this.acc >= 1 / 60 && n < 20) { this.b.step(1 / 60); this.acc -= 1 / 60; n++; }
        if (this.b.over) this.finish();
        this._hudT = (this._hudT || 0) + dtReal;
        if (this._hudT > 0.2) { this._hudT = 0; this.updateHud(); if (this.infoInst) this.showInfo(this.infoInst.type, this.infoInst); }
      }
      const ui = { hover: this.hover };
      if (this.phase === 'deploy') {
        const z = this.zone();
        if (this.mode === 'challenge') ui.zones = [{ x0: z.x0, x1: z.x1, color: 'rgba(63,124,255,0.07)', line: 'rgba(63,124,255,0.5)' }];
        if (this.mouse && this.tool !== 'pan') {
          const erase = this.tool === 'erase' || (this.drag && this.drag.erase);
          ui.brush = { x: this.mouse.x, y: this.mouse.y, r: erase ? 10 + Math.sqrt(this.brush) * 12 : SW.UNITS[this.sel].size * (1 + Math.sqrt(this.brush) * 1.1), erase, type: this.sel, team: this.team, valid: this.mode !== 'challenge' || this.mouse.x < z.x1 };
        }
      }
      this.r.draw(this.b, ui);
    },

    finish() {
      if (this.phase !== 'fight') return;
      this.phase = 'done';
      this.updateHud();
      const b = this.b, win = b.winner === 0;
      const box = el('div', 'box');
      let rows = `<div>전투 시간 <b>${b.time.toFixed(1)}초</b></div><div>가한 피해 <b>${fmt(b.stats[0].dmg)}</b></div><div>처치 <b>${b.stats[0].kills}</b></div>`;
      rows += `<div>생존 유닛 <b>${b.units.filter(u => u.team === 0).length}</b></div>`;
      let title = '';
      if (this.mode === 'challenge') {
        const s = this.stage;
        if (win) {
          const first = !save.data.cleared[s.id];
          let g = s.reward * (first ? 1 : 0.3);
          const eff = this.startPop <= this.popLimit * 0.7;
          if (eff) g *= 1.3;
          g *= 1 + this.mods.goldBonus;
          g = Math.round(g);
          save.data.gold += g; save.data.cleared[s.id] = true; save.write(); updateGold();
          rows += `<div>${first ? '첫 클리어 보상' : '재도전 보상 (30%)'} <b>💰 ${fmt(g)}</b></div>`;
          if (eff) rows += `<div style="color:var(--green)">효율 보너스 (인원 ${this.startPop}/${this.popLimit}) <b>+30%</b></div>`;
          if (this.mods.goldBonus) rows += `<div style="color:var(--gold)">전리품 보너스 <b>+${Math.round(this.mods.goldBonus * 100)}%</b></div>`;
          // 새로 열린 계열
          for (const f of SW.FAMILY_ORDER) {
            const root = SW.SKILL_TREES[f][0];
            if (root.stage && root.stage === save.clearedCount() && first) rows += `<div style="color:var(--accent)">🔓 ${SW.FAMILIES[f].title} 스킬 트리 개방!</div>`;
          }
        } else if (b.timeout) rows += '<div style="color:#ff8a8a">시간 초과!</div>';
        title = win ? '<h2 class="win">승리!</h2>' : '<h2 class="lose">패배</h2>';
      } else {
        title = b.winner === 0 ? '<h2 class="win" style="color:#8cb4ff">파란 팀 승리</h2>' : b.winner === 1 ? '<h2 class="lose">빨간 팀 승리</h2>' : '<h2>무승부</h2>';
        rows = `<div>전투 시간 <b>${b.time.toFixed(1)}초</b></div><div>파란 팀 피해/처치 <b>${fmt(b.stats[0].dmg)} / ${b.stats[0].kills}</b></div><div>빨간 팀 피해/처치 <b>${fmt(b.stats[1].dmg)} / ${b.stats[1].kills}</b></div>`;
      }
      box.innerHTML = title + `<div class="rows">${rows}</div>`;
      const btns = el('div', 'btns');
      const B = (txt, cls, fn) => { const x = el('button', 'btn ' + cls, txt); x.onclick = fn; btns.appendChild(x); };
      B('↺ 재배치', win && this.mode === 'challenge' ? '' : 'primary', () => this.rebuild());
      if (this.mode === 'challenge') {
        const next = SW.STAGES[this.stage.index + 1];
        if (win && next) B('다음 스테이지 ▶', 'primary', () => { this.open('challenge', next); });
        B('🌳 스킬 트리', '', () => go('tree'));
        B('스테이지 선택', '', () => go('stages'));
      } else B('결과 닫기', '', () => { $('#b-result').hidden = true; });
      box.appendChild(btns);
      const r = $('#b-result'); r.innerHTML = ''; r.appendChild(box); r.hidden = false;
    },
  };
  function segOn(sel, btn) { $$(sel + ' button').forEach(b => b.classList.toggle('on', b === btn)); }

  // 초기화
  Battle.init();
  MenuBG.init();
  go('menu');
  SW.ui = { go, Battle, Tree };
})();
