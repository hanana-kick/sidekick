# Sidekick

**몸체 + 눈 + 액세서리를 API로 디자인하는 투명 3D 웹컴포넌트.** 같은 메시를 Flat / 3D로 출력하고, 파츠는 변형되는 몸체 표면을 따라 움직입니다.

## 실행

Node.js 22 이상이 필요합니다. 런타임 외부 의존성은 없습니다.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173
```

`dev`는 TypeScript 변경을 감지해 재빌드합니다. 변경 후 브라우저를 새로고침하세요. 외부 접근이 필요할 때만 `HOST=0.0.0.0 npm run dev`를 사용하세요. 포트는 `PORT`로 변경합니다.

```sh
npm run build
npm start
```

Studio에서 몸체 비율/변형, 눈, 다중 액세서리, 표면 배치, 애니메이션, 시선, 회전을 편집하고 Flat/3D를 나란히 비교할 수 있습니다. JSON 가져오기/내보내기, 투명 PNG 저장, 브라우저 로컬 저장을 지원합니다. 저장소 접근이 차단되면 파일 내보내기를 사용할 수 있습니다.

## 웹사이트에 삽입

빌드한 `dist/src` 폴더를 사이트의 `/sidekick` 경로에 배치하는 예시입니다. 스크립트는 custom element를 자동 등록합니다. 배경은 CSS와 무관하게 투명합니다.

```html
<script type="module" src="/sidekick/index.js"></script>
<sidekick-avatar
  id="bot"
  render-style="3d"
  interaction="none"
  aria-label="작업 도우미"
  style="width:160px;height:160px"
></sidekick-avatar>
```

```ts
import { createDesign, createAccessory, type SidekickAvatar } from './sidekick/index.js';

const bot = document.querySelector<SidekickAvatar>('#bot');
if (!bot) throw new Error('봇 요소를 찾을 수 없습니다.');

await bot.setDesign(createDesign({
  body: {
    shape: 'rounded-box',
    size: [1.12, 1.18, 0.9],
    roundness: 0.68,
    taper: 0.12,
    bulge: 0.05,
    bend: 0,
    color: '#e9b64d',
  },
  eyes: { preset: 'capsule', spacing: 0.64 },
  accessories: [createAccessory('beret', 'hat')],
}));

