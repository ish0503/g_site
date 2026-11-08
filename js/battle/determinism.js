// ─────────────────────────────────────────────
// 결정론 보장: 전투의 모든 진입점을 그 전투의 시드 RNG 안에서 실행한다.
//   step 밖에서 호출되는 함수(배치·시작·AI 등록·보급/탄약/전선 활성화·명령·소환)가
//   rand() 를 쓰면 Math.random 으로 떨어져 같은 시드에서도 결과가 달라졌다 (예: 사기 갱신 주기 u.mT).
//   다른 모듈이 감싼 뒤 가장 바깥에서 감싸도록 모든 전투 모듈 다음에 로드한다.
// ─────────────────────────────────────────────
(() => {
  const P = SW.Battle.prototype;
  for (const m of ['spawn', 'start', 'addAI', 'enableSupply', 'enableAmmo', 'enableFrontline', 'initSquads', 'addSquad', 'setOrder', 'summonNear', 'kill']) {
    const orig = P[m]; if (typeof orig !== 'function' || orig.__rngWrapped) continue;
    const f = function (...a) { return SW.withRng(this, () => orig.apply(this, a)); };
    f.__rngWrapped = true;
    P[m] = f;
  }
})();
