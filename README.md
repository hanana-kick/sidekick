# Sidekick

**35개 Material 도형으로 만드는 투명 Flat 웹컴포넌트.** 도형을 선택하면 현재 모습에서 자연스럽게 모프합니다. 몸체는 카탈로그의 XY 윤곽을 유지하면서 앞뒤로 둥글게 이어지는 입체이며, 눈은 그 표면에 붙은 캡슐 잉크입니다. 액세서리는 머리·눈·입·목·왼쪽 귀·오른쪽 귀 슬롯에 장착합니다. 무조명 단색 표현에서도 회전과 앞뒤 가림을 유지합니다.

## 실행

Node.js 22.22.2 이상이 필요합니다. 코어 웹컴포넌트는 프레임워크 의존성이 없고, Studio는 React 19 + Vite 8 + Tailwind CSS 4 + shadcn/ui로 구현합니다.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173
```

`dev`는 Vite 개발 서버와 React Fast Refresh를 사용합니다. 외부 접근이 필요할 때만 `HOST=0.0.0.0 npm run dev`를 사용하세요. 포트는 `PORT`로 변경합니다.

```sh
npm run build
npm start
```

Studio의 외형 설정은 몸체 도형·색상, 눈 색상, 액세서리 선택·색상입니다. 35개 실제 윤곽 타일을 검색하거나 키보드로 선택할 수 있습니다. 눈 비율·볼륨·장착 위치는 각 도형에 맞는 내부 기본값을 사용합니다. 별도의 애니메이션 영역에서 도형 전환 시간·easing, 좌우 표정 프리셋과 독립적인 웃음·감기 가중치, 활동·시선을 조절합니다. 카메라는 좌우·상하·기울기 슬라이더와 정면·사선·측면 프리셋을 제공하며 드래그한 각도도 즉시 표시합니다. JSON 가져오기/내보내기, 투명 PNG 저장, 브라우저 로컬 저장을 지원합니다. 저장소 접근이 차단되면 파일 내보내기를 사용할 수 있습니다.


### Studio UI와 빌드

공식 [shadcn/ui Vite 설치](https://ui.shadcn.com/docs/installation/vite)를 따라 CLI 4.22.0으로 Radix/Nova 컴포넌트 소스를 생성했습니다. `components.json`의 `baseColor`와 실제 CSS 토큰은 **Slate**이며 `--pointer` 옵션으로 버튼 포인터를 켰습니다. 탭·토글 그룹·선택·슬라이더·필드·입력·알림·배지는 `playground/components/ui/`의 실제 shadcn 소스를 사용합니다. 슬라이더에는 각 Thumb의 접근 가능한 이름·현재 값 설명을 전달하는 작은 확장이 있습니다. 글꼴은 로컬 번들에 포함되어 외부 폰트 서버를 요청하지 않습니다.

```sh
npx shadcn@4.22.0 init --base radix --preset nova --pointer --no-monorepo --no-rtl --yes
npx shadcn@4.22.0 add @shadcn/button @shadcn/tabs @shadcn/slider @shadcn/toggle-group @shadcn/field @shadcn/alert @shadcn/input @shadcn/textarea @shadcn/select @shadcn/separator @shadcn/badge --yes
```

화면은 `100dvh`와 safe-area를 사용합니다. 데스크톱은 미리보기와 설정을 나란히 배치하고, 모바일 세로 화면은 미리보기 아래의 남은 공간에서 설정만 스크롤합니다. 짧은 가로 화면은 나란히 배치합니다. 페이지 자체가 스크롤되어 캐릭터가 화면 밖으로 사라지지 않습니다. 외형, 애니메이션, 카메라, JSON 탭은 서로 분리되어 있으며 키보드로 이동할 수 있습니다.

`npm run build`는 타입 선언을 포함한 기존 `dist/src/` ES 모듈을 유지하면서 배포 루트의 `dist/index.html`, 호환 경로 `dist/playground/index.html`, 해시된 `dist/assets/`를 만듭니다. 정적 배포에는 `dist/` 전체를 사용하세요. 라이브러리 삽입만 필요하면 `dist/src/`를 사용하며 React가 필요하지 않습니다.

## 웹사이트에 삽입

빌드한 `dist/src` 폴더를 사이트의 `/sidekick` 경로에 배치하는 예시입니다. 스크립트는 custom element를 자동 등록합니다. 배경은 투명하며 크기는 CSS로 설정합니다.

```html
<script type="module" src="/sidekick/index.js"></script>
<sidekick-avatar
  id="bot"
  render-style="flat"
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
  body: { shape: 'verySunny', color: '#e9b64d' },
  eyes: {
    color: '#24242c',
    left: { weights: { smile: 0, blink: 0 } },
    right: { weights: { smile: 0, blink: 0 } },
  },
  accessories: [createAccessory('beret', 'hat')],
}));

