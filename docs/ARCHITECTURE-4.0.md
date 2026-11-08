# GEOMETRY WAR 4.0 — 구조 분석과 통합 계획

## 1. 기존 구조 (3.1 기준, Phase 1 분석)
빌드 없는 순수 JS. `index.html` 의 `<script>` 순서가 곧 의존 순서이며 모든 모듈은 전역 `SW` 네임스페이스를 공유한다.

| 계층 | 파일 | 제공 | 의존 |
|---|---|---|---|
| 데이터 | data/units, tree, stages, abilities, formations, bosses, units3 | `SW.UNITS` `SW.SKILL_TREES` `SW.STAGES` `SW.ABILITIES` … | 없음 |
| 전투 코어 | battle/engine (Battle, RNG), combat, ai, abilities, formation, boss, grid, engine3 (Battle3) | `SW.Battle` `SW.makeRng` `SW.resolveDef` `SW.WORLD`(전장 크기) | 데이터 |
| 전쟁·지형 | war/squads, tactics, supply · world/terrain, nav | 부대·명령·전술 AI·보급, 지형·흐름장 | 전투 코어 (prototype 래핑) |
| 성장 | progression/growth, classes | `SW.growthMods` 등 | 저장, 데이터 |
| 모드 | modes/survival, content3, campaign(3.0 캠페인), tournament | 시나리오 데이터·설정 함수 | 전투 코어 |
| 분석 | analytics/replay, replay2 | 밸런스 분석, `SW.Recorder` `SW.Replay` | 전투 코어 |
| 표현 | render/renderer, ui/ui, command, screens3, screens31 | 화면·HUD | 전부 |
| 저장 | core/save | `SW.save` | data/tree |

확장 방식: 기존 3.x 모듈은 `SW.Battle.prototype` 의 메서드를 감싸(wrap) 기능을 추가한다. 감싸기 순서는 스크립트 순서를 따른다.

전투 엔진은 DOM 에 의존하지 않는다. `tests/harness.js` 가 UI·렌더러를 뺀 스크립트를 Node 에서 로드한다 (Phase 1 부터 기본은 실제 전역 실행 — 브라우저와 같은 실행 방식, `{sandbox:true}` 는 격리 실행).

### 이름 충돌 조사
- `SW.WORLD` 는 이미 전장 크기(1600×900)로 쓰인다 → 4.0 세계 시뮬레이션은 `SW.W4` 네임스페이스를 쓴다.
- `js/world/` 에는 전장 지형(terrain.js)·경로 탐색(nav.js)이 있다 → 세계 지도는 `js/world/worldmap.js` 로 따로 둔다.
- 3.0 캠페인(`SW.Campaign`, `save.data.campaign`)은 그대로 보존한다. 4.0 세계 정복은 별도 저장 슬롯을 쓴다.

## 2. 4.0 모듈 배치
```
js/world/worldmap.js        세계 지도 생성(시드 고정)·인접·해역·도시          SW.W4.genMap
js/nations/nations.js       국가·경제·내정·건설                                SW.W4.Nation*, economy
js/nations/diplomacy.js     조약·관계·전쟁 명분·평화 협상                       SW.W4.Diplo
js/nations/ai.js            국가 AI (경제·외교·전쟁 판단)                        SW.W4.NationAI
js/technology/tech.js       기술 연구 4계열                                    SW.W4.TECH
js/grandwar/war.js          전쟁·전쟁 점수·참전·평화                             SW.W4.War
js/grandwar/armies.js       군단 이동·점령·공성·자동 전투, 군사 AI                SW.W4.Army, MilitaryAI
js/grandwar/naval.js        항구·함대·봉쇄·상륙                                 SW.W4.Naval
js/grandwar/battlelink.js   세계 전투 → 실시간 전투 엔진(Battle) 연결            SW.W4.toBattle
js/nations/occupation.js    점령지 통치·반란                                    SW.W4.Unrest
js/analytics/chronicle.js   세계 전쟁 기록·타임라인·기여도·리플레이 연계          SW.W4.Chronicle
js/grandwar/world.js        세계 상태·턴 진행·시나리오·직렬화                     SW.W4.World
js/render/worldrender.js    세계 지도 렌더링 (정치·군사·경제)                     SW.W4.Render
js/ui/world4.js             세계 정복 화면·패널·시나리오 편집기
```

## 3. 업데이트 주기
| 계층 | 주기 | 내용 |
|---|---|---|
| 전략 (국가) | 1턴 = 1개월 | 경제·인구·연구·외교·국가 AI·반란 |
| 군사 (군단) | 1턴 안에서 일 단위 하위 단계(기본 4) | 군단 이동·충돌·공성 진행·보급 |
| 전투 (실시간) | 1/60초 고정 스텝 | 기존 `Battle.step` — 플레이어가 직접 지휘하는 교전만 |
| 렌더링 | requestAnimationFrame | 세계 지도는 변경 시에만 다시 그림 (dirty flag) |

AI 끼리의 교전은 같은 전투 규칙(상성·사기·지형)을 요약한 자동 계산으로 처리하고, 플레이어가 참여한 교전은 실제 전투 엔진에서 진행할 수 있다.

## 4. 결정론
세계 시뮬레이션은 세계마다 `SW.makeRng(seed)` 를 쓰고 `Math.random` 을 쓰지 않는다. 같은 시드·같은 입력이면 같은 결과가 나와야 한다 (`tests/world.test.js`).
