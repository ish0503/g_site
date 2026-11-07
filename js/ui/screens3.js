// ─────────────────────────────────────────────
// 3.0 화면: 메뉴 리뉴얼 · 전쟁 시뮬레이션 · 캠페인 · 공성전 · 토너먼트 · 전술 퍼즐 · AI 대전
//           연속 보스전 · 무한 전쟁 · 군대 관리(성장·장비) · 유닛 편집기 · 밸런스 분석기
// ─────────────────────────────────────────────
(() => {
  const { $, $$, el, toast, fmt, icon, go, updateGold, unitCard } = SW.ui;
  const B = SW.ui.Battle;
  const save = SW.save;
  const S = SW.screens = {};
  const { clamp } = SW.util;

  // 공용: 화면 생성
  function screen(id, title, back = 'menu', extraHead = '') {
    const sc = el('section', 'screen'); sc.id = 'screen-' + id;
    sc.innerHTML = `<header class="bar"><button class="btn" data-go="${back}">← <span class="lbl">뒤로</span></button><h2>${title}</h2><div class="spacer"></div>${extraHead}<span class="resbar"></span></header><div class="scr-body" id="${id}-body"></div>`;
    $('#app').insertBefore(sc, $('#toast'));
    return sc;
  }
  const resHTML = () => { const r = save.data.res || {}; return `<span>💰${fmt(save.data.gold)}</span>` + ['food', 'wood', 'ore', 'mana', 'crystal'].map(k => `<span title="${SW.RESOURCES[k].name}">${SW.RESOURCES[k].icon}${fmt(r[k] || 0)}</span>`).join(''); };
  const refreshRes = () => $$('.resbar').forEach(e => e.innerHTML = resHTML());
  const unlockedIds = () => { const m = save.mods(); return SW.unitList().filter(u => m.unlocks.has(u.id) && !u.custom).map(u => u.id); };
  const zoneL = (W) => ({ x0: 20, x1: W * 0.38 }), zoneR = (W) => ({ x0: W * 0.62, x1: W - 20 });
  // 군대(편성기 결과)를 시나리오 유닛·부대로 변환
  function addArmy(units, squads, A, team, prefix = '') {
    const off = squads.length;
    A.squads.forEach(q => squads.push({ team, name: prefix + q.name, order: q.kind === 'command' ? 'hold' : 'free' }));
    for (const u of A.units) units.push({ ...u, team, sq: u.sq + off });
  }
  const goBattle = (sc) => { B.open('scenario', sc); go('battle'); };
  const rewardRows = (res) => { SW.gain(res); save.write(); updateGold(); return `<div>보상 <b>${SW.costText(res)}</b></div>`; };

  // ── 메뉴 리뉴얼 ──
  const MENU = [
    ['⚔️ 전투', [['stages', '챌린지', '26 스테이지'], ['raids', '보스 레이드', '보스 5종 · 연속 보스전'], ['survival', '생존 모드', '끝없는 웨이브'], ['infinite', '무한 전쟁', '증원과 함께 버티기'], ['puzzles', '전술 퍼즐', '제한된 병력 미션']]],
    ['🗺 전쟁', [['war', '전쟁 시뮬레이션', '수천 기 군단 지휘'], ['campaign', '캠페인', '세계 정복 · 외교'], ['siege', '공성전', '요새 공격·방어'], ['tourney', '토너먼트', '8개 군대 대진'], ['aivsai', 'AI 대전', '자율 AI 전쟁 · 학습']]],
    ['🛠 창작 · 성장', [['sandbox', '샌드박스 · 커스텀', '지형·날씨·규칙 편집'], ['editor', '유닛 편집기', '나만의 유닛'], ['army', '군대 관리', '레벨·진화·장비'], ['tree', '스킬 트리', ''], ['codex', '유닛 도감', '']]],
    ['📊 기타', [['balance', '밸런스 분석기', '병종 상성 행렬'], ['help', '게임 방법', '']]],
  ];
  (function renewMenu() {
    const box = $('.menu-buttons');
    const setBtn = $('#btn-settings');
    box.textContent = '';
    box.classList.add('menu3');
    for (const [cat, items] of MENU) {
      box.appendChild(el('div', 'menu-cat', cat));
      const g = el('div', 'menu-grid');
      for (const [id, name, sub] of items) { const b = el('button', 'btn mbtn', `<b>${name}</b>${sub ? `<small>${sub}</small>` : ''}`); b.dataset.go = id; g.appendChild(b); }
      box.appendChild(g);
    }
    setBtn.className = 'btn mbtn small-set'; setBtn.innerHTML = '⚙️ 설정 · 저장 관리'; box.appendChild(setBtn);
    $('.logo').insertAdjacentHTML('afterend', '');
    $('.ver').textContent = '3.0';
    $('.subtitle').insertAdjacentHTML('beforeend', '<br><small class="muted">Beyond the Battlefield</small>');
  })();
  // 설정 창에 저장 관리 추가
  (function settings3() {
    const box = $('#settings .box');
    const d = el('div', 'save-mgr', `<b>💾 저장 관리</b><div class="row"><button class="btn small" id="sv-exp">내보내기</button><button class="btn small" id="sv-imp">가져오기</button><button class="btn small" id="sv-bak">자동 백업 복원</button></div>`);
    box.insertBefore(d, box.querySelector('.btns'));
    d.querySelector('#sv-exp').onclick = () => prompt('저장 코드 (복사해 보관하세요)', save.exportText());
    d.querySelector('#sv-imp').onclick = () => { const t = prompt('저장 코드를 붙여넣으세요'); if (!t) return; try { save.importText(t); toast('불러왔습니다'); location.reload(); } catch (e) { toast('잘못된 코드'); } };
    d.querySelector('#sv-bak').onclick = () => {
      const list = save.backups(); if (!list.length) { toast('백업이 없습니다'); return; }
      const k = prompt('복원할 백업 번호:\n' + list.map((x, i) => `${i}: ${x.replace('shapewar_save_v1_', '')}`).join('\n'), '0');
      if (k !== null && list[+k]) { save.restore(list[+k]); location.reload(); }
    };
  })();
  // 레이드 화면: 연속 보스전 버튼
  (function raidExtra() {
    const head = $('#screen-raids .bar');
    const b = el('button', 'btn danger', '🔥 연속 보스전'); b.onclick = () => S.bossRush(); head.insertBefore(b, head.querySelector('.gold'));
  })();

  // ═════ 전쟁 시뮬레이션 ═════
  const War = { sid: 'field', scale: 0.5, epers: 'balanced', mypers: 'balanced', growth: false, army: null };
  S.make_war = () => screen('war', '🗺 전쟁 시뮬레이션');
  S.war = () => {
    refreshRes();
    const body = $('#war-body'), sc = SW.WAR_SCENARIOS.find(s => s.id === War.sid);
    const W = sc.W, H = sc.H;
    if (!War.army || War.army.sid !== War.sid + War.scale + War.mypers) {
      War.army = SW.buildArmy({ team: 0, budget: sc.player * War.scale, pers: War.mypers, W, H, zone: zoneL(W) });
      War.army.sid = War.sid + War.scale + War.mypers;
    }
    const A = War.army;
    const cnt = (q) => A.units.filter(u => u.sq === A.squads.indexOf(q)).length;
    const pers = (cur) => Object.entries(SW.AI_PERSONALITIES).filter(([k]) => k !== 'adaptive').map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v.name} — ${v.desc}</option>`).join('');
    const unitOpts = (cur) => SW.unitList().filter(u => !u.custom).map(u => `<option value="${u.id}" ${u.id === cur ? 'selected' : ''}>${u.name}</option>`).join('');
    body.innerHTML = `<div class="cards">${SW.WAR_SCENARIOS.map(s => `<div class="card scen ${s.id === War.sid ? 'on' : ''}" data-s="${s.id}"><div><div class="cn">${s.name}</div><div class="cd">${s.desc}</div>
        <div class="tags"><span class="tag">${SW.TERRAIN_PRESETS[s.terrain]}</span><span class="tag">${SW.WEATHER[s.weather].icon}${SW.WEATHER[s.weather].name}</span><span class="tag">${SW.TIMES[s.time].icon}${SW.TIMES[s.time].name}</span><span class="tag">아군 ~${Math.round(s.player / 1.5)}기 vs 적 ~${Math.round(s.enemy / 1.5)}기 (100%)</span></div></div></div>`).join('')}</div>
      <div class="panel form3">
        <label>전쟁 규모 <select id="w-scale"><option value="0.25">25% (가벼움)</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100% (1000 vs 1200 규모)</option></select></label>
        <label>적 지휘관 성향 <select id="w-ep">${pers(War.epers)}<option value="adaptive" ${War.epers === 'adaptive' ? 'selected' : ''}>학습형 — 과거 전투에서 가장 강했던 전략</option></select></label>
        <label>내 군대 편성 방식 <select id="w-mp">${pers(War.mypers)}</select></label>
        <label class="chk"><input type="checkbox" id="w-gr" ${War.growth ? 'checked' : ''}> 내 성장(레벨·장비·스킬 트리) 적용</label>
      </div>
      <h3>나의 군대 — ${A.units.length}기 · ${A.squads.length}개 부대</h3>
      <div class="squad-edit">${A.squads.map((q, i) => q.kind === 'command' ? `<div class="sqe"><b>👑 ${q.name}</b> <span class="muted">지휘관</span></div>` : `<div class="sqe"><b style="color:${SW.SQUAD_COLORS[i % 8]}">${q.name}</b>
        <select data-i="${i}" data-k="type">${unitOpts(q.units[0])}</select> <input type="number" data-i="${i}" data-k="n" min="1" max="600" value="${cnt(q)}"> 기</div>`).join('')}</div>
      <div class="btns"><button class="btn" id="w-regen">🎲 재편성</button><button class="btn primary big" id="w-go">⚔ 전쟁 시작</button></div>
      <p class="muted small">전투 중 하단 패널로 부대를 선택하고 명령(전면 공격·방어 유지·측면·후방 기습·집결·호위·예비대…)과 지휘관 능력을 사용하세요. 전략 지도(오른쪽 아래)를 클릭하면 이동합니다.</p>`;
    $('#w-scale').value = War.scale;
    body.querySelectorAll('.scen').forEach(c => c.onclick = () => { War.sid = c.dataset.s; S.war(); });
    $('#w-scale').onchange = (e) => { War.scale = +e.target.value; S.war(); };
    $('#w-ep').onchange = (e) => { War.epers = e.target.value; };
    $('#w-mp').onchange = (e) => { War.mypers = e.target.value; War.army = null; S.war(); };
    $('#w-gr').onchange = (e) => { War.growth = e.target.checked; };
    $('#w-regen').onclick = () => { War.army = null; S.war(); };
    body.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => {
      const i = +inp.dataset.i, q = A.squads[i];
      const type = body.querySelector(`select[data-i="${i}"]`).value, n = clamp(+body.querySelector(`input[data-i="${i}"]`).value || 1, 1, 600);
      const old = A.units.filter(u => u.sq === i);
      const cx = old.reduce((s, u) => s + u.x, 0) / old.length, cy = old.reduce((s, u) => s + u.y, 0) / old.length;
      A.units = A.units.filter(u => u.sq !== i);
      const d = SW.UNITS[type], gap = d.size * 2 + 4, cols = Math.max(1, Math.ceil(Math.sqrt(n * 0.35))), rows = Math.ceil(n / cols);
      for (let k = 0; k < n; k++) A.units.push({ type, team: 0, x: clamp(cx - (k % cols) * gap, 25, W * 0.38), y: clamp(cy + (Math.floor(k / cols) - rows / 2) * gap, 12, H - 12), sq: i });
      q.units = [type];
      S.war();
    });
    $('#w-go').onclick = () => S.startWar(sc);
  };
  S.startWar = (sc) => {
    const W = sc.W, H = sc.H, seed = (Math.random() * 1e9) | 0;
    const terrain = new SW.Terrain(W, H).generate(sc.terrain, seed);
    const units = [], squads = [];
    addArmy(units, squads, { units: War.army.units, squads: War.army.squads }, 0);
    let ezone = zoneR(W);
    if (sc.fort) {
      const F = SW.buildFort(W, H, 'right', 1, terrain, 1.1);
      for (const u of F.units) units.push(u);
      ezone = { x0: F.inner.x0 + 40, x1: F.inner.x1 - 20 };
    }
    const EA = SW.buildArmy({ team: 1, budget: sc.enemy * War.scale, pers: War.epers === 'adaptive' ? SW.pickLearned(War.mypers) : War.epers, W, H: sc.fort ? H : H, zone: ezone });
    if (sc.fort) { for (const u of EA.units) { u.y = clamp(u.y, H * 0.22, H * 0.78); } }
    addArmy(units, squads, EA, 1, '적 ');
    const clean = units.filter(u => !terrain.blocked(u.x, u.y));
    goBattle({
      title: `🗺 ${sc.name}`, sub: `${sc.desc} · 승리: 적 지휘관 격파 / 거점 점수 100 / 적 전멸`, W, H, terrain: terrain.serialize(), weather: sc.weather, time: sc.time,
      units: clean, squads, palette: 'none', lockMsg: '전쟁 모드: 편성 화면에서 군대를 구성합니다. ✥이동 도구로 유닛을, 부대 패널로 명령을 내리세요.',
      zone: zoneL(W), morale: true, command: true, frontline: true, ai: [null, EA.pers], victory: { type: 'war', scoreWin: 100 },
      points: sc.points.map(([x, y], i) => ({ x: x * W, y: y * H, r: 110, name: ['북부 거점', '중앙 거점', '남부 거점'][sc.points.length === 1 ? 1 : sc.points.length === 2 ? i * 2 : i] })),
      mods: [War.growth ? save.mods() : null, null], timeLimit: 900, xp: War.growth,
      onFinish(b, win) {
        SW.recordLearn(EA.pers, !win, War.mypers);
        const res = win ? { gold: Math.round(800 * War.scale), ore: 20, wood: 20, crystal: War.scale >= 1 ? 2 : 1 } : { gold: Math.round(200 * War.scale) };
        return { title: win ? '<h2 class="win">전쟁 승리!</h2>' : '<h2 class="lose">전쟁 패배</h2>', rows: rewardRows(res) + `<div>거점 점수 <b>${Math.round(b.score[0])} : ${Math.round(b.score[1])}</b></div>`, buttons: [{ text: '편성 화면', fn: () => go('war') }] };
      },
    });
  };

  // ═════ 공성전 ═════
  S.make_siege = () => screen('siege', '🏰 공성전');
  S.siege = () => {
    refreshRes();
    $('#siege-body').innerHTML = `<div class="cards">${SW.SIEGES.map(s => `<div class="card scen" data-s="${s.id}"><div><div class="cn">${s.name}</div><div class="cd">${s.desc}</div><div class="tags"><span class="tag">인원 ${s.pop + save.mods().popBonus}</span><span class="tag">제한 ${Math.round(s.time / 60)}분</span><span class="tag">보상 ${SW.costText(s.reward)}</span></div></div></div>`).join('')}</div>
      <p class="muted">성벽·성문·방어탑·성채는 파괴할 수 있습니다. 공성 유닛(투석기·포병·공성 골렘·돌격병·발리스타)은 구조물에 큰 피해를 주며 공성전에서는 항상 사용할 수 있습니다. 성벽 안쪽(요새 지형)의 유닛은 고지·엄폐 효과를 받고, 성문 앞에는 함정이 있습니다.</p>`;
    $$('#siege-body .scen').forEach(c => c.onclick = () => S.startSiege(SW.SIEGES.find(s => s.id === c.dataset.s)));
  };
  S.startSiege = (sg) => {
    const W = 1600, H = 900, terrain = new SW.Terrain(W, H).generate('plain', (Math.random() * 1e9) | 0);
    const def = sg.defender, side = def === 1 ? 'right' : 'left';
    const F = SW.buildFort(W, H, side, def, terrain);
    const units = [...F.units];
    const inner = F.inner;
    if (def === 1) {
      for (const [t, n] of sg.garrison) for (let i = 0; i < n; i++) {
        const d = SW.UNITS[t], ranged = d.range > 40;
        const x = ranged ? F.face + 30 + Math.random() * 40 : inner.x0 + 80 + Math.random() * (inner.x1 - inner.x0 - 140);
        units.push({ type: t, team: 1, x, y: inner.y0 + 30 + Math.random() * (inner.y1 - inner.y0 - 60) });
      }
    } else {
      for (const [t, n] of sg.attackers) for (let i = 0; i < n; i++) units.push({ type: t, team: 1, x: W * 0.68 + Math.random() * W * 0.28, y: 60 + Math.random() * (H - 120) });
    }
    const pal = [...new Set([...unlockedIds(), ...SW.SIEGE_UNITS])];
    goBattle({
      title: `🏰 ${sg.name}`, sub: sg.desc, W, H, terrain: terrain.serialize(), units: units.filter(u => !terrain.blocked(u.x, u.y)),
      allowed: pal, pop: sg.pop + save.mods().popBonus, zone: def === 0 ? { x0: inner.x0 + 20, x1: inner.x1 - 10 } : { x0: 0, x1: W * 0.36 },
      morale: true, victory: { type: 'keep', defender: def }, timeLimit: sg.time, xp: true, key: 'siege_' + sg.id,
      setup: (b) => SW.setupTraps(b, F.traps, def),
      onFinish(b, win) { const res = win ? sg.reward : { gold: Math.round(sg.reward.gold * 0.25) }; return { rows: rewardRows(res), buttons: [{ text: '공성전 목록', fn: () => go('siege') }] }; },
    });
  };

  // ═════ 연속 보스전 · 무한 전쟁 ═════
  S.bossRush = () => {
    goBattle({
      title: '🔥 연속 보스전', sub: '보스 5종을 연달아 격파하라. 보스 사이에 아군 체력 30% 회복.', W: 1600, H: 900, units: [], allowEmptyEnemy: true,
      pop: SW.BOSS_RUSH.pop + save.mods().popBonus, palette: 'unlocked', endless: true, timeLimit: 1200, xp: true, key: 'bossrush',
      setup: (b) => { const sp = SW.setupBossRush(b); sp(); },
      onFinish(b, win) {
        const n = b.bossRush ? b.bossRush.i + (b.bossRush.done ? 0 : 0) : 0;
        const res = b.bossRush && b.bossRush.done ? SW.BOSS_RUSH.reward : { gold: 300 * n, crystal: n };
        return { title: b.bossRush && b.bossRush.done ? '<h2 class="win">연속 보스전 완주!</h2>' : `<h2 class="lose">${n}번째 보스까지 격파</h2>`, rows: rewardRows(res), buttons: [{ text: '레이드 목록', fn: () => go('raids') }] };
      },
    });
  };
  S.make_infinite = () => screen('infinite', '♾ 무한 전쟁');
  S.infinite = () => {
    const I = SW.INFINITE;
    goBattle({
      title: '♾ 무한 전쟁', sub: `넓은 전장에서 끝없이 커지는 적 군단을 막아라. 웨이브마다 증원 ${I.reinforce} 인원.`, W: I.W, H: I.H, units: [], allowEmptyEnemy: true,
      pop: I.pop + save.mods().popBonus, palette: 'unlocked', endless: true, morale: true, timeLimit: 1e9, xp: true, key: 'infinite', zone: { x0: 0, x1: I.W * 0.35 },
      onStart: (b) => SW.setupSurvival(b, null, { scale: I.scale, reinforce: I.reinforce, pool: unlockedIds() }),
      onFinish(b) {
        const w = Math.max(0, b.survival.wave - 1);
        const best = w > (save.data.infiniteBest || 0); if (best) save.data.infiniteBest = w;
        return { title: `<h2 class="${w >= 5 ? 'win' : 'lose'}">무한 전쟁: ${w} 웨이브</h2>`, rows: (best ? '<div>🏆 신기록!</div>' : '') + rewardRows({ gold: Math.round(30 * w * (1 + w / 6)), ore: w * 3, crystal: Math.floor(w / 5) }), buttons: [{ text: '메뉴', fn: () => go('menu') }] };
      },
    });
  };
  // 메뉴 항목에서 바로 시작
  S.make_infinite = null;
  const origGo = SW.ui.go;

  // ═════ 전술 퍼즐 ═════
  S.make_puzzles = () => screen('puzzles', '🧩 전술 퍼즐');
  S.puzzles = () => {
    refreshRes();
    $('#puzzles-body').innerHTML = `<div class="cards">${SW.PUZZLES.map(p => `<div class="card scen ${save.data.puzzles[p.id] ? 'done' : ''}" data-p="${p.id}"><div><div class="cn">${save.data.puzzles[p.id] ? '✔ ' : ''}${p.name}</div><div class="cd">${p.desc}</div><div class="tags"><span class="tag">🎯 ${p.goal}</span><span class="tag">보상 ${SW.costText(p.reward)}</span></div></div></div>`).join('')}</div>
      <p class="muted">전술 퍼즐에서는 유닛을 추가할 수 없습니다. 주어진 병력의 위치(✥이동)·진형·부대 명령만으로 목표를 달성하세요.</p>`;
    $$('#puzzles-body .scen').forEach(c => c.onclick = () => S.startPuzzle(SW.PUZZLES.find(p => p.id === c.dataset.p)));
  };
  S.startPuzzle = (pz) => {
    const W = 1600, H = 900;
    let terrain = null;
    const units = [];
    if (pz.terrain === 'hills') { terrain = new SW.Terrain(W, H); terrain.paint(330, 450, 170, 'hill'); terrain.paint(520, 250, 90, 'forest'); terrain.paint(520, 650, 90, 'forest'); }
    else if (pz.terrain) terrain = new SW.Terrain(W, H).generate(pz.terrain, 42);
    let F = null;
    if (pz.siege) { terrain = terrain || new SW.Terrain(W, H); F = SW.buildFort(W, H, 'right', 1, terrain, 0.75); units.push(...F.units); }
    for (const [type, n, cx, cy, cols, vip] of pz.blue) { const d = SW.UNITS[type], g = d.size * 2 + 6, c = Math.max(1, cols), rows = Math.ceil(n / c); for (let i = 0; i < n; i++) units.push({ type, team: 0, x: cx - (i % c) * g, y: cy + (Math.floor(i / c) - (rows - 1) / 2) * g, vip: !!vip, fixed: true }); }
    for (const [type, n, cx, cy, cols] of pz.red) {
      if (F) { for (let i = 0; i < n; i++) units.push({ type, team: 1, x: F.face + 40 + Math.random() * (F.inner.x1 - F.face - 80), y: F.inner.y0 + 40 + Math.random() * (F.inner.y1 - F.inner.y0 - 80) }); continue; }
      if (pz.id === 'p1' && type === 'soldier') { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; units.push({ type, team: 1, x: cx + Math.cos(a) * 130, y: cy + Math.sin(a) * 130 }); } continue; }
      const d = SW.UNITS[type], g = d.size * 2 + 6, c = Math.max(1, cols), rows = Math.ceil(n / c);
      for (let i = 0; i < n; i++) units.push({ type, team: 1, x: cx + (i % c) * g, y: cy + (Math.floor(i / c) - (rows - 1) / 2) * g });
    }
    goBattle({
      title: `🧩 ${pz.name}`, sub: `목표: ${pz.goal} — ${pz.desc}`, W, H, terrain: terrain ? terrain.serialize() : null, time: pz.time_ || 'day', units, palette: 'none', restoreDeploy: false,
      zone: { x0: 0, x1: W * 0.42 }, victory: pz.victory || { type: 'annihilate' }, timeLimit: pz.time || 180, morale: !!pz.victory,
      setup: F ? (b) => SW.setupTraps(b, F.traps, 1) : null,
      onFinish(b, win) {
        let ok = win;
        const lost = b.stats[0].lost;
        if (pz.cond && pz.cond.maxLoss !== undefined && lost > pz.cond.maxLoss) ok = false;
        if (pz.cond && pz.cond.timeWin && (b.timeout || b.time > pz.time)) ok = false;
        let rows = `<div>아군 손실 <b>${lost}</b> · 시간 <b>${b.time.toFixed(1)}초</b></div>`;
        if (ok && !save.data.puzzles[pz.id]) { save.data.puzzles[pz.id] = true; rows += rewardRows(pz.reward); }
        else if (ok) rows += '<div class="muted">이미 해결한 퍼즐입니다</div>';
        return { title: ok ? '<h2 class="win">퍼즐 성공!</h2>' : '<h2 class="lose">목표 실패</h2>', rows, buttons: [{ text: '퍼즐 목록', fn: () => go('puzzles') }] };
      },
    });
  };

  // ═════ AI 대전 (자율 AI 전쟁 + 학습) ═════
  const AV = { budget: 300, map: '2400x1350', terrain: 'plain', weather: 'clear', time: 'day', a: 'balanced', b: 'adaptive' };
  S.make_aivsai = () => screen('aivsai', '🤖 AI 대전');
  S.aivsai = () => {
    const sel = (id, obj, cur) => `<select id="${id}">${Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v.icon ? v.icon + ' ' : ''}${v.name || v}</option>`).join('')}</select>`;
    const L = save.data.aiLearn || {};
    $('#aivsai-body').innerHTML = `<div class="panel form3">
      <label>군대 규모 (인원) <input type="number" id="av-b" min="50" max="2500" step="50" value="${AV.budget}"></label>
      <label>전장 <select id="av-m"><option>1600x900</option><option>2400x1350</option><option>3200x1800</option></select></label>
      <label>지형 ${sel('av-t', SW.TERRAIN_PRESETS, AV.terrain)}</label><label>날씨 ${sel('av-w', SW.WEATHER, AV.weather)}</label><label>시간 ${sel('av-tm', SW.TIMES, AV.time)}</label>
      <label>파란 AI 전략 ${sel('av-a', SW.AI_PERSONALITIES, AV.a)}</label><label>빨간 AI 전략 ${sel('av-bb', SW.AI_PERSONALITIES, AV.b)}</label>
      <div class="btns"><button class="btn primary big" id="av-go">▶ 관전 시작</button></div></div>
      <h3>🧠 AI 학습 기록</h3><table class="ana-table"><tr><th>전략</th><th>전투</th><th>승</th><th>승률</th></tr>${['balanced', 'aggressive', 'defensive', 'flanker', 'artillery'].map(k => { const r = L[k] || { w: 0, n: 0 }; return `<tr><td>${SW.AI_PERSONALITIES[k].name}</td><td>${r.n}</td><td>${r.w}</td><td>${r.n ? Math.round(r.w / r.n * 100) + '%' : '-'}</td></tr>`; }).join('')}</table>
      <p class="muted small">AI가 군대를 편성하고 전략을 선택해 스스로 전쟁합니다. 결과는 기록되어 '학습형' AI가 다음 전투에서 승률이 높은 전략을 고르는 데 쓰입니다 (전쟁 시뮬레이션의 적 AI에도 적용).</p>`;
    $('#av-m').value = AV.map;
    $('#av-go').onclick = () => {
      Object.assign(AV, { budget: +$('#av-b').value, map: $('#av-m').value, terrain: $('#av-t').value, weather: $('#av-w').value, time: $('#av-tm').value, a: $('#av-a').value, b: $('#av-bb').value });
      const [W, H] = AV.map.split('x').map(Number);
      const terrain = new SW.Terrain(W, H).generate(AV.terrain, (Math.random() * 1e9) | 0);
      const pa = AV.a === 'adaptive' ? SW.pickLearned(AV.b) : AV.a, pb = AV.b === 'adaptive' ? SW.pickLearned(pa) : AV.b;
      const units = [], squads = [];
      const A0 = SW.buildArmy({ team: 0, budget: AV.budget, pers: pa, W, H, zone: zoneL(W) }), A1 = SW.buildArmy({ team: 1, budget: AV.budget, pers: pb, W, H, zone: zoneR(W) });
      addArmy(units, squads, A0, 0); addArmy(units, squads, A1, 1, '적 ');
      goBattle({
        title: `🤖 ${SW.AI_PERSONALITIES[pa].name} vs ${SW.AI_PERSONALITIES[pb].name}`, sub: '자율 AI 전쟁 — 관전 모드', W, H, terrain: terrain.serialize(), weather: AV.weather, time: AV.time,
        units: units.filter(u => !terrain.blocked(u.x, u.y)), squads, palette: 'none', spectate: true, morale: true, frontline: true, ai: [pa, pb], victory: { type: 'war', scoreWin: 100 },
        points: [{ x: W / 2, y: H / 2, r: 110, name: '중앙 거점' }], timeLimit: 900, restoreDeploy: false,
        onFinish(b) { SW.recordLearn(pa, b.winner === 0, pb); SW.recordLearn(pb, b.winner === 1, pa); save.write(); return { title: `<h2>${b.winner === 0 ? '🔵 ' + SW.AI_PERSONALITIES[pa].name : b.winner === 1 ? '🔴 ' + SW.AI_PERSONALITIES[pb].name : '무승부'} 승리</h2>`, rows: '<div class="muted">결과가 AI 학습 기록에 반영되었습니다</div>', buttons: [{ text: 'AI 대전 설정', fn: () => go('aivsai') }] }; },
      });
      B.logAI = true;
    };
  };

  // ═════ 토너먼트 ═════
  let T = null;
  S.make_tourney = () => screen('tourney', '🏆 토너먼트');
  S.tourney = () => {
    refreshRes();
    const body = $('#tourney-body');
    if (!T) { body.innerHTML = `<div class="panel form3"><p>8개 군대(인원 ${SW.TOURNEY.budget})가 대진표에 따라 겨룹니다. 내 경기는 직접 배치하고 지휘합니다.</p><div class="btns"><button class="btn primary big" id="t-new">참가하기</button><button class="btn" id="t-watch">AI 토너먼트 관전 (시뮬레이션)</button></div></div>`; $('#t-new').onclick = () => { T = SW.Tournament.create(true); S.tourney(); }; $('#t-watch').onclick = () => { T = SW.Tournament.create(false); S.tourney(); }; return; }
    const name = (i) => `${T.teams[i].player ? '⭐ ' : ''}${T.teams[i].name}${T.teams[i].pers ? ` <small>${SW.AI_PERSONALITIES[T.teams[i].pers].name}</small>` : ''}`;
    const round = (ms, title) => `<div class="tround"><h4>${title}</h4>${ms.map(m => `<div class="tmatch"><div class="${m.w === m.a ? 'won' : m.w !== null ? 'lost' : ''}">${name(m.a)}</div><div class="${m.w === m.b ? 'won' : m.w !== null ? 'lost' : ''}">${name(m.b)}</div></div>`).join('')}</div>`;
    const titles = ['8강', '4강', '결승'];
    body.innerHTML = `<div class="bracket">${[...T.rounds, ...(T.done ? [] : [T.matches])].map((ms, i) => round(ms, titles[i])).join('')}</div>
      ${T.done ? `<h3>🏆 우승: ${name(T.champion)}</h3>` : ''}<div class="btns">${T.done ? '<button class="btn primary" id="t-reset">새 토너먼트</button>' : '<button class="btn primary big" id="t-next">다음 경기 ▶</button>'}</div>`;
    const nx = $('#t-next');
    if (nx) nx.onclick = () => {
      const m = T.matches.find(x => x.w === null);
      if (!m) { SW.Tournament.advance(T); S.tourney(); return; }
      const pi = T.teams[m.a].player ? m.a : T.teams[m.b].player ? m.b : -1;
      if (pi < 0) { nx.disabled = true; nx.textContent = '시뮬레이션 중…'; setTimeout(() => { m.w = SW.Tournament.simulate(T, m); if (T.matches.every(x => x.w !== null)) SW.Tournament.advance(T); S.tourney(); }, 30); return; }
      const opp = pi === m.a ? m.b : m.a, W = 1600, H = 900;
      const EA = SW.Tournament.armyFor(T.teams[opp], 1, W, H);
      const units = [], squads = []; addArmy(units, squads, EA, 1, '적 ');
      goBattle({
        title: `🏆 ${titles[T.round]}: vs ${T.teams[opp].name}`, sub: `상대 전략: ${SW.AI_PERSONALITIES[T.teams[opp].pers].name}`, W, H, units, squads, pop: SW.TOURNEY.budget + save.mods().popBonus, palette: 'unlocked',
        ai: [null, T.teams[opp].pers], timeLimit: 180, xp: true, key: 'tourney',
        onFinish(b, win) {
          m.w = win ? pi : opp;
          if (T.matches.every(x => x.w !== null)) SW.Tournament.advance(T);
          let rows = '';
          if (!win || T.done) { const pl = SW.Tournament.placement(T, pi); const rw = SW.TOURNEY.reward[Math.min(2, pl)]; if (rw && (!win || T.done)) rows = `<div>최종 순위 <b>${['우승', '준우승', '4강', '8강'][pl]}</b></div>` + (pl <= 2 ? rewardRows(rw) : ''); }
          return { rows, buttons: [{ text: '대진표', fn: () => go('tourney') }] };
        },
      });
    };
    const rs = $('#t-reset'); if (rs) rs.onclick = () => { T = null; S.tourney(); };
  };

  // ═════ 캠페인 ═════
  let csel = null;
  S.make_campaign = () => screen('campaign', '👑 캠페인 · 세계 정복');
  S.campaign = () => {
    refreshRes();
    const body = $('#campaign-body'), C = SW.Campaign;
    if (!save.data.campaign) {
      body.innerHTML = `<div class="panel form3"><h3>세계 정복 캠페인</h3><p>기하 연합을 이끌고 네 세력(사각 제국·삼각 왕국·오각 마탑·마름모 유목민)과 경쟁하라. 지역을 점령하면 자원과 병력이 늘고, 수도와 연결이 끊긴 지역은 보급을 받지 못한다. 외교로 동맹·휴전·교역을 맺을 수도 있다. 모든 수도를 점령하거나 동맹으로 만들면 승리.</p>
        <label>난이도 <select id="cp-d"><option value="0.8">쉬움</option><option value="1" selected>보통</option><option value="1.3">어려움</option></select></label><div class="btns"><button class="btn primary big" id="cp-new">새 캠페인</button></div></div>`;
      $('#cp-new').onclick = () => { C.newGame(+$('#cp-d').value); S.campaign(); };
      return;
    }
    const st = C.s, sup = C.supplied(), inc = C.income();
    // 대기 중인 방어전
    if (st.pendingDefense.length) {
      const d = st.pendingDefense[0], r = C.region(d.region);
      body.innerHTML = `<div class="panel form3 alert"><h3>⚠ ${SW.FACTIONS[d.attacker].name}의 침공!</h3><p>${r.name}에 적 군대(전력 ${d.power})가 쳐들어왔다. 수비대 ${st.regions[d.region].garrison}, 요새 Lv.${st.regions[d.region].fort}.</p>
        <div class="btns"><button class="btn primary" id="cp-fight">⚔ 직접 방어</button><button class="btn" id="cp-auto">🎲 자동 전투</button></div></div>`;
      $('#cp-fight').onclick = () => { st.pendingDefense.shift(); S.campaignBattle(d.region, d); };
      $('#cp-auto').onclick = () => { st.pendingDefense.shift(); const reg = st.regions[d.region]; const win = C.autoResolve(reg.garrison * (1 + reg.fort * 0.4), d.power); C.resolve(d.region, win, 0, d); toast(win ? '방어 성공' : '지역 상실'); S.campaign(); };
      return;
    }
    const colorOf = (o) => o === 'neutral' ? '#555c6b' : SW.FACTIONS[o].color;
    let svg = '<svg viewBox="0 0 1000 640" class="cmap">';
    for (const r of SW.CAMPAIGN_MAP) for (const n of r.nb) if (r.id < n) { const q = C.region(n); svg += `<line x1="${r.x}" y1="${r.y}" x2="${q.x}" y2="${q.y}" stroke="#2c3648" stroke-width="3"/>`; }
    for (const r of SW.CAMPAIGN_MAP) {
      const reg = st.regions[r.id], o = reg.owner, can = C.canAttack(r.id);
      svg += `<g class="creg ${csel === r.id ? 'sel' : ''} ${can ? 'att' : ''}" data-r="${r.id}"><circle cx="${r.x}" cy="${r.y}" r="${r.special === 'capital' ? 26 : 20}" fill="${colorOf(o)}" stroke="${csel === r.id ? '#fff' : can ? '#ffe680' : '#11151d'}" stroke-width="${csel === r.id || can ? 3 : 2}"/>
        <text x="${r.x}" y="${r.y + 5}" text-anchor="middle" font-size="14">${r.special === 'capital' ? '👑' : r.special === 'fort' || reg.fort >= 2 ? '🏰' : r.special === 'boss' ? '💀' : ''}</text>
        <text x="${r.x}" y="${r.y + 40}" text-anchor="middle" class="cname">${r.name}${o === 'player' && !sup.has(r.id) ? ' ⛓' : ''}</text><text x="${r.x}" y="${r.y + 54}" text-anchor="middle" class="cgar">🛡${Math.round(reg.garrison)}</text></g>`;
    }
    svg += '</svg>';
    const r = csel && C.region(csel), reg = r && st.regions[r.id];
    let side = `<div class="panel cside"><h3>${st.turn}턴 · 영토 ${C.owned().length}/${SW.CAMPAIGN_MAP.length}</h3>
      <div class="muted small">출정 인원 ${C.playerPop()} · 턴 수입 ${SW.costText(Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, Math.round(v * 10) / 10])))} · 식량 유지비 ${C.upkeep()}</div>`;
    if (st.over) side += `<h3>${st.over === 'win' ? '🏆 세계 정복 완료!' : '💀 패배'}</h3><button class="btn" id="cp-reset">새 캠페인</button>`;
    if (r) {
      const o = reg.owner;
      side += `<hr><h3>${r.name}</h3><div class="small">소유: <b style="color:${colorOf(o)}">${o === 'neutral' ? '중립' : SW.FACTIONS[o].name}</b> · 지형 ${SW.TERRAIN_PRESETS[r.terrain] || r.terrain} · 수비대 ${Math.round(reg.garrison)} · 요새 Lv.${reg.fort}${r.special === 'boss' ? ' · 💀 보스 서식지' : ''}</div>`;
      if (C.canAttack(r.id) && !st.over) side += `<button class="btn primary" id="cp-atk">⚔ 공격${reg.fort >= 2 ? ' (공성전)' : ''}</button> <button class="btn" id="cp-auto2">🎲 자동 전투</button>`;
      if (o === 'player') side += `<div class="row"><button class="btn small" id="cp-fort">🏰 요새화 (💰200 🪵40)</button><button class="btn small" id="cp-rec">🛡 징집 (💰150 🌾30)</button></div>`;
    } else side += '<p class="muted">지도에서 지역을 선택하세요. 노란 테두리 = 공격 가능.</p>';
    side += '<hr><h3>🤝 외교</h3>';
    for (const f of SW.FACTION_ORDER) {
      const rel = C.rel('player', f), t = C.treaty('player', f), alive = C.owned(f).length;
      side += `<div class="dipl"><b style="color:${SW.FACTIONS[f].color}">${SW.FACTIONS[f].name}</b> <small>영토 ${alive} · 관계 ${rel}${t ? ' · ' + { ally: '동맹', truce: '휴전', trade: '교역' }[t.type] : ''}</small>
        ${alive ? `<div class="row"><button class="btn small" data-d="gift" data-f="${f}">🎁 선물(200)</button><button class="btn small" data-d="ally" data-f="${f}">동맹</button><button class="btn small" data-d="truce" data-f="${f}">휴전</button><button class="btn small" data-d="trade" data-f="${f}">교역</button><button class="btn small danger" data-d="war" data-f="${f}">선전포고</button></div>` : '<small class="muted">멸망</small>'}</div>`;
    }
    side += `<hr><button class="btn primary" id="cp-end" ${st.over ? 'disabled' : ''}>⏭ 턴 종료</button><h3>📜 기록</h3><div class="clog">${st.log.slice(0, 14).map(x => `<div>${x}</div>`).join('')}</div></div>`;
    body.innerHTML = `<div class="camp">${svg}${side}</div>`;
    body.querySelectorAll('.creg').forEach(g => g.onclick = () => { csel = g.dataset.r; S.campaign(); });
    const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
    on('cp-atk', () => S.campaignBattle(csel));
    on('cp-auto2', () => { const sc = C.battleFor(csel); const win = C.autoResolve(C.playerPop() * 0.9, sc.budget * (1 + reg.fort * 0.4)); C.resolve(csel, win, win ? 1 : 0.3); toast(win ? '점령 성공' : '공격 실패'); S.campaign(); });
    on('cp-fort', () => { if (!C.fortify(csel)) toast('자원이 부족하거나 최대 레벨입니다'); S.campaign(); });
    on('cp-rec', () => { if (!C.recruit(csel)) toast('자원이 부족합니다'); S.campaign(); });
    on('cp-end', () => { const r2 = C.endTurn(); toast(`턴 종료 · 수입 ${SW.costText(Object.fromEntries(Object.entries(r2.income).map(([k, v]) => [k, Math.round(v)])))}`); S.campaign(); });
    on('cp-reset', () => { if (confirm('캠페인을 새로 시작할까요?')) { save.data.campaign = null; S.campaign(); } });
    body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const f = b.dataset.f, d = b.dataset.d;
      if (d === 'gift') { if (!C.gift(f, 200)) toast('골드 부족'); } else if (d === 'war') C.declareWar(f); else C.propose(f, d);
      save.write(); S.campaign();
    });
  };
  S.campaignBattle = (id, defense) => {
    const C = SW.Campaign, sc = C.battleFor(id, defense), r = C.region(id);
    const pop = C.playerPop(), big = pop > 110;
    const W = big ? 2000 : 1600, H = big ? 1125 : 900;
    const terrain = new SW.Terrain(W, H).generate(sc.terrain, (Math.random() * 1e9) | 0);
    const units = [], squads = [];
    let ezone = zoneR(W), victory = { type: 'commander' }, traps = null, def = -1;
    if (sc.siege || sc.defendFort) {
      def = sc.siege ? 1 : 0;
      const F = SW.buildFort(W, H, def === 1 ? 'right' : 'left', def, terrain);
      units.push(...F.units); traps = F.traps;
      if (def === 1) ezone = { x0: F.inner.x0 + 40, x1: F.inner.x1 - 20 };
      victory = { type: 'keep', defender: def };
    }
    // 아군 지휘관
    squads.push({ team: 0, name: '지휘부', order: 'hold' });
    units.push({ type: 'commander', team: 0, x: W * 0.1, y: H / 2, sq: 0, fixed: true });
    // 동맹 지원군
    for (const al of sc.allies) {
      const fac = SW.FACTIONS[al.faction];
      const AA = SW.buildArmy({ team: 0, budget: al.budget, pers: fac.pers, W, H, zone: { x0: 20, x1: W * 0.2 }, commander: false, allowed: SW.unitList().filter(u => fac.fam.includes(u.family) && u.family !== 'star').map(u => u.id) });
      const off = squads.length; AA.squads.forEach(q => squads.push({ team: 0, name: `${fac.name} 지원군`, order: 'attack' }));
      for (const u of AA.units) units.push({ ...u, team: 0, sq: u.sq + off, fixed: true });
    }
    if (sc.boss) { units.push({ type: sc.boss, team: 1, x: W * 0.8, y: H / 2 }); victory = { type: 'annihilate' }; }
    const EA = SW.buildArmy({ team: 1, budget: Math.max(10, sc.budget), pers: sc.pers, W, H, zone: ezone, allowed: sc.allowed, commander: !sc.boss && def !== 1 });
    if (def === 1) for (const u of EA.units) u.y = clamp(u.y, H * 0.22, H * 0.78);
    addArmy(units, squads, EA, 1, '적 ');
    goBattle({
      title: `👑 ${defense ? '방어전' : '정복전'}: ${r.name}`, sub: `${sc.enemyFaction === 'neutral' ? '중립 세력' : SW.FACTIONS[sc.enemyFaction].name} · ${SW.WEATHER[sc.weather].icon}${SW.WEATHER[sc.weather].name} · ${SW.TIMES[sc.time].name}${sc.moraleBonus ? ' · ⚠ 식량 부족 (사기 -25)' : ''}${sc.allies.length ? ' · 동맹 지원군 참전' : ''}`,
      W, H, terrain: terrain.serialize(), weather: sc.weather, time: sc.time, units: units.filter(u => !terrain.blocked(u.x, u.y) || SW.UNITS[u.type].structure), squads,
      pop: pop + save.mods().popBonus, palette: 'unlocked', zone: def === 0 ? { x0: 20, x1: W * 0.4 } : zoneL(W), morale: true, command: true, frontline: units.length > 120,
      moraleBonus: [sc.moraleBonus, 0], ai: [null, EA.pers], victory, timeLimit: def >= 0 ? 360 : 600, xp: true, key: 'campaign',
      setup: traps ? (b) => SW.setupTraps(b, traps, def) : null,
      onFinish(b, win) {
        const left = b.units.filter(u => u.team === 1).length, tot = EA.units.length || 1;
        C.resolve(id, win, 1 - left / tot, defense);
        const res = win ? { gold: 150 + sc.budget * 4, food: 20 } : { gold: 50 };
        return { rows: rewardRows(res), buttons: [{ text: '세계 지도', cls: 'primary', fn: () => go('campaign') }] };
      },
    });
  };

  // ═════ 군대 관리 (레벨 · 전문화 · 진화 · 장비 · 상점) ═════
  let asel = 'soldier', atab = 'units';
  S.make_army = () => screen('army', '🎖 군대 관리');
  S.army = () => {
    refreshRes();
    const body = $('#army-body');
    const ids = unlockedIds();
    if (!ids.includes(asel)) asel = ids[0];
    const tabs = `<div class="tabs2"><button class="${atab === 'units' ? 'on' : ''}" data-t="units">🎖 유닛 성장</button><button class="${atab === 'shop' ? 'on' : ''}" data-t="shop">⚒ 대장간 (장비 제작·강화)</button></div>`;
    if (atab === 'shop') {
      body.innerHTML = tabs + `<div class="cards">${Object.entries(SW.ITEMS).map(([id, it]) => {
        const tier = save.data.items[id] || 0, nextCost = tier ? SW.TIER_COST[tier + 1] : it.cost;
        return `<div class="card"><div style="font-size:30px">${it.icon}</div><div><div class="cn">${it.name} ${tier ? ['', 'I', 'II', 'III'][tier] : ''} <span class="role">${SW.SLOTS[it.slot]}</span></div><div class="cd">${it.desc}${tier > 1 ? ` (효과 ×${1 + 0.5 * (tier - 1)})` : ''}</div>
        <div class="small muted">장착: ${it.cls ? it.cls.map(c => ({ front: '근접', tank: '탱커', assassin: '암살', ranged: '원거리', caster: '마법', support: '지원' }[c])).join('·') : '모든 유닛'}</div>
        ${tier >= 3 ? '<b class="small">최고 등급</b>' : `<button class="btn small" data-buy="${id}" ${SW.canAfford(nextCost) ? '' : 'disabled'}>${tier ? '강화' : '제작'} ${SW.costText(nextCost)}</button>`}</div></div>`;
      }).join('')}</div>`;
    } else {
      const g = SW.growthOf(asel), d = SW.resolveDef(asel, save.mods()), evo = SW.EVOLUTIONS[asel];
      const eq = save.data.equip[asel] || {};
      const list = ids.map(id => { const gg = SW.growthOf(id); return `<div class="pu ${id === asel ? 'on' : ''}" data-u="${id}"><canvas></canvas><span class="pn">${(gg.evo && SW.EVOLUTIONS[id] ? SW.EVOLUTIONS[id].name : SW.UNITS[id].name)}</span><span class="pp">Lv.${gg.lv}${gg.lv >= 10 ? '★★' : gg.lv >= 5 ? '★' : ''}</span></div>`; }).join('');
      const need = SW.xpNeed(g.lv);
      let det = `<h3>${d.name} <small class="muted">Lv.${g.lv} ${g.lv >= 10 ? '★★ 정예' : g.lv >= 5 ? '★ 베테랑' : ''}</small></h3>
        <div class="hpbar"><div style="width:${g.lv >= 10 ? 100 : g.xp / need * 100}%;background:#ffcf4d"></div></div><div class="small muted">경험치 ${Math.round(g.xp)} / ${need} — 전투에서 실제로 피해를 주고·받고·치유하고·처치할수록 성장 (레벨당 체력·공격 +3%, Lv5·10 승급 방어 +1)</div>`;
      det += '<h4>전문화 (Lv.5)</h4><div class="row">' + Object.entries(SW.SPECS).map(([k, s]) => `<button class="btn small ${g.spec === k ? 'primary' : ''}" data-spec="${k}" ${g.lv < 5 || g.spec ? 'disabled' : ''} title="${s.desc}">${s.icon} ${s.name}</button>`).join('') + `</div>${g.spec ? `<div class="small">선택됨: ${SW.SPECS[g.spec].name} — ${SW.SPECS[g.spec].desc} <a href="#" id="spec-reset">초기화 (💎1)</a></div>` : ''}`;
      det += evo ? `<h4>진화 (Lv.10)</h4><div class="small">${evo.name}: ${evo.desc}</div>${g.evo ? '<b class="small" style="color:var(--green)">✔ 진화 완료</b>' : `<button class="btn small" id="evo" ${g.lv >= 10 && SW.canAfford({ crystal: evo.cost, gold: 500 }) ? '' : 'disabled'}>진화 💎${evo.cost} 💰500</button>`}` : '';
      det += '<h4>장비</h4>' + Object.entries(SW.SLOTS).map(([slot, nm]) => {
        const opts = Object.entries(SW.ITEMS).filter(([id, it]) => it.slot === slot && save.data.items[id] && SW.itemAllowed(it, asel));
        return `<label class="eq">${nm} <select data-slot="${slot}"><option value="">없음</option>${opts.map(([id, it]) => `<option value="${id}" ${eq[slot] === id ? 'selected' : ''}>${it.icon} ${it.name} ${['', 'I', 'II', 'III'][save.data.items[id]]}</option>`).join('')}</select></label>`;
      }).join('') + '<div class="small muted">장비는 대장간에서 제작합니다. 한 번 만든 장비는 여러 병종에 장착할 수 있습니다.</div>';
      body.innerHTML = tabs + `<div class="army"><div class="palette-list army-list">${list}</div><div class="panel army-det">${det}<div id="army-card"></div></div></div>`;
      body.querySelectorAll('[data-u]').forEach(x => { requestAnimationFrame(() => SW.drawUnitIcon(x.querySelector('canvas'), x.dataset.u, 0)); x.onclick = () => { asel = x.dataset.u; S.army(); }; });
      $('#army-card').appendChild(unitCard(asel, save.mods()));
      body.querySelectorAll('[data-spec]').forEach(x => x.onclick = () => { g.spec = x.dataset.spec; save.write(); S.army(); });
      const sr = $('#spec-reset'); if (sr) sr.onclick = (e) => { e.preventDefault(); if (SW.pay({ crystal: 1 })) { g.spec = null; save.write(); S.army(); } else toast('수정 부족'); };
      const ev = $('#evo'); if (ev) ev.onclick = () => { if (SW.pay({ crystal: evo.cost, gold: 500 })) { g.evo = true; save.write(); toast(`${evo.name}(으)로 진화!`); S.army(); } };
      body.querySelectorAll('[data-slot]').forEach(x => x.onchange = () => { const e2 = save.data.equip[asel] = save.data.equip[asel] || {}; if (x.value) e2[x.dataset.slot] = x.value; else delete e2[x.dataset.slot]; save.write(); S.army(); });
    }
    body.querySelectorAll('[data-t]').forEach(x => x.onclick = () => { atab = x.dataset.t; S.army(); });
    body.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => {
      const id = x.dataset.buy, tier = save.data.items[id] || 0, cost = tier ? SW.TIER_COST[tier + 1] : SW.ITEMS[id].cost;
      if (SW.pay(cost)) { save.data.items[id] = tier + 1; save.write(); updateGold(); toast(`${SW.ITEMS[id].name} ${tier ? '강화' : '제작'} 완료`); S.army(); }
    });
  };

  // ═════ 유닛 편집기 ═════
  let edit = null;
  S.make_editor = () => screen('editor', '🛠 유닛 편집기');
  S.editor = () => {
    const body = $('#editor-body');
    const customs = Object.entries(save.data.customUnits || {}).filter(([, v]) => v);
    if (!edit) edit = { base: 'soldier', name: '새 유닛', family: 'circle', hp: 120, dmg: 12, armor: 1, speed: 55, range: 0, atkCd: 1, size: 10, pop: 2, attack: 'melee', element: '', skill: 'shieldBash', flying: false, stealth: false, splash: 0, lifesteal: 0, accent: '#ffffff', glyph: 'star' };
    const E = edit;
    const num = (k, label, min, max, step) => `<label>${label} <input type="number" data-k="${k}" value="${E[k]}" min="${min}" max="${max}" step="${step}"></label>`;
    const sel = (k, label, opts) => `<label>${label} <select data-k="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(E[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    body.innerHTML = `<div class="editor"><div class="panel form3">
      ${sel('base', '기본 템플릿', SW.unitList().filter(u => !u.custom).map(u => [u.id, u.name]))}
      <label>이름 <input type="text" data-k="name" value="${E.name}" maxlength="10"></label>
      ${sel('family', '도형', SW.FAMILY_ORDER.map(f => [f, SW.FAMILIES[f].name]))}
      ${num('hp', '체력', 10, 20000, 10)}${num('dmg', '공격력', 0, 1000, 1)}${num('armor', '방어력', 0, 30, 1)}${num('atkCd', '공격 주기(초)', 0.1, 10, 0.1)}
      ${num('range', '사거리 (0=근접)', 0, 500, 10)}${num('speed', '이동속도', 0, 200, 5)}${num('size', '크기', 5, 30, 1)}${num('pop', '인원', 0, 20, 1)}${num('splash', '범위 공격', 0, 120, 5)}${num('lifesteal', '흡혈 (0~1)', 0, 1, 0.05)}
      ${sel('attack', '공격 방식', [['melee', '근접'], ['spin', '회전 베기'], ['arrow', '화살'], ['bolt', '마법탄'], ['fireball', '화염구(범위)'], ['lob', '곡사'], ['pierce', '관통'], ['chain', '연쇄 번개'], ['breath', '부채꼴 브레스'], ['heal', '치유']])}
      ${sel('element', '속성', [['', '없음'], ...Object.entries(SW.ELEMENTS).map(([k, v]) => [k, v.icon + v.name])])}
      ${sel('skill', '기술', [['', '없음'], ...Object.entries(SW.ABILITIES).map(([k, a]) => [k, a.name])])}
      <label class="chk"><input type="checkbox" data-k="flying" ${E.flying ? 'checked' : ''}> 비행</label><label class="chk"><input type="checkbox" data-k="stealth" ${E.stealth ? 'checked' : ''}> 은신</label>
      <label>강조색 <input type="color" data-k="accent" value="${E.accent}"></label>
      <div class="btns"><button class="btn primary" id="ed-save">💾 저장</button><button class="btn" id="ed-exp">⇪ 내보내기</button><button class="btn" id="ed-imp">⇩ 가져오기</button></div></div>
      <div class="panel"><h3>미리보기</h3><div id="ed-prev"></div><h3>내 커스텀 유닛</h3>${customs.length ? customs.map(([id, u]) => `<div class="row"><span>${u.name}</span><button class="btn small" data-load="${id}">편집</button><button class="btn small danger" data-del="${id}">삭제</button></div>`).join('') : '<p class="muted">아직 없습니다. 저장하면 샌드박스의 "커스텀 유닛" 목록에 나타납니다.</p>'}</div></div>`;
    const toDef = () => {
      const base = SW.UNITS[E.base];
      const d = { name: E.name, family: E.family, size: +E.size, pop: +E.pop, hp: +E.hp, armor: +E.armor, dmg: +E.dmg, atkCd: +E.atkCd, range: +E.range, speed: +E.speed,
        attack: E.attack, splash: +E.splash, lifesteal: +E.lifesteal || 0, element: E.element || null, skill: E.skill || null, flying: !!E.flying, glyph: E.glyph, accent: E.accent,
        role: E.attack === 'heal' ? 'healer' : base.role, desc: `${base.name} 기반 커스텀 유닛`, dmgType: ['bolt', 'fireball', 'chain'].includes(E.attack) ? 'magic' : 'phys', projSpeed: base.projSpeed || 420 };
      if (E.attack === 'heal') { d.heal = +E.dmg; d.range = Math.max(80, +E.range); }
      if (E.attack === 'chain') d.chain = { count: 4, jump: 90 };
      if (E.attack === 'breath') d.cone = 70;
      if (E.stealth) d.stealth = { reveal: 2 };
      return d;
    };
    const prev = () => { const id = 'cu_preview'; SW.UNITS[id] = toDef(); SW.normalizeUnit(id, SW.UNITS[id]); SW.UNITS[id].custom = true; SW.UNITS[id].summonOnly = true; const p = $('#ed-prev'); p.innerHTML = ''; p.appendChild(unitCard(id, null)); };
    prev();
    body.querySelectorAll('[data-k]').forEach(x => x.onchange = () => {
      const k = x.dataset.k; E[k] = x.type === 'checkbox' ? x.checked : x.value;
      if (k === 'base') { const u = SW.UNITS[x.value]; Object.assign(E, { family: u.family, hp: u.hp, dmg: u.dmg || u.heal || 0, armor: u.armor, speed: u.speed, range: u.range, atkCd: u.atkCd, size: u.size, pop: u.pop, attack: u.attack, element: u.element || '', skill: u.skill || '', flying: !!u.flying, stealth: !!u.stealth, splash: u.splash || 0, lifesteal: u.lifesteal || 0, accent: u.accent, glyph: u.glyph, name: u.name + '+' }); S.editor(); return; }
      prev();
    });
    $('#ed-save').onclick = () => { const id = E.id || ('cu_' + Date.now().toString(36)); E.id = id; save.data.customUnits[id] = toDef(); save.write(); SW.registerCustomUnits(); toast(`${E.name} 저장 — 샌드박스에서 사용 가능`); S.editor(); };
    $('#ed-exp').onclick = () => prompt('유닛 코드', btoa(unescape(encodeURIComponent(JSON.stringify(toDef())))));
    $('#ed-imp').onclick = () => { const t = prompt('유닛 코드를 붙여넣으세요'); if (!t) return; try { const d = JSON.parse(decodeURIComponent(escape(atob(t.trim())))); const id = 'cu_' + Date.now().toString(36); save.data.customUnits[id] = d; save.write(); SW.registerCustomUnits(); toast('가져왔습니다'); S.editor(); } catch (e) { toast('잘못된 코드'); } };
    body.querySelectorAll('[data-load]').forEach(x => x.onclick = () => { const d = save.data.customUnits[x.dataset.load]; edit = { ...d, id: x.dataset.load, base: 'soldier', element: d.element || '', skill: d.skill || '', stealth: !!d.stealth }; S.editor(); });
    body.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { save.data.customUnits[x.dataset.del] = null; delete SW.UNITS[x.dataset.del]; save.write(); S.editor(); });
  };

  // ═════ 밸런스 분석기 ═════
  const BAL = { units: ['soldier', 'spearman', 'shieldman', 'swordsman', 'archer', 'crossbow', 'mage', 'storm', 'guardian', 'cavalry', 'assassin', 'healer'], pop: 16, running: false };
  S.make_balance = () => screen('balance', '📊 밸런스 분석기');
  S.balance = () => {
    const body = $('#balance-body');
    body.innerHTML = `<div class="panel form3"><p>선택한 병종끼리 같은 인원으로 1:1 대결을 반복해 승률 행렬을 계산합니다 (헤드리스 시뮬레이션). 개발·밸런스 연구용 도구.</p>
      <div class="bal-units">${SW.unitList().filter(u => !u.custom).map(u => `<label class="chk"><input type="checkbox" value="${u.id}" ${BAL.units.includes(u.id) ? 'checked' : ''}>${u.name}</label>`).join('')}</div>
      <label>대결 인원 <input type="number" id="bal-pop" value="${BAL.pop}" min="4" max="60"></label><div class="btns"><button class="btn primary" id="bal-go">▶ 분석 시작</button></div></div><div id="bal-out"></div>`;
    $('#bal-go').onclick = () => {
      if (BAL.running) return;
      BAL.units = [...body.querySelectorAll('.bal-units input:checked')].map(x => x.value).slice(0, 20); BAL.pop = +$('#bal-pop').value;
      const U = BAL.units, n = U.length, M = U.map(() => U.map(() => null));
      const jobs = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) jobs.push([i, j]);
      BAL.running = true; let k = 0;
      const out = $('#bal-out');
      const draw = () => {
        const score = U.map((_, i) => { const v = M[i].filter((x, j) => j !== i && x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
        const rank = U.map((u, i) => [u, score[i]]).sort((a, b) => b[1] - a[1]);
        out.innerHTML = `<p>${k}/${jobs.length} 대결 완료</p><div class="bal-wrap"><table class="bal"><tr><th></th>${U.map(u => `<th>${SW.UNITS[u].name}</th>`).join('')}</tr>${U.map((u, i) => `<tr><th>${SW.UNITS[u].name}</th>${U.map((_, j) => { const v = i === j ? null : M[i][j]; return `<td style="background:${v === null ? '#1a2130' : `hsl(${v * 120},55%,${28 + v * 10}%)`}">${v === null ? '' : Math.round(v * 100)}</td>`; }).join('')}</tr>`).join('')}</table></div>
          <h3>종합 순위 (평균 승률)</h3><ol>${rank.map(([u, s]) => `<li>${SW.UNITS[u].name} — ${Math.round(s * 100)}%</li>`).join('')}</ol>`;
      };
      const step = () => {
        if (k >= jobs.length || SW.ui.current() !== 'balance') { BAL.running = false; draw(); return; }
        const [i, j] = jobs[k++]; const w = SW.duel(U[i], U[j], BAL.pop, 2); M[i][j] = w; M[j][i] = 1 - w;
        if (k % 3 === 0) draw();
        setTimeout(step, 0);
      };
      step();
    };
  };

  // 메뉴에서 시작하는 모드
  const goOrig = SW.ui.go;
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go="infinite"]'); if (!g) return;
    e.stopImmediatePropagation(); e.preventDefault(); S.infinite();
  }, true);
  // 메뉴 진행 표시에 자원 추가
  const mp = $('#menu-progress');
  if (mp) { const obs = () => { mp.title = '자원: ' + resHTML().replace(/<[^>]+>/g, ' '); }; obs(); }
})();
