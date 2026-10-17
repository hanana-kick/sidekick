# Sidekick

**35개 Material 도형으로 만드는 투명 Flat 캐릭터 라이브러리.** 기본 `<sidekick-avatar>` 하나로 시작하고 HTML 속성, JavaScript API, React 래퍼 중 편한 방식으로 제어할 수 있습니다. 도형 전환, 좌우 표정, 마우스 시선 추적, 카메라 회전, 여섯 슬롯의 액세서리를 지원합니다. 코어는 프레임워크 의존성이 없는 TypeScript + Web Component + WebGL2입니다.

- [설치](#설치) · [HTML](#html에서-바로-사용하기) · [React](#react에서-사용하기)
- [전체 속성](#html-속성과-react-props) · [디자인과 액세서리](#디자인-json과-액세서리) · [애니메이션/API](#애니메이션과-명령형-api)
- [이벤트/정리](#이벤트와-정리) · [SSR](#ssr과-브라우저-지원) · [Studio/개발](#studio와-개발)

## 설치

현재 패키지 이름은 `@hanana-kick/sidekick`, 버전은 `0.2.0`입니다. **npm 레지스트리에는 발행하지 않았습니다.** 이름만으로 `npm install @hanana-kick/sidekick`을 실행하는 대신 아래 tarball 또는 Git 설치를 사용하세요. `private: true`는 실수로 레지스트리에 발행하지 않도록 막는 설정이며 tarball/Git 의존성 설치는 가능합니다.

### 빌드된 tarball 설치

저장소에서 Node.js **22.22.2 이상**으로 패키지를 만듭니다.

```sh
npm ci
npm run pack:library
# hanana-kick-sidekick-0.2.0.tgz
```

사용할 프로젝트에서:

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.2.0.tgz
```

tarball에는 실행용 ES 모듈·타입 선언과 필요한 고지가 포함됩니다. 라이브러리를 설치하는 프로젝트에서 Studio를 빌드하거나 shadcn, Vite, Tailwind를 설치할 필요가 없습니다. React 래퍼를 사용하는 프로젝트에는 React 19가 필요하며, 코어만 사용할 때 React는 필요 없습니다.

### GitHub의 특정 커밋 설치

이 기능과 `dist/library/`가 포함된 커밋을 원격에 올린 뒤, `COMMIT_SHA`를 해당 **전체 커밋 SHA**로 바꾸세요. 아래 문자열은 발행된 버전이나 실제 SHA를 뜻하지 않는 템플릿입니다.

```sh
npm install 'git+ssh://git@github.com/hanana-kick/sidekick.git#COMMIT_SHA'
# HTTPS Git 인증을 이미 구성했다면:
npm install 'git+https://github.com/hanana-kick/sidekick.git#COMMIT_SHA'
```

비공개 저장소라면 해당 저장소를 읽을 수 있는 GitHub 계정과 SSH 키 또는 Git credential helper 인증이 먼저 필요합니다. 토큰을 URL·`package.json`·README에 넣지 마세요. 의존성 및 lockfile을 함께 커밋하면 팀도 같은 커밋을 사용합니다. 실행 산출물을 저장소에 포함하며 설치 수명주기 빌드를 요구하지 않습니다. 자세한 설치 방식은 [npm 공식 문서](https://docs.npmjs.com/cli/v11/commands/npm-install/)를 참고하세요.

### 진입점

| import 경로 | 용도 |
| --- | --- |
| `@hanana-kick/sidekick` | 기존 호환 진입점. 브라우저에서 기본 태그를 자동 등록하고 공개 API를 export |
| `@hanana-kick/sidekick/auto` | 자동 등록을 명시하는 브라우저 진입점 |
| `@hanana-kick/sidekick/register` | 자동 등록 없이 `defineSidekick`, 요소 클래스와 공개 API를 import |
| `@hanana-kick/sidekick/core` | DOM 없이 디자인·장면 생성/검증, 모션·카메라·픽셀 유틸리티 사용 |
| `@hanana-kick/sidekick/react` | React 컴포넌트 `SidekickAvatar`, props/ref 타입 |

모듈은 ESM입니다. CommonJS `require()`용 별도 빌드는 없습니다. 최종 라이브러리 산출물은 `dist/library/`, 내부 테스트용 개별 모듈은 `dist/src/`입니다.

## HTML에서 바로 사용하기

### 가장 작은 사용 예

Vite 등 번들러가 있는 사이트의 브라우저 진입 JavaScript:

```js
import '@hanana-kick/sidekick/auto';
```

HTML:

```html
<sidekick-avatar></sidekick-avatar>
```

등록이 끝나면 200 × 200px의 투명 캐릭터가 표시됩니다. 기본값은 노란 `square`, 어두운 눈, 액세서리 없음, `idle` 상태입니다. 라이브러리는 Studio의 CSS나 글꼴을 요구하지 않습니다. 크기는 일반 CSS로 정합니다.

```html
<sidekick-avatar
  id="bot"
  shape="verySunny"
  body-color="#e9b64d"
  eye-color="#24242c"
  head-accessory="beret"
  head-color="#b84742"
  mouse-tracking="true"
  interaction="box"
  shape-duration="450"
  aria-label="작업 도우미"
  style="width:160px;height:160px"
></sidekick-avatar>
```

번들러가 없는 사이트는 패키지의 `dist/library/` 전체를 `/sidekick/`에 복사하고, 브라우저용 자동 등록 모듈을 불러옵니다. `/react` 파일은 HTML 예제에 필요하지 않습니다.

```html
<script type="module" src="/sidekick/auto.js"></script>
<sidekick-avatar shape="heart" mouse-tracking="true"></sidekick-avatar>
```

`file://`로 열지 말고 HTTP 서버에서 제공하세요. bare import 이름은 브라우저가 직접 해석하지 못하므로 번들러, import map, 또는 위처럼 실제 모듈 경로를 사용해야 합니다. [Custom Element 등록과 사용](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)은 표준 Web Components 동작을 따릅니다.

### 명시적으로 등록하고 명령 보내기

```ts
import {
  defineSidekick,
  createDesign,
  createAccessory,
  type SidekickAvatar,
} from '@hanana-kick/sidekick/register';

defineSidekick(); // 여러 번 불러도 이미 등록된 기본 태그는 재등록하지 않음
await customElements.whenDefined('sidekick-avatar');
const bot = document.querySelector<SidekickAvatar>('#bot');
if (!bot) throw new Error('봇 요소를 찾을 수 없습니다.');

await bot.setDesign(createDesign({
  body: { shape: 'puffy', color: '#8bba9c' },
  accessories: [createAccessory('glasses', 'frames')],
}));
await bot.setShape('cookie9Sided', { duration: 600, easing: 'smooth' });
bot.mouseTracking = false;
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });
```

`defineSidekick('my-companion')`로 다른 태그 이름도 등록할 수 있습니다. React 래퍼는 기본 `sidekick-avatar`를 사용합니다. `whenDefined()`는 클래스 등록 완료를 뜻하며 GPU 렌더 준비를 뜻하지 않습니다. PNG가 필요하면 `bot.ready` 또는 `sidekick-ready`를 확인하세요.

## React에서 사용하기

```tsx
import { useRef, useState } from 'react';
import {
  SidekickAvatar,
  type SidekickAvatarRef,
} from '@hanana-kick/sidekick/react';

export function Companion() {
  const bot = useRef<SidekickAvatarRef>(null);
  const [shape, setShape] = useState<'square' | 'heart'>('square');
  const [tracking, setTracking] = useState(true);

  return (
    <>
      <SidekickAvatar
        ref={bot}
        shape={shape}
        bodyColor="#8bba9c"
        headAccessory="beret"
        mouseTracking={tracking}
        interaction="box"
        shapeDuration={450}
        shapeEasing="smooth"
        aria-label="나의 도우미"
        style={{ width: 160, height: 160 }}
        onReady={() => console.log('렌더 준비 완료')}
        onError={event => console.error(event.detail.message)}
      />
      <button onClick={() => setShape(value => value === 'square' ? 'heart' : 'square')}>
        도형 바꾸기
      </button>
      <button onClick={() => setTracking(value => !value)}>마우스 추적 전환</button>
      <button onClick={() => void bot.current?.setExpression('left', 'smile')}>
        왼쪽 눈 웃기
      </button>
    </>
  );
}
```

래퍼가 브라우저에서 요소를 등록하고 camelCase props를 HTML 속성에 연결합니다. `ref`는 실제 요소이므로 기존 명령형 API를 사용할 수 있습니다. `design`, `accessories`, `motion`은 문자열 대신 타입이 있는 객체로 전달할 수 있습니다. 일반적인 `id`, `className`, `style`, `aria-*`, `data-*`도 전달합니다.

```tsx
import { createAccessory, createDesign } from '@hanana-kick/sidekick/core';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

const design = createDesign({
  body: { shape: 'clover4Leaf', color: '#8bba9c' },
  accessories: [createAccessory('halo', 'aura')],
});

<SidekickAvatar design={design} mouseTracking={false} />;
```

속성 변경은 기존 요소에 반영됩니다. 애니메이션 도중 `key`를 바꾸거나 요소를 조건부로 제거하면 런타임이 다시 만들어지므로 안정된 `key`를 유지하세요. 한 값을 props와 명령형 API 양쪽에서 제어한다면, 나중에 해당 prop을 바꿀 때 선언적 값이 다시 적용됩니다. 애니메이션 전환은 `shape` prop 또는 `setShape()`를 사용하세요. React `design` prop도 HTML `design` 속성으로 연결되므로 연결 후 도형을 바꾸면 `shapeDuration`으로 전환합니다. 반대로 요소의 JavaScript `design` 프로퍼티와 `setDesign()`은 전체 디자인을 즉시 적용합니다.

## HTML 속성과 React props

아래 표의 camelCase는 **React props 이름**입니다. 모든 이름이 요소의 JavaScript 프로퍼티라는 뜻은 아닙니다. 일반 HTML에서는 `setAttribute()`/`removeAttribute()`를, 복합 제어는 아래 명령형 API를 사용하세요. 공개 외형과 런타임 입력은 모두 속성으로 지정할 수 있으며 읽기 전용 상태·이벤트·PNG 출력은 API로 받습니다.

### 기본·몸체·눈

| HTML 속성 | React prop | 값 / 기본값 |
| --- | --- | --- |
| `design` | `design` | 완전한 디자인 JSON. 생략 시 `createDesign()` 기본값 |
| `shape` | `shape` | 35개 카탈로그 이름. 기본 `square` |
| `body-color` | `bodyColor` | `#RRGGBB`. 기본 `#e9b64d` |
| `eye-color` | `eyeColor` | `#RRGGBB`. 기본 `#24242c` |
| `expression` | `expression` | 양쪽 눈 `neutral` / `smile` / `blink`. 기본 `neutral` |
| `left-expression` | `leftExpression` | 왼쪽 눈 프리셋 |
| `right-expression` | `rightExpression` | 오른쪽 눈 프리셋 |
| `smile` | `smile` | 양쪽 웃음 가중치 0~1. 기본 0 |
| `blink` | `blink` | 양쪽 감기 가중치 0~1. 기본 0 |
| `left-smile` | `leftSmile` | 왼쪽 웃음 가중치 0~1 |
| `right-smile` | `rightSmile` | 오른쪽 웃음 가중치 0~1 |
| `left-blink` | `leftBlink` | 왼쪽 감기 가중치 0~1 |
| `right-blink` | `rightBlink` | 오른쪽 감기 가중치 0~1 |
| `accessories` | `accessories` | 액세서리 배열 JSON. 기본 `[]` |
| `render-style` | `renderStyle` | `flat`만 공개 지원. 생략 시 `flat`; 이전 `3d` 입력은 `flat`으로 정규화 |

### 장비 슬롯

처음에는 모든 슬롯이 비어 있습니다. 색상 기본값은 베레모·보타이·스카프 `#b84742`, 헤일로·링 귀걸이 `#f7cc5b`, 안경·선글라스·콧수염·턱수염 `#31323d`, 왕관 `#e5ad35`, 목걸이 `#9b6c2a`, 별 귀걸이 `#a66a22`입니다.

| 슬롯 | HTML 속성 | React props | 허용 프리셋 |
| --- | --- | --- | --- |
| 머리 `head` | `head-accessory`, `head-color` | `headAccessory`, `headColor` | `beret`, `halo`, `crown`, `none` |
| 눈 `eyes` | `eyes-accessory`, `eyes-color` | `eyesAccessory`, `eyesColor` | `glasses`, `sunglasses`, `none` |
| 입 `mouth` | `mouth-accessory`, `mouth-color` | `mouthAccessory`, `mouthColor` | `moustache`, `goatee`, `none` |
| 목 `neck` | `neck-accessory`, `neck-color` | `neckAccessory`, `neckColor` | `bowTie`, `scarf`, `necklace`, `none` |
| 왼쪽 귀 `leftEar` | `left-ear-accessory`, `left-ear-color` | `leftEarAccessory`, `leftEarColor` | `earring`, `starEarring`, `none` |
| 오른쪽 귀 `rightEar` | `right-ear-accessory`, `right-ear-color` | `rightEarAccessory`, `rightEarColor` | `earring`, `starEarring`, `none` |

`eye-color`는 눈 자체의 색, `eyes-color`는 눈 슬롯의 **안경 색**입니다. 각 `*-color`는 `#RRGGBB`이고 빈 슬롯에도 미리 지정할 수 있습니다. `none`은 명시적으로 장비를 해제합니다. 속성을 제거하면 아래 단계의 `accessories`/`design`에 있는 장비가 다시 나타날 수 있으므로 제거와 `none`을 구분하세요. 사용자 지정 id가 필요하면 `accessories` JSON을 사용합니다.

```html
<sidekick-avatar
  head-accessory="halo"
  eyes-accessory="glasses"
  eyes-color="#334155"
  mouth-accessory="moustache"
  neck-accessory="scarf"
  left-ear-accessory="earring"
  left-ear-color="#f7cc5b"
  right-ear-accessory="earring"
  right-ear-color="#a4b8c9"
></sidekick-avatar>
```

### 런타임·카메라·애니메이션

| HTML 속성 | React prop | 값 / 기본값 |
| --- | --- | --- |
| `activity` | `activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`. 기본 `idle` |
| `paused` | `paused` | boolean. 기본 `false` |
| `interaction` | `interaction` | `none` / `box`. 기본 `none` |
| `mouse-tracking` | `mouseTracking` | boolean. 기본 `false` |
| `camera` | `camera` | `front` / `three-quarter` / `side`. 기본 `front`. React에서는 `{yaw,pitch,roll}` 부분 객체도 가능 |
| `camera-yaw` | `cameraYaw` | -360~360도. 기본 0 |
| `camera-pitch` | `cameraPitch` | -90~90도. 기본 0 |
| `camera-roll` | `cameraRoll` | -180~180도. 기본 0 |
| `gaze-x` | `gazeX` | -1~1. 기본 0 |
| `gaze-y` | `gazeY` | -1~1. 기본 0 |
| `shape-duration` | `shapeDuration` | 도형 속성 전환 시간 0~60000ms. 기본 450 |
| `shape-easing` | `shapeEasing` | `smooth` / `linear`. 기본 `smooth` |
| `motion-duration` | `motionDuration` | 눈·포즈 속성 전환 시간 0~60000ms. 기본 400 |
| `motion-easing` | `motionEasing` | `smooth` / `linear`. 기본 `smooth` |
| `motion` | `motion` | `MotionTarget` JSON. 기본 포즈는 회전·얼굴 이동 0, 눈 뜨기 제한 1 |
| `time` | `time` | 반복 애니메이션 시간 0~86400초. 기본 0 |

### 변경·제거·오류 규칙

- boolean은 `mouse-tracking`, `mouse-tracking=""`, `mouse-tracking="true"`, `mouse-tracking="1"`이 켜짐입니다. `="false"`, `="0"` 또는 속성 제거는 꺼짐입니다. `paused`도 같습니다. React에서는 `{true}` / `{false}`를 사용하세요.
- 지원하는 속성에 잘못된 도형 이름·프리셋·JSON·숫자 범위·색상 형식을 넣으면 오류입니다. 관찰하지 않는 임의 HTML 속성은 브라우저의 일반 속성으로 남으며 라이브러리 설정에 적용되지 않습니다. 색상 축약 `#fff`, CSS 색상명, `NaN`, `Infinity`는 지원하지 않습니다. 값을 생략하려면 빈 문자열 대신 속성을 제거하세요.
- 같은 JavaScript 작업 안에서 바꾼 여러 속성은 다음 마이크로태스크에서 묶어 검증·적용합니다. 잘못된 배치는 이전 유효 런타임 상태를 유지하고 `sidekick-error`를 발생시킵니다. 원래 입력 문자열은 DOM에 남아 있으므로 오류 속성을 고치거나 제거해야 합니다.
- 초기 HTML 속성은 첫 렌더 전에 적용합니다. 연결 후 `shape`·눈 가중치·`motion` 변경은 해당 timing 속성으로 전환합니다. timing만 바꾸면 진행 중인 전환을 다시 시작하지 않습니다.
- 디자인 속성은 `design`을 기본 데이터로 사용하고 개별 속성이 해당 부분만 덮어씁니다. 개별 속성을 제거하면 그 아래의 선언적 데이터 또는 기본값이 드러납니다. `accessories`는 기본 장비 배열을 바꾸고, 슬롯 속성은 그 위에 적용됩니다.
- 눈 우선순위는 `design` → 공통 `expression` → 한쪽 expression → 공통 `smile`/`blink` → 한쪽 가중치입니다. 카메라 프리셋보다 개별 축이 우선합니다. `gaze-x`/`gaze-y` 제거는 해당 축을 0으로, `motion` 제거는 몸체·얼굴·장비 회전·공통 눈 뜨기를 기본값으로, 좌우 눈은 저장 디자인 가중치로 돌립니다.
- 관계없는 속성 변경은 명령형 API로 바꾼 다른 값이나 다른 애니메이션을 재설정하지 않습니다. 디자인 JSON에는 카메라·활동·일시 정지·마우스 추적·전환 시간·런타임 포즈가 저장되지 않습니다.

```js
bot.setAttribute('shape-duration', '600');
bot.setAttribute('shape', 'heart');
bot.setAttribute('left-smile', '0.8');
await Promise.resolve(); // 같은 작업의 속성 적용 이후

bot.setAttribute('mouse-tracking', 'false');
bot.removeAttribute('body-color'); // design의 색 또는 기본 색으로 복원
bot.setAttribute('head-accessory', 'none'); // design에 모자가 있어도 해제
```

## 마우스 추적과 드래그

`mouse-tracking="true"` 또는 `bot.mouseTracking = true`는 페이지의 마우스 위치를 바라보게 합니다. 요소 안에 마우스를 둘 필요가 없으며 터치 입력은 추적하지 않습니다. 끄면 마지막 명시적 시선으로 돌아갑니다. 직접 시선을 계속 제어하려면 추적을 끈 뒤 `lookAt()` 또는 `gaze-x`/`gaze-y`를 사용하세요.

`interaction`은 별도의 설정입니다.

- `none`(기본): 요소 전체가 클릭을 통과시킵니다. 이 상태에서도 마우스 추적은 켤 수 있습니다.
- `box`: 사각형 전체에서 드래그로 카메라를 돌리고 클릭·Enter·Space로 `sidekick-activate`를 보냅니다. 투명 픽셀도 클릭 영역입니다.

`paused`는 반복 모션을 정지하며 진행 중 전환은 목표에서 완료됩니다. `activity="still"`은 반복 활동을 끄지만 명시적 도형·눈·포즈 전환은 사용할 수 있습니다. `prefers-reduced-motion`에서도 새 전환은 즉시 적용합니다.

## 디자인 JSON과 액세서리

현재 저장 형식은 **v7**입니다. 외형은 몸체 `shape`·`color`, 눈 `color`, 액세서리 `id`·`preset`·`slot`·`color`이며 좌우 눈의 `weights`는 표정 애니메이션 상태입니다.

```ts
import {
  createDesign, createAccessory, patchDesign,
  parseDesign, serializeDesign, equipAccessory,
} from '@hanana-kick/sidekick/core';

let design = createDesign({
  body: { shape: 'puffy', color: '#8bba9c' },
  eyes: {
    color: '#24242c',
    left: { weights: { smile: 0.7, blink: 0.2 } },
    right: { weights: { smile: 0, blink: 0 } },
  },
  accessories: [
    createAccessory('beret', 'hat'),
    { ...createAccessory('glasses', 'frames'), color: '#334155' },
    createAccessory('earring', { slot: 'leftEar', id: 'left-earring' }),
    createAccessory('earring', { slot: 'rightEar', id: 'right-earring' }),
  ],
});

design = equipAccessory(design, createAccessory('halo', 'aura')); // 머리만 교체
design = patchDesign(design, { eyes: { left: { weights: { blink: 0.5 } } } });
const json = serializeDesign(design);
await bot.setDesign(parseDesign(json));
```

- `createDesign(patch)`는 기본값을 채웁니다. 기본 눈 가중치는 양쪽 모두 `{ smile: 0, blink: 0 }`, 장비는 `[]`입니다. Studio만 시작할 때 베레모를 추가합니다.
- `patchDesign(current, patch)`는 원본을 바꾸지 않고 눈 가중치를 깊게 병합합니다. `accessories`를 전달하면 배열 전체를 교체합니다. `bot.updateDesign()`도 같은 규칙입니다.
- 슬롯당 하나, 전체 최대 6개입니다. 베레모·헤일로·왕관은 머리, 보타이·스카프·목걸이는 목 슬롯을 공유합니다. 링/별 귀걸이는 반드시 `leftEar` 또는 `rightEar`를 명시합니다.
- id는 영문 소문자로 시작하는 소문자·숫자·하이픈의 고유 문자열, 최대 40자입니다. `createAccessory()`가 기본 id를 만들지만 함께 사용할 때 중복되지 않도록 지정하세요.
- `equipAccessory(design, item)`은 해당 슬롯만 교체합니다. `removeAccessory(design, id)`는 해당 인스턴스만 제거합니다. 요소에는 같은 이름의 비동기 메서드가 있습니다.
- `parseDesign(objectOrJson)`은 버전·알 수 없는 키·숫자·색상·id·슬롯·중복 장착을 엄격히 검증하고 독립된 복사본을 반환합니다. JSON 문자열은 64KiB 이하입니다. 검증 실패는 예외 또는 Promise rejection이며 이전 디자인을 유지합니다.

HTML의 복합 데이터는 유효한 JSON 문자열로 지정합니다.

```html
<sidekick-avatar
  shape="clover4Leaf"
  accessories='[{"id":"frames","preset":"glasses","slot":"eyes","color":"#334155"}]'
  left-smile="0.7"
  right-blink="0.4"
></sidekick-avatar>
```

몸체 크기·깊이·변형·`profiles`, 눈 너비·높이·간격·위치·`targets`, 액세서리 크기·장착 위치·추종값은 공개 외형 파라미터가 아닙니다. v7 JSON에 넣으면 거부합니다. 도형별 비율과 장착 위치는 내부에서 맞추며 런타임 포즈 모션은 별도로 제공합니다.

### 장면 JSON 파일

Studio의 JSON 파일과 코드 예제는 현재 디자인에 런타임 설정을 더한 `sceneVersion: 1` envelope를 사용합니다. `design.version: 7`과는 서로 다른 버전입니다. 파일 이름은 `sidekick.scene.json`이며 디자인만 저장한 이전 파일도 가져올 수 있습니다.

```ts
import { createScene, parseScene, serializeScene, migrateScene } from '@hanana-kick/sidekick/core';

const scene = createScene({
  design,
  camera: { yaw: 35, pitch: 12 },
  mouseTracking: true,
  activity: 'thinking',
  interaction: 'box',
  shapeDuration: 600,
});
const json = serializeScene(scene);
const checked = parseScene(json);
const { scene: imported, warnings, legacyDesign } = migrateScene(oldOrSceneJson);
```

`createScene()`는 `design`, `camera`, `activity`, `paused`, `mouseTracking`, `interaction`, `renderStyle`, `gaze: {x,y}`, `time`, `motion`, `shapeDuration`, `shapeEasing`, `motionDuration`, `motionEasing`을 기본값과 함께 채웁니다. `parseScene()`은 완전한 envelope를 엄격히 검증합니다. 임의 기하값·알 수 없는 키·잘못된 장비 id 모션·지원하지 않는 버전을 거부합니다. `migrateScene()`은 이전 디자인 파일도 받아 기본 런타임 설정을 붙입니다.

장면은 **설정한 목표와 시간 값**을 재현합니다. 재생 중인 정확한 중간 프레임, 자동 깜박임 위상, 실시간 마우스 좌표, 브라우저 배경을 녹화하지 않습니다. 마우스 추적이 켜져 있다면 가져온 페이지의 마우스를 새로 따라갑니다. `motion`은 저장 디자인과 별개인 런타임 목표입니다.

Studio의 ‘JSON 파일 열기’와 텍스트 ‘JSON 적용’은 전체 데이터를 먼저 검증한 뒤 한 번에 적용합니다. 최대 크기는 64KiB(UTF-8)입니다. 실패하면 현재 디자인·카메라·진행 중 애니메이션·로컬 저장을 유지합니다. 여러 파일을 연달아 고르면 마지막 선택만 적용하며 초기화·직접 편집·언마운트는 기다리던 파일 읽기를 취소합니다. 장면 파일은 카메라·추적·활동·일시 정지·시간·포즈 목표도 복원하고, 이전 디자인 파일은 미리보기 설정을 기본값으로 초기화합니다.

### 이전 파일 가져오기

`parseDesign()`은 v1~v6도 검증 후 v7으로 변환합니다. 안내가 필요하면 `migrateDesign(input)`의 `{ design, warnings }`를 사용하세요. 이전 `face` 슬롯은 `eyes`로 바꾸며 id·색상·표정은 보존합니다. 이전 사용자 정의 몸체는 가장 가까운 카탈로그 윤곽으로 근사하며 제거된 기하값은 검증 후 버립니다. 원래 외형을 정확히 복원하는 기능은 아닙니다. 알 수 없는 키, 잘못된 기하값, 중복 슬롯은 조용히 버리지 않고 거부합니다.

v1의 `capsule`/`round` 눈은 중립, `arc`는 웃음으로 옮깁니다. v2/v3의 `expression`·`openness`는 웃음과 감기 가중치로, v4~v6의 가중치는 그대로 옮깁니다. v6 장비 입력은 기존 `beret`·`halo`·`glasses`와 `head`·`face`만 허용합니다. 새 장비와 여섯 슬롯은 v7을 사용하세요.

## 애니메이션과 명령형 API

### 도형과 표정

```ts
const first = bot.setShape('puffy'); // 450ms, smooth
const next = bot.setShape('pixelTriangle', { duration: 650, easing: 'linear' });
console.log(await first); // { finished: false }: 새 목표로 대체
console.log(await next);  // { finished: true }

await bot.setEyeWeights('left', { smile: 0.85 }, { duration: 300 });
await bot.setEyeWeights('right', { blink: 0.4 }, { duration: 180 });
await bot.setExpression('both', 'neutral');
```

35개 도형 사이 전환은 현재 보이는 윤곽에서 다음 목표로 이어집니다. 목표 이름은 즉시 `design.body.shape`에 저장되며 모프 중간 기하를 JSON에 넣지 않습니다. 색상·장비 편집은 진행 중 도형 전환을 유지합니다. `design`/`setDesign()`으로 도형을 바꾸면 즉시 적용합니다. 모션 줄이기·일시 정지·연결되지 않은 요소에서는 전환을 즉시 적용합니다.

눈의 `smile`·`blink`는 각각 0~1이고 합을 1로 정규화하지 않습니다. `left`는 정면 화면 왼쪽인 모델 -X, `right`는 +X입니다. 부분 가중치 변경은 생략한 값과 반대쪽 눈을 유지합니다. 프리셋은 정확히 `neutral → {smile:0,blink:0}`, `smile → {smile:1,blink:0}`, `blink → {smile:0,blink:1}`입니다. `blink`는 감긴 상태를 유지하므로 다시 열려면 `neutral` 또는 새 가중치를 보내세요.

명령형 전환 기본값은 `setShape()` 450ms, `setEyeWeights()`/`motion.to()` 400ms, `setExpression()`은 blink 90ms·neutral 180ms·smile 280ms입니다. 명시한 `options`가 우선하며 `duration`은 0~60000ms, `easing`은 `smooth` 또는 `linear`입니다. HTML의 timing 속성은 선언적 속성 전환용입니다.

### 카메라와 포즈

```ts
bot.setCamera({ yaw: 35, pitch: 12, roll: -5 }); // 도(degree)
bot.setCameraPreset('three-quarter'); // yaw 45°, pitch/roll 0°
bot.resetCamera();                    // 세 축 모두 0°
bot.mouseTracking = false;
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });

// 포즈 회전은 라디안. 아래 예제는 id 'hat' 장비가 있을 때 사용합니다.
await bot.motion.to({
  body: { rotation: [0, 0, 0.2] },
  face: { uv: [0.2, 0.1] },
  eyes: { left: { weights: { smile: 0.5, blink: 0.2 } } },
  accessories: { hat: { rotation: [0, 0.2, 0] } },
}, { duration: 500, easing: 'smooth' });
```

카메라는 모델 원점을 중심으로 하는 직교 보기 회전입니다. `front`는 yaw 0°, `three-quarter`는 45°, `side`는 90°이며 각 프리셋의 pitch·roll은 0°입니다. 양의 yaw는 정면을 화면 오른쪽으로, 양의 pitch는 아래로, 양의 roll은 화면 반시계 방향으로 돌립니다. 카메라 값은 디자인과 포즈를 바꾸지 않습니다.

`MotionTarget`에는 몸체 회전 3축(각 -2π~2π), 얼굴 uv 2축(각 -0.5~0.5), 좌우 눈 가중치, 공통 눈 뜨기 제한 `eyes.openness`(0~1), 장착된 id별 회전 3축(각 -π~π)을 지정합니다. 공통 눈 뜨기는 기존 호환 런타임 제한이며 저장할 별도 표정 상태가 아닙니다. 포즈 모션은 디자인 JSON을 변경하지 않습니다.

몸체·얼굴·좌우 눈·공통 눈 뜨기·각 장비는 독립 시간축입니다. 한 채널을 새로 제어해도 관계없는 채널을 재시작하지 않습니다. 중단된 요청은 `{ finished: false }`, 완료된 요청은 `{ finished: true }`로 끝납니다. 화면 밖이나 비활성 탭에서는 프레임 루프를 멈춥니다.

| 요소 API | 용도 |
| --- | --- |
| `design`, `setDesign(designOrJson)` | 디자인 읽기/전체 교체. `design` getter는 복사본 |
| `updateDesign(patch)` | 외형·눈 가중치 부분 변경 |
| `equipAccessory(item)`, `removeAccessory(id)` | 슬롯 교체/인스턴스 제거 |
| `setShape(name, options)` | 도형 목표 저장 및 전환 |
| `setEyeWeights(side, weights, options)` | 좌우/양쪽 부분 가중치 저장 및 전환 |
| `setExpression(side, preset, options)` | 표정 프리셋 저장 및 전환 |
| `setActivity(name)`, `activity` | 활동 설정, 현재 활동 읽기 |
| `mouseTracking`, `paused`, `interaction`, `renderStyle` | 해당 동작 읽기/설정 |
| `lookAt({space:'view',x,y})` | -1~1 범위의 명시적 시선 |
| `camera`, `setCamera(patch)` | 도 단위 카메라 읽기/설정. getter는 복사본 |
| `setCameraPreset(name)`, `resetCamera()` | 프리셋/정면 초기화 |
| `setView(yaw,pitch)` | 이전 라디안 API. roll은 유지 |
| `motion.to(target,options)`, `motion.cancel()` | 포즈 전환/모든 포즈 채널 취소 |
| `seek(seconds)` | 반복 애니메이션 시간 0~86400초 지정 |
| `pose` | 현재 포즈 복사본, 읽기 전용 |
| `snapshot({crop,padding}?)` | 렌더 준비 후 투명 PNG `Promise<Blob>`. 기본은 알파 경계로 자르기 |
| `capturePixels()` | 렌더 준비 후 `{width,height,pixels}`. 아래 행부터 RGBA |
| `ready`, `diagnostics` | 준비 여부, RAF 상태, 프레임 수, draw call·버퍼 수 |

## 이벤트와 정리

이벤트는 `CustomEvent`이며 Shadow DOM 경계를 넘어 버블링합니다. React 래퍼도 같은 이벤트 객체를 콜백으로 전달합니다.

| DOM 이벤트 | React 콜백 | `detail` |
| --- | --- | --- |
| `sidekick-ready` | `onReady` | `{}` |
| `sidekick-error` | `onError` | `{ message, ... }`; 복구 가능한 컨텍스트 손실에는 `recoverable: true` |
| `sidekick-design-change` | `onDesignChange` | `{ design }` |
| `sidekick-camera-change` | `onCameraChange` | `{ camera }` |
| `sidekick-motion-end` | `onMotionEnd` | `{ finished }` |
| `sidekick-shape-end` | `onShapeEnd` | `{ finished }` |
| `sidekick-activate` | `onActivate` | `{}` |

PNG의 기본 `crop: true`, `padding: 0`은 현재 캐릭터의 불투명/반투명 픽셀 전체 경계로 자릅니다. 장비도 포함하고 배경은 투명하게 유지합니다. `padding`은 0~4096의 정수 픽셀이며, 원래 캔버스 크기가 필요하면 `snapshot({ crop: false })`를 사용하세요. 완전히 비어 있으면 투명 1×1px(여백 별도)을 반환합니다. `capturePixels()`는 기존 전체 캔버스 크기를 유지하며 `/core`의 `alphaBounds()`·`cropPixels()`도 사용할 수 있습니다.

초기 `ready`/오류까지 받으려면 요소를 문서에 추가하기 전에 리스너를 붙이거나 React 콜백을 사용하세요. 이미 연결된 요소는 `ready`를 먼저 확인합니다. `setDesign()` 등의 Promise 오류도 `try/catch`로 처리하세요.

```js
const bot = document.createElement('sidekick-avatar');
const events = new AbortController();
bot.addEventListener('sidekick-error', event => {
  console.error(event.detail.message);
}, { signal: events.signal });
document.body.append(bot);

// 화면/페이지 정리 시:
events.abort(); // 애플리케이션이 붙인 리스너 제거
bot.remove();   // RAF, 관찰자, 마우스 리스너, WebGL 자원 해제
```

React는 언마운트 시 래퍼 리스너와 요소를 정리합니다. 직접 만든 PNG 다운로드 Object URL은 사용 후 `URL.revokeObjectURL()`로 해제하세요. 요소를 다시 연결하면 저장된 디자인으로 렌더러를 만들며, 진행 중이던 전환은 취소됩니다. WebGL 컨텍스트 손실에는 오류를 보내고 복구되면 렌더러를 다시 초기화합니다.

## SSR과 브라우저 지원

서버에서는 `/core`로 디자인을 만들고 직렬화하세요. 모듈 import 자체는 DOM 전역 없이 가능하지만 실제 Custom Element 등록·생성·WebGL 렌더링은 브라우저에서 해야 합니다. React 래퍼는 SSR에서 일반 HTML/aria/style만 있는 빈 호스트를 만들고, 클라이언트에서 props를 적용하고 등록합니다. SSR에서 props가 적용된 캐릭터 픽셀이나 디자인 속성이 완성되어 있다고 가정하지 마세요. `ref`는 업그레이드 후 준비되며 `onReady`는 props 적용 후 전달됩니다. React 래퍼를 사용하는 Next.js 컴포넌트에는 `'use client'` 경계를 두세요. 서버에서 PNG를 만드는 API는 제공하지 않습니다.

서버 HTML의 기본 태그는 브라우저 등록 후 업그레이드됩니다. 같은 DOM 인스턴스를 유지하고 고정된 CSS 크기를 주면 로딩 중 레이아웃 이동을 줄일 수 있습니다. 직접 HTML을 SSR할 때 초기 속성은 문자열/JSON이며 DOM 프로퍼티 할당과 다릅니다. [React의 Custom HTML Elements 안내](https://react.dev/reference/react-dom/components#custom-html-elements)를 참고하세요.

WebGL2와 Custom Elements를 지원하는 현대 브라우저가 필요합니다. 그래픽 초기화 실패 시 요소 안에 읽을 수 있는 fallback을 표시하고 `sidekick-error`를 보냅니다. 기본 요소는 이미지 역할이며 `interaction="box"`에서는 키보드로 활성화할 수 있는 버튼 역할입니다. 용도를 설명하는 `aria-label`을 지정하세요. 화면 밖·비활성 탭 중단, reduced-motion, 크기 변경, 제거 시 GPU 자원 해제를 처리합니다.

## Studio와 개발

Studio는 **React 19 + Vite 8 + Tailwind CSS 4 + 실제 shadcn/ui Radix/Nova 컴포넌트**, Slate 색상 토큰으로 구현한 별도 편집기입니다. 코어를 사용하는 웹사이트에는 이 UI 의존성이 들어가지 않습니다.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173

npm run build:library   # npm/Git 배포용 dist/library 생성
npm run check:library   # 소스와 체크인된 산출물 일치 검사
npm run build:studio    # Vite 편집기 빌드
npm run build:all       # 라이브러리 + dist/src + 편집기 + 고지
npm start              # 빌드한 편집기 제공
npm run pack:library   # 라이브러리 재빌드 후 tarball 생성
```

외부 접근이 필요할 때만 `HOST=0.0.0.0`을 사용하세요. 포트는 `PORT`로 바꿉니다. 정적 Studio 배포는 `dist/` 전체를 사용합니다. 루트 `dist/index.html`과 호환 경로 `dist/playground/index.html`, 해시된 `dist/assets/`를 생성합니다. npm 패키지는 Studio 출력 대신 `dist/library/`를 포함합니다.

### Studio에서 할 수 있는 일

- 외형: 검색·키보드 탐색이 되는 35개 실루엣 타일, 몸체·눈 색, 실제 렌더링 썸네일의 12종 장비와 슬롯별 색
- 애니메이션: 활동·일시 정지, 마우스 추적 on/off, 명시적 시선, 도형 전환 시간·easing, 좌우 웃음·감기 가중치
- 카메라: yaw·pitch·roll, 정면·사선·측면 프리셋, 미리보기 드래그와 양방향 동기화
- JSON: 파일/텍스트 가져오기·내보내기, 현재 설정이 반영되는 HTML/React 코드와 복사 버튼, 알파 경계에 맞춘 투명 PNG 저장

데스크톱은 미리보기와 설정을 나란히 배치합니다. 모바일 세로 화면은 미리보기를 고정하고 아래 설정만 스크롤하며 짧은 가로 화면은 나란히 배치합니다. `100dvh`와 safe-area를 사용합니다. 탭·슬라이더·토글은 shadcn/Radix의 키보드 동작을 유지합니다. 글꼴은 로컬 번들에 포함합니다. 미리보기의 체크무늬·밝은색·어두운색은 DOM 배경이며 PNG에 포함하지 않습니다.

자동 저장은 디자인만 이 브라우저의 `sidekick.design.v7`에 저장합니다. 파일 내보내기는 별도로 장면 envelope를 사용하여 카메라·추적·전환 설정까지 포함합니다. 저장된 v7이 없으면 v6→v1 순서로 읽고 변환하되 이전 키의 원본을 보존합니다. 잘못된 원본은 JSON 탭에 열고, 첫 편집 시 `.recovery` 백업이 성공해야 새 파일을 저장합니다. 저장소가 막혔다면 JSON 내보내기를 사용하세요. 초기화하면 기본 square+베레모, 정면 카메라, 마우스 추적 꺼짐으로 돌아갑니다.

UI 구성은 `components.json`과 `playground/components/ui/`, 저장·명령·복구는 `studio-controller.ts`에 있습니다. React 재렌더와 탭 전환은 하나의 안정된 요소를 유지하며 진행 중 모프나 카메라를 재설정하지 않습니다. [공식 shadcn/ui Vite 설치](https://ui.shadcn.com/docs/installation/vite) 방식으로 생성한 실제 소스를 사용합니다.

### GitHub Pages 배포 준비

`.github/workflows/pages.yml`은 수동 실행용 배포 준비입니다. 비공개 저장소의 Studio를 Pages로 배포하면 설정에 따라 웹사이트가 공개될 수 있으므로 **공개 범위와 배포 승인을 확인한 뒤에만** 진행하세요. 저장소 소유자가 Settings → Pages에서 GitHub Actions 소스를 설정하고, 사용 가능한 Pages 요금제·권한·환경 보호 설정을 확인해야 합니다. 워크플로 파일을 추가하는 것만으로 Pages가 켜지거나 배포되지는 않습니다.

프로젝트 경로용 빌드는 `SIDEKICK_BASE=/sidekick/ npm run build:all`입니다. 실제 배포 경로가 다르면 base도 맞추세요. 별도 승인 전에는 워크플로 실행, Pages 활성화, 공개 URL 배포를 하지 않습니다.

### 검사

```sh
npm run typecheck
npm test
npm run test:studio
npm run check:library
npm run test:package

# 허용된 Chromium 환경에서만 실행:
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
# Linux 소프트웨어 GPU / headed 환경:
SIDEKICK_HEADED=1 xvfb-run -a npm run test:browser
```

단위 검사는 최소 디자인·엄격한 마이그레이션·속성 검증·모프·모션·기하·서버 import를 다룹니다. Studio 검사는 ReactDOM+jsdom에서 실제 Radix 상호작용과 목업 렌더러 경계를 검사하며, 레이아웃·WebGL 검증을 대신하지 않습니다. 패키지 검사는 설치 산출물·공개 진입점·React 계약을 확인합니다.

브라우저 검사는 실제 HTTP origin의 WebGL·투명도·애니메이션·장비·모바일 레이아웃·생명주기·fallback을 대상으로 합니다. `CHROMIUM_PATH`로 실행 파일 경로, `SIDEKICK_SCREENSHOTS=artifacts`로 스크린샷 위치를 지정할 수 있습니다. 네트워크가 차단된 QA의 `SIDEKICK_OFFLINE_BROWSER=1`은 `http://sidekick.test` 요청을 실제 빌드 파일로 응답하며 로컬 저장소/재로드도 검사합니다. Safari/Firefox·실제 모바일 GPU 검증은 별도입니다. 테스트 명령이 있다는 사실이 해당 환경에서 검사를 통과했다는 뜻은 아닙니다.

## 도형·렌더링 범위와 라이선스

`MATERIAL_SHAPE_NAMES`, `MATERIAL_SHAPE_LABELS`, `MaterialShapeName`을 사용해 선택 UI를 만들 수 있습니다.

- 기하학: `circle`, `square`, `slanted`, `arch`, `fan`, `arrow`, `semiCircle`, `oval`, `pill`, `triangle`, `diamond`, `clamShell`, `pentagon`, `gem`
- 별·햇살·쿠키: `verySunny`, `sunny`, `cookie4Sided`, `cookie6Sided`, `cookie7Sided`, `cookie9Sided`, `cookie12Sided`, `burst`, `softBurst`, `boom`, `softBoom`
- 유기형·기타: `ghostish`, `clover4Leaf`, `clover8Leaf`, `flower`, `puffy`, `puffyDiamond`, `pixelCircle`, `pixelTriangle`, `bun`, `heart`

`star`는 API 이름이 아닙니다. 공식 곡선 데이터의 종횡비·오목한 부분·코너·스무딩·회전·반복을 보존합니다. 몸체는 카탈로그 XY 윤곽을 유지하면서 앞뒤로 둥글게 이어지는 입체입니다. Flat은 무조명 단색 표현을 뜻하며 평평한 기하를 뜻하지 않습니다. 실제 카메라 회전·깊이 가림과 투명 알파 채널을 사용합니다.

눈은 별도 돌출 메시가 아니라 몸체 곡면 셰이더의 캡슐/곡선 색상 마스크입니다. 기울임에 따라 투영되며 몸체 밖·뒷면·가려진 부분에 그리지 않습니다. 정확한 측면에도 둥근 앞면의 가까운 눈 일부가 보일 수 있습니다. 눈 비율·간격·위치는 내부 기본값이고 도형과 함께 보간합니다. 표정은 몸체 실루엣·알파 커버리지를 바꾸지 않습니다. 얼굴 이동과 시선은 독립적이며 안경 같은 얼굴 장비는 얼굴 이동만 따라갑니다.

액세서리는 도형에 맞춰 장착한 강체입니다. 안경 테두리를 정점마다 휘지 않으며 베레모도 천 물리 시뮬레이션이 아닙니다. 몸체 메시와 표면 질의는 같은 볼륨 함수 `h = sqrt(d / (d + 0.65 × r²))`, 앞뒤 높이 `±depth × h / 2`를 사용합니다. XY 윤곽에서 높이는 0이고 중심에서는 전체 깊이가 `depth`입니다. 이는 Sidekick의 볼륨 모델이며 AndroidX의 3D 모델 재현이 아닙니다.

곡선→폴리라인 허용오차는 정규화 `[-1,1]` 기준 `0.00005`입니다. 메시 세분화 목표(표면 거리 `0.010`, 중앙 높이 `0.006`)는 샘플 기준이며 모든 위치·픽셀의 오차 보장이 아닙니다. 최대 8회 분할·앞면 12,000점 예산을 사용하므로 작은 삼각형 근사 오차가 보일 수 있습니다. 도형 모프의 대응점 계산은 Sidekick 방식이며 Android Material `Morph`와 픽셀 일치를 보장하지 않습니다.

요소마다 WebGL 컨텍스트 하나와 재사용 버퍼를 사용합니다. 기본 몸체+베레모는 3 draw call이고 눈은 추가 draw call이 없습니다. DPR은 최대 2, 캔버스는 축당 최대 2048px입니다. CPU 기하 벤치마크는 GPU 프레임 시간/FPS 보장이 아닙니다. 임의 SVG·사용자 정의 메시·파츠 플러그인·옷감 물리·픽셀 히트 테스트·컨텍스트 풀·AI 서비스 연결은 지원 범위 밖입니다.

이 저장소의 패키지 라이선스는 `UNLICENSED`입니다. 공개 오픈소스 라이선스를 부여한다는 뜻이 아니며 사용·배포 권한은 저장소 소유자에게 확인하세요. 다음 제3자 고지는 따로 유지합니다.

- Material 윤곽: 고정된 [AndroidX MaterialShapes 소스](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt), `graphics-shapes-android:1.1.0`으로 계산. Apache 2.0 고지/출처는 [`third_party/material-shapes/`](third_party/material-shapes/). 재생성은 `scripts/generate-material-shapes.mjs`이며 이 작업에만 Java 21+·unzip·네트워크가 필요합니다.
- Studio shadcn/ui 소스: [`playground/components/ui/LICENSE.md`](playground/components/ui/LICENSE.md). 정적 Studio 빌드에도 해당 고지를 포함합니다.