bot.renderStyle = 'flat';
bot.setActivity('thinking');
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });
await bot.motion.to({
  face: { uv: [0.2, 0.1] },
  accessories: { hat: { rotation: [0, 0.2, 0] } },
}, { duration: 500, easing: 'smooth' });
```

패키지는 아직 npm에 발행하지 않았습니다. 다른 프로젝트에서는 먼저 이 저장소를 빌드한 뒤 `npm install /absolute/path/to/sidekick`으로 로컬 패키지를 연결하거나, 빌드 산출물을 정적 배포할 수 있습니다. React/Vue/Svelte 의존성 없이 Custom Element API를 사용합니다. 패키지 진입점의 서버 import는 DOM 전역 없이도 안전하지만, 실제 요소 생성/렌더링은 브라우저에서 수행합니다.

## 디자인 계약

`createDesign(patch)`는 기본값을 채운 완전한 `AvatarDesign`을 생성합니다. `patchDesign(current, patch)`는 원본을 변경하지 않습니다. `parseDesign(objectOrJson)`은 버전, 키, 숫자 범위, 튜플 길이, 색상, 액세서리 id를 검증하며 독립된 복사본을 반환합니다. `setDesign`은 검증 실패 시 기존 디자인을 유지하고 Promise를 reject합니다. 동기 `design` setter도 제공됩니다.

| 구성 | 지원 범위 |
| --- | --- |
| 몸체 | `orb`, `rounded-box`, `droplet` |
| 몸체 파라미터 | 크기 `[x,y,z]`, 둥근 정도, y축 기준 taper/bulge/bend, 색상 |
| 눈 | `capsule`, `round`, `arc`; 크기, 간격, 색상, 표면 위치 |
| 액세서리 | `beret`, `halo`, `glasses`; 최대 8개, 고유 id |
| 장착 영역 | `face`, `crown`, `left`, `right` |
| 액세서리 설정 | 장착 좌표, 법선 방향 거리, 크기, 로컬 회전, 지연 추종 |

좌표 단위는 모델 단위이고 모든 각도는 **라디안**입니다. 몸체의 +Y는 위, +Z는 앞입니다. `anchor.uv`는 텍스처 UV가 아닌 장착 영역의 정규화 좌표입니다. 눈은 `face`에만 장착됩니다. 액세서리의 로컬 +Z는 표면 법선, +X/+Y는 표면 접선입니다. `crown`에서는 +Z가 위쪽이므로 얼굴 영역과 같은 Euler 축이 다른 화면 방향으로 보일 수 있습니다.

`bodyPoint()`가 메시와 장착 좌표의 공통 변형 원천입니다. `sampleSurface()`는 동일한 변형에 대해 위치·법선·접선 프레임을 계산합니다. 따라서 몸체의 눌림/부풀림에도 파츠의 장착점을 유지합니다. 액세서리 자체는 강체이며 표면을 따라 늘어나지 않습니다. 눈의 시선 이동과 얼굴 전체 이동은 독립적입니다. 얼굴 장착 액세서리는 얼굴 이동만 따라가며 눈동자 시선에 끌려가지 않습니다.

## 동작 API

| API | 동작 |
| --- | --- |
| `setActivity(name)` | `idle`, `thinking`, `listening`, `speaking`, `celebrating`, `still` |
| `lookAt({space:'view',x,y})` | -1~1 시선, 감쇠 스프링으로 추종 |
| `motion.to(target,{duration,easing})` | 몸체 회전 / 얼굴 위치 / 눈 뜨기 / 액세서리 회전 |
| `motion.cancel()` | 현재 모션 중단, Promise는 `{finished:false}`로 종료 |
| `paused = true` | 현재 프레임 정지; 정지 중 새 모션은 즉시 최종값 적용 |
| `setView(yaw,pitch)` | 디자인을 바꾸지 않는 보기 각도 |
| `seek(seconds)` | 반복 애니메이션 시간 지정; 정지와 함께 재현 가능한 프레임 구성 |
| `snapshot()` | 실제 알파 채널을 가진 PNG Blob |
| `capturePixels()` | `{width,height,pixels}`; WebGL 원점 기준 아래 행부터 RGBA |
| `ready`, `diagnostics` | 준비 상태, RAF 동작 여부, 프레임 수, draw call/버퍼 수 |

새 모션은 진행 중인 모션을 현재 위치에서 대체합니다. 완료는 `{finished:true}`, 취소/요소 제거는 `{finished:false}`입니다. 보이지 않는 동안 진행 중인 모션도 정지하며 다시 보이면 이어집니다. `prefers-reduced-motion`에서는 반복 동작을 없애고 새 모션을 즉시 적용합니다.

`sidekick-ready`, `sidekick-error`, `sidekick-design-change`, `sidekick-motion-end`, `sidekick-activate` 이벤트는 Shadow DOM 바깥으로 전달됩니다. `sidekick-error.detail.message`로 렌더러 오류를 확인할 수 있습니다.

## 클릭과 투명도

- `interaction="none"` (기본): 요소 전체가 클릭을 통과시킵니다. 일반 웹 콘텐츠 위의 장식/상태 표시용입니다.
- `interaction="box"`: 사각형 영역 전체를 잡습니다. 드래그 회전과 클릭/Enter/Space 활성화를 지원합니다. 투명 픽셀도 클릭 영역에 포함됩니다.

픽셀/실루엣 기반 `shape` 히트 테스트는 아직 구현하지 않았습니다. `box`에서 투명 영역을 자동 클릭 통과한다고 가정하지 마세요. Studio의 체크무늬·밝은색·어두운색은 바깥 DOM 배경이며 PNG에 포함되지 않습니다.

## 구성 및 구현 선택

```text
src/core/       디자인 스키마, 표면 좌표계, 수학, 모션 타임라인
src/renderer/   절차적 메시와 WebGL2 렌더링
src/element/    <sidekick-avatar>, 접근성, 이벤트, 생명주기
playground/     프레임워크 독립 Studio
scripts/        TypeScript 빌드, 정적 개발 서버
 tests/         Node 단위 테스트, Playwright 브라우저 테스트