await bot.setShape('clover4Leaf', { duration: 450, easing: 'smooth' });
await bot.setExpression('left', 'smile', { duration: 300 });
bot.setActivity('thinking');
bot.setCamera({ yaw: 35, pitch: 12, roll: 0 }); // 카메라는 도(degree) 단위
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });
await bot.motion.to({
  body: { rotation: [0, 0, 0.2] },
  face: { uv: [0.2, 0.1] },
  accessories: { hat: { rotation: [0, 0.2, 0] } },
}, { duration: 500, easing: 'smooth' });
```

패키지는 아직 npm에 발행하지 않았습니다. 다른 프로젝트에서는 먼저 이 저장소를 빌드한 뒤 `npm install /absolute/path/to/sidekick`으로 로컬 패키지를 연결하거나 빌드 산출물을 정적 배포할 수 있습니다. React/Vue/Svelte 의존성 없이 Custom Element API를 사용합니다. 패키지 진입점의 서버 import는 DOM 전역 없이도 안전하지만 실제 요소 생성/렌더링은 브라우저에서 수행합니다.

## v7 디자인 계약

새 디자인은 `version: 7`입니다. 외형 설정과 표정 애니메이션 상태만 저장합니다. 몸체는 `shape`·`color`, 눈은 `color`와 좌우 `weights`, 액세서리는 `id`·`preset`·`slot`·`color`입니다.

```ts
const design = createDesign({
  body: { shape: 'puffy', color: '#8bba9c' },
  eyes: { color: '#24242c' },
  accessories: [{ ...createAccessory('glasses', 'frames'), color: '#31323d' }],
});
// design.version === 7
// design.body === { shape: 'puffy', color: '#8bba9c' }
// design.eyes.left === { weights: { smile: 0, blink: 0 } }
```

`createDesign(patch)`는 기본값을 채운 완전한 `AvatarDesign`을 생성합니다. `patchDesign(current, patch)`는 원본을 변경하지 않고 좌우 눈의 `weights`를 깊게 병합합니다. `bot.updateDesign(patch)`는 같은 검증·병합 규칙을 요소에 적용합니다. `parseDesign(objectOrJson)`은 버전, 키, 숫자 범위, 색상, 도형 이름, 액세서리 id·슬롯·중복 장착을 검증하며 독립된 복사본을 반환합니다. `setDesign`은 검증 실패 시 현재 디자인을 유지하고 Promise를 reject합니다. 동기 `design` setter도 제공합니다.

- 몸체 외형: 35개 `MaterialShapeName` 중 하나와 `#RRGGBB` 색상
- 눈 외형: `#RRGGBB` 색상
- 눈 애니메이션: `left` / `right` 각각 `weights: { smile, blink }`, 각 값은 0~1
- 액세서리 외형: `beret`, `halo`, `glasses`, `moustache`, `bowTie`, `scarf`, `earring` 중 슬롯당 하나, 고유 id와 색상

새 생성·패치·v7 JSON은 몸체 `profiles`·깊이·크기·변형, 눈 형태·너비·높이·간격·크기·위치·목표 모양, 액세서리 위치·회전·크기·추종 설정을 거부합니다. 내부 렌더링용 눈 비율·볼륨·장착 프로필과 목표 모양은 공개 디자인 API에서 편집하거나 내보내지 않습니다. 이전 파일은 아래 마이그레이션 경로로 검증한 뒤 이 최소 형식으로 변환합니다. 모프 중간 상태는 런타임에만 존재하며 저장 파일에 합성 몸체로 추가되지 않습니다.

`motion.to()`의 포즈 회전은 **라디안**, `setCamera()`와 `camera`의 보기 각도는 **도(degree)**입니다. 이전 `setView()`만 라디안을 유지합니다. 얼굴·액세서리의 런타임 포즈 모션은 외형 설정과 별개이며 디자인 JSON을 바꾸지 않습니다.

## Material 도형 35개

```ts
import { MATERIAL_SHAPE_NAMES, MATERIAL_SHAPE_LABELS } from '@hanana-kick/sidekick';
import type { MaterialShapeName } from '@hanana-kick/sidekick';

const menu = MATERIAL_SHAPE_NAMES.map(name => ({
  name, label: MATERIAL_SHAPE_LABELS[name],
}));
const next: MaterialShapeName = 'cookie9Sided';
await bot.setShape(next);
```

- 기하학: `circle`, `square`, `slanted`, `arch`, `fan`, `arrow`, `semiCircle`, `oval`, `pill`, `triangle`, `diamond`, `clamShell`, `pentagon`, `gem`
- 별·햇살·쿠키: `verySunny`, `sunny`, `cookie4Sided`, `cookie6Sided`, `cookie7Sided`, `cookie9Sided`, `cookie12Sided`, `burst`, `softBurst`, `boom`, `softBoom`
- 유기형·기타: `ghostish`, `clover4Leaf`, `clover8Leaf`, `flower`, `puffy`, `puffyDiamond`, `pixelCircle`, `pixelTriangle`, `bun`, `heart`

