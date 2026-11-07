// ─────────────────────────────────────────────
// 전투 화면 3.0: 부대 지휘 패널 · 지휘관 능력 · 전략 지도(미니맵) · 리플레이 · 커스텀 전투 규칙
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, fmt, segOn } = SW.ui;
  const B = SW.ui.Battle;
  const save = SW.save;

  const UI = SW.cmdUI = {
    init() {
      const wrap = $('.canvas-wrap');
      // 부대 지휘 패널
      this.panel = el('div', 'cmd-panel'); this.panel.id = 'cmd-panel'; wrap.appendChild(this.panel);
      // 전략 지도
      this.mini = el('canvas', 'minimap'); this.mini.id = 'minimap'; wrap.appendChild(this.mini);
      this.mini.addEventListener('pointerdown', (e) => this.miniClick(e));
      this.mini.addEventListener('pointermove', (e) => { if (e.buttons) this.miniClick(e); });
      // 리플레이 바
      this.rbar = el('div', 'replay-bar'); this.rbar.hidden = true; wrap.appendChild(this.rbar);
      // 커스텀 전투 규칙 (샌드박스)
      this.rules = el('details', 'rules'); this.rules.id = 'rules';
      $('#sb-tools').appendChild(this.rules);
      B.rules = { weather: 'clear', time: 'day', morale: false, victory: 'annihilate', statMul: null, points: [], terrainPreset: 'none' };
      B.baseTerrain = null; B.paintType = 'forest';
      this.renderRules();
      // 전투 시작 시 사전 명령 적용
      const origStart = B.start;
      B.start = function () {
        origStart.call(this);
        if (this.phase !== 'fight') return;
        if (this.squadDefs) this.squadDefs.forEach((q, i) => { if (q.order && q.order !== 'free' && this.b.squads && this.b.squads[i]) this.b.setOrder(i, q.order, q.params || {}); });
        UI.renderPanel(true);
      };
      const origOpen = B.open;
      B.open = function (mode, ctx) { origOpen.call(this, mode, ctx); UI.renderPanel(true); UI.rbar.hidden = true; UI.renderRules(); };
      const origRebuild = B.rebuild;
      B.rebuild = function () { origRebuild.call(this); UI.renderPanel(true); };
      // 도구: 부대 지정 · 지형 칠하기 · 거점 · 이동
      const ts = $('#tool-seg');
      if (ts && !ts.querySelector('[data-tool=squad]')) {
        const b1 = el('button', '', '🚩부대'); b1.dataset.tool = 'squad'; b1.title = '선택한 부대에 유닛 지정 (브러시)';
        const b2 = el('button', 'sb-only', '🖌지형'); b2.dataset.tool = 'terrain'; b2.title = '지형 칠하기 (규칙 패널에서 지형 선택)';
        const b3 = el('button', '', '✥이동'); b3.dataset.tool = 'move'; b3.title = '유닛을 끌어서 위치 이동';
        [b1, b3, b2].forEach(b => { ts.appendChild(b); b.onclick = () => { B.tool = b.dataset.tool; segOn('#tool-seg', b); }; });
      }
    },

    // ── 부대 패널 ──
    renderPanel(force) {
      const b = B.b; if (!b) return;
      const P = this.panel;
      const team = 0;
      const showSquads = B.mode !== 'sandbox' || (b.squads && b.squads.some(s => s.team === 0));
      const spect = B.sc && B.sc.spectate;
      if (spect || !showSquads && B.phase !== 'deploy') { P.hidden = true; return; }
      P.hidden = false;
      const sqs = (b.squads || []).filter(s => s.team === team);
      const key = JSON.stringify([B.phase, sqs.map(s => [s.id, s.alive, s.n0, s.order.type, s.order.stage]), B.selSquad, B.pick && B.pick.order, this.cmdKey(b)]);
      if (!force && key === this._key) return;
      this._key = key;
      if (this.collapsed === undefined) this.collapsed = window.matchMedia && matchMedia('(max-width: 900px)').matches;
      P.classList.toggle('collapsed', this.collapsed);
      let h = `<div class="cmd-row"><button class="chip tog" data-act="tog" title="명령 패널 접기/펼치기">${this.collapsed ? '🚩 명령 ▸' : '◂'}</button>`;
      h += `<button class="chip ${B.selSquad === null ? 'on' : ''}" data-sq="all">전군</button>`;
      for (const s of sqs) {
        const n = B.phase === 'deploy' ? b.units.filter(u => u.sq === s.id).length : s.alive;
        h += `<button class="chip ${B.selSquad === s.id ? 'on' : ''}" data-sq="${s.id}" style="--c:${s.color}"><i></i>${s.name} <small>${n}${B.phase !== 'deploy' && s.n0 ? '/' + s.n0 : ''}</small> ${SW.ORDERS[s.order.type].icon}</button>`;
      }
      if (B.phase === 'deploy') h += '<button class="chip add" data-act="addsq">＋부대</button><button class="chip" data-act="auto">⚙ 자동 편성</button>';
      h += '</div><div class="cmd-row orders">';
      for (const id of SW.ORDER_ORDER) {
        const o = SW.ORDERS[id];
        h += `<button class="ord ${B.pick && B.pick.order === id ? 'on' : ''}" data-ord="${id}" title="${o.name}: ${o.desc}">${o.icon}<span>${o.name}</span></button>`;
      }
      h += '</div>';
      const cmds = this.cmdAvailable(b);
      if (cmds) {
        h += '<div class="cmd-row abil">';
        for (const a of SW.CMD_ABILITIES) {
          const cd = Math.max(0, ((b.cmdCd && b.cmdCd[0][a.id]) || 0) - b.time);
          h += `<button class="abl" data-abl="${a.id}" ${cd > 0 || B.phase !== 'fight' ? 'disabled' : ''} title="${a.desc}">${a.icon} ${a.name}${cd > 0 ? ` <small>${Math.ceil(cd)}s</small>` : ''}</button>`;
        }
        const c = b.teamInfo && b.teamInfo[0].commander;
        h += `<span class="cmd-st">${B.phase === 'fight' ? (c ? '👑 지휘관 건재' : (b.hadCommander && b.hadCommander[0] ? '💀 지휘관 전사 · 효율 50%' : '지휘관 없음 · 효율 50%')) : ''}</span></div>`;
      }
      if (B.pick) h += `<div class="cmd-hint">${B.pick.msg} <button data-act="cancel">취소</button></div>`;
      P.innerHTML = h;
      P.querySelectorAll('[data-sq]').forEach(x => x.onclick = () => { B.selSquad = x.dataset.sq === 'all' ? null : +x.dataset.sq; this.renderPanel(true); });
      P.querySelectorAll('[data-ord]').forEach(x => x.onclick = () => this.order(x.dataset.ord));
      P.querySelectorAll('[data-abl]').forEach(x => x.onclick = () => { if (b.useCommand(0, x.dataset.abl, B.selSquad)) this.renderPanel(true); });
      const act = (a, fn) => { const x = P.querySelector(`[data-act=${a}]`); if (x) x.onclick = fn; };
      act('addsq', () => this.addSquad());
      act('auto', () => this.autoOrganize());
      act('cancel', () => { B.pick = null; this.renderPanel(true); });
      act('tog', () => { this.collapsed = !this.collapsed; this.renderPanel(true); });
    },
    cmdAvailable(b) { return (B.sc && B.sc.command) || (b.units.some(u => u.team === 0 && u.commander)) || (b.hadCommander && b.hadCommander[0]); },
    cmdKey(b) { if (!b.cmdCd) return ''; return SW.CMD_ABILITIES.map(a => Math.ceil(Math.max(0, (b.cmdCd[0][a.id] || 0) - b.time))).join(',') + (b.teamInfo[0].commander ? 'c' : ''); },

    addSquad() {
      B.squadDefs = B.squadDefs || [];
      const n = B.squadDefs.filter(q => q.team === 0).length;
      if (n >= 8) { toast('부대는 최대 8개'); return; }
      B.squadDefs.push({ team: 0, name: `제${n + 1}부대`, order: 'free' });
      B.snapshot = B.takeSnapshot(); B.rebuild();
      B.selSquad = B.squadDefs.length - 1; this.renderPanel(true);
      B.tool = 'squad'; segOn('#tool-seg', $('#tool-seg [data-tool=squad]'));
      toast('🚩부대 도구로 유닛을 칠해 부대에 지정하세요');
    },
    // 역할별 자동 편성
    autoOrganize() {
      if (B.phase !== 'deploy') return;
      const keep = (B.squadDefs || []).filter(q => q.team !== 0);
      const groups = { front: [], ranged: [], mobile: [], support: [], command: [] };
      for (const u of B.b.units) {
        if (u.team !== 0 || u.def.structure) continue;
        const c = u.def.cls;
        const k = u.commander ? 'command' : c === 'front' || c === 'tank' ? 'front' : c === 'ranged' || c === 'caster' ? 'ranged' : c === 'assassin' || c === 'flyer' ? 'mobile' : 'support';
        groups[k].push(u);
      }
      const names = { front: '전열 부대', ranged: '원거리 부대', mobile: '기동 부대', support: '지원 부대', command: '지휘부' };
      const defs = [...keep];
      // 큰 전열은 둘로 나눈다 (좌·우)
      const split = [];
      for (const k of ['front', 'ranged', 'mobile', 'support', 'command']) {
        const list = groups[k]; if (!list.length) continue;
        if (k === 'front' && list.length > 40) { list.sort((a, b) => a.y - b.y); split.push(['좌익 전열', list.slice(0, list.length / 2 | 0)], ['우익 전열', list.slice(list.length / 2 | 0)]); }
        else split.push([names[k], list]);
      }
      for (const [name, list] of split) {
        const id = defs.length;
        defs.push({ team: 0, name, order: name === '지휘부' ? 'hold' : 'free' });
        for (const u of list) u.sq = id;
      }
      // 적 부대 번호 재정렬 (적 팀 유닛의 sq 인덱스 유지)
      const remap = new Map(); keep.forEach((q, i) => remap.set((B.squadDefs || []).indexOf(q), i));
      for (const u of B.b.units) if (u.team !== 0 && u.sq !== undefined) u.sq = remap.has(u.sq) ? remap.get(u.sq) : undefined;
      B.squadDefs = defs;
      B.snapshot = B.takeSnapshot(); B.rebuild();
      toast(`⚙ ${split.length}개 부대로 편성`);
    },

    order(type) {
      const b = B.b, o = SW.ORDERS[type];
      const targets = B.selSquad === null ? (b.squads || []).filter(s => s.team === 0).map(s => s.id) : [B.selSquad];
      if (!targets.length) { toast('먼저 부대를 편성하세요 (⚙ 자동 편성)'); return; }
      if (o.point) { B.pick = { order: type, targets, msg: `${o.icon} ${o.name}: 지도에서 위치를 클릭하세요` }; this.renderPanel(true); return; }
      if (o.unit) { B.pick = { order: type, targets, msg: `${o.icon} ${o.name}: 공격할 적 유닛을 클릭하세요`, unit: true }; this.renderPanel(true); return; }
      if (o.ally) { B.pick = { order: type, targets, msg: `${o.icon} ${o.name}: 호위할 아군 유닛을 클릭하세요`, ally: true }; this.renderPanel(true); return; }
      this.applyOrder(targets, type, {});
    },
    applyOrder(targets, type, params) {
      const b = B.b;
      for (const id of targets) {
        if (B.phase === 'deploy') { if (B.squadDefs[id]) { B.squadDefs[id].order = type; B.squadDefs[id].params = params; b.squads[id].order = { type, ...params }; } }
        else b.setOrder(id, type, params);
      }
      toast(`${SW.ORDERS[type].icon} ${SW.ORDERS[type].name}${B.phase === 'deploy' ? ' (전투 시작 시 실행)' : ''}`);
      B.pick = null; this.renderPanel(true);
    },

    // ── 캔버스 입력 훅 ──
    pointerHook(e, kind, p) {
      if (B.replayView) {
        if (kind === 'down') {
          let best = null, bd = 400; for (const u of B.replayView.units) { const d = (u.x - p.x) ** 2 + (u.y - p.y) ** 2; if (d < bd) { bd = d; best = u; } }
          B.replaySel = best ? best.uid : undefined;
          if (best) B.showInfo(best.type);
        }
        return true;
      }
      if (B.pick && kind === 'down') {
        const pk = B.pick, u = B.unitAt(p.x, p.y);
        if (pk.unit) { if (!u || u.team === 0) { toast('적 유닛을 클릭하세요'); return true; } this.applyOrder(pk.targets, pk.order, { target: u }); }
        else if (pk.ally) { if (!u || u.team !== 0) { toast('아군 유닛을 클릭하세요'); return true; } this.applyOrder(pk.targets, pk.order, u.sq !== undefined && !pk.targets.includes(u.sq) ? { squad: u.sq } : { unit: u }); }
        else this.applyOrder(pk.targets, pk.order, { x: p.x, y: p.y });
        return true;
      }
      if (B.phase !== 'deploy') return false;
      const tool = B.tool;
      const lockedMove = B.sc && B.sc.palette === 'none' && tool === 'place';
      if (tool === 'move' || lockedMove) {
        if (kind === 'down') {
          const u = B.unitAt(p.x, p.y);
          B.moveU = u && (u.team === B.team || B.mode === 'sandbox') && !(u.fixed && u.team !== 0) && !u.def.structure ? u : null;
        } else if (kind === 'move' && B.moveU && e.buttons) {
          const z = B.zone(B.moveU.team), u = B.moveU;
          u.x = Math.max(z.x0 + u.r, Math.min(z.x1 - u.r, p.x)); u.y = Math.max(u.r, Math.min(B.b.H - u.r, p.y));
          B.snapshot = B.takeSnapshot();
        } else if (!e.buttons) B.moveU = null;
        return kind !== 'move' || !!e.buttons;
      }
      if (tool === 'squad' && e.buttons) {
        if (B.selSquad === null || B.selSquad === undefined) { if (kind === 'down') toast('부대 칩을 먼저 선택하세요'); return true; }
        const r = 10 + Math.sqrt(B.brush) * 14;
        for (const u of B.b.units) if (u.team === 0 && !u.def.structure && (u.x - p.x) ** 2 + (u.y - p.y) ** 2 < (r + u.r) ** 2) u.sq = B.selSquad;
        B.snapshot = B.takeSnapshot(); this.renderPanel(true);
        return true;
      }
      if (tool === 'terrain' && e.buttons && B.mode === 'sandbox') {
        if (!B.baseTerrain) B.baseTerrain = new SW.Terrain(B.b.W, B.b.H);
        const r = 14 + Math.sqrt(B.brush) * 18;
        B.baseTerrain.paint(p.x, p.y, r, B.paintType);
        if (!B.b.terrain) B.b.terrain = SW.Terrain.from(B.baseTerrain.serialize()); else B.b.terrain.paint(p.x, p.y, r, B.paintType);
        return true;
      }
      if (tool === 'point' && kind === 'down' && B.mode === 'sandbox') {
        B.rules.points.push({ x: p.x, y: p.y, r: 80, name: `거점 ${B.rules.points.length + 1}` });
        B.rebuild(); toast('거점 추가'); return true;
      }
      return false;
    },

    // ── 매 프레임 ──
    afterFrame(b, dt) {
      this.t = (this.t || 0) + dt;
      if (this.t > 0.3) { this.t = 0; this.renderPanel(); }
      this.drawMinimap(b);
    },
    miniClick(e) {
      const r = this.mini.getBoundingClientRect(), v = B.replayView || B.b;
      const x = (e.clientX - r.left) / r.width * v.W, y = (e.clientY - r.top) / r.height * v.H;
      if (B.r.zoom <= 1) B.r.zoom = 2.2;
      B.r.camX = x; B.r.camY = y;
    },
    drawMinimap(b) {
      const cv = this.mini, show = b.W > 1700 || b.units.length > 250 || b.front || (b.points && b.points.length) || b.terrain;
      cv.hidden = !show; if (!show) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = w / b.W, sy = h / b.H;
      ctx.fillStyle = '#10151e'; ctx.fillRect(0, 0, w, h);
      if (b.terrain) { const tc = b.terrain.canvas(); if (tc) ctx.drawImage(tc, 0, 0, w, h); }
      if (b.front) for (const x of b.front.bands) if (x.owner >= 0) { ctx.fillStyle = x.owner === 0 ? 'rgba(80,140,255,.12)' : 'rgba(255,90,90,.12)'; ctx.fillRect(0, x.y0 * sy, w, (x.y1 - x.y0) * sy); }
      const step = Math.max(1, Math.floor(b.units.length / 900));
      for (let i = 0; i < b.units.length; i += step) {
        const u = b.units[i];
        ctx.fillStyle = u.def.structure ? '#aaa' : u.commander ? '#ffe066' : u.team === 0 ? '#5d95ff' : '#ff6060';
        const s = u.commander || u.def.boss ? 4 : u.def.structure ? 2.5 : 1.6;
        ctx.fillRect(u.x * sx - s / 2, u.y * sy - s / 2, s, s);
      }
      if (b.points) for (const p of b.points) { ctx.strokeStyle = p.owner === 0 ? '#8cb4ff' : p.owner === 1 ? '#ff8f8f' : '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 5, 0, Math.PI * 2); ctx.stroke(); }
      if (b.front) { const bs = b.front.bands.filter(x => x.x !== null); ctx.strokeStyle = 'rgba(255,240,180,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); bs.forEach((x, i) => { const y = (x.y0 + x.y1) / 2 * sy; i ? ctx.lineTo(x.x * sx, y) : ctx.moveTo(x.x * sx, y); }); ctx.stroke(); }
      if (b.squads) for (const q of b.squads) if (q.alive && q.team === 0) { ctx.fillStyle = q.color; ctx.font = 'bold 9px sans-serif'; ctx.fillText('▲', q.cx * sx - 4, q.cy * sy + 3); }
      // 카메라 영역
      const R = B.r; if (R.cw) { const x0 = -R.ox / R.scale, y0 = -R.oy / R.scale; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x0 * sx, y0 * sy, R.cw / R.scale * sx, R.ch / R.scale * sy); }
    },

    // ── 리플레이 ──
    startReplay(R) {
      B.replayView = new SW.ReplayView(R); B.replaySel = undefined; document.body.classList.add('replaying');
      $('#b-result').hidden = true; this.panel.hidden = true; this.rbar.hidden = false;
      const evMarks = (R.events || []).filter(e => e.kind !== 'order' && e.kind !== 'ai').slice(0, 60).map(e => `<i style="left:${e.t / R.end * 100}%" title="${Math.floor(e.t)}s ${e.text}"></i>`).join('');
      this.rbar.innerHTML = `<button data-r="play">⏸</button><div class="rb-track"><input type="range" min="0" max="${R.end}" step="0.05" value="0"><div class="rb-ev">${evMarks}</div></div><span class="rb-t">0:00</span>
        <select data-r="spd"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select><button data-r="save" title="브라우저 보관함에 저장">💾</button><button data-r="dl" title="파일로 내려받기 (공유용)">⬇</button><button data-r="exit">✕ 종료</button>`;
      const v = B.replayView, rng = this.rbar.querySelector('input');
      this.rbar.querySelector('[data-r=play]').onclick = (e) => { if (v.time >= v.duration) v.seek(0); v.playing = !v.playing; e.target.textContent = v.playing ? '⏸' : '▶'; };
      this.rbar.querySelector('[data-r=spd]').onchange = (e) => { v.speed = +e.target.value; };
      rng.oninput = () => { v.seek(+rng.value); };
      this.rbar.querySelector('[data-r=exit]').onclick = () => { B.replayView = null; this.rbar.hidden = true; document.body.classList.remove('replaying'); if (this.replayBack) { const bk = this.replayBack; this.replayBack = null; SW.ui.go(bk); return; } $('#b-result').hidden = false; this.renderPanel(true); };
      this.rbar.querySelector('[data-r=save]').onclick = async () => { try { await SW.Replay.save(R, $('#b-name').textContent || '전투'); toast('📼 리플레이 보관함에 저장했습니다'); } catch (e) { toast('저장할 수 없습니다 (브라우저 저장소 사용 불가)'); } };
      this.rbar.querySelector('[data-r=dl]').onclick = async () => { const blob = await SW.Replay.pack(R); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `도형전쟁_리플레이_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.gwrep`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
      toast('🎬 리플레이: 유닛을 클릭하면 이동 경로가 표시됩니다');
    },
    // 보관함·파일에서 단독으로 리플레이 열기
    openReplay(R, back = 'replays') {
      B.open('scenario', { title: '🎬 리플레이', sub: `${Math.round(R.end || 0)}초 · 유닛 ${R.meta.length} · ${new Date(R.created || Date.now()).toLocaleString()}`, W: R.W, H: R.H, units: [], allowEmptyEnemy: true, palette: 'none', restoreDeploy: false });
      SW.ui.go('battle');
      this.replayBack = back;
      this.startReplay(R);
    },
    updateReplayBar() {
      const v = B.replayView; if (!v || this.rbar.hidden) return;
      const rng = this.rbar.querySelector('input'); if (document.activeElement !== rng) rng.value = v.time;
      this.rbar.querySelector('.rb-t').textContent = `${Math.floor(v.time / 60)}:${String(Math.floor(v.time % 60)).padStart(2, '0')} / ${Math.floor(v.duration / 60)}:${String(Math.floor(v.duration % 60)).padStart(2, '0')}`;
      this.rbar.querySelector('[data-r=play]').textContent = v.playing ? '⏸' : '▶';
    },

    // ── 커스텀 전투 규칙 (샌드박스) ──
    renderRules() {
      const R = B.rules, D = this.rules;
      const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v.icon ? v.icon + ' ' : ''}${v.name || v}</option>`).join('');
      const scen = Object.keys(save.data.scenarios || {});
      D.innerHTML = `<summary>⚙ 커스텀 전투 규칙</summary>
        <label>지형 <select data-k="preset"><option value="none">없음</option>${opt(SW.TERRAIN_PRESETS, R.terrainPreset)}</select></label>
        <label>칠할 지형 <select data-k="paint">${SW.TERRAIN_PAINT.map(id => `<option value="${id}" ${id === B.paintType ? 'selected' : ''}>${SW.TERRAIN_TYPES[SW.TERRAIN_ID[id]].name}</option>`).join('')}</select></label>
        <label>날씨 <select data-k="weather">${opt(SW.WEATHER, R.weather)}</select></label>
        <label>시간 <select data-k="time">${opt(SW.TIMES, R.time)}</select></label>
        <label>승리 조건 <select data-k="victory"><option value="annihilate">전멸</option><option value="commander" ${R.victory === 'commander' ? 'selected' : ''}>지휘관 격파</option><option value="war" ${R.victory === 'war' ? 'selected' : ''}>지휘관·거점 점수</option></select></label>
        <label class="chk"><input type="checkbox" data-k="morale" ${R.morale ? 'checked' : ''}> 사기·패주·포위 규칙</label>
        <label class="chk"><input type="checkbox" data-k="supply" ${R.supply ? 'checked' : ''}> 보급 규칙 (보급 기지·보급선)</label>
        <label>파란 팀 능력치 <input type="number" data-k="mul0" min="25" max="400" step="25" value="${R.statMul ? Math.round(R.statMul[0].hp * 100) : 100}">%</label>
        <label>빨간 팀 능력치 <input type="number" data-k="mul1" min="25" max="400" step="25" value="${R.statMul ? Math.round(R.statMul[1].hp * 100) : 100}">%</label>
        <div class="row"><button class="btn small" data-a="point">＋거점</button><button class="btn small" data-a="clearpts">거점 삭제</button></div>
        <div class="row"><button class="btn small" data-a="save">💾 시나리오 저장</button><select data-k="load"><option value="">불러오기…</option>${scen.map(n => `<option>${n}</option>`).join('')}</select></div>
        <div class="row"><button class="btn small" data-a="export">⇪ 내보내기</button><button class="btn small" data-a="import">⇩ 가져오기</button></div>`;
      const set = (k, fn) => { const x = D.querySelector(`[data-k=${k}]`); if (x) x.onchange = () => fn(x); };
      set('preset', (x) => { R.terrainPreset = x.value; B.baseTerrain = x.value === 'none' ? null : new SW.Terrain(B.b.W, B.b.H).generate(x.value, (Math.random() * 1e6) | 0); B.rebuild(); });
      set('paint', (x) => { B.paintType = x.value; B.tool = 'terrain'; segOn('#tool-seg', $('#tool-seg [data-tool=terrain]')); });
      set('weather', (x) => { R.weather = x.value; B.rebuild(); });
      set('time', (x) => { R.time = x.value; B.rebuild(); });
      set('victory', (x) => { R.victory = x.value; B.rebuild(); });
      set('morale', (x) => { R.morale = x.checked; B.rebuild(); });
      set('supply', (x) => { R.supply = x.checked; B.rebuild(); });
      const mul = () => { const a = +D.querySelector('[data-k=mul0]').value / 100, c = +D.querySelector('[data-k=mul1]').value / 100; R.statMul = a === 1 && c === 1 ? null : [{ hp: a, dmg: a }, { hp: c, dmg: c }]; B.rebuild(); };
      set('mul0', mul); set('mul1', mul);
      set('load', (x) => { if (x.value) this.loadScenario(save.data.scenarios[x.value]); });
      const act = (a, fn) => { const x = D.querySelector(`[data-a=${a}]`); if (x) x.onclick = fn; };
      act('point', () => { B.tool = 'point'; toast('지도를 클릭해 거점을 추가하세요'); });
      act('clearpts', () => { R.points = []; B.rebuild(); });
      act('save', () => { const n = prompt('시나리오 이름', `시나리오 ${scen.length + 1}`); if (!n) return; save.data.scenarios[n] = this.exportScenario(); save.write(); this.renderRules(); toast('저장됨'); });
      act('export', () => { const txt = btoa(unescape(encodeURIComponent(JSON.stringify(this.exportScenario())))); prompt('아래 코드를 복사해 공유하세요', txt); });
      act('import', () => { const t = prompt('시나리오 코드를 붙여넣으세요'); if (!t) return; try { this.loadScenario(JSON.parse(decodeURIComponent(escape(atob(t.trim()))))); toast('불러왔습니다'); } catch (e) { toast('잘못된 코드입니다'); } });
    },
    exportScenario() {
      return { v: 3, map: B.map, snapshot: B.takeSnapshot().map(u => ({ ...u, x: Math.round(u.x), y: Math.round(u.y) })), forms: B.forms, rules: B.rules, terrain: B.baseTerrain ? B.baseTerrain.serialize() : null, squads: B.squadDefs || [], custom: Object.fromEntries(Object.entries(SW.UNITS).filter(([, u]) => u.custom && B.b.units.some(x => x.def.id === u.id)).map(([k]) => [k, save.data.customUnits[k]])) };
    },
    loadScenario(o) {
      if (!o) return;
      if (o.custom) for (const [k, v] of Object.entries(o.custom)) if (v) { save.data.customUnits[k] = v; SW.registerCustomUnits(); }
      B.map = o.map || '1600x900'; $('#sb-map').value = B.map;
      B.snapshot = (o.snapshot || []).filter(u => SW.UNITS[u.type]); B.forms = o.forms || ['free', 'free'];
      B.rules = Object.assign({ weather: 'clear', time: 'day', morale: false, victory: 'annihilate', statMul: null, points: [], terrainPreset: 'none' }, o.rules || {});
      B.baseTerrain = o.terrain ? SW.Terrain.from(o.terrain) : null; B.squadDefs = o.squads || [];
      B.rebuild(); B.r.resetView(); this.renderRules(); B.renderPalette();
    },
  };

  // 커스텀 유닛 등록 (유닛 편집기)
  SW.registerCustomUnits = () => {
    for (const [id, d] of Object.entries(save.data.customUnits || {})) {
      if (!d) continue;
      const u = JSON.parse(JSON.stringify(d));
      u.custom = true; u.summonOnly = false;
      delete u.id; SW.UNITS[id] = u;
      SW.normalizeUnit(id, u);
    }
  };
  SW.registerCustomUnits();
  UI.init();
})();
