# Sidekick

[한국어](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

**35 種類の Material 図形で作る、背景が透明なフラットキャラクターのライブラリ。** 基本の `<sidekick-avatar>` ひとつから始めて、HTML 属性、JavaScript API、React ラッパーの使いやすい方法で制御できます。図形の切り替え、左右の表情、マウスへの視線追従、体の向きの回転、6 スロットのアクセサリー、方向性のある画面内移動に対応します。コアはフレームワークに依存しない TypeScript + Web Component + WebGL2/Canvas2D です。

- [インストール](#インストール) · [HTML](#html-で直接使う) · [React](#react-で使う)
- [すべての属性](#html-属性と-react-props) · [デザインとアクセサリー](#デザイン-json-とアクセサリー) · [アニメーション/API](#アニメーションと命令型-api)
- [ライフサイクル/ホーム](#宣言型ライフサイクルpresencetaskhome) · [宣言型の動作](#宣言型の動作-behavior) · [画面内の移動/飛行](#レンダリング移動の標準-v03) · [イベント/クリーンアップ](#イベントとクリーンアップ) · [SSR](#ssr-とブラウザー対応) · [Studio/開発](#studio-と開発) · [宣言型の登場](#宣言型の登場-entrance)

## インストール

**公開 GitHub リポジトリからビルド済みパッケージを直接インストールしてください。** 利用するプロジェクトで次のコマンドを実行します。

```sh
npm install https://github.com/hanana-kick/sidekick.git
```

バージョンを固定するには、リリースタグを指定します。

```sh
npm install https://github.com/hanana-kick/sidekick.git#v0.16.0
```

ビルド済みの ESM、型宣言、ブラウザーバンドルがリポジトリに含まれているため、**インストール先で Sidekick のソースをビルドする必要はありません。** 依存関係と lockfile を一緒にコミットすれば、チームでも同じバージョンを使えます。パッケージ名は `@hanana-kick/sidekick`、このバージョンは `0.16.0` です。**npm レジストリには公開していないため、名前だけで `npm install @hanana-kick/sidekick` を実行しないでください。**

npm を使わない HTML サイトでは、[GitHub Releases](https://github.com/hanana-kick/sidekick/releases) からビルド済みファイルをダウンロードしてください。ESM と通常の `<script>` 用 JS、専用のレンダリング worker を提供します。このブラウザーコアには React、バンドラー、Node.js、追加の CSS、フォントは不要です。

### GitHub Release からダウンロード

1. [Releases](https://github.com/hanana-kick/sidekick/releases) を開きます。
2. 使用するタグの **Assets** から `sidekick-browser-0.16.0.zip` または `hanana-kick-sidekick-0.16.0.tgz` をダウンロードします。別のバージョンでは、タグに一致するファイル名を選んでください。自動生成される **Source code (zip/tar.gz)** はソースアーカイブなので、ブラウザー配布用 ZIP と区別してください。
3. 通常の HTML サイトでは、ブラウザー ZIP を展開して、以下のファイルをサイトの静的ファイルディレクトリにコピーします。同梱の `START-HERE.txt` を読み、`esm.html`、`classic.html`、`react.html` から希望する例を開いてください。例の `/vendor/sidekick/` は**利用するサイトのパス**です。配信先のパスに合わせて変更してください。

| ビルド済みファイル | 用途 | 必要なファイル・依存関係 |
| --- | --- | --- |
| `sidekick-browser-0.16.0.zip` | 通常の HTML/React 向けブラウザー配布 | `esm.html`・`classic.html`・`react.html`、以下の JS 6 ファイル、任意の `vendor/`、README・告知を含む |
| `sidekick.js` | ブラウザー ESM。`import` と `<script type="module">` を使用 | `sidekick.worker.js` を同じディレクトリに置く |
| `sidekick.iife.js` | 通常の classic `<script>`。API は `window.Sidekick` | `sidekick.worker.js` を同じディレクトリに置く。`type="module"` は使用しない |
| `sidekick-react.js` | React 19 用 ESM コンポーネント | `sidekick-element.js`・`sidekick-fallback.js`・`sidekick.worker.js` を同じディレクトリに置き、`react` peer を用意する |
| `sidekick-element.js` | React ラッパーが遅延読み込みするレンダラー | 直接 import しない。`sidekick-react.js` と同じバージョンを使う |
| `sidekick-fallback.js` | worker が使えない場合に React 要素が読み込むレンダラー | 直接 import しない。他のファイルと同じバージョンを使う |
| `sidekick.worker.js` | OffscreenCanvas 専用 worker | ブラウザーのエントリーファイルの隣に配置する。別の script タグでは読み込まない |
| `vendor/react.js`, `vendor/react-dom-client.js` | ブラウザー ZIP に含まれる任意の React 19/ReactDOM ESM | 以下のビルド不要の React 例に使用。import map で接続し、React をすでに用意しているアプリでは不要 |
| `hanana-kick-sidekick-0.16.0.tgz` | 既存の npm ベースのプロジェクトにインストールするパッケージ | ビルド済み ESM・型宣言・ブラウザーバンドル・告知を含む |
| `SHA256SUMS` | ZIP と tarball のダウンロード整合性の確認 | 同じ Release のチェックサムファイル |

ZIP に同梱されている README と第三者ライセンス・出典の告知も保管してください。**GitHub Release のアセットは、ダウンロードしてから自分のサイトで配信してください。** ダウンロード URL はブラウザー JS のホスティング用 URL ではなく、アセットの応答の MIME・CORS の挙動は静的ホスティングとは異なります。以下の例の `src`/`import` には、ダウンロードしたファイルを配信するサイトのパスを使います。

`sidekick.js` と `sidekick.iife.js` はそれぞれ公開コア/要素 API 全体をエクスポートし、基本の `<sidekick-avatar>` を自動登録します。**どちらか一方だけを選んでください。** Classic JS はブラウザーのグローバルスクリプトを意味し、Node.js の CommonJS `require()` 用ビルドではありません。React ラッパーのバンドルに React は含まれません。`sidekick.js` の `SidekickAvatar` はカスタム要素クラスで、`sidekick-react.js` の同名のエクスポートは React コンポーネントです。

### 任意：ビルド済み tarball のインストール

Release から取得した tarball を、使用するプロジェクトでインストールします。このコマンドは Sidekick のソースをコンパイルしたり、Studio をビルドしたりしません。

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.16.0.tgz
```

React 19 が必要なのは React ラッパーを使う場合だけです。Web ページをマウントする `react-dom` も、利用者が同じバージョンで用意します。コアだけを使うプロジェクトには React は不要です。

### パッケージのエントリーポイント

| import パス | 用途 |
| --- | --- |
| `@hanana-kick/sidekick` | ブラウザーで基本タグを自動登録し、公開 API を export |
| `@hanana-kick/sidekick/auto` | 自動登録を明示するエントリーポイント |
| `@hanana-kick/sidekick/register` | 自動登録せずに `defineSidekick`、要素クラス、公開 API を import |
| `@hanana-kick/sidekick/core` | DOM を使わずにデザイン・シーンの作成/検証、モーション・体の向き・ピクセルのユーティリティを利用 |
| `@hanana-kick/sidekick/react` | React コンポーネント `SidekickAvatar`、props/ref の型 |

パッケージモジュールは ESM で、実行用モジュール/型は `dist/library/`、すぐに使えるブラウザーバンドルは `dist/browser/` にあります。`dist/src/` は内部テスト用です。ブラウザーは bare import 名を直接解決できないため、パッケージの import にはバンドラーまたは import map を使ってください。以下の HTML 例は実際のファイル URL を使うため、この設定は不要です。

## 感情と一時的な反応

感情は、ボットが**何をしているか**とは独立した表現レイヤーです。待機・順次確認・アクティビティ・移動を中断せず、目、体の傾き、リズムを連動させます。感情はアプリが明示的に指定し、実際のユーザーの感情を推測しません。

`neutral`、`happy`、`sad`、`curious`、`surprised`、`concerned`、`excited`。`intensity` は 0〜1、既定値は 1 です。`neutral` は感情の重ね合わせを解除し、現在のデザインと動作を表示します。


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

`setEmotion()` は継続状態を設定し、実行中の一時反応を置き換えます。`reactTo()` は既定で 1200ms 反応し、その後継続感情に戻ります。`duration` は開始時の遷移を含む保持時間（0〜60000ms）であり、復帰遷移が落ち着くまで待つ時間ではありません。`cancelReaction()` は反応のみ取り消します。新しい反応、継続設定、切断は以前の反応を `finished: false` で終了させ、古いタイマーが新しい設定を上書きすることはありません。

`emotion`/`emotionIntensity` プロパティは継続設定を返します。`emotionState` は一時反応を含む `{ emotion, intensity, baseline: { emotion, intensity }, reacting }` です。`sidekick-emotion-change` はこの状態を通知します。`sidekick-reaction-end` と Promise は `{ finished, emotion, reason }` を返し、`reason` は `completed`、`replaced`、`cancelled`、`disconnected` のいずれかです。完了は保持時間の終了であり、復帰遷移の視覚的な完了ではありません。

感情は保存済みデザイン、アクティビティ、視線、体の方向を書き換えたり復元したりしません。明示的な `setExpression()`、`setEyeWeights()`、`motion.to({ eyes: … })`、`updateDesign()` またはデザインの置き換えによる目の変更、および HTML/React の目の制御は、対象の目の表示制御を引き継ぎます。左目だけを変更すると、右目の感情表現と体の感情動作は維持されます。これらの目の指定は感情が有効な間も表示されるため、先に感情を解除する必要はありません。

新たに明示的に `setEmotion()` または `reactTo()` を呼び出すと、同じ感情を再指定した場合も、両目の制御を感情に戻します。反応の完了や `cancelReaction()` は継続感情に戻しますが、反応開始後に手動変更した目の制御を取り戻しません。`setEmotion('neutral')` は感情の重ね合わせを解除します。自動まばたきと従来の共有 `eyes.openness` 制限は独立して適用され、開く指定の目も閉じることがあります。対象を見る動作は感情の補助的な視線より優先されます。画面外では描画を休止しますが、反応の保持時間は実時間で進みます。再接続しても終了した反応を再生しません。

| HTML / API | React | 説明 |
| --- | --- | --- |
| `emotion` | `emotion` | 感情名。既定 neutral |
| `emotion-intensity` | `emotionIntensity` | 感情の強さ 0〜1。既定 1 |
| `sidekick-emotion-change` | `onEmotionChange` | 継続感情または一時反応の変更 |
| `sidekick-reaction-end` | `onReactionEnd` | 反応の完了・置換・取消・切断 |

### 遷移と即座に保存される設定

`design`、`setDesign()`、`updateDesign()`、`equipAccessory()`、`removeAccessory()` は要求した設定を即座に保存しますが、画面は現在表示されている姿から滑らかに遷移します。目の既定遷移は 400ms、体形の遷移は 450ms で、明示した時間がある場合はそちらを優先します。体の向きも滑らかに変化します。途中で変更しても最初の姿に戻りません。

アクセサリーの直接追加・削除・交換では、レンダラーが部位ごとに 200ms のフェードを行います。以前の装飾をフェードアウトし、不透明度がゼロになった時点で交換して、新しい装飾をフェードインします。体と他の部位は一緒に消えません。明示的な `transitionTo()` は独自のフェードを使い、レンダラーの追加フェードを重複適用しません。

一時停止（`paused`）または視差効果を減らす設定では目標状態へ即座に落ち着きます。視覚的な遷移の途中でも設定の読み取りは新しい目標値を返すため、設定値をアニメーション完了の通知として扱わないでください。

## CDN を使ってビルドなしで利用する

現在の CDN 推奨バージョンは **0.16.0** です。以下の URL は GitHub タグにコミットされた**ビルド済み JS** を jsDelivr が配信するため、ソースのビルド、npm のインストール、npm アカウントは不要です。`main`、`latest`、バージョン範囲ではなく、**正確なタグ**を固定してください。以前の `v0.2.7` のファイルは変更していません。0.2.7 も同じ CDN パスからダウンロードできますが、異なるオリジンのページでは worker の生成がブロックされてメインスレッドへフォールバックするため、CDN の新規利用では上記の現在の固定バージョンを使ってください。

### 通常の HTML / classic script

```html
<script defer src="https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.iife.js"></script>
<sidekick-avatar shape="ghostish" head-accessory="beret"
  eyes-accessory="glasses" neck-accessory="bowTie"
  left-smile="1" right-smile="1"
  style="display:block;width:240px;height:240px"></sidekick-avatar>
```

### ESM

```html
<sidekick-avatar id="bot" shape="heart"></sidekick-avatar>
<script type="module">
  import { createDesign } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';
  console.log(createDesign());
</script>
```

ESM と classic は同じ要素を自動登録します。ひとつのページではどちらか一方だけを使ってください。

### React：ブラウザーでビルドなしで実行

React と ReactDOM は、同じ 19.3.1 のビルド済み ESM を提供します。import map はすべてのモジュールスクリプトより前に宣言してください。JSX 変換を行わずに `createElement` を使います。

```html
<div id="root"></div>
<script type="importmap">
{
  "imports": {
    "react": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/cdn/react-19.3.1/react.js",
    "react-dom/client": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/cdn/react-19.3.1/react-dom-client.js"
  }
}
</script>
<script type="module">
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { SidekickAvatar } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick-react.js';
  createRoot(document.getElementById('root')).render(createElement(SidekickAvatar, {
    shape: 'ghostish', headAccessory: 'beret', eyesAccessory: 'glasses',
    neckAccessory: 'bowTie', leftSmile: 1, rightSmile: 1,
    style: { width: 240, height: 240 }
  }));
</script>
```

既存の React アプリでは、アプリの React インスタンスをそのまま使ってください。上の import map で別の React を重複読み込みせず、npm/GitHub からインストールして `@hanana-kick/sidekick/react` を import する方法が適切です。

### Worker、CORS、CSP とセルフホスティング

- CDN の JS 応答には JavaScript の MIME と `Access-Control-Allow-Origin: *` が必要です。jsDelivr はこれらを提供します。GitHub Release のダウンロード URL を `script src` に入れないでください。
- 0.2.8 以降、CDN とページのオリジンが異なる場合は、ローカルの Blob module worker から CDN の `sidekick.worker.js` を静的に import します。実際のレンダリングは引き続き OffscreenCanvas worker で行います。Blob URL は起動完了/エラー/終了時に解放します。
- CSP がある場合は、`worker-src 'self' blob:` と `script-src` の `https://cdn.jsdelivr.net` を許可する必要があります。上の inline 例と import map には、サイトのポリシーに合った nonce/hash も必要です。CSP 全体を無条件に緩和したり、`unsafe-inline` を追加したりする必要はありません。
- worker/OffscreenCanvas が未対応、または CSP が worker をブロックする場合は、メインスレッドで描画します。WebGL2 が使えない場合は Canvas2D に切り替わります。HTTPS で配信し、HTTP のローカル開発には localhost を使ってください。
- セルフホスティングでは、ブラウザー ZIP の **JS 6 ファイルすべて**を同じディレクトリに置きます。React は同じバージョンの `sidekick-element.js` と `sidekick-fallback.js` を遅延読み込みします。worker ファイルや chunk だけを別のバージョンに置き換えてはいけません。
- バージョンタグの配布物は変更しません。修正は新しい patch バージョンとして配布します。jsDelivr は最初にリクエストされたファイルを長期間保持するため、削除をロールバックの手段とみなさないでください。

CDN の公式の挙動とキャッシュポリシー：[jsDelivr GitHub 配信ドキュメント](https://github.com/jsdelivr/jsdelivr#github)。

## HTML で直接使う

### 最小限の ESM 使用例

ダウンロードした `sidekick.js` と `sidekick.worker.js` をサイトの `/vendor/sidekick/` に置くと、次の 2 行から始められます。

```html
<script type="module" src="/vendor/sidekick/sidekick.js"></script>
<sidekick-avatar></sidekick-avatar>
```

登録が完了すると、200 × 200px の背景が透明なキャラクターが表示されます。既定値は `#FFCC37` の黄色い `square`、暗い色の目、アクセサリーなし、`idle` 状態です。キャンバス寸法ではなく API でボットのサイズを指定します。外観はカタログ/装備の選択と色で設定し、各パーツの幾何学的なサイズ・奥行き・位置は公開していません。

### 完全な HTML 例：ESM import

以下の内容を `index.html` として保存し、ダウンロードしたファイルと一緒に HTTP(S) で配信してください。この例はソースのビルド、npm のインストール、import map なしで実行できます。初期のエラー/準備完了イベントを受け取れるように、先にリスナーを登録してから `import()` します。

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

静的な ESM import でも同様です。`sidekick.js` ひとつから公開関数を取得できます。

```js
import { createDesign, createAccessory, defineSidekick } from '/vendor/sidekick/sidekick.js';
```

### 完全な HTML 例：通常の JS script

`sidekick.iife.js` と `sidekick.worker.js` を同じディレクトリにコピーし、`type="module"` を付けずに読み込みます。登録は自動で、同じ公開 API が `Sidekick` グローバルにあります。外部スクリプトを先に実行し、その下で API を使用してください。この順序の例に `async`/`defer` をむやみに追加しないでください。

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

ダブルクリックで `file://` として開かず、HTTP(S) サーバーから配信してください。`.js` の応答は JavaScript の MIME 形式である必要があります。また、存在しないファイルの代わりにサイトの `index.html` を返す SPA fallback は避けてください。別の origin から JS を配信する場合は、モジュール用の CORS も設定する必要があります。上の例は同じ origin を使用します。コアの 2 バンドルには、追加の JS・画像・フォントのダウンロードはありません。

### 明示的に登録してコマンドを送る

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

`defineSidekick('my-companion')` で別のタグ名も登録できます。React ラッパーは基本の `sidekick-avatar` を使用します。`whenDefined()` はクラスの登録完了を意味し、GPU のレンダリング準備完了を意味しません。`ready` は Promise ではなく読み取り専用の boolean です。PNG が必要な場合は、`bot.ready === true` を確認するか、`sidekick-ready` を待ってください。

## ボットのサイズ

キャンバス寸法ではなく API でボットのサイズを指定します。

```html
<sidekick-avatar size="120"></sidekick-avatar>
```
```js
bot.size = 120;
bot.size = 160.5;
bot.size = null;
```
```jsx
<SidekickAvatar size={120} />
```

`size` は CSS ピクセル単位の正方形の基準サイズです。体を基準にしたフレーミングとアクセサリーの余白を含み、不透明な輪郭の正確な直径ではありません。HTML・JavaScript・React は小数を含む有限の **1–2048** を許容します。未指定時は既定の 200 で、既存の CSS サイズ指定と長方形ホストも維持します。

明示した `size` は両寸法と最小・最大サイズを管理し、CSS `width`/`height` による変形を防ぎます。属性の削除、`bot.size = null`、React prop の削除で管理を解除し、その間に変更された利用側の CSS もそのまま適用します。`bot.size` は宣言値、未指定なら 200 を返し、実測 CSS 寸法ではありません。位置・margin・transform は CSS で設定でき、transform は見かけのサイズを変えられます。

ホスト・キャンバス・デバイスピクセル解像度は内部で調整します。レンダラーの品質上限は論理サイズを変えずに内部解像度を制限する場合があります。縦横比と体・アクセサリーの基準フレーミングは維持します。`zoom` は領域内での独立した 0.5–3 倍率で、レイアウトを変更せず、大きな値では切れる場合があります。size はホストの設定であり、デザイン・シーン JSON のフィールドではありません。不正な JavaScript 値は変更前に例外を投げ、不正な HTML・React 値は `sidekick-error` を通知し、最後の有効な状態を維持します。

## React で使う

### 既存の React 19 プロジェクト

上の GitHub URL または Release の `.tgz` でパッケージをインストールしてから、次のコンポーネントをアプリでレンダリングしてください。JSX/TSX は既存のアプリのツールで処理し、Sidekick 自体を再ビルドする必要はありません。

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

ラッパーはブラウザーで要素を登録し、camelCase の props を HTML 属性に接続します。`ref` は実際の要素なので、既存の命令型 API を使用できます。`design`、`accessories`、`motion` は文字列ではなく型付きのオブジェクトとして渡せます。通常の `id`、`className`、`style`、`aria-*`、`data-*` も渡します。

```tsx
import { createAccessory, createDesign } from '@hanana-kick/sidekick/core';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

const design = createDesign({
  body: { shape: 'clover4Leaf', color: '#8bba9c' },
  accessories: [createAccessory('halo', 'aura')],
});

<SidekickAvatar design={design} trackingMode="off" />;
```

属性の変更は既存の要素に反映されます。アニメーション中に `key` を変更したり、条件によって要素を削除したりするとランタイムが再作成されるため、安定した `key` を維持してください。ひとつの値を props と命令型 API の両方で制御している場合、後からその prop を変更すると宣言的な値が再適用されます。アニメーションによる切り替えには `shape` prop または `setShape()` を使用してください。React の `design` prop も HTML の `design` 属性に接続されるため、接続後に図形を変更すると `shapeDuration` で切り替わります。一方、要素の JavaScript の `design` プロパティと `setDesign()` はデザイン全体を即座に適用します。

### ビルド不要の React HTML 例

ブラウザー ZIP の `sidekick-react.js`、`sidekick-element.js`、`vendor/` をそのまま維持してください。同梱の `react.html` を開くか、**同じディレクトリに**以下の内容の HTML を保存できます。HTTP(S) で開けば、React でもインストール、JSX 変換、ソースのビルドなしで実行できます。たとえばこれらのファイルを `/vendor/sidekick/` にコピーした場合は、`/vendor/sidekick/react.html` を開きます。

この例は、ZIP に含まれる **React/ReactDOM 19.3.1 の production ESM** を使用します。React peer とページのマウント用の ReactDOM はコアとは別で、2 つの vendor ファイルと同梱の React・ReactDOM・scheduler のライセンスを一緒に維持してください。既存の React アプリに別の React のコピーを追加せず、アプリの peer を使ってください。外部 CDN や GitHub のダウンロード URL にはランタイムのリクエストを送りません。

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

`sidekick-react.js` の `react` import は、import map またはアプリのバンドラーで解決する必要があります。レンダラーファイルはラッパーからの相対パスで読み込まれるため、`sidekick-element.js` を移動したり名前を変えたりしないでください。React の例では、`sidekick.js`/`sidekick.iife.js` を追加で読み込む必要はありません。

## HTML 属性と React props

以下の表は、**対応するすべての HTML 設定属性と React 専用 props** です。camelCase は React props の名前であり、すべての名前が要素の JavaScript プロパティであることを意味しません。通常の HTML では `setAttribute()`/`removeAttribute()` を、複合的な制御には命令型 API を使ってください。読み取り専用の状態・イベント・PNG 出力は API から受け取ります。

- すべての設定 prop は任意です。表の既定値は、`design` や他の上位入力がない新しい要素を基準にしています。**省略は上書きしないという意味**です。たとえば `design` の体が `heart` なら、`shape` を省略しても `square` には変わりません。
- HTML の値は文字列です。数値は `shape-duration="450"`、JSON は `motion='{"body":{"rotation":[0,0,0.2]}}'` のように記述します。React の数値は `{450}`、boolean は `{true}`/`{false}`、複合値は実際のオブジェクト/配列を使います。
- React の設定 prop を解除する値は **`undefined` または prop の省略**です。以前にラッパーが設定した属性は削除されます。通常の設定 prop では `null` に対応していません。ただし `behavior={null}` は例外で、現在の動作を明示的にキャンセルします。`ref={null}` は React の標準に従って参照を解除するときに使用できます。
- `MaterialShapeName` で許可される 35 個の値は[すべての図形の一覧](#図形レンダリングの範囲とライセンス)、`AvatarDesign`/`AccessoryDesign` のフィールドは[デザイン JSON](#デザイン-json-とアクセサリー)、`MotionTarget` の全フィールドは下の表を参照してください。文字列 enum は大文字と小文字を区別します。

### 基本・体・目

| HTML 属性 | React prop | React の型 | 許可される値 / 既定値 |
| --- | --- | --- | --- |
| `design` | `design` | `AvatarDesign` | HTML では完全なデザイン JSON 文字列。既定は `createDesign()` の v7 デザイン |
| `shape` | `shape` | `MaterialShapeName` | 35 個のカタログ名。上位デザインの図形、なければ `square` |
| `body-color` | `bodyColor` | `string` | `#RRGGBB`。上位デザインの色、なければ `#FFCC37` |
| `eye-color` | `eyeColor` | `string` | `#RRGGBB`。上位デザインの色、なければ `#24242c` |
| `expression` | `expression` | `EyeExpression` | `neutral` / `smile` / `blink`。省略時はデザインの両目の重みを維持、初期値は `neutral` |
| `left-expression` | `leftExpression` | `EyeExpression` | 左目の `neutral` / `smile` / `blink`。省略時は共通の expression/デザインを使用 |
| `right-expression` | `rightExpression` | `EyeExpression` | 右目の `neutral` / `smile` / `blink`。省略時は共通の expression/デザインを使用 |
| `smile` | `smile` | `number` | 両目の笑顔の重み 0〜1。省略時は expression/デザインを使用、初期値は 0 |
| `blink` | `blink` | `number` | 両目を閉じる重み 0〜1。省略時は expression/デザインを使用、初期値は 0 |
| `left-smile` | `leftSmile` | `number` | 左目の笑顔 0〜1。省略時は共通の smile/expression/デザインを使用、初期値は 0 |
| `right-smile` | `rightSmile` | `number` | 右目の笑顔 0〜1。省略時は共通の smile/expression/デザインを使用、初期値は 0 |
| `left-blink` | `leftBlink` | `number` | 左目を閉じる重み 0〜1。省略時は共通の blink/expression/デザインを使用、初期値は 0 |
| `right-blink` | `rightBlink` | `number` | 右目を閉じる重み 0〜1。省略時は共通の blink/expression/デザインを使用、初期値は 0 |
| `accessories` | `accessories` | `readonly AccessoryDesign[]` | HTML では JSON 配列。省略時はデザインの装備、初期値は `[]`。指定時は配列全体を置き換える |
| `render-style` | `renderStyle` | `RenderStyle` (`'flat'`) | 公開対応は `flat` のみ、既定は `flat`。HTML の以前の `3d` 入力は `flat` に正規化 |

### 装備スロット

**12 種類のプリセットと 6 つの独立したスロット**があります。すべてのスロットは最初は空です。スロットの選択を省略すると `accessories`/`design` の装備を使用し、`none` を指定すると上位データに装備があっても解除します。選択 prop は以下のプリセット文字列の union、色 prop は `string` です。

| HTML 属性 | React prop | 許可される値 / 省略時の動作 |
| --- | --- | --- |
| `head-accessory` | `headAccessory` | `beret` / `halo` / `crown` / `none`。`head` スロットの上位装備を使用、初期状態は空 |
| `head-color` | `headColor` | `#RRGGBB`。頭の装備の既存の色を維持、新しい装備はプリセットの既定色 |
| `eyes-accessory` | `eyesAccessory` | `glasses` / `sunglasses` / `none`。`eyes` スロットの上位装備を使用、初期状態は空 |
| `eyes-color` | `eyesColor` | `#RRGGBB`。目の装備の既存の色を維持、新しい装備はプリセットの既定色 |
| `mouth-accessory` | `mouthAccessory` | `moustache` / `goatee` / `none`。`mouth` スロットの上位装備を使用、初期状態は空 |
| `mouth-color` | `mouthColor` | `#RRGGBB`。口の装備の既存の色を維持、新しい装備はプリセットの既定色 |
| `neck-accessory` | `neckAccessory` | `bowTie` / `scarf` / `necklace` / `none`。`neck` スロットの上位装備を使用、初期状態は空 |
| `neck-color` | `neckColor` | `#RRGGBB`。首の装備の既存の色を維持、新しい装備はプリセットの既定色 |
| `left-ear-accessory` | `leftEarAccessory` | `earring` / `starEarring` / `none`。`leftEar` スロットの上位装備を使用、初期状態は空 |
| `left-ear-color` | `leftEarColor` | `#RRGGBB`。左耳の装備の既存の色を維持、新しい装備はプリセットの既定色 |
| `right-ear-accessory` | `rightEarAccessory` | `earring` / `starEarring` / `none`。`rightEar` スロットの上位装備を使用、初期状態は空 |
| `right-ear-color` | `rightEarColor` | `#RRGGBB`。右耳の装備の既存の色を維持、新しい装備はプリセットの既定色 |

プリセットの既定色は、ベレー帽・蝶ネクタイ・マフラーが `#b84742`、光の輪・リングのイヤリングが `#f7cc5b`、眼鏡・サングラス・口ひげ・あごひげが `#31323d`、王冠が `#e5ad35`、ネックレスが `#9b6c2a`、星のイヤリングが `#a66a22` です。

`eye-color`/`eyeColor` は**目そのもの**、`eyes-color`/`eyesColor` は**眼鏡などの目のスロットの装備**の色です。空のスロットにもあらかじめ色を指定できます。スロットの選択を削除すると、下位の `accessories`/`design` の装備が再表示される場合があるため、削除と `none` を区別してください。独自の id が必要な場合は `accessories` JSON を使います。

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

### ランタイム・体の向き・アニメーション

| HTML 属性 | React prop | React の型 | 許可される値 / 既定値 |
| --- | --- | --- | --- |
| `positioning` | `positioning` | `Positioning \| null` | 対象・配置・間隔・慣性追従を宣言。HTML は JSON。 |
| `entrance` | `entrance` | `Entrance \| null` | HTML JSON、準備完了後に一度実行、同じ値では再生し直さない、`null` または削除で解除 |
| `behavior` | `behavior` | `BotBehavior \| null` | HTML では JSON 文字列、React では実際のオブジェクト/Element。`null` または削除で動作をキャンセル。以下の宣言型の動作を参照 |
| `activity` | `activity` | `Activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`。既定は `idle` |
| `paused` | `paused` | `boolean` | 既定は `false`。繰り返しモーションを一時停止 |
| `interaction` | `interaction` | `'none' \| 'box'` | 既定は `none`。`box` はドラッグ/クリック/キーボード操作を有効化 |
| `tracking-mode` | `trackingMode` | `TrackingMode` | `off`、`eyes`、`eyes-and-body`（既定）。目のみ、または目と体で追従 |
| `mouse-tracking` | `mouseTracking` | `boolean` | 以前の目の追従の別名。`true` → `eyes`、`false` → `off`。明示した `tracking-mode` が優先 |
| `body-orientation` | `bodyOrientation` | `BodyOrientationPreset \| Partial<BodyOrientation>` | HTML では `front` / `three-quarter` / `side`、既定は `front`。React では `{yaw,pitch,roll}` の部分オブジェクトも使用可能 |
| `body-yaw` | `bodyYaw` | `number` | -360〜360 度。bodyOrientation プリセットの yaw、なければ 0 |
| `body-pitch` | `bodyPitch` | `number` | -90〜90 度。bodyOrientation プリセットの pitch、なければ 0 |
| `body-roll` | `bodyRoll` | `number` | -180〜180 度。bodyOrientation プリセットの roll、なければ 0 |
| `size` | `size` | `number` | 1–2048 CSS px; 既定値 200 |
| `zoom` | `zoom` | `number` | 0.5〜3 倍、既定は 1。中心を基準に拡大/縮小。削除すると 1 に戻る |
| `gaze-x` | `gazeX` | `number` | -1〜1。既定は 0。マウス追従をオフにしたときに使う明示的な視線 |
| `gaze-y` | `gazeY` | `number` | -1〜1。既定は 0 |
| `shape-duration` | `shapeDuration` | `number` | 図形属性の切り替え時間 0〜60000ms。既定は 450 |
| `shape-easing` | `shapeEasing` | `MotionOptions['easing']` | `smooth` / `linear`。既定は `smooth` |
| `motion-duration` | `motionDuration` | `number` | 目・ポーズの属性の切り替え時間 0〜60000ms。既定は 400 |
| `motion-easing` | `motionEasing` | `MotionOptions['easing']` | `smooth` / `linear`。既定は `smooth` |
| `motion` | `motion` | `MotionTarget` | HTML では JSON 文字列。初期ポーズは回転・顔の移動が 0、共通の開眼が 1、左右の目はデザインの重み |
| `time` | `time` | `number` | 繰り返しアニメーションの時間 0〜86400 秒。既定は 0。フレームごとに変わる readback 値ではなく seek 入力 |

React の `bodyOrientation={{ yaw: 35 }}` は `body-yaw` 属性に接続されます。同じ軸の個別 prop である `bodyYaw` も渡した場合は、個別 prop が優先されます。拡大は独立した `zoom={1.4}` prop で設定し、削除すると既定の 1 に戻ります。省略したオブジェクトの軸は、新しい要素では 0 になり、以前にラッパーが所有していた軸を削除すると宣言的な既定値に戻ります。命令型の `setBodyOrientation({yaw:35})` は、指定しなかった軸の現在値を維持します。

`MotionTarget` は部分的な目標であり、指定しないチャンネルは維持します。対応するネストされたフィールドはすべて以下のとおりです。

| `motion` フィールド | 型・範囲 | 初期値 / 意味 |
| --- | --- | --- |
| `body.rotation` | `[number, number, number]`、各 -2π〜2π ラジアン | `[0,0,0]`、体の回転 |
| `face.uv` | `[number, number]`、各 -0.5〜0.5 | `[0,0]`、顔の位置のランタイム移動 |
| `eyes.left.weights.smile`, `eyes.right.weights.smile` | `number`、0〜1 | 各目のデザインの重み、初期値は 0 |
| `eyes.left.weights.blink`, `eyes.right.weights.blink` | `number`、0〜1 | 各目のデザインの重み、初期値は 0 |
| `eyes.openness` | `number`、0〜1 | 1、共通の開眼の制限 |
| `accessories.<id>.rotation` | `[number, number, number]`、各 -π〜π ラジアン | `[0,0,0]`、現在装着されている固有 id の回転 |
| `eyes.left.expression`, `eyes.right.expression` | `EyeExpression` | 後方互換用の入力。`neutral` / `smile` / `blink` を重みに変換 |
| `eyes.left.openness`, `eyes.right.openness` | `number`、0〜1 | 後方互換用の入力。目を閉じる重みに変換 |

片目で `weights` と以前の `expression`/`openness` を混在させるとエラーになります。新しいコードでは `weights` を使ってください。`motion={}`/`motion="{}"` は新しい目標チャンネルがないことを意味し、初期化はしません。`motion` prop/属性の削除は、以下の削除規則に従って基本ポーズに戻します。体の向きの角度は**度**、ポーズの回転は**ラジアン**です。

### React の参照とイベント props

この表の props は HTML 属性としては使用しません。HTML では、以下の DOM イベントを `addEventListener()` で購読します。コールバックは React SyntheticEvent ではなく元の `CustomEvent` を受け取り、戻り値は `void` です。すべてのコールバックの既定値は `undefined` で、省略すると呼び出されません。

| React prop | 型 | 値・動作 |
| --- | --- | --- |
| `ref` | `React.Ref<SidekickAvatarRef>` | 既定はなし。オブジェクト ref または callback ref。実際のカスタム要素がアップグレードされた後に渡され、クリーンアップ時に解除 |
| `onBehaviorChange` | `SidekickEventHandler<'sidekick-behavior-change'>` | `CustomEvent<BehaviorState>`。動作状態と確認の進捗 |
| `onBehaviorEnd` | `SidekickEventHandler<'sidekick-behavior-end'>` | `CustomEvent<BehaviorResult>`。完了・キャンセル・ランタイムエラー |
| `onReady` | `SidekickEventHandler<'sidekick-ready'>` | `CustomEvent<{}>`。props 適用後のレンダリング準備完了 |
| `onError` | `SidekickEventHandler<'sidekick-error'>` | `CustomEvent<SidekickErrorDetail>`。`message: string`、任意の `attribute: string`、`value: string \| null`、`recoverable: boolean` |
| `onDesignChange` | `SidekickEventHandler<'sidekick-design-change'>` | `CustomEvent<{design: AvatarDesign}>` |
| `onBodyOrientationChange` | `SidekickEventHandler<'sidekick-body-orientation-change'>` | `CustomEvent<{bodyOrientation: BodyOrientation}>` |
| `onZoomChange` | `SidekickEventHandler<'sidekick-zoom-change'>` | `CustomEvent<{zoom: number}>` |
| `onMotionEnd` | `SidekickEventHandler<'sidekick-motion-end'>` | `CustomEvent<{finished: boolean}>` |
| `onShapeEnd` | `SidekickEventHandler<'sidekick-shape-end'>` | `CustomEvent<{finished: boolean}>` |
| `onActivate` | `SidekickEventHandler<'sidekick-activate'>` | `CustomEvent<{}>`。クリックまたは Enter/Space による有効化 |

その他の props は `HTMLAttributes<SidekickAvatarRef>` に従います。例：`id?: string`、`className?: string`、`style?: React.CSSProperties`、`aria-*`、`data-*`、通常の DOM イベント。ラッパーは `children` と `dangerouslySetInnerHTML` に対応していません。`onError` は上記の Sidekick エラーコールバックとして定義します。`key` は React の要素識別値であり、HTML 属性/Sidekick 設定ではありません。

### 変更・削除・エラーの規則

- boolean はネイティブの HTML boolean と異なり、文字列 `"false"` も解釈します。`mouse-tracking`、`mouse-tracking=""`、`mouse-tracking="true"`、`mouse-tracking="1"` はオンです。`="false"`、`="0"` はオフです。`mouse-tracking` を削除すると、`tracking-mode` がない場合は既定の `eyes-and-body` に戻ります。ただし `tracking-mode` があればそのモードが優先されます。`paused` も同じ boolean 表記を使い、属性を削除するとオフになります。React では `{true}` / `{false}` を使用してください。React の `false` は明示的なオフの値であり、prop の省略とは異なります。`null`、`"TRUE"`、`"yes"` などには対応していません。
- 対応する属性に、不正な図形名・プリセット・JSON・数値範囲・色形式を入れるとエラーになります。監視対象ではない任意の HTML 属性は、ブラウザーの通常の属性として残り、ライブラリの設定には適用されません。色の短縮表記 `#fff`、CSS の色名、`NaN`、`Infinity` には対応していません。値を省略するには、空文字列の代わりに属性を削除してください。
- React の `undefined`/省略と HTML の `removeAttribute()` は、その入力による上書きだけを解除します。下位に `design` の入力があればそれを使用します。スロットを必ず空にするには `none`、装備配列を必ず空にするには `[]` を指定してください。
- 同じ JavaScript タスク内で変更した複数の属性は、次のマイクロタスクでまとめて検証・適用します。不正なバッチは以前の有効なランタイム状態を維持し、`sidekick-error` を発生させます。元の入力文字列は DOM に残るため、エラーのある属性を修正または削除する必要があります。
- 初期の HTML 属性は最初のレンダリングより前に適用します。接続後の `shape`・目の重み・`motion` の変更は、対応する timing 属性で切り替わります。timing だけを変更しても、進行中の切り替えは再開しません。
- デザイン属性は `design` を基本データとして使い、個別属性が該当部分だけを上書きします。個別属性を削除すると、その下にある宣言的データまたは既定値が現れます。`accessories` は基本装備配列を変更し、スロット属性はその上に適用されます。
- 目の優先順位は `design` → 共通の `expression` → 片目の expression → 共通の `smile`/`blink` → 片目の重みです。体の向きのプリセットより個別の軸が優先されます。`gaze-x`/`gaze-y` の削除は該当軸を 0 に、`motion` の削除は体・顔・装備の回転・共通の開眼を既定値に、左右の目は保存されたデザインの重みに戻します。
- 無関係な属性の変更は、命令型 API で変更した他の値や他のアニメーションをリセットしません。デザイン JSON には、体の向き・アクティビティ・一時停止・マウス追従・切り替え時間・ランタイムポーズは保存されません。

```js
bot.setAttribute('shape-duration', '600');
bot.setAttribute('shape', 'heart');
bot.setAttribute('left-smile', '0.8');
await Promise.resolve(); // 같은 작업의 속성 적용 이후

bot.setAttribute('tracking-mode', 'off');
bot.removeAttribute('body-color'); // design의 색 또는 기본 색으로 복원
bot.setAttribute('head-accessory', 'none'); // design에 모자가 있어도 해제
```

## 宣言型の登場 (entrance)

`entrance` は、ボットの準備完了後に画面端または同じ文書の DOM 要素の背後から一度登場する宣言です。HTML の JSON 属性・JavaScript property・React prop は同じ `Entrance` オブジェクトを使います。設定済みの外観を維持し、移動の手動手順や `enter()` の呼び出しは不要です。

HTML または React に `placement="viewport"` を指定します。ボットとその祖先には CSS transform を使わず、ボットには padding や border を付けません。対象の回転・skew・3D 変換も未対応です。`behavior` を同時に宣言した場合は登場の完了後に開始します。

### 画面の端から登場

`edge` は進入する辺です。`at` は残りの直交空間の割合で、`left`/`right` では縦位置、`top`/`bottom` では横位置を指定します。`0` は先頭辺の整列、`0.5` は中央、`1` は末尾辺の整列です。`inset` は到着後のキャンバスと画面端の CSS ピクセル距離です。

```html
<script type="module">
  import '@hanana-kick/sidekick/auto';
</script>
<sidekick-avatar placement="viewport"
  style="width:96px;height:96px"
  entrance='{"source":"viewport","edge":"left","at":0.3,"inset":24}'>
</sidekick-avatar>
```

```tsx
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

export default function EdgeEntrance() {
  return <SidekickAvatar placement="viewport" style={{ width: 96, height: 96 }}
    entrance={{ source: 'viewport', edge: 'left', at: 0.3, inset: 24 }} />;
}
```

### DOM 要素の背後から登場

`target` は同じ文書のセレクターまたは `Element` です。HTML の JSON ではセレクターを使います。`direction` は対象から出てくる側を指定します。`at` は対象とキャンバスの同じ割合位置を揃え、`gap` は到着後の両者の CSS ピクセル距離です。例の矩形をボットより先に描画してください。

```html
<script type="module">
  import '@hanana-kick/sidekick/auto';
</script>
<style>
  #entrance-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: min(240px, 44vw); height: min(240px, 44vw); display: grid; place-items: center; background: #e2e8f0; border: 1px solid #94a3b8; }
  #entrance-bot { width: min(96px, 18vw); height: min(96px, 18vw); }
</style>
<div id="entrance-card">#entrance-card</div>
<sidekick-avatar id="entrance-bot" placement="viewport"
  entrance='{"source":"element","target":"#entrance-card","direction":"right","at":0.5,"gap":16}'>
</sidekick-avatar>
```

```tsx
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

export default function CardEntrance() {
  return <>
    <style>{`
      #entrance-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: min(240px, 44vw); height: min(240px, 44vw); display: grid; place-items: center; background: #e2e8f0; border: 1px solid #94a3b8; }
  #entrance-bot { width: min(96px, 18vw); height: min(96px, 18vw); }
    `}</style>
    <div id="entrance-card">#entrance-card</div>
    <SidekickAvatar id="entrance-bot" placement="viewport"
      entrance={{ source: 'element', target: '#entrance-card', direction: 'right', at: 0.5, gap: 16 }} />
  </>;
}
```

対象は不透明で、キャンバス以上の幅と高さを持ち、選んだ方向の到着位置が画面内に収まる空間が必要です。キャンバスのマスクは対象の矩形を使い、透明部分・角丸・複雑な輪郭には沿いません。対象のスタイル・`z-index`・DOM 位置は変更せず、ボットのサイズも自動では変更しません。

### 値と実行規則

| 項目 | 型と許容値 | 既定値と範囲 |
| --- | --- | --- |
| `source` | `string` | `viewport` または `element`、必須 |
| `edge` | `string` | `left \| right \| top \| bottom`、必須 |
| `target` | `Element \| string` | 同じ文書の対象、`element` で必須 |
| `direction` | `string` | `left \| right \| top \| bottom`、`element` で必須 |
| `at` | `number` | `0…1`、既定値 `0.5` |
| `inset` | `number` | `0…10000` CSS px、既定値 `24` |
| `gap` | `number` | `0…10000` CSS px、既定値 `16` |

宣言はマウントしたボットの準備完了後に一度実行します。内容が異なる宣言は新しい登場を開始しますが、オブジェクト参照だけの変更や既定値の省略では再生し直しません。以下の二度目の代入は最初と同じ内容のため再実行しません。`null`・属性の削除・React prop の削除は宣言を解除し、進行中の登場を取り消します。解除後に同じ設定を適用すると再実行できます。

```ts
import type { Entrance, SidekickAvatar } from '@hanana-kick/sidekick';

const bot = document.querySelector<SidekickAvatar>('#entrance-bot')!;
const entrance: Entrance = {
  source: 'element', target: '#entrance-card', direction: 'top', at: 0.75, gap: 16,
};
bot.entrance = entrance;
bot.entrance = { ...entrance };
bot.entrance = null;
```

形式が不正または範囲外のオブジェクトは拒否します。実行時に対象がない・小さすぎる・到着空間が不足する場合は `sidekick-error` が発生し、対象を自動では待ちません。新しい移動・行動・登場の指定や接続解除は進行中の登場を取り消すことがあります。`entrance` はページの配置設定であり、保存する Studio シーンには含まれません。

## 宣言型ライフサイクル：presence、task、home

ボットの表示状態、アプリが実行するタスク、休む場所を宣言します。Sidekick が登場 → 処理中の動作 → 結果への反応 → 慣性移動でホームへ復帰 → 休息をつなぎます。非同期処理はアプリが実行し、状態を明示的に知らせます。Sidekick はタイマーや動作の終了からタスク完了を推測しません。手動の復帰コマンドや座標計算は不要です。

**リリースバージョン：** 以下のライフサイクル例は `v0.16.0` を対象とします。HTML は固定 CDN ブラウザーバンドル、React は対応するパッケージビルドを使用します。セルフホストの場合は、同じバージョンの `dist/browser/` ファイルをまとめて配信し、CDN の import をローカルの `sidekick.js` URL に置き換えてください。

| HTML JSON / JavaScript プロパティ | React prop | 宣言 |
| --- | --- | --- |
| `presence` | `presence` | `{ visible: boolean, entrance?: Entrance, exit?: ExitOptions }`。`entrance` と `exit` は既存の登場・退場設定を再利用します。 |
| `task` | `task` | `{ id: string \| number, status: 'pending' \| 'success' \| 'error' \| 'cancelled', behavior?: BotBehavior, reaction?: { emotion: Emotion, duration?: number, intensity?: number } }` |
| `home` | `home` | `{ positioning: Positioning, rest?: { activity?, behavior?, emotion?, emotionIntensity?, trackingMode?, gaze?, bodyOrientation? }, returnOn?: readonly ('success' \| 'error' \| 'cancelled')[] }` |
| `sidekick-lifecycle-change` | `onLifecycleChange` | 読み取り専用の `lifecycleState` プロパティと同じ `SidekickLifecycleState` スナップショット。 |

- `home.positioning` は既存の viewport／要素基準の位置指定を使います。ホームは初期配置と、対象となるタスク結果の後の復帰に使われます。`returnOn` の既定値は `['success', 'cancelled']`。失敗時にも復帰するには `'error'` を追加し、自動復帰を無効にするには `[]` を指定します。
- `status` が `'pending'` の間は、`task.behavior` に `{ type: 'wait', target: '#lifecycle-work' }` などの動作を指定します。動作の終了はタスクの完了を意味しません。アプリが結果を確認したら、同じタスク ID の状態を `success`、`error`、`cancelled` に更新します。
- 既定の結果反応は `success` が `happy` で 1000ms、`error` が `sad` で 1000ms。`cancelled` に反応はありません。`task.reaction` では既存の `Emotion`、ミリ秒単位の duration、0〜1 の intensity を指定できます。反応後、復帰条件に合えばホームへ移動します。エラー時は既定で作業場所にとどまります。
- `home.rest.behavior` は対象を持たない `idle`、`celebrate`、`error` と省略可能な `duration` のみです。休息には既存の `activity`（`idle`、`thinking`、`listening`、`speaking`、`celebrating`、`still`）、`emotion`、`emotionIntensity`（0〜1）、`trackingMode`（`off`、`eyes`、`eyes-and-body`）、`gaze: { x, y }`（各 −1〜1）、`bodyOrientation`（`front`、`three-quarter`、`side` または部分的な `{ yaw, pitch, roll }`）も設定できます。ホーム到着後に休息状態を適用します。
- 新しいタスク ID は、それまでのタスク・反応・復帰を滑らかに置き換えます。同じ値の新しいオブジェクトを含め、同等の宣言ではライフサイクルを再開しません。古いリクエストの非同期コールバックが新しいタスクを上書きしないように ID を確認してください。
- `presence.visible: false` はタスク／ホームの動作に優先し、`exit` があればその退場設定を使います。`true` に戻すと最新の宣言から再開し、`entrance` があればその登場設定を使います。表示状態を変えてもアプリのネットワークリクエストはキャンセルされません。必要なら別途中断してください。 entrance/exit を省略するとその場でフェードし、初期状態が非表示なら直ちに隠れた状態を保ちます。明示した entrance/exit は移動を伴い、途中で反転しても現在位置と慣性を引き継ぎます。

`home.rest.gaze` に `{ target: '#nearby' }` または `{ target: element }` を指定すると、ボットを移動せず視線だけを向けられます。対象への視線は休息中の tracking を `off` として制御します。休息開始時に視線の対象が存在する必要があり、同じセレクターの新しいノードへ自動再接続はしません。

公開エントリーポイントから `SidekickPresence`、`SidekickTask`、`SidekickHome`、`SidekickLifecycleState` 型を import できます。HTML は JSON オブジェクトを使い、JavaScript プロパティと React props は同一文書の `Element` 対象にも対応します。

### HTML：実際のタスク結果を接続する

このコードを HTTP(S) で配信するページに入れてください。固定バージョンのブラウザーバンドルを CDN から読み込みます。Promise はローカルのシミュレーションなので、実際のアプリのリクエストに置き換えます。もう一度クリックすると新しいタスク ID が始まります。

```html
<button id="lifecycle-save">Save / restart</button>
<div id="lifecycle-work" style="margin: 96px 160px">Task target</div>
<sidekick-avatar id="lifecycle-bot" placement="viewport"
  style="width:96px;height:96px"
  presence='{"visible":true,"entrance":{"source":"viewport","edge":"left"}}'
  home='{"positioning":{"target":"viewport","placement":"bottom-right","gap":20},"rest":{"behavior":{"type":"idle"},"emotion":"neutral","trackingMode":"eyes-and-body","bodyOrientation":"front"}}'>
</sidekick-avatar>
<script type="module">
  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';
  const bot = document.querySelector('#lifecycle-bot');
  let latestId = 0;
  document.querySelector('#lifecycle-save').addEventListener('click', async () => {
    const id = ++latestId;
    bot.task = { id, status: 'pending', behavior: { type: 'wait', target: '#lifecycle-work' } };
    try {
      // Replace this simulated Promise with the actual save request.
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (id === latestId) bot.task = { id, status: 'success' };
    } catch (error) {
      if (id === latestId) bot.task = { id, status: 'error' };
      console.error(error);
    }
  });
</script>
```

### React：アプリの状態でライフサイクルを管理する

既存の React 19 アプリでは、対応するパッケージビルドからコンポーネントを import します。同じオブジェクトを props として渡すため、ref による移動コマンドは不要です。

```tsx
import { useRef, useState } from 'react';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';
import type { SidekickAvatarProps } from '@hanana-kick/sidekick/react';

export default function SaveAssistant() {
  const latestId = useRef(0);
  const [task, setTask] = useState<SidekickAvatarProps['task']>();

  async function save() {
    const id = ++latestId.current;
    setTask({ id, status: 'pending', behavior: { type: 'wait', target: '#lifecycle-work' } });
    try {
      // Replace this simulated Promise with the actual save request.
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (id === latestId.current) setTask({ id, status: 'success' });
    } catch (error) {
      if (id === latestId.current) setTask({ id, status: 'error' });
      console.error(error);
    }
  }

  return <>
    <button onClick={save}>Save / restart</button>
    <div id="lifecycle-work" style={{ margin: '96px 160px' }}>Task target</div>
    <SidekickAvatar placement="viewport" style={{ width: 96, height: 96 }}
      presence={{ visible: true, entrance: { source: 'viewport', edge: 'left' } }}
      task={task}
      onLifecycleChange={event => console.log(event.detail.phase)}
      home={{
        positioning: { target: 'viewport', placement: 'bottom-right', gap: 20 },
        rest: { behavior: { type: 'idle' }, emotion: 'neutral',
          trackingMode: 'eyes-and-body', bodyOrientation: 'front' },
      }} />
  </>;
}
```

キャンセル時は現在のタスクを `{ id, status: 'cancelled' }` に更新し、実際のアプリのリクエストも別途中断してください。静的 HTML では `task='{"id":"save-1","status":"pending","behavior":{"type":"wait","target":"#lifecycle-work"}}'` を使えます。結果が届いたら JSON 属性または JavaScript プロパティを更新します。

### ページ要素に追従するホーム

レイアウトとともに動くドックには、マウント済みの同一文書のセレクターまたは `Element` を指定します。JSON 属性ではセレクター文字列を使います。ホームを適用する時点で対象が存在する必要があります。既定の `follow: true` は既存の慣性位置制御でスクロール・サイズ・レイアウトの変化を追従します。

レンダラーの準備完了時に対象が存在すれば、マウント前でもセレクターを宣言できます。その後ホームを変更する場合は、新しい宣言を適用する前に対象をマウントしてください。

```js
bot.home = {
  positioning: { target: '#dock', placement: 'center-left', gap: 12, follow: true },
  rest: { behavior: { type: 'idle' }, emotion: 'neutral' },
  returnOn: ['success', 'error', 'cancelled'],
};
```

ホームの対象が存在しない、または削除された場合は `sidekick-error` を通知し、ボットは現在の位置を維持します。任意の代替位置への移動や、新しいノードへの自動再接続は行いません。レンダラーの準備完了時に対象が存在するようにし、ノードを交換したら宣言も更新してください。既存の位置計算・移動範囲・モーション抑制の規則はそのまま適用されます。

既存の `behavior`、`positioning`、`entrance`、`perform()`、`reactTo()`、移動 API は引き続き直接制御に使えます。作業から復帰までをつなぐ場合は `presence`/`task`/`home` を使い、同じ流れを競合する低レベルの宣言で同時に制御しないでください。直接コマンドはライフサイクル制御を中断する場合があり（`phase: 'suspended'`）、同等の rerender では制御を取り戻しません。再開するには対象の宣言を変更するか、解除して再適用してください。

### ライフサイクルの進行を確認する

`bot.lifecycleState` を読むか、`sidekick-lifecycle-change` / React の `onLifecycleChange` を購読します。スナップショットには `phase`、`taskId`（`string | number | null`）、`taskStatus`（`pending | success | error | cancelled | null`）、省略可能な `reason` 文字列があります。`phase` は `idle`、`hidden`、`entering`、`working`、`pending`、`reacting`、`returning`、`resting`、`settled`、`suspended`、`error` のいずれかです。これは表現上の段階です。動作終了後も `pending` は続くことがあり、`resting` はホーム到着と休息適用を表し、アプリのリクエスト完了そのものではありません。ライフサイクルのエラーは `taskStatus` を変更しません。

```js
bot.addEventListener('sidekick-lifecycle-change', event => {
  console.log(event.detail.phase, event.detail.taskId, event.detail.taskStatus);
});
console.log(bot.lifecycleState);
```

## 宣言型の動作 (behavior)

`behavior` は、アプリケーションが望む動作を宣言する決定論的な API です。LLM、自然言語推論、ネットワークリクエストは使いません。実際の読み込み・保存・検証の状態はアプリが判断し、Sidekick は宣言に合わせて移動と既存のアクティビティ・表情を組み合わせます。`wait` がサーバーの処理を確認したり、`review` が項目の内容を検証したりするわけではありません。

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

| 宣言 | 対象・時間 | 動作 |
| --- | --- | --- |
| `{ type: 'wait', target }` | CSS selector または同じ文書の `Element` | 対象へ移動して待機。置き換え・キャンセルまで継続 |
| `{ type: 'follow', target }` | CSS selector または同じ文書の `Element` | 対象へ移動し、対象の位置の変化に追従。置き換え・キャンセルまで継続 |
| `{ type: 'guide', target }` | CSS selector または同じ文書の `Element` | 対象へ移動して案内する動作。置き換え・キャンセルまで継続 |
| `{ type: 'review', targets }` | CSS selector または `readonly Element[]` | 対象の一覧を順番に訪問。各対象での `dwell` は既定で 1000ms |
| `{ type: 'celebrate' }` | `duration` は既定で 1600ms | お祝いの動作後に完了 |
| `{ type: 'error' }` | `duration` は既定で 1800ms | エラーを知らせる動作後に完了 |
| `{ type: 'idle' }` | 既定では無期限 | 置き換え・キャンセルまで待機動作 |

- `wait`・`follow`・`guide`・`idle` には、任意で `duration` を指定して自動完了させることができます。対象のある動作の `duration` は、到着後から計測します。時間の単位はすべて ms です。
- 対象が必要な動作は、`side: 'right'`（既定）/ `'left'` / `'above'` / `'below'`、`gap: 16`（既定、CSS px）、`timeout: 5000`（既定、ms）を受け取ります。移動速度・加速度には既存の移動設定を使用します。現在の親 DOM と `placement` を維持し、別のコンテナには移しません。
- selector は文書内で検索します。`wait`・`follow`・`guide` は、最初に一致する接続済みの要素を使います。まだなければ DOM の変更を待ち、`timeout` 以内に現れなければ `error` で終了します。`Element` も、同じ文書に接続されるまで待ちます。不正な selector は入力エラーです。
- `review` の selector は、最初に接続済みの対象が見つかったときに一覧を一度だけスナップショットします。明示的な `Element[]` は即座にスナップショットし、接続されていない項目をスキップして、残る項目がなければすぐに完了します。selector は文書順、配列は渡された順です。スナップショット後に追加された項目は含まず、削除された項目はスキップします。一覧を読み直すには、新しい `perform()` を開始してください。
- `behavior` プロパティと HTML 宣言は、要素を文書に追加する前にも設定でき、接続後に開始します。一方、`perform()` は接続済みの要素で実行してください。接続されていない要素では `status: 'error'` の結果を返します。
- 新しい宣言は、以前の動作を `cancelled` で終了して置き換えます。`stopBehavior()`、`behavior = null`、HTML 属性の削除、React prop の削除、要素の切断もキャンセルします。`perform(declaration, { signal })` に `AbortSignal` を渡すと、`abort()` でキャンセルできます。
- 動作が管理している移動・アクティビティ・視線に新しいコマンドを送ると、その動作による制御を解除します。たとえば直接 `moveTo()` や `motion.to()` を呼び出したり、アクティビティ・追従の属性を変更したりすると、動作をキャンセルして新しい入力を適用します。以前の動作のクリーンアップによって新しい入力を上書きすることはありません。
- 不正な宣言は、現在の動作を変更する前に検証します。JavaScript のメソッド/プロパティへの入力は例外を送出し、HTML/React の入力エラーは `sidekick-error` / `onError` に渡されます。有効な `perform()` の Promise は、実際の終了時に `BehaviorResult` で解決されます。対象の timeout などのランタイム失敗は `status: 'error'`、置き換え・キャンセルは `status: 'cancelled'` です。完了したかどうかを確認してから次の処理を開始してください。
- `bot.behaviorState` と `sidekick-behavior-change` の `detail` は `{ id, type, status, itemIndex, itemCount, completedItems }` です。状態は `idle`、`resolving`、`moving`、`acting`、`completed`、`cancelled`、`error` で、`itemIndex` は 0 始まり、対象を選ぶ前は -1 です。終了イベントと Promise の結果は `{ id, type, status, reason?, completedItems }` です。

### 実際の読み込みが完了するまで待つ

対象コンテナは、リクエスト前に DOM に存在する必要があります。アプリでサーバー処理の完了を待ってから、お祝いまたはエラーの動作に切り替えます。リクエストが完了する前に、動作へ任意の完了時間を設定しないでください。

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

### 項目を順番に確認する

`review` は各項目を訪問する視覚的な動作です。実際の検査結果は、別のアプリロジックで処理してください。中断された場合や対象がない場合は、お祝いの動作を開始しません。

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

### React：アプリの状態を動作に接続する

`behavior` は文字列属性へシリアライズせず、要素のアップグレード後に実際の JavaScript プロパティへ渡します。`Element` の同一性と配列の順序を維持し、同じ内容の inline オブジェクトを再レンダリングしても動作は再開しません。React は SSR で DOM を参照したり、動作を実行したりしません。サーバーレンダリングでは selector を使い、実際の `Element` はクライアントで取得してから渡してください。有限の動作を意図的に再開するときは、ref の `perform()` を呼び出します。

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

### HTML JSON 宣言

HTML の `behavior` は JSON なので、対象は selector 文字列で指定します。実際の `Element` / `Element[]` は、JavaScript プロパティまたは React prop でのみ渡します。

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

## マウス追従とドラッグ

`tracking-mode` / `trackingMode` は、追従動作全体をひとつの値で選択します。既定値は `eyes-and-body` です。属性や React prop を省略しても、目と体がマウスを追いかけます。

- `off`：マウスを追従せず、最後の `lookAt()` または `gaze-x`/`gaze-y` の明示的な視線に戻ります。
- `eyes`：目だけがマウスを追いかけます。既存の体のポーズとモーションはそのままです。
- `eyes-and-body`：目と一緒に体が小さく滑らかに振り向きます。体の回転は、既存のモーションに加算する独立したレンダリングレイヤーです。`pose.rotation`、モーションの経過時間、体の向きは変更しません。

```ts
import type { TrackingMode } from '@hanana-kick/sidekick/core';
const mode: TrackingMode = 'eyes-and-body';
bot.trackingMode = mode;
// HTML: <sidekick-avatar tracking-mode="eyes-and-body"></sidekick-avatar>
// React: <SidekickAvatar trackingMode="eyes-and-body" />
```

以前の `mouse-tracking` / `mouseTracking` にも対応しています。名前付きのモードがない場合、`true` は `eyes`、`false` は `off` と解釈します。両方を使うと `tracking-mode` が常に優先され、その属性を削除すると残っている `mouse-tracking` 設定が再適用されます。両方ともなければ、既定の `eyes-and-body` に戻ります。`bot.mouseTracking = false` は明示的な `mouse-tracking="false"` を残して、従来どおり追従をオフにします。`bot.mouseTracking` を読み取ると、どちらの追従モードでも `true` です。名前付きのモードを使った後にオフにするには、`bot.trackingMode = 'off'` を使用してください。

文書全体のマウスを追従し、タッチ・ペンの入力は無視します。モードの変更・オフ・ウィンドウからの離脱・フォーカスの喪失時には現在位置から滑らかに戻り、非表示・切断中は追従リスナーを削除します。切断時には見えない体のレイヤーを初期化し、再接続すると新しいポインター入力を待ちます。ドラッグ中は追従入力を止め、体の向きの操作と競合しないようにします。視差効果を減らす設定では体の追従を抑え、既存のオフセットだけを滑らかに解除します。`paused` では体の追従を現在位置で停止し、目の視線は即座に反映します。ただし、追従をオフにしたり目のみのモードに変えたりする場合は、体のレイヤーだけを滑らかに解除し、アクティビティ・基本ポーズの時間は停止したまま維持します。

`interaction` は別の設定です。

- `none`（既定）：要素全体でクリックを透過します。この状態でもマウス追従を有効にできます。
- `box`：矩形全体で、ドラッグにより体の向きを回転し、クリック・Enter・Space で `sidekick-activate` を送ります。透明なピクセルもクリック領域です。

`paused` は繰り返しモーションを停止し、進行中の切り替えは目標で完了します。`activity="still"` は繰り返しアクティビティをオフにしますが、明示的な図形・目・ポーズの切り替えは使用できます。`prefers-reduced-motion` でも新しい切り替えは即座に適用されます。

## デザイン JSON とアクセサリー

現在の保存形式は **v7** です。外観は体の `shape`・`color`、目の `color`、アクセサリーの `id`・`preset`・`slot`・`color` で構成され、左右の目の `weights` は表情アニメーションの状態です。

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

- `createDesign(patch)` は既定値を補完します。目の既定の重みは両方とも `{ smile: 0, blink: 0 }`、装備は `[]` です。起動時にベレー帽を追加するのは Studio だけです。
- `patchDesign(current, patch)` は元のデータを変更せず、目の重みを深くマージします。`accessories` を渡すと配列全体を置き換えます。`bot.updateDesign()` も同じ規則です。
- スロットごとにひとつ、全体で最大 6 個です。ベレー帽・光の輪・王冠は頭のスロット、蝶ネクタイ・マフラー・ネックレスは首のスロットを共有します。リング/星のイヤリングは、必ず `leftEar` または `rightEar` を明示してください。
- id は英小文字から始まり、小文字・数字・ハイフンで構成される一意の文字列で、最大 40 文字です。`createAccessory()` が既定の id を作成しますが、併用する際に重複しないよう指定してください。
- `equipAccessory(design, item)` は該当するスロットだけを置き換えます。`removeAccessory(design, id)` は該当インスタンスだけを削除します。要素には同名の非同期メソッドがあります。
- `parseDesign(objectOrJson)` は、バージョン・不明なキー・数値・色・id・スロット・重複した装備を厳密に検証し、独立したコピーを返します。JSON 文字列は 64KiB 以下です。検証失敗は例外または Promise rejection となり、以前のデザインを維持します。

王冠には、35 種類の体ごとに支えとなる頂点・山と着用時の傾きを個別に指定しています。ベレー帽と同じく空洞の開口部に体が入りますが、金属の王冠のメッシュを曲げたり、軸ごとに引き伸ばしたりはしません。位置・回転・均等な大きさだけを変え、図形の切り替え中も同じ剛体の形を維持します。丸い体と剛体のリングが接する一部の場所には、自然な隙間が残る場合があります。

HTML の複合データは、有効な JSON 文字列で指定します。

```html
<sidekick-avatar
  shape="clover4Leaf"
  accessories='[{"id":"frames","preset":"glasses","slot":"eyes","color":"#334155"}]'
  left-smile="0.7"
  right-blink="0.4"
></sidekick-avatar>
```

体のサイズ・奥行き・変形・`profiles`、目の幅・高さ・間隔・位置・`targets`、アクセサリーのサイズ・装着位置・追従値は、公開された外観パラメーターではありません。v7 JSON に入れると拒否されます。図形ごとの比率と装着位置は内部で合わせ、ランタイムのポーズモーションは別途提供します。

### シーン JSON ファイル

Studio の JSON ファイルとコード例は、現在のデザインにランタイム設定を加えた `sceneVersion: 3` envelope を使用します。`design.version: 7` とは別のバージョンです。ファイル名は `sidekick.scene.json` で、デザインだけを保存した以前のファイルも読み込めます。

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

`createScene()` の既定の追従モードは `eyes-and-body` で、`design`、`bodyOrientation: {yaw,pitch,roll}`、独立した `zoom`、`activity`、`paused`、`trackingMode`、`interaction`、`renderStyle`、`gaze: {x,y}`、`time`、`motion`、`shapeDuration`、`shapeEasing`、`motionDuration`、`motionEasing` を既定値で補完します。`parseScene()` は完全な `sceneVersion: 3` envelope を厳密に検証します。以前のシーンバージョンと `camera`/`view` 設定キーには対応しておらず、自動変換もしません。新しいキーで書き直すか、Studio で初期化してください。任意の幾何学値・不明なキー・不正な装備 id のモーション・未対応のバージョンは拒否します。`migrateScene()` はデザイン専用ファイルを受け取り、既定のランタイム設定を付加できます。

Studio の読み込み・初期化は、`resetTracking()` によって以前のリアルタイム追従オフセットを即座に消し、新しいシーンに残らないようにします。通常のモード変更では、上で説明した滑らかな復帰を維持します。

シーンは、**設定した目標と時間の値**を再現します。再生中の正確な中間フレーム、自動まばたきの位相、リアルタイムのマウス座標、ブラウザーの背景は録画しません。マウス追従が有効なら、読み込み先のページのマウスに新たに追従します。`motion` は保存したデザインとは別のランタイム目標です。

Studio の「JSON ファイルを開く」とテキストの「JSON を適用」は、データ全体を先に検証してから一度に適用します。最大サイズは 64KiB（UTF-8）です。失敗すると、現在のデザイン・体の向き・進行中のアニメーション・ローカル保存を維持します。複数のファイルを続けて選ぶと最後の選択だけを適用し、初期化・直接編集・アンマウントは待機中のファイル読み取りをキャンセルします。シーンファイルは体の向き・追従・アクティビティ・一時停止・時間・ポーズの目標も復元し、以前のデザインファイルはプレビュー設定を既定値に初期化します。

### 以前のファイルを読み込む

`parseDesign()` は v1〜v6 も検証した後に v7 へ変換します。案内が必要な場合は、`migrateDesign(input)` の `{ design, warnings }` を使ってください。以前の `face` スロットは `eyes` に変更し、id・色・表情は維持します。以前のカスタムの体は最も近いカタログの輪郭に近似し、削除された幾何学値は検証してから破棄します。元の外観を正確に復元する機能ではありません。不明なキー、不正な幾何学値、重複したスロットは黙って破棄せず、拒否します。

v1 の `capsule`/`round` の目はニュートラルに、`arc` は笑顔に移行します。v2/v3 の `expression`・`openness` は笑顔と閉眼の重みに、v4〜v6 の重みはそのまま移行します。v6 の装備入力では、既存の `beret`・`halo`・`glasses` と `head`・`face` だけが許可されます。新しい装備と 6 スロットには v7 を使ってください。

## アニメーションと命令型 API

### 図形と表情

```ts
const first = bot.setShape('puffy'); // 450ms, smooth
const next = bot.setShape('pixelTriangle', { duration: 650, easing: 'linear' });
console.log(await first); // { finished: false }: 새 목표로 대체
console.log(await next);  // { finished: true }

await bot.setEyeWeights('left', { smile: 0.85 }, { duration: 300 });
await bot.setEyeWeights('right', { blink: 0.4 }, { duration: 180 });
await bot.setExpression('both', 'neutral');
```

35 種類の図形間の切り替えは、現在見えている輪郭から次の目標へ続きます。目標名は即座に `design.body.shape` に保存され、モーフ中間の形状は JSON に入れません。色・装備の編集は、進行中の図形の切り替えを維持します。要素の JavaScript の `design` プロパティ/`setDesign()` で図形を変更すると即座に適用されます。HTML の `design` 属性と React の `design` prop の図形変更は、`shape-duration`/`shapeDuration` で切り替わります。視差効果を減らす設定、一時停止中、接続されていない要素では、切り替えを即座に適用します。

目の `smile`・`blink` はそれぞれ 0〜1 で、合計が 1 になるようには正規化しません。`left` は正面の画面左側であるモデルの -X、`right` は +X です。重みの部分変更は、省略した値と反対側の目を維持します。プリセットは正確に `neutral → {smile:0,blink:0}`、`smile → {smile:1,blink:0}`、`blink → {smile:0,blink:1}` です。`blink` は閉じた状態を維持するため、再び開くには `neutral` または新しい重みを送ってください。

命令型の切り替えの既定値は、`setShape()` が 450ms、`setEyeWeights()`/`motion.to()` が 400ms、`setExpression()` は blink が 90ms・neutral が 180ms・smile が 280ms です。明示した `options` が優先され、`duration` は 0〜60000ms、`easing` は `smooth` または `linear` です。HTML の timing 属性は、宣言的な属性の切り替え用です。

### 体の向きとポーズ

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

`BodyOrientation` は `{yaw, pitch, roll}` の角度（度）だけを含みます。`createBodyOrientation()` は 3 軸を 0 に初期化します。`setBodyOrientation()` は指定した軸だけを変更し、`setBodyOrientationPreset()` は拡大率を維持します。`zoom` は別の数値で、既定値は 1、許可範囲は 0.5〜3 です。`createZoom()` と `ZOOM_RANGE` もコアで提供します。シーン JSON は `sceneVersion: 3` の `bodyOrientation` と `zoom` を別々に保存し、デザイン JSON にはこの 2 つの設定を入れません。以前の `camera`/`view` API・属性・prop・イベントの別名は提供しません。

`interaction="box"` のプレビューでは、1 本指/マウスのドラッグが回転、ホイール・トラックパッド（ピンチによる Ctrl+wheel を含む）と 2 本指のピンチが中心基準の拡大です。ピクセル/行/ページのホイール単位を正規化し、乗算の倍率で変更します。ピンチの中心点を動かしてもパンは行いません。設定パネルのスクロールはそのまま維持し、`interaction="none"` では回転・拡大の入力を受け付けません。拡大中も図形・体・目のアニメーションは続き、カーソル追従はニュートラルへ戻って、新しいポインター移動から再開します。

高倍率では、アバターやアクセサリーがキャンバスの境界で切れる場合があります。PNG は現在拡大された画面に見えているピクセルだけを保存するため、全体をエクスポートするには、先に拡大を初期化するか倍率を下げてください。拡大はレンダラーの正投影だけに適用され、モデルのサイズと縦横比は変わりません。


体の向きとは、固定した画面内でキャラクターの体が向く方向です。`front` は yaw 0°、`three-quarter` は 45°、`side` は 90° で、各プリセットの pitch・roll は 0° です。正の yaw は正面を画面右方向へ、正の pitch は下方向へ、正の roll は画面の反時計回りへ回転します。体の向きの値は、保存されたデザインと基本ポーズを変更しません。

`MotionTarget` には、体の回転 3 軸（各 -2π〜2π）、顔の uv 2 軸（各 -0.5〜0.5）、左右の目の重み、共通の開眼制限 `eyes.openness`（0〜1）、装着された id ごとの回転 3 軸（各 -π〜π）を指定します。共通の開眼は既存の互換ランタイム制限であり、別途保存する表情状態ではありません。ポーズモーションはデザイン JSON を変更しません。

体・顔・左右の目・共通の開眼・各装備は独立した時間軸です。ひとつのチャンネルを新しく制御しても、無関係なチャンネルを再開しません。中断されたリクエストは `{ finished: false }`、完了したリクエストは `{ finished: true }` で終了します。画面外や非アクティブのタブでは、フレームループを停止します。

| 要素 API | 用途 |
| --- | --- |
| `design`, `setDesign(designOrJson)` | デザインの読み取り/全体の置き換え。`design` getter はコピー |
| `updateDesign(patch)` | 外観・目の重みの部分変更 |
| `equipAccessory(item)`, `removeAccessory(id)` | スロットの置き換え/インスタンスの削除 |
| `setShape(name, options)` | 図形の目標の保存と切り替え |
| `setEyeWeights(side, weights, options)` | 左右/両目の部分的な重みの保存と切り替え |
| `setExpression(side, preset, options)` | 表情プリセットの保存と切り替え |
| `setActivity(name)`, `activity` | アクティビティの設定、現在のアクティビティの読み取り |
| `resetTracking()` | リアルタイムのポインター視線・体のオフセットを即座に初期化し、最後の手動視線を復元。モード・基本ポーズ・体の向きは維持 |
| `trackingMode`, `mouseTracking`, `paused`, `interaction`, `renderStyle` | 該当する動作の読み取り/設定 |
| `lookAt({space:'view',x,y})` | -1〜1 の範囲の明示的な視線 |
| `bodyOrientation`, `setBodyOrientation(patch)` | `BodyOrientation` の読み取り/部分設定。角度は度。getter はコピー |
| `setBodyOrientationPreset(name)` | 正面・斜め・側面の向きのプリセット。拡大率は維持 |
| `size` | 基準サイズの取得/設定。1–2048 CSS px、未指定時 200。null で CSS に戻す |
| `zoom` | 独立した拡大率の読み取り/設定。0.5〜3、既定は 1 |
| `motion.to(target,options)`, `motion.cancel()` | ポーズの切り替え/全ポーズチャンネルのキャンセル |
| `seek(seconds)` | 繰り返しアニメーションの時間を 0〜86400 秒で指定 |
| `pose` | レンダリングエンジンが最近確認したポーズのコピー、読み取り専用。worker モードでは非同期更新 |
| `snapshot({crop,padding}?)` | レンダリング準備後の透明 PNG `Promise<Blob>`。既定ではアルファ境界で切り抜く |
| `capturePixels()` | 最近画面に表示されたキャンバス全体の同期読み取り。worker に送った最新のコマンドまでは待たない |
| `capturePixelsAsync()` | 最新のコマンド以降の新しいフレームを待つ `Promise<{width,height,pixels}>`。下の行から RGBA |
| `ready`, `diagnostics` | 準備状態、`worker`/`main` backend + `webgl2`/`canvas2d` graphics、世代・コマンド確認番号、アニメーション時間、フレーム・draw call・バッファー数 |

## OffscreenCanvas とレンダリング

対応ブラウザーでは、要素の canvas を `transferControlToOffscreen()` で専用の Web Worker に渡します。メッシュ・モーション/図形の切り替え・視線追従の spring・WebGL2/Canvas2D レンダリングは worker で処理します。メインスレッドは DOM、アクセシビリティ、入力、サイズの監視、コマンドの送信を担当します。`bot.diagnostics.backend` で、実際の実行経路が `worker` か `main` かを確認できます。

`bot.diagnostics.backend` は実行場所（`worker`/`main`、初期化前は `none`）、`bot.diagnostics.graphics` は描画方式（`webgl2`/`canvas2d`、スナップショット取得前は `none`）です。Canvas2D も全 35 図形とアクセサリーの同じメッシュ、目の曲線、アニメーション、深度・遮蔽、透過スナップショット、ライフサイクル制御を使います。CPU ラスタライザーの描画バッファーの長辺は最大 384px で、CSS サイズや比率は変わりません。輪郭のアンチエイリアスは WebGL MSAA と異なり、CPU 性能も同等ではありません。

セルフホスティングの場合は、worker ファイルをページと同じ origin から、正しい JavaScript MIME で配信してください。ブラウザーのセキュリティポリシー上、異なる origin の Worker URL をそのまま使うことはできません。CSP を使うサイトには、`worker-src 'self'` など該当 worker を許可するポリシーが必要です。この同一 origin のセルフホスティング経路では、Blob worker や特別なセキュリティヘッダーは不要です。異なる origin の CDN 経路では、前述の Blob module worker と対応する CSP 設定を使用します。未対応、CSP/ファイル読み込みの失敗、worker 初期化の失敗時には、新しい canvas に交換してメインスレッドレンダラーで復旧します。

デザイン・体の向きの設定と入力検証は即座に反映されますが、worker のポーズ/ピクセルは非同期で届きます。コマンドの直後に正確な画面が必要な場合は、`await bot.capturePixelsAsync()` または `await bot.snapshot()` を使用してください。PNG のエクスポートは新しいレンダリングフレームを待ちます。切断時には worker、GPU リソース、入力リスナーをクリーンアップし、再接続すると新しいレンダリング世代を開始します。

ブラウザーの仕様は、[OffscreenCanvas の転送](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen) と [CSP worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src) を参照してください。すでに転送した canvas やコンテキストを作成した canvas は再転送できないため、復旧時には内部の canvas を交換します。ホスト要素と React ref は維持されます。


## イベントとクリーンアップ

イベントは `CustomEvent` で、Shadow DOM の境界を越えてバブリングします。React ラッパーも同じイベントオブジェクトをコールバックに渡します。

| DOM イベント | React コールバック | `detail` |
| --- | --- | --- |
| `sidekick-behavior-change` | `onBehaviorChange` | `BehaviorState`: id, type, status, itemIndex, itemCount, completedItems |
| `sidekick-behavior-end` | `onBehaviorEnd` | `BehaviorResult`: id, type, status, reason?, completedItems |
| `sidekick-ready` | `onReady` | `{}` |
| `sidekick-error` | `onError` | `{ message, ... }`。復旧可能なコンテキスト喪失では `recoverable: true` |
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

PNG の既定の `crop: true`、`padding: 0` は、現在のキャラクターの不透明/半透明の全ピクセルの境界で切り抜きます。装備も含み、背景は透明に保ちます。`padding` は 0〜4096 の整数ピクセルで、元のキャンバスサイズが必要な場合は `snapshot({ crop: false })` を使用してください。完全に空の場合は、透明な 1×1px（余白は別）を返します。正確な最新ピクセルは `await capturePixelsAsync()` で読み取ります。同期の `capturePixels()` は、worker モードでは最近表示したフレームだけを読み取ります。どちらのメソッドもキャンバス全体のサイズを維持し、`/core` の `alphaBounds()`・`cropPixels()` も使用できます。

初期の `ready`/エラーまで受け取るには、要素を文書に追加する前にリスナーを登録するか、React コールバックを使ってください。すでに接続されている要素では、まず `ready` を確認します。`setDesign()` などの Promise のエラーも `try/catch` で処理してください。

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

React はアンマウント時に、ラッパーのリスナーと要素をクリーンアップします。自分で作成した PNG ダウンロード用の Object URL は、使用後に `URL.revokeObjectURL()` で解放してください。要素を再接続すると保存されたデザインでレンダラーを作成し、進行中だった切り替えはキャンセルされます。WebGL コンテキストの喪失やコンテキスト取得後の初期化失敗では、復旧可能なエラーを送り、新しい canvas で Canvas2D を一度試します。最後に確認されたポーズ・時間と現在の設定は保持しますが、実行中の明示的なモーション・図形切り替えの Promise はキャンセルし、残りのタイムラインは再開しません。Canvas2D も失敗すると読み取り可能なエラーを表示します。

## SSR とブラウザー対応

サーバーでは `/core` を使ってデザインを作成し、シリアライズしてください。モジュールの import 自体は DOM グローバルなしで可能ですが、実際の Custom Element の登録・生成・canvas レンダリングはブラウザーで行う必要があります。React ラッパーは SSR で通常の HTML/aria/style だけを持つ空のホストを作り、クライアントで props を適用して登録します。SSR で props が適用されたキャラクターのピクセルやデザイン属性が完成していると仮定しないでください。`ref` はアップグレード後に利用可能になり、`onReady` は props 適用後に渡されます。React ラッパーを使う Next.js コンポーネントには `'use client'` の境界を設けてください。サーバーで PNG を作る API は提供していません。

サーバー HTML の基本タグは、ブラウザーでの登録後にアップグレードされます。同じ DOM インスタンスを維持し、固定の CSS サイズを指定すれば、読み込み中のレイアウトのずれを減らせます。HTML を直接 SSR する場合、初期属性は文字列/JSON であり、DOM プロパティへの代入とは異なります。[React の Custom HTML Elements の案内](https://react.dev/reference/react-dom/components#custom-html-elements) を参照してください。

Custom Elements と Canvas2D に対応する最新のブラウザーが必要です。WebGL2 を優先しますが必須ではありません。両方の描画方式を初期化できない場合は、要素内に読み取り可能なエラーを表示し、`sidekick-error` を送ります。基本の要素は画像の役割を持ち、`interaction="box"` ではキーボードで有効化できるボタンの役割を持ちます。用途を説明する `aria-label` を指定してください。画面外・非アクティブのタブでの停止、reduced-motion、サイズ変更、削除時の GPU リソース解放を処理します。

## Studio と開発

ガイドの全体セレクターで Custom Element または React を選ぶと、サンプルとパラメーター名がその形式で表示されます。ボットの状態ページには設定可能な項目、許容値、既定値、実行プレビューとその完全なソースがあります。項目を有効にすると値を上書きし、無効な項目は Studio のシーンを保持します。プレビューの変更は Studio の保存値を上書きしません。

Studio は **React 19 + Vite 8 + Tailwind CSS 4 + 実際の shadcn/ui Radix/Nova コンポーネント**と Slate のカラートークンで実装した独立したエディターです。コアを使用する Web サイトには、これらの UI 依存関係は入りません。以下はソースを開発する人向けのコマンドで、Node.js 24 LTS を使用します。`.nvmrc` と CI は Node.js 24 に統一し、`package.json` の `devEngines` でソース開発環境を検証します。この要件はビルド・開発ツールのみに適用され、ブラウザー/CDN での利用には Node.js は不要です。

```sh
nvm use
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

外部からのアクセスが必要な場合だけ `HOST=0.0.0.0` を使用してください。ポートは `PORT` で変更します。静的な Studio のデプロイには `dist/` 全体を使います。ルートの `dist/index.html` と互換パスの `dist/playground/index.html`、ハッシュ付きの `dist/assets/` を生成します。npm パッケージは Studio の出力ではなく、`dist/library/` と `dist/browser/` を含みます。利用者がこの開発用のビルドコマンドを実行する必要はありません。`pack:release` には、変更と prebuilt 成果物をすべてコミットしたクリーンな checkout とシステムの `zip` コマンドが必要で、GitHub Release を自動公開することはありません。

### Studio でできること

- 外観：検索・キーボード操作に対応した 35 種類のシルエットタイル、体・目の色、実際にレンダリングしたサムネイル付きの 12 種類の装備とスロットごとの色
- アニメーション：アクティビティ・一時停止、マウス追従のオフ/目のみ/目と体、明示的な視線、図形の切り替え時間・easing、左右の笑顔・閉眼の重み
- 体の向き：yaw・pitch・roll、正面・斜め・側面のプリセット、プレビューのドラッグとの双方向同期
- JSON：ファイル/テキストの読み込み・エクスポート、現在の設定が反映される HTML/React コードとコピーボタン、アルファ境界に合わせた透明 PNG の保存

デスクトップではプレビューと設定を横に並べます。モバイルの縦画面ではプレビューを固定し、下の設定だけをスクロールさせ、高さの低い横画面では横に並べます。`100dvh` と safe-area を使用します。タブ・スライダー・トグルは、shadcn/Radix のキーボード操作を維持します。フォントはローカルバンドルに含めます。プレビューの市松模様・明るい色・暗い色は DOM の背景で、PNG には含まれません。

自動保存は、このブラウザーの `sidekick.studio.scene.v3` にシーン全体を保存します。デザイン、体の向き、独立した zoom、視線、アクティビティ、追従、時間、操作設定、モーション目標、一時停止、切り替え設定を含み、ホストページの配置・移動座標・実行中の動作は保存しません。`sidekick.design.v7` は以前のデザイン専用データを読み込むためのフォールバックです。シーンファイルのエクスポートにも同じ scene envelope を使います。保存された現在のシーンや v7 デザインがなければ v6→v1 の順に読み取って変換し、以前のキーの原本は保持します。不正な原本は JSON タブに開き、最初の編集時に `.recovery` バックアップが成功してから新しいデータを保存します。ストレージがブロックされている場合は JSON のエクスポートを使ってください。初期化すると、既定の square + ベレー帽、正面の体の向き、目と体のマウス追従に戻ります。ガイドと API playground は保存されたシーンを読み取りますが、そこで実行する一時的なコマンドは Studio の保存値を変更しません。

UI の構成は `components.json` と `playground/components/ui/`、保存・コマンド・復旧は `studio-controller.ts` にあります。React の再レンダリングとタブの切り替えでは、安定したひとつの要素を維持し、進行中のモーフや体の向きをリセットしません。[公式 shadcn/ui Vite インストール](https://ui.shadcn.com/docs/installation/vite) の方法で生成した実際のソースを使用します。

### GitHub Pages へのデプロイ

この公開リポジトリの GitHub Actions ベースの Pages の URL は、[hanana-kick.github.io/sidekick/](https://hanana-kick.github.io/sidekick/) です。`.github/workflows/pages.yml` は、既存の公開 Studio を更新する手動ワークフローです。CI を通過したコミットを選び、**手動実行時に `approve_public_deployment` を明示的に承認した場合にのみ**ビルド・デプロイします。コミットの push やワークフローファイルの追加だけではデプロイしません。

ワークフローは `actions/configure-pages` で既存の設定だけを読み取り、Pages の有効化やドメイン・公開範囲・セキュリティ設定は変更しません。既定の Vite base は `./` なので、**`npm run build:all` で作成した同じ `dist/`** が、カスタムドメインの `/` と GitHub Pages の `/sidekick/` の両方で動作します。それぞれの場所の `index.html` および `playground/`・`playground/index.html` エントリーポイントにも対応し、スクリプト・スタイル・フォント・装備サムネイル・favicon をデプロイ先から読み込みます。ホームリンクと計算されたサムネイル URL は、現在の文書の階層ではなくビルドモジュールの位置を基準にします。

固定パス専用のデプロイが必要な場合は、`SIDEKICK_BASE=/my-path/ npm run build:all` のように明示的に上書きできますが、その成果物は指定したパスで配信する必要があります。手動の Pages ワークフローは、カスタムドメインの `base_path` に応じて base を変更しません。`node --test tests/pages-build.test.mjs` は、同じ既定ビルドのルート・サブパスのアセット参照を検査し、実際のブラウザーのレンダリングと操作は `npm run test:browser` で確認します。デプロイ後は `verify` ジョブが実際のプロジェクト URL を Chromium で開いて検査し、スクリーンショットを Actions の成果物に保存します。選択したコミットのデプロイと検証の両方のジョブ結果を確認してください。

### 検査

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

単体テストは、最小デザイン・厳密な移行・属性検証・モーフ・モーション・幾何学・サーバー import を対象とします。Studio のテストは、ReactDOM + jsdom で実際の Radix の操作とモックレンダラーの境界を検査するもので、レイアウト・WebGL の検証を代替するものではありません。パッケージのテストは、インストール成果物・公開エントリーポイント・React の契約を確認します。

ブラウザーテストは、実際の HTTP origin での WebGL・透明度・アニメーション・装備・モバイルレイアウト・ライフサイクル・fallback を対象とします。`CHROMIUM_PATH` で実行ファイルのパス、`SIDEKICK_SCREENSHOTS=artifacts` でスクリーンショットの保存先を指定できます。ネットワークが遮断された QA の `SIDEKICK_OFFLINE_BROWSER=1` は、`http://sidekick.test` のリクエストに実際のビルドファイルを返し、ローカルストレージ/再読み込みも検査します。Safari/Firefox・実際のモバイル GPU の検証は別です。テストコマンドがあることは、その環境でテストに合格したことを意味しません。

### 性能の確認と運用

- 停止したシーンは、変更がなければフレームを描画しません。画面外・非表示の文書のアニメーションは停止し、切断時に worker と GPU バッファーをクリーンアップします。
- 別のモーションや視線移動がない `idle` の呼吸は、毎秒最大 30 回描画します。アニメーションの時計は進み続け、自動まばたき・図形の切り替え・明示的なモーション・追従の動きにはこの制限を適用しません。設定変更と PNG/ピクセルキャプチャーは、即座に新しいフレームを要求します。
- 入力とサイズ変更はフレーム単位でまとめます。色・視線・体の向きの変更は既存のメッシュを再利用し、体の変更時には重複する頂点のアップロードを削減しています。
- 複雑なモーフと複数の装備を同時に使うと、worker でも CPU コストが発生します。小さな端末では必要な要素だけを接続し、静的な表示には `activity="still"` を使ってください。`paused` は、アニメーションを即座に完了させる別の動作です。
- `diagnostics.renderCpu` は実際のレンダリング呼び出しの CPU 時間であり、GPU の完了時間や FPS ではありません。`backend`、`running`、`frames`、`buffers` で、実行場所と停止・解放の状態を確認できます。
- 開発用ベンチマーク：`node --expose-gc scripts/profile-renderer.mjs artifacts/cpu.json`。別の一時フォルダーに ES2022 JavaScript を生成し、実際の幾何学計算の CPU 時間とバッファーのアップロード・割り当て量を測定します。GPU コマンドは計数用の代替実装なので、GPU 時間やブラウザーの FPS を意味しません。実際の Chromium の worker/メイン経路、6 倍の CPU 制限、1/2/4 インスタンス、広い画面・DPR の検査は `npm run test:browser` に含まれます。CI の SwiftShader/CPU 制限の結果は、実際の非常に低性能な端末での FPS を保証しません。

## 図形・レンダリングの範囲とライセンス

`MATERIAL_SHAPE_NAMES`、`MATERIAL_SHAPE_LABELS`、`MaterialShapeName` を使って選択 UI を作成できます。

- 幾何学：`circle`、`square`、`slanted`、`arch`、`fan`、`arrow`、`semiCircle`、`oval`、`pill`、`triangle`、`diamond`、`clamShell`、`pentagon`、`gem`
- 星・日差し・クッキー：`verySunny`、`sunny`、`cookie4Sided`、`cookie6Sided`、`cookie7Sided`、`cookie9Sided`、`cookie12Sided`、`burst`、`softBurst`、`boom`、`softBoom`
- 有機的な形・その他：`ghostish`、`clover4Leaf`、`clover8Leaf`、`flower`、`puffy`、`puffyDiamond`、`pixelCircle`、`pixelTriangle`、`bun`、`heart`

`star` は API 名ではありません。公式の曲線データの縦横比・凹部・角・平滑化・回転・繰り返しを維持します。体はカタログの XY 輪郭を保ちながら、前後へ丸くつながる立体です。Flat は照明のない単色の表現を意味し、平坦な形状を意味しません。実際の体の向きの回転・深度による遮蔽・透明なアルファチャンネルを使用します。

目は独立した突き出たメッシュではなく、体の曲面シェーダー上のカプセル/曲線のカラーマスクです。傾きに応じて投影され、体の外・背面・隠れた部分には描画しません。正確な側面でも、丸い前面の手前側の目の一部が見える場合があります。目の比率・間隔・位置は内部の既定値で、図形と一緒に補間します。表情は体のシルエット・アルファのカバレッジを変更しません。顔の移動と視線は独立しており、眼鏡などの顔の装備は顔の移動だけに追従します。

アクセサリーは図形ごとの内部の装着規則を使用します。眼鏡の前面はひとつの平面の剛体で、ベレー帽は体の上部の実際の断面を包む開口部とカフで装着し、上部の一部が不透明な帽子の内側に入ります。ハートでは片側の広い丸みを包みます。王冠の下部のバンドは体の支持面に合わせます。マフラーは体の下部を前・横・後ろへ一周して包む閉じた布の帯と、結び目につながって下へ垂れる 2 本の端で構成します。マフラーの広い布の帯は、高さごとの体の断面に沿います。図形の切り替え中も装備は隠しません。公開アクセサリーの回転モーションは維持し、ベレー帽は現在の回転した着用座標で開口部と支持部分を合わせ直します。体の回転・呼吸には一緒に追従し、すでに合わせたベレー帽を体とは別に遅れて回転させていた慣性の揺れは適用しません。図形ごとの領域に合わせるモデリングであり、リアルタイムの布の物理シミュレーションではありません。体のメッシュと表面への問い合わせは、同じボリューム関数 `h = sqrt(d / (d + 0.65 × r²))`、前後の高さ `±depth × h / 2` を使用します。XY 輪郭では高さが 0、中心では全体の奥行きが `depth` です。これは Sidekick のボリュームモデルであり、AndroidX の 3D モデルを再現したものではありません。

曲線→ポリラインの許容誤差は、正規化した `[-1,1]` を基準に `0.00005` です。メッシュの細分化目標（表面距離 `0.010`、中央の高さ `0.006`）はサンプルを基準にしたもので、すべての位置・ピクセルの誤差を保証するものではありません。最大 8 回の分割・前面 12,000 点の予算を使うため、小さな三角形の近似誤差が見える場合があります。図形モーフの対応点の計算は Sidekick の方式であり、Android Material `Morph` とのピクセルの一致を保証しません。

WebGL2 モードでは、要素ごとにひとつの WebGL コンテキストと再利用バッファーを使用します。基本の体 + ベレー帽は 3 draw call で、目には追加の draw call はありません。DPR は最大 2 で、描画バッファーの長辺を WebGL2 では 2048px、Canvas2D では 384px に制限し、両軸に同じ倍率を適用します。幅や高さの大きいホストでも、キャラクターの比率を維持します。CPU の幾何学ベンチマークは GPU のフレーム時間/FPS の保証ではありません。任意の SVG・カスタムメッシュ・パーツプラグイン・布の物理・ピクセルのヒットテスト・コンテキストプール・AI サービスとの接続は対応範囲外です。

このリポジトリのパッケージライセンスは `UNLICENSED` です。公開オープンソースライセンスを付与することを意味しないため、利用・配布の権限はリポジトリの所有者に確認してください。以下の第三者告知は別途維持します。

- Material の輪郭：固定した [AndroidX MaterialShapes のソース](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt) を、`graphics-shapes-android:1.1.0` で計算。Apache 2.0 の告知/出典は [`third_party/material-shapes/`](third_party/material-shapes/)。再生成は `scripts/generate-material-shapes.mjs` で、この作業にのみ Java 21+・unzip・ネットワークが必要です。
- Studio の shadcn/ui ソース：[`playground/components/ui/LICENSE.md`](playground/components/ui/LICENSE.md)。静的な Studio ビルドにもこの告知を含めます。

### 各バージョンの変更と進行中の改善

0.2.2 は、前・横・後ろへ続くマフラーの周囲部分と自由に垂れる端を追加します。体のメッシュ計算の重複した割り当て・問い合わせを減らし、322 メッシュと 12 のネイティブレンダリングで、既存の結果とバイト単位で同一であることを確認しました。独立した CPU ABBA テストでは、体の計算時間の合計は約 7.9% 減りましたが、遅延の末尾領域は一貫して改善したわけではありません。ブラウザーの FPS や全端末での性能を保証するものではありません。OffscreenCanvas、視線追従モード、比率の補正、ホイール・ピンチの拡大/縮小、基本色 `#FFCC37` は維持します。

0.2.4 は、図形ごとに小さく斜めのベレー帽の着用位置を使用します。ハートでは片側の山に、とがった体では内側の支持点にかけて、非対称に垂れるよう構成します。折り返した縁とクラウンは連続的につなぎ、マフラーは体の高さごとの断面を包む広い布と、ねじれて垂れる余りの部分で構成します。図形の切り替え中もアクセサリーは隠しません。複雑な突出部分が変化する一部の中間フレームでは、体がマフラーの帯の一部を隠す場合があります。ベレー帽はハートで適切なサイズを基準に、縁とクラウンを局所的に変形します。体全体を覆うように大きく引き伸ばさず、マフラーは図形に合った下部の支持部分を包み、余りが垂れるよう配置します。フィッティング結果はキャッシュし、図形と体の状態が変わると更新します。このキャッシュは、任意の図形切り替えの計算コストや低性能 GPU の FPS を保証しません。

0.2.5 は、ベレー帽の内側に厚みのある裏地を追加し、開口部の縁をつなぎます。低い視点からの隙間を減らし、頭が入る開口部を維持しましたが、その後一部の図形・アニメーションで裏地の交差と着用位置の不連続が確認されたため、0.2.6 で構造を再構成しました。アーチ・正方形・花など、一部の図形で露出するカフの接合部分も補正します。マフラーの形状は 0.2.4 と同じです。極端な視線入力では、両目をひとつのペアとして移動させ、片目だけが止まって間隔が崩れる現象を修正します。


ベレー帽の角度・アニメーションの再現テストは [`scripts/beret-qa/`](scripts/beret-qa/README.md) にあります。実際のレンダラーの頂点シェーダー・行列を使う GLES の診断と、三角形の自己交差・体への貫通・法線・開口部構造の検査を組み合わせています。角度の格子と時間サンプルの範囲は検査文書に明記し、有限の検査をすべての連続角度・任意の入力への保証とは解釈しません。

0.2.6 は、ベレー帽の裏地・開口部・カフ・クラウンをつながった厚みのある構造で構成し、内側の空間に図形の支持部分が入るよう配置します。ハートでは山を包み、花のように両側の開口部を合わせにくい場合は、支持点から布が自然に垂れるよう調整します。図形ごとの位置・傾き・布の変形の限度を補間し、呼吸には体と同じ変形を適用します。切り替え中は自由な端の巻き込みを一時的に弱め、実際の三角形の貫通を別途検査します。一部の中間フレームでは、開口部が広がったり着用の深さが急速に回復したりする場合があります。有限の角度・時間の検査結果と、残っている小さなフィッティング変化は検査レポートに明記します。マフラーと視線追従の動作は維持します。

### Studio のシーンエディターとソーシャルカード

**シーン**タブでは、実際のキャラクターと編集可能なテキストを固定サイズのキャンバスに配置します。**キャラクター / シーン**のプレビューを切り替えてもキャラクター要素は維持され、外観・体の向き・拡大設定がシーンに引き続き反映されます。シーンのプレビューは静止フレームです。**新しいフレーム**で、現在のアニメーションフレームをキャプチャーします。

- キャンバスのプリセット：OG 1200 × 630、正方形 1080 × 1080、ワイド 1920 × 1080。カスタムサイズは各辺 320〜4096 の整数で、最大 800 万ピクセルです。
- 背景色、キャラクターの中心 X/Y と高さ、複数行のテキストと位置、文字サイズ・フォント・色を設定します。プレビューでキャラクターやテキストを直接ドラッグでき、スライダーによる精密な調整も可能です。
- **Sidekick OG プリセットを適用**は、現在のキャラクターを眼鏡・ベレー帽・蝶ネクタイを着けた笑顔の黄色い Ghostish に明示的に置き換え、白い背景と「Sidekick」のテキストを配置します。
- **シーン PNG を保存**は、選択したサイズのキャンバス全体をエクスポートします。ヘッダーの既存の **PNG を保存**は、透明なキャラクターだけをアルファ境界で切り抜いて保存します。
- **シーン JSON を保存 / 開く**は、`{ compositionVersion: 1, composition, avatar }` をエクスポートして復元します。ネストされた `avatar` は既存の `SidekickScene` です。以前のキャラクターのシーン・デザイン JSON も、既定のシーン配置で開けます。既存のキャラクター JSON/API のエクスポートは維持されます。
- 配置位置はキャンバスに対する百分率です。`characterHeight` は、切り抜いたキャラクターの高さをキャンバスの高さに対する百分率で表します。テキストの X は左端、Y は複数行ブロックの中心です。キャンバス外のコンテンツはエクスポート時に切り取られます。
- シーン PNG の保存では、独立した一時的な 2048 × 2048 の実際のレンダラーを作成し、保存されたシーン時間でキャラクターをキャプチャーしてから解放します。低解像度のプレビューを拡大したり、アクティブなキャラクターのキャンバスサイズを変更したりしません。通常のレンダラーの 2048 ピクセルの上限は維持されるため、非常に大きいシーンでは結果の画像を拡大する場合があります。一貫したエクスポートのため、リアルタイムのポインター反応は除外します。公開 OG 画像は別途管理します。

HTML のエントリーページには、正規 URL `https://sidekick.hananakick.cc/` とバージョン付きの絶対画像 URL を使う静的な Open Graph・Twitter カードタグがあります。`public/og-sidekick.png`（1200 × 630）は所有者が選択した原本そのもので、その後のキャラクターの形状変更とは独立して維持されます。ビルドと `node scripts/generate-og-image.mjs` は、このファイルを上書きしません。この開発用スクリプトは、実際の本番レンダラーで `public/og-avatar.png` だけを更新し、C コンパイラー・EGL/GLES・Pillow/fontTools が必要です。任意の `SIDEKICK_RENDERER_ROOT` でソースのワークツリーを指定できます。Studio の編集可能なシーンプリセットは別の開始点であり、選択された静的な OG 画像を再構成する機能ではありません。

## レンダリング・移動の標準 (v0.3)

基本は**キャラクターサイズの透明なキャンバス + DOM 要素の移動**です。全画面を覆う WebGL キャンバスは作成しません。OffscreenCanvas worker が小さな面をレンダリングし、メインスレッドは CSS の `translate` で要素を移動します。DOM の移動によって canvas の解像度・体の向きの設定・保存された体のデザインを変更しません。既定の飛行動作は、小さなキャンバス内のランタイムポーズとして合成します。画面サイズ・DPR の変更には、既存の ResizeObserver/解像度制限をそのまま適用します。

[移動・アニメーションの API 体験](https://sidekick.hananakick.cc/api-playground.html) で、移動/停止/再生/アセットの切り替えを直接試せます。

- `placement="inline"`（既定）：文書のフローを維持します。x/y は元の配置位置からの相対移動量です。他のコンテンツのレイアウトを押し動かしません。このモードでは viewport bounds は適用しません。
- `placement="viewport"`：`position: fixed` で、x/y はレイアウトビューポート左上基準の CSS ピクセルです。アンカーは**キャンバスボックスの左上**であり、キャラクターの足や中心ではありません。スクロールしても同じ画面位置を維持します。
- 既定の `movement-bounds="viewport"`：要素のボックス全体を画面内に制限します。ボックスが画面より大きい場合は、左上の 0 に固定されます。`none` は画面外への移動を許可します。体の向きの拡大によってキャンバス自体で切れた装飾は、移動 bounds では復元しません。
- viewport/要素のサイズが変わると、現在位置と残る目標を再び制限します。`position` は実際に制限された座標を返し、入力 attribute は要求した座標を維持します。
- viewport の要素は `body` の直下、または変形のない overlay コンテナに置いてください。CSS の `transform`、`filter`、`perspective`、特定の `contain` を持つ祖先は、fixed の基準を変える場合があります。ライブラリが React 所有の DOM を黙って別の親に移すことはありません。
- API が CSS 個別プロパティの `translate` を所有します。利用者の `style.transform` は上書きしませんが、回転/拡大/独自の translate を併用した場合、bounds はその視覚的な変形まで計算しません。独自の変形が必要な場合は、別のラッパーで管理してください。
- 既定の `interaction="none"` は、クリック/スクロール/タッチを透過します。グローバルな視線追従は引き続き使用できます。`box` を選ぶと、**小さなキャンバスのボックス内だけ**でドラッグ・ズームを受け付けます。透明なピクセルだけを選んでクリックを透過させるアルファヒットテストは提供しません。
- キャラクターのシーン JSON には、ホストページの配置/移動座標を入れません。`position` はアプリのレイアウト状態として別に保管してください。明示的に保存された色は維持され、新しいキャラクターの体の既定色は `#FFCC37` です。

### 宣言型 HTML / React の配置

| HTML attribute | React prop | 意味 / 既定値 |
| --- | --- | --- |
| `placement` | `placement` | `inline`（既定）/ `viewport` の固定オーバーレイ |
| `position-x` | `positionX` | CSS px の x 座標、既定は `0` |
| `position-y` | `positionY` | CSS px の y 座標、既定は `0` |
| `movement-bounds` | `movementBounds` | `viewport`（既定）/ `none`。inline では適用しない |
| `move-duration` | `moveDuration` | 0〜60000ms、既定は `0`（即時）。natural では正の値を無視し、none では正確な移動時間 |
| `move-easing` | `moveEasing` | `smooth`（既定）/ `linear`。`none` にのみ適用 |
| `move-travel` | `moveTravel` | `natural`（既定）：慣性ベースの加速・飛行・減速 / `none`：時間ベースの DOM 補間 |
| `move-max-speed` | `moveMaxSpeed` | natural の最高速度、CSS px/s、1〜100000。省略時は固定の 1350 |
| `move-acceleration` | `moveAcceleration` | natural の加速上限、CSS px/s²、1〜100000。既定は `1800` |
| `move-deceleration` | `moveDeceleration` | natural の減速上限、CSS px/s²、1〜100000。既定は `2200` |
| イベント `sidekick-move-progress` | `onMoveProgress` | `MovementState`: `{ phase, progress, position, velocity, acceleration, speed }` |
| イベント `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| イベント `sidekick-play-end` | `onPlayEnd` | `{ finished }` 再生区間の完了/キャンセル |
| イベント `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }` 図形・表情・装飾の一括切り替えの完了/キャンセル |

`position-x/y` を同時に変更すると、ひとつの attribute transaction として処理します。直接のメソッド呼び出しは `MoveOptions` を使い、既定の duration は 400ms、travel は natural です。`move-*` attribute/React prop は、宣言型の座標変更にだけ適用されます。初期配置を即時にするには、move-duration を省略してください。固定の既定最高速度を使う宣言型の自然な飛行は、`move-duration="1000" move-travel="natural"` を使います。React では `moveDuration={1000} moveTravel="natural"` です。move-max-speed/moveMaxSpeed を省略すると固定の 1350 CSS px/s を使い、指定するとその上限を使います。正の move-duration は自然な飛行の速度や時間に影響しません。加速度・減速度の既定値は距離によって変わりません。最高速度を指定していても、duration が 0 なら即座に適用されます。

### メソッドと実際の完了の意味

| メソッド | 意味 |
| --- | --- |
| `moveTo({ x, y }, options?: MoveOptions)` | 現在の画面座標から移動。`Promise<MoveResult>` |
| `moveToElement(target, options?: MoveToElementOptions)` | 対象要素と同じ配置点を合わせて X/Y オフセットを適用。`anchor: true` なら継続的に接続 |
| `elementAnchor` | 現在の `{ target, x, y, alignX, alignY }` の読み取り専用スナップショット、または `null` |
| `detachAnchor()` | 継続的な接続を解除。進行中の最初の移動は継続し、到着後の追従は現在の慣性から減速して停止 |
| `moveBy({ x, y }, options?)` | 現在進行中の座標を基準とする相対移動 |
| `cancelMove()` | 自然な飛行は現在速度から減速した後、180ms でポーズを戻し、`finished: false`。none は位置の移動を即座に停止 |
| `position` | 実際の DOM 座標 `{ x, y }` のコピー、読み取り専用 |
| `movementState` | phase・progress・position・velocity・acceleration・speed のコピー、読み取り専用 |
| `play(activity, { duration? })` | アクティビティループを再生。duration はループの 1 周ではなく、**再生区間の実時間 ms** |
| `stop()` | 再生区間をキャンセルしてから、200ms で idle へ滑らかに切り替え |
| `transitionTo({ shape?, expression?, accessories? }, options?)` | 図形/両目の表情/装飾一覧全体をまとめて切り替え |
| `cancelTransition()` | 進行中の一括切り替えを停止。完了結果は `finished: false` |

すべての timing easing は `linear` または `smooth`、duration は 0〜60000ms です。`play` は timing easing を受け取りません。activity の値は `idle`、`thinking`、`listening`、`speaking`、`celebrating`、`still` です。

自然な飛行を再度要求すると、現在の座標・速度・飛行ポーズを維持したまま新しい目標へ加速します。反対側を押すと、まず制動して向きを変えるため、速度が瞬間的に反転することはありません。`travel: 'none'` に変えると時間ベースの補間に切り替わり、速度は引き継ぎません。以前の Promise と `sidekick-move-end` は、着陸を待たずに一度だけ `finished: false` で終了します。新しい移動の完了は、新しい Promise で確認してください。`sidekick-move-end` には置き換えられた以前のリクエストのキャンセルも含まれるため、現在の進行段階は `movementState` で確認してください。切断時には RAF・タイマー・fade・飛行ポーズを即座にクリーンアップし、待機中の移動/再生/一括切り替えをキャンセルします。

`cancelMove()` は移動だけを停止し、`stop()` はアクティビティの再生だけを停止します。両方を止めるには、両方を呼び出してください。移動中に `play()`・`setActivity()`・表情の切り替えを使っても、移動経路は再開しません。

`play(activity)` のように duration を省略すると、`stop`、次の play/setActivity、または切断までループを維持し、Promise はそのとき `finished: false` で終了します。有限の duration が終了すると、`finished: true` で再生区間を完了し、続いて 200ms で idle へブレンドします。この Promise は、idle へのブレンドの終了まで待つシグナルではありません。アクティビティの変更も、最後に表示されたアクティビティポーズから 200ms でブレンドし、起動時の自動アクティビティには新しい効果を追加しません。

図形には既存の輪郭モーフ、表情には既存の shape-key の切り替えを使い、`transitionTo` は worker の実際の完了応答を待ちます。`accessories` は**装飾一覧全体**なので、維持したい装飾も含めてください。同じスロットの重複は、変更前に拒否します。異なる装飾のメッシュを無理に補間せず、**キャラクターのキャンバスを fade-out → 装飾の交換 → 新しいフレームのレンダリング確認 → fade-in** します。2 つの fade の合計が duration で、他の図形/表情チャンネルと同時に進みます。ページ・兄弟 DOM・テキストは消えません。snapshot PNG はこの CSS fade を含まず、実際のキャラクターのピクセルを保存します。

キャンセルが装飾の交換より前なら以前の装飾を、交換後なら新しい装飾を維持します。キャンセルした fade は削除し、キャラクターが透明なまま残らないようにします。キャンセルされた図形は現在の輪郭で停止しますが、design には要求していた目標が残ります。最新の shape/expression/equipment setter または attribute の変更は、該当する一括切り替えをキャンセルします。色だけを変える場合は `updateDesign` を使ってください（進行中の一括切り替えはキャンセルされます）。

`paused` または OS の視差効果を減らす設定は、移動目標/輪郭/表情/fade を即座に適用し、飛行ポーズを 0 に戻します。この場合、離陸・着陸・キャンセル後の 180ms の復帰は待ちません。アクティビティの再生区間は実時間なので、一時停止中も経過します。バックグラウンドのタブでは、ブラウザーが RAF/タイマーを遅らせる場合があります。自然な飛行は固定の 1/240 秒間隔で積分し、タブ復帰時の 1 フレームの追い付き処理は最大 100ms に制限します。長時間非表示だった分だけ瞬間移動することはなく、実際の完了までより長くかかる場合があります。`travel: 'none'` とアクティビティの再生区間は実時間を基準とします。画面外でレンダリングが停止した輪郭モーフの Promise は、実際の再開/完了またはキャンセルを待ちます。未接続状態の move/transition は設定を即座に適用し、play は `finished: false` を返します。

### 自然な方向性のある飛行と実際の加速度

`moveTo()`・`moveBy()` は、既定で `travel: 'natural'` を使用します。DOM 座標は実際の速度・加速度の積分で動き、体の傾きだけで加速をまねるわけではありません。停止状態から加速し、目標までの残り距離と減速上限から制動距離を計算して、到着前に減速します。最高速度の上限は、距離・duration に依存しない固定値（既定は 1350 CSS px/s）です。同じ上限に向けて加速し、制動距離に入ると、まだ最高速度に達していなくても減速します。加速度・減速度は距離に応じて増加せず、既定の 1800・2200 CSS px/s² を維持します。そのため、遠い目的地ほど時間がかかります。方向転換も既存の速度から続くため、慣性によって曲線の経路や短時間の逆方向への移動が生じる場合があります。最高速度は目標の速さの上限であり、より低い最高速度へ再指定しても、現在速度を即座に切り捨てずに減速します。

| `MoveOptions` フィールド | 意味 / 既定値 |
| --- | --- |
| `travel` | `'natural'`（既定）/ `'none'` |
| `maxSpeed` | 自然な飛行の最高速度、CSS px/s。1〜100000。省略時は固定の `1350`（以前の明示例 900 の 1.5 倍）。距離・duration によって変わらず、明示した値をそのまま使用 |
| `acceleration` | 自然な飛行の目標加速力の上限、CSS px/s²。1〜100000、既定は `1800`。実際の加速度は以下の応答曲線に沿って近づく |
| `deceleration` | 自然な飛行の目標制動力の上限、CSS px/s²。1〜100000、既定は `2200`。到着・反転・cancelMove の制動に使用 |
| `duration` | 0〜60000ms、直接メソッドの既定は `400`。natural では正の値を無視し、実際の完了時間は保証しない。`0` は両モードとも即座に適用 |
| `easing` | `'smooth'`（既定）/ `'linear'`。`travel: 'none'` の時間ベースの補間にのみ適用 |

自然な飛行では、距離・現在速度・加速/減速の上限が所要時間を決めます。正の duration と easing は、maxSpeed の指定の有無にかかわらず、自然な飛行経路の速度には影響しません。短い距離では、最高速度に達する前に減速する場合があります。正確に指定した時間で移動を終える必要がある場合は `travel: 'none'` を使ってください。以前のバージョンの 15% 離陸・70% 移動・15% 着陸という時間配分は、自然な飛行には適用されません。

加速度は瞬間的にオン/オフせず、時定数 60ms の指数応答で目標の力に近づきます。初めは速く変わり、徐々に緩やかになる感覚であり、数学的な対数関数を位置に適用したものではありません。停止状態から一定の力を与えた場合、実際の加速度は a(t)=A(1−exp(−t/0.06)) です。速度と位置もこの加速度を正確に積分した値で、画面のイベントの acceleration は実際の瞬間加速度です。制動距離の計算にも、この力の応答遅延を含めます。予測座標 x+τv、予測速度 v+τa を使い、残り距離 d に対する許容速度を min(maxSpeed, 0.9√(2·deceleration·d)) に制限する保守的な制動余裕を設けます。そのため、単純な v²/(2b) の式より早く力を弱め、滑らかな減速に備えます。

新しい目標を与えると、現在の速度と加速度の両方を引き継ぎます。より低い上限や反対方向を指定しても力を即座に切り捨てないため、短い過渡区間では以前の加速度が残ります。acceleration/deceleration は目標の力の上限であり、互いに大きく異なる値を使う方向転換では、以前の制動力が一時的に新しい方向へ残る場合があります。既定の上限 1350 は従来の 900 の 1.5 倍で、短い距離では加速・制動によってその速度に達しません。遠い距離でも同じ時間で終わるように、加速度を強制的に大きくすることはありません。

視線・yaw/pitch は実際の進行方向に、体の傾きは実際の加速と減速に従います。180 度反転したり、体の向きの設定を変えたりはしません。浮き上がりは小さなキャンバス内のランタイムポーズで、`position`・bounds・進行イベントの座標には含みません。位置が目標に到着して速度が 0 になった後、180ms でポーズを戻して初めて `finished: true` になります。

飛行は一時的なランタイムオフセットです。アクティビティ・表情・手動ポーズ・体の向きの保存状態を上書きせず、`play()` のタイマーも進み続けます。着陸後は、**その時点で有効なアクティビティ**へ続きます。飛行中に終了した有限の再生を再開したり、離陸前の古いアクティビティを復元したりしません。飛行中にアクティビティ/表情を変更しても、現在の移動の位置・速度・目標は維持されます。

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

`travel: 'none'` は離陸・着陸なしで、duration 全体を DOM の移動に使います。物理オプションは検証しますが、補間には使いません。進行中の自然な飛行を置き換えた場合は、直前の飛行ポーズだけが最大 180ms かけて消えます。`duration: 0`、一時停止・視差効果を減らす設定・未接続状態では、目標を即座に適用し、速度・加速度・飛行ポーズを 0 に戻します。同じ座標であっても、まだ速度が残っていれば自然な飛行は制動する必要があるため、即座には完了しません。

### 移動状態とキャンセル

`movementState` と `sidekick-move-progress` の `event.detail` は同じ形式です。

| フィールド | 意味 |
| --- | --- |
| `phase` | `idle`、`takeoff`、`flight`、`landing`、`braking`、`settling`。自然な飛行の phase は物理状態を表し、固定の時間配分ではない |
| `progress` | natural では残り距離に基づく 0〜1 の進捗表示で、完了時間の予測ではない。目標変更時に再開始。none では duration に対する経過割合。正常完了後は 1 |
| `position` | 現在の DOM 座標 `{ x, y }`、CSS px |
| `velocity` | 実際の DOM 移動速度 `{ x, y }`、CSS px/s。右・下が正 |
| `acceleration` | 実際の速度変化 `{ x, y }`、CSS px/s²。設定した加速上限とは区別 |
| `speed` | 速度ベクトルの大きさ `Math.hypot(velocity.x, velocity.y)`、CSS px/s |

状態はコピーであり、読み取ったり変更したりしても、実際の移動を制御しません。`takeoff` でも DOM は加速しながら動き、`landing` は目標に向けた減速、`braking` は cancelMove の制動を表します。`settling` は、速度・加速度が 0 の状態で飛行ポーズだけを戻す区間です。進行イベントは開始・アニメーションのサンプル・サイズ変更・キャンセル・完了時に発生します。UI には必要な値だけを反映し、完了/キャンセルの確定には Promise または `sidekick-move-end` を使ってください。フレームごとのイベントをスクリーンリーダーの live 領域に出力し続けることは避けるのが望ましいです。

`cancelMove()` は、自然な飛行の現在速度を deceleration で減らします。呼び出した地点ですぐには止まりません。一定速度で飛行していた場合の制動距離は、およそ `速さ² / (2 × 減速度) + 0.06 × 速さ` で、加速中だった場合は残る加速度のため、さらに長くなる場合があります。制動力が滑らかに変わるため、初めは速さが一時的にさらに増す場合がありますが、停止要求によって反対方向へ跳ね返ることはありません。速度が 0 になると、`settling` で 180ms かけて方向・傾き・浮き上がりを戻してから、元の移動 Promise と `sidekick-move-end` を `finished: false` で完了します。制動中に新しい目標を要求しても、残る速度から自然に続きます。`cancelMove()` 自体は Promise を返しません。`travel: 'none'` は位置の移動を即座に停止し、残っている飛行ポーズがあれば元に戻します。一時停止・視差効果を減らす設定・切断は、制動とポーズの復帰を待たずに即座に処理します。

`movement-bounds="viewport"` では、キャンバスのボックス全体がビューポートからはみ出しません。壁に接した軸の外向きの速度だけを 0 にし、他の軸は移動を続けられます。境界によって速度が切り詰められる瞬間は、通常の加速上限の例外です。`inline` や `movement-bounds="none"` にはこの制限がないため、コンテナの境界・制動距離・方向転換時の余裕はアプリで管理してください。目的地だけをコンテナ内に制限しても、慣性による経路と制動位置までは制限されません。

API playground では「既定の最高速度 · 1350 CSS px/s」が既定で有効で、呼び出しコードから maxSpeed だけを省略します。acceleration=1800、deceleration=2200 は、距離によって変わらない既定値です。既定値の使用をオフにすると、直接入力した maxSpeed の上限を使います。3 つの物理制限値は手動で調整でき、実際の velocity/acceleration と比較できます。natural は常に物理積分であり、時間ベースの飛行には切り替わりません。直近 6 秒間のグラフは、速さと加速度の大きさをそれぞれ独立した軸で表示します。ステージのクリック/タッチは、ドラッグ・スクロール・長押しと区別され、モバイルでも固定プレビューの移動停止ボタンを使えます。アクティビティ再生区間の `0` は playground 内だけで繰り返しを意味し、実際の API 呼び出しでは duration を省略します。

### CDN の HTML でコマンド API を使う

```html
<script type="module">
  import { createAccessory } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';
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

最初の切り替えを実際のアニメーションとして見るには、`sidekick-ready` の後に実行してください。準備前の shape/expression コマンドは、既存の API と同様に即座に適用されます。上のスクリプトは module なので、HTML の解析後に実行されます。classic バンドルで登録した要素でも同じメソッドを使えます。

### クリック・タッチした場所へ移動する HTML ステージ

以下のステージは、`inline` モードの小さな 144px のキャンバスを絶対配置します。ステージ全体をレンダリングするキャンバスはありません。ポインター座標をステージ座標に変換し、キャンバスがステージ内に収まるようアプリで制限します。モバイルのタップには Pointer Events を使用します。

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
  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';
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

「中央へ移動」ボタンは、キーボードでも実行できます。ステージサイズを動的に縮小するアプリは、新しいサイズに合わせて `moveTo()` を呼び出し、再び制限してください。`inline` はアプリのコンテナの bounds を自動計算しません。慣性によって制動している間はステージ外まで移動する場合があるため、この例は overflow で切り取って表示します。この例の `moveTo()` はオプションを直接指定するため、HTML の移動 attribute は読み取りません。宣言型に変更する場合は、`position-x/y` を同時に更新すればよいです。

### React：同じ要素 API を ref で使う

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

React SSR は従来どおり安全で、ref はクライアントでの登録後に公開されます。宣言型の `positionX/Y` props は値が変わったときだけ反映されるため、通常の親の rerender が命令型の移動を元に戻すことはありません。上の ref 呼び出しは `MoveOptions` を直接渡し、`moveDuration`・`moveTravel`・`moveMaxSpeed`・`moveAcceleration`・`moveDeceleration` props は、宣言型の `positionX/Y` の変更に適用されます。React の `onAssetTransitionEnd` は、Sidekick の一括切り替えイベントです。既存のネイティブ CSS の `onTransitionEnd` とは区別されます。

公開型 `AvatarPlacement`、`AvatarPosition`、`MovementBounds`、`MoveOptions`、`MoveResult`、`MovementState`、`PlayOptions`、`AssetTransitionTarget` は、メイン/`register` エントリーから取得できます。`MoveOptions.travel` の値は `'natural' | 'none'` で、既存の `MotionOptions` を受け取る図形/表情/ポーズ API には `travel` を渡しません。


## API playground：望む動作をコードにする

[API playground](https://sidekick.hananakick.cc/api-playground.html) で、移動、アクティビティ/状態、左右の目の表情、マウス追従、体の向き、外観の切り替え、登場/退場を選んでください。値を変えると即座に HTML + JavaScript または React のコードが更新されます。実行とコード生成は同じコマンドデータに基づきます。インストールと Studio のキャラクターの初期化コードは、別の準備領域で提供します。

キャラクターは、ひとつの小さな透明キャンバスを `placement="viewport"` でページ全体に移動させます。全画面サイズのキャンバスは作りません。座標は viewport の左上を基準とする CSS ピクセルで、ページのスクロール高さは加算しません。空いている場所のクリック/タップは、キャラクターの中心をその位置へ移動させます。選択した操作、入力値、設定中のコードはそのまま維持し、実際のクリックによる移動・停止の呼び出しは、別の「最後に実行したコード」で確認してコピーできます。操作の種類を変えて戻ってきても、それぞれの入力値は維持されます。ボタン・フォーム・リンク・コードの選択・スクロールのジェスチャーは、移動を実行しません。キャラクターはポインターイベントを透過し、ページの操作を妨げません。

Studio で保存したデザインとシーン設定を、同じブラウザー・同じ origin から読み取ります。API playground の一時的なコマンドは、Studio の保存値を上書きしません。保存データが不正、またはブラウザーストレージを使えない場合は、案内と既定のキャラクターを表示し、原本は削除しません。別のブラウザー/端末へ移す場合は、Studio の JSON のエクスポート/読み込みを使ってください。

### 自然に登場・退場する

```js
// placement="viewport" 요소에서 사용합니다.
await avatar.enter({ x: 120, y: 200 }, { from: 'left' });
await avatar.exit({ to: 'right' });
// 다시 입장할 수 있습니다.
await avatar.enter({ x: 240, y: 120 }, { from: 'top', maxSpeed: 1350 });
```

- `enter(point, options?)`：画面外から `point` まで飛行します。`from` は `left`（既定）、`right`、`top`、`bottom` です。
- `exit(options?)`：選択した画面外へ飛行した後に非表示にします。`to` は `right`（既定）、`left`、`top`、`bottom` です。
- どちらのメソッドも、既存の `MoveOptions` の速度・加速・減速・travel・duration 設定を受け取ります。自然な飛行は実際の慣性を使用します。paused または視差効果を減らす設定では、即座に適用されます。
- 結果は `{ finished, position, presence }` です。読み取り専用の `presenceState` は、`visible`、`entering`、`exiting`、`hidden` のいずれかです。完了イベントは `sidekick-enter-end` / `sidekick-exit-end`、React props は `onEnterEnd` / `onExitEnd` です。React ref でも同じメソッドを使用します。
- `inline` 配置では使用できません。登場・退場中の新しい登場・退場コマンドは、現在位置と慣性から目標を設定し直します。通常の `moveTo` / `moveBy` は登場・退場をキャンセルし、キャラクターを表示します。`cancelMove()` は非表示にせずに制動します。
- 退場が完全に終了した後、レンダラーと追従の購読を無効にします。デザイン・アクティビティ・追従設定は保持し、再登場時に復元します。ウィンドウサイズが変わると、進行中の退場の目的地を新しい画面境界に合わせます。

| React prop | 型 | 意味 |
| --- | --- | --- |
| `onEnterEnd` | `SidekickEventHandler<'sidekick-enter-end'>` | 登場の完了/キャンセル `{finished, position, presence}` |
| `onExitEnd` | `SidekickEventHandler<'sidekick-exit-end'>` | 退場の完了/キャンセル `{finished, position, presence}` |

### 要素を基準にした移動

`moveToElement(target: Element, options?: MoveToElementOptions): Promise<MoveResult>` は、特定の DOM 要素を基準に移動します。React の `SidekickAvatarRef` でも同じメソッドを提供します。

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

対象とキャラクターの**同じ配置点**を合わせます。`center/center` なら両方のボックスの中心が一致し、`right/bottom` なら右下の角が一致します。その後に X/Y のオフセットを適用します。基準は透明なキャンバスを含む要素の画面上の border-box であり、キャラクターの不透明ピクセルの境界ではありません。

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

- `anchor: false`（既定値）は、呼び出し時点の位置へ一度だけ移動します。その後のスクロール・レイアウトの変化には追従しません。
- `anchor: true` は、選択した配置点とオフセットを維持し続けます。最初の移動中は同じ移動リクエストの目的地だけを更新し、速度・加速度・Promise を維持します。到着後も同じ最高速度・加速・減速設定で、目標に自然に追従します。目標が突然動いても、キャラクターの座標を瞬間的に合わせることはありません。最初の到着の Promise と移動完了イベントは一度だけ発生し、その後の追従では完了イベントを繰り返しません。停止状態では 0.5 CSS px 以下の誤差を無視します。ネストされたスクロール、サイズ変更、レイアウト変更、CSS/WAAPI transform を反映します。対象が動き続けると、最初の移動完了が遅れる場合があります。キャラクターまたは対象が `display: none` によってレイアウトから外れると、接続を維持したまま追従を一時停止し、再表示されたときに配置を合わせます。
- キャラクターが完全に画面外へ出て、配置後の目的地も画面外なら、物理的な移動とレンダリングをアイドル状態にします。現在位置または目的地が再び画面と重なると、慣性を維持して追従を再開し、非表示の間の時間を一度に積分しません。レンダリングは、キャラクター自体が画面と重なったときだけ再開します。アンカー位置の確認は、有効な状態では文書ごとにひとつの RAF にまとめ、すべての接続がアイドルなら 250ms 間隔に下げます。スクロール・サイズ変更は直後の次のフレームで確認し、CSS transform だけで戻る場合も最大約 250ms 後に検知します。非表示のタブでは位置確認も停止します。そのため、完全に画面外にあるときは GPU フレームは止まりますが、復帰を検知するための少量の DOM 測定は残ります。
- 対応環境では、OffscreenCanvas を転送した専用 worker で WebGL2 を優先し、利用できない場合は Canvas2D で描画します。非表示中のサイズ変更はまとめて次の描画時に適用します。worker 未対応・CSP 制限環境では、同じグラフィックスフォールバックを備えたメインスレッドレンダラーを使います。DOM の位置測定と移動座標の更新はメインスレッドに残ります。
- キャラクターの親 DOM や CSS positioning は変更しません。absolute/fixed/inline の配置はそのままで、キャラクター自身の移動オフセットだけを更新します。`detachAnchor()` は接続を解除し、進行中の最初の移動は最後の目的地まで継続します。最初の到着後の追従は、現在の慣性から減速して停止します。移動も止めるには、`cancelMove()` を使ってください。
- 別の `moveTo / moveBy / moveToElement`、`cancelMove / enter / exit`、キャラクターの切断時には、既存のアンカーを解除します。対象の削除・別文書への移動・未対応の祖先 transform の変更時にも接続を解除し、進行中の最初の移動は最後の有効な目的地まで続きます。キャラクター自身やその子孫を継続的なアンカーの対象にする循環配置は拒否します。
- 有効なアンカーは、文書ごとにひとつの RAF でレイアウトを読み、その後に位置を書き込みます。停止した位置には再書き込みしませんが、observer が検知できない transform だけのアニメーションにも追従するため、接続中はフレームごとの測定コストがあります。文書が非表示になると停止し、最後の接続が解除されるとループを削除します。必要な間だけ接続してください。
- `inline` と `viewport` のどちらも、現在のキャラクターの画面位置を基準に座標を変換します。キャラクター自身の CSS transform は、測定したサイズに反映されます。キャラクター自身の CSS zoom には対応していないため、transform: scale() を使ってください。祖先に transform/rotate/scale/perspective/CSS zoom がある場合は座標の単位が変わるため、明示的にエラーにします。この場合は、キャラクターを変形のない body の直下に配置してください。
- 同じ文書に接続された HTML/SVG Element を受け取ります。接続されていない対象、別の文書、不正なオプションは、現在の移動をキャンセルしたりキャラクターを表示したりする前に同期的に拒否します。サイズが 0 の対象も、有効な座標の基準点です。
- `MoveOptions` の自然な加速・制動、中断、reduced-motion 設定をそのまま使います。`movementBounds="viewport"` では画面の制限が配置合わせより優先されるため、画面外の対象へ正確に合わせるには `movementBounds="none"` を明示してください。
- Playground の移動基準で `moveToElement` を選ぶと、CSS セレクター、配置、オフセットと同じ実行コードが表示されます。セレクターは Playground の便利な機能であり、実際の API には Element オブジェクトを渡します。コピーした例では、そのセレクターに一致する対象要素をアプリに用意する必要があります。

### ガイド：簡単な使い方から高度なカスタマイズまで

[ガイド](https://sidekick.hananakick.cc/guide.html) は、宣言できるボットの状態を先に説明し、使用例と直接制御を順に提供する技術文書です。以前の use-cases.html の URL は、新しいガイドにつながります。Studio / API playground / ガイドは、同じメニューを使用します。

ガイドの例へのリンクは、元の節、学習段階、適用済み設定、アプリの結果を保持します。API 体験では同じ対象 DOM、イベント操作、実行コードが開きます。リンクを開いただけでは動作は開始せず、実行ボタンで開始します。戻るリンクは元の節、段階、スクロール位置を復元します。導入、外観、座標、アンカー、ライフサイクル、性能の各節は対応する例または専用設定へ移動します。URL に含めるのは許可された例の設定と結果のみで、入力した名前、メール、検索文字列、任意の JavaScript は含めません。

- **[ボットの状態](https://sidekick.hananakick.cc/guide.html?lang=ja#state-emotion)**：感情・位置と対象・行動を先に定義し、視線と体の向き・外観と目・遷移と実行設定を説明します。型・許容値・既定値・制御優先順位と HTML/React/JavaScript 宣言を掲載します。
- **[使用例](https://sidekick.hananakick.cc/guide.html?lang=ja#loading)**：読み込み・アップロード・確認・フォーム・オンボーディング・感情反応など18のアプリシナリオで状態を組み合わせます。自然言語解析ではなく型付き宣言を入力します。
- **[直接制御](https://sidekick.hananakick.cc/guide.html?lang=ja#html-start)**：導入と初期化の前提手順、DOM 配置とアンカー、移動・視線・表情、ライフサイクルと描画制御を説明します。

各シナリオは、**簡単に使う → オプションを調整 → アプリのイベントに接続 → 動作を直接組み合わせる**という順序で構成します。実行中のキャラクターと、その実行コードを一緒に確認してコピーできます。インストール・概念の説明と実際の実行デモを区別し、大分類・中分類・小分類の目次と URL ハッシュで目的の段階へ直接移動します。モバイルでは目次を折りたためます。

一度にひとつの例だけを有効にし、不要なレンダラーを作りません。例の終了・切り替え時にはインスタンスを削除し、見えないセクションと非表示のページのレンダリングを一時停止します。Studio の設定は読み取りのみで、実験の動作は原本に保存しません。実行例の非同期処理は、特記がなければローカルのシミュレーションです。実際のアプリでは、サービスのリクエストと結果のイベントを接続してください。

### 宣言的な位置指定

`positioning` は対象と配置から位置を指定します。読み取り専用座標 `position` および CSS 配置モード `placement="inline|viewport"` とは別です。DOM の移動や全画面キャンバスの作成は行いません。

```html
<sidekick-avatar placement="viewport"
  positioning='{"target":"#status","placement":"center-right","gap":-20}'>
</sidekick-avatar>
```

```tsx
<SidekickAvatar placement="viewport"
  positioning={{ target: '#status', placement: 'center-right', gap: -20 }} />
```

- `target`：必須。`'viewport'`、同じ文書の CSS セレクター、または `Element`。HTML JSON は文字列を使用します。
- `placement`：既定値は `'bottom-right'`。`top-left`、`top-center`、`top-right`、`center-left`、`center`、`center-right`、`bottom-left`、`bottom-center`、`bottom-right` を指定できます。
- `gap`: 有限の符号付き CSS ピクセル数。既定値は16です。要素では正数は間隔、0は境界の接触、負数は重なりです。center-right の -20 は右端から20px内側に配置します。角では両軸に適用し、中央の軸は gap を無視します。viewport では正数は内側、負数は外側です。movement-bounds 制限は維持されるため、画面外への配置には movement-bounds="none" を指定します。
- `offset`：任意の `{ x, y }` 補正。省略した軸は 0、負数も使用できます。
- `follow`：既定値は `true`。スクロール、寸法、配置の変化を慣性で追跡します。`false` は適用時に一度だけ位置を読み取ります。現在位置と目的位置が両方画面外の場合は待機します。

positioning と position-x/position-y を同時に指定した場合は positioning を優先します。その後、座標だけを明示的に変更すると接続を解除します。

初期位置は最初のフレーム表示前に適用し、その後の変更には既存の移動加速・減速設定を使用します。同じ宣言を渡しても移動は再開されません。対象が存在しない、または削除された場合は `sidekick-error` を通知して解除します。同じセレクターに一致する別ノードには自動で再接続しません。

`positioning = null` は接続を解除して減速します。`moveTo`、`moveBy`、`moveToElement`、`cancelMove`、`detachAnchor`、直接の `enter` / `exit` は宣言的な位置制御を解除します。再開するには宣言を再設定します。React の同じ prop による再描画は手動操作を上書きしないため、一度 `null` にするか宣言を変更してください。

`entrance` と併用すると entrance の出発位置から positioning の目的位置へ登場し、その後に追跡を開始します。既存の移動境界は引き続き適用されます。座標は所属文書・iframe のレイアウトビューポートの CSS px で、DOM 原点を保持します。アバターの祖先にある CSS transform/zoom は未対応です。動きを減らす設定では位置を即時適用します。