Studio는 공식 곡선 데이터로 그린 실루엣 타일 35개를 펼쳐 보여줍니다. 넓은 데스크톱은 7열, 일반 데스크톱과 모바일은 5열이며 도형 목록 자체에는 별도 스크롤이 없습니다. 도형 이름과 선택 표시를 함께 제공하고, 방향키·Home·End로 초점을 옮긴 뒤 Enter/Space로 선택합니다. 검색·선택·설정 동기화 때 버튼을 새로 만들지 않아 초점이 유지됩니다.

별 계열은 `verySunny`, `sunny`, `burst`, `boom` 등의 공식 이름을 사용합니다. `star`는 API 이름이 아니지만 Studio 검색에서는 찾을 수 있습니다.

윤곽 데이터는 고정된 [AndroidX MaterialShapes 소스](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt)의 35개 레시피를 공식 `graphics-shapes-android:1.1.0`으로 계산한 정규화 3차 Bézier 곡선입니다. 도형별 코너·스무딩·회전·반복과 종횡비를 보존합니다. 출처·Apache 2.0 고지는 `third_party/material-shapes/`, 재생성 도구는 `scripts/generate-material-shapes.mjs`에 있습니다. 일반 빌드에는 Java나 외부 런타임이 필요하지 않고, 재생성할 때만 Java 21+, unzip, 네트워크가 필요합니다.

곡선을 폴리라인으로 바꾸는 허용오차는 중심 좌표 `[-1, 1]` 기준 `0.00005`입니다. 이는 윤곽 근사 설정이며 최종 메시나 화면 픽셀의 오차 보장이 아닙니다.

## 자연스러운 자동 전환

```ts
// 기본값: 450ms, smooth. 목표 이름은 즉시 design.body.shape에 저장됩니다.
const first = bot.setShape('puffy');

// 끝나기 전에 다시 호출해도 현재 보이는 윤곽에서 새 목표로 이어집니다.
const next = bot.setShape('pixelTriangle', {
  duration: 650,
  easing: 'smooth', // 또는 'linear'
});
console.log(await first); // { finished: false } (다음 전환으로 대체됨)
console.log(await next);  // { finished: true }
```

35개 도형 모두 서로의 윤곽으로 직접 모프합니다. 윤곽 방향과 둘레의 시작 위치를 맞춰 불필요한 꼬임을 줄이고, 출발·목표 윤곽을 유지합니다. `puffy`와 `pixelTriangle`도 같은 방식을 사용합니다. 공식 Material 윤곽 데이터를 사용하지만 대응점 계산은 Sidekick 방식이므로 Android Material의 특징점 매칭 `Morph`와 같은 보간이나 픽셀 단위 일치를 보장하지 않습니다.

`setShape(name, options)`는 카탈로그 이름 문자열만 받습니다. `duration`은 0~60000 밀리초이며 0이면 즉시 적용합니다. `smooth`는 부드럽게 출발하고 도착하며 `linear`는 일정한 진행률을 사용합니다. 연속 선택은 마지막 목표를 따르고, 중단된 전환의 Promise는 `{ finished: false }`로 끝납니다. 빠르게 여러 번 선택해도 JSON에는 마지막 목표 이름만 저장됩니다.

색상·눈·액세서리 편집은 진행 중인 도형 전환을 유지합니다. `design`/`setDesign()`으로 도형 이름을 바꾸면 즉시 적용합니다. Studio의 도형 선택은 자동 전환하고 전체 JSON 가져오기·초기화는 즉시 적용합니다. 전환 시간과 easing은 Studio 미리보기 설정이며 디자인 JSON에는 포함하지 않습니다.

`prefers-reduced-motion`, 일시 정지 상태, 문서에 연결되지 않은 요소에서는 새 목표를 즉시 적용합니다. 진행 도중 모션 줄이기나 일시 정지를 켜도 목표에 도착합니다. 화면 밖에서는 진행을 멈추고 다시 보이면 이어집니다. 요소 제거나 WebGL 컨텍스트 손실은 진행 중인 Promise를 취소하고 저장된 목표를 보존합니다. 다시 연결하거나 복구하면 그 목표가 표시됩니다. `motion.to()`의 포즈 애니메이션과 도형 전환은 별도로 동작합니다.

## 표면 위 캡슐 눈

눈은 별도 돌출 메시가 아닌 몸체 셰이더의 색상 마스크입니다. 캡슐과 웃음 곡선은 몸체 로컬 XY 좌표에서 정의하고, 둥근 앞면 위에 직접 그립니다. 정면에서는 내부 기본 비율을 유지하고, 기울이거나 돌리면 실제 곡면의 투영과 깊이 가림에 따라 모양이 달라집니다. 몸체가 기울면 눈도 함께 기울며 화면에 고정된 방향·크기를 강제하지 않습니다.

