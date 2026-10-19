# Sidekick

[한국어](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

**35개 Material 도형으로 만드는 투명 Flat 캐릭터 라이브러리.** 기본 `<sidekick-avatar>` 하나로 시작하고 HTML 속성, JavaScript API, React 래퍼 중 편한 방식으로 제어할 수 있습니다. 도형 전환, 좌우 표정, 마우스 시선 추적, 몸체 방향 회전, 여섯 슬롯의 액세서리와 방향성 있는 화면 이동을 지원합니다. 코어는 프레임워크 의존성이 없는 TypeScript + Web Component + WebGL2입니다.

- [설치](#설치) · [HTML](#html에서-바로-사용하기) · [React](#react에서-사용하기)
- [전체 속성](#html-속성과-react-props) · [디자인과 액세서리](#디자인-json과-액세서리) · [애니메이션/API](#애니메이션과-명령형-api)
- [선언형 행동](#선언형-행동-behavior) · [화면 이동/비행](#렌더링이동-표준-v03) · [이벤트/정리](#이벤트와-정리) · [SSR](#ssr과-브라우저-지원) · [Studio/개발](#studio와-개발)

## 설치

**공개 GitHub 저장소에서 빌드된 패키지를 바로 설치하세요.** 사용할 프로젝트에서 다음 명령을 실행합니다.

```sh
npm install https://github.com/hanana-kick/sidekick.git
```

버전을 고정하려면 릴리스 태그를 지정합니다.

```sh
npm install https://github.com/hanana-kick/sidekick.git#v0.11.0
```

빌드된 ESM·타입 선언·브라우저 번들이 저장소에 포함되어 있어 **설치하는 쪽에서 Sidekick 소스를 빌드할 필요가 없습니다.** 의존성 및 lockfile을 함께 커밋하면 팀도 같은 버전을 사용합니다. 패키지 이름은 `@hanana-kick/sidekick`, 이 버전은 `0.11.0`입니다. **npm 레지스트리에는 발행하지 않았으므로 이름만으로 `npm install @hanana-kick/sidekick`을 실행하지 마세요.**

npm을 쓰지 않는 HTML 사이트에서는 [GitHub Releases](https://github.com/hanana-kick/sidekick/releases)의 빌드된 파일을 내려받으세요. ESM과 일반 `<script>`용 JS, 전용 렌더링 worker를 제공하며, 이 브라우저 코어에는 React·번들러·Node.js·별도 CSS·글꼴이 필요 없습니다.

### GitHub Release에서 다운로드

1. [Releases](https://github.com/hanana-kick/sidekick/releases)를 엽니다.
2. 사용할 태그의 **Assets**에서 `sidekick-browser-0.11.0.zip` 또는 `hanana-kick-sidekick-0.11.0.tgz`를 받습니다. 다른 버전은 태그와 일치하는 파일명을 선택하세요. 자동 생성된 **Source code (zip/tar.gz)**는 소스 아카이브이므로 브라우저 배포 ZIP과 구분하세요.
3. 일반 HTML 사이트에서는 브라우저 ZIP을 풀고 아래 파일을 사이트의 정적 파일 디렉터리에 복사합니다. 동봉된 `START-HERE.txt`를 읽고 `esm.html`, `classic.html`, `react.html` 중 원하는 예제를 열면 됩니다. 예제의 `/vendor/sidekick/`은 **사용자 사이트의 경로**입니다. 배포 경로에 맞게 바꾸세요.

| 빌드된 파일 | 용도 | 필요한 파일·의존성 |
| --- | --- | --- |
| `sidekick-browser-0.11.0.zip` | 일반 HTML/React 브라우저 배포 | `esm.html`·`classic.html`·`react.html`, 아래 JS 6개, 선택적 `vendor/`, README·고지 포함 |
| `sidekick.js` | 브라우저 ESM. `import`와 `<script type="module">` 사용 | `sidekick.worker.js`를 같은 디렉터리에 유지 |
| `sidekick.iife.js` | 일반 classic `<script>`. API는 `window.Sidekick` | `sidekick.worker.js`를 같은 디렉터리에 유지. `type="module"` 사용 안 함 |
| `sidekick-react.js` | React 19용 ESM 컴포넌트 | `sidekick-element.js`·`sidekick-fallback.js`·`sidekick.worker.js`를 같은 디렉터리에 유지하고 `react` peer를 제공 |
| `sidekick-element.js` | React 래퍼가 지연 로딩하는 렌더러 | 직접 import하지 않음. `sidekick-react.js`와 같은 버전 사용 |
| `sidekick-fallback.js` | worker를 사용할 수 없을 때 React 요소가 불러오는 렌더러 | 직접 import하지 않음. 나머지 파일과 같은 버전 사용 |
| `sidekick.worker.js` | OffscreenCanvas 전용 worker | 브라우저 진입 파일 옆에 배치. 별도 script 태그로 불러오지 않음 |
| `vendor/react.js`, `vendor/react-dom-client.js` | 브라우저 ZIP의 선택적 React 19/ReactDOM ESM | 아래 빌드 없는 React 예제용. import map으로 연결하며 React를 이미 제공하는 앱에는 불필요 |
| `hanana-kick-sidekick-0.11.0.tgz` | 기존 npm 기반 프로젝트에 설치하는 패키지 | 빌드된 ESM·타입 선언·브라우저 번들·고지 포함 |
| `SHA256SUMS` | ZIP과 tarball의 다운로드 무결성 확인 | 같은 Release의 체크섬 파일 |

ZIP에 함께 들어 있는 README와 제3자 라이선스/출처 고지도 보관하세요. **GitHub Release 자산은 다운로드한 뒤 본인 사이트에서 제공하세요.** 다운로드 URL은 브라우저 JS 호스팅용 URL이 아니며 자산 응답의 MIME·CORS 동작이 정적 호스팅과 다릅니다. 아래 예제의 `src`/`import`는 내려받은 파일을 제공하는 사이트 경로를 사용합니다.

`sidekick.js`와 `sidekick.iife.js`는 각각 전체 공개 코어/요소 API를 내보내며 기본 `<sidekick-avatar>`를 자동 등록합니다. **둘 중 하나만 선택하세요.** Classic JS는 브라우저 전역 스크립트를 뜻하며 Node.js CommonJS `require()` 빌드는 아닙니다. React 래퍼는 React를 번들 안에 포함하지 않습니다. `sidekick.js`의 `SidekickAvatar`는 커스텀 요소 클래스이고, `sidekick-react.js`의 같은 이름은 React 컴포넌트입니다.

### 선택 사항: 빌드된 tarball 설치

Release에서 받은 tarball을 사용할 프로젝트에서 설치합니다. 이 명령은 Sidekick 소스를 컴파일하거나 Studio를 빌드하지 않습니다.

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.11.0.tgz
```

React 래퍼를 사용할 때만 React 19가 필요합니다. 웹페이지를 마운트하는 `react-dom`도 사용자가 같은 버전으로 준비합니다. 코어만 쓰는 프로젝트에는 React가 필요 없습니다.

### 패키지 진입점

| import 경로 | 용도 |
| --- | --- |
| `@hanana-kick/sidekick` | 브라우저에서 기본 태그를 자동 등록하고 공개 API를 export |
| `@hanana-kick/sidekick/auto` | 자동 등록을 명시하는 진입점 |
| `@hanana-kick/sidekick/register` | 자동 등록 없이 `defineSidekick`, 요소 클래스와 공개 API를 import |
| `@hanana-kick/sidekick/core` | DOM 없이 디자인·장면 생성/검증, 모션·몸체 방향·픽셀 유틸리티 사용 |
| `@hanana-kick/sidekick/react` | React 컴포넌트 `SidekickAvatar`, props/ref 타입 |

패키지 모듈은 ESM이며 실행용 모듈/타입은 `dist/library/`, 즉시 사용 가능한 브라우저 번들은 `dist/browser/`입니다. `dist/src/`는 내부 테스트용입니다. bare import 이름은 브라우저가 직접 해석하지 못하므로 패키지 import에는 번들러 또는 import map을 사용하세요. 아래 HTML 예제는 실제 파일 URL을 사용하여 이 설정이 필요 없습니다.

## 감정과 일시적인 반응

감정은 봇이 **무엇을 하는지**와 별개인 표현 계층입니다. 대기·검토 같은 행동이나 활동, 이동을 중단하지 않고 눈과 몸의 기울기·리듬을 함께 조절합니다. 실제 사용자의 감정을 추론하지 않으며 앱이 명시적으로 지정합니다.

`neutral`, `happy`, `sad`, `curious`, `surprised`, `concerned`, `excited`. `intensity`는 0~1이며 기본값은 1입니다. `neutral`은 감정 효과를 제거하고 현재 디자인·행동의 표현을 보여줍니다.


```ts
import type { SidekickAvatar } from '@hanana-kick/sidekick';
const bot = document.querySelector<SidekickAvatar>('sidekick-avatar')!;
bot.setEmotion('curious', { intensity: 0.6 });
bot.behavior = { type: 'wait', target: '#loading' };
await bot.reactTo('happy', { intensity: 0.9, duration: 1600 });
bot.setEmotion('neutral');
```

```html
<sidekick-avatar emotion="curious" emotion-intensity="0.6"></sidekick-avatar>
```

```tsx
<SidekickAvatar emotion="curious" emotionIntensity={0.6}
  behavior={{ type: 'wait', target: '#loading' }}
  onEmotionChange={event => console.log(event.detail)}
  onReactionEnd={event => console.log(event.detail.reason)} />
```

`setEmotion()`은 지속 상태를 설정하며 진행 중인 일시 반응을 교체합니다. `reactTo()`는 기본 1200ms 동안 반응한 뒤 지속 감정으로 돌아갑니다. `duration`은 진입 전환을 포함한 유지 시간(0~60000ms)이며 복귀 전환 완료를 기다리는 시간이 아닙니다. `cancelReaction()`은 반응만 취소합니다. 새 반응·지속 감정·연결 해제는 이전 반응을 `finished: false`로 끝내며 오래된 타이머가 새 설정을 덮어쓰지 않습니다.

`emotion`/`emotionIntensity` 프로퍼티는 지속 설정을 반환하고 `emotionState`는 `{ emotion, intensity, baseline: { emotion, intensity }, reacting }` 형태로 현재 반응까지 포함합니다. `sidekick-emotion-change`는 이 상태를 전달합니다. `sidekick-reaction-end`와 Promise 결과는 `{ finished, emotion, reason }`; `reason`은 `completed`, `replaced`, `cancelled`, `disconnected`입니다. 종료는 유지 시간 종료를 의미하며 복귀 화면이 완전히 정착했다는 뜻은 아닙니다.

감정은 저장된 디자인, 활동, 시선, 몸 방향을 덮어쓰거나 복원하지 않습니다. 그동안의 수동 변경은 감정 아래에서 그대로 유지됩니다. 감정이 활성화되면 눈 표현에 우선 혼합되고 자동 깜빡임은 유지됩니다. 대상을 보는 행동은 감정의 보조 시선보다 우선합니다. 수동 눈 표현을 그대로 표시하려면 `setEmotion('neutral')`을 사용하세요. 화면 밖에서는 렌더링이 쉬며 일시 반응의 유지 시간은 실제 시간대로 흐릅니다. 다시 연결해도 끝난 반응을 재생하지 않습니다.

| HTML / API | React | 설명 |
| --- | --- | --- |
| `emotion` | `emotion` | 감정 이름. 기본 neutral |
| `emotion-intensity` | `emotionIntensity` | 감정 강도 0~1. 기본 1 |
| `sidekick-emotion-change` | `onEmotionChange` | 지속 감정 또는 일시 반응 변경 |
| `sidekick-reaction-end` | `onReactionEnd` | 일시 반응 완료·교체·취소·연결 해제 |

## CDN으로 빌드 없이 사용하기

현재 CDN 권장 버전은 **0.11.0**입니다. 아래 URL은 GitHub 태그에 커밋된 **빌드 완료 JS**를 jsDelivr가 제공하므로 소스 빌드, npm 설치, npm 계정이 필요 없습니다. `main`, `latest`, 버전 범위 대신 **정확한 태그**를 고정하세요. 이전 `v0.2.7` 파일은 변경하지 않았습니다. 0.2.7도 같은 CDN 경로로 다운로드할 수 있지만, 다른 출처의 페이지에서는 worker 생성이 막혀 메인 스레드로 폴백하므로 신규 CDN 사용에는 위에 고정한 현재 버전을 사용하세요.

### 일반 HTML / classic script

```html
<script defer src="https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/dist/browser/sidekick.iife.js"></script>
<sidekick-avatar shape="ghostish" head-accessory="beret"
  eyes-accessory="glasses" neck-accessory="bowTie"
  left-smile="1" right-smile="1"
  style="display:block;width:240px;height:240px"></sidekick-avatar>
```

### ESM

```html
<sidekick-avatar id="bot" shape="heart"></sidekick-avatar>
<script type="module">
  import { createDesign } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/dist/browser/sidekick.js';
  console.log(createDesign());
</script>
```

ESM과 classic은 같은 요소를 자동 등록합니다. 한 페이지에서는 둘 중 하나만 사용하세요.

### React: 브라우저에서 빌드 없이 실행

React와 ReactDOM은 동일한 19.3.1의 미리 빌드된 ESM을 제공합니다. import map은 모든 모듈 스크립트보다 먼저 선언하세요. JSX 변환 없이 `createElement`를 사용합니다.

```html
<div id="root"></div>
<script type="importmap">
{
  "imports": {
    "react": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/cdn/react-19.3.1/react.js",
    "react-dom/client": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/cdn/react-19.3.1/react-dom-client.js"
  }
}
</script>
<script type="module">
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { SidekickAvatar } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/dist/browser/sidekick-react.js';
  createRoot(document.getElementById('root')).render(createElement(SidekickAvatar, {
    shape: 'ghostish', headAccessory: 'beret', eyesAccessory: 'glasses',
    neckAccessory: 'bowTie', leftSmile: 1, rightSmile: 1,
    style: { width: 240, height: 240 }
  }));
</script>
```

기존 React 앱에서는 앱의 React 인스턴스를 그대로 사용하세요. 위 import map으로 별도 React를 중복 로딩하지 말고, npm/GitHub 설치 후 `@hanana-kick/sidekick/react`를 import하는 방식이 적절합니다.

### Worker, CORS, CSP와 자체 호스팅

- CDN JS 응답은 JavaScript MIME 및 `Access-Control-Allow-Origin: *`가 필요합니다. jsDelivr가 이를 제공합니다. GitHub Release 다운로드 URL을 `script src`에 넣지 마세요.
- 0.2.8부터 CDN과 페이지의 출처가 다르면 로컬 Blob module worker에서 CDN의 `sidekick.worker.js`를 정적으로 import합니다. 실제 렌더링은 계속 OffscreenCanvas worker에서 수행합니다. Blob URL은 시작 완료/오류/종료 시 해제합니다.
- CSP가 있으면 `worker-src 'self' blob:` 및 `script-src`의 `https://cdn.jsdelivr.net`을 허용해야 합니다. 위 inline 예제와 import map에는 사이트 정책에 맞는 nonce/hash도 필요합니다. 전체 CSP를 무조건 완화하거나 `unsafe-inline`을 추가할 필요는 없습니다.
- worker/WebGL2/OffscreenCanvas가 지원되지 않거나 CSP가 worker를 차단하면 기존 메인 스레드 렌더러로 폴백합니다. HTTPS로 제공하세요. HTTP 로컬 개발은 localhost를 사용하세요.
- 자가 호스팅은 브라우저 ZIP의 **전체 여섯 JS 파일**을 같은 디렉터리에 유지합니다. React는 같은 버전의 `sidekick-element.js`, `sidekick-fallback.js`를 지연 로딩합니다. worker 파일이나 chunk만 다른 버전으로 교체하면 안 됩니다.
- 버전 태그의 배포물은 수정하지 않습니다. 수정은 새 patch 버전으로 배포합니다. jsDelivr는 처음 요청된 파일을 장기 보관하므로 삭제를 되돌리기 수단으로 간주하지 마세요.

CDN 공식 동작과 캐시 정책: [jsDelivr GitHub 배포 문서](https://github.com/jsdelivr/jsdelivr#github).

## HTML에서 바로 사용하기

### 가장 작은 ESM 사용 예

다운로드한 `sidekick.js`와 `sidekick.worker.js`를 사이트의 `/vendor/sidekick/`에 놓으면 다음 두 줄로 시작할 수 있습니다.

```html
<script type="module" src="/vendor/sidekick/sidekick.js"></script>
<sidekick-avatar></sidekick-avatar>
```

등록이 끝나면 200 × 200px의 투명 캐릭터가 표시됩니다. 기본값은 `#FFCC37` 노란 `square`, 어두운 눈, 액세서리 없음, `idle` 상태입니다. 크기는 일반 CSS로 정합니다. 외형은 카탈로그/장비 선택과 색상으로 설정하며 각 파츠의 기하 크기·깊이·위치는 공개하지 않습니다.

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
  <sidekick-avatar id="bot" shape="verySunny" body-color="#ffcc37"
    eye-color="#24242c" head-accessory="beret" head-color="#b84742"
    tracking-mode="eyes-and-body" interaction="box" shape-duration="450"
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

`sidekick.iife.js`와 `sidekick.worker.js`를 같은 디렉터리에 복사하고 `type="module"` 없이 불러옵니다. 등록은 자동이며 같은 공개 API가 `Sidekick` 전역에 있습니다. 외부 스크립트를 먼저 실행하고 그 아래에서 API를 사용하세요. 이 순서의 예제에 `async`/`defer`를 임의로 추가하지 마세요.

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
    tracking-mode="eyes-and-body" interaction="box" aria-label="작업 도우미"></sidekick-avatar>
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
bot.trackingMode = 'off';
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
        trackingMode={tracking ? 'eyes-and-body' : 'off'}
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

<SidekickAvatar design={design} trackingMode="off" />;
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
          trackingMode: tracking ? 'eyes-and-body' : 'off', interaction: 'box', shapeDuration: 450,
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
- React 설정 prop의 해제 값은 **`undefined` 또는 prop 생략**입니다. 이전에 래퍼가 설정한 속성은 제거됩니다. `null`은 일반 설정 prop의 지원 값이 아닙니다. 단, `behavior={null}`은 명시적으로 행동을 취소합니다. `ref={null}`은 React 표준에 따라 참조를 해제할 때 사용할 수 있습니다.
- `MaterialShapeName`의 허용 값 35개는 [전체 도형 목록](#도형렌더링-범위와-라이선스), `AvatarDesign`/`AccessoryDesign`의 필드는 [디자인 JSON](#디자인-json과-액세서리), `MotionTarget`의 모든 필드는 아래 표를 참고하세요. 문자열 enum은 대소문자를 구분합니다.

### 기본·몸체·눈

| HTML 속성 | React prop | React 타입 | 허용 값 / 기본값 |
| --- | --- | --- | --- |
| `design` | `design` | `AvatarDesign` | HTML은 완전한 디자인 JSON 문자열. 기본 `createDesign()`의 v7 디자인 |
| `shape` | `shape` | `MaterialShapeName` | 35개 카탈로그 이름. 상위 디자인의 도형, 없으면 `square` |
| `body-color` | `bodyColor` | `string` | `#RRGGBB`. 상위 디자인 색, 없으면 `#FFCC37` |
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

### 런타임·몸체 방향·애니메이션

| HTML 속성 | React prop | React 타입 | 허용 값 / 기본값 |
| --- | --- | --- | --- |
| `behavior` | `behavior` | `BotBehavior \| null` | HTML은 JSON 문자열, React는 실제 객체/Element. `null` 또는 제거는 행동 취소. 아래 선언형 행동 참고 |
| `activity` | `activity` | `Activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`. 기본 `idle` |
| `paused` | `paused` | `boolean` | 기본 `false`. 반복 모션 일시 정지 |
| `interaction` | `interaction` | `'none' \| 'box'` | 기본 `none`. `box`는 드래그/클릭/키보드 활성화 |
| `tracking-mode` | `trackingMode` | `TrackingMode` | `off`, `eyes`, `eyes-and-body`(기본). 눈만 또는 눈과 몸 추적 |
| `mouse-tracking` | `mouseTracking` | `boolean` | 이전 눈 추적 별칭. `true` → `eyes`, `false` → `off`. 명시적인 `tracking-mode`가 우선 |
| `body-orientation` | `bodyOrientation` | `BodyOrientationPreset \| Partial<BodyOrientation>` | HTML은 `front` / `three-quarter` / `side`, 기본 `front`. React는 `{yaw,pitch,roll}` 부분 객체도 허용 |
| `body-yaw` | `bodyYaw` | `number` | -360~360도. bodyOrientation 프리셋의 yaw, 없으면 0 |
| `body-pitch` | `bodyPitch` | `number` | -90~90도. bodyOrientation 프리셋의 pitch, 없으면 0 |
| `body-roll` | `bodyRoll` | `number` | -180~180도. bodyOrientation 프리셋의 roll, 없으면 0 |
| `zoom` | `zoom` | `number` | 0.5~3배, 기본 1. 중앙 기준 확대/축소. 제거하면 1로 복원 |
| `gaze-x` | `gazeX` | `number` | -1~1. 기본 0. 마우스 추적을 끄면 사용하는 명시적 시선 |
| `gaze-y` | `gazeY` | `number` | -1~1. 기본 0 |
| `shape-duration` | `shapeDuration` | `number` | 도형 속성 전환 시간 0~60000ms. 기본 450 |
| `shape-easing` | `shapeEasing` | `MotionOptions['easing']` | `smooth` / `linear`. 기본 `smooth` |
| `motion-duration` | `motionDuration` | `number` | 눈·포즈 속성 전환 시간 0~60000ms. 기본 400 |
| `motion-easing` | `motionEasing` | `MotionOptions['easing']` | `smooth` / `linear`. 기본 `smooth` |
| `motion` | `motion` | `MotionTarget` | HTML은 JSON 문자열. 초기 포즈는 회전·얼굴 이동 0, 공통 눈 뜨기 1, 좌우 눈은 디자인 가중치 |
| `time` | `time` | `number` | 반복 애니메이션 시간 0~86400초. 기본 0. 프레임마다 변경되는 readback 값이 아닌 seek 입력 |

React의 `bodyOrientation={{ yaw: 35 }}`는 `body-yaw` 속성으로 연결됩니다. 같은 축의 별도 prop인 `bodyYaw`를 함께 주면 별도 prop이 우선합니다. 확대는 독립적인 `zoom={1.4}` prop으로 설정하며 제거하면 기본 1로 돌아갑니다. 생략한 객체 축은 새 요소에서는 0이고, 이전에 래퍼가 소유한 축을 제거하면 선언적 기본값으로 돌아갑니다. 명령형 `setBodyOrientation({yaw:35})`는 지정하지 않은 현재 축을 유지합니다.

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

한 눈에 `weights`와 이전 `expression`/`openness`를 섞으면 오류입니다. 새 코드는 `weights`를 사용하세요. `motion={}`/`motion="{}"`는 새 목표 채널이 없다는 뜻이며 초기화하지 않습니다. `motion` prop/속성 제거는 아래 제거 규칙대로 기본 포즈로 복원합니다. 몸체 방향 각도는 **도**, 포즈 회전은 **라디안**입니다.

### React 참조와 이벤트 props

이 표의 props는 HTML 속성으로 쓰지 않습니다. HTML에서는 아래 DOM 이벤트를 `addEventListener()`로 구독합니다. 콜백은 React SyntheticEvent가 아닌 원래 `CustomEvent`를 받고 반환값은 `void`입니다. 모든 콜백의 기본값은 `undefined`이며 생략하면 호출하지 않습니다.

| React prop | 타입 | 값·동작 |
| --- | --- | --- |
| `ref` | `React.Ref<SidekickAvatarRef>` | 기본 없음. 객체 ref 또는 callback ref. 실제 커스텀 요소가 업그레이드된 뒤 전달, 정리 시 해제 |
| `onBehaviorChange` | `SidekickEventHandler<'sidekick-behavior-change'>` | `CustomEvent<BehaviorState>`. 행동 상태와 검토 진행 상황 |
| `onBehaviorEnd` | `SidekickEventHandler<'sidekick-behavior-end'>` | `CustomEvent<BehaviorResult>`. 완료·취소·런타임 오류 |
| `onReady` | `SidekickEventHandler<'sidekick-ready'>` | `CustomEvent<{}>`. props 적용 후 렌더 준비 완료 |
| `onError` | `SidekickEventHandler<'sidekick-error'>` | `CustomEvent<SidekickErrorDetail>`. `message: string`, 선택 `attribute: string`, `value: string \| null`, `recoverable: boolean` |
| `onDesignChange` | `SidekickEventHandler<'sidekick-design-change'>` | `CustomEvent<{design: AvatarDesign}>` |
| `onBodyOrientationChange` | `SidekickEventHandler<'sidekick-body-orientation-change'>` | `CustomEvent<{bodyOrientation: BodyOrientation}>` |
| `onZoomChange` | `SidekickEventHandler<'sidekick-zoom-change'>` | `CustomEvent<{zoom: number}>` |
| `onMotionEnd` | `SidekickEventHandler<'sidekick-motion-end'>` | `CustomEvent<{finished: boolean}>` |
| `onShapeEnd` | `SidekickEventHandler<'sidekick-shape-end'>` | `CustomEvent<{finished: boolean}>` |
| `onActivate` | `SidekickEventHandler<'sidekick-activate'>` | `CustomEvent<{}>`. 클릭 또는 Enter/Space 활성화 |

이 밖의 props는 `HTMLAttributes<SidekickAvatarRef>`를 따릅니다. 예: `id?: string`, `className?: string`, `style?: React.CSSProperties`, `aria-*`, `data-*`, 일반 DOM 이벤트. `children`과 `dangerouslySetInnerHTML`은 래퍼가 지원하지 않습니다. `onError`는 위의 Sidekick 오류 콜백으로 정의합니다. `key`는 React의 요소 식별값이고 HTML 속성/Sidekick 설정이 아닙니다.

### 변경·제거·오류 규칙

- boolean은 네이티브 HTML boolean과 달리 문자열 `"false"`도 해석합니다. `mouse-tracking`, `mouse-tracking=""`, `mouse-tracking="true"`, `mouse-tracking="1"`이 켜짐입니다. `="false"`, `="0"`은 꺼짐입니다. `mouse-tracking`을 제거하면 `tracking-mode`가 없는 경우 기본 `eyes-and-body`로 돌아갑니다. 단, `tracking-mode`가 있으면 그 모드가 우선합니다. `paused`도 같은 boolean 표기를 사용하며 속성을 제거하면 꺼집니다. React에서는 `{true}` / `{false}`를 사용하세요. React의 `false`는 명시적인 꺼짐 값이며 prop 생략과 다릅니다. `null`, `"TRUE"`, `"yes"` 등은 지원하지 않습니다.
- 지원하는 속성에 잘못된 도형 이름·프리셋·JSON·숫자 범위·색상 형식을 넣으면 오류입니다. 관찰하지 않는 임의 HTML 속성은 브라우저의 일반 속성으로 남으며 라이브러리 설정에 적용되지 않습니다. 색상 축약 `#fff`, CSS 색상명, `NaN`, `Infinity`는 지원하지 않습니다. 값을 생략하려면 빈 문자열 대신 속성을 제거하세요.
- React의 `undefined`/생략 및 HTML `removeAttribute()`는 그 입력의 덮어쓰기만 해제합니다. `design` 아래 입력이 있으면 그것을 사용합니다. 슬롯을 반드시 비우려면 `none`, 장비 배열을 반드시 비우려면 `[]`를 지정하세요.
- 같은 JavaScript 작업 안에서 바꾼 여러 속성은 다음 마이크로태스크에서 묶어 검증·적용합니다. 잘못된 배치는 이전 유효 런타임 상태를 유지하고 `sidekick-error`를 발생시킵니다. 원래 입력 문자열은 DOM에 남아 있으므로 오류 속성을 고치거나 제거해야 합니다.
- 초기 HTML 속성은 첫 렌더 전에 적용합니다. 연결 후 `shape`·눈 가중치·`motion` 변경은 해당 timing 속성으로 전환합니다. timing만 바꾸면 진행 중인 전환을 다시 시작하지 않습니다.
- 디자인 속성은 `design`을 기본 데이터로 사용하고 개별 속성이 해당 부분만 덮어씁니다. 개별 속성을 제거하면 그 아래의 선언적 데이터 또는 기본값이 드러납니다. `accessories`는 기본 장비 배열을 바꾸고, 슬롯 속성은 그 위에 적용됩니다.
- 눈 우선순위는 `design` → 공통 `expression` → 한쪽 expression → 공통 `smile`/`blink` → 한쪽 가중치입니다. 몸체 방향 프리셋보다 개별 축이 우선합니다. `gaze-x`/`gaze-y` 제거는 해당 축을 0으로, `motion` 제거는 몸체·얼굴·장비 회전·공통 눈 뜨기를 기본값으로, 좌우 눈은 저장 디자인 가중치로 돌립니다.
- 관계없는 속성 변경은 명령형 API로 바꾼 다른 값이나 다른 애니메이션을 재설정하지 않습니다. 디자인 JSON에는 몸체 방향·활동·일시 정지·마우스 추적·전환 시간·런타임 포즈가 저장되지 않습니다.

```js
bot.setAttribute('shape-duration', '600');
bot.setAttribute('shape', 'heart');
bot.setAttribute('left-smile', '0.8');
await Promise.resolve(); // 같은 작업의 속성 적용 이후

bot.setAttribute('tracking-mode', 'off');
bot.removeAttribute('body-color'); // design의 색 또는 기본 색으로 복원
bot.setAttribute('head-accessory', 'none'); // design에 모자가 있어도 해제
```

## 선언형 행동 (behavior)

`behavior`는 애플리케이션이 원하는 행동을 선언하는 결정론적 API입니다. LLM, 자연어 추론, 네트워크 요청을 사용하지 않습니다. 실제 로딩·저장·검증 상태는 앱이 판단하고, Sidekick은 선언에 맞춰 이동과 기존 활동·표정을 조합합니다. `wait`가 서버 작업을 검사하거나 `review`가 항목 내용을 검증하는 것은 아닙니다.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { BotBehavior, SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const intent: BotBehavior = { type: 'wait', target: '#results' };
bot.behavior = intent;
// 현재 행동을 교체합니다. Promise가 필요하면 perform()을 사용하세요.
const result = await bot.perform({ type: 'celebrate' });
console.log(result.status); // completed, cancelled 또는 error
bot.stopBehavior(); // bot.behavior = null 과 같은 취소
```

| 선언 | 대상·시간 | 동작 |
| --- | --- | --- |
| `{ type: 'wait', target }` | CSS selector 또는 같은 문서의 `Element` | 대상으로 이동해 기다림. 교체·취소까지 지속 |
| `{ type: 'follow', target }` | CSS selector 또는 같은 문서의 `Element` | 대상으로 이동하고 대상의 위치 변경을 따라감. 교체·취소까지 지속 |
| `{ type: 'guide', target }` | CSS selector 또는 같은 문서의 `Element` | 대상으로 이동해 안내하는 동작. 교체·취소까지 지속 |
| `{ type: 'review', targets }` | CSS selector 또는 `readonly Element[]` | 대상 목록을 순서대로 방문. 각 대상에서 `dwell` 기본 1000ms |
| `{ type: 'celebrate' }` | `duration` 기본 1600ms | 축하 동작 후 완료 |
| `{ type: 'error' }` | `duration` 기본 1800ms | 오류를 알리는 동작 후 완료 |
| `{ type: 'idle' }` | 기본 무기한 | 교체·취소까지 대기 동작 |

- `wait`·`follow`·`guide`·`idle`에는 선택적으로 `duration`을 지정해 자동 완료할 수 있습니다. 대상이 있는 행동의 `duration`은 도착 후부터 계산합니다. 모든 시간 단위는 ms입니다.
- 대상이 필요한 행동은 `side: 'right'`(기본) / `'left'` / `'above'` / `'below'`, `gap: 16`(기본 CSS px), `timeout: 5000`(기본 ms)을 받습니다. 이동 속도·가속도는 기존 이동 설정을 사용합니다. 현재 부모 DOM과 `placement`를 유지하며 다른 컨테이너로 옮기지 않습니다.
- selector는 문서에서 찾습니다. `wait`·`follow`·`guide`는 처음 일치하는 연결된 요소를 사용합니다. 아직 없으면 DOM 변경을 기다리고 `timeout` 안에 나타나지 않으면 `error`로 끝납니다. `Element`도 같은 문서에 연결될 때까지 기다립니다. 잘못된 selector는 입력 오류입니다.
- `review`의 selector는 처음 연결된 대상들을 찾았을 때 목록을 한 번 스냅샷합니다. 명시적 `Element[]`는 즉시 스냅샷하고 연결되지 않은 항목을 건너뛰며, 남은 항목이 없으면 바로 완료합니다. selector는 문서 순서, 배열은 전달한 순서입니다. 스냅샷 이후 새로 추가된 항목은 포함하지 않고, 제거된 항목은 건너뜁니다. 목록을 새로 읽으려면 새 `perform()`을 시작하세요.
- `behavior` 프로퍼티와 HTML 선언은 요소를 문서에 추가하기 전에 설정할 수도 있으며 연결 후 시작합니다. 반면 `perform()`은 연결된 요소에서 실행하세요. 연결되지 않은 요소에서는 `status: 'error'` 결과를 돌려줍니다.
- 새 선언은 이전 행동을 `cancelled`로 끝내고 교체합니다. `stopBehavior()`, `behavior = null`, HTML 속성 제거, React prop 제거와 요소 연결 해제도 취소합니다. `perform(declaration, { signal })`에 `AbortSignal`을 전달하면 `abort()`로 취소할 수 있습니다.
- 행동이 관리하는 이동·활동·시선에 새 명령을 내리면 그 행동의 제어를 해제합니다. 예를 들어 직접 `moveTo()` 또는 `motion.to()`를 호출하거나 활동·추적 속성을 바꾸면 행동을 취소하고 새 입력을 적용합니다. 이전 행동의 정리로 새 입력을 덮어쓰지 않습니다.
- 잘못된 선언은 현재 행동을 바꾸기 전에 검증합니다. JavaScript 메서드/프로퍼티 입력은 예외를 던지며, HTML/React 입력 오류는 `sidekick-error` / `onError`로 전달됩니다. 유효한 `perform()`의 Promise는 실제 종료 시 `BehaviorResult`로 해결됩니다. 대상 timeout 등의 런타임 실패는 `status: 'error'`, 교체·취소는 `status: 'cancelled'`입니다. 완료 여부를 확인한 뒤 다음 단계를 시작하세요.
- `bot.behaviorState` 및 `sidekick-behavior-change`의 `detail`은 `{ id, type, status, itemIndex, itemCount, completedItems }`입니다. 상태는 `idle`, `resolving`, `moving`, `acting`, `completed`, `cancelled`, `error`; `itemIndex`는 0부터 시작하며 대상 선택 전에는 -1입니다. 종료 이벤트와 Promise 결과는 `{ id, type, status, reason?, completedItems }`입니다.

### 실제 로딩이 끝날 때까지 기다리기

대상 컨테이너는 요청 전에 DOM에 있어야 합니다. 서버 작업의 완료를 앱에서 기다린 뒤 축하 또는 오류 행동으로 바꿉니다. 요청이 끝나기 전에는 행동에 임의의 완료 시간을 주지 않습니다.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const results = document.querySelector<HTMLElement>('#results')!;

export async function loadResults(): Promise<void> {
  bot.behavior = { type: 'wait', target: results, side: 'left' };
  results.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/results');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    results.textContent = JSON.stringify(data, null, 2);
    await bot.perform({ type: 'celebrate' });
  } catch (error) {
    results.textContent = error instanceof Error ? error.message : String(error);
    await bot.perform({ type: 'error' });
  } finally {
    results.removeAttribute('aria-busy');
  }
}
```

### 항목을 순서대로 검토하기

`review`는 각 항목을 방문하는 시각적 동작입니다. 실제 검사 결과는 별도의 앱 로직으로 처리하세요. 중단되거나 대상이 없으면 축하 동작을 시작하지 않습니다.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const cancel = new AbortController();
const result = await bot.perform({
  type: 'review', targets: '.review-item', side: 'left', gap: 12, dwell: 1000,
}, { signal: cancel.signal });
if (result.status === 'completed') await bot.perform({ type: 'celebrate' });
// 페이지 전환이나 취소 버튼에서는 cancel.abort() 또는 bot.stopBehavior().
```

### React: 앱 상태를 행동에 연결하기

`behavior`는 문자열 속성으로 직렬화하지 않고 요소 업그레이드 후 실제 JavaScript 프로퍼티에 전달합니다. `Element`의 정체성과 배열 순서를 보존하며 같은 내용의 inline 객체를 다시 렌더해도 행동을 다시 시작하지 않습니다. React는 SSR에서 DOM을 조회하거나 행동을 실행하지 않습니다. 서버 렌더에서는 selector를 쓰고, 실제 `Element`는 클라이언트에서 얻은 뒤 전달하세요. 유한 행동을 의도적으로 다시 시작할 때는 ref의 `perform()`을 호출합니다.

```tsx
'use client';
import { useState } from 'react';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';
import type { BotBehavior, BehaviorState } from '@hanana-kick/sidekick/react';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';
export function ResultsCompanion({ status }: { status: RequestStatus }) {
  const [behaviorStatus, setBehaviorStatus] = useState<BehaviorState['status']>('idle');
  const behavior: BotBehavior = status === 'loading'
    ? { type: 'wait', target: '#results', side: 'left' }
    : status === 'success' ? { type: 'celebrate' }
    : status === 'error' ? { type: 'error' }
    : { type: 'idle' };
  return <>
    <section id="results" aria-busy={status === 'loading'}>검색 결과</section>
    <SidekickAvatar behavior={behavior} aria-label="결과 안내 도우미"
      onBehaviorChange={event => setBehaviorStatus(event.detail.status)}
      onBehaviorEnd={event => {
        if (event.detail.status === 'error') console.warn(event.detail.reason);
      }} />
    <output aria-live="polite">{behaviorStatus}</output>
  </>;
}
```

### HTML JSON 선언

HTML의 `behavior`는 JSON이므로 대상은 selector 문자열로 지정합니다. 실제 `Element` / `Element[]`는 JavaScript 프로퍼티 또는 React prop으로만 전달합니다.

```html
<section id="results">결과를 기다리는 중</section>
<sidekick-avatar id="bot"
  behavior='{"type":"wait","target":"#results","side":"left"}'></sidekick-avatar>
```

```js
bot.setAttribute('behavior', JSON.stringify({ type: 'review', targets: '.review-item' }));
bot.removeAttribute('behavior'); // 실행 중인 행동 취소
bot.behavior = null; // JavaScript에서도 명시적으로 취소
```

## 마우스 추적과 드래그

`tracking-mode` / `trackingMode`는 전체 추적 동작을 하나의 값으로 선택합니다. 기본값은 `eyes-and-body`입니다. 속성이나 React prop을 생략해도 눈과 몸이 마우스를 따라봅니다.

- `off`: 마우스를 추적하지 않고 마지막 `lookAt()` 또는 `gaze-x`/`gaze-y`의 명시적 시선으로 돌아갑니다.
- `eyes`: 눈만 마우스를 따라봅니다. 기존 몸체 포즈와 모션은 그대로입니다.
- `eyes-and-body`: 눈과 함께 몸이 작고 부드럽게 돌아봅니다. 몸 회전은 기존 모션 위에 더하는 별도 렌더링 레이어입니다. `pose.rotation`, 모션 진행 시간, 몸체 방향을 변경하지 않습니다.

```ts
import type { TrackingMode } from '@hanana-kick/sidekick/core';
const mode: TrackingMode = 'eyes-and-body';
bot.trackingMode = mode;
// HTML: <sidekick-avatar tracking-mode="eyes-and-body"></sidekick-avatar>
// React: <SidekickAvatar trackingMode="eyes-and-body" />
```

이전 `mouse-tracking` / `mouseTracking`도 지원합니다. 이름 있는 모드가 없을 때 `true`는 `eyes`, `false`는 `off`로 해석합니다. 둘을 함께 쓰면 `tracking-mode`가 항상 우선하며, 해당 속성을 제거하면 남아 있는 `mouse-tracking` 설정이 다시 적용됩니다. 둘 다 없으면 기본 `eyes-and-body`로 돌아갑니다. `bot.mouseTracking = false`는 명시적인 `mouse-tracking="false"`를 남겨 이전처럼 추적을 끕니다. `bot.mouseTracking`을 읽으면 두 추적 모드 모두 `true`입니다. 이름 있는 모드를 사용한 뒤 끄려면 `bot.trackingMode = 'off'`를 사용하세요.

문서 전체의 마우스를 추적하며 터치·펜 입력은 무시합니다. 모드 변경·끄기·창 이탈·포커스 상실 시 현재 위치에서 부드럽게 돌아오고, 숨김·연결 해제 중에는 추적 리스너를 제거합니다. 연결 해제 시 보이지 않는 몸 레이어를 초기화하고 다시 연결되면 새 포인터 입력을 기다립니다. 드래그 중에는 추적 입력을 멈춰 몸체 방향 조작과 경쟁하지 않습니다. 모션 줄이기는 몸 추적을 억제하고 기존 오프셋만 부드럽게 해제합니다. `paused`에서는 몸 추적을 현재 위치에 멈추며 눈 시선은 즉시 반영합니다. 다만 추적을 끄거나 눈만 모드로 바꿀 때는 몸 레이어만 부드럽게 해제하고 활동·기본 포즈의 시간은 멈춘 채 유지합니다.

`interaction`은 별도의 설정입니다.

- `none`(기본): 요소 전체가 클릭을 통과시킵니다. 이 상태에서도 마우스 추적은 켤 수 있습니다.
- `box`: 사각형 전체에서 드래그로 몸체 방향을 돌리고 클릭·Enter·Space로 `sidekick-activate`를 보냅니다. 투명 픽셀도 클릭 영역입니다.

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

왕관은 35개 몸체마다 지지할 정점·봉우리와 착용 기울기를 따로 지정합니다. 베레모처럼 속 빈 입구에 몸체가 들어가지만, 금속 왕관의 메시를 구부리거나 축별로 늘리지 않습니다. 위치·회전·균등 크기만 바꾸고 도형 전환 중에도 같은 강체 형태를 유지합니다. 둥근 몸체와 강체 링이 만나는 일부 지점에는 자연스러운 여백이 남을 수 있습니다.

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

Studio의 JSON 파일과 코드 예제는 현재 디자인에 런타임 설정을 더한 `sceneVersion: 3` envelope를 사용합니다. `design.version: 7`과는 서로 다른 버전입니다. 파일 이름은 `sidekick.scene.json`이며 디자인만 저장한 이전 파일도 가져올 수 있습니다.

```ts
import { createScene, parseScene, serializeScene, migrateScene } from '@hanana-kick/sidekick/core';

const scene = createScene({
  design,
  bodyOrientation: { yaw: 35, pitch: 12 },
  zoom: 1.5,
  trackingMode: 'eyes-and-body',
  activity: 'thinking',
  interaction: 'box',
  shapeDuration: 600,
});
const json = serializeScene(scene);
const checked = parseScene(json);
const { scene: imported, warnings, legacyDesign } = migrateScene(oldOrSceneJson);
```

`createScene()`의 기본 추적 모드는 `eyes-and-body`이며, `design`, `bodyOrientation: {yaw,pitch,roll}`, 독립적인 `zoom`, `activity`, `paused`, `trackingMode`, `interaction`, `renderStyle`, `gaze: {x,y}`, `time`, `motion`, `shapeDuration`, `shapeEasing`, `motionDuration`, `motionEasing`을 기본값과 함께 채웁니다. `parseScene()`은 완전한 `sceneVersion: 3` envelope를 엄격히 검증합니다. 이전 장면 버전과 `camera`/`view` 설정 키는 지원하지 않으며 자동 변환하지 않습니다. 새 키로 다시 작성하거나 Studio에서 초기화하세요. 임의 기하값·알 수 없는 키·잘못된 장비 id 모션·지원하지 않는 버전을 거부합니다. `migrateScene()`은 디자인 전용 파일을 받아 기본 런타임 설정을 붙일 수 있습니다.

Studio 가져오기·초기화는 `resetTracking()`으로 이전 실시간 추적 오프셋을 즉시 지워 새 장면에 남지 않게 합니다. 일반 모드 변경은 위에 설명한 부드러운 복귀를 유지합니다.

장면은 **설정한 목표와 시간 값**을 재현합니다. 재생 중인 정확한 중간 프레임, 자동 깜박임 위상, 실시간 마우스 좌표, 브라우저 배경을 녹화하지 않습니다. 마우스 추적이 켜져 있다면 가져온 페이지의 마우스를 새로 따라갑니다. `motion`은 저장 디자인과 별개인 런타임 목표입니다.

Studio의 ‘JSON 파일 열기’와 텍스트 ‘JSON 적용’은 전체 데이터를 먼저 검증한 뒤 한 번에 적용합니다. 최대 크기는 64KiB(UTF-8)입니다. 실패하면 현재 디자인·몸체 방향·진행 중 애니메이션·로컬 저장을 유지합니다. 여러 파일을 연달아 고르면 마지막 선택만 적용하며 초기화·직접 편집·언마운트는 기다리던 파일 읽기를 취소합니다. 장면 파일은 몸체 방향·추적·활동·일시 정지·시간·포즈 목표도 복원하고, 이전 디자인 파일은 미리보기 설정을 기본값으로 초기화합니다.

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

### 몸체 방향과 포즈

```ts
bot.setBodyOrientation({ yaw: 35, pitch: 12, roll: -5 }); // 도(degree)
bot.setBodyOrientationPreset('three-quarter'); // yaw 45°, pitch/roll 0°
bot.zoom = 1.5;          // 중앙 기준 150% 확대
bot.setBodyOrientationPreset('front'); // 방향만 초기화, 확대 유지
bot.zoom = 1;                       // 확대 별도 초기화
bot.trackingMode = 'off';
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });

// 포즈 회전은 라디안. 아래 예제는 id 'hat' 장비가 있을 때 사용합니다.
await bot.motion.to({
  body: { rotation: [0, 0, 0.2] },
  face: { uv: [0.2, 0.1] },
  eyes: { left: { weights: { smile: 0.5, blink: 0.2 } } },
  accessories: { hat: { rotation: [0, 0.2, 0] } },
}, { duration: 500, easing: 'smooth' });
```

`BodyOrientation`은 `{yaw, pitch, roll}` 각도(도)만 포함합니다. `createBodyOrientation()`은 세 축을 0으로 초기화합니다. `setBodyOrientation()`은 지정한 축만 변경하며 `setBodyOrientationPreset()`은 확대를 유지합니다. `zoom`은 별도의 숫자이며 기본값 1, 허용 범위 0.5~3입니다. `createZoom()`과 `ZOOM_RANGE`도 코어에서 제공합니다. 장면 JSON은 `sceneVersion: 3`의 `bodyOrientation`과 `zoom`을 별도로 저장하며 디자인 JSON에는 두 설정을 넣지 않습니다. 이전 `camera`/`view` API·속성·prop·이벤트 별칭은 제공하지 않습니다.

`interaction="box"` 미리보기에서 한 손가락/마우스 드래그는 회전, 휠·트랙패드(핀치의 Ctrl+wheel 포함)와 두 손가락 핀치는 중앙 기준 확대입니다. 픽셀/줄/페이지 휠 단위를 정규화하고 곱셈 배율로 변경합니다. 핀치 중심점 이동은 패닝을 만들지 않습니다. 설정 패널의 스크롤은 그대로 유지되며, `interaction="none"`에서는 회전·확대를 받지 않습니다. 확대 중에도 도형·몸·눈 애니메이션은 이어지고 커서 추적은 중립으로 돌아갔다가 새 포인터 이동부터 다시 시작합니다.

높은 배율에서는 아바타나 액세서리가 캔버스 경계 밖으로 잘릴 수 있습니다. PNG는 현재 확대된 화면에서 보이는 픽셀만 저장하므로, 전체 모습을 내보내려면 먼저 확대를 초기화하거나 배율을 낮추세요. 확대는 렌더러의 직교 투영에만 적용되어 모델 크기와 종횡비는 바뀌지 않습니다.


몸체 방향은 고정된 화면 안에서 캐릭터 몸체가 향하는 방향입니다. `front`는 yaw 0°, `three-quarter`는 45°, `side`는 90°이며 각 프리셋의 pitch·roll은 0°입니다. 양의 yaw는 정면을 화면 오른쪽으로, 양의 pitch는 아래로, 양의 roll은 화면 반시계 방향으로 돌립니다. 몸체 방향 값은 저장된 디자인과 기본 포즈를 바꾸지 않습니다.

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
| `resetTracking()` | 실시간 포인터 시선·몸 오프셋을 즉시 초기화하고 마지막 수동 시선을 복원. 모드·기본 포즈·몸체 방향은 유지 |
| `trackingMode`, `mouseTracking`, `paused`, `interaction`, `renderStyle` | 해당 동작 읽기/설정 |
| `lookAt({space:'view',x,y})` | -1~1 범위의 명시적 시선 |
| `bodyOrientation`, `setBodyOrientation(patch)` | `BodyOrientation` 읽기/부분 설정. 각도는 도. getter는 복사본 |
| `setBodyOrientationPreset(name)` | 정면·사선·측면 방향 프리셋, 확대 유지 |
| `zoom` | 독립적인 확대 배율 읽기/설정. 0.5~3, 기본 1 |
| `motion.to(target,options)`, `motion.cancel()` | 포즈 전환/모든 포즈 채널 취소 |
| `seek(seconds)` | 반복 애니메이션 시간 0~86400초 지정 |
| `pose` | 최근 렌더링 엔진이 확인한 포즈 복사본, 읽기 전용. worker 모드에서는 비동기 갱신 |
| `snapshot({crop,padding}?)` | 렌더 준비 후 투명 PNG `Promise<Blob>`. 기본은 알파 경계로 자르기 |
| `capturePixels()` | 최근 화면에 표시된 전체 캔버스의 동기 읽기. worker에 보낸 최신 명령까지 기다리지 않음 |
| `capturePixelsAsync()` | 최신 명령 이후의 새 프레임을 기다리는 `Promise<{width,height,pixels}>`. 아래 행부터 RGBA |
| `ready`, `diagnostics` | 준비 여부, `worker`/`main` backend, 세대·명령 확인 번호, 애니메이션 시간, 프레임·draw call·버퍼 수 |

## OffscreenCanvas와 렌더링

지원하는 브라우저에서는 요소의 canvas를 `transferControlToOffscreen()`으로 전용 Web Worker에 넘깁니다. 메시·모션/도형 전환·시선 추적 spring·WebGL 렌더링은 worker에서 처리합니다. 메인 스레드는 DOM, 접근성, 입력, 크기 관찰과 명령 전달을 담당합니다. `bot.diagnostics.backend`로 실제 `worker` 또는 `main` 실행 경로를 확인할 수 있습니다.

같은 origin에서 자체 호스팅할 때는 worker 파일을 올바른 JavaScript MIME으로 제공하세요. 브라우저 보안 정책상 다른 origin의 Worker URL을 그대로 사용할 수 없습니다. CSP는 `worker-src 'self'` 등으로 해당 worker를 허용해야 합니다. 이 같은-origin 구성에는 Blob worker나 별도 보안 헤더가 필요하지 않습니다. 다른 origin의 CDN 사용은 앞서 설명한 Blob module worker 방식을 사용합니다. 지원 부족, CSP/파일 로딩 실패 또는 worker 초기화 실패 시 새 canvas로 교체하고 메인 스레드 렌더러로 복구합니다.

디자인·몸체 방향 설정과 입력 검증은 즉시 반영되지만, worker의 포즈/픽셀은 비동기로 도착합니다. 명령 직후 정확한 화면이 필요하면 `await bot.capturePixelsAsync()` 또는 `await bot.snapshot()`을 사용하세요. PNG 내보내기는 새 렌더 프레임을 기다립니다. 연결 해제는 worker, GPU 리소스와 입력 리스너를 정리하며, 다시 연결하면 새 렌더링 세대를 시작합니다.

브라우저 계약은 [OffscreenCanvas 전송](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen)과 [CSP worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src)를 참고하세요. 이미 전송했거나 컨텍스트를 만든 canvas는 다시 전송할 수 없어 복구 시 내부 canvas를 교체합니다. 호스트 요소와 React ref는 유지됩니다.


## 이벤트와 정리

이벤트는 `CustomEvent`이며 Shadow DOM 경계를 넘어 버블링합니다. React 래퍼도 같은 이벤트 객체를 콜백으로 전달합니다.

| DOM 이벤트 | React 콜백 | `detail` |
| --- | --- | --- |
| `sidekick-behavior-change` | `onBehaviorChange` | `BehaviorState`: id, type, status, itemIndex, itemCount, completedItems |
| `sidekick-behavior-end` | `onBehaviorEnd` | `BehaviorResult`: id, type, status, reason?, completedItems |
| `sidekick-ready` | `onReady` | `{}` |
| `sidekick-error` | `onError` | `{ message, ... }`; 복구 가능한 컨텍스트 손실에는 `recoverable: true` |
| `sidekick-design-change` | `onDesignChange` | `{ design }` |
| `sidekick-body-orientation-change` | `onBodyOrientationChange` | `{ bodyOrientation }` |
| `sidekick-zoom-change` | `onZoomChange` | `{ zoom }` |
| `sidekick-motion-end` | `onMotionEnd` | `{ finished }` |
| `sidekick-shape-end` | `onShapeEnd` | `{ finished }` |
| `sidekick-activate` | `onActivate` | `{}` |
| `sidekick-move-progress` | `onMoveProgress` | `MovementState`: phase, progress, position, velocity, acceleration, speed |
| `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| `sidekick-play-end` | `onPlayEnd` | `{ finished }` |
| `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }` |

PNG의 기본 `crop: true`, `padding: 0`은 현재 캐릭터의 불투명/반투명 픽셀 전체 경계로 자릅니다. 장비도 포함하고 배경은 투명하게 유지합니다. `padding`은 0~4096의 정수 픽셀이며, 원래 캔버스 크기가 필요하면 `snapshot({ crop: false })`를 사용하세요. 완전히 비어 있으면 투명 1×1px(여백 별도)을 반환합니다. 정확한 최신 픽셀은 `await capturePixelsAsync()`로 읽습니다. 동기 `capturePixels()`는 worker 모드에서 최근 표시 프레임만 읽습니다. 두 메서드 모두 전체 캔버스 크기를 유지하며 `/core`의 `alphaBounds()`·`cropPixels()`도 사용할 수 있습니다.

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
- 애니메이션: 활동·일시 정지, 마우스 추적 꺼짐/눈만/눈과 몸, 명시적 시선, 도형 전환 시간·easing, 좌우 웃음·감기 가중치
- 몸체 방향: yaw·pitch·roll, 정면·사선·측면 프리셋, 미리보기 드래그와 양방향 동기화
- JSON: 파일/텍스트 가져오기·내보내기, 현재 설정이 반영되는 HTML/React 코드와 복사 버튼, 알파 경계에 맞춘 투명 PNG 저장

데스크톱은 미리보기와 설정을 나란히 배치합니다. 모바일 세로 화면은 미리보기를 고정하고 아래 설정만 스크롤하며 짧은 가로 화면은 나란히 배치합니다. `100dvh`와 safe-area를 사용합니다. 탭·슬라이더·토글은 shadcn/Radix의 키보드 동작을 유지합니다. 글꼴은 로컬 번들에 포함합니다. 미리보기의 체크무늬·밝은색·어두운색은 DOM 배경이며 PNG에 포함하지 않습니다.

자동 저장은 전체 장면을 이 브라우저의 `sidekick.studio.scene.v3`에 저장합니다. 디자인뿐 아니라 몸체 방향·확대·시선·활동·추적·시간·상호작용·포즈·일시 정지와 전환 설정을 포함하며, 호스트 페이지 배치·이동 좌표·실행 중인 행동은 저장하지 않습니다. 파일 내보내기도 장면 envelope를 사용합니다. 이전 `sidekick.design.v7` 디자인 저장값도 대체 입력으로 읽으며, v7이 없으면 v6→v1 순서로 읽고 변환하되 원본 키는 보존합니다. 잘못된 원본은 JSON 탭에 열고, 첫 편집 시 `.recovery` 백업이 성공해야 새 데이터를 저장합니다. 저장소가 막혔다면 JSON 내보내기를 사용하세요. 초기화하면 기본 square+베레모, 정면 몸체 방향, 눈과 몸 마우스 추적으로 돌아갑니다. API playground와 가이드의 실험 명령은 Studio 저장 장면을 덮어쓰지 않습니다.

UI 구성은 `components.json`과 `playground/components/ui/`, 저장·명령·복구는 `studio-controller.ts`에 있습니다. React 재렌더와 탭 전환은 하나의 안정된 요소를 유지하며 진행 중 모프나 몸체 방향을 재설정하지 않습니다. [공식 shadcn/ui Vite 설치](https://ui.shadcn.com/docs/installation/vite) 방식으로 생성한 실제 소스를 사용합니다.

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

### 성능 확인과 운영

- 정지한 장면은 변경이 없으면 프레임을 그리지 않습니다. 화면 밖·숨겨진 문서의 애니메이션은 중단하고, 연결 해제 시 worker와 GPU 버퍼를 정리합니다.
- 별도 모션이나 시선 이동이 없는 `idle` 호흡은 최대 초당 30번 그립니다. 애니메이션 시계는 계속 진행하며, 자동 눈 깜빡임·도형 전환·명시적 모션·추적 움직임에는 이 제한을 적용하지 않습니다. 설정 변경과 PNG/픽셀 캡처는 즉시 새 프레임을 요청합니다.
- 입력과 크기 변경은 프레임 단위로 합칩니다. 색·시선·몸체 방향 변경은 기존 메시를 재사용하며, 몸체 변경 시 중복 정점 업로드를 제거했습니다.
- 복잡한 모프와 여러 장비를 동시에 쓰면 worker에서도 CPU 비용이 발생합니다. 작은 기기에서는 필요한 요소만 연결하고, 정적인 표시에는 `activity="still"`을 사용하세요. `paused`는 애니메이션을 즉시 마무리하는 별도 동작입니다.
- `diagnostics.renderCpu`는 실제 렌더 호출의 CPU 시간이고 GPU 완료 시간이나 FPS가 아닙니다. `backend`, `running`, `frames`, `buffers`로 실행 위치와 정지·해제 상태를 확인할 수 있습니다.
- 개발 벤치마크: `node --expose-gc scripts/profile-renderer.mjs artifacts/cpu.json`. 별도 임시 폴더에 ES2022 JavaScript를 생성해 실제 기하 계산의 CPU 시간과 버퍼 업로드·할당량을 측정합니다. GPU 명령은 계수용 대역이므로 GPU 시간이나 브라우저 FPS를 뜻하지 않습니다. 실제 Chromium의 worker/메인 경로, 6배 CPU 제한, 1/2/4개 인스턴스, 넓은 화면·DPR 검사는 `npm run test:browser`에 포함됩니다. CI의 SwiftShader/CPU 제한 결과는 실제 초저사양 기기의 FPS 보장이 아닙니다.

## 도형·렌더링 범위와 라이선스

`MATERIAL_SHAPE_NAMES`, `MATERIAL_SHAPE_LABELS`, `MaterialShapeName`을 사용해 선택 UI를 만들 수 있습니다.

- 기하학: `circle`, `square`, `slanted`, `arch`, `fan`, `arrow`, `semiCircle`, `oval`, `pill`, `triangle`, `diamond`, `clamShell`, `pentagon`, `gem`
- 별·햇살·쿠키: `verySunny`, `sunny`, `cookie4Sided`, `cookie6Sided`, `cookie7Sided`, `cookie9Sided`, `cookie12Sided`, `burst`, `softBurst`, `boom`, `softBoom`
- 유기형·기타: `ghostish`, `clover4Leaf`, `clover8Leaf`, `flower`, `puffy`, `puffyDiamond`, `pixelCircle`, `pixelTriangle`, `bun`, `heart`

`star`는 API 이름이 아닙니다. 공식 곡선 데이터의 종횡비·오목한 부분·코너·스무딩·회전·반복을 보존합니다. 몸체는 카탈로그 XY 윤곽을 유지하면서 앞뒤로 둥글게 이어지는 입체입니다. Flat은 무조명 단색 표현을 뜻하며 평평한 기하를 뜻하지 않습니다. 실제 몸체 방향 회전·깊이 가림과 투명 알파 채널을 사용합니다.

눈은 별도 돌출 메시가 아니라 몸체 곡면 셰이더의 캡슐/곡선 색상 마스크입니다. 기울임에 따라 투영되며 몸체 밖·뒷면·가려진 부분에 그리지 않습니다. 정확한 측면에도 둥근 앞면의 가까운 눈 일부가 보일 수 있습니다. 눈 비율·간격·위치는 내부 기본값이고 도형과 함께 보간합니다. 표정은 몸체 실루엣·알파 커버리지를 바꾸지 않습니다. 얼굴 이동과 시선은 독립적이며 안경 같은 얼굴 장비는 얼굴 이동만 따라갑니다.

액세서리는 도형별 내부 장착 규칙을 사용합니다. 안경 앞면은 하나의 평면 강체이며, 베레모는 몸체 위쪽의 실제 단면을 감싸는 입구와 커프로 착용하며, 상단 일부가 불투명한 모자 안으로 들어갑니다. 하트는 한쪽 넓은 로브를 감쌉니다. 왕관의 하단 밴드는 몸체의 지지 면에 맞춥니다. 목도리는 몸체 아래쪽을 앞·옆·뒤로 한 바퀴 감싸는 닫힌 천 띠와, 매듭에 연결되어 아래로 처지는 두 끝으로 구성합니다. 목도리의 넓은 천 띠는 높이별 몸체 단면을 따릅니다. 도형 전환 중에도 장비를 숨기지 않습니다. 공개 액세서리 회전 모션은 유지하며, 베레모는 현재 회전한 착용 좌표에서 입구와 지지 부위를 다시 맞춥니다. 몸체 회전·호흡은 함께 따르며, 이미 맞춘 베레모를 몸체와 별도로 뒤늦게 회전시키던 관성 흔들림은 적용하지 않습니다. 도형별 영역에 맞추는 모델링이며 실시간 천 물리 시뮬레이션은 아닙니다. 몸체 메시와 표면 질의는 같은 볼륨 함수 `h = sqrt(d / (d + 0.65 × r²))`, 앞뒤 높이 `±depth × h / 2`를 사용합니다. XY 윤곽에서 높이는 0이고 중심에서는 전체 깊이가 `depth`입니다. 이는 Sidekick의 볼륨 모델이며 AndroidX의 3D 모델 재현이 아닙니다.

곡선→폴리라인 허용오차는 정규화 `[-1,1]` 기준 `0.00005`입니다. 메시 세분화 목표(표면 거리 `0.010`, 중앙 높이 `0.006`)는 샘플 기준이며 모든 위치·픽셀의 오차 보장이 아닙니다. 최대 8회 분할·앞면 12,000점 예산을 사용하므로 작은 삼각형 근사 오차가 보일 수 있습니다. 도형 모프의 대응점 계산은 Sidekick 방식이며 Android Material `Morph`와 픽셀 일치를 보장하지 않습니다.

요소마다 WebGL 컨텍스트 하나와 재사용 버퍼를 사용합니다. 기본 몸체+베레모는 3 draw call이고 눈은 추가 draw call이 없습니다. DPR은 최대 2이며 긴 축이 2048px를 넘으면 두 축에 동일한 배율을 적용합니다. 넓거나 높은 호스트에서도 캐릭터 비율을 유지합니다. CPU 기하 벤치마크는 GPU 프레임 시간/FPS 보장이 아닙니다. 임의 SVG·사용자 정의 메시·파츠 플러그인·옷감 물리·픽셀 히트 테스트·컨텍스트 풀·AI 서비스 연결은 지원 범위 밖입니다.

이 저장소의 패키지 라이선스는 `UNLICENSED`입니다. 공개 오픈소스 라이선스를 부여한다는 뜻이 아니며 사용·배포 권한은 저장소 소유자에게 확인하세요. 다음 제3자 고지는 따로 유지합니다.

- Material 윤곽: 고정된 [AndroidX MaterialShapes 소스](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt), `graphics-shapes-android:1.1.0`으로 계산. Apache 2.0 고지/출처는 [`third_party/material-shapes/`](third_party/material-shapes/). 재생성은 `scripts/generate-material-shapes.mjs`이며 이 작업에만 Java 21+·unzip·네트워크가 필요합니다.
- Studio shadcn/ui 소스: [`playground/components/ui/LICENSE.md`](playground/components/ui/LICENSE.md). 정적 Studio 빌드에도 해당 고지를 포함합니다.

### 이번 버전과 진행 중인 개선

0.2.2는 앞·옆·뒤로 이어지는 목도리 둘레와 자유롭게 처지는 끝을 추가합니다. 몸체 메시 계산의 중복 할당·질의를 줄였으며, 322개 메시와 12개 네이티브 렌더에서 기존 결과와 바이트가 같음을 확인했습니다. 분리된 CPU ABBA 검사에서는 총 몸체 계산 시간이 약7.9% 줄었지만 지연 시간의 꼬리 구간은 일관되게 개선되지 않았습니다. 브라우저 FPS나 모든 기기의 성능 보장은 아닙니다. OffscreenCanvas, 시선 추적 모드, 비율 보정, 휠·핀치 확대/축소와 기본 색 `#FFCC37`은 유지합니다.

0.2.4은 도형별로 작고 비스듬한 베레모 착용 위치를 사용합니다. 하트는 한쪽 봉우리에, 뾰족한 몸체는 안쪽 지지점에 걸쳐 비대칭으로 처지도록 구성합니다. 접힌 테두리와 크라운은 연속적으로 연결하며, 목도리는 몸체 높이별 단면을 감싸는 넓은 천과 비틀려 흘러내리는 여분으로 구성합니다. 도형 전환 중에도 액세서리를 숨기지 않습니다. 복잡한 돌출부가 바뀌는 일부 중간 프레임에서는 몸체가 목도리 띠 일부를 가릴 수 있습니다. 베레모는 하트의 적절한 크기를 기준으로 테두리와 크라운을 국소적으로 변형합니다. 몸 전체를 덮도록 크게 늘리지 않으며, 목도리는 도형에 맞는 아래쪽 지지 부위를 감싸고 여분이 내려오도록 배치합니다. 피팅 결과는 캐시하며 도형과 몸체 상태가 바뀌면 갱신합니다. 이 캐시는 임의 도형 전환의 계산 비용이나 저사양 GPU의 FPS를 보장하지 않습니다.

0.2.5는 베레모 안쪽에 두께가 있는 안감을 추가하고 입구 테두리를 연결합니다. 낮은 시점의 틈을 줄이고 머리가 들어가는 입구를 유지했지만, 이후 일부 도형·애니메이션에서 안감 교차와 착용 위치의 불연속이 확인되어 0.2.6에서 구조를 다시 구성했습니다. 아치·사각형·꽃 등 일부 도형의 노출된 커프 접합도 보정합니다. 목도리 형상은 0.2.4와 같습니다. 극단적인 시선 입력에서는 두 눈을 하나의 쌍으로 이동시켜 한쪽만 멈추며 간격이 무너지는 현상을 수정합니다.


베레모의 각도·애니메이션 재현 검사는 [`scripts/beret-qa/`](scripts/beret-qa/README.md)에 있습니다. 실제 렌더러의 정점 셰이더·행렬을 사용하는 GLES 진단과, 삼각형 자기 교차·몸체 관통·법선·입구 구조 검사를 함께 사용합니다. 각도 격자와 시간 샘플의 범위는 검사 문서에 명시하며, 유한한 검사를 모든 연속 각도·임의 입력에 대한 보장으로 해석하지 않습니다.

0.2.6은 베레모 안감·입구·커프·크라운을 연결된 두께 구조로 구성하고, 빈 안쪽 공간에 도형의 지지 부위가 들어가도록 배치합니다. 하트는 봉우리를 감싸고, 꽃처럼 양쪽 입구를 맞추기 어려운 경우에는 지지점에서 천이 자연스럽게 처지도록 조정합니다. 도형별 위치·기울기·천의 변형 한도를 보간하며, 호흡에는 몸체와 같은 변형을 적용합니다. 전환 중에는 자유로운 끝부분의 말림을 잠시 완화하고, 실제 삼각형의 관통 여부를 별도로 검사합니다. 일부 중간 프레임에서는 입구가 벌어지거나 착용 깊이가 빠르게 회복될 수 있습니다. 유한한 각도·시간 검사 결과와 남아 있는 작은 피팅 변화는 검사 보고서에 명시합니다. 목도리와 시선 추적 동작은 유지합니다.

### Studio 장면 편집기와 소셜 카드

**장면** 탭에서는 실제 캐릭터와 편집 가능한 텍스트를 고정 크기 캔버스에 배치합니다. **캐릭터 / 장면** 미리보기를 전환해도 캐릭터 요소는 유지되며, 외형·몸체 방향·확대 설정이 장면에 계속 반영됩니다. 장면 미리보기는 정지 프레임이며 **새 프레임**으로 현재 애니메이션 프레임을 캡처합니다.

- 캔버스 프리셋: OG 1200 × 630, 정사각형 1080 × 1080, 와이드 1920 × 1080. 사용자 지정 크기는 각 320–4096의 정수이며 최대 8백만 픽셀입니다.
- 배경색, 캐릭터 중심 X/Y와 높이, 여러 줄 텍스트와 위치, 글자 크기·글꼴·색상을 설정합니다. 미리보기에서 캐릭터나 텍스트를 직접 드래그하며 슬라이더로 정밀 조정할 수도 있습니다.
- **Sidekick OG 프리셋 적용**은 현재 캐릭터를 안경·베레모·보타이를 착용한 웃는 노란 Ghostish로 명시적으로 교체하며 흰 배경과 “Sidekick” 텍스트를 배치합니다.
- **장면 PNG 저장**은 선택한 크기의 전체 캔버스를 내보냅니다. 헤더의 기존 **PNG 저장**은 투명 캐릭터만 알파 경계에 맞춰 잘라 저장합니다.
- **장면 JSON 저장 / 열기**는 `{ compositionVersion: 1, composition, avatar }`를 내보내고 복원합니다. 중첩된 `avatar`는 기존 `SidekickScene`입니다. 이전 캐릭터 장면·디자인 JSON도 기본 장면 배치로 열 수 있습니다. 기존 캐릭터 JSON/API 내보내기는 유지됩니다.
- 배치 위치는 캔버스의 백분율입니다. `characterHeight`는 잘린 캐릭터 높이를 캔버스 높이에 대한 백분율로 표시합니다. 텍스트 X는 왼쪽 끝, Y는 여러 줄 블록의 중심입니다. 캔버스 밖 콘텐츠는 내보내기에서 잘립니다.
- 장면 PNG 저장은 별도의 임시 2048 × 2048 실제 렌더러를 만들어 저장된 장면 시간으로 캐릭터를 캡처한 뒤 해제합니다. 저해상도 미리보기를 확대하거나 활성 캐릭터 캔버스 크기를 바꾸지 않습니다. 일반 렌더러의 2048픽셀 한도는 유지되므로 매우 큰 장면은 결과 이미지를 확대할 수 있습니다. 일관된 내보내기를 위해 실시간 포인터 반응은 제외합니다. 공개 OG 이미지는 별도로 관리합니다.

HTML 진입 페이지에는 대표 URL `https://sidekick.hananakick.cc/`와 버전이 붙은 절대 이미지 URL을 사용하는 정적 Open Graph·Twitter 카드 태그가 있습니다. `public/og-sidekick.png`(1200 × 630)는 소유자가 선택한 원본 그대로이며 이후 캐릭터 기하 변경과 독립적으로 보존합니다. 빌드와 `node scripts/generate-og-image.mjs`는 이 파일을 덮어쓰지 않습니다. 이 개발용 스크립트는 실제 프로덕션 렌더러로 `public/og-avatar.png`만 갱신하며 C 컴파일러·EGL/GLES·Pillow/fontTools가 필요합니다. 선택적 `SIDEKICK_RENDERER_ROOT`로 소스 워크트리를 지정할 수 있습니다. Studio의 편집 가능한 장면 프리셋은 별도의 시작점이며 선택된 정적 OG 이미지를 재구성하는 기능이 아닙니다.

## 렌더링·이동 표준 (v0.3)

기본은 **캐릭터 크기의 투명 캔버스 + DOM 엘리먼트 이동**입니다. 전체 화면을 덮는 WebGL 캔버스는 만들지 않습니다. OffscreenCanvas 워커가 작은 표면을 렌더링하고, 메인 스레드는 CSS `translate`로 엘리먼트를 이동합니다. DOM 이동 때문에 WebGL 해상도·몸체 방향 설정·저장된 몸체 디자인을 바꾸지 않습니다. 기본 비행 동작은 작은 캔버스 안의 런타임 포즈로 합성합니다. 화면 크기·DPR 변화에는 기존 ResizeObserver/해상도 제한을 그대로 적용합니다.

[이동·애니메이션 API 체험](https://sidekick.hananakick.cc/api-playground.html)에서 이동/중단/재생/에셋 전환을 직접 시험할 수 있습니다.

- `placement="inline"` 기본: 문서 흐름을 유지합니다. x/y는 원래 배치 위치에서의 상대 이동량입니다. 다른 콘텐츠의 레이아웃은 밀지 않습니다. viewport bounds는 이 모드에서 적용하지 않습니다.
- `placement="viewport"`: `position: fixed`, x/y는 레이아웃 뷰포트 좌상단 기준 CSS 픽셀입니다. 앵커는 **캔버스 박스의 좌상단**이며 캐릭터의 발이나 중심이 아닙니다. 스크롤해도 같은 화면 위치를 유지합니다.
- 기본 `movement-bounds="viewport"`: 전체 엘리먼트 박스를 화면 안에 제한합니다. 박스가 화면보다 크면 좌상단 0에 고정됩니다. `none`으로 화면 밖 이동을 허용합니다. 몸체 방향 확대 때문에 캔버스 자체에서 잘린 장식은 이동 bounds가 복원하지 않습니다.
- viewport/엘리먼트 크기가 바뀌면 현재 위치와 남은 목표를 다시 제한합니다. `position`은 실제 제한된 좌표를 반환하며 입력 attribute는 요청 좌표를 유지합니다.
- viewport 엘리먼트는 `body` 바로 아래 또는 변형 없는 overlay 컨테이너에 두세요. CSS `transform`, `filter`, `perspective`, 특정 `contain`을 가진 조상은 fixed 기준을 바꿀 수 있습니다. 라이브러리는 React 소유 DOM을 몰래 다른 부모로 옮기지 않습니다.
- API가 CSS 개별 속성 `translate`를 소유합니다. 사용자 `style.transform`은 덮어쓰지 않지만, 회전/확대/사용자 translate를 함께 적용하면 bounds는 그 시각적 변형까지 계산하지 않습니다. 사용자 변형이 필요하면 별도 래퍼에서 관리하세요.
- `interaction="none"` 기본은 클릭/스크롤/터치 통과입니다. 글로벌 시선 추적은 계속 사용할 수 있습니다. `box`를 선택하면 **작은 캔버스 박스 안에서만** 드래그·줌을 받습니다. 투명 픽셀만 골라 클릭 통과시키는 알파 히트 테스트는 제공하지 않습니다.
- 캐릭터 장면 JSON에는 호스트 페이지의 배치/이동 좌표를 넣지 않습니다. `position`을 앱의 레이아웃 상태로 별도 보관하세요. 명시적인 저장 색상은 보존되며 새 캐릭터의 기본 몸체 색상은 `#FFCC37`입니다.

### 선언형 HTML / React 배치

| HTML attribute | React prop | 의미 / 기본값 |
| --- | --- | --- |
| `placement` | `placement` | `inline` 기본 / `viewport` 고정 오버레이 |
| `position-x` | `positionX` | CSS px x 좌표, 기본 `0` |
| `position-y` | `positionY` | CSS px y 좌표, 기본 `0` |
| `movement-bounds` | `movementBounds` | `viewport` 기본 / `none`; inline에서는 미적용 |
| `move-duration` | `moveDuration` | 0–60000ms, 기본 `0` (즉시). natural에서는 양수 값 무시, none에서는 정확한 이동 시간 |
| `move-easing` | `moveEasing` | `smooth` 기본 / `linear`; `none`에만 적용 |
| `move-travel` | `moveTravel` | `natural` 기본: 관성 기반 가속·비행·감속 / `none`: 시간 기반 DOM 보간 |
| `move-max-speed` | `moveMaxSpeed` | natural의 최고 속도, CSS px/s, 1–100000. 생략 시 고정 1350 |
| `move-acceleration` | `moveAcceleration` | natural의 가속 한도, CSS px/s², 1–100000. 기본 `1800` |
| `move-deceleration` | `moveDeceleration` | natural의 감속 한도, CSS px/s², 1–100000. 기본 `2200` |
| 이벤트 `sidekick-move-progress` | `onMoveProgress` | `MovementState`: `{ phase, progress, position, velocity, acceleration, speed }` |
| 이벤트 `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| 이벤트 `sidekick-play-end` | `onPlayEnd` | `{ finished }` 재생 구간 완료/취소 |
| 이벤트 `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }` 도형·표정·장식 묶음 전환 완료/취소 |

`position-x/y`를 함께 변경하면 한 attribute transaction으로 처리합니다. 직접 메서드 호출은 `MoveOptions`를 사용하며 기본 duration은 400ms, travel은 natural입니다. `move-*` attribute/React prop은 선언형 좌표 변경에만 적용됩니다. 초기 배치를 즉시 하려면 move-duration을 생략하세요. 고정 기본 최고 속도의 선언형 자연 비행은 `move-duration="1000" move-travel="natural"`을 사용합니다. React는 `moveDuration={1000} moveTravel="natural"`입니다. move-max-speed/moveMaxSpeed를 생략하면 고정 1350 CSS px/s를 사용하고, 지정하면 그 상한을 사용합니다. 양수 move-duration은 자연 비행의 속도나 시간에 영향을 주지 않습니다. 가속도·감속도 기본값은 거리에 따라 바뀌지 않습니다. 최고 속도가 있어도 duration이 0이면 즉시 적용됩니다.

### 메서드와 실제 완료의 의미

| 메서드 | 의미 |
| --- | --- |
| `moveTo({ x, y }, options?: MoveOptions)` | 현재 화면 좌표부터 이동. `Promise<MoveResult>` |
| `moveToElement(target, options?: MoveToElementOptions)` | 대상 엘리먼트와 같은 정렬점을 맞추고 X/Y 오프셋 적용. `anchor: true`이면 지속 연결 |
| `elementAnchor` | 현재 `{ target, x, y, alignX, alignY }` 읽기 전용 스냅샷 또는 `null` |
| `detachAnchor()` | 지속 연결 해제. 진행 중인 최초 이동은 계속되며, 최초 도착 이후 추격은 현재 관성으로 감속해 멈춤 |
| `moveBy({ x, y }, options?)` | 현재 진행 중인 좌표 기준 상대 이동 |
| `cancelMove()` | 자연 비행은 현재 속도에서 감속한 뒤 포즈를 180ms 정리하고 `finished: false`. none은 위치 이동을 즉시 중단 |
| `position` | 실제 DOM 좌표 `{ x, y }`의 복사본, 읽기 전용 |
| `movementState` | phase·progress·position·velocity·acceleration·speed의 복사본, 읽기 전용 |
| `play(activity, { duration? })` | 활동 루프 재생. duration은 루프 한 주기가 아닌 **재생 구간의 벽시계 ms** |
| `stop()` | 재생 구간 취소 후 idle로 200ms 부드럽게 전환 |
| `transitionTo({ shape?, expression?, accessories? }, options?)` | 도형/양쪽 눈 표정/전체 장식 목록을 함께 전환 |
| `cancelTransition()` | 진행 중인 묶음 전환 중지. 완료 결과 `finished: false` |

모든 timing easing은 `linear` 또는 `smooth`, duration은 0–60000ms입니다. `play`는 timing easing을 받지 않습니다. activity 값은 `idle`, `thinking`, `listening`, `speaking`, `celebrating`, `still`입니다.

자연 비행을 다시 요청하면 현재 좌표·속도·비행 포즈를 유지한 채 새 목표로 가속합니다. 반대편을 누르면 먼저 제동하고 방향을 돌리므로 순간적으로 속도가 뒤집히지 않습니다. `travel: 'none'`으로 바꾸면 시간 기반 보간으로 전환하며 속도를 이어받지 않습니다. 이전 Promise와 `sidekick-move-end`는 착륙을 기다리지 않고 한 번만 `finished: false`로 종료합니다. 새 이동의 완료는 새 Promise로 확인하세요. `sidekick-move-end`에는 대체된 이전 요청의 취소도 포함되므로 현재 진행 단계는 `movementState`로 확인하세요. 연결 해제 시 RAF·타이머·fade·비행 포즈를 즉시 정리하고 대기 중인 이동/재생/묶음 전환을 취소합니다.

`cancelMove()`는 이동만 중단하고 `stop()`은 활동 재생만 중단합니다. 둘을 함께 멈추려면 둘 다 호출하세요. 이동 중 `play()`·`setActivity()`·표정 전환을 사용해도 이동 경로를 재시작하지 않습니다.

`play(activity)`처럼 duration을 생략하면 `stop`, 다음 play/setActivity 또는 연결 해제 때까지 루프를 유지하며 Promise는 그때 `finished: false`로 종료합니다. 유한 duration이 끝나면 `finished: true`로 재생 구간을 완료하고, 이어서 idle로 200ms 블렌드합니다. 이 Promise는 idle 블렌드 종료까지 기다리는 신호가 아닙니다. 활동 변경도 마지막 표시된 활동 포즈에서 200ms 블렌드하며, 시작 시 자동 활동에는 새 효과를 추가하지 않습니다.

도형은 기존 윤곽 모프, 표정은 기존 shape-key 전환을 사용하며 `transitionTo`는 워커의 실제 완료 응답을 기다립니다. `accessories`는 **전체 장식 목록**이므로 유지할 장식도 포함하세요. 같은 슬롯 중복은 변경 전에 거부합니다. 서로 다른 장식의 메시를 억지로 보간하지 않고 **캐릭터 캔버스를 fade-out → 장식 교체 → 새 프레임 렌더 확인 → fade-in**합니다. 두 fade의 합이 duration이며 다른 도형/표정 채널과 동시에 진행합니다. 페이지·형제 DOM·텍스트는 사라지지 않습니다. snapshot PNG는 이 CSS fade를 포함하지 않고 실제 캐릭터 픽셀을 저장합니다.

취소가 장식 교체 중간 이전이면 이전 장식을 유지하고, 교체 이후면 새 장식을 유지합니다. 취소한 fade는 제거하여 캐릭터가 투명한 채 남지 않습니다. 취소된 도형은 현재 윤곽에서 멈추지만 design에는 요청했던 목표가 남습니다. 최신 shape/expression/equipment setter나 attribute 변경은 해당 묶음 전환을 취소합니다. 색상만 바꿀 때는 `updateDesign`을 사용하세요(진행 중인 묶음 전환은 취소됩니다).

`paused` 또는 OS 모션 줄이기는 이동 목표/윤곽/표정/fade를 즉시 적용하고 비행 포즈를 0으로 정리합니다. 이 경우 이륙·착륙·취소 후 180ms 정리를 기다리지 않습니다. 활동 재생 구간은 벽시계 시간이므로 일시 정지해도 경과합니다. 백그라운드 탭은 브라우저가 RAF/타이머를 지연시킬 수 있습니다. 자연 비행은 고정 1/240초 간격으로 적분하고, 탭 복귀 시 한 프레임의 따라잡기를 최대 100ms로 제한합니다. 오래 숨겨진 시간만큼 순간 이동하지 않으며 실제 완료까지 더 오래 걸릴 수 있습니다. `travel: 'none'`과 활동 재생 구간은 벽시계 시간 기준입니다. 화면 밖에서 렌더가 중지된 윤곽 모프의 Promise는 실제 재개/완료 또는 취소를 기다립니다. 미연결 상태의 move/transition은 설정을 즉시 적용하고, play는 `finished: false`를 반환합니다.

### 자연스러운 방향성 비행과 실제 가속도

`moveTo()`·`moveBy()`는 기본적으로 `travel: 'natural'`을 사용합니다. DOM 좌표가 실제 속도·가속도 적분으로 움직이며, 몸의 기울기만으로 가속을 흉내 내지 않습니다. 정지 상태에서 가속하고, 목표까지 남은 거리와 감속 한도로 제동 거리를 계산해 도착 전에 감속합니다. 최고 속도 상한은 거리·duration과 무관한 고정값(기본 1350 CSS px/s)입니다. 같은 상한을 향해 가속하다가 제동 거리에 들어가면, 아직 최고 속도에 도달하지 않았어도 감속합니다. 가속도·감속도는 거리에 맞춰 증가하지 않으며 기본 1800·2200 CSS px/s²를 유지합니다. 따라서 먼 목적지까지는 더 오래 걸립니다. 방향 전환도 기존 속도에서 이어지므로 관성에 따라 곡선 경로나 잠깐의 역방향 이동이 생길 수 있습니다. 최고 속도는 목표 속력의 상한이며, 더 낮은 최고 속도로 재지정해도 현재 속도를 즉시 잘라내지 않고 감속합니다.

| `MoveOptions` 필드 | 의미 / 기본값 |
| --- | --- |
| `travel` | `'natural'` 기본 / `'none'` |
| `maxSpeed` | 자연 비행의 최고 속도, CSS px/s. 1–100000. 생략 시 고정 `1350` (기존 명시 예시 900의 1.5배). 거리·duration에 따라 바뀌지 않으며 명시한 값은 그대로 사용 |
| `acceleration` | 자연 비행의 목표 가속력 한도, CSS px/s². 1–100000, 기본 `1800`; 실제 가속도는 아래 응답 곡선을 따라 접근 |
| `deceleration` | 자연 비행의 목표 제동력 한도, CSS px/s². 1–100000, 기본 `2200`; 도착·반전·cancelMove 제동에 사용 |
| `duration` | 0–60000ms, 직접 메서드 기본 `400`. natural에서 양수 값은 무시하며 실제 완료 시간은 보장하지 않음. `0`은 두 모드 모두 즉시 적용 |
| `easing` | `'smooth'` 기본 / `'linear'`. `travel: 'none'`의 시간 기반 보간에만 적용 |

자연 비행에서는 거리·현재 속도·가속/감속 한도가 소요 시간을 결정합니다. 양수 duration과 easing은 maxSpeed 지정 여부와 관계없이 자연 비행 경로 속도에 영향을 주지 않습니다. 짧은 거리에서는 최고 속도에 도달하기 전에 감속할 수 있습니다. 정확히 정해진 시간에 이동을 끝내야 한다면 `travel: 'none'`을 쓰세요. 이전 버전의 15% 이륙·70% 이동·15% 착륙 시간 분할은 자연 비행에 적용되지 않습니다.

가속도는 순간적으로 켜고 끄지 않고 60ms 시정수의 지수 응답으로 목표 힘에 접근합니다. 처음 빠르게 변하고 차츰 완만해지는 느낌이며, 수학적인 로그 함수를 위치에 적용한 것은 아닙니다. 정지 상태에서 일정한 힘을 주면 실제 가속도는 a(t)=A(1−exp(−t/0.06))입니다. 속도와 위치도 이 가속도를 정확히 적분한 값이고, 화면 이벤트의 acceleration은 실제 순간 가속도입니다. 제동 거리 계산에도 이 힘의 응답 지연을 포함합니다. 예측 좌표 x+τv, 예측 속도 v+τa를 사용하고, 남은 거리 d의 허용 속도를 min(maxSpeed, 0.9√(2·deceleration·d))로 제한하는 보수적 제동 여유를 둡니다. 따라서 단순 v²/(2b) 공식보다 먼저 힘을 줄여 부드러운 감속을 준비합니다.

새 목표를 주면 현재 속도와 가속도를 모두 이어받습니다. 더 낮은 상한이나 반대 방향을 지정해도 힘을 즉시 잘라내지 않으므로 짧은 과도 구간 동안 이전 가속도가 남습니다. acceleration/deceleration은 목표 힘의 한도이며, 서로 크게 다른 값을 쓰는 방향 전환에서는 이전 제동력이 잠시 새 방향에 남을 수 있습니다. 기본 상한 1350은 기존 900 기준의 1.5배이며 짧은 거리에서는 가속·제동 때문에 그 속도까지 도달하지 못합니다. 먼 거리가 같은 시간에 끝나도록 가속도를 강제로 키우지 않습니다.

시선·yaw/pitch는 실제 진행 방향을, 몸의 기울기는 실제 가속과 감속을 따라갑니다. 180도 뒤집거나 몸체 방향 설정을 바꾸지 않습니다. 떠오름은 작은 캔버스 안의 런타임 포즈이며 `position`·bounds·진행 이벤트의 좌표에는 포함하지 않습니다. 위치가 목표에 도착하고 속도가 0이 된 뒤 180ms 동안 포즈를 정리해야 `finished: true`가 됩니다.

비행은 일시적인 런타임 오프셋입니다. 활동·표정·수동 포즈·몸체 방향의 저장 상태를 덮어쓰지 않으며 `play()`의 타이머도 계속 갑니다. 착륙 후에는 **그 시점에 활성화된 활동**으로 이어집니다. 비행 도중 끝난 유한 재생을 다시 시작하거나, 이륙 전의 오래된 활동을 복원하지 않습니다. 비행 중 활동/표정을 바꿔도 현재 이동의 위치·속도·목표는 유지됩니다.

```ts
import '@hanana-kick/sidekick';
import type { MoveOptions, MovementState } from '@hanana-kick/sidekick';

const bot = document.querySelector('sidekick-avatar')!;
const options: MoveOptions = {
  duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200,
  // maxSpeed 생략: 거리와 무관한 고정 상한 1350 CSS px/s
};
// 활동은 비행과 동시에 계속 재생됩니다. stop()으로 활동만 중단합니다.
const playback = bot.play('speaking');
const result = await bot.moveBy({ x: 180, y: -60 }, options);
console.log(result.finished, result.position);
bot.stop();
await playback;

// 정확한 시간에 비행 포즈 없이 DOM만 이동합니다.
await bot.moveTo({ x: 24, y: 80 }, { duration: 400, easing: 'smooth', travel: 'none' });
const state: MovementState = bot.movementState;
console.log(state.phase, state.progress, state.position, state.velocity, state.acceleration, state.speed);
```

`travel: 'none'`은 이륙·착륙 없이 duration 전체를 DOM 이동에 사용합니다. 물리 옵션은 검증하지만 보간에는 사용하지 않습니다. 진행 중인 자연 비행을 대체했다면 직전 비행 포즈만 최대 180ms 동안 사라집니다. `duration: 0`, 일시 정지·모션 줄이기·미연결 상태에서는 목표를 즉시 적용하고 속도·가속도·비행 포즈를 0으로 정리합니다. 같은 좌표라도 아직 속도가 있으면 자연 비행은 제동해야 하므로 즉시 완료되지 않습니다.

### 이동 상태와 취소

`movementState`와 `sidekick-move-progress`의 `event.detail`은 같은 형태입니다.

| 필드 | 의미 |
| --- | --- |
| `phase` | `idle`, `takeoff`, `flight`, `landing`, `braking`, `settling`. 자연 비행의 phase는 물리 상태를 나타내며 고정 시간 분할이 아님 |
| `progress` | natural은 남은 거리 기반 0–1 진행 표시이며 완료 시간 예측이 아님. 목표 변경 시 다시 시작. none은 duration 대비 경과 비율. 정상 완료 후 1 |
| `position` | 현재 DOM 좌표 `{ x, y }`, CSS px |
| `velocity` | 실제 DOM 이동 속도 `{ x, y }`, CSS px/s. 오른쪽·아래가 양수 |
| `acceleration` | 실제 속도 변화 `{ x, y }`, CSS px/s². 설정한 가속 한도와 구분 |
| `speed` | 속도 벡터의 크기 `Math.hypot(velocity.x, velocity.y)`, CSS px/s |

상태는 복사본이며 읽거나 변경해도 실제 이동을 제어하지 않습니다. `takeoff`에서도 DOM이 가속하며 움직이고, `landing`은 목표를 향한 감속, `braking`은 cancelMove의 제동을 나타냅니다. `settling`은 속도·가속도가 0인 상태에서 비행 포즈만 정리하는 구간입니다. 진행 이벤트는 시작·애니메이션 샘플·크기 변경·취소·완료 시 발생합니다. UI에는 필요한 값만 반영하고, 완료/취소 확정에는 Promise 또는 `sidekick-move-end`를 사용하세요. 프레임별 이벤트를 스크린 리더의 live 영역에 계속 출력하지 않는 것이 좋습니다.

`cancelMove()`는 자연 비행의 현재 속도를 deceleration으로 줄입니다. 호출한 지점에서 즉시 멈추지 않습니다. 일정한 속도로 비행 중이었다면 제동 거리는 대략 `속력² / (2 × 감속도) + 0.06 × 속력`이며, 가속 중이었다면 남은 가속도 때문에 더 길어질 수 있습니다. 제동력이 부드럽게 바뀌므로 처음에는 속력이 잠깐 더 증가할 수 있지만, 정지 요청으로 반대 방향에 튕겨 나가지는 않습니다. 속도가 0이 되면 `settling`에서 180ms 동안 방향·기울기·떠오름을 정리한 뒤 원래 이동 Promise와 `sidekick-move-end`를 `finished: false`로 완료합니다. 제동 중 새 목표를 요청해도 남은 속도에서 자연스럽게 이어집니다. `cancelMove()` 자체는 Promise를 반환하지 않습니다. `travel: 'none'`은 위치 이동을 즉시 중단하고, 남은 비행 포즈가 있다면 정리합니다. 일시 정지·모션 줄이기·연결 해제는 제동과 포즈 정리를 기다리지 않고 즉시 처리합니다.

`movement-bounds="viewport"`에서는 전체 캔버스 박스가 뷰포트를 벗어나지 않습니다. 벽에 닿은 축의 바깥 방향 속도만 0으로 만들며 다른 축은 계속 움직일 수 있습니다. 경계에 의해 속도가 잘리는 순간은 일반적인 가속 한도 예외입니다. `inline`이나 `movement-bounds="none"`에는 이런 제한이 없으므로 컨테이너 경계·제동 거리·방향 전환 시 여유 공간은 앱에서 관리하세요. 목적지만 컨테이너 안으로 제한해도 관성 경로와 제동 위치까지 제한되지는 않습니다.

API playground는 “기본 최고 속도 · 1350 CSS px/s”이 기본으로 켜져 있으며 호출 코드에서 maxSpeed만 생략합니다. acceleration=1800, deceleration=2200은 거리에 따라 바뀌지 않는 기본값입니다. 기본값 사용을 끄면 직접 입력한 maxSpeed 상한을 사용합니다. 세 물리 제한값은 수동으로 조정할 수 있으며 실제 velocity/acceleration과 비교할 수 있습니다. natural은 항상 물리 적분이며 시간 기반 비행으로 전환되지 않습니다. 최근 6초 그래프는 속력과 가속도의 크기를 각각 독립 축으로 표시합니다. 무대 클릭/터치는 드래그·스크롤·길게 누르기와 구분되며, 모바일에서도 고정 미리보기의 이동 중지 버튼을 사용할 수 있습니다. 활동 재생 구간의 `0`은 playground에서만 계속 반복을 뜻하며, 실제 API 호출에서는 duration을 생략합니다.

### CDN HTML에서 명령 API 사용

```html
<script type="module">
  import { createAccessory } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/dist/browser/sidekick.js';
  const bot = document.querySelector('#companion');
  // import 평가 뒤에는 이미 등록된 엘리먼트 API를 사용할 수 있습니다.
  await bot.moveTo({ x: 80, y: 240 }, { maxSpeed: 320, acceleration: 900, deceleration: 1200 });
  await bot.play('celebrating', { duration: 1500 });
  await bot.transitionTo({
    shape: 'heart', expression: 'smile',
    accessories: [createAccessory('beret'), createAccessory('glasses')],
  }, { duration: 700 });
</script>
<sidekick-avatar id="companion" placement="viewport" position-x="24" position-y="200"
  body-color="#FFCC37" style="width:180px;height:180px;z-index:1000"></sidekick-avatar>
```

첫 전환을 실제 애니메이션으로 보려면 `sidekick-ready` 이후 실행하세요. 준비 전 shape/expression 명령은 기존 API처럼 즉시 적용됩니다. 위 스크립트는 module이므로 HTML 파싱 후 실행됩니다. 동일한 메서드는 classic 번들로 등록한 엘리먼트에서도 사용할 수 있습니다.

### 클릭·터치한 곳으로 이동하는 HTML 무대

아래 무대는 `inline` 모드의 작은 144px 캔버스를 절대 배치합니다. 무대 전체를 렌더링하는 캔버스는 없습니다. 포인터 좌표를 무대 좌표로 바꾸고, 캔버스가 무대 안에 남도록 앱에서 제한합니다. 모바일 탭에는 Pointer Events를 사용합니다.

```html
<style>
  #flight-stage { position: relative; height: 360px; overflow: hidden;
    background: #f4f4f5; touch-action: manipulation; }
  #flight-avatar { position: absolute; left: 0; top: 0; width: 144px; height: 144px; }
</style>
<div id="flight-stage" role="group" aria-label="누른 곳으로 이동하는 무대">
  <sidekick-avatar id="flight-avatar" placement="inline" interaction="none"
    move-duration="1000" move-travel="natural" body-color="#FFCC37"
    aria-label="이동하는 도우미"></sidekick-avatar>
</div>
<button id="flight-center" type="button">가운데로 이동</button>
<button id="flight-cancel" type="button">이동 중단</button>
<button id="flight-play" type="button">말하기 재생</button>
<button id="flight-stop" type="button">활동 중단</button>
<p id="flight-status" aria-live="off">idle</p>
<script type="module">
  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.0/dist/browser/sidekick.js';
  const stage = document.getElementById('flight-stage');
  const bot = document.getElementById('flight-avatar');
  const status = document.getElementById('flight-status');
  function flyTo(localX, localY) {
    const x = Math.max(0, Math.min(stage.clientWidth - bot.offsetWidth, localX - bot.offsetWidth / 2));
    const y = Math.max(0, Math.min(stage.clientHeight - bot.offsetHeight, localY - bot.offsetHeight / 2));
    void bot.moveTo({ x, y }, { duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200 });
  }
  stage.addEventListener('pointerup', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = stage.getBoundingClientRect();
    flyTo(event.clientX - rect.left, event.clientY - rect.top);
  });
  document.getElementById('flight-center').onclick = () => flyTo(stage.clientWidth / 2, stage.clientHeight / 2);
  document.getElementById('flight-cancel').onclick = () => bot.cancelMove();
  document.getElementById('flight-play').onclick = () => void bot.play('speaking', { duration: 2000 });
  document.getElementById('flight-stop').onclick = () => bot.stop();
  bot.addEventListener('sidekick-move-progress', event => { status.textContent = event.detail.phase; });
  bot.addEventListener('sidekick-move-end', event => {
    status.textContent = event.detail.finished ? '도착' : '이동 중단됨';
  });
</script>
```

`가운데로 이동` 버튼은 키보드로도 실행할 수 있습니다. 무대 크기를 동적으로 줄이는 앱은 새 크기에 맞춰 `moveTo()`를 호출해 다시 제한하세요. `inline`은 앱 컨테이너의 bounds를 자동 계산하지 않습니다. 관성으로 제동하는 동안에는 무대 밖까지 이동할 수 있으므로 이 예제는 overflow로 잘라 표시합니다. 이 예제의 `moveTo()`는 옵션을 직접 지정하므로 HTML 이동 attribute를 읽지 않습니다. 선언형으로 바꾸려면 `position-x/y`를 함께 갱신하면 됩니다.

### React: 같은 엘리먼트 API를 ref로 사용

```tsx
import { useRef, useState } from 'react';
import { SidekickAvatar, type SidekickAvatarRef } from '@hanana-kick/sidekick/react';
import { createAccessory } from '@hanana-kick/sidekick';

export function Companion() {
  const bot = useRef<SidekickAvatarRef>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState('idle');
  function flyTo(localX: number, localY: number) {
    const avatar = bot.current;
    const area = stage.current;
    if (!avatar || !area) return;
    const x = Math.max(0, Math.min(area.clientWidth - avatar.offsetWidth, localX - avatar.offsetWidth / 2));
    const y = Math.max(0, Math.min(area.clientHeight - avatar.offsetHeight, localY - avatar.offsetHeight / 2));
    void avatar.moveTo({ x, y }, { duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200 });
  }
  return <>
    <div ref={stage} role="group" aria-label="누른 곳으로 이동하는 무대"
      style={{ position: 'relative', height: 360, overflow: 'hidden', background: '#f4f4f5', touchAction: 'manipulation' }}
      onPointerUp={event => {
        if (!event.isPrimary || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        flyTo(event.clientX - rect.left, event.clientY - rect.top);
      }}>
      <SidekickAvatar ref={bot} placement="inline" interaction="none"
        moveDuration={1000} moveTravel="natural" bodyColor="#FFCC37"
        style={{ position: 'absolute', left: 0, top: 0, width: 144, height: 144 }}
        onMoveProgress={event => setPhase(event.detail.phase)}
        onMoveEnd={event => setPhase(event.detail.finished ? '도착' : '이동 중단됨')} />
    </div>
    <button type="button" onClick={() => {
      if (stage.current) flyTo(stage.current.clientWidth / 2, stage.current.clientHeight / 2);
    }}>가운데로 이동</button>
    <button type="button" onClick={() => bot.current?.cancelMove()}>이동 중단</button>
    <button type="button" onClick={() => void bot.current?.play('speaking', { duration: 2000 })}>말하기 재생</button>
    <button type="button" onClick={() => bot.current?.stop()}>활동 중단</button>
    <button type="button" onClick={() => void bot.current?.transitionTo({
      shape: 'heart', expression: 'smile', accessories: [createAccessory('beret')],
    }, { duration: 600 })}>외형 전환</button>
    <p aria-live="off">{phase}</p>
  </>;
}
```

React SSR은 기존처럼 안전하며 ref는 클라이언트 등록 후 게시됩니다. 선언형 `positionX/Y` props는 값이 바뀔 때만 반영되므로 일반적인 부모 rerender가 명령형 이동을 되돌리지 않습니다. 위 ref 호출은 `MoveOptions`를 직접 전달하며 `moveDuration`·`moveTravel`·`moveMaxSpeed`·`moveAcceleration`·`moveDeceleration` props는 선언형 `positionX/Y` 변경에 적용됩니다. React의 `onAssetTransitionEnd`는 Sidekick 묶음 전환 이벤트입니다. 기존 네이티브 CSS `onTransitionEnd`와 구분됩니다.

공개 타입 `AvatarPlacement`, `AvatarPosition`, `MovementBounds`, `MoveOptions`, `MoveResult`, `MovementState`, `PlayOptions`, `AssetTransitionTarget`은 메인/`register` 엔트리에서 가져올 수 있습니다. `MoveOptions.travel`의 값은 `'natural' | 'none'`이며, 기존 `MotionOptions`를 받는 도형/표정/포즈 API에는 `travel`을 전달하지 않습니다.


## API playground: 원하는 동작을 코드로 만들기

[API playground](https://sidekick.hananakick.cc/api-playground.html)에서 이동, 활동/상태, 좌우 눈 표정, 마우스 추적, 몸 방향, 외형 전환, 입장/퇴장을 선택하세요. 값을 바꾸는 즉시 HTML + JavaScript 또는 React 코드가 갱신됩니다. 실행과 코드 생성은 동일한 명령 데이터에 기반합니다. 설치 및 Studio 봇 초기화 코드는 별도 준비 영역에서 제공합니다.

봇은 작은 투명 캔버스 하나를 `placement="viewport"`로 페이지 전체에서 이동시킵니다. 전체 화면 크기 캔버스를 만들지 않습니다. 좌표는 viewport 왼쪽 위 기준 CSS 픽셀이며 페이지 스크롤 높이를 더하지 않습니다. 빈 곳의 클릭/탭은 봇 중심을 해당 위치로 이동시킵니다. 선택한 할 일, 입력값, 설정 코드는 그대로 보존하며 실제 클릭 이동·중지 호출은 별도의 “마지막 실행 코드”에서 확인하고 복사할 수 있습니다. 작업 종류를 바꾸었다가 돌아와도 각 입력값이 유지됩니다. 버튼·폼·링크·코드 선택·스크롤 제스처는 이동을 실행하지 않습니다. 봇은 포인터 이벤트를 통과시켜 페이지 조작을 막지 않습니다.

Studio에서 저장한 디자인과 장면 설정을 동일 브라우저·동일 origin에서 읽습니다. API playground의 임시 명령은 Studio 저장값을 덮어쓰지 않습니다. 저장 데이터가 잘못되었거나 브라우저 저장소를 사용할 수 없으면 안내와 기본 봇을 표시하며 원본을 삭제하지 않습니다. 다른 브라우저/기기로 옮길 때는 Studio JSON 내보내기/불러오기를 사용하세요.

### 자연스럽게 입장하고 퇴장하기

```js
// placement="viewport" 요소에서 사용합니다.
await avatar.enter({ x: 120, y: 200 }, { from: 'left' });
await avatar.exit({ to: 'right' });
// 다시 입장할 수 있습니다.
await avatar.enter({ x: 240, y: 120 }, { from: 'top', maxSpeed: 1350 });
```

- `enter(point, options?)`: 화면 밖에서 `point`까지 비행합니다. `from`은 `left`(기본), `right`, `top`, `bottom`입니다.
- `exit(options?)`: 선택한 화면 바깥으로 비행한 뒤 숨깁니다. `to`는 `right`(기본), `left`, `top`, `bottom`입니다.
- 두 메서드는 기존 `MoveOptions`의 속도·가속·감속·travel·duration 설정을 받습니다. 자연 비행은 실제 관성을 사용합니다. paused 또는 모션 줄이기에서는 즉시 적용합니다.
- 결과는 `{ finished, position, presence }`입니다. 읽기 전용 `presenceState`는 `visible`, `entering`, `exiting`, `hidden` 중 하나입니다. 완료 이벤트는 `sidekick-enter-end` / `sidekick-exit-end`, React props는 `onEnterEnd` / `onExitEnd`입니다. React ref에서도 같은 메서드를 사용합니다.
- `inline` 배치에서는 사용할 수 없습니다. 입퇴장 중 새 입퇴장 명령은 현재 위치와 관성에서 다시 목표를 잡습니다. 일반 `moveTo` / `moveBy`는 입퇴장을 취소하고 봇을 보이게 합니다. `cancelMove()`는 숨기지 않고 제동합니다.
- 퇴장이 완전히 끝난 뒤 렌더러와 추적 구독을 비활성화합니다. 디자인·활동·추적 설정은 보존하며 재입장 시 복원합니다. 창 크기가 바뀌면 진행 중인 퇴장 목적지를 새 화면 경계에 맞춥니다.

| React prop | 타입 | 의미 |
| --- | --- | --- |
| `onEnterEnd` | `SidekickEventHandler<'sidekick-enter-end'>` | 입장 완료/취소 `{finished, position, presence}` |
| `onExitEnd` | `SidekickEventHandler<'sidekick-exit-end'>` | 퇴장 완료/취소 `{finished, position, presence}` |

### 엘리먼트 기준 이동

`moveToElement(target: Element, options?: MoveToElementOptions): Promise<MoveResult>`는 특정 DOM 엘리먼트를 기준으로 이동합니다. React의 `SidekickAvatarRef`에서도 같은 메서드를 제공합니다.

```js
const target = document.querySelector('#message');
if (target) {
  await bot.moveToElement(target, {
    anchor: true,    // false (기본값): 한 번 이동 / true: 도착 후 계속 연결
    alignX: 'center', // left (기본값) | center | right
    alignY: 'bottom', // top (기본값) | center | bottom
    x: 12, y: -16,   // 기본값 0. 화면 기준 오른쪽 / 아래쪽이 양수
    maxSpeed: 1350, acceleration: 1800, deceleration: 2200,
  });
}
```

대상과 봇의 **동일한 정렬점**을 맞춥니다. `center/center`면 두 박스의 중심이 일치하고, `right/bottom`이면 오른쪽 아래 모서리가 일치합니다. 이후 X/Y 오프셋을 적용합니다. 기준은 투명 캔버스를 포함한 엘리먼트의 화면상 border-box이며, 캐릭터의 불투명 픽셀 경계가 아닙니다.

```tsx
import { useRef } from 'react';
import { SidekickAvatar, type SidekickAvatarRef } from '@hanana-kick/sidekick/react';

export function Example() {
  const bot = useRef<SidekickAvatarRef>(null);
  const target = useRef<HTMLButtonElement>(null);
  return <>
    <SidekickAvatar ref={bot} placement="viewport" />
    <button ref={target} onClick={() => {
      if (target.current) void bot.current?.moveToElement(target.current, {
        anchor: true, alignX: 'center', alignY: 'center', x: 0, y: -100,
      });
    }}>이 버튼을 기준으로 이동</button>
  </>;
}
```

- `anchor: false`(기본값)는 호출 시점의 위치로 한 번 이동합니다. 이후 스크롤·레이아웃 변화는 따라가지 않습니다.
- `anchor: true`는 선택한 정렬점과 오프셋을 계속 유지합니다. 최초 이동 중에는 같은 이동 요청의 목적지만 갱신하여 속도·가속도·Promise를 보존합니다. 도착 후에도 같은 최대 속도·가속·감속 설정으로 목표를 자연스럽게 추격합니다. 목표가 갑자기 움직여도 봇 좌표를 순간적으로 맞추지 않습니다. 최초 도착 Promise와 이동 완료 이벤트는 한 번만 발생하며 이후 추격은 완료 이벤트를 반복하지 않습니다. 정지 상태에서는 0.5 CSS px 이하의 오차를 무시합니다. 중첩 스크롤, 리사이즈, 레이아웃 변화, CSS/WAAPI transform을 반영합니다. 대상이 계속 움직이면 최초 이동 완료가 늦어질 수 있습니다. 봇 또는 대상이 `display: none`으로 레이아웃에서 빠지면 연결을 유지한 채 추적을 일시 중지하고, 다시 표시될 때 정렬합니다.
- 봇이 완전히 화면 밖으로 나가고 정렬된 목적지도 화면 밖이면 물리 이동과 렌더링을 유휴 상태로 둡니다. 현재 위치나 목적지가 다시 화면과 겹치면 관성을 유지하며 추격을 재개하고, 숨겨진 동안의 시간을 한꺼번에 적분하지 않습니다. 렌더링은 봇 자체가 화면과 겹칠 때만 재개됩니다. 앵커 위치 확인은 활성 상태에서 문서당 하나의 RAF로 묶고, 모든 연결이 유휴이면 250ms 간격으로 낮춥니다. 스크롤·리사이즈는 즉시 다음 프레임에서 확인하고 CSS transform만으로 복귀하는 경우도 최대 약 250ms 뒤 감지합니다. 숨겨진 탭에서는 위치 확인도 중지합니다. 따라서 완전히 화면 밖일 때 GPU 프레임은 멈추지만 복귀 감지를 위한 소량의 DOM 측정은 남습니다.
- 렌더링은 지원 환경에서 OffscreenCanvas를 전송한 전용 worker의 WebGL2에서 수행합니다. 숨겨진 동안의 리사이즈는 모아서 다음 실제 렌더 시 적용합니다. 미지원·CSP 제한 환경은 메인 스레드 WebGL2 폴백을 사용합니다. DOM 위치 측정과 이동 좌표 갱신은 DOM 접근이 가능한 메인 스레드에 남습니다.
- 봇의 부모 DOM이나 CSS positioning은 바꾸지 않습니다. absolute/fixed/inline 배치는 그대로 두고 봇 자신의 이동 오프셋만 갱신합니다. `detachAnchor()`는 연결을 해제하고 진행 중인 최초 이동은 마지막 목적지까지 계속합니다. 최초 도착 이후의 추격은 현재 관성으로 감속해 멈춥니다. 이동까지 멈추려면 `cancelMove()`를 사용하세요.
- 다른 `moveTo / moveBy / moveToElement`, `cancelMove / enter / exit`, 봇 연결 해제 시 기존 앵커를 해제합니다. 대상 제거·다른 문서로 이동·지원하지 않는 조상 transform 변경 시 연결을 해제하며, 진행 중인 최초 이동은 마지막 유효 목적지까지 계속합니다. 봇 자신과 자손을 지속 앵커 대상으로 삼는 순환 배치는 거부합니다.
- 활성 앵커들은 문서당 하나의 RAF에서 레이아웃을 읽고 그 다음 위치를 씁니다. 정지한 위치에는 다시 쓰지 않지만, observer가 감지하지 못하는 transform-only 애니메이션까지 추적하기 위해 연결 중에는 프레임별 측정 비용이 있습니다. 문서가 숨겨지면 중지하고 마지막 연결 해제 시 루프를 제거합니다. 필요한 동안만 연결하세요.
- `inline`과 `viewport` 모두 현재 봇의 화면 위치를 기준으로 좌표를 변환합니다. 봇 자체의 CSS transform은 측정된 크기에 반영됩니다. 봇 자체의 CSS zoom은 지원하지 않으며 transform: scale()을 사용하세요. 봇 조상에 transform/rotate/scale/perspective/CSS zoom이 있으면 좌표 단위가 달라지므로 명시적으로 오류를 냅니다. 이 경우 봇을 변환 없는 body 바로 아래에 배치하세요.
- 같은 문서에 연결된 HTML/SVG Element를 받습니다. 연결되지 않은 대상, 다른 문서, 잘못된 옵션은 현재 이동을 취소하거나 봇을 표시하기 전에 동기적으로 거부합니다. 크기 0인 대상도 유효한 좌표 기준점입니다.
- `MoveOptions`의 자연 가속·제동, 중단, reduced-motion 설정을 그대로 사용합니다. `movementBounds="viewport"`이면 화면 제한이 정렬보다 우선하므로 화면 밖 대상에 정확하게 맞추려면 `movementBounds="none"`을 명시하세요.
- Playground의 이동 기준에서 `moveToElement`를 선택하면 CSS 선택자, 정렬, 오프셋과 동일한 실행 코드가 표시됩니다. 선택자는 Playground 편의 기능이며 실제 API에는 Element 객체를 전달합니다. 복사한 예제에서는 해당 선택자에 맞는 대상 엘리먼트를 앱에 준비해야 합니다.

### 가이드: 간단한 사용부터 깊은 커스텀까지

[가이드](https://sidekick.hananakick.cc/guide.html)는 설치부터 선언형 행동, 세부 API 조합까지 단계적으로 배우고 직접 실행하는 페이지입니다. 기존 use-cases.html 주소는 새 가이드로 연결됩니다. Studio / API playground / 가이드는 같은 메뉴를 사용합니다.

- **빠르게 시작**: HTML·React 초기화와 Studio에서 저장한 봇 사용 방법을 안내합니다.
- **행동 선언**: 로딩·업로드 대기, 결과 반응, 목록 검토, 읽기·검색, 폼, 온보딩 등 12가지 서비스 시나리오를 다룹니다. 자연어를 해석하는 LLM 기능이 아니라 타입이 정해진 행동 객체로 원하는 동작을 선언합니다.
- **직접 제어**: DOM 배치와 앵커, 이동·시선·표정 조합, 생명주기와 오류 처리, OffscreenCanvas 성능까지 설명합니다.

각 시나리오는 **간단하게 사용 → 옵션 조절 → 앱 이벤트 연결 → 직접 동작 조합** 순서로 구성됩니다. 실행 중인 봇과 해당 실행 코드를 함께 보고 복사할 수 있습니다. 설치·개념 설명과 실제 실행 데모를 구분하며, 대분류·중분류·소분류 목차와 주소 해시로 원하는 단계에 바로 이동합니다. 모바일에서는 목차를 접을 수 있습니다.

한 번에 한 예제만 활성화하여 불필요한 렌더러를 만들지 않습니다. 예제 종료·전환 시 인스턴스를 제거하고, 보이지 않는 섹션과 숨겨진 페이지의 렌더링을 일시 정지합니다. Studio 설정은 읽기만 하며 실험 동작은 원본에 저장하지 않습니다. 실행 예제의 비동기 작업은 별도 표시가 없다면 로컬 시뮬레이션이며, 실제 앱에서는 서비스 요청과 결과 이벤트를 연결하세요.