```

초안의 Three.js/Vite 대신 **TypeScript + 네이티브 WebGL2 + 네이티브 Web Component**로 구현했습니다. 외부 3D 런타임을 설치하지 않아도 동작하며, 렌더러는 코어/요소 래퍼와 분리했습니다. Flat은 무조명 단색 셰이더, 3D는 부드러운 조명 셰이더를 사용합니다. 카메라, 메시, 깊이 테스트, 알파 커버리지는 공유하고 스타일 전환으로 메시를 재생성하지 않습니다. 투시 카메라와 PBR 재질은 이번 구현에 포함하지 않습니다.

요소마다 WebGL 컨텍스트 하나와 재사용 가능한 메시 버퍼를 사용합니다. DPR은 최대 2, 캔버스는 각 축 최대 2048px로 제한합니다. 크기 변경, 화면 밖/탭 비활성화 시 중단, reduced-motion, 제거 시 GPU 자원 해제, 컨텍스트 손실/복구를 처리합니다. 디자인별 안전 표시 범위를 계산하므로 애니메이션 중 카메라가 확대/축소되지 않습니다. 많은 아바타의 동시 렌더링을 위한 공용 렌더러/컨텍스트 풀은 아직 없습니다.

## 테스트

```sh
npm run typecheck
npm test
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
# Linux 소프트웨어 GPU / headed 환경:
SIDEKICK_HEADED=1 xvfb-run -a npm run test:browser
```

`CHROMIUM_PATH`로 설치된 Chromium 경로를 지정할 수 있습니다. GitHub Actions는 실제 HTTP origin에서 타입 검사, 단위 테스트, 브라우저 테스트를 수행하도록 구성되어 있습니다. `SIDEKICK_SCREENSHOTS=artifacts`는 데스크톱/모바일/변경 상태 스크린샷을 저장합니다.

단위 테스트는 디자인 검증, 표면/법선/프레임, 스프링 시간 안정성, 모션 완료/취소, 메시 winding, 서버 import를 검사합니다. 브라우저 테스트는 실제 WebGL 렌더링, Flat/3D 알파 커버리지 일치, 뒤쪽 눈 가림, UI 편집, JSON/PNG, 클릭 통과, 키보드, 정지/시선, 화면 밖 중단, 제거/재장착, 컨텍스트 복구, 안전 여백, 모바일, 저장소 재로드, WebGL 미지원 fallback을 검사합니다.

네트워크가 차단된 QA 환경에는 `SIDEKICK_OFFLINE_BROWSER=1`을 제공합니다. 정책을 바꾸거나 외부 네트워크를 사용하지 않고 빌드한 ES 모듈을 Blob URL로 브라우저에 주입합니다. 이때 실제 WebGL 렌더링 테스트는 유지하지만, opaque origin이므로 **로컬 저장소 재로드 테스트 1개는 명시적으로 건너뜁니다**. 일반 HTTP 모드에서는 이 테스트도 실행합니다. Chromium 외 Safari/Firefox 및 실제 모바일 GPU의 성능 검증은 별도입니다.

## 현재 범위 밖

임의 윤곽선 기반 메시 생성, GLTF/외부 메시 가져오기, 사용자 정의 파츠 플러그인, 파츠 충돌/옷감 물리, 픽셀 단위 히트 테스트, 멀티 컨텍스트 공유, 에이전트/AI 서비스 연결은 아직 구현하지 않았습니다. 이 버전은 파라미터 몸체·공통 장착 규격·교체 가능한 파츠·모션·웹 삽입 API와 편집기를 검증하는 실행 가능한 초기 구현입니다.