각 도형에 맞는 눈 비율·간격·세로 위치는 내부 기본값입니다. 도형을 바꾸면 이 값들도 윤곽과 함께 보간됩니다. 깊게 파인 도형에서는 두 눈의 중심을 함께 안쪽으로 맞춥니다. 이 보정은 표정 가중치와 카메라에 독립적입니다. `left`는 모델 -X(정면 화면 왼쪽), `right`는 +X입니다.

표정은 몸체 실루엣이나 알파 커버리지를 바꾸지 않습니다. 몸체 밖, 뒷면, 다른 표면이나 액세서리에 가려진 부분에서는 잘리거나 숨겨집니다. 정확한 측면(90°)에서도 둥근 앞면의 가까운 쪽 눈 일부가 보일 수 있으며 뒷면(180°)에는 눈을 그리지 않습니다. 눈의 시선 이동과 얼굴 전체 이동은 독립적입니다. 얼굴 액세서리는 얼굴 이동만 따라가며 눈동자 시선에 끌려가지 않습니다.

### 좌우 표정 애니메이션

기본 캡슐이 중립 형태이고 각 눈의 웃음·감기 가중치는 독립적으로 0~1입니다. 가중치 합을 1로 정규화하지 않습니다. 완전한 웃음은 정확한 위쪽 반원 중심선에 일정한 두께와 둥근 끝을 가진 형태입니다. 중간 가중치는 캡슐에서 원호로 연속 변하며, 웃음과 감기를 함께 적용하면 감긴 선으로 수렴합니다. 완전히 감긴 끝점은 웃음 가중치와 무관합니다. 웃음 반지름·선 두께와 감긴 선 두께는 내부 기본값입니다.

```ts
await bot.setDesign(createDesign({
  eyes: {
    color: '#24242c',
    left: { weights: { smile: 0.7, blink: 0.2 } },
    right: { weights: { smile: 0.15, blink: 0.65 } },
  },
}));

// 생략한 가중치와 다른 눈은 유지합니다.
await bot.setEyeWeights('left', { smile: 0.85 }, { duration: 300 });
await bot.setEyeWeights('right', { blink: 0.4 }, { duration: 180 });
// 슬라이더처럼 즉시 반영할 때:
await bot.setEyeWeights('left', { smile: 0.6 }, { duration: 0 });

// 프리셋은 두 가중치를 정확히 설정합니다.
await bot.setExpression('left', 'smile');   // { smile: 1, blink: 0 }
await bot.setExpression('right', 'blink');  // { smile: 0, blink: 1 }
await bot.setExpression('both', 'neutral'); // { smile: 0, blink: 0 }

// 저장 디자인을 바꾸지 않는 일시적 포즈:
await bot.motion.to({
  eyes: { left: { weights: { smile: 0.5, blink: 0.2 } } },
}, { duration: 400 });
```

`setEyeWeights(side, partialWeights, options)`는 선택한 눈의 저장 가중치를 즉시 갱신하고 현재 포즈에서 전환합니다. `side`는 `left` / `right` / `both`이며 `both`의 부분 패치도 각 눈의 기존 가중치를 따로 유지합니다. 기본 전환은 400ms, `smooth`입니다. `duration`은 0~60000ms, `easing`은 `smooth` / `linear`입니다. 잘못된 방향·가중치·옵션은 디자인이나 기존 애니메이션을 변경하지 않고 거부합니다.

`setExpression`은 가중치 프리셋입니다. 기본 시간은 `blink` 90ms, `neutral` 180ms, `smile` 280ms이며 명시한 시간과 easing이 우선합니다. `blink`는 감긴 상태를 유지합니다. 윙크는 한쪽에 `blink`를 적용한 뒤 원하는 프리셋이나 가중치를 설정합니다.

`eyeExpressionWeights(name)`, `createEyeState(patch)`, `patchEyeState(state, patch)`, `parseEyeState(state)`와 `EyeShapeWeights`, `EyeState`, `EyeStatePatch` 타입을 제공합니다. 눈 상태는 `weights`만 가지며 `targets`는 허용하지 않습니다. `pose.eyes`의 `openness`는 렌더링용 `1 - blink` 값이며 저장할 별도 상태가 아닙니다. 이전 `expression` / `openness` 파일은 마이그레이션에서 변환합니다.

몸체 회전, 얼굴 위치, 좌우 눈, 공통 눈 뜨기 제한, 각 액세서리는 독립된 시간축을 사용합니다. 오른쪽 가중치를 바꿔도 왼쪽이나 몸체의 남은 시간은 다시 시작되지 않습니다. 같은 채널을 바꾸면 현재 포즈에서 이어지고 이전 요청의 Promise는 `{ finished: false }`로 끝나지만 그 요청의 다른 채널은 원래 일정대로 계속됩니다. 색상·액세서리 선택 편집도 눈의 가중치 애니메이션을 취소하지 않습니다. 모든 포즈 채널을 멈추려면 `motion.cancel()`을 사용합니다.

