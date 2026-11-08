// 실행: node tests/w4balance.js [시드 수] [년] — AI 전용 장기 시뮬레이션 밸런스 통계 (시험이 아닌 분석 도구)
const { load } = require('./harness'); const SW = load(); const W4 = SW.W4;
const seeds = +process.argv[2] || 8, years = +process.argv[3] || 50;
const agg = { wars: [], dead: [], top: [], famine: [], stab: [], gold: [], maxW: [], ms: [], worst: [], winners: {}, techs: [], revolts: [] };
for (let s = 1; s <= seeds; s++) {
  const w = new W4.World({ seed: s * 11 }); let fam = 0, maxW = 0, worst = 0; const t = Date.now();
  for (let m = 0; m < years * 12; m++) { const a = process.hrtime.bigint(); w.advance(1); worst = Math.max(worst, Number(process.hrtime.bigint() - a) / 1e6); fam += W4.NATIONS.filter(n => w.nations[n.id].alive && w.nations[n.id].famine).length; maxW = Math.max(maxW, w.wars.length); }
  const alive = w.alive(), counts = alive.map(id => [id, w.ownedRegions(id).length]).sort((a, b) => b[1] - a[1]);
  agg.wars.push(w.warHistory.length + w.wars.length); agg.dead.push(16 - alive.length); agg.top.push(counts[0][1]); agg.famine.push(fam / (alive.length * years * 12) * 100);
  agg.stab.push(alive.reduce((x, id) => x + w.nations[id].stab, 0) / alive.length); agg.gold.push(alive.reduce((x, id) => x + w.nations[id].res.gold, 0) / alive.length);
  agg.maxW.push(maxW); agg.ms.push((Date.now() - t) / (years * 12)); agg.worst.push(worst); agg.techs.push(alive.reduce((x, id) => x + w.nations[id].research.done.length, 0) / alive.length); agg.revolts.push(w.chron.revolts.length);
  agg.winners[w.def(counts[0][0]).ai] = (agg.winners[w.def(counts[0][0]).ai] || 0) + 1;
  console.log(`시드 ${s * 11}: 전쟁 ${agg.wars.at(-1)} · 멸망 ${agg.dead.at(-1)} · 최대 국가 ${w.def(counts[0][0]).name}(${counts[0][1]}곳) · 기근 ${agg.famine.at(-1).toFixed(1)}% · 최대 동시 전쟁 ${maxW} · 반란 ${agg.revolts.at(-1)} · 월 ${agg.ms.at(-1).toFixed(1)}ms(최악 ${worst.toFixed(0)}ms)`);
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`\n평균 (${seeds}개 시드 × ${years}년): 전쟁 ${avg(agg.wars)} · 멸망 ${avg(agg.dead)} · 최대 국가 지역 ${avg(agg.top)} (최대 ${Math.max(...agg.top)}) · 기근 ${avg(agg.famine)}% · 안정도 ${avg(agg.stab)} · 금 ${avg(agg.gold)} · 기술 ${avg(agg.techs)} · 반란 ${avg(agg.revolts)} · 최대 동시 전쟁 ${Math.max(...agg.maxW)}`);
console.log('최대 국가 성향:', JSON.stringify(agg.winners), `· 월 처리 평균 ${avg(agg.ms)}ms · 최악 ${Math.max(...agg.worst).toFixed(0)}ms`);
