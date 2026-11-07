// 토너먼트 — 8개 군대가 대진표에 따라 차례로 대결 (플레이어 경기는 직접 관전·지휘)
window.SW = window.SW || {};
(() => {
  const NAMES = ['철벽 군단', '화살비 연대', '그림자 결사', '마탑 수호대', '초원 기마대', '불꽃 교단', '거신의 후예', '서리 경비대', '번개 여단', '황금 방진'];
  SW.TOURNEY = { budget: 80, reward: [{ gold: 1200, crystal: 3 }, { gold: 600, crystal: 1 }, { gold: 250 }] };
  SW.Tournament = {
    create(withPlayer) {
      const pers = ['balanced', 'aggressive', 'defensive', 'flanker', 'artillery'];
      const names = [...NAMES].sort(() => Math.random() - 0.5);
      const teams = [];
      if (withPlayer) teams.push({ name: '나의 군대', player: true });
      while (teams.length < 8) teams.push({ name: names[teams.length], pers: pers[(Math.random() * pers.length) | 0], seed: (Math.random() * 1e9) | 0 });
      return { teams, round: 0, matches: [[0, 1], [2, 3], [4, 5], [6, 7]].map(([a, b]) => ({ a, b, w: null })), rounds: [], done: false };
    },
    armyFor(team, side, W, H) {
      const A = SW.buildArmy({ team: side, budget: SW.TOURNEY.budget, pers: team.pers, W, H, zone: side ? { x0: W * 0.62, x1: W - 20 } : { x0: 20, x1: W * 0.38 }, commander: false,
        allowed: SW.unitList().filter(u => u.family !== 'star' && !u.summonOnly).map(u => u.id) });
      return A;
    },
    // 헤드리스 시뮬레이션 (AI 대 AI 경기)
    simulate(T, m) {
      const W = 1600, H = 900;
      const b = new SW.Battle({ W, H, visual: false, timeLimit: 150 });
      b.initSquads();
      [m.a, m.b].forEach((ti, side) => {
        const A = this.armyFor(T.teams[ti], side, W, H);
        const ids = A.squads.map(s => b.addSquad(side, s.name));
        for (const u of A.units) b.spawn(u.type, side, u.x, u.y, { sq: ids[u.sq] });
        b.addAI(side, T.teams[ti].pers);
      });
      let n = 0; while (!b.over && n < 60 * 160) { b.step(1 / 60); n++; }
      return b.winner === 0 ? m.a : m.b;
    },
    advance(T) {
      const ws = T.matches.map(m => m.w);
      if (ws.some(w => w === null)) return false;
      T.rounds.push(T.matches);
      if (ws.length === 1) { T.done = true; T.champion = ws[0]; return true; }
      T.matches = []; for (let i = 0; i < ws.length; i += 2) T.matches.push({ a: ws[i], b: ws[i + 1], w: null });
      T.round++;
      return true;
    },
    placement(T, idx) {
      if (T.champion === idx) return 0;
      const last = T.rounds[T.rounds.length - 1] || [];
      if (T.done && last.some(m => m.a === idx || m.b === idx)) return 1;
      if (T.rounds.length >= 2 && T.rounds[1].some(m => m.a === idx || m.b === idx)) return 2;
      return 3;
    },
  };
})();