활동 중 자동 깜박임은 빠르게 감고 잠깐 유지한 뒤 더 천천히 엽니다. 직접 가중치를 바꾸는 눈에는 새 자동 깜박임을 겹치지 않으며 이미 진행 중인 깜박임은 끝까지 이어집니다. 좌우 제어는 독립적입니다. 모션 줄이기 또는 일시 정지를 켜면 진행 중인 전환은 목표에서 완료됩니다. Studio는 외형 탭과 분리된 애니메이션 영역에서 가중치 슬라이더를 즉시 반영하고 프리셋을 짧은 애니메이션으로 적용합니다.

## 액세서리 슬롯

`head`에는 베레모 또는 헤일로, `eyes`에는 안경, `mouth`에는 콧수염, `neck`에는 보타이 또는 스카프를 하나씩 장착합니다. `leftEar`와 `rightEar`에는 귀걸이를 각각 장착할 수 있습니다. 다른 슬롯은 동시에 사용할 수 있으며, 보타이와 스카프는 같은 목 슬롯을 공유합니다. `slot`은 동시에 착용할 수 있는 항목을 제한하며 장착 위치와 크기는 내부에서 정합니다. `ACCESSORY_SLOT_BY_PRESET`, `ACCESSORY_SLOTS_BY_PRESET`, `ACCESSORY_SLOTS`, `AccessorySlot`을 제공합니다. 귀걸이는 허용 슬롯이 두 개이므로 명시적인 `slot`이 필요합니다.

```ts
const left = createAccessory('earring', { slot: 'leftEar', id: 'left-earring' });
const right = createAccessory('earring', { slot: 'rightEar', id: 'right-earring' });
const pair = createDesign({ accessories: [left, right] });
// 두 귀걸이는 독립된 액세서리 인스턴스입니다.
```

```ts
import { createAccessory, createDesign, equipAccessory, patchDesign } from '@hanana-kick/sidekick';

let design = createDesign({ accessories: [
  createAccessory('beret', 'hat'),
  { ...createAccessory('glasses', 'frames'), color: '#31323d' },
] });
design = equipAccessory(design, createAccessory('halo', 'aura'));
// 베레모만 헤일로로 교체. 안경과 그 설정은 유지합니다.
design = patchDesign(design, {
  accessories: design.accessories.filter(item => item.slot !== 'head'),
});
```

`equipAccessory`와 `removeAccessory(design, id)`는 원본을 변경하지 않고 검증된 새 디자인을 반환합니다. 요소에서는 `await bot.equipAccessory(item)`과 `await bot.removeAccessory(id)`를 사용하며 다른 파츠의 모션은 유지합니다. 같은 슬롯의 항목은 기존 배열 위치에서 교체하고 빈 슬롯에는 추가합니다. 다른 슬롯에서 이미 사용 중인 id는 사용할 수 없습니다. 중복 슬롯이나 잘못 지정한 슬롯은 오류로 거부합니다. Studio에서 선택된 항목을 다시 누르면 해제합니다. 액세서리는 표면 장착점을 따라가는 강체이며 몸체처럼 늘어나지 않습니다.

### 도형에 맞춘 착용감

베레모는 입구 안쪽의 오목한 면, 두께가 있는 말린 테두리, 좁은 밴드, 한쪽으로 부드럽게 처지는 크라운과 짧은 꼭지를 연결한 닫힌 메시입니다. 크라운은 지정한 단색을, 밴드와 안쪽 면은 같은 색의 짙은 단색을 사용합니다. 실제 몸체 곡면과 아래쪽 셸을 비교해 접촉 높이를 맞춥니다. 전환 중에도 현재 보이는 윤곽과 깊이를 사용합니다. 이는 수치적 강체 맞춤이며 천의 변형이나 물리 시뮬레이션은 아닙니다.

안경은 원형 렌즈 테두리의 강체 형태를 유지합니다. 각 도형의 실제 눈 중심·크기에 맞춰 전체 프레임의 위치·회전·균일 크기를 정하고 두 렌즈 사이 간격에 맞게 브리지를 연결합니다. 테두리를 정점마다 몸체 표면에 휘어 붙이지 않습니다. 표정 가중치에 따라 프레임이 커지거나 눈동자 시선에 끌려가지 않으며 얼굴 전체 움직임은 따라갑니다. 머리 액세서리와 안경 모두 도형별 내부 배치를 사용합니다. 사용자가 조절하는 항목은 착용 선택과 색상입니다.

## 이전 디자인 가져오기

`parseDesign`은 v1~v6 파일을 검증한 뒤 v7으로 변환합니다. 이전 `face` 슬롯은 `eyes`로 바꾸고 id·색상·표정은 보존합니다. 버린 기하 설정의 안내가 필요하면 `migrateDesign(input)`을 사용하세요.

