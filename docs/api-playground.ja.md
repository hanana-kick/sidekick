# API プレイグラウンド：サイトプレビューとボット操作

サイトのプレビューを中心に、右下の**ボット操作**から設定・実行・JavaScript/React コード・診断を開きます。閉じる操作または Escape でランチャーにフォーカスが戻ります。ボット、入力、生成コード、Studio シーン、言語・フレームワークはリセットされません。非モーダルのパネルは狭い画面で一列になり、内部をスクロールできます。

組み込みデモは親ページ内にあります。空白を押して移動するか、`moveToElement` で `#preview-target` を指定します。ライフサイクル例の実行時は対象を利用できるよう組み込みデモへ戻ります。技術レッスンと編集用ハッシュのリンクはパネルを開き、Guide のシナリオ文脈リンクは既存の専用実習画面を維持します。

完全な HTTP(S) URL を入力し、**読み込む**を押すとリクエストします。クエリ内の URL を自動で読み込みません。HTTPS ページでは HTTP プレビューを拒否し、認証情報付き URL や他のプロトコルも禁止します。再読み込みは最後に送信した URL を使い、未送信の入力は使いません。**組み込みデモ**に戻ると iframe を削除します。

外部サイトは CSP frame-ancestors や X-Frame-Options により埋め込みを拒否できます。保護ヘッダーの除去やプロキシによる回避はしません。iframe の load イベントから成否を確実に判断できないため「プレビューを要求しました」と表示します。空白の場合はデモを使ってください。

ボットは親ページのビューポートに表示され、外部サイトには注入されません。iframe 内の要素選択・ポインター追跡はできません。通常はフレーム内のクリック・スクロールがそのサイトに届きます。任意の**クリックでボットを移動**は初期状態では無効で、有効にするとサイト操作を一時的に置き換えます。閉じた操作パネルがクリックやフォーカスを捕捉することはありません。

iframe は描画用スクリプトのみ許可する不透明オリジンの sandbox です。フォーム送信、ポップアップ、ダウンロード、親ページ移動、デバイス権限は許可しません。ログイン・ストレージが必要なサイトは正常に表示されない場合があります。ブラウザーの Cookie・通信ポリシーは適用され、匿名アクセスを保証するものではありません。

URL・パス・クエリ・フラグメント・入力内容はメモリ内のプレビュー移動にのみ使用し、ストレージ、ページ履歴、生成コード、GA4 へは保存・送信しません。読み込み時は対象サイトへの通信が発生しますが referrer は送りません。既存のサイト専用・許可リスト方式の分析は維持し、ライブラリには含めません。

単体テストはパネル状態・フォーカス・入力保持、URL 検証、自動読み込み防止、sandbox、成否不明の表示、デモ復帰、分析除外を確認します。用意されたブラウザーテストは 320/1280px、キーボード、クリック透過、埋め込み拒否を確認します。実際の表示検証は対応 CI で実行してください。

参考：[iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)、[frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)。


## テキスト台詞 API

say(text, options) は音声なしのプレーンテキスト吹き出しを表示し、直ちに void を返します。新しい呼び出しは前の台詞とタイマーを置き換え、キューには追加しません。clearSpeech() は void を返し、繰り返し呼び出せます。完了 Promise や終了イベントはありません。

duration は 0–60000ms、既定値は 5000 です。0 は解除まで維持します。placement は auto（既定）、top、bottom。空間が足りない場合は反対側に表示します。dismissible の既定値は false。閉じるボタンを使う場合は dismissLabel に翻訳されたアクセシブルな名前を指定します。

空白だけの文字列、1000文字超、無効なオプションは既存の台詞を変えずに TypeError を投げます。HTML は解釈しません。文書非表示、画面外移動、exit()、非表示 presence、DOM 削除で台詞は消え、再表示されません。アプリのリセットでは clearSpeech() を呼びます。

小さな DOM 吹き出しは実際の輪郭ではなく、ボットの保守的な DOM 境界に追従し、現在の iframe／画面内に制限されます。長文は制限された領域内で折り返され、スクロールできます。あふれた本文だけがキーボードフォーカスとポインター・タッチスクロールを受け付け、閉じるボタンはスクロール領域外に残ります。全文は polite の状態通知でも提供されます。フォーカスは移動せず、閉じるボタンとあふれた本文以外は操作を遮りません。追加描画ループ、GPU パス、音声、キャンバス拡大はありません。

```js
const bot = document.querySelector('sidekick-avatar');
bot.say("こちらの方がお得！", {
  duration: 5000, placement: 'auto',
  dismissible: true, dismissLabel: "台詞を閉じる"
});
// React: botRef.current?.say(text, options);
// Reset / cleanup:
bot.clearSpeech();
```

TypeScript: `SpeechOptions` from `@hanana-kick/sidekick/register` or `@hanana-kick/sidekick/react`. Method-only API; no HTML attributes or declarative React speech props.

配置制限: ボットの CSS zoom、祖先の transform（個別の translate/rotate/scale を含む）、perspective、CSS zoom は既存の台詞を置き換える前に TypeError になります。body と html では filter、backdrop-filter、contain、will-change、content-visibility など固定位置の基準を変えるスタイルを使わないでください。ボット自身の transform は使用できます。表示中はこの制限を守り、祖先の配置を変える前に clearSpeech() を呼びます。
