# Sidekick

[한국어](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

**以 35 种 Material 形状打造透明平面角色的库。** 从一个默认的 `<sidekick-avatar>` 开始，即可通过 HTML 属性、JavaScript API 或 React 封装，以你习惯的方式进行控制。支持形状过渡、左右独立表情、鼠标视线跟踪、身体方向旋转、六个配饰位置，以及具有朝向的屏幕移动。核心采用不依赖框架的 TypeScript + Web Component + WebGL2。

- [安装](#安装) · [HTML](#直接在-html-中使用) · [React](#在-react-中使用)
- [全部属性](#html-属性与-react-props) · [设计与配饰](#设计-json-与配饰) · [动画/API](#动画与命令式-api)
- [声明式行为](#声明式行为-behavior) · [屏幕移动/飞行](#渲染与移动标准-v03) · [事件/清理](#事件与清理) · [SSR](#ssr-与浏览器支持) · [Studio/开发](#studio-与开发)

## 安装

**直接从公开的 GitHub 仓库安装预构建的软件包。** 在要使用它的项目中运行以下命令。

```sh
npm install https://github.com/hanana-kick/sidekick.git
```

如需固定版本，请指定发布标签。

```sh
npm install https://github.com/hanana-kick/sidekick.git#v0.11.0
```

仓库中包含已构建的 ESM、类型声明及浏览器包，**使用方无需构建 Sidekick 源码。** 将依赖和 lockfile 一起提交，可确保团队使用相同版本。软件包名称为 `@hanana-kick/sidekick`，当前版本为 `0.11.0`。**该软件包尚未发布到 npm 注册表，请勿仅凭包名运行 `npm install @hanana-kick/sidekick`。**

不使用 npm 的 HTML 网站可以从 [GitHub Releases](https://github.com/hanana-kick/sidekick/releases) 下载已构建的文件。提供 ESM、用于普通 `<script>` 的 JS，以及专用渲染 worker；该浏览器核心不需要 React、打包工具、Node.js、单独的 CSS 或字体。

### 从 GitHub Release 下载

1. 打开 [Releases](https://github.com/hanana-kick/sidekick/releases)。
2. 在所选标签的 **Assets** 中下载 `sidekick-browser-0.11.0.zip` 或 `hanana-kick-sidekick-0.11.0.tgz`。其他版本请选择与标签一致的文件名。自动生成的 **Source code (zip/tar.gz)** 是源码归档，请注意与浏览器分发 ZIP 区分。
3. 对于普通 HTML 网站，解压浏览器 ZIP，并将以下文件复制到网站的静态文件目录。阅读附带的 `START-HERE.txt`，然后打开 `esm.html`、`classic.html` 或 `react.html` 中所需的示例。示例中的 `/vendor/sidekick/` 是**你的网站路径**，请根据部署路径调整。

| 已构建的文件 | 用途 | 所需文件与依赖 |
| --- | --- | --- |
| `sidekick-browser-0.11.0.zip` | 普通 HTML/React 浏览器分发包 | 包含 `esm.html`、`classic.html`、`react.html`、下列 6 个 JS 文件、可选的 `vendor/`、README 和声明 |
| `sidekick.js` | 浏览器 ESM；使用 `import` 和 `<script type="module">` | 将 `sidekick.worker.js` 保留在同一目录 |
| `sidekick.iife.js` | 普通 classic `<script>`；API 位于 `window.Sidekick` | 将 `sidekick.worker.js` 保留在同一目录；不使用 `type="module"` |
| `sidekick-react.js` | React 19 的 ESM 组件 | 将 `sidekick-element.js`、`sidekick-fallback.js` 和 `sidekick.worker.js` 保留在同一目录，并提供 `react` 对等依赖 |
| `sidekick-element.js` | React 封装延迟加载的渲染器 | 不要直接 import；使用与 `sidekick-react.js` 相同的版本 |
| `sidekick-fallback.js` | 无法使用 worker 时，由 React 元素加载的渲染器 | 不要直接 import；与其余文件保持相同版本 |
| `sidekick.worker.js` | OffscreenCanvas 专用 worker | 放在浏览器入口文件旁；不要通过单独的 script 标签加载 |
| `vendor/react.js`, `vendor/react-dom-client.js` | 浏览器 ZIP 中可选的 React 19/ReactDOM ESM | 用于下方免构建 React 示例；通过 import map 连接；已有 React 的应用不需要 |
| `hanana-kick-sidekick-0.11.0.tgz` | 可安装到现有 npm 项目的软件包 | 包含已构建的 ESM、类型声明、浏览器包和声明 |
| `SHA256SUMS` | 校验 ZIP 与 tarball 的下载完整性 | 同一 Release 的校验和文件 |

请同时保留 ZIP 中附带的 README 以及第三方许可/来源声明。**请先下载 GitHub Release 附件，再通过你自己的网站提供这些文件。** 下载 URL 并非浏览器 JS 托管地址，其响应的 MIME、CORS 行为与静态托管不同。下方示例中的 `src`/`import` 使用的是你的网站上提供这些已下载文件的路径。

`sidekick.js` 和 `sidekick.iife.js` 均导出完整的公开核心/元素 API，并自动注册默认的 `<sidekick-avatar>`。**请二选一。** Classic JS 指浏览器全局脚本，不是供 Node.js CommonJS `require()` 使用的构建产物。React 封装不在包内包含 React。`sidekick.js` 中的 `SidekickAvatar` 是自定义元素类，`sidekick-react.js` 中的同名导出则是 React 组件。

### 可选：安装已构建的 tarball

在目标项目中安装从 Release 下载的 tarball。此命令不会编译 Sidekick 源码，也不会构建 Studio。

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.11.0.tgz
```

仅使用 React 封装时才需要 React 19。用于挂载网页的 `react-dom` 也需由使用方准备相同版本。仅使用核心的项目不需要 React。

### 软件包入口

| import 路径 | 用途 |
| --- | --- |
| `@hanana-kick/sidekick` | 在浏览器中自动注册默认标签，并导出公开 API |
| `@hanana-kick/sidekick/auto` | 显式表示自动注册的入口 |
| `@hanana-kick/sidekick/register` | 在不自动注册的情况下导入 `defineSidekick`、元素类和公开 API |
| `@hanana-kick/sidekick/core` | 无需 DOM，即可使用设计/场景创建与验证，以及动作、身体方向和像素工具 |
| `@hanana-kick/sidekick/react` | React 组件 `SidekickAvatar` 及 props/ref 类型 |

软件包模块为 ESM，可执行模块及类型位于 `dist/library/`，可直接使用的浏览器包位于 `dist/browser/`。`dist/src/` 仅用于内部测试。浏览器无法直接解析裸 import 名称，因此导入软件包时请使用打包工具或 import map。下方 HTML 示例使用实际文件 URL，无需此配置。

## 情绪与临时反应

情绪是独立于机器人**正在做什么**的表现层。它协调眼睛、身体倾斜和节奏，不会取消等待、逐项检查、活动或移动。情绪由应用明确指定，Sidekick 不推断真实用户的情绪。

`neutral`、`happy`、`sad`、`curious`、`surprised`、`concerned`、`excited`。`intensity` 范围为 0~1，默认 1。`neutral` 移除情绪叠加层，显示当前设计和行为。


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

`setEmotion()` 设置持续状态并替换正在进行的临时反应。`reactTo()` 默认保持 1200ms，然后回到持续情绪。`duration` 是包括进入过渡的保持时间（0~60000ms），并非等待返回过渡结束的时间。`cancelReaction()` 仅取消反应。新反应、持续设置或断开连接会使旧反应以 `finished: false` 结束；旧定时器不会覆盖新状态。

`emotion`/`emotionIntensity` 属性返回持续设置。`emotionState` 包含当前临时反应：`{ emotion, intensity, baseline: { emotion, intensity }, reacting }`。`sidekick-emotion-change` 传递该状态。`sidekick-reaction-end` 和 Promise 返回 `{ finished, emotion, reason }`，其中 `reason` 为 `completed`、`replaced`、`cancelled` 或 `disconnected`。完成表示保持时间结束，而不是返回过渡已完全稳定。

情绪不会改写或恢复保存的设计、活动、视线或身体方向。显式调用 `setExpression()`、`setEyeWeights()`、`motion.to({ eyes: … })`，通过 `updateDesign()` 或替换设计修改眼睛，以及使用 HTML/React 眼睛控件，都会接管对应眼睛的显示控制。仅修改左眼时，右眼的情绪表情和身体的情绪动作保持不变。这些眼睛指令在情绪激活时也会显示，无需先清除情绪。

再次显式调用 `setEmotion()` 或 `reactTo()` 会将双眼的控制权交回情绪，即使指定的是同一种情绪。反应完成或 `cancelReaction()` 会恢复持续情绪，但不会重新接管反应开始后手动修改的眼睛。`setEmotion('neutral')` 会解除情绪叠加层。自动眨眼和旧版共享 `eyes.openness` 限制仍独立生效，可以关闭原本睁开的眼睛。面向目标的行为优先于情绪的辅助视线。离屏时渲染休眠，临时反应的保持时间仍按实际时间计算。重新连接不会重播已结束的反应。

| HTML / API | React | 说明 |
| --- | --- | --- |
| `emotion` | `emotion` | 情绪名称，默认 neutral |
| `emotion-intensity` | `emotionIntensity` | 情绪强度 0~1，默认 1 |
| `sidekick-emotion-change` | `onEmotionChange` | 持续情绪或临时反应变化 |
| `sidekick-reaction-end` | `onReactionEnd` | 临时反应完成、替换、取消或断开连接 |

### 过渡与立即保存的设置

`design`、`setDesign()`、`updateDesign()`、`equipAccessory()` 和 `removeAccessory()` 会立即保存目标设置，但画面会从当前显示的外观平滑过渡。默认眼睛过渡为 400ms，身体形状过渡为 450ms；显式指定的过渡时间优先。身体朝向也会平滑变化。过渡途中再次修改不会退回初始外观。

直接添加、移除或替换配饰时，渲染器会对相应部位执行 200ms 淡入淡出：旧配饰淡出，在完全透明时替换，然后新配饰淡入。身体和其他部位不会一起消失。显式 `transitionTo()` 使用自身的淡入淡出，不会重复应用渲染器过渡。

暂停（`paused`）或减少动态效果模式会立即稳定到目标状态。视觉过渡期间读取设置已返回新目标，因此不能把读取到的设置当作动画完成信号。

## 通过 CDN 免构建使用

目前推荐的 CDN 版本为 **0.11.0**。下列 URL 由 jsDelivr 提供已提交到 GitHub 标签中的**预构建 JS**，无需构建源码、安装 npm 或拥有 npm 账号。请固定**精确标签**，不要使用 `main`、`latest` 或版本范围。旧版 `v0.2.7` 文件未作修改。0.2.7 仍可通过相同的 CDN 路径下载，但在不同来源的页面上会因 worker 创建受限而回退到主线程，因此新的 CDN 集成请使用上述固定的当前版本。

### 普通 HTML / classic script

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

ESM 和 classic 会自动注册同一个元素。一个页面中只使用其中一种。

### React：在浏览器中免构建运行

提供版本一致的 React 与 ReactDOM 19.3.1 预构建 ESM。请在所有模块脚本之前声明 import map。示例使用 `createElement`，无需 JSX 转换。

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

现有 React 应用应继续使用应用自身的 React 实例。不要通过上述 import map 重复加载另一份 React；更合适的方式是通过 npm/GitHub 安装后，导入 `@hanana-kick/sidekick/react`。

### Worker、CORS、CSP 与自托管

- CDN 的 JS 响应需要 JavaScript MIME 和 `Access-Control-Allow-Origin: *`；jsDelivr 会提供这些设置。请勿将 GitHub Release 下载 URL 填入 `script src`。
- 从 0.2.8 起，当 CDN 与页面来源不同时，会在本地 Blob module worker 中静态导入 CDN 的 `sidekick.worker.js`。实际渲染仍在 OffscreenCanvas worker 中进行。Blob URL 会在启动完成、出错或结束时释放。
- 使用 CSP 时，须允许 `worker-src 'self' blob:`，并在 `script-src` 中允许 `https://cdn.jsdelivr.net`。上述内联示例与 import map 还需要符合网站策略的 nonce/hash。无需无条件放宽整个 CSP，也不必添加 `unsafe-inline`。
- 如果不支持 worker/WebGL2/OffscreenCanvas，或 CSP 阻止 worker，会回退到原有主线程渲染器。请通过 HTTPS 提供服务；HTTP 本地开发请使用 localhost。
- 自托管时，请将浏览器 ZIP 中的**全部六个 JS 文件**保留在同一目录。React 会延迟加载相同版本的 `sidekick-element.js` 和 `sidekick-fallback.js`。不要仅将 worker 文件或某个 chunk 替换成不同版本。
- 已发布版本标签中的分发文件不会修改。修复会通过新的 patch 版本发布。jsDelivr 会长期缓存首次请求的文件，请勿将删除文件视为回滚手段。

CDN 的官方行为与缓存策略：[jsDelivr GitHub 分发文档](https://github.com/jsdelivr/jsdelivr#github)。

## 直接在 HTML 中使用

### 最小 ESM 示例

将下载的 `sidekick.js` 与 `sidekick.worker.js` 放到网站的 `/vendor/sidekick/` 后，即可通过以下两行开始使用。

```html
<script type="module" src="/vendor/sidekick/sidekick.js"></script>
<sidekick-avatar></sidekick-avatar>
```

注册完成后，会显示一个 200 × 200px 的透明角色。默认外观为 `#FFCC37` 黄色 `square`、深色眼睛、无配饰，状态为 `idle`。尺寸通过普通 CSS 设置。外观由目录中的形状/装备选择及颜色控制；各部件的几何尺寸、深度与位置不作为公开参数提供。

### 完整 HTML 示例：ESM import

将以下内容保存为 `index.html`，与下载的文件一起通过 HTTP(S) 提供服务。该示例无需构建源码、安装 npm 或配置 import map。为接收初始错误/就绪事件，先添加监听器，再调用 `import()`。

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

静态 ESM import 也一样。可直接从 `sidekick.js` 导入公开函数。

```js
import { createDesign, createAccessory, defineSidekick } from '/vendor/sidekick/sidekick.js';
```

### 完整 HTML 示例：普通 JS script

将 `sidekick.iife.js` 与 `sidekick.worker.js` 复制到同一目录，不带 `type="module"` 加载。注册会自动进行，相同的公开 API 位于全局对象 `Sidekick`。请先执行外部脚本，再在下方使用 API。不要随意向此示例中的脚本添加 `async`/`defer`，以免改变执行顺序。

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

请通过 HTTP(S) 服务器提供页面，不要以 `file://` 双击打开。`.js` 响应必须使用 JavaScript MIME，避免 SPA fallback 在文件不存在时返回网站的 `index.html`。若从其他 origin 提供 JS，还需配置模块所需的 CORS。上述示例使用同一 origin。这两个核心包无需额外下载 JS、图片或字体。

### 显式注册并发送命令

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

也可通过 `defineSidekick('my-companion')` 注册其他标签名。React 封装使用默认的 `sidekick-avatar`。`whenDefined()` 仅表示类注册完成，并不表示 GPU 已准备好渲染。`ready` 是只读 boolean，而非 Promise。如果需要 PNG，请确认 `bot.ready === true`，或等待 `sidekick-ready`。

## 在 React 中使用

### 现有 React 19 项目

通过上述 GitHub URL 或 Release 中的 `.tgz` 安装软件包后，在应用中渲染以下组件。JSX/TSX 由应用已有工具处理，无需重新构建 Sidekick 本身。

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

封装会在浏览器中注册元素，并将 camelCase props 映射到 HTML 属性。`ref` 指向实际元素，因此可以使用现有命令式 API。`design`、`accessories` 和 `motion` 可传入带类型的对象，无需使用字符串。常见的 `id`、`className`、`style`、`aria-*` 和 `data-*` 也会传递给元素。

```tsx
import { createAccessory, createDesign } from '@hanana-kick/sidekick/core';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

const design = createDesign({
  body: { shape: 'clover4Leaf', color: '#8bba9c' },
  accessories: [createAccessory('halo', 'aura')],
});

<SidekickAvatar design={design} trackingMode="off" />;
```

属性更改会应用到现有元素。动画过程中更改 `key` 或条件性移除元素会重建运行时，因此请保持 `key` 稳定。如果同时通过 props 和命令式 API 控制同一个值，之后再更改对应 prop 时，会重新应用声明式值。形状动画过渡请使用 `shape` prop 或 `setShape()`。React 的 `design` prop 也会映射到 HTML `design` 属性，因此在连接后更改其中的形状，会按 `shapeDuration` 过渡。相对地，元素的 JavaScript `design` 属性和 `setDesign()` 会立即应用整个设计。

### 免构建 React HTML 示例

请保留浏览器 ZIP 中 `sidekick-react.js`、`sidekick-element.js` 和 `vendor/` 的原有结构。可以打开附带的 `react.html`，或在**同一目录**保存内容如下的 HTML。通过 HTTP(S) 打开后，React 也能在无需安装、JSX 转换或源码构建的情况下运行。例如，将这些文件复制到 `/vendor/sidekick/` 后，可打开 `/vendor/sidekick/react.html`。

本示例使用 ZIP 内附带的 **React/ReactDOM 19.3.1 production ESM**。React 对等依赖和用于页面挂载的 ReactDOM 独立于核心；请同时保留两个 vendor 文件及附带的 React、ReactDOM、scheduler 许可证。已有 React 应用应使用自身的对等依赖，不要再加入另一份 React。运行时不会向外部 CDN 或 GitHub 下载 URL 发送请求。

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

`sidekick-react.js` 中的 `react` import 需要由 import map 或应用打包工具解析。渲染器文件相对于封装所在位置加载，因此不要移动或重命名 `sidekick-element.js`。React 示例无需额外加载 `sidekick.js`/`sidekick.iife.js`。

## HTML 属性与 React props

下表列出了**所有支持的 HTML 配置属性与 React 专用 props**。camelCase 表示 React prop 名称，并不意味着所有这些名称都是元素的 JavaScript 属性。普通 HTML 可使用 `setAttribute()`/`removeAttribute()`，复杂控制则使用命令式 API。只读状态、事件和 PNG 输出通过 API 获取。

- 所有配置 prop 均为可选。表中的默认值以未提供 `design` 或其他上层输入的新元素为准。**省略表示不覆盖。** 例如，`design` 中的身体形状为 `heart` 时，即使省略 `shape`，也不会变成 `square`。
- HTML 值为字符串。数字可写为 `shape-duration="450"`，JSON 可写为 `motion='{"body":{"rotation":[0,0,0.2]}}'`。React 中数字使用 `{450}`，boolean 使用 `{true}`/`{false}`，复合值使用实际对象/数组。
- React 配置 prop 的清除方式是 **`undefined` 或省略该 prop**，封装先前设置的对应属性会被移除。普通配置 prop 不支持 `null`，但 `behavior={null}` 会显式取消行为。`ref={null}` 可按 React 标准用于解除引用。
- `MaterialShapeName` 的 35 个允许值见[完整形状列表](#形状渲染范围与许可)，`AvatarDesign`/`AccessoryDesign` 字段见[设计 JSON](#设计-json-与配饰)，`MotionTarget` 的全部字段见下表。字符串枚举区分大小写。

### 基础、身体与眼睛

| HTML 属性 | React prop | React 类型 | 允许值 / 默认值 |
| --- | --- | --- | --- |
| `design` | `design` | `AvatarDesign` | HTML 使用完整设计 JSON 字符串；默认为 `createDesign()` 的 v7 设计 |
| `shape` | `shape` | `MaterialShapeName` | 35 个目录名称；沿用上层设计的形状，否则为 `square` |
| `body-color` | `bodyColor` | `string` | `#RRGGBB`；沿用上层设计颜色，否则为 `#FFCC37` |
| `eye-color` | `eyeColor` | `string` | `#RRGGBB`；沿用上层设计颜色，否则为 `#24242c` |
| `expression` | `expression` | `EyeExpression` | `neutral` / `smile` / `blink`；省略时保留设计中双眼的权重，初始为 `neutral` |
| `left-expression` | `leftExpression` | `EyeExpression` | 左眼 `neutral` / `smile` / `blink`；省略时使用共同 expression/设计值 |
| `right-expression` | `rightExpression` | `EyeExpression` | 右眼 `neutral` / `smile` / `blink`；省略时使用共同 expression/设计值 |
| `smile` | `smile` | `number` | 双眼微笑权重 0~1；省略时使用 expression/设计值，初始为 0 |
| `blink` | `blink` | `number` | 双眼闭眼权重 0~1；省略时使用 expression/设计值，初始为 0 |
| `left-smile` | `leftSmile` | `number` | 左眼微笑权重 0~1；省略时使用共同 smile/expression/设计值，初始为 0 |
| `right-smile` | `rightSmile` | `number` | 右眼微笑权重 0~1；省略时使用共同 smile/expression/设计值，初始为 0 |
| `left-blink` | `leftBlink` | `number` | 左眼闭眼权重 0~1；省略时使用共同 blink/expression/设计值，初始为 0 |
| `right-blink` | `rightBlink` | `number` | 右眼闭眼权重 0~1；省略时使用共同 blink/expression/设计值，初始为 0 |
| `accessories` | `accessories` | `readonly AccessoryDesign[]` | HTML 使用数组 JSON；省略时沿用设计中的装备，初始为 `[]`；指定时替换整个数组 |
| `render-style` | `renderStyle` | `RenderStyle` (`'flat'`) | 仅公开支持 `flat`，默认为 `flat`；HTML 中旧版 `3d` 输入会规范化为 `flat` |

### 装备位置

共有 **12 个预设、6 个独立位置**。所有位置初始均为空。省略位置选择时，使用 `accessories`/`design` 中的装备；指定 `none` 后，即使上层数据中存在装备，也会将其移除。选择类 prop 为下列预设字符串的联合类型，颜色 prop 为 `string`。

| HTML 属性 | React prop | 允许值 / 省略时的行为 |
| --- | --- | --- |
| `head-accessory` | `headAccessory` | `beret` / `halo` / `crown` / `none`；使用上层 `head` 位置的装备，初始为空 |
| `head-color` | `headColor` | `#RRGGBB`；保留头部装备原有颜色，新装备使用预设默认色 |
| `eyes-accessory` | `eyesAccessory` | `glasses` / `sunglasses` / `none`；使用上层 `eyes` 位置的装备，初始为空 |
| `eyes-color` | `eyesColor` | `#RRGGBB`；保留眼部装备原有颜色，新装备使用预设默认色 |
| `mouth-accessory` | `mouthAccessory` | `moustache` / `goatee` / `none`；使用上层 `mouth` 位置的装备，初始为空 |
| `mouth-color` | `mouthColor` | `#RRGGBB`；保留嘴部装备原有颜色，新装备使用预设默认色 |
| `neck-accessory` | `neckAccessory` | `bowTie` / `scarf` / `necklace` / `none`；使用上层 `neck` 位置的装备，初始为空 |
| `neck-color` | `neckColor` | `#RRGGBB`；保留颈部装备原有颜色，新装备使用预设默认色 |
| `left-ear-accessory` | `leftEarAccessory` | `earring` / `starEarring` / `none`；使用上层 `leftEar` 位置的装备，初始为空 |
| `left-ear-color` | `leftEarColor` | `#RRGGBB`；保留左耳装备原有颜色，新装备使用预设默认色 |
| `right-ear-accessory` | `rightEarAccessory` | `earring` / `starEarring` / `none`；使用上层 `rightEar` 位置的装备，初始为空 |
| `right-ear-color` | `rightEarColor` | `#RRGGBB`；保留右耳装备原有颜色，新装备使用预设默认色 |

预设默认色分别为：贝雷帽、领结、围巾 `#b84742`；光环、环形耳饰 `#f7cc5b`；眼镜、太阳镜、小胡子、山羊胡 `#31323d`；王冠 `#e5ad35`；项链 `#9b6c2a`；星形耳饰 `#a66a22`。

`eye-color`/`eyeColor` 控制**眼睛本身**的颜色，`eyes-color`/`eyesColor` 控制**眼镜等眼部装备**的颜色。空位置也可以预先指定颜色。移除位置选择后，下层 `accessories`/`design` 中的装备可能重新出现，因此请区分“移除属性”和 `none`。如需自定义 id，请使用 `accessories` JSON。

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

### 运行时、身体方向与动画

| HTML 属性 | React prop | React 类型 | 允许值 / 默认值 |
| --- | --- | --- | --- |
| `behavior` | `behavior` | `BotBehavior \| null` | HTML 使用 JSON 字符串，React 使用实际对象/Element；`null` 或移除会取消行为；参见下方声明式行为 |
| `activity` | `activity` | `Activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`；默认为 `idle` |
| `paused` | `paused` | `boolean` | 默认为 `false`；暂停循环动作 |
| `interaction` | `interaction` | `'none' \| 'box'` | 默认为 `none`；`box` 启用拖动、点击和键盘激活 |
| `tracking-mode` | `trackingMode` | `TrackingMode` | `off`、`eyes`、`eyes-and-body`（默认）；仅眼睛或眼睛与身体跟踪 |
| `mouse-tracking` | `mouseTracking` | `boolean` | 旧版眼睛跟踪别名；`true` → `eyes`，`false` → `off`；显式 `tracking-mode` 优先 |
| `body-orientation` | `bodyOrientation` | `BodyOrientationPreset \| Partial<BodyOrientation>` | HTML 使用 `front` / `three-quarter` / `side`，默认为 `front`；React 也接受 `{yaw,pitch,roll}` 的部分对象 |
| `body-yaw` | `bodyYaw` | `number` | -360~360 度；沿用 bodyOrientation 预设的 yaw，否则为 0 |
| `body-pitch` | `bodyPitch` | `number` | -90~90 度；沿用 bodyOrientation 预设的 pitch，否则为 0 |
| `body-roll` | `bodyRoll` | `number` | -180~180 度；沿用 bodyOrientation 预设的 roll，否则为 0 |
| `zoom` | `zoom` | `number` | 0.5~3 倍，默认为 1；以中心为基准缩放；移除后恢复为 1 |
| `gaze-x` | `gazeX` | `number` | -1~1，默认为 0；关闭鼠标跟踪时使用的显式视线 |
| `gaze-y` | `gazeY` | `number` | -1~1，默认为 0 |
| `shape-duration` | `shapeDuration` | `number` | 形状属性过渡时长 0~60000ms，默认为 450 |
| `shape-easing` | `shapeEasing` | `MotionOptions['easing']` | `smooth` / `linear`，默认为 `smooth` |
| `motion-duration` | `motionDuration` | `number` | 眼睛与姿态属性过渡时长 0~60000ms，默认为 400 |
| `motion-easing` | `motionEasing` | `MotionOptions['easing']` | `smooth` / `linear`，默认为 `smooth` |
| `motion` | `motion` | `MotionTarget` | HTML 使用 JSON 字符串；初始姿态的旋转与脸部位移为 0，共同睁眼值为 1，左右眼使用设计中的权重 |
| `time` | `time` | `number` | 循环动画时间 0~86400 秒，默认为 0；这是 seek 输入，而非逐帧更新的读取值 |

React 的 `bodyOrientation={{ yaw: 35 }}` 会映射到 `body-yaw` 属性。若同时提供同一轴的独立 prop `bodyYaw`，则独立 prop 优先。缩放由单独的 `zoom={1.4}` prop 控制，移除后恢复默认值 1。对象中省略的轴在新元素中为 0；移除之前由封装管理的轴时，会回到声明式默认值。命令式 `setBodyOrientation({yaw:35})` 则保留未指定轴的当前值。

`MotionTarget` 是部分目标，未指定的通道保持不变。全部支持的嵌套字段如下。

| `motion` 字段 | 类型与范围 | 初始值 / 含义 |
| --- | --- | --- |
| `body.rotation` | `[number, number, number]`，每项 -2π~2π 弧度 | `[0,0,0]`，身体旋转 |
| `face.uv` | `[number, number]`，每项 -0.5~0.5 | `[0,0]`，脸部位置的运行时位移 |
| `eyes.left.weights.smile`, `eyes.right.weights.smile` | `number`，0~1 | 各眼睛在设计中的权重，初始为 0 |
| `eyes.left.weights.blink`, `eyes.right.weights.blink` | `number`，0~1 | 各眼睛在设计中的权重，初始为 0 |
| `eyes.openness` | `number`，0~1 | 1，共同睁眼限制 |
| `accessories.<id>.rotation` | `[number, number, number]`，每项 -π~π 弧度 | `[0,0,0]`，当前已装配的唯一 id 对应的旋转 |
| `eyes.left.expression`, `eyes.right.expression` | `EyeExpression` | 旧版兼容输入；将 `neutral` / `smile` / `blink` 转换为权重 |
| `eyes.left.openness`, `eyes.right.openness` | `number`，0~1 | 旧版兼容输入；转换为闭眼权重 |

同一只眼睛混用 `weights` 与旧版 `expression`/`openness` 会报错。新代码请使用 `weights`。`motion={}`/`motion="{}"` 表示没有新增目标通道，不会重置姿态。移除 `motion` prop/属性时，会按下方移除规则恢复默认姿态。身体方向角使用**度**，姿态旋转使用**弧度**。

### React 引用与事件 props

本表中的 props 不作为 HTML 属性使用。HTML 中请通过 `addEventListener()` 订阅下方 DOM 事件。回调收到原始 `CustomEvent`，而非 React SyntheticEvent，返回值为 `void`。所有回调均默认为 `undefined`，省略时不会调用。

| React prop | 类型 | 值与行为 |
| --- | --- | --- |
| `ref` | `React.Ref<SidekickAvatarRef>` | 默认无；支持对象 ref 或回调 ref；实际自定义元素升级后传入，清理时解除 |
| `onBehaviorChange` | `SidekickEventHandler<'sidekick-behavior-change'>` | `CustomEvent<BehaviorState>`；行为状态与检查进度 |
| `onBehaviorEnd` | `SidekickEventHandler<'sidekick-behavior-end'>` | `CustomEvent<BehaviorResult>`；完成、取消或运行时错误 |
| `onReady` | `SidekickEventHandler<'sidekick-ready'>` | `CustomEvent<{}>`；应用 props 后渲染就绪 |
| `onError` | `SidekickEventHandler<'sidekick-error'>` | `CustomEvent<SidekickErrorDetail>`；`message: string`，以及可选的 `attribute: string`、`value: string \| null`、`recoverable: boolean` |
| `onDesignChange` | `SidekickEventHandler<'sidekick-design-change'>` | `CustomEvent<{design: AvatarDesign}>` |
| `onBodyOrientationChange` | `SidekickEventHandler<'sidekick-body-orientation-change'>` | `CustomEvent<{bodyOrientation: BodyOrientation}>` |
| `onZoomChange` | `SidekickEventHandler<'sidekick-zoom-change'>` | `CustomEvent<{zoom: number}>` |
| `onMotionEnd` | `SidekickEventHandler<'sidekick-motion-end'>` | `CustomEvent<{finished: boolean}>` |
| `onShapeEnd` | `SidekickEventHandler<'sidekick-shape-end'>` | `CustomEvent<{finished: boolean}>` |
| `onActivate` | `SidekickEventHandler<'sidekick-activate'>` | `CustomEvent<{}>`；点击或 Enter/Space 激活 |

其余 props 遵循 `HTMLAttributes<SidekickAvatarRef>`，例如 `id?: string`、`className?: string`、`style?: React.CSSProperties`、`aria-*`、`data-*` 及普通 DOM 事件。封装不支持 `children` 和 `dangerouslySetInnerHTML`。`onError` 定义为上述 Sidekick 错误回调。`key` 是 React 的元素标识，不属于 HTML 属性或 Sidekick 配置。

### 更改、移除与错误规则

- 与原生 HTML boolean 不同，这里的 boolean 也会解析字符串 `"false"`。`mouse-tracking`、`mouse-tracking=""`、`mouse-tracking="true"`、`mouse-tracking="1"` 表示开启，`="false"`、`="0"` 表示关闭。移除 `mouse-tracking` 且没有 `tracking-mode` 时，会恢复默认 `eyes-and-body`；存在 `tracking-mode` 时，则优先使用该模式。`paused` 使用相同的 boolean 表记方式，移除属性后关闭。React 中请使用 `{true}` / `{false}`。React 的 `false` 是显式关闭，与省略 prop 不同。不支持 `null`、`"TRUE"`、`"yes"` 等值。
- 为支持的属性提供错误的形状名称、预设、JSON、数字范围或颜色格式时，会报错。未被观察的任意 HTML 属性仍是浏览器普通属性，不会应用为库配置。不支持颜色缩写 `#fff`、CSS 颜色名称、`NaN` 或 `Infinity`。如需省略值，请移除属性，不要使用空字符串。
- React 的 `undefined`/省略以及 HTML 的 `removeAttribute()` 仅解除该输入的覆盖；若存在下层 `design` 输入，则使用其值。必须清空某个位置时请指定 `none`，必须清空装备数组时请指定 `[]`。
- 在同一个 JavaScript 任务内更改的多个属性，会在下一个微任务中合并验证和应用。无效批次会保留之前有效的运行时状态，并触发 `sidekick-error`。原始输入字符串仍保留在 DOM 中，因此需要修正或移除出错的属性。
- 初始 HTML 属性在第一次渲染前应用。连接后，`shape`、眼睛权重及 `motion` 的更改会按对应 timing 属性进行过渡。仅更改 timing 不会重新启动正在进行的过渡。
- 设计属性以 `design` 为基础数据，单独属性仅覆盖对应部分。移除单独属性后，会显露下层声明式数据或默认值。`accessories` 更改基础装备数组，位置属性在其上进一步应用。
- 眼睛的优先级为 `design` → 共同 `expression` → 单眼 expression → 共同 `smile`/`blink` → 单眼权重。单独轴优先于身体方向预设。移除 `gaze-x`/`gaze-y` 会将对应轴恢复为 0；移除 `motion` 会将身体、脸部、装备旋转和共同睁眼值恢复默认值，左右眼则恢复为已保存设计的权重。
- 无关属性的更改不会重置通过命令式 API 修改的其他值或其他动画。设计 JSON 不保存身体方向、活动、暂停、鼠标跟踪、过渡时长或运行时姿态。

```js
bot.setAttribute('shape-duration', '600');
bot.setAttribute('shape', 'heart');
bot.setAttribute('left-smile', '0.8');
await Promise.resolve(); // 같은 작업의 속성 적용 이후

bot.setAttribute('tracking-mode', 'off');
bot.removeAttribute('body-color'); // design의 색 또는 기본 색으로 복원
bot.setAttribute('head-accessory', 'none'); // design에 모자가 있어도 해제
```

## 声明式行为 (behavior)

`behavior` 是一个用于声明应用所需行为的确定性 API，不使用 LLM、自然语言推理或网络请求。实际的加载、保存与验证状态由应用判断，Sidekick 根据声明组合移动与既有活动、表情。`wait` 不会检查服务器任务，`review` 也不会验证条目内容。

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

| 声明 | 目标与时间 | 行为 |
| --- | --- | --- |
| `{ type: 'wait', target }` | CSS selector 或同一文档中的 `Element` | 移动到目标旁等待，持续至被替换或取消 |
| `{ type: 'follow', target }` | CSS selector 或同一文档中的 `Element` | 移动到目标旁，并跟随目标的位置变化，持续至被替换或取消 |
| `{ type: 'guide', target }` | CSS selector 或同一文档中的 `Element` | 移动到目标旁作出引导动作，持续至被替换或取消 |
| `{ type: 'review', targets }` | CSS selector 或 `readonly Element[]` | 按顺序访问目标列表；每个目标的 `dwell` 默认为 1000ms |
| `{ type: 'celebrate' }` | `duration` 默认为 1600ms | 执行庆祝动作后完成 |
| `{ type: 'error' }` | `duration` 默认为 1800ms | 执行提示错误的动作后完成 |
| `{ type: 'idle' }` | 默认无限期 | 执行待机动作，持续至被替换或取消 |

- `wait`、`follow`、`guide` 和 `idle` 可选填 `duration`，以自动完成。有目标的行为，其 `duration` 从到达后开始计时。所有时间单位均为 ms。
- 需要目标的行为接受 `side: 'right'`（默认）/ `'left'` / `'above'` / `'below'`、`gap: 16`（默认，CSS px）以及 `timeout: 5000`（默认，ms）。移动速度与加速度沿用现有移动设置。保持当前父 DOM 与 `placement`，不会移动到其他容器。
- selector 在文档中查找。`wait`、`follow`、`guide` 使用第一个匹配且已连接的元素。如果目标尚不存在，则等待 DOM 变化；在 `timeout` 内仍未出现时，以 `error` 结束。`Element` 也会等待其连接到同一文档。无效 selector 属于输入错误。
- `review` 的 selector 在首次找到已连接的目标时，对列表进行一次快照。显式 `Element[]` 立即快照，并跳过未连接的条目；如果没有剩余条目，立即完成。selector 使用文档顺序，数组使用传入顺序。快照后新增的条目不会纳入，已移除的条目会跳过。如需重新读取列表，请启动新的 `perform()`。
- 可以在将元素添加到文档前设置 `behavior` 属性或 HTML 声明，行为会在连接后开始。`perform()` 则应在已连接的元素上调用；若元素未连接，会返回 `status: 'error'` 结果。
- 新声明会以 `cancelled` 结束并替换旧行为。`stopBehavior()`、`behavior = null`、移除 HTML 属性、移除 React prop，以及元素断开连接也会取消行为。向 `perform(declaration, { signal })` 传入 `AbortSignal` 后，可以通过 `abort()` 取消。
- 若对行为所管理的移动、活动或视线发出新命令，会解除该行为的控制。例如，直接调用 `moveTo()` 或 `motion.to()`，或更改活动、跟踪属性时，会取消行为并应用新输入。旧行为的清理不会覆盖新输入。
- 声明会先验证，再更改当前行为。无效 JavaScript 方法/属性输入会抛出异常；HTML/React 输入错误通过 `sidekick-error` / `onError` 传递。有效 `perform()` 的 Promise 在实际结束时以 `BehaviorResult` 兑现。目标 timeout 等运行时失败为 `status: 'error'`，替换或取消为 `status: 'cancelled'`。请确认是否完成后再启动下一步。
- `bot.behaviorState` 以及 `sidekick-behavior-change` 的 `detail` 为 `{ id, type, status, itemIndex, itemCount, completedItems }`。状态有 `idle`、`resolving`、`moving`、`acting`、`completed`、`cancelled`、`error`；`itemIndex` 从 0 开始，选择目标前为 -1。结束事件与 Promise 结果为 `{ id, type, status, reason?, completedItems }`。

### 等待实际加载完成

目标容器须在请求前已存在于 DOM。应用应等待服务器任务结束，再切换为庆祝或错误行为。请求结束前，不要为行为设置任意的自动完成时长。

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

### 按顺序检查条目

`review` 是依次访问各条目的可视化动作。实际检查结果请通过独立的应用逻辑处理。若行为被中断或没有目标，不应开始庆祝动作。

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

### React：将应用状态连接到行为

`behavior` 不会被序列化为字符串属性，而是在元素升级后直接传给实际 JavaScript 属性。它保留 `Element` 身份和数组顺序；即使重新渲染内容相同的内联对象，也不会重新启动行为。React 不会在 SSR 中查询 DOM 或执行行为。服务端渲染请使用 selector，实际 `Element` 请在客户端取得后再传入。如需有意重新启动一个有限行为，请调用 ref 上的 `perform()`。

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

### HTML JSON 声明

HTML 的 `behavior` 是 JSON，因此目标使用 selector 字符串。实际 `Element` / `Element[]` 只能通过 JavaScript 属性或 React prop 传入。

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

## 鼠标跟踪与拖动

`tracking-mode` / `trackingMode` 通过一个值选择整体跟踪方式。默认值为 `eyes-and-body`。即使省略属性或 React prop，眼睛与身体也会跟随鼠标。

- `off`：不跟踪鼠标，恢复到最后一次 `lookAt()` 或 `gaze-x`/`gaze-y` 指定的显式视线。
- `eyes`：仅眼睛跟随鼠标，原有身体姿态和动作保持不变。
- `eyes-and-body`：身体随眼睛一起小幅、平滑地转向鼠标。身体旋转是叠加于既有动作上的独立渲染层，不修改 `pose.rotation`、动作进度或身体方向。

```ts
import type { TrackingMode } from '@hanana-kick/sidekick/core';
const mode: TrackingMode = 'eyes-and-body';
bot.trackingMode = mode;
// HTML: <sidekick-avatar tracking-mode="eyes-and-body"></sidekick-avatar>
// React: <SidekickAvatar trackingMode="eyes-and-body" />
```

仍支持旧版 `mouse-tracking` / `mouseTracking`。没有命名模式时，`true` 解释为 `eyes`，`false` 解释为 `off`。两者并存时始终以 `tracking-mode` 优先；移除该属性后，会重新应用仍存在的 `mouse-tracking` 设置。两者均不存在时，恢复默认 `eyes-and-body`。`bot.mouseTracking = false` 会保留显式 `mouse-tracking="false"`，与旧版一样关闭跟踪。读取 `bot.mouseTracking` 时，两种跟踪模式均返回 `true`。使用命名模式后，如需关闭，请使用 `bot.trackingMode = 'off'`。

跟踪整个文档中的鼠标，忽略触摸与笔输入。切换模式、关闭、离开窗口或失去焦点时，会从当前位置平滑回归；隐藏或断开连接期间会移除跟踪监听器。断开连接时会重置不可见的身体层，重新连接后等待新的指针输入。拖动期间暂停跟踪输入，避免与身体方向操作竞争。减少动态效果设置会抑制身体跟踪，并仅平滑消除已有偏移。在 `paused` 状态下，身体跟踪停在当前位置，眼睛视线则立即更新。但关闭跟踪或切换到仅眼睛模式时，仅平滑消除身体层，活动和基础姿态的时间仍保持暂停。

`interaction` 是独立设置。

- `none`（默认）：整个元素允许点击穿透；此状态下仍可开启鼠标跟踪。
- `box`：整个矩形区域支持拖动以旋转身体方向，并通过点击、Enter、Space 发送 `sidekick-activate`。透明像素也属于点击区域。

`paused` 会停止循环动作，正在进行的过渡会在目标状态完成。`activity="still"` 关闭循环活动，但仍可执行显式的形状、眼睛与姿态过渡。启用 `prefers-reduced-motion` 时，新过渡也会立即应用。

## 设计 JSON 与配饰

当前保存格式为 **v7**。外观包括身体的 `shape`、`color`，眼睛的 `color`，以及配饰的 `id`、`preset`、`slot`、`color`；左右眼的 `weights` 则属于表情动画状态。

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

- `createDesign(patch)` 会填充默认值。双眼默认权重均为 `{ smile: 0, blink: 0 }`，装备默认为 `[]`。只有 Studio 会在初始状态添加贝雷帽。
- `patchDesign(current, patch)` 不修改原对象，并对眼睛权重进行深度合并。传入 `accessories` 时，会替换整个数组。`bot.updateDesign()` 使用相同规则。
- 每个位置最多一件，总计最多 6 件。贝雷帽、光环、王冠共用头部位置，领结、围巾、项链共用颈部位置。环形/星形耳饰必须明确指定 `leftEar` 或 `rightEar`。
- id 必须是以小写英文字母开头、由小写字母、数字和连字符组成的唯一字符串，最多 40 个字符。`createAccessory()` 会生成默认 id，但多个配饰一起使用时，请自行确保 id 不重复。
- `equipAccessory(design, item)` 仅替换对应位置，`removeAccessory(design, id)` 仅移除对应实例。元素提供同名异步方法。
- `parseDesign(objectOrJson)` 严格验证版本、未知键、数字、颜色、id、位置和重复装配，并返回独立副本。JSON 字符串不得超过 64KiB。验证失败会抛出异常或导致 Promise rejection，并保留之前的设计。

王冠为 35 种身体形状分别指定支撑顶点、峰部和佩戴倾角。与贝雷帽一样，身体会进入中空开口，但不会弯曲金属王冠网格或沿各轴拉伸。仅调整位置、旋转和等比例尺寸，即使在形状过渡中也保持同一刚体形态。圆润身体与刚性圆环接触的部分位置可能保留自然间隙。

HTML 中的复合数据需使用有效 JSON 字符串。

```html
<sidekick-avatar
  shape="clover4Leaf"
  accessories='[{"id":"frames","preset":"glasses","slot":"eyes","color":"#334155"}]'
  left-smile="0.7"
  right-blink="0.4"
></sidekick-avatar>
```

身体的尺寸、深度、变形、`profiles`，眼睛的宽度、高度、间距、位置、`targets`，以及配饰的大小、安装位置和跟随参数，均不是公开的外观参数。将它们加入 v7 JSON 会被拒绝。各形状的比例和装配位置由内部适配，运行时姿态动作则单独提供。

### 场景 JSON 文件

Studio 的 JSON 文件和代码示例使用 `sceneVersion: 3` 封装，在当前设计之外加入运行时设置。它与 `design.version: 7` 是不同的版本号。文件名为 `sidekick.scene.json`，也可导入旧版仅保存设计的文件。

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

`createScene()` 的默认跟踪模式为 `eyes-and-body`，并为 `design`、`bodyOrientation: {yaw,pitch,roll}`、独立的 `zoom`、`activity`、`paused`、`trackingMode`、`interaction`、`renderStyle`、`gaze: {x,y}`、`time`、`motion`、`shapeDuration`、`shapeEasing`、`motionDuration` 和 `motionEasing` 填充默认值。`parseScene()` 严格验证完整的 `sceneVersion: 3` 封装。不支持旧版场景及 `camera`/`view` 配置键，也不会自动转换；请改写为新键，或在 Studio 中重置。任意几何值、未知键、指向无效装备 id 的动作，以及不支持的版本均会被拒绝。`migrateScene()` 可接受仅设计文件，为其附加默认运行时设置。

Studio 的导入和重置会通过 `resetTracking()` 立即清除旧的实时跟踪偏移，防止其残留在新场景中。普通模式切换仍保留上述平滑回归行为。

场景重现的是**设定的目标和时间值**，并不录制播放中的精确中间帧、自动眨眼相位、实时鼠标坐标或浏览器背景。启用鼠标跟踪时，会重新跟随导入页面上的鼠标。`motion` 是独立于已保存设计的运行时目标。

Studio 的“打开 JSON 文件”和文本“应用 JSON”会先验证完整数据，再一次性应用。最大大小为 64KiB（UTF-8）。失败时保留当前设计、身体方向、正在进行的动画及本地保存内容。连续选择多个文件时，仅应用最后一次选择；重置、直接编辑或卸载会取消等待中的文件读取。场景文件还会恢复身体方向、跟踪、活动、暂停、时间与姿态目标；旧设计文件则将预览设置恢复为默认值。

### 导入旧文件

`parseDesign()` 也会验证 v1~v6，并转换为 v7。如需迁移提示，请使用 `migrateDesign(input)` 返回的 `{ design, warnings }`。旧 `face` 位置会改为 `eyes`，同时保留 id、颜色和表情。旧版自定义身体会近似为最接近的目录轮廓；已移除的几何参数在验证后丢弃。这并非精确还原原始外观的功能。未知键、无效几何参数及重复位置会被拒绝，而不是静默丢弃。

v1 的 `capsule`/`round` 眼睛会转换为中性表情，`arc` 转换为微笑。v2/v3 的 `expression`、`openness` 会转换为微笑和闭眼权重，v4~v6 的权重则原样保留。v6 装备输入仅接受原有的 `beret`、`halo`、`glasses` 以及 `head`、`face`。新装备和六个位置请使用 v7。

## 动画与命令式 API

### 形状与表情

```ts
const first = bot.setShape('puffy'); // 450ms, smooth
const next = bot.setShape('pixelTriangle', { duration: 650, easing: 'linear' });
console.log(await first); // { finished: false }: 새 목표로 대체
console.log(await next);  // { finished: true }

await bot.setEyeWeights('left', { smile: 0.85 }, { duration: 300 });
await bot.setEyeWeights('right', { blink: 0.4 }, { duration: 180 });
await bot.setExpression('both', 'neutral');
```

35 种形状之间的过渡会从当前可见轮廓继续变换至下一个目标。目标名称会立即写入 `design.body.shape`，JSON 中不保存变形中间几何。编辑颜色和装备不会打断正在进行的形状过渡。通过元素的 JavaScript `design` 属性/`setDesign()` 更改形状时，会立即应用；通过 HTML `design` 属性和 React `design` prop 更改形状时，则按 `shape-duration`/`shapeDuration` 过渡。在减少动态效果、暂停或元素未连接的情况下，过渡会立即应用。

眼睛的 `smile` 和 `blink` 均为 0~1，不会将两者之和归一化为 1。`left` 指正面画面左侧，即模型 -X；`right` 为 +X。部分权重更改会保留未指定值及另一只眼睛。预设精确对应 `neutral → {smile:0,blink:0}`、`smile → {smile:1,blink:0}`、`blink → {smile:0,blink:1}`。`blink` 会保持闭眼状态，如需重新睁眼，请发送 `neutral` 或新权重。

命令式过渡的默认时长为：`setShape()` 450ms，`setEyeWeights()`/`motion.to()` 400ms，`setExpression()` 的 blink 90ms、neutral 180ms、smile 280ms。显式 `options` 优先；`duration` 范围为 0~60000ms，`easing` 为 `smooth` 或 `linear`。HTML timing 属性用于声明式属性过渡。

### 身体方向与姿态

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

`BodyOrientation` 仅包含 `{yaw, pitch, roll}` 角度（度）。`createBodyOrientation()` 将三轴初始化为 0。`setBodyOrientation()` 仅更改指定轴，`setBodyOrientationPreset()` 保留缩放值。`zoom` 是独立数字，默认值为 1，允许范围为 0.5~3。核心还提供 `createZoom()` 与 `ZOOM_RANGE`。场景 JSON 以 `sceneVersion: 3` 分别保存 `bodyOrientation` 与 `zoom`，设计 JSON 不包含这两项设置。不提供旧版 `camera`/`view` API、属性、prop 或事件别名。

在 `interaction="box"` 预览中，单指/鼠标拖动用于旋转；滚轮、触控板（含捏合产生的 Ctrl+wheel）和双指捏合用于以中心为基准缩放。会规范化像素/行/页滚轮单位，并按乘法比例调整缩放。捏合中心点移动不会产生平移。设置面板仍正常滚动；`interaction="none"` 不接受旋转或缩放操作。缩放期间，形状、身体和眼睛动画继续运行，光标跟踪会回到中性位置，并在新的指针移动后重新开始。

较高缩放倍率下，角色或配饰可能被画布边界裁切。PNG 仅保存当前放大画面中可见的像素，因此如需导出完整外观，请先重置或降低缩放倍率。缩放仅作用于渲染器的正交投影，不改变模型大小和纵横比。


身体方向指固定画面内角色身体的朝向。`front` 的 yaw 为 0°，`three-quarter` 为 45°，`side` 为 90°；所有预设的 pitch 和 roll 均为 0°。正 yaw 将正面转向画面右侧，正 pitch 向下，正 roll 在画面中逆时针旋转。身体方向值不会修改已保存设计和基础姿态。

`MotionTarget` 可指定身体旋转三轴（每轴 -2π~2π）、脸部 uv 两轴（每轴 -0.5~0.5）、左右眼权重、共同睁眼限制 `eyes.openness`（0~1），以及每个已装配 id 的旋转三轴（每轴 -π~π）。共同睁眼值是旧版兼容的运行时限制，并非需要单独保存的表情状态。姿态动作不修改设计 JSON。

身体、脸部、左右眼、共同睁眼值以及各件装备均拥有独立时间轴。重新控制某一通道不会重启无关通道。被打断的请求以 `{ finished: false }` 结束，完成的请求以 `{ finished: true }` 结束。在屏幕外或不活跃标签页中，会停止帧循环。

| 元素 API | 用途 |
| --- | --- |
| `design`, `setDesign(designOrJson)` | 读取/整体替换设计；`design` getter 返回副本 |
| `updateDesign(patch)` | 部分更改外观和眼睛权重 |
| `equipAccessory(item)`, `removeAccessory(id)` | 替换位置装备/移除实例 |
| `setShape(name, options)` | 保存形状目标并过渡 |
| `setEyeWeights(side, weights, options)` | 保存并过渡左眼、右眼或双眼的部分权重 |
| `setExpression(side, preset, options)` | 保存表情预设并过渡 |
| `setActivity(name)`, `activity` | 设置活动、读取当前活动 |
| `resetTracking()` | 立即重置实时指针视线和身体偏移，并恢复最后手动视线；保留模式、基础姿态和身体方向 |
| `trackingMode`, `mouseTracking`, `paused`, `interaction`, `renderStyle` | 读取/设置对应行为 |
| `lookAt({space:'view',x,y})` | -1~1 范围的显式视线 |
| `bodyOrientation`, `setBodyOrientation(patch)` | 读取/部分设置 `BodyOrientation`；角度单位为度，getter 返回副本 |
| `setBodyOrientationPreset(name)` | 正面、斜侧面、侧面方向预设，保留缩放 |
| `zoom` | 读取/设置独立缩放倍率；0.5~3，默认为 1 |
| `motion.to(target,options)`, `motion.cancel()` | 姿态过渡/取消所有姿态通道 |
| `seek(seconds)` | 指定循环动画时间，范围 0~86400 秒 |
| `pose` | 最近由渲染引擎确认的姿态副本，只读；worker 模式下异步更新 |
| `snapshot({crop,padding}?)` | 渲染就绪后返回透明 PNG 的 `Promise<Blob>`；默认按 alpha 边界裁切 |
| `capturePixels()` | 同步读取最近已显示的完整画布；不会等待发往 worker 的最新命令 |
| `capturePixelsAsync()` | 等待最新命令之后的新帧，返回 `Promise<{width,height,pixels}>`；RGBA 从底行开始 |
| `ready`, `diagnostics` | 就绪状态、`worker`/`main` backend、世代与命令确认编号、动画时间、帧数、draw call 数和缓冲区数量 |

## OffscreenCanvas 与渲染

在支持的浏览器中，元素会通过 `transferControlToOffscreen()` 将 canvas 交给专用 Web Worker。网格、动作/形状过渡、视线跟踪弹簧及 WebGL 渲染均由 worker 处理。主线程负责 DOM、无障碍、输入、尺寸观察及命令转发。可通过 `bot.diagnostics.backend` 确认实际采用 `worker` 还是 `main` 路径。

自托管时，请以正确的 JavaScript MIME，从与页面相同的 origin 提供 worker 文件。浏览器安全策略不允许直接使用其他 origin 的 Worker URL。使用 CSP 的网站需要以 `worker-src 'self'` 等策略允许该 worker。同源自托管无需 Blob worker 或额外安全响应头；跨源 CDN 加载采用前文说明的 Blob module worker 方式，并需要相应 CSP 设置。若支持不足、CSP/文件加载失败或 worker 初始化失败，会替换为新的 canvas，并恢复到主线程渲染器。

设计、身体方向设置和输入验证会立即反映，但 worker 的姿态/像素会异步返回。如需命令执行后准确的画面，请使用 `await bot.capturePixelsAsync()` 或 `await bot.snapshot()`。PNG 导出会等待新的渲染帧。断开连接会清理 worker、GPU 资源及输入监听器；重新连接时，会启动新的渲染世代。

浏览器行为约定可参考 [OffscreenCanvas 转移](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen)及 [CSP worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src)。已经转移或创建了上下文的 canvas 无法再次转移，因此恢复时会替换内部 canvas；宿主元素与 React ref 保持不变。


## 事件与清理

事件为 `CustomEvent`，会跨越 Shadow DOM 边界冒泡。React 封装也将同一事件对象传给回调。

| DOM 事件 | React 回调 | `detail` |
| --- | --- | --- |
| `sidekick-behavior-change` | `onBehaviorChange` | `BehaviorState`: id, type, status, itemIndex, itemCount, completedItems |
| `sidekick-behavior-end` | `onBehaviorEnd` | `BehaviorResult`: id, type, status, reason?, completedItems |
| `sidekick-ready` | `onReady` | `{}` |
| `sidekick-error` | `onError` | `{ message, ... }`；可恢复的上下文丢失会带有 `recoverable: true` |
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

PNG 默认使用 `crop: true`、`padding: 0`，按当前角色全部不透明/半透明像素的边界裁切。配饰也包含在内，背景保持透明。`padding` 为 0~4096 的整数像素；如需原始画布尺寸，请使用 `snapshot({ crop: false })`。完全为空时返回透明 1×1px 图像（另加边距）。使用 `await capturePixelsAsync()` 可读取准确的最新像素；同步 `capturePixels()` 在 worker 模式下仅读取最近显示的帧。两种方法均保留完整画布尺寸，也可使用 `/core` 中的 `alphaBounds()` 和 `cropPixels()`。

如需接收初始 `ready`/错误事件，请在元素加入文档前添加监听器，或使用 React 回调。元素已连接时，请先检查 `ready`。`setDesign()` 等方法的 Promise 错误也应通过 `try/catch` 处理。

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

React 在卸载时会清理封装监听器和元素。自行创建的 PNG 下载 Object URL，请在使用后调用 `URL.revokeObjectURL()` 释放。重新连接元素时，会根据已保存设计创建渲染器，正在进行的过渡则取消。WebGL 上下文丢失时会发送错误，恢复后重新初始化渲染器。

## SSR 与浏览器支持

在服务端请通过 `/core` 创建并序列化设计。模块导入本身无需 DOM 全局对象，但实际的 Custom Element 注册、创建及 WebGL 渲染必须在浏览器进行。React 封装在 SSR 中生成仅包含普通 HTML/aria/style 的空宿主，在客户端应用 props 并注册元素。不要假设 SSR 已生成应用了 props 的角色像素或完整设计属性。`ref` 在升级后就绪，`onReady` 在 props 应用后触发。使用 React 封装的 Next.js 组件应设置 `'use client'` 边界。不提供服务端 PNG 生成 API。

服务端 HTML 中的默认标签会在浏览器注册后升级。保持同一 DOM 实例并设置固定 CSS 尺寸，可以减少加载时的布局偏移。直接 SSR HTML 时，初始属性使用字符串/JSON，这与 DOM 属性赋值不同。可参考 [React 的 Custom HTML Elements 说明](https://react.dev/reference/react-dom/components#custom-html-elements)。

需要支持 WebGL2 与 Custom Elements 的现代浏览器。图形初始化失败时，会在元素内显示可读的 fallback，并发送 `sidekick-error`。默认元素具有图像角色；在 `interaction="box"` 中则具有可通过键盘激活的按钮角色。请指定说明其用途的 `aria-label`。库会处理屏幕外/不活跃标签页暂停、reduced-motion、尺寸变化，以及移除时的 GPU 资源释放。

## Studio 与开发

Studio 是独立编辑器，使用 **React 19 + Vite 8 + Tailwind CSS 4 + 真正的 shadcn/ui Radix/Nova 组件**及 Slate 颜色令牌实现。使用核心的网站不会引入这些 UI 依赖。以下命令面向源码开发者，需要 Node.js 22.22.2 或更高版本。

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

仅在需要外部访问时使用 `HOST=0.0.0.0`。端口通过 `PORT` 更改。静态 Studio 部署使用整个 `dist/`，构建会生成根目录 `dist/index.html`、兼容路径 `dist/playground/index.html` 和带哈希的 `dist/assets/`。npm 软件包包含 `dist/library/` 与 `dist/browser/`，而非 Studio 输出。使用方无需执行这些开发构建命令。`pack:release` 需要已提交所有修改和预构建产物的干净 checkout，以及系统 `zip` 命令；它不会自动发布 GitHub Release。

### Studio 的功能

- 外观：35 个可搜索、可键盘导航的轮廓图块，身体与眼睛颜色，带实际渲染缩略图的 12 种装备及各位置颜色
- 动画：活动、暂停，鼠标跟踪关闭/仅眼睛/眼睛与身体，显式视线，形状过渡时长与 easing，左右眼微笑与闭眼权重
- 身体方向：yaw、pitch、roll，正面/斜侧面/侧面预设，与预览拖动双向同步
- JSON：文件/文本导入导出，反映当前设置的 HTML/React 代码及复制按钮，按 alpha 边界裁切的透明 PNG 保存

桌面端将预览和设置并排显示。移动竖屏固定预览，仅滚动下方设置；高度较短的横屏则并排显示。使用 `100dvh` 与 safe-area。选项卡、滑块和切换控件保留 shadcn/Radix 的键盘行为。字体包含在本地构建包内。预览中的棋盘格、浅色、深色均是 DOM 背景，不会包含在 PNG 中。

自动保存会将完整场景写入本浏览器的 `sidekick.studio.scene.v3`，并将设计单独保存在 `sidekick.design.v7`，供旧版回退使用。场景包含设计、身体方向、缩放、视线、活动、跟踪、时间、交互、动作、暂停和过渡设置，不包含宿主页面的布局、移动坐标或正在执行的行为。文件导出同样使用场景封装。若没有已保存的 v7 设计，会按 v6→v1 的顺序读取并转换，同时保留旧键中的原始数据。无效原始数据会在 JSON 选项卡中打开；首次编辑时，必须成功写入 `.recovery` 备份后才会保存新数据。存储受限时，请使用 JSON 导出。重置会恢复默认 square+贝雷帽、正面身体方向以及眼睛与身体鼠标跟踪。API 体验和指南读取同源保存的场景，但其临时命令不会修改 Studio 保存值。

UI 配置位于 `components.json` 和 `playground/components/ui/`，保存、命令与恢复逻辑位于 `studio-controller.ts`。React 重新渲染和切换选项卡会保留同一个稳定元素，不会重置正在进行的形变或身体方向。使用的是按[官方 shadcn/ui Vite 安装方式](https://ui.shadcn.com/docs/installation/vite)生成的实际源码。

### GitHub Pages 部署

本公开仓库基于 GitHub Actions 的 Pages 地址为 [hanana-kick.github.io/sidekick/](https://hanana-kick.github.io/sidekick/)。`.github/workflows/pages.yml` 是用于更新现有公开 Studio 的手动工作流。选择通过 CI 的提交后，**手动运行时必须明确批准 `approve_public_deployment`**，才会构建和部署。仅推送提交或添加工作流文件不会触发部署。

工作流通过 `actions/configure-pages` 仅读取现有配置，不会启用 Pages，也不会更改域名、公开范围或安全设置。默认 Vite base 为 `./`，因此**通过 `npm run build:all` 生成的同一份 `dist/`**，同时适用于自定义域名的 `/` 和 GitHub Pages 的 `/sidekick/`。支持各位置的 `index.html`，以及 `playground/`、`playground/index.html` 入口；脚本、样式、字体、装备缩略图和 favicon 均从相应部署位置加载。首页链接和计算出的缩略图 URL 以构建模块位置为基准，而非当前文档深度。

如需仅面向固定路径部署，可以通过 `SIDEKICK_BASE=/my-path/ npm run build:all` 显式覆盖，但其产物必须从指定路径提供。手动 Pages 工作流不会按自定义域名的 `base_path` 更改 base。`node --test tests/pages-build.test.mjs` 检查同一默认构建在根路径和子路径的资源引用；真实浏览器渲染与交互通过 `npm run test:browser` 验证。部署后，`verify` 任务会使用 Chromium 打开并检查实际项目 URL，将截图保存到 Actions 产物。请同时检查所选提交的部署与验证任务结果。

### 检查

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

单元测试涵盖最小设计、严格迁移、属性验证、形变、动作、几何和服务端 import。Studio 测试在 ReactDOM+jsdom 中检查真实 Radix 交互和模拟渲染器边界，不能代替布局或 WebGL 验证。软件包测试检查安装产物、公开入口及 React 接口约定。

浏览器测试覆盖真实 HTTP origin 下的 WebGL、透明度、动画、装备、移动布局、生命周期和 fallback。可通过 `CHROMIUM_PATH` 指定可执行文件路径，通过 `SIDEKICK_SCREENSHOTS=artifacts` 指定截图位置。在网络受限的 QA 中，`SIDEKICK_OFFLINE_BROWSER=1` 会用实际构建文件响应 `http://sidekick.test` 请求，并检查本地存储和重新加载。Safari/Firefox 及真实移动 GPU 需另行验证。存在测试命令并不意味着已在该环境中通过测试。

### 性能检查与运行

- 静止场景没有变化时不会绘制帧。屏幕外或隐藏文档中的动画会暂停，断开连接时清理 worker 与 GPU 缓冲区。
- 没有额外动作或视线移动的 `idle` 呼吸最多每秒绘制 30 次。动画时钟继续推进；自动眨眼、形状过渡、显式动作和跟踪移动不受此限制。配置更改以及 PNG/像素捕获会立即请求新帧。
- 输入与尺寸变化按帧合并。颜色、视线和身体方向变化复用现有网格，身体变化时已消除重复顶点上传。
- 复杂形变和多个装备同时使用时，即使在 worker 中也会产生 CPU 开销。小型设备上请仅连接需要的元素，静态展示可使用 `activity="still"`。`paused` 是独立行为，会立即完成动画。
- `diagnostics.renderCpu` 是实际渲染调用的 CPU 时间，不是 GPU 完成时间或 FPS。可通过 `backend`、`running`、`frames` 和 `buffers` 确认执行位置以及暂停、释放状态。
- 开发基准测试：`node --expose-gc scripts/profile-renderer.mjs artifacts/cpu.json`。在独立临时目录生成 ES2022 JavaScript，测量实际几何计算的 CPU 时间、缓冲区上传和分配量。GPU 命令使用计数替身，因此结果不代表 GPU 时间或浏览器 FPS。真实 Chromium 下的 worker/主线程路径、6 倍 CPU 限速、1/2/4 个实例以及宽屏、DPR 检查包含在 `npm run test:browser` 中。CI 的 SwiftShader/CPU 限速结果并非真实极低配置设备的 FPS 保证。

## 形状、渲染范围与许可

可使用 `MATERIAL_SHAPE_NAMES`、`MATERIAL_SHAPE_LABELS` 和 `MaterialShapeName` 创建选择界面。

- 几何形：`circle`、`square`、`slanted`、`arch`、`fan`、`arrow`、`semiCircle`、`oval`、`pill`、`triangle`、`diamond`、`clamShell`、`pentagon`、`gem`
- 星形、阳光与饼干：`verySunny`、`sunny`、`cookie4Sided`、`cookie6Sided`、`cookie7Sided`、`cookie9Sided`、`cookie12Sided`、`burst`、`softBurst`、`boom`、`softBoom`
- 有机形与其他：`ghostish`、`clover4Leaf`、`clover8Leaf`、`flower`、`puffy`、`puffyDiamond`、`pixelCircle`、`pixelTriangle`、`bun`、`heart`

`star` 不是 API 名称。保留官方曲线数据的纵横比、凹部、拐角、平滑、旋转与重复特征。身体在保持目录 XY 轮廓的同时，构成前后圆润连接的立体形态。Flat 指无光照的纯色表现，而非平面几何。使用真实身体方向旋转、深度遮挡和透明 alpha 通道。

眼睛并非独立突出的网格，而是身体曲面着色器中的胶囊/曲线颜色遮罩。它们随倾斜投影，不会绘制在身体外、背面或被遮挡部分。即使在精确侧面，也可能看见圆润正面上靠近观察者的眼睛的一部分。眼睛比例、间距与位置使用内部默认值，并随形状一起插值。表情不会改变身体轮廓或 alpha 覆盖范围。脸部位移与视线相互独立，眼镜等面部装备仅跟随脸部位移。

配饰使用各形状对应的内部装配规则。眼镜前面是单一平面刚体；贝雷帽通过包裹身体顶部真实截面的开口与帽口佩戴，身体顶部的一部分进入不透明帽子内部。心形会包裹一侧较宽的圆瓣。王冠底部带状部分与身体支撑面适配。围巾由围绕身体下部前、侧、后一整圈的闭合布带，以及连接到结部并向下垂落的两端组成。宽布带随身体各高度的截面变化。形状过渡中不会隐藏装备。保留公开的配饰旋转动作；贝雷帽会在当前已旋转的佩戴坐标中重新适配开口和支撑部位。它随身体旋转和呼吸，不再对已适配的贝雷帽施加独立于身体、延迟旋转的惯性摆动。这是适配各形状区域的建模，并非实时布料物理模拟。身体网格与表面查询使用同一个体积函数 `h = sqrt(d / (d + 0.65 × r²))`，前后高度为 `±depth × h / 2`。XY 轮廓处高度为 0，中心处总深度为 `depth`。这是 Sidekick 的体积模型，并非复现 AndroidX 的 3D 模型。

曲线到折线的容差为基于归一化 `[-1,1]` 的 `0.00005`。网格细分目标（表面距离 `0.010`、中央高度 `0.006`）基于采样，并非对所有位置或像素的误差保证。最多进行 8 次细分，正面预算为 12,000 个点，因此可能看到小的三角形近似误差。形状变形的对应点计算采用 Sidekick 自身方法，不保证与 Android Material `Morph` 像素一致。

每个元素使用一个 WebGL 上下文及可复用缓冲区。默认身体+贝雷帽需要 3 次 draw call，眼睛不增加 draw call。DPR 最大为 2；长轴超过 2048px 时，两轴应用相同比例。宽或高的宿主中仍保持角色比例。CPU 几何基准测试不保证 GPU 帧时间/FPS。任意 SVG、自定义网格、部件插件、布料物理、像素命中测试、上下文池和 AI 服务集成均不在支持范围内。

本仓库的软件包许可证为 `UNLICENSED`。这不意味着授予公开的开源许可；使用与分发权限请向仓库所有者确认。以下第三方声明须单独保留。

- Material 轮廓：固定版本的 [AndroidX MaterialShapes 源码](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt)，通过 `graphics-shapes-android:1.1.0` 计算。Apache 2.0 声明及来源见 [`third_party/material-shapes/`](third_party/material-shapes/)。重新生成使用 `scripts/generate-material-shapes.mjs`，仅此任务需要 Java 21+、unzip 和网络。
- Studio shadcn/ui 源码：[`playground/components/ui/LICENSE.md`](playground/components/ui/LICENSE.md)。静态 Studio 构建也包含该声明。

### 本版本与持续改进

0.2.2 增加了围巾从前、侧到后连续环绕的部分，以及自然下垂的末端。减少了身体网格计算中的重复分配和查询，并在 322 个网格及 12 次原生渲染中确认与原有结果逐字节一致。独立 CPU ABBA 测试中，身体计算总时间减少约 7.9%，但延迟尾部没有持续改善。这不是浏览器 FPS 或所有设备的性能保证。保留 OffscreenCanvas、视线跟踪模式、比例校正、滚轮/捏合缩放及默认色 `#FFCC37`。

0.2.4 针对每种形状采用较小、倾斜的贝雷帽佩戴位置。心形佩戴在一侧峰部，尖形身体则利用内侧支撑点形成不对称下垂。折边与帽冠连续连接；围巾由包裹身体不同高度截面的宽布，以及扭转垂落的余料构成。形状过渡中不隐藏配饰。在复杂突出部变化的某些中间帧，身体可能遮住部分围巾带。贝雷帽以适合心形的尺寸为基础，局部变形帽边和帽冠，不会放大到覆盖整个身体。围巾围绕适合该形状的下部支撑区域，余料向下垂落。适配结果会缓存，并在形状与身体状态变化时更新。此缓存不保证任意形状过渡的计算开销，也不保证低配置 GPU 的 FPS。

0.2.5 在贝雷帽内部加入具有厚度的衬里，并连接开口边缘。它减少了低视角下的缝隙，同时保留供头部进入的开口；但之后在部分形状和动画中发现衬里交叉与佩戴位置不连续，因此在 0.2.6 中重新组织了结构。还修正了拱形、正方形、花形等部分形状暴露的帽口接缝。围巾形状与 0.2.4 相同。极端视线输入下，双眼作为一个整体移动，修复了仅一只眼睛停止导致间距失衡的问题。


贝雷帽角度及动画复现测试位于 [`scripts/beret-qa/`](scripts/beret-qa/README.md)。结合使用基于实际渲染器顶点着色器、矩阵的 GLES 诊断，以及三角形自相交、身体穿透、法线和开口结构检查。角度网格与时间采样范围在测试文档中明确说明；有限测试不应被视为对所有连续角度或任意输入的保证。

0.2.6 将贝雷帽衬里、开口、帽口与帽冠构成连续的有厚度结构，并使身体支撑部位进入内部空腔。心形包裹峰部；对花形等难以同时适配开口两侧的情况，则调整为布料从支撑点自然垂落。插值处理各形状的位置、倾角及布料变形限度，呼吸时应用与身体相同的变形。过渡期间暂时减弱自由末端的卷曲，并单独检查真实三角形是否穿透。某些中间帧可能出现开口张开或佩戴深度快速恢复。有限角度/时间测试结果及残留的小幅适配变化会在测试报告中注明。围巾和视线跟踪行为保持不变。

### Studio 场景编辑器与社交卡片

**场景（Scene）**选项卡将原生角色与可编辑文字合成到固定尺寸画布上。**角色 / 场景**预览切换保持角色挂载；角色外观、身体方向和缩放控件仍会更新构图。场景预览是静止帧，使用**刷新画面**可捕获当前动画帧。

- 画布预设：OG 1200 × 630、正方形 1080 × 1080、宽屏 1920 × 1080；支持自定义 320–4096 的整数尺寸，最多 800 万像素。
- 可设置背景色、角色中心 X/Y 与高度、多行文字、文字位置、字号、字体和颜色。可直接在场景预览中拖动角色或文字，也可使用滑块精确定位。
- **应用 Sidekick OG 预设**会明确替换当前角色，使用微笑的黄色 Ghostish，佩戴眼镜、贝雷帽和领结，搭配白色背景与“Sidekick”文字。
- **保存场景 PNG**按所选尺寸导出整个画布。现有顶部的**保存 PNG**仍导出按 alpha 边界裁切的透明角色。
- **保存 / 打开场景 JSON**可往返保存 `{ compositionVersion: 1, composition, avatar }`。嵌套 `avatar` 为现有 `SidekickScene`；也可打开旧角色场景和设计 JSON，使用默认构图布局。现有角色 JSON/API 导出保持不变。
- 构图位置使用画布百分比。`characterHeight` 是裁切后的角色高度占画布高度的百分比。文字 X 为其左边缘，Y 为多行文字块的中心。导出会有意裁切放置在画布外的内容。
- 场景 PNG 导出会创建临时独立的 2048 × 2048 原生渲染器，在已保存的场景时间捕获配置好的角色，之后销毁渲染器。它不会放大低分辨率预览，也不会改变当前角色画布大小。普通渲染器仍受 2048 像素上限约束，极大构图仍可能放大生成的裁切图。为保持确定性，导出不包含实时指针反应。公开的 OG 图片单独管理。

两个 HTML 入口页面都包含静态 Open Graph 与 Twitter 卡片标签，使用规范 URL `https://sidekick.hananakick.cc/` 及带版本的绝对社交图片 URL。`public/og-sidekick.png`（1200 × 630）是所有者选定的原始图片，独立保留，不随后续角色几何变化而改变。构建和 `node scripts/generate-og-image.mjs` 不会覆盖它。该仅供开发使用的脚本以原生生产渲染器更新 `public/og-avatar.png`，需要 C 编译器、EGL/GLES 以及 Pillow/fontTools。可选的 `SIDEKICK_RENDERER_ROOT` 用于选择源码 worktree。Studio 可编辑场景预设是独立起点，并非对所选静态社交图片的重建。

## 渲染与移动标准 (v0.3)

基本方式是**角色大小的透明画布 + DOM 元素移动**，不会创建覆盖整个屏幕的 WebGL 画布。OffscreenCanvas worker 渲染小尺寸表面，主线程通过 CSS `translate` 移动元素。DOM 移动不会改变 WebGL 分辨率、身体方向设置或已保存的身体设计。默认飞行动作作为小画布内的运行时姿态合成。屏幕尺寸和 DPR 变化继续使用现有 ResizeObserver 与分辨率限制。

可在[移动与动画 API 体验](https://sidekick.hananakick.cc/api-playground.html)中直接测试移动、中断、播放和资源切换。

- 默认 `placement="inline"`：保留文档流；x/y 是相对于原布局位置的偏移，不会挤动其他内容的布局。此模式不应用 viewport bounds。
- `placement="viewport"`：使用 `position: fixed`，x/y 为相对于布局视口左上角的 CSS 像素坐标。锚点是**画布盒子的左上角**，不是角色脚部或中心。滚动时保持相同屏幕位置。
- 默认 `movement-bounds="viewport"`：将整个元素盒子限制在屏幕内。盒子大于屏幕时，左上角固定为 0。使用 `none` 可允许移动到屏幕外。因身体方向缩放而在画布内被裁切的装饰，不会由移动 bounds 恢复。
- viewport/元素尺寸变化时，会重新限制当前位置和剩余目标。`position` 返回实际受限后的坐标，输入 attribute 则保留请求坐标。
- viewport 元素请放在 `body` 直属层或无变换的 overlay 容器中。具有 CSS `transform`、`filter`、`perspective` 或某些 `contain` 的祖先可能改变 fixed 定位基准。库不会偷偷将 React 管理的 DOM 移到其他父元素。
- API 管理 CSS 独立属性 `translate`。不会覆盖用户的 `style.transform`，但同时应用旋转、缩放或自定义 translate 时，bounds 不会计算这些视觉变换。如需用户变换，请在独立封装层中管理。
- 默认 `interaction="none"` 允许点击、滚动和触摸穿透，仍可使用全局视线跟踪。选择 `box` 后，**仅在小画布盒子内**接受拖动与缩放。不提供仅对透明像素放行点击的 alpha 命中测试。
- 角色场景 JSON 不包含宿主页面的布局/移动坐标。请将 `position` 作为应用布局状态单独保存。显式保存的颜色保持不变，新角色的默认身体颜色为 `#FFCC37`。

### 声明式 HTML / React 布局

| HTML attribute | React prop | 含义 / 默认值 |
| --- | --- | --- |
| `placement` | `placement` | 默认为 `inline`；`viewport` 为固定覆盖层 |
| `position-x` | `positionX` | CSS px x 坐标，默认为 `0` |
| `position-y` | `positionY` | CSS px y 坐标，默认为 `0` |
| `movement-bounds` | `movementBounds` | 默认为 `viewport`，也可为 `none`；inline 模式不应用 |
| `move-duration` | `moveDuration` | 0–60000ms，默认为 `0`（立即）；natural 忽略正值，none 则使用精确移动时长 |
| `move-easing` | `moveEasing` | 默认为 `smooth`，也可为 `linear`；仅对 `none` 生效 |
| `move-travel` | `moveTravel` | 默认 `natural`：基于惯性的加速、飞行、减速；`none`：基于时间的 DOM 插值 |
| `move-max-speed` | `moveMaxSpeed` | natural 的最高速度，CSS px/s，1–100000；省略时固定为 1350 |
| `move-acceleration` | `moveAcceleration` | natural 的加速上限，CSS px/s²，1–100000；默认为 `1800` |
| `move-deceleration` | `moveDeceleration` | natural 的减速上限，CSS px/s²，1–100000；默认为 `2200` |
| 事件 `sidekick-move-progress` | `onMoveProgress` | `MovementState`：`{ phase, progress, position, velocity, acceleration, speed }` |
| 事件 `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| 事件 `sidekick-play-end` | `onPlayEnd` | `{ finished }`，播放区间完成/取消 |
| 事件 `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }`，形状、表情和装饰组合过渡完成/取消 |

同时更改 `position-x/y` 时，会作为同一个 attribute transaction 处理。直接方法调用使用 `MoveOptions`，默认 duration 为 400ms，travel 为 natural。`move-*` attribute/React prop 仅应用于声明式坐标变化。如需立即完成初始定位，请省略 move-duration。要使用固定默认最高速度的声明式自然飞行，可写 `move-duration="1000" move-travel="natural"`，React 则写 `moveDuration={1000} moveTravel="natural"`。省略 move-max-speed/moveMaxSpeed 时，使用固定的 1350 CSS px/s；指定时使用给定上限。正 move-duration 不影响自然飞行的速度或时间。默认加速度与减速度不随距离变化。即使设置了最高速度，duration 为 0 时仍立即应用。

### 方法与实际完成的含义

| 方法 | 含义 |
| --- | --- |
| `moveTo({ x, y }, options?: MoveOptions)` | 从当前屏幕坐标移动；返回 `Promise<MoveResult>` |
| `moveToElement(target, options?: MoveToElementOptions)` | 对齐目标元素与角色的相同对齐点，再应用 X/Y 偏移；`anchor: true` 时持续绑定 |
| `elementAnchor` | 当前 `{ target, x, y, alignX, alignY }` 的只读快照，或 `null` |
| `detachAnchor()` | 解除持续绑定；正在进行的首次移动继续，首次到达后的追随会按当前惯性减速停止 |
| `moveBy({ x, y }, options?)` | 基于当前移动中的坐标进行相对移动 |
| `cancelMove()` | 自然飞行从当前速度减速，再用 180ms 收回姿态，以 `finished: false` 结束；none 立即停止位置移动 |
| `position` | 实际 DOM 坐标 `{ x, y }` 的只读副本 |
| `movementState` | phase、progress、position、velocity、acceleration、speed 的只读副本 |
| `play(activity, { duration? })` | 播放活动循环；duration 是**播放区间的墙上时钟毫秒数**，而非一个循环的时长 |
| `stop()` | 取消播放区间，并在 200ms 内平滑切换到 idle |
| `transitionTo({ shape?, expression?, accessories? }, options?)` | 同时过渡形状、双眼表情及完整装饰列表 |
| `cancelTransition()` | 停止正在进行的组合过渡；完成结果为 `finished: false` |

所有 timing easing 均为 `linear` 或 `smooth`，duration 范围为 0–60000ms。`play` 不接受 timing easing。activity 值为 `idle`、`thinking`、`listening`、`speaking`、`celebrating`、`still`。

再次请求自然飞行时，会保留当前坐标、速度与飞行姿态，并向新目标加速。点击反方向时，先制动再转向，不会瞬间反转速度。切换到 `travel: 'none'` 时，改为基于时间的插值，不继承速度。旧 Promise 和 `sidekick-move-end` 不等待降落，仅以 `finished: false` 结束一次。请通过新 Promise 确认新移动是否完成。`sidekick-move-end` 也包含被替换旧请求的取消，因此当前阶段应通过 `movementState` 判断。断开连接时立即清理 RAF、计时器、fade 和飞行姿态，并取消等待中的移动、播放及组合过渡。

`cancelMove()` 仅停止移动，`stop()` 仅停止活动播放。如需两者都停止，请分别调用。移动中使用 `play()`、`setActivity()` 或表情过渡，不会重新启动移动路径。

如 `play(activity)` 一样省略 duration，循环将持续到 `stop`、下一次 play/setActivity 或断开连接，届时 Promise 以 `finished: false` 结束。有限 duration 到期时，播放区间以 `finished: true` 完成，随后在 200ms 内混合到 idle。该 Promise 并不表示 idle 混合已结束。活动更改也会从最后显示的活动姿态进行 200ms 混合；启动时的自动活动不会增加新的效果。

形状使用已有轮廓形变，表情使用已有 shape-key 过渡，`transitionTo` 等待 worker 的实际完成响应。`accessories` 是**完整装饰列表**，因此也要包含需要保留的装饰。重复占用同一位置会在更改前被拒绝。不同装饰的网格不会强行插值，而是执行**角色画布 fade-out → 替换装饰 → 确认新帧已渲染 → fade-in**。两段 fade 的总时长为 duration，与其他形状/表情通道同时进行。页面、兄弟 DOM 和文字不会消失。snapshot PNG 不包含此 CSS fade，仅保存实际角色像素。

取消发生在装饰替换之前时，保留旧装饰；替换之后则保留新装饰。取消的 fade 会移除，避免角色一直透明。被取消的形状过渡停在当前轮廓，但 design 仍保留请求目标。新的 shape/expression/equipment setter 或 attribute 更改会取消对应组合过渡。仅需更改颜色时，使用 `updateDesign`（也会取消正在进行的组合过渡）。

`paused` 或操作系统减少动态效果设置会立即应用移动目标、轮廓、表情和 fade，并将飞行姿态清零；此时不会等待起飞、降落或取消后的 180ms 收尾。活动播放区间按墙上时钟计时，因此即使暂停也继续流逝。浏览器可能延迟后台标签页的 RAF/计时器。自然飞行以固定 1/240 秒间隔积分，标签页恢复时，每帧补算最多 100ms。不会因长时间隐藏而瞬间跳跃，实际完成可能需要更久。`travel: 'none'` 和活动播放区间则按墙上时钟计时。屏幕外暂停渲染的轮廓形变 Promise，会等待实际恢复、完成或取消。未连接时，move/transition 立即应用设置，play 返回 `finished: false`。

### 自然的方向性飞行与真实加速度

`moveTo()` 和 `moveBy()` 默认使用 `travel: 'natural'`。DOM 坐标通过真实速度、加速度积分移动，不是仅通过身体倾斜模拟加速。从静止开始加速，根据到目标的剩余距离与减速上限计算制动距离，在到达前减速。最高速度上限是与距离、duration 无关的固定值，默认 1350 CSS px/s。朝同一上限加速，进入制动距离后，即使尚未达到最高速度也会减速。加速度与减速度不会随距离增加，默认保持 1800、2200 CSS px/s²，因此更远的目标需要更长时间。转向也延续已有速度，所以可能因惯性形成曲线路径或短暂反向移动。最高速度是目标速率的上限；重新指定更低最高速度时，不会立即截断当前速度，而是逐步减速。

| `MoveOptions` 字段 | 含义 / 默认值 |
| --- | --- |
| `travel` | 默认为 `'natural'`，也可为 `'none'` |
| `maxSpeed` | 自然飞行的最高速度，CSS px/s，1–100000；省略时固定为 `1350`（旧显式示例 900 的 1.5 倍）；不随距离或 duration 改变，显式值原样使用 |
| `acceleration` | 自然飞行的目标加速力上限，CSS px/s²，1–100000，默认为 `1800`；实际加速度沿下述响应曲线趋近 |
| `deceleration` | 自然飞行的目标制动力上限，CSS px/s²，1–100000，默认为 `2200`；用于到达、反向及 cancelMove 制动 |
| `duration` | 0–60000ms，直接方法默认为 `400`；natural 忽略正值，不保证实际完成时间；`0` 在两种模式下均立即应用 |
| `easing` | 默认为 `'smooth'`，也可为 `'linear'`；仅应用于 `travel: 'none'` 的时间插值 |

自然飞行的耗时由距离、当前速度和加速/减速上限决定。无论是否指定 maxSpeed，正 duration 和 easing 都不影响自然飞行路径速度。短距离可能在达到最高速度前便开始减速。如需在精确时长内完成移动，请使用 `travel: 'none'`。旧版 15% 起飞、70% 移动、15% 降落的时间划分不适用于自然飞行。

加速度不会瞬间开关，而是以 60ms 时间常数的指数响应趋近目标力，呈现先快后慢的变化感，并非对位置应用数学上的对数函数。从静止施加恒定力时，实际加速度为 a(t)=A(1−exp(−t/0.06))。速度和位置也由该加速度精确积分，屏幕事件中的 acceleration 是实际瞬时加速度。制动距离计算同样包含力响应延迟。使用预测坐标 x+τv 与预测速度 v+τa，将剩余距离 d 的允许速度限制为 min(maxSpeed, 0.9√(2·deceleration·d))，留出保守制动余量。因此会比简单的 v²/(2b) 公式更早降低作用力，以准备平滑减速。

设置新目标时，当前速度与加速度都会继承。即使指定更低上限或相反方向，也不会立即截断作用力，因此短暂过渡期间仍保留之前的加速度。acceleration/deceleration 是目标力的上限；使用差异很大的值转向时，先前制动力可能短暂保留在新方向上。默认上限 1350 是原有 900 基准的 1.5 倍；短距离会因加速、制动而达不到该速度。不会强行增大加速度来让远距离在相同时长内完成。

视线和 yaw/pitch 跟随实际行进方向，身体倾斜跟随实际加速与减速。不会翻转 180 度，也不会修改身体方向设置。上浮是小画布中的运行时姿态，不包含在 `position`、bounds 或进度事件坐标内。位置到达目标且速度归零后，还需用 180ms 收回姿态，才会得到 `finished: true`。

飞行是临时运行时偏移，不覆盖活动、表情、手动姿态或身体方向的保存状态，`play()` 计时器也继续运行。降落后衔接的是**当时仍活跃的活动**，不会重启飞行途中已结束的有限播放，也不会恢复起飞前过时的活动。飞行中改变活动或表情，当前移动的位置、速度与目标保持不变。

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

`travel: 'none'` 无起飞、降落阶段，整个 duration 都用于 DOM 移动。物理选项仍会验证，但不参与插值。如果替换了正在进行的自然飞行，仅上一段飞行姿态会在最多 180ms 内消退。`duration: 0`、暂停、减少动态效果或未连接状态会立即应用目标，并将速度、加速度和飞行姿态清零。即使目标坐标相同，只要仍有速度，自然飞行也需要制动，不能立即完成。

### 移动状态与取消

`movementState` 与 `sidekick-move-progress` 的 `event.detail` 具有相同结构。

| 字段 | 含义 |
| --- | --- |
| `phase` | `idle`、`takeoff`、`flight`、`landing`、`braking`、`settling`；自然飞行的 phase 表示物理状态，而非固定时间划分 |
| `progress` | natural 为基于剩余距离的 0–1 进度提示，不是完成时间预测；目标变化时重启；none 为已过时间占 duration 的比例；正常完成后为 1 |
| `position` | 当前 DOM 坐标 `{ x, y }`，CSS px |
| `velocity` | 实际 DOM 移动速度 `{ x, y }`，CSS px/s；向右、向下为正 |
| `acceleration` | 实际速度变化率 `{ x, y }`，CSS px/s²；与设置的加速上限不同 |
| `speed` | 速度向量的大小 `Math.hypot(velocity.x, velocity.y)`，CSS px/s |

状态为副本，读取或修改它不会控制实际移动。`takeoff` 阶段 DOM 也在加速移动；`landing` 表示朝目标减速，`braking` 表示 cancelMove 制动。`settling` 表示速度与加速度均为 0，仅收回飞行姿态的阶段。进度事件在启动、动画采样、尺寸变化、取消和完成时触发。UI 只需反映必要值；确定完成/取消请使用 Promise 或 `sidekick-move-end`。不建议将逐帧事件持续输出到屏幕阅读器 live 区域。

`cancelMove()` 通过 deceleration 降低自然飞行的当前速度，不会在调用点立即停止。若原本匀速飞行，制动距离约为 `速率² / (2 × 减速度) + 0.06 × 速率`；若正在加速，残留加速度可能使距离更长。制动力平滑变化，因此速度起初可能短暂继续上升，但停止请求不会使角色向反方向弹回。速度归零后，在 `settling` 中用 180ms 收回朝向、倾斜和上浮，然后将原移动 Promise 及 `sidekick-move-end` 以 `finished: false` 完成。制动期间请求新目标，也会从剩余速度自然衔接。`cancelMove()` 本身不返回 Promise。`travel: 'none'` 立即停止位置移动，并收回仍存在的飞行姿态。暂停、减少动态效果或断开连接无需等待制动和姿态收尾，立即处理。

在 `movement-bounds="viewport"` 下，整个画布盒子不会越出视口。碰壁时，仅将碰撞轴朝外的速度归零，另一轴仍可移动。边界截断速度的瞬间属于普通加速上限的例外。`inline` 和 `movement-bounds="none"` 没有此限制，因此容器边界、制动距离及转向所需余量应由应用管理。仅将目标限制在容器内，并不能同时限制惯性路径和制动位置。

API 体验默认开启“默认最高速度 · 1350 CSS px/s”，生成的调用代码仅省略 maxSpeed。acceleration=1800、deceleration=2200 是不随距离变化的默认值。关闭默认值选项后，使用手动输入的 maxSpeed 上限。三个物理限制均可手动调整，并可与实际 velocity/acceleration 对比。natural 始终采用物理积分，不会变成基于时间的飞行。最近 6 秒的图表以独立坐标轴分别显示速率和加速度大小。舞台点击/触摸与拖动、滚动和长按区分；移动端也可使用固定预览中的停止移动按钮。活动播放区间的 `0` 仅在体验页中表示持续循环，实际 API 调用会省略 duration。

### 在 CDN HTML 中使用命令 API

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

如果希望第一次过渡呈现真实动画，请在 `sidekick-ready` 之后执行。准备完成前的 shape/expression 命令会像既有 API 一样立即应用。上述脚本为 module，因此在 HTML 解析后执行。通过 classic 包注册的元素也可使用相同方法。

### 移动到点击或触摸位置的 HTML 舞台

下方舞台以 `inline` 模式绝对定位一个 144px 的小画布，不会使用渲染整个舞台的画布。将指针坐标转换为舞台坐标，并由应用限制位置，使画布留在舞台内。移动端轻点使用 Pointer Events。

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

“移到中央”按钮也可通过键盘执行。若应用动态缩小舞台尺寸，应按新尺寸调用 `moveTo()` 重新限制位置。`inline` 不会自动计算应用容器的 bounds。惯性制动期间可能移出舞台，因此本示例使用 overflow 裁切显示。示例的 `moveTo()` 直接指定选项，不读取 HTML 移动 attribute。要改为声明式方式，请同时更新 `position-x/y`。

### React：通过 ref 使用同一元素 API

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

React SSR 与以前一样安全，ref 在客户端注册后提供。声明式 `positionX/Y` props 仅在值改变时应用，因此普通父级 rerender 不会撤销命令式移动。上述 ref 调用直接传递 `MoveOptions`；`moveDuration`、`moveTravel`、`moveMaxSpeed`、`moveAcceleration` 和 `moveDeceleration` props 则作用于声明式 `positionX/Y` 更改。React 的 `onAssetTransitionEnd` 是 Sidekick 组合过渡事件，与原生 CSS `onTransitionEnd` 不同。

公开类型 `AvatarPlacement`、`AvatarPosition`、`MovementBounds`、`MoveOptions`、`MoveResult`、`MovementState`、`PlayOptions` 和 `AssetTransitionTarget` 可从主入口或 `register` 入口导入。`MoveOptions.travel` 的值为 `'natural' | 'none'`；接受既有 `MotionOptions` 的形状、表情、姿态 API 不接受 `travel`。


## API 体验：将所需动作生成为代码

在 [API 体验](https://sidekick.hananakick.cc/api-playground.html)中选择移动、活动/状态、左右眼表情、鼠标跟踪、身体方向、外观过渡及入场/退场。修改值后，HTML + JavaScript 或 React 代码会立即更新。执行与代码生成基于同一份命令数据。安装和 Studio 角色初始化代码在独立准备区域中提供。

角色使用一个小型透明画布，以 `placement="viewport"` 在整个页面移动，不创建全屏画布。坐标是以 viewport 左上角为基准的 CSS 像素，不叠加页面滚动高度。点击或轻点空白处会将角色中心移到该位置。当前所选任务、输入值和配置代码保持不变；实际点击移动、停止的调用可在独立的“最后执行代码”中查看和复制。切换任务类型后再返回，各项输入仍保留。按钮、表单、链接、代码选择和滚动手势不会触发移动。角色允许指针事件穿透，不阻碍页面操作。

在相同浏览器、相同 origin 下读取 Studio 保存的设计和场景设置。API 体验中的临时命令不会覆盖 Studio 保存值。保存数据无效或浏览器存储不可用时，会显示提示和默认角色，不删除原始数据。跨浏览器或设备迁移时，请使用 Studio JSON 导出/导入。

### 自然入场与退场

```js
// placement="viewport" 요소에서 사용합니다.
await avatar.enter({ x: 120, y: 200 }, { from: 'left' });
await avatar.exit({ to: 'right' });
// 다시 입장할 수 있습니다.
await avatar.enter({ x: 240, y: 120 }, { from: 'top', maxSpeed: 1350 });
```

- `enter(point, options?)`：从屏幕外飞到 `point`。`from` 可为 `left`（默认）、`right`、`top`、`bottom`。
- `exit(options?)`：飞到所选屏幕外侧后隐藏。`to` 可为 `right`（默认）、`left`、`top`、`bottom`。
- 两个方法均接受现有 `MoveOptions` 的速度、加速、减速、travel 和 duration 设置。自然飞行使用真实惯性；paused 或减少动态效果设置下立即应用。
- 结果为 `{ finished, position, presence }`。只读 `presenceState` 为 `visible`、`entering`、`exiting`、`hidden` 之一。完成事件为 `sidekick-enter-end` / `sidekick-exit-end`，React props 为 `onEnterEnd` / `onExitEnd`。React ref 也提供相同方法。
- `inline` 布局不可使用。入场/退场期间发出新的入场/退场命令，会从当前位置和惯性重新设定目标。普通 `moveTo` / `moveBy` 会取消入场/退场并显示角色。`cancelMove()` 会制动，不会隐藏角色。
- 退场完全结束后，禁用渲染器和跟踪订阅。保留设计、活动和跟踪设置，再次入场时恢复。窗口尺寸变化时，正在执行的退场目标会适配新的屏幕边界。

| React prop | 类型 | 含义 |
| --- | --- | --- |
| `onEnterEnd` | `SidekickEventHandler<'sidekick-enter-end'>` | 入场完成/取消：`{finished, position, presence}` |
| `onExitEnd` | `SidekickEventHandler<'sidekick-exit-end'>` | 退场完成/取消：`{finished, position, presence}` |

### 相对于元素移动

`moveToElement(target: Element, options?: MoveToElementOptions): Promise<MoveResult>` 以指定 DOM 元素为基准移动。React 的 `SidekickAvatarRef` 也提供相同方法。

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

对齐目标与角色的**相同对齐点**。`center/center` 使两个盒子的中心重合，`right/bottom` 使右下角重合，再应用 X/Y 偏移。基准是包含透明画布在内的元素屏幕 border-box，而不是角色不透明像素边界。

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

- 默认 `anchor: false` 仅移动一次，目标位置以调用时为准；之后不跟随滚动或布局变化。
- `anchor: true` 持续保持所选对齐点与偏移。首次移动中仅更新同一移动请求的目标，保留速度、加速度和 Promise。到达后仍以相同最高速度、加速和减速设置自然追随目标。即使目标突然移动，也不会瞬间对齐角色坐标。首次到达的 Promise 和移动完成事件只发生一次，后续追随不会重复触发完成事件。静止时忽略不超过 0.5 CSS px 的误差。会响应嵌套滚动、尺寸变化、布局变化及 CSS/WAAPI transform。目标持续移动可能延迟首次移动完成。若角色或目标因 `display: none` 退出布局，则保留绑定并暂停跟踪，重新显示时再对齐。
- 若角色完全移出屏幕，且对齐后的目标也在屏幕外，物理移动和渲染进入空闲状态。当前位置或目标重新与屏幕相交时，保留惯性并恢复追随，不会一次性积分隐藏期间的全部时间。只有角色本身与屏幕相交时才恢复渲染。活跃状态下，锚点位置检查合并为每个文档一个 RAF；所有绑定均空闲时，降为每 250ms 一次。滚动和尺寸变化会在下一帧立即检查；仅由 CSS transform 返回视野的情况，也会在最多约 250ms 后被检测到。隐藏标签页中连位置检查也会停止。因此完全在屏幕外时 GPU 帧停止，但仍保留少量 DOM 测量以检测返回。
- 在支持环境中，渲染由接收 OffscreenCanvas 的专用 worker 内的 WebGL2 完成。隐藏期间的尺寸变化会合并，在下一次实际渲染时应用。不支持或受 CSP 限制的环境使用主线程 WebGL2 fallback。DOM 位置测量和移动坐标更新仍由可访问 DOM 的主线程处理。
- 不改变角色的父 DOM 或 CSS positioning，保留 absolute/fixed/inline 布局，仅更新角色自身的移动偏移。`detachAnchor()` 解除绑定；正在进行的首次移动会继续到最后目标。首次到达后的追随会按当前惯性减速停止。如需连移动一起停止，请使用 `cancelMove()`。
- 其他 `moveTo / moveBy / moveToElement`、`cancelMove / enter / exit` 或角色断开连接会解除现有锚定。目标移除、移到其他文档，或祖先 transform 变成不支持的状态时，会解除绑定；正在进行的首次移动继续前往最后有效目标。将角色自身或其后代作为持续锚定目标的循环布局会被拒绝。
- 活跃锚点在每个文档的同一个 RAF 中先读取布局，再写入位置。静止位置不会重复写入，但为跟踪 observer 无法感知的纯 transform 动画，绑定期间存在逐帧测量开销。文档隐藏时停止，最后一个绑定解除后移除循环。请仅在需要时保持绑定。
- `inline` 与 `viewport` 均基于角色当前屏幕位置转换坐标。角色自身的 CSS transform 会反映到测量尺寸中。不支持角色自身的 CSS zoom，请使用 transform: scale()。若角色祖先存在 transform/rotate/scale/perspective/CSS zoom，坐标单位会发生变化，因此会明确报错。此时请将角色直接放在无变换的 body 下。
- 接受连接在同一文档中的 HTML/SVG Element。未连接目标、其他文档目标或无效选项，会在取消当前移动或显示角色之前同步拒绝。尺寸为 0 的目标也是有效坐标参考点。
- 沿用 `MoveOptions` 的自然加速、制动、中断及 reduced-motion 设置。`movementBounds="viewport"` 时，屏幕限制优先于对齐；如需精确对齐屏幕外目标，请明确指定 `movementBounds="none"`。
- 在体验页的移动基准中选择 `moveToElement` 后，会显示 CSS 选择器、对齐方式、偏移及对应执行代码。选择器只是体验页的便捷功能，实际 API 接受 Element 对象。使用复制的示例时，需要在应用中准备与该选择器匹配的目标元素。

### 指南：从简单使用到深入定制

[指南](https://sidekick.hananakick.cc/guide.html)是一个从安装、声明式行为到细粒度 API 组合，循序渐进学习并实际运行的页面。旧 use-cases.html 地址会链接到新指南。Studio、API 体验和指南使用同一导航菜单。

- **快速开始**：介绍 HTML/React 初始化，以及使用 Studio 已保存角色的方法。
- **行为声明**：涵盖加载/上传等待、结果反馈、列表检查、阅读/搜索、表单、引导等 12 种服务场景。这不是解释自然语言的 LLM 功能，而是通过有类型的行为对象声明所需动作。
- **直接控制**：说明 DOM 布局与锚定、移动/视线/表情组合、生命周期和错误处理，以及 OffscreenCanvas 性能。

每个场景按**简单使用 → 调整选项 → 连接应用事件 → 自行组合动作**的顺序组织。可同时查看正在运行的角色及对应执行代码，并复制代码。安装/概念说明与实际运行演示分开呈现，可通过大类、中类、小类目录和 URL hash 直接跳到所需阶段。移动端可折叠目录。

同一时间仅激活一个示例，避免创建不必要的渲染器。示例结束或切换时移除实例，暂停不可见章节和隐藏页面中的渲染。仅仅读取 Studio 设置，不将实验动作保存到原始数据。运行示例中的异步任务，除非另有说明，均为本地模拟；实际应用中请连接服务请求与结果事件。