```ts
import { migrateDesign } from '@hanana-kick/sidekick';
const { design, warnings } = migrateDesign(oldJson);
// design.version === 7
// warnings에는 버린 외형 기하 설정과 필요한 도형 근사 안내가 포함됩니다.
await bot.setDesign(design);
```

이전 Material 이름 선택에 기본 XY 크기 `[1.12, 1.18]`, taper/bend `0`, bulge `0` 또는 `0.05`가 사용되었다면 그 이름을 유지합니다. 그 외에는 이전 윤곽을 정규화하고 둘레의 등간격 128개 샘플을 모든 시작 위치에서 비교하여 제곱 거리 오차가 가장 작은 카탈로그 도형 하나를 선택합니다. 동률이면 카탈로그 순서를 사용합니다. 기본 파라미터의 기존 `orb`는 `circle`, `rounded-box`는 `square`, `droplet`은 `gem`으로 변환됩니다. 이는 근사 변환이며 원래 기하를 정확히 복원하지 않습니다.

- 몸체의 카탈로그 이름·색상, 눈 색상, 액세서리 id·프리셋·슬롯·색상과 표정 가중치를 보존합니다.
- v1 `eyes.preset: 'capsule'` 또는 `'round'`는 좌우 중립 가중치로, `'arc'`는 좌우 웃음 가중치로 변환합니다.
- v2/v3 `neutral`은 웃음 0·감기 `1 - openness`, `smile`은 웃음 1·감기 `1 - openness`, `blink`는 웃음 0·감기 1로 변환합니다.
- v4/v5/v6의 좌우 웃음·감기 가중치는 그대로 유지합니다.
- v6은 기존 `beret`·`halo`·`glasses`와 `head`·`face`만 허용합니다. 새 액세서리와 여섯 슬롯은 v7 입력에서 사용합니다.
- 이전 몸체 프로필·깊이·변형, 눈 크기·간격·위치·목표 모양, 액세서리 위치·회전·크기·추종 값은 엄격히 검증한 뒤 제거합니다. 렌더러는 현재 내부 기본 기하를 사용하므로 이전 외형과 달라질 수 있습니다. 변환 안내는 같은 입력에 대해 같은 순서로 반환합니다.
- 이전 파일에 액세서리 슬롯이 없으면 프리셋에서 유추합니다. 중복 슬롯은 자동으로 버리지 않으며 하나를 제거한 뒤 가져와야 합니다.
- 알 수 없는 키와 잘못된 기하값은 조용히 무시하지 않고 가져오기를 거부합니다. 새 v7 입력에는 제거된 기하 키를 넣을 수 없습니다.

Studio는 변환 안내를 설정 영역에 표시합니다. 로컬 저장은 `sidekick.design.v7`을 우선 읽고 없으면 v6, v5, v4, v3, v2, v1 순서로 찾습니다. 변환한 결과는 v7 키에 저장하며 이전 키의 원본은 유지합니다. 잘못된 저장 파일은 자동으로 덮어쓰지 않고 JSON 편집기에 열어 수정하거나 원본을 내려받게 합니다. 이후 사용자가 디자인을 변경하면 원본을 해당 키의 `.recovery`에 백업한 뒤 새 디자인을 저장합니다. 백업이 실패하면 덮어쓰지 않습니다. 가져오기 실패 시 현재 디자인도 유지합니다.

### 이전 렌더 스타일 호환

Flat은 무조명 단색 표현을 뜻하며 몸체의 평평한 기하를 뜻하지 않습니다. 출력 스타일과 공개 `RenderStyle` 타입은 `'flat'` 하나입니다. 이전 `render-style="3d"` 속성이나 런타임 `renderStyle = '3d'`는 `'flat'`으로 정규화합니다. 회전과 표면 가림을 계속 지원합니다. 새 코드에서는 `render-style="flat"`을 사용하거나 속성을 생략하세요.

## 동작 API

### 카메라 각도

```ts
import { createCamera, CAMERA_PRESETS, type CameraAngles } from '@hanana-kick/sidekick';

bot.setCamera({ yaw: 45, pitch: 15 }); // 부분 갱신: roll은 유지
const view: CameraAngles = bot.camera; // 독립된 { yaw, pitch, roll } 복사본
bot.camera = createCamera({ yaw: -30, pitch: 10, roll: 5 });
bot.setCameraPreset('three-quarter'); // front: 0°, three-quarter: 45°, side: 90°
bot.resetCamera(); // 세 축 모두 0°
bot.addEventListener('sidekick-camera-change', event => {
  console.log((event as CustomEvent<{ camera: CameraAngles }>).detail.camera);
});
```

`yaw`는 -360~360°, `pitch`는 -90~90°, `roll`은 -180~180°입니다. 모두 유한한 숫자만 받으며 알 수 없는 키나 잘못된 값은 현재 상태를 바꾸지 않고 오류를 냅니다. 프리셋은 pitch·roll을 0°로 초기화합니다. `CAMERA_PRESETS`는 읽기 전용이고 `cameraPreset(name)`은 독립된 복사본을 반환합니다.

