# API 演练场：网站预览与机器人控制

页面以网站预览为主。点击右下角的**机器人控制**打开操作、代码和诊断面板。关闭或按 Escape 会将焦点返回按钮，但不会重置机器人、输入、生成代码、Studio 场景、语言或框架。面板非模态，窄屏使用单列并独立滚动。

内置演示位于父页面。点击空白处移动机器人，或使用 `moveToElement` 定位 `#preview-target`。运行生命周期示例会返回内置演示以保证目标可见。技术课程及编辑器锚点链接会打开面板；Guide 场景上下文链接继续使用原有专用练习页面。

输入完整 HTTP(S) 网址并点击**加载网站**才会发起请求；不会自动访问查询参数中的网址。HTTPS 页面拒绝 HTTP 预览，禁止含用户名/密码的网址及其他协议。刷新使用最后提交的网址，而非未提交的输入。返回**内置演示**会移除 iframe。

外部网站可能通过 CSP frame-ancestors 或 X-Frame-Options 拒绝嵌入。不会代理网站或移除保护头。iframe load 事件不能可靠证明成功，因此状态仅表示“已请求预览”。空白时请使用内置演示。

机器人覆盖父页面，不会注入外部网站，无法选择 iframe 内的元素或读取其指针位置。默认点击和滚动属于嵌入网站。可选的**捕获点击来移动机器人**默认关闭，开启后会暂停网站交互；关闭即可恢复。隐藏的控制面板不会拦截点击或焦点。

iframe 只允许渲染脚本，使用不透明来源 sandbox；不允许表单提交、弹窗、下载、顶层导航或设备权限。需要登录或存储的网站可能无法正常运行。浏览器的网络和 Cookie 策略仍适用，不保证匿名浏览。

网址、路径、查询、片段和输入文本不写入存储、页面历史、生成代码、GA4，只用于内存中的预览导航。加载会向目标网站发送请求，但不发送 referrer。原有站点专用、白名单分析保持不变，库本身不包含分析。

单元测试覆盖面板状态与焦点、草稿保留、网址验证、禁止自动导航、sandbox、不确定的加载状态、演示恢复及分析隔离。浏览器测试覆盖 320/1280px、键盘、点击穿透及嵌入拒绝；实际视觉结果需在支持的 CI 中运行验证。

参考：[iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)、[frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)。


## 文本台词 API

say(text, options) 显示无音频的纯文本气泡，并立即返回 void。每次调用替换上一条消息及其计时器，不排队。clearSpeech() 返回 void，可重复安全调用。没有完成 Promise 或结束事件。

duration 范围为 0–60000ms，默认 5000。0 表示保持到清除。placement 支持 auto（默认）、top、bottom，空间不足时切换到另一侧。dismissible 默认为 false。启用关闭按钮时，请通过 dismissLabel 提供本地化的无障碍名称。

纯空白文本、超过1000字符的文本和无效选项会抛出 TypeError，且不替换现有台词。不解析 HTML。文档隐藏、移出屏幕、exit()、隐藏 presence 或移除 DOM 时永久清除台词。应用重置时调用 clearSpeech()。

小型 DOM 气泡跟随保守的机器人 DOM 边界，而不是精确像素轮廓，并限制在当前 iframe／视口内。长文本在受限区域内换行并可滚动。仅溢出的文本区域可通过键盘聚焦，并接收鼠标或触摸滚动；关闭按钮始终位于滚动区域之外。完整文本也通过 polite 状态通知提供。不移动焦点，只有可选关闭按钮和溢出的文本区域拦截输入。不增加渲染循环、GPU 绘制、音频或画布尺寸。

```js
const bot = document.querySelector('sidekick-avatar');
bot.say("这个更便宜！", {
  duration: 5000, placement: 'auto',
  dismissible: true, dismissLabel: "关闭台词"
});
// React: botRef.current?.say(text, options);
// Reset / cleanup:
bot.clearSpeech();
```

TypeScript: `SpeechOptions` from `@hanana-kick/sidekick/register` or `@hanana-kick/sidekick/react`. Method-only API; no HTML attributes or declarative React speech props.

布局限制：机器人自身的 CSS zoom 或祖先元素的 transform（包括独立 translate/rotate/scale）、perspective、CSS zoom 会在替换原台词之前抛出 TypeError。body 和 html 不得通过 filter、backdrop-filter、contain、will-change、content-visibility 等样式改变固定定位的包含块。支持机器人自身的 transform。显示期间需保持这些限制，修改祖先布局前调用 clearSpeech()。
