# Sidekick

**35개 Material 도형으로 만드는 투명 Flat 캐릭터 라이브러리.** 기본 `<sidekick-avatar>` 하나로 시작하고 HTML 속성, JavaScript API, React 래퍼 중 편한 방식으로 제어할 수 있습니다. 도형 전환, 좌우 표정, 마우스 시선 추적, 카메라 회전, 여섯 슬롯의 액세서리를 지원합니다. 코어는 프레임워크 의존성이 없는 TypeScript + Web Component + WebGL2입니다.

- [설치](#설치) · [HTML](#html에서-바로-사용하기) · [React](#react에서-사용하기)
- [전체 속성](#html-속성과-react-props) · [디자인과 액세서리](#디자인-json과-액세서리) · [애니메이션/API](#애니메이션과-명령형-api)
- [이벤트/정리](#이벤트와-정리) · [SSR](#ssr과-브라우저-지원) · [Studio/개발](#studio와-개발)

## 설치

**공개 GitHub 저장소에서 빌드된 패키지를 바로 설치하세요.** 사용할 프로젝트에서 다음 명령을 실행합니다.

```sh
npm install https://github.com/hanana-kick/sidekick.git
```

배포 버전을 고정하려면 버전 태그를 지정합니다.

```sh
npm install https://github.com/hanana-kick/sidekick.git#v0.2.0
```

빌드된 ESM·타입 선언·브라우저 번들이 저장소에 포함되어 있어 **설치하는 쪽에서 Sidekick 소스를 빌드할 필요가 없습니다.** 의존성 및 lockfile을 함께 커밋하면 팀도 같은 버전을 사용합니다. 패키지 이름은 `@hanana-kick/sidekick`, 이 소스의 버전은 `0.2.0`입니다. **npm 레지스트리에는 발행하지 않았으므로 이름만으로 `npm install @hanana-kick/sidekick`을 실행하지 마세요.**

npm을 쓰지 않는 HTML 사이트에서는 [GitHub Releases](https://github.com/hanana-kick/sidekick/releases)의 빌드된 파일을 내려받으세요. 단일 ESM과 일반 `<script>`용 JS를 제공하며, 이 브라우저 코어에는 React·번들러·Node.js·별도 CSS·글꼴이 필요 없습니다.

### GitHub Release에서 다운로드

1. [Releases](https://github.com/hanana-kick/sidekick/releases)를 엽니다.
2. 사용할 태그의 **Assets**에서 `sidekick-browser-0.2.0.zip` 또는 `hanana-kick-sidekick-0.2.0.tgz`를 받습니다. 다른 버전은 태그와 일치하는 파일명을 선택하세요. 자동 생성된 **Source code (zip/tar.gz)**는 소스 아카이브이므로 브라우저 배포 ZIP과 구분하세요.
3. 일반 HTML 사이트에서는 브라우저 ZIP을 풀고 아래 파일을 사이트의 정적 파일 디렉터리에 복사합니다. 동봉된 `START-HERE.txt`를 읽고 `esm.html`, `classic.html`, `react.html` 중 원하는 예제를 열면 됩니다. 예제의 `/vendor/sidekick/`은 **사용자 사이트의 경로**입니다. 배포 경로에 맞게 바꾸세요.

| 빌드된 파일 | 용도 | 필요한 파일·의존성 |
| --- | --- | --- |
| `sidekick-browser-0.2.0.zip` | 일반 HTML/React 브라우저 배포 | `esm.html`·`classic.html`·`react.html`, 아래 JS 4개, 선택적 `vendor/`, README·고지 포함 |
| `sidekick.js` | 브라우저 ESM. `import`와 `<script type="module">` 사용 | 이 JS 파일 하나. 런타임 외부 import 없음 |
| `sidekick.iife.js` | 일반 classic `<script>`. API는 `window.Sidekick` | 이 JS 파일 하나. `type="module"` 사용 안 함 |
| `sidekick-react.js` | React 19용 ESM 컴포넌트 | `sidekick-element.js`를 같은 디렉터리에 유지하고 `react` peer를 제공 |
| `sidekick-element.js` | React 래퍼가 지연 로딩하는 렌더러 | 직접 import하지 않음. `sidekick-react.js`와 같은 버전 사용 |
| `vendor/react.js`, `vendor/react-dom-client.js` | 브라우저 ZIP의 선택적 React 19/ReactDOM ESM | 아래 빌드 없는 React 예제용. import map으로 연결하며 React를 이미 제공하는 앱에는 불필요 |
| `hanana-kick-sidekick-0.2.0.tgz` | 기존 npm 기반 프로젝트에 설치하는 패키지 | 빌드된 ESM·타입 선언·브라우저 번들·고지 포함 |
| `SHA256SUMS` | ZIP과 tarball의 다운로드 무결성 확인 | 같은 Release의 체크섬 파일 |

ZIP에 함께 들어 있는 README와 제3자 라이선스/출처 고지도 보관하세요. **GitHub Release 자산은 다운로드한 뒤 본인 사이트에서 제공하세요.** 다운로드 URL은 브라우저 JS 호스팅용 URL이 아니며 자산 응답의 MIME·CORS 동작이 정적 호스팅과 다릅니다. 아래 예제의 `src`/`import`는 내려받은 파일을 제공하는 사이트 경로를 사용합니다.

`sidekick.js`와 `sidekick.iife.js`는 각각 전체 공개 코어/요소 API를 내보내며 기본 `<sidekick-avatar>`를 자동 등록합니다. **둘 중 하나만 선택하세요.** Classic JS는 브라우저 전역 스크립트를 뜻하며 Node.js CommonJS `require()` 빌드는 아닙니다. React 래퍼는 React를 번들 안에 포함하지 않습니다. `sidekick.js`의 `SidekickAvatar`는 커스텀 요소 클래스이고, `sidekick-react.js`의 같은 이름은 React 컴포넌트입니다.

### 선택 사항: 빌드된 tarball 설치

Release에서 받은 tarball을 사용할 프로젝트에서 설치합니다. 이 명령은 Sidekick 소스를 컴파일하거나 Studio를 빌드하지 않습니다.

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.2.0.tgz
```

React 래퍼를 사용할 때만 React 19가 필요합니다. 웹페이지를 마운트하는 `react-dom`도 사용자가 같은 버전으로 준비합니다. 코어만 쓰는 프로젝트에는 React가 필요 없습니다.

### 패키지 진입점

| import 경로 | 용도 |
| --- | --- |
| `@hanana-kick/sidekick` | 브라우저에서 기본 태그를 자동 등록하고 공개 API를 export |
| `@hanana-kick/sidekick/auto` | 자동 등록을 명시하는 진입점 |
| `@hanana-kick/sidekick/register` | 자동 등록 없이 `defineSidekick`, 요소 클래스와 공개 API를 import |
| `@hanana-kick/sidekick/core` | DOM 없이 디자인·장면 생성/검증, 모션·카메라·픽셀 유틸리티 사용 |
| `@hanana-kick/sidekick/react` | React 컴포넌트 `SidekickAvatar`, props/ref 타입 |

패키지 모듈은 ESM이며 실행용 모듈/타입은 `dist/library/`, 즉시 사용 가능한 브라우저 번들은 `dist/browser/`입니다. `dist/src/`는 내부 테스트용입니다. bare import 이름은 브라우저가 직접 해석하지 못하므로 패키지 import에는 번들러 또는 import map을 사용하세요. 아래 HTML 예제는 실제 파일 URL을 사용하여 이 설정이 필요 없습니다.

## HTML에서 바로 사용하기

### 가장 작은 ESM 사용 예

다운로드한 `sidekick.js`를 사이트의 `/vendor/sidekick/sidekick.js`에 놓으면 다음 두 줄로 시작할 수 있습니다.

```html
<script type="module" src="/vendor/sidekick/sidekick.js"></script>
<sidekick-avatar></sidekick-avatar>
```

등록이 끝나면 200 × 200px의 투명 캐릭터가 표시됩니다. 기본값은 노란 `square`, 어두운 눈, 액세서리 없음, `idle` 상태입니다. 크기는 일반 CSS로 정합니다. 외형은 카탈로그/장비 선택과 색상으로 설정하며 각 파츠의 기하 크기·깊이·위치는 공개하지 않습니다.

### 완전한 HTML 예제: ESM import

아래 내용을 `index.html`로 저장하고, 내려받은 파일과 함께 HTTP(S)로 제공하세요. 이 예제는 소스 빌드·npm 설치·import map 없이 실행됩니다. 초기 오류/준비 이벤트를 받기 위해 리스너를 먼저 붙인 뒤 `import()`합니다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick ESM</title>
  <style>sidekick-avatar { width: 200px; height: 200px; }</style>
</head>
<body>
  <sidekick-avatar id="bot" shape="verySunny" body-color="#e9b64d"
    eye-color="#24242c" head-accessory="beret" head-color="#b84742"
    mouse-tracking interaction="box" shape-duration="450"
    aria-label="작업 도우미"></sidekick-avatar>
  <button id="change" disabled>도형 바꾸기</button>
  <p id="status" role="status">불러오는 중</p>
  <script type="module">
    const bot = document.querySelector('#bot');
    const button = document.querySelector('#change');
    const status = document.querySelector('#status');
    bot.addEventListener('sidekick-ready', () => { status.textContent = '준비 완료'; });
    bot.addEventListener('sidekick-error', event => { status.textContent = event.detail.message; });
    try {
      const { createAccessory } = await import('/vendor/sidekick/sidekick.js');
      // 기본 태그는 이미 자동 등록됨. defineSidekick() 호출 불필요.
      await bot.equipAccessory(createAccessory('glasses', 'frames'));
      button.disabled = false;
      button.addEventListener('click', async () => {
        try {
          const shape = bot.design.body.shape === 'heart' ? 'verySunny' : 'heart';
          await bot.setShape(shape, { duration: 450, easing: 'smooth' });
        } catch (error) { status.textContent = error.message; }
      });
    } catch (error) { status.textContent = error.message; }
  </script>
</body>
</html>
```

정적 ESM import도 같습니다. `sidekick.js` 하나에서 공개 함수를 가져올 수 있습니다.

```js
import { createDesign, createAccessory, defineSidekick } from '/vendor/sidekick/sidekick.js';
```

### 완전한 HTML 예제: 일반 JS script

`sidekick.iife.js`를 복사하고 `type="module"` 없이 불러옵니다. 등록은 자동이며 같은 공개 API가 `Sidekick` 전역에 있습니다. 외부 스크립트를 먼저 실행하고 그 아래에서 API를 사용하세요. 이 순서의 예제에 `async`/`defer`를 임의로 추가하지 마세요.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick classic JS</title>
  <style>sidekick-avatar { width: 200px; height: 200px; }</style>
</head>
<body>
  <sidekick-avatar id="bot" shape="heart" body-color="#8bba9c"
    mouse-tracking="true" interaction="box" aria-label="작업 도우미"></sidekick-avatar>
  <button id="change">도형 바꾸기</button>
  <p id="status" role="status">불러오는 중</p>
  <script>
    const bot = document.querySelector('#bot');
    const status = document.querySelector('#status');
    bot.addEventListener('sidekick-ready', () => { status.textContent = '준비 완료'; });
    bot.addEventListener('sidekick-error', event => { status.textContent = event.detail.message; });
  </script>
  <script src="/vendor/sidekick/sidekick.iife.js"></script>
  <script>
    if (window.Sidekick) {
      bot.equipAccessory(Sidekick.createAccessory('halo', 'aura'))
        .catch(error => { status.textContent = error.message; });
      document.querySelector('#change').addEventListener('click', async () => {
        try {
          const shape = bot.design.body.shape === 'heart' ? 'puffy' : 'heart';
          await bot.setShape(shape, { duration: 600 });
        } catch (error) { status.textContent = error.message; }
      });
    } else { status.textContent = 'Sidekick JS 파일을 불러오지 못했습니다.'; }
  </script>
</body>
</html>
```

`file://`로 더블클릭해서 열지 말고 HTTP(S) 서버에서 제공하세요. `.js` 응답은 JavaScript MIME 형식이어야 하며, 없는 파일 대신 사이트의 `index.html`을 반환하는 SPA fallback을 피하세요. 다른 origin에서 JS를 제공한다면 모듈용 CORS도 설정해야 합니다. 위 예제는 같은 origin을 사용합니다. 코어 두 번들에는 추가 JS·이미지·폰트 다운로드가 없습니다.

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

`defineSidekick('my-companion')`로 다른 태그 이름도 등록할 수 있습니다. React 래퍼는 기본 `sidekick-avatar`를 사용합니다. `whenDefined()`는 클래스 등록 완료를 뜻하며 GPU 렌더 준비를 뜻하지 않습니다. `ready`는 Promise가 아니라 읽기 전용 boolean입니다. PNG가 필요하면 `bot.ready === true`인지 확인하거나 `sidekick-ready`를 기다리세요.

## React에서 사용하기

### 기존 React 19 프로젝트

위 GitHub URL 또는 Release의 `.tgz`로 패키지를 설치한 뒤 다음 컴포넌트를 앱에서 렌더링하세요. JSX/TSX는 기존 앱의 도구로 처리하며 Sidekick 자체를 다시 빌드할 필요는 없습니다.

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

### 빌드 없는 React HTML 예제

브라우저 ZIP의 `sidekick-react.js`, `sidekick-element.js`, `vendor/`를 그대로 유지하세요. 동봉된 `react.html`을 열거나 **같은 디렉터리에** 아래 내용의 HTML을 저장할 수 있습니다. HTTP(S)로 열면 React에서도 설치·JSX 변환·소스 빌드 없이 실행됩니다. 예를 들어 이 파일들을 `/vendor/sidekick/`에 복사했다면 `/vendor/sidekick/react.html`을 엽니다.

이 예제는 ZIP에 포함된 **React/ReactDOM 19.3.1의 production ESM**을 사용합니다. React peer와 페이지 마운트용 ReactDOM은 코어와 별개이며, 두 vendor 파일과 동봉된 React·ReactDOM·scheduler 라이선스를 함께 유지하세요. 기존 React 앱에 별도 React 복사본을 추가하지 말고 앱의 peer를 사용하세요. 외부 CDN이나 GitHub 다운로드 URL에 런타임 요청을 보내지 않습니다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick React</title>
  <script type="importmap">
    {
      "imports": {
        "react": "./vendor/react.js",
        "react-dom/client": "./vendor/react-dom-client.js"
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createElement as h, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SidekickAvatar } from './sidekick-react.js';

    function App() {
      const bot = useRef(null);
      const [shape, setShape] = useState('square');
      const [tracking, setTracking] = useState(true);
      const [ready, setReady] = useState(false);
      const [error, setError] = useState('');
      return h('main', null,
        h(SidekickAvatar, {
          ref: bot, shape, bodyColor: '#8bba9c', headAccessory: 'beret',
          mouseTracking: tracking, interaction: 'box', shapeDuration: 450,
          style: { width: 200, height: 200 }, 'aria-label': '작업 도우미',
          onReady: () => setReady(true),
          onError: event => setError(event.detail.message),
        }),
        h('button', { onClick: () => setShape(value => value === 'square' ? 'heart' : 'square') }, '도형 바꾸기'),
        h('button', { onClick: () => setTracking(value => !value) }, '마우스 추적 전환'),
        h('button', {
          disabled: !ready,
          onClick: async () => {
            try { await bot.current?.setExpression('left', 'smile'); }
            catch (error) { setError(error.message); }
          },
        }, '왼쪽 눈 웃기'),
        h('p', { role: 'status' }, error || (ready ? '준비 완료' : '불러오는 중')),
      );
    }
    createRoot(document.querySelector('#root')).render(h(App));
  </script>
</body>
</html>
```

`sidekick-react.js`의 `react` import는 import map 또는 앱 번들러가 해석해야 합니다. 렌더러 파일은 래퍼를 기준으로 상대 경로로 로딩하므로 `sidekick-element.js`를 옮기거나 이름을 바꾸지 마세요. React 예제에는 `sidekick.js`/`sidekick.iife.js`를 추가로 로딩할 필요가 없습니다.

## HTML 속성과 React props

아래 표는 **지원하는 모든 HTML 설정 속성과 React 전용 props**입니다. camelCase는 React props 이름이며 모든 이름이 요소의 JavaScript 프로퍼티라는 뜻은 아닙니다. 일반 HTML에서는 `setAttribute()`/`removeAttribute()`를, 복합 제어는 명령형 API를 사용하세요. 읽기 전용 상태·이벤트·PNG 출력은 API로 받습니다.

- 모든 설정 prop은 선택 사항입니다. 표의 기본값은 `design`이나 다른 상위 입력이 없는 새 요소 기준입니다. **생략은 덮어쓰지 않는다는 뜻**입니다. 예를 들어 `design`의 몸체가 `heart`라면 `shape`를 생략해도 `square`로 바뀌지 않습니다.
- HTML 값은 문자열입니다. 숫자는 `shape-duration="450"`, JSON은 `motion='{"body":{"rotation":[0,0,0.2]}}'`처럼 씁니다. React 숫자는 `{450}`, boolean은 `{true}`/`{false}`, 복합 값은 실제 객체/배열을 사용합니다.
- React 설정 prop의 해제 값은 **`undefined` 또는 prop 생략**입니다. 이전에 래퍼가 설정한 속성은 제거됩니다. `null`은 설정 prop의 지원 값이 아닙니다. `ref={null}`은 React 표준에 따라 참조를 해제할 때 사용할 수 있습니다.
- `MaterialShapeName`의 허용 값 35개는 [전체 도형 목록](#도형렌더링-범위와-라이선스), `AvatarDesign`/`AccessoryDesign`의 필드는 [디자인 JSON](#디자인-json과-액세서리), `MotionTarget`의 모든 필드는 아래 표를 참고하세요. 문자열 enum은 대소문자를 구분합니다.

### 기본·몸체·눈

| HTML 속성 | React prop | React 타입 | 허용 값 / 기본값 |
| --- | --- | --- | --- |
| `design` | `design` | `AvatarDesign` | HTML은 완전한 디자인 JSON 문자열. 기본 `createDesign()`의 v7 디자인 |
| `shape` | `shape` | `MaterialShapeName` | 35개 카탈로그 이름. 상위 디자인의 도형, 없으면 `square` |
| `body-color` | `bodyColor` | `string` | `#RRGGBB`. 상위 디자인 색, 없으면 `#e9b64d` |
| `eye-color` | `eyeColor` | `string` | `#RRGGBB`. 상위 디자인 색, 없으면 `#24242c` |
| `expression` | `expression` | `EyeExpression` | `neutral` / `smile` / `blink`. 생략 시 디자인의 양쪽 가중치 유지, 초기 `neutral` |
| `left-expression` | `leftExpression` | `EyeExpression` | 왼쪽 `neutral` / `smile` / `blink`. 생략 시 공통 expression/디자인 사용 |
| `right-expression` | `rightExpression` | `EyeExpression` | 오른쪽 `neutral` / `smile` / `blink`. 생략 시 공통 expression/디자인 사용 |
| `smile` | `smile` | `number` | 양쪽 웃음 가중치 0~1. 생략 시 expression/디자인 사용, 초기 0 |
| `blink` | `blink` | `number` | 양쪽 감기 가중치 0~1. 생략 시 expression/디자인 사용, 초기 0 |
| `left-smile` | `leftSmile` | `number` | 왼쪽 웃음 0~1. 생략 시 공통 smile/expression/디자인 사용, 초기 0 |
| `right-smile` | `rightSmile` | `number` | 오른쪽 웃음 0~1. 생략 시 공통 smile/expression/디자인 사용, 초기 0 |
| `left-blink` | `leftBlink` | `number` | 왼쪽 감기 0~1. 생략 시 공통 blink/expression/디자인 사용, 초기 0 |
| `right-blink` | `rightBlink` | `number` | 오른쪽 감기 0~1. 생략 시 공통 blink/expression/디자인 사용, 초기 0 |
| `accessories` | `accessories` | `readonly AccessoryDesign[]` | HTML은 배열 JSON. 생략 시 디자인 장비, 초기 `[]`. 지정 시 배열 전체 교체 |
| `render-style` | `renderStyle` | `RenderStyle` (`'flat'`) | `flat`만 공개 지원, 기본 `flat`. HTML의 이전 `3d` 입력은 `flat`으로 정규화 |

### 장비 슬롯

**12개 프리셋, 6개 독립 슬롯**입니다. 모든 슬롯은 처음에 비어 있습니다. 슬롯 선택을 생략하면 `accessories`/`design`의 장비를 사용하며, `none`을 지정하면 상위 데이터에 장비가 있어도 해제합니다. 선택 prop은 아래 프리셋 문자열 union이고 색 prop은 `string`입니다.

| HTML 속성 | React prop | 허용 값 / 생략 시 동작 |
| --- | --- | --- |
| `head-accessory` | `headAccessory` | `beret` / `halo` / `crown` / `none`. `head` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `head-color` | `headColor` | `#RRGGBB`. 머리 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |
| `eyes-accessory` | `eyesAccessory` | `glasses` / `sunglasses` / `none`. `eyes` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `eyes-color` | `eyesColor` | `#RRGGBB`. 눈 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |
| `mouth-accessory` | `mouthAccessory` | `moustache` / `goatee` / `none`. `mouth` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `mouth-color` | `mouthColor` | `#RRGGBB`. 입 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |
| `neck-accessory` | `neckAccessory` | `bowTie` / `scarf` / `necklace` / `none`. `neck` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `neck-color` | `neckColor` | `#RRGGBB`. 목 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |
| `left-ear-accessory` | `leftEarAccessory` | `earring` / `starEarring` / `none`. `leftEar` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `left-ear-color` | `leftEarColor` | `#RRGGBB`. 왼쪽 귀 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |
| `right-ear-accessory` | `rightEarAccessory` | `earring` / `starEarring` / `none`. `rightEar` 슬롯의 상위 장비 사용, 초기 비어 있음 |
| `right-ear-color` | `rightEarColor` | `#RRGGBB`. 오른쪽 귀 장비의 기존 색 유지, 새 장비는 프리셋 기본색 |

프리셋 기본색은 베레모·보타이·스카프 `#b84742`, 헤일로·링 귀걸이 `#f7cc5b`, 안경·선글라스·콧수염·턱수염 `#31323d`, 왕관 `#e5ad35`, 목걸이 `#9b6c2a`, 별 귀걸이 `#a66a22`입니다.

`eye-color`/`eyeColor`는 **눈 자체**, `eyes-color`/`eyesColor`는 **안경 등 눈 슬롯 장비**의 색입니다. 빈 슬롯에도 색을 미리 지정할 수 있습니다. 슬롯 선택을 제거하면 아래 단계의 `accessories`/`design` 장비가 다시 나타날 수 있으므로 제거와 `none`을 구분하세요. 사용자 지정 id가 필요하면 `accessories` JSON을 사용합니다.

```html
<sidekick-avatar
  head-accessory="halo"
  eyes-accessory="glasses" eyes-color="#334155"
  mouth-accessory="moustache"
  neck-accessory="scarf"
  left-ear-accessory="earring" left-ear-color="#f7cc5b"
  right-ear-accessory="earring" right-ear-color="#a4b8c9"
></sidekick-avatar>
```

### 런타임·카메라·애니메이션

| HTML 속성 | React prop | React 타입 | 허용 값 / 기본값 |
| --- | --- | --- | --- |
| `activity` | `activity` | `Activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`. 기본 `idle` |
| `paused` | `paused` | `boolean` | 기본 `false`. 반복 모션 일시 정지 |
| `interaction` | `interaction` | `'none' \| 'box'` | 기본 `none`. `box`는 드래그/클릭/키보드 활성화 |
| `mouse-tracking` | `mouseTracking` | `boolean` | 기본 `false`. 문서 전체의 마우스 시선 추적 |
| `camera` | `camera` | `CameraPreset \| Partial<CameraAngles>` | HTML은 `front` / `three-quarter` / `side`, 기본 `front`. React는 `{yaw,pitch,roll}` 부분 객체도 허용 |
| `camera-yaw` | `cameraYaw` | `number` | -360~360도. camera 프리셋의 yaw, 없으면 0 |
| `camera-pitch` | `cameraPitch` | `number` | -90~90도. camera 프리셋의 pitch, 없으면 0 |
| `camera-roll` | `cameraRoll` | `number` | -180~180도. camera 프리셋의 roll, 없으면 0 |
| `gaze-x` | `gazeX` | `number` | -1~1. 기본 0. 마우스 추적을 끄면 사용하는 명시적 시선 |
| `gaze-y` | `gazeY` | `number` | -1~1. 기본 0 |
| `shape-duration` | `shapeDuration` | `number` | 도형 속성 전환 시간 0~60000ms. 기본 450 |
| `shape-easing` | `shapeEasing` | `MotionOptions['easing']` | `smooth` / `linear`. 기본 `smooth` |
| `motion-duration` | `motionDuration` | `number` | 눈·포즈 속성 전환 시간 0~60000ms. 기본 400 |
| `motion-easing` | `motionEasing` | `MotionOptions['easing']` | `smooth` / `linear`. 기본 `smooth` |
| `motion` | `motion` | `MotionTarget` | HTML은 JSON 문자열. 초기 포즈는 회전·얼굴 이동 0, 공통 눈 뜨기 1, 좌우 눈은 디자인 가중치 |
| `time` | `time` | `number` | 반복 애니메이션 시간 0~86400초. 기본 0. 프레임마다 변경되는 readback 값이 아닌 seek 입력 |

React의 `camera={{ yaw: 35 }}`는 `camera-yaw` 속성으로 연결됩니다. 같은 축의 별도 prop인 `cameraYaw`를 함께 주면 별도 prop이 우선합니다. 생략한 객체 축은 새 요소에서는 0이고, 이전에 래퍼가 소유한 축을 제거하면 선언적 기본값으로 돌아갑니다. 명령형 `setCamera({yaw:35})`는 지정하지 않은 현재 축을 유지합니다.

`MotionTarget`은 부분 목표이며 지정하지 않은 채널은 유지합니다. 지원하는 중첩 필드는 전부 다음과 같습니다.

| `motion` 필드 | 타입·범위 | 초기값 / 의미 |
| --- | --- | --- |
| `body.rotation` | `[number, number, number]`, 각 -2π~2π 라디안 | `[0,0,0]`, 몸체 회전 |
| `face.uv` | `[number, number]`, 각 -0.5~0.5 | `[0,0]`, 얼굴 위치의 런타임 이동 |
| `eyes.left.weights.smile`, `eyes.right.weights.smile` | `number`, 0~1 | 각 눈의 디자인 가중치, 처음에는 0 |
| `eyes.left.weights.blink`, `eyes.right.weights.blink` | `number`, 0~1 | 각 눈의 디자인 가중치, 처음에는 0 |
| `eyes.openness` | `number`, 0~1 | 1, 공통 눈 뜨기 제한 |
| `accessories.<id>.rotation` | `[number, number, number]`, 각 -π~π 라디안 | `[0,0,0]`, 현재 장착된 고유 id의 회전 |
| `eyes.left.expression`, `eyes.right.expression` | `EyeExpression` | 이전 호환 입력. `neutral` / `smile` / `blink`를 가중치로 변환 |
| `eyes.left.openness`, `eyes.right.openness` | `number`, 0~1 | 이전 호환 입력. 감기 가중치로 변환 |

한 눈에 `weights`와 이전 `expression`/`openness`를 섞으면 오류입니다. 새 코드는 `weights`를 사용하세요. `motion={}`/`motion="{}"`는 새 목표 채널이 없다는 뜻이며 초기화하지 않습니다. `motion` prop/속성 제거는 아래 제거 규칙대로 기본 포즈로 복원합니다. 카메라 각도는 **도**, 포즈 회전은 **라디안**입니다.

### React 참조와 이벤트 props

이 표의 props는 HTML 속성으로 쓰지 않습니다. HTML에서는 아래 DOM 이벤트를 `addEventListener()`로 구독합니다. 콜백은 React SyntheticEvent가 아닌 원래 `CustomEvent`를 받고 반환값은 `void`입니다. 모든 콜백의 기본값은 `undefined`이며 생략하면 호출하지 않습니다.

| React prop | 타입 | 값·동작 |
| --- | --- | --- |
| `ref` | `React.Ref<SidekickAvatarRef>` | 기본 없음. 객체 ref 또는 callback ref. 실제 커스텀 요소가 업그레이드된 뒤 전달, 정리 시 해제 |
| `onReady` | `SidekickEventHandler<'sidekick-ready'>` | `CustomEvent<{}>`. props 적용 후 렌더 준비 완료 |
| `onError` | `SidekickEventHandler<'sidekick-error'>` | `CustomEvent<SidekickErrorDetail>`. `message: string`, 선택 `attribute: string`, `value: string \| null`, `recoverable: boolean` |
| `onDesignChange` | `SidekickEventHandler<'sidekick-design-change'>` | `CustomEvent<{design: AvatarDesign}>` |
| `onCameraChange` | `SidekickEventHandler<'sidekick-camera-change'>` | `CustomEvent<{camera: CameraAngles}>` |
| `onMotionEnd` | `SidekickEventHandler<'sidekick-motion-end'>` | `CustomEvent<{finished: boolean}>` |
| `onShapeEnd` | `SidekickEventHandler<'sidekick-shape-end'>` | `CustomEvent<{finished: boolean}>` |
| `onActivate` | `SidekickEventHandler<'sidekick-activate'>` | `CustomEvent<{}>`. 클릭 또는 Enter/Space 활성화 |

이 밖의 props는 `HTMLAttributes<SidekickAvatarRef>`를 따릅니다. 예: `id?: string`, `className?: string`, `style?: React.CSSProperties`, `aria-*`, `data-*`, 일반 DOM 이벤트. `children`과 `dangerouslySetInnerHTML`은 래퍼가 지원하지 않습니다. `onError`는 위의 Sidekick 오류 콜백으로 정의합니다. `key`는 React의 요소 식별값이고 HTML 속성/Sidekick 설정이 아닙니다.

### 변경·제거·오류 규칙

- boolean은 네이티브 HTML boolean과 달리 문자열 `"false"`도 해석합니다. `mouse-tracking`, `mouse-tracking=""`, `mouse-tracking="true"`, `mouse-tracking="1"`이 켜짐입니다. `="false"`, `="0"` 또는 속성 제거는 꺼짐입니다. `paused`도 같습니다. React에서는 `{true}` / `{false}`를 사용하세요. React의 `false`는 명시적인 꺼짐 값이며 prop 생략과 다릅니다. `null`, `"TRUE"`, `"yes"` 등은 지원하지 않습니다.
- 지원하는 속성에 잘못된 도형 이름·프리셋·JSON·숫자 범위·색상 형식을 넣으면 오류입니다. 관찰하지 않는 임의 HTML 속성은 브라우저의 일반 속성으로 남으며 라이브러리 설정에 적용되지 않습니다. 색상 축약 `#fff`, CSS 색상명, `NaN`, `Infinity`는 지원하지 않습니다. 값을 생략하려면 빈 문자열 대신 속성을 제거하세요.
- React의 `undefined`/생략 및 HTML `removeAttribute()`는 그 입력의 덮어쓰기만 해제합니다. `design` 아래 입력이 있으면 그것을 사용합니다. 슬롯을 반드시 비우려면 `none`, 장비 배열을 반드시 비우려면 `[]`를 지정하세요.
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

35개 도형 사이 전환은 현재 보이는 윤곽에서 다음 목표로 이어집니다. 목표 이름은 즉시 `design.body.shape`에 저장되며 모프 중간 기하를 JSON에 넣지 않습니다. 색상·장비 편집은 진행 중 도형 전환을 유지합니다. 요소의 JavaScript `design` 프로퍼티/`setDesign()`으로 도형을 바꾸면 즉시 적용합니다. HTML `design` 속성 및 React `design` prop의 도형 변경은 `shape-duration`/`shapeDuration`으로 전환합니다. 모션 줄이기·일시 정지·연결되지 않은 요소에서는 전환을 즉시 적용합니다.

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

Studio는 **React 19 + Vite 8 + Tailwind CSS 4 + 실제 shadcn/ui Radix/Nova 컴포넌트**, Slate 색상 토큰으로 구현한 별도 편집기입니다. 코어를 사용하는 웹사이트에는 이 UI 의존성이 들어가지 않습니다. 아래는 소스를 개발하는 사람을 위한 명령이며 Node.js 22.22.2 이상을 사용합니다.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173

npm run build:library   # 패키지 모듈/타입과 dist/browser의 prebuilt 번들 생성
npm run check:library   # 소스와 체크인된 산출물 일치 검사
npm run build:studio    # Vite 편집기 빌드
npm run build:all       # 라이브러리 + dist/src + 편집기 + 고지
npm start              # 빌드한 편집기 제공
npm run pack:library   # 라이브러리 재빌드 후 tarball 생성
npm run pack:release   # 커밋된 깨끗한 checkout에서 release/에 ZIP·tarball·SHA256SUMS 생성
```

외부 접근이 필요할 때만 `HOST=0.0.0.0`을 사용하세요. 포트는 `PORT`로 바꿉니다. 정적 Studio 배포는 `dist/` 전체를 사용합니다. 루트 `dist/index.html`과 호환 경로 `dist/playground/index.html`, 해시된 `dist/assets/`를 생성합니다. npm 패키지는 Studio 출력 대신 `dist/library/`와 `dist/browser/`를 포함합니다. 소비자는 이 개발용 빌드 명령을 실행할 필요가 없습니다. `pack:release`는 변경 사항과 prebuilt 산출물을 모두 커밋한 깨끗한 checkout 및 시스템 `zip` 명령이 필요하며, GitHub Release를 자동 게시하지 않습니다.

### Studio에서 할 수 있는 일

- 외형: 검색·키보드 탐색이 되는 35개 실루엣 타일, 몸체·눈 색, 실제 렌더링 썸네일의 12종 장비와 슬롯별 색
- 애니메이션: 활동·일시 정지, 마우스 추적 on/off, 명시적 시선, 도형 전환 시간·easing, 좌우 웃음·감기 가중치
- 카메라: yaw·pitch·roll, 정면·사선·측면 프리셋, 미리보기 드래그와 양방향 동기화
- JSON: 파일/텍스트 가져오기·내보내기, 현재 설정이 반영되는 HTML/React 코드와 복사 버튼, 알파 경계에 맞춘 투명 PNG 저장

데스크톱은 미리보기와 설정을 나란히 배치합니다. 모바일 세로 화면은 미리보기를 고정하고 아래 설정만 스크롤하며 짧은 가로 화면은 나란히 배치합니다. `100dvh`와 safe-area를 사용합니다. 탭·슬라이더·토글은 shadcn/Radix의 키보드 동작을 유지합니다. 글꼴은 로컬 번들에 포함합니다. 미리보기의 체크무늬·밝은색·어두운색은 DOM 배경이며 PNG에 포함하지 않습니다.

자동 저장은 디자인만 이 브라우저의 `sidekick.design.v7`에 저장합니다. 파일 내보내기는 별도로 장면 envelope를 사용하여 카메라·추적·전환 설정까지 포함합니다. 저장된 v7이 없으면 v6→v1 순서로 읽고 변환하되 이전 키의 원본을 보존합니다. 잘못된 원본은 JSON 탭에 열고, 첫 편집 시 `.recovery` 백업이 성공해야 새 파일을 저장합니다. 저장소가 막혔다면 JSON 내보내기를 사용하세요. 초기화하면 기본 square+베레모, 정면 카메라, 마우스 추적 꺼짐으로 돌아갑니다.

UI 구성은 `components.json`과 `playground/components/ui/`, 저장·명령·복구는 `studio-controller.ts`에 있습니다. React 재렌더와 탭 전환은 하나의 안정된 요소를 유지하며 진행 중 모프나 카메라를 재설정하지 않습니다. [공식 shadcn/ui Vite 설치](https://ui.shadcn.com/docs/installation/vite) 방식으로 생성한 실제 소스를 사용합니다.

### GitHub Pages 배포

이 공개 저장소의 GitHub Actions 기반 Pages 주소는 [hanana-kick.github.io/sidekick/](https://hanana-kick.github.io/sidekick/)입니다. `.github/workflows/pages.yml`은 기존 공개 Studio를 갱신하는 수동 워크플로입니다. CI를 통과한 커밋을 선택하고 **수동 실행 시 `approve_public_deployment`를 명시적으로 승인해야** 빌드·배포합니다. 커밋을 push하거나 워크플로 파일을 추가하는 것만으로 배포하지 않습니다.

워크플로는 `actions/configure-pages`로 기존 설정만 읽으며 Pages 활성화나 도메인·공개 범위·보안 설정을 변경하지 않습니다. 기본 Vite base는 `./`이므로 **`npm run build:all`로 만든 동일한 `dist/`**가 사용자 지정 도메인의 `/`와 GitHub Pages의 `/sidekick/`에서 모두 동작합니다. 각 위치의 `index.html` 및 `playground/`·`playground/index.html` 진입점도 지원하며 스크립트·스타일·글꼴·장비 썸네일·favicon을 해당 배포 위치에서 불러옵니다. 홈 링크와 계산된 썸네일 URL은 현재 문서 깊이 대신 빌드 모듈 위치를 기준으로 합니다.

고정 경로 전용 배포가 필요하면 `SIDEKICK_BASE=/my-path/ npm run build:all`처럼 명시적으로 덮어쓸 수 있지만, 그 산출물은 지정된 경로에서 제공해야 합니다. 수동 Pages 워크플로는 사용자 지정 도메인의 `base_path`에 따라 base를 바꾸지 않습니다. `node --test tests/pages-build.test.mjs`는 동일한 기본 빌드의 루트·하위 경로 자산 참조를 검사하며, 실제 브라우저의 렌더링과 상호작용은 `npm run test:browser`로 확인합니다. 배포 뒤에는 `verify` 작업이 실제 프로젝트 URL을 Chromium으로 열고 검사하며 스크린샷을 Actions 산출물에 저장합니다. 선택한 커밋의 배포와 검증 작업 결과를 모두 확인하세요.

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