보기 회전의 부호는 기존 드래그/`setView`와 같습니다. 양의 yaw는 앞면 방향을 화면 오른쪽으로, 양의 pitch는 윗부분을 보는 사람 쪽으로, 양의 roll은 화면 반시계 방향으로 돌립니다. 카메라 위치 좌표가 아니라 모델 원점을 중심으로 한 직교 보기 회전입니다. 카메라 행렬과 몸체 포즈 행렬을 따로 곱하므로 몸체의 모션과 액세서리 추종 상태를 바꾸지 않습니다.

카메라는 미리보기 런타임 상태이며 디자인 JSON·로컬 디자인 저장에 포함되지 않습니다. 디자인 편집·도형 전환·일시 정지 중에도 유지되며 PNG에는 현재 각도가 반영됩니다. API와 드래그 모두 값이 실제 바뀔 때 `sidekick-camera-change`를 발생시킵니다. `setView(yaw, pitch = 0)`는 기존 라디안 입력을 같은 카메라 상태로 전달하고 roll을 유지합니다.

| API | 동작 |
| --- | --- |
| `setShape(name,{duration,easing})` | 카탈로그 목표 이름 저장과 현재 윤곽에서 자동 전환 |
| `setActivity(name)` | `idle`, `thinking`, `listening`, `speaking`, `celebrating`, `still` |
| `lookAt({space:'view',x,y})` | -1~1 시선, 감쇠 스프링으로 추종 |
| `setEyeWeights(side,partialWeights,options)` | `left` / `right` / `both`의 부분 가중치 저장과 전환 |
| `setExpression(side,expression,options)` | `neutral` / `smile` / `blink`의 정확한 가중치 프리셋 |
| `updateDesign(patch)` | 외형 선택·색상·눈 가중치를 검증·병합해 저장 |
| `motion.to(target,{duration,easing})` | 지정한 채널만 독립적으로 전환: 몸체 / 얼굴 / 좌우 눈 / 공통 눈 뜨기 / 각 액세서리 |
| `motion.cancel()` | 포즈 모션 중단; Promise는 `{finished:false}` |
| `paused = true` | 반복 애니메이션 정지, 진행 중 포즈·도형 전환은 목표까지 완료; 새 모션은 즉시 최종값 |
| `camera`, `setCamera({yaw,pitch,roll})` | 도 단위 보기 각도 읽기·갱신; 포즈·디자인과 분리 |
| `setCameraPreset(name)`, `resetCamera()` | 정면·사선·측면과 세 축 초기화 |
| `setView(yaw,pitch)` | 기존 라디안 보기 각도 호환; roll 유지 |
| `seek(seconds)` | 반복 애니메이션 시간 지정 |
| `snapshot()` | 실제 알파 채널을 가진 PNG Blob |
| `capturePixels()` | `{width,height,pixels}`; 아래 행부터 RGBA |
| `ready`, `diagnostics` | 준비 상태, RAF 동작 여부, 프레임 수, draw call/버퍼 수 |

`sidekick-ready`, `sidekick-error`, `sidekick-design-change`, `sidekick-camera-change`, `sidekick-motion-end`, `sidekick-shape-end`, `sidekick-activate` 이벤트는 Shadow DOM 바깥으로 전달됩니다. `sidekick-error.detail.message`로 렌더러 오류를 확인합니다. 모션 종료 이벤트의 `detail.finished`는 완료 여부입니다.

## 클릭과 투명도

- `interaction="none"` (기본): 요소 전체가 클릭을 통과시킵니다.
- `interaction="box"`: 사각형 영역 전체를 잡습니다. 드래그 회전과 클릭/Enter/Space 활성화를 지원합니다. 투명 픽셀도 클릭 영역에 포함됩니다.

픽셀/실루엣 기반 히트 테스트는 아직 구현하지 않았습니다. Studio의 체크무늬·밝은색·어두운색은 바깥 DOM 배경이며 PNG에 포함되지 않습니다.

## 구성과 테스트

**TypeScript + 네이티브 WebGL2 + 네이티브 Web Component**로 구현했습니다. 무조명 단색 셰이더, 직교 카메라, 깊이 테스트와 투명 알파 채널을 사용합니다. 코어는 `src/core/`, 렌더러는 `src/renderer/`, 요소와 생명주기는 `src/element/`, React 편집기와 shadcn 소스는 `playground/`에 있습니다. `studio-controller.ts`가 저장·마이그레이션·명령을 관리하며 `studio-app.tsx`는 하나의 안정된 `<sidekick-avatar>` 인스턴스에 연결합니다. React 재렌더나 탭 전환으로 요소를 다시 만들거나 디자인·카메라·진행 중인 모프를 재설정하지 않습니다.

몸체 메시와 표면 질의는 같은 둥근 볼륨 함수를 사용합니다. 정규화 XY 좌표에서 윤곽까지의 내부 거리 `d`와 중심 거리의 제곱 `r² = x² + y²`로 높이 `h = sqrt(d / (d + 0.65 × r²))`를 계산하고, 앞뒤 Z 좌표를 `±depth × h / 2`로 만듭니다. 윤곽에서는 높이가 0이며 중심에서는 전체 깊이가 `depth`입니다. 35개 도형의 카탈로그 XY 경계와 오목한 부분을 보존하고, 곡면 내부를 삼각형으로 근사합니다. 이 볼륨 구성은 Sidekick 방식이며 AndroidX의 3D 모델을 재현한다는 뜻이 아닙니다. 공개 외형 편집 범위는 몸체 카탈로그 이름·색상, 눈 색상, 액세서리 선택·색상입니다. 도형별 깊이·눈 비율·장착 기하는 내부 기본값이며 외곽선·3D 스타일 토글은 없습니다.

곡면 메시의 내부 정점은 제한된 격자와 공유 변의 분할로 생성합니다. 표면 거리 0.010, 중앙 높이 0.006은 정규화 좌표의 샘플 기반 세분화 목표이며 모든 위치의 오차 상한은 아닙니다. 최대 8회 분할과 앞면 12,000점 예산을 적용하고, 같은 윤곽의 결과는 재사용합니다. 화면 크기와 시점에 따라 작은 삼각형 근사 오차가 보일 수 있습니다.

요소마다 WebGL 컨텍스트 하나와 재사용 가능한 메시 버퍼를 사용합니다. 눈은 추가 메시나 draw call을 만들지 않습니다. 기본 몸체+베레모는 3 draw call입니다. DPR은 최대 2, 캔버스는 각 축 최대 2048px입니다. 크기 변경, 화면 밖/탭 비활성화 시 중단, reduced-motion, 제거 시 GPU 자원 해제, 컨텍스트 손실/복구를 처리합니다.

```sh
npm run typecheck
npm test
# ReactDOM + jsdom으로 실제 shadcn/Radix 상호작용과 렌더러 경계를 검사:
npm run test:studio
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
# Linux 소프트웨어 GPU / headed 환경:
SIDEKICK_HEADED=1 xvfb-run -a npm run test:browser
```

`CHROMIUM_PATH`로 설치된 Chromium 경로를 지정할 수 있습니다. GitHub Actions는 실제 HTTP origin에서 타입 검사, 단위 테스트, 브라우저 테스트를 수행하도록 구성되어 있습니다. `SIDEKICK_SCREENSHOTS=artifacts`는 데스크톱/모바일/변경 상태 스크린샷을 저장합니다.

단위 테스트는 최소 디자인 계약·엄격한 마이그레이션, 도형 간 대응과 직접 모프, 표면·법선·프레임, 모션 완료·취소, 메시 winding, 서버 import, Studio의 실제 ReactDOM/Radix 상호작용과 목업 렌더러 경계를 통한 저장·복구를 검사합니다. 이 테스트는 슬라이더의 접근 가능한 이름, 탭 연결, 지속적인 요소 식별성, 독립 슬롯과 모프 명령 순서를 검사하며 브라우저 레이아웃·WebGL 렌더링 검증을 대체하지 않습니다. 브라우저 테스트 소스에는 Flat·투명도, 35개 실루엣 타일·키보드 선택, 자동 전환·재선택·목표 저장, 둥근 측면 실루엣, 표면 눈의 투영·가림, 독립 웃음·감기 애니메이션, 외형 색상·액세서리 슬롯, JSON/PNG, 클릭 통과, 정지·시선, 화면 밖 중단, 제거·재장착, 컨텍스트 복구, 여백, 모바일, 저장소·복구, WebGL fallback 검증이 있습니다. 실제 브라우저 실행에는 별도의 허용된 Chromium 환경이 필요합니다.

네트워크가 차단된 QA 환경에는 `SIDEKICK_OFFLINE_BROWSER=1`을 제공합니다. `http://sidekick.test` 요청을 가로채 실제 프로덕션 빌드 파일로 응답합니다. 일반 HTTP origin과 같은 로컬 저장소를 사용하므로 재로드·이전 저장 마이그레이션 테스트도 건너뛰지 않습니다. Chromium 외 Safari/Firefox 및 실제 모바일 GPU의 성능 검증은 별도입니다. CPU 기하 계산 시간은 브라우저의 GPU 렌더링·프레임 시간을 포함하지 않으므로 일정한 FPS를 보장하지 않습니다.

임의 SVG/사용자 정의 윤곽·메시, 외부 메시 가져오기, 파츠 플러그인, 옷감 물리, 픽셀 히트 테스트, 공용 렌더러/컨텍스트 풀, 에이전트/AI 서비스 연결은 현재 지원 범위 밖입니다.
